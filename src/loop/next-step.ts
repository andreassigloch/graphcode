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
import { TASK_ENTRY, type MetricPolicy, type RuleTask } from '@sigloch/contracts/se';
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

/** Je Fokus-Dimension die Bitte des Nutzers; `{n}` = die Namen der Fund-Elemente. */
export const VORSCHLAG_DIMENSION: Record<string, string> = {
  uc: 'Arbeite die Abläufe {n} weiter aus.',
  req: 'Schärfe die Anforderungen an {n}.',
  arch: 'Lege Funktionen und Datenflüsse für {n} an.',
  alloc: 'Ordne die Funktionen {n} Modulen zu.',
  ver: 'Ergänze Tests für {n}.',
  schema: 'Beschreibe die Datenformate der Flüsse {n}.',
  cr: 'Verknüpfe die Änderungen {n} mit ihrem Umfang.',
  ms: 'Plane die Meilensteine {n}.',
};

/** Der Kaltstart je Stufe (SEED_STAGES). */
export const VORSCHLAG_SEED: Record<string, string> = {
  'seed:sys': 'Lege das System an: Zweck und Grenze.',
  'seed:uc': 'Lege die Abläufe (Use Cases) des Systems an.',
  'seed:actor': 'Lege die Nutzer (Akteure) an und verbinde sie mit den Abläufen.',
};

const TASK_OF_ENTRY = new Map(
  (Object.entries(TASK_ENTRY) as [Task, string | null][]).filter(([, e]) => e).map(([t, e]) => [e as string, t]),
);

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
  const eintritt = TASK_OF_ENTRY.get(step.focusKey?.split(':')[1] ?? '');
  if (eintritt) return `Führe ${ANALYSE[eintritt]} durch.`;
  const vorlage = VORSCHLAG_DIMENSION[dim];
  if (!vorlage) throw new Error(`CR-GC-729: kein Vorschlag für Dimension ${dim}`);
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
