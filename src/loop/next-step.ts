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

/**
 * Je Kern-Regel die Bitte des Nutzers; `{n}` = die Namen der Fund-Elemente (CR-GC-730). Je Regel, nicht je
 * Dimension: ein Fund-Fenster gehoert genau einer Regel, und ein Vorschlag soll genau einen Schritt nennen.
 * Je Dimension („Arbeite die Ablaeufe weiter aus") las der Client ihn als „alles Offene" und baute in Probe G
 * Zug 3 zwei Plan-Schritte in einem Zug (38 min, 5 Ablehnungen). Die Eintrittspunkte AF-01..05 stehen in
 * ANALYSE; `tests/mcp.mutate-next-step.test.ts` haelt die Liste gleich mit den Kern-Regeln der contracts.
 */
export const VORSCHLAG_REGEL: Record<string, string> = {
  // Abläufe (uc)
  'UC-01': 'Lege für die Abläufe {n} Anforderungen mit Test an.',
  // CR-GC-731: UC-02 verlangt ACTOR → FLOW → FUNC der Kette des Ablaufs. Ist der Nutzer schon an Datenflüsse
  // angebunden, fehlen die Funktionen — der Satz nennt sie, sonst liest er sich wie erledigt (Probe H Zug 4).
  'UC-02': 'Lege für die Abläufe {n} die Funktionen an, die der Nutzer über einen Datenfluss auslöst.',
  'UC-03': 'Beschreibe die Abläufe {n} als Kette von Funktionen.',
  'UC-04': 'Beschreibe das Ziel der Abläufe {n}.',
  'R-15': 'Vervollständige die Funktionsketten {n}.',
  'R-16': 'Verbinde den Nutzer {n} über Datenflüsse mit den Funktionen.',
  'R-17': 'Lege die Abläufe des Systems {n} an.',
  'FC-02': 'Beschreibe die Abläufe {n} als Kette von Funktionen.',
  'FC-03': 'Hebe die inneren Schritte der Funktionen {n} auf die Ebene ihrer Kette.',
  'FC-04': 'Verbinde Anfang und Ende der Funktionsketten {n} mit dem Nutzer.',
  'FC-05': 'Verbinde die Schritte der Funktionsketten {n} über Datenflüsse.',
  // Anforderungen (req)
  'RD-01': 'Lege an, was die Anforderungen {n} erfüllt.',
  'RD-02': 'Lass die Anforderungen {n} nur über ihre Teilanforderungen erfüllen.',
  // Architektur (arch)
  'R-02': 'Ordne die Funktionen {n} den Anforderungen zu, die sie erfüllen.',
  'R-08': 'Repariere oder entferne die Verbindungen an {n}, deren Ziel fehlt.',
  'R-10': 'Vervollständige die Datenflüsse {n}: woher sie kommen und wohin sie gehen.',
  'IO-02': 'Gib den Datenflüssen {n} je genau eine Quelle.',
  'R-12': 'Löse die zyklische Abhängigkeit um {n} auf.',
  'R-18': 'Korrigiere die unzulässigen Verbindungen an {n}.',
  'RD-04': 'Gruppiere die Teile unter {n}, es sind zu viele auf einer Ebene.',
  'RD-05': 'Löse die Ebene unter {n} auf oder sammle dort, was zusammengehört.',
  'R-30': 'Ordne die Funktionen {n} der Kette ihres Ablaufs zu.',
  'R-31': 'Verbinde die Funktionen {n} auf der fehlenden Seite mit einem Datenfluss.',
  'BW-02': 'Bündle die Datenformate an der Grenze von {n} oder teile den Block.',
  'CR-01': 'Prüfe den Schnitt zwischen {n}, dort fließen ungewöhnlich viele Daten.',
  'IO-01': 'Ergänze den Datenfluss zwischen den Schritten {n}.',
  'NFR-01': 'Bringe {n} unter sein Budget oder ändere das Budget bewusst.',
  'ND-01': 'Führe die doppelten Funktionen {n} zusammen oder grenze sie ab.',
  // Module (alloc)
  'R-04': 'Verringere die Datenformate an der Grenze des Moduls {n}.',
  'R-22': 'Ordne die Funktionen {n} Modulen zu.',
  'R-23': 'Gib den Modulen {n} Funktionen oder entferne sie.',
  'MT-01': 'Prüfe die Abhängigkeiten des Moduls {n}.',
  'MT-02': 'Teile das Modul {n}, seine Teile arbeiten nicht zusammen.',
  // Prüfung (ver)
  'R-01': 'Ergänze Tests für die Anforderungen {n}.',
  'R-05': 'Ordne die Tests {n} den Anforderungen zu, die sie prüfen.',
  'R-21': 'Sichere die Übergaben zwischen {n} mit Anforderungen oder einem Integrationstest ab.',
  // Datenformate (schema)
  'SC-02': 'Verbinde das Datenformat {n} mit seinem Datenfluss oder entferne es.',
  'ND-02': 'Führe die doppelten Datenformate {n} zusammen oder grenze sie ab.',
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
  const regel = step.focusKey?.split(':')[1] ?? '';
  const eintritt = TASK_OF_ENTRY.get(regel);
  if (eintritt) return `Führe ${ANALYSE[eintritt]} durch.`;
  const vorlage = VORSCHLAG_REGEL[regel];
  if (!vorlage) throw new Error(`CR-GC-730: kein Vorschlag für Regel ${regel}`);
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
