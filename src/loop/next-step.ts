/**
 * next-step.ts — der Vorschlag an den Nutzer in der Antwort auf die angewandte Mutation (CR-GC-729).
 *
 * Vorher (CR-GC-588) fuhr hier als `next` der Imperativ der naechsten Runde mit — derselbe Text wie
 * `graph_generate`, mit Fix-Vorlagen und dem Angebot, Funde als acceptedFindings abzunehmen. Gemessen
 * (Probe todo E/F, 2026-10-03): der Client las ihn als Auftrag; in 7 von 10 Antworten trug er
 * Arbeit an, die der Nutzer nicht verlangt hatte, und F nahm AF-01..05 von selbst ab. Im
 * interaktiven Betrieb entscheidet der Nutzer ueber den naechsten Schritt — also geht der Schritt
 * an ihn: ein Satz in seiner Sprache, als Bitte an den Agenten formuliert, ohne Fix-Anleitung,
 * Werkzeugaufrufe oder Abnahme-Angebot. Ein Client-Plugin legt ihn ins Eingabefeld.
 *
 * Der Arbeitsauftrag an den Agenten bleibt `graph_generate` (Automodus, /se:generate) — EIN Kanal
 * je Empfaenger. Gewaehlt wird derselbe Schritt (`stepWithMemory`, dasselbe Sitzungsgedaechtnis);
 * nur seine Form ist hier eine andere.
 *
 * Nur nach ANGEWANDTER Mutation ueber die Leitung: bei `dryRun` und bei Ablehnung ist das Urteil
 * der Kanal.
 *
 * @author andreas@siglochconsulting
 */
import type { Graph } from '@sigloch/graph-api-core';
import { ALL_RULE_DEFS, RULE_HELP, TASK_ENTRY, taskOf, type MetricPolicy, type RuleTask } from '@sigloch/contracts/se';
import { generationStep, type GenerationStep } from './generate.js';
import { loadTargetProfile } from './target-profile.js';
import { stepWithMemory, type FocusMemory } from './stagnation.js';

type Task = Exclude<RuleTask, 'kern'>;

/** Die Analysen in der Sprache des Nutzers. */
const ANALYSE: Record<Task, string> = {
  conops: 'das Einsatzkonzept (ConOps)',
  trade: 'den Variantenvergleich (Trade-off)',
  irr: 'das Annahmen-Review',
  fmea: 'die Fehlerbetrachtung (FMEA)',
  plan: 'den Bauplan',
  anforderungsqualitaet: 'die Prüfung der Anforderungsqualität',
  realisierung: 'die Bindung an Code und Tests',
};

const TASK_OF_ENTRY = new Map(
  (Object.entries(TASK_ENTRY) as [Task, string | null][]).filter(([, e]) => e).map(([t, e]) => [e as string, t]),
);

/**
 * Die Saetze je Kern-Regel stehen seit CR-SM-384 in den contracts (`RULE_HELP[id].vorschlag`, CR-GC-733): die
 * Regelmatrix ist SSOT fuer alle Texte einer Regel, und der Smeagol-Check dort haelt Menge und Form (jede
 * Kern-Regel ohne info und ohne Eintrittspunkt hat einen Satz; kein Werkzeug, kein Fix, keine Regel-ID). Hier
 * steht nur, was keine Regel ist: Kaltstart, Analysen, Freigabe, Festgefahren.
 *
 * Startpruefung statt Wurf nach dem Schreiben (Probe G, CR-GC-730): fehlt einer fokusfaehigen Regel der Satz —
 * nur bei einer contracts-Version unter dem Peer-Floor moeglich —, faellt der Host beim Laden, nicht die
 * Mutation nach dem Persistieren.
 */
const OHNE_VORSCHLAG = ALL_RULE_DEFS
  .filter((r) => taskOf(r.id) === 'kern' && r.severity !== 'info' && !TASK_OF_ENTRY.has(r.id) && !RULE_HELP[r.id]?.vorschlag)
  .map((r) => r.id);
if (OHNE_VORSCHLAG.length > 0) {
  throw new Error(`CR-GC-733: RULE_HELP ohne vorschlag fuer ${OHNE_VORSCHLAG.join(', ')} — contracts >= 10.14 noetig`);
}

/** Der Kaltstart je Stufe (SEED_STAGES). */
export const VORSCHLAG_SEED: Record<string, string> = {
  'seed:sys': 'Lege das System an: Zweck und Grenze.',
  'seed:uc': 'Lege die Abläufe (Use Cases) des Systems an.',
  'seed:actor': 'Lege die Nutzer (Akteure) an und verbinde sie mit den Abläufen.',
};


function namen(graph: Graph, uids: readonly string[]): string {
  const byUid = new Map(graph.nodes.map((n) => [n.uid, n.name]));
  return uids.map((u) => byUid.get(u) ?? u).join(', ');
}

function mitNamen(vorlage: string, graph: Graph, uids: readonly string[]): string {
  return vorlage.replace('{n}', namen(graph, uids));
}

/** Der Schritt als Satz an den Nutzer — eine Bitte, die er so an den Agenten schicken kann. */
export function vorschlagAusSchritt(step: GenerationStep, graph: Graph, task: RuleTask): string {
  if (step.phase === 'handoff') {
    return task === 'kern'
      ? 'Fasse das Modell zusammen — ich prüfe es und gebe es frei.'
      : 'Die Analyse ist fertig — zurück zum Modell.';
  }
  if (step.phase === 'stalled') return 'Zeig mir die offenen Regelhinweise und was du je Hinweis vorschlägst.';
  const dim = step.focusDimension ?? '';
  if (step.phase === 'seed') {
    // Weder SYS noch Intention: die Frage geht an den Nutzer, der Agent stellt sie.
    if (step.focusDimension === null) return 'Frag mich, was das System für wen leisten soll.';
    const satz = VORSCHLAG_SEED[dim];
    if (!satz) throw new Error(`CR-GC-729: kein Vorschlag für Kaltstart-Stufe ${dim}`);
    return satz;
  }
  if (task !== 'kern') return `Führe ${ANALYSE[task]} weiter.`;
  const regel = step.focusKey?.split(':')[1] ?? '';
  const eintritt = TASK_OF_ENTRY.get(regel);
  if (eintritt) return `Führe ${ANALYSE[eintritt]} durch.`;
  const vorlage = RULE_HELP[regel]?.vorschlag;
  if (!vorlage) throw new Error(`CR-GC-733: kein Vorschlag für Regel ${regel}`);
  return mitNamen(vorlage, graph, step.focusElements ?? []);
}

/**
 * Der Vorschlag nach einer angewandten Mutation — gewaehlt wie der Schritt, den `graph_generate`
 * fuer einen MCP-Host liefern wuerde: Intention aus dem SYS, Schwelle des Hosts, `selection: 'host'`,
 * Profil frisch geladen, dasselbe Sitzungsgedaechtnis (CR-GC-596).
 */
export function vorschlagNachAnwendung(
  graph: Graph,
  policy: MetricPolicy,
  threshold: number,
  repoRoot: string,
  memory: FocusMemory,
  version: number,
): string {
  const profile = loadTargetProfile(repoRoot);
  const step = stepWithMemory(memory, version, (defer, optimum) =>
    generationStep(graph, policy, undefined, threshold, defer, 'host', profile, memory.task, optimum),
  );
  return vorschlagAusSchritt(step, graph, memory.task);
}
