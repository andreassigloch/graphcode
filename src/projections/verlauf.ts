/**
 * verlauf.ts — der Verlauf der Marken und Befunde je Stufe ueber die committeten Staende (CR-GC-946).
 *
 * Je Commit, der `docs/graph/*.graph.json` geaendert hat, wird der Stand mit DENSELBEN Funktionen
 * gemessen wie der Live-Stand in `graph_readiness`: `evaluateAll` (Gate-Katalog + ND), `readinessOf`
 * (Marken), `countByStage` (Befunde je Stufe), `takeSteeringSnapshot` + `steerSpaceOf` (Steuerwert),
 * `verificationReport` (Testergebnisse wie `graph_test_report`), `chainMetrics` (wie `graph_metrics`).
 * Es gibt keine zweite Rechnung — nur eine zweite Eingabe: ein aus Git gelesener Stand statt des Stores.
 *
 * Ohne die Regeln des Code-Abgleichs (RC): zu einem alten Stand fehlen die Code-Fakten. Die Antwort
 * nennt die nicht ausgewerteten Regeln im Feld `skippedRules`.
 *
 * Rein ueber (Git-Lesefunktion, Policy, Zwischenspeicher): kein Store, kein Host. Der Zwischenspeicher
 * auf Platte steht in `verlauf-cache.ts`.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';
import { DefaultRuleEngine, createSeDescriptor, fromOntologyGraph, type Graph } from '@sigloch/graph-api-core';
import { chainMetrics, RULES_VERSION, SteerSpace, type MetricPolicy } from '@sigloch/contracts/se';
import { countByStage } from '@sigloch/graphcode-client';
import { createHash } from 'node:crypto';
import { gateViolations } from '../kernel/gate.js';
import { evaluateAll, readinessOf, SKIPPED_RULE_PREFIX, type EvaluationHarness } from '../kernel/evaluation.js';
import { takeSteeringSnapshot, steerSpaceOf } from '../kernel/measure/steering-snapshot.js';
import { toOntologyGraph } from '../kernel/conformance.js';
import { verificationReport } from './verification-report.js';

/** Hochzaehlen, wenn ein Messfeld dazukommt oder sich aendert: alte Eintraege treffen dann nie. */
export const VERLAUF_SCHEMA = 1;

/** Der Ort der Graph-Staende im Repo. */
export const VERLAUF_PFADSPEC = 'docs/graph/*.graph.json';

export const VerlaufStandSchema = z.object({
  hash: z.string(),
  short: z.string(),
  ts: z.string(),
  elements: z.number().int(),
  /** Die Marken SRR/PDR/CDR/TRR/Bau — je `reached`, dieselbe Rechnung wie `graph_readiness`. */
  marks: z.array(z.object({ id: z.string(), reached: z.boolean() })),
  /** Befunde je Stufe (Plan als eigene Stufe); Stufen ohne Befund stehen mit 0 da. */
  stages: z.array(z.object({ name: z.string(), findings: z.number().int() })),
  errors: z.number().int(),
  warnings: z.number().int(),
  /** Alle Befunde dieses Stands, jede Schwere. */
  open: z.number().int(),
  /** Der Steuerwert wie in `graph_readiness.steer`, die Terme zusammengezogen je Steuerregel. */
  steer: SteerSpace.omit({ terms: true }).extend({
    byRule: z.array(z.object({ ruleId: z.string(), terms: z.number().int(), over: z.number().int() })),
  }),
  /** Wie `graph_test_report.summary`: je Anforderung. `passed` = alle Tests bestanden, `failed` = ein Test rot, `neverRun` = nie gelaufen. */
  tests: z.object({
    requirements: z.number().int(),
    withVerifyTrace: z.number().int(),
    passed: z.number().int(),
    failed: z.number().int(),
    neverRun: z.number().int(),
  }),
  /** Wie `graph_metrics.measurability`: bewertbare / alle Ketten. */
  chains: z.object({ total: z.number().int(), measurable: z.number().int() }),
});
export type VerlaufStand = z.infer<typeof VerlaufStandSchema>;

export const VerlaufSchema = z.object({
  /** Zahl der jüngsten Staende, die angefragt war; `null` = alle. */
  window: z.number().int().nullable(),
  rulesVersion: z.string(),
  policySource: z.string(),
  /** Regeln, die der Verlauf NICHT auswertet (Code-Abgleich RC): ohne Code-Fakten laeuft keine. */
  skippedRules: z.array(z.string()),
  states: z.array(VerlaufStandSchema),
  /** Staende, die nicht lesbar oder nicht messbar waren — der Lauf bricht dafuer nicht ab. */
  skipped: z.number().int(),
  measured: z.number().int(),
  fromCache: z.number().int(),
  measureMs: z.number(),
});
export type Verlauf = z.infer<typeof VerlaufSchema>;

/** Der Zwischenspeicher je Stand. Der Schluessel bindet Commit, Regelversion und Policy. */
export interface VerlaufCache {
  get(key: string): VerlaufStand | undefined;
  set(key: string, stand: VerlaufStand): void;
}

/** Eine Git-Lesefunktion: Argumente in, Ausgabe als Text; wirft, wenn kein Git-Repo. */
export type GitLese = (args: string[]) => string;

export interface VerlaufEingabe {
  git: GitLese;
  policy: MetricPolicy;
  /** Herkunft der Policy (`config` | `default`) — geht in den Schluessel. */
  policySource: string;
  /** Zahl der jüngsten Staende; `null` = alle. */
  window: number | null;
  cache: VerlaufCache;
  /** Pfadspec der Graph-Dateien; Standard `docs/graph/*.graph.json`. */
  pfadspec?: string;
}

/** Ein Wert fuer die Policy im Schluessel: aendert sich ein Schwellenwert, misst der Verlauf neu. */
export function policyHash(policy: MetricPolicy): string {
  return createHash('sha256').update(JSON.stringify(policy)).digest('hex').slice(0, 12);
}

/** Alles am Schluessel ausser dem Commit: was ein Messergebnis ausser dem Stand bestimmt. */
export function verlaufPraefix(policy: MetricPolicy, policySource: string): string {
  return [VERLAUF_SCHEMA, RULES_VERSION, policySource, policyHash(policy), ''].join(':');
}

export function verlaufSchluessel(hash: string, policy: MetricPolicy, policySource: string): string {
  return verlaufPraefix(policy, policySource) + hash;
}

/** Die Commits, die den Graph geaendert haben, alt nach neu; je Commit die erste Graph-Datei. */
function leseStaende(git: GitLese, window: number | null, pfadspec: string): { hash: string; ts: string; file: string }[] {
  let log: string;
  try {
    log = git(['log', ...(window === null ? [] : ['-n', String(window)]), '--reverse', '--format=%x01%H %cI', '--name-only', '--', pfadspec]);
  } catch {
    return []; // kein Git-Repo: ein bekannter Zustand, kein Fehler
  }
  const states: { hash: string; ts: string; file: string }[] = [];
  let cur: { hash: string; ts: string } | null = null;
  for (const line of log.split('\n')) {
    if (line.startsWith('\x01')) {
      const [hash, ts] = line.slice(1).split(' ');
      cur = { hash, ts };
    } else if (cur && line.endsWith('.graph.json')) {
      states.push({ ...cur, file: line });
      cur = null;
    }
  }
  return states;
}

/** Der Gate-Katalog dieses Laufs: die Engine und die Regel-IDs, die sie traegt. */
interface Katalog {
  engine: DefaultRuleEngine;
  ids: string[];
}

/** Eine Harness-Attrappe: nur der Graph-Teil — ohne Repo-Wurzel, damit die RC-Regeln nicht laufen. */
function attrappe(graph: Graph, k: Katalog): EvaluationHarness {
  return {
    evaluateRules: () => gateViolations(k.engine, graph),
    getGraph: () => graph,
    getRepoRoot: () => '',
    getLoadedRuleIds: () => k.ids,
  };
}

/** Misst EINEN Stand. Wirft, wenn er nicht lesbar ist. */
export function messeStand(json: unknown, meta: { hash: string; ts: string }, policy: MetricPolicy, katalog: Katalog): VerlaufStand {
  const roh = json as { elements?: unknown; traces?: unknown } | null;
  if (!roh || !Array.isArray(roh.elements) || !Array.isArray(roh.traces)) {
    throw new Error('kein OntologyGraph (elements/traces fehlen)');
  }
  const graph = fromOntologyGraph(json as Parameters<typeof fromOntologyGraph>[0]);
  const ev = evaluateAll(attrappe(graph, katalog));
  const report = readinessOf(ev);
  const steer = steerSpaceOf(takeSteeringSnapshot(graph, policy));
  const { terms, ...kopf } = steer;
  const jeRegel = new Map<string, { terms: number; over: number }>();
  for (const t of terms) {
    const z = jeRegel.get(t.ruleId) ?? { terms: 0, over: 0 };
    z.terms += 1;
    if (t.overshoot > 0) z.over += 1;
    jeRegel.set(t.ruleId, z);
  }
  const chains = chainMetrics(toOntologyGraph(graph)).measurability;
  const tests = verificationReport(graph).summary;
  return VerlaufStandSchema.parse({
    hash: meta.hash,
    short: meta.hash.slice(0, 7),
    ts: meta.ts,
    elements: graph.nodes.length,
    marks: report.marks.map((m) => ({ id: m.id, reached: m.reached })),
    stages: countByStage(report.violations).map((s) => ({ name: s.name, findings: s.findings })),
    errors: report.violations.filter((v) => v.severity === 'error').length,
    warnings: report.violations.filter((v) => v.severity === 'warning').length,
    open: report.violations.length,
    steer: { ...kopf, byRule: [...jeRegel].map(([ruleId, z]) => ({ ruleId, ...z })).sort((a, b) => a.ruleId.localeCompare(b.ruleId)) },
    tests: {
      requirements: tests.requirements,
      withVerifyTrace: tests.withVerifyTrace,
      passed: tests.passed,
      failed: tests.failed,
      neverRun: tests.neverRun,
    },
    chains: { total: chains.chains, measurable: chains.measurable },
  });
}

/** Der Verlauf: je committetem Stand eine Messung; ein Stand, der schon im Zwischenspeicher liegt, wird nicht neu gemessen. */
export function rechneVerlauf(eingabe: VerlaufEingabe): Verlauf {
  const { git, policy, policySource, window, cache } = eingabe;
  const t0 = performance.now();
  const staende = leseStaende(git, window, eingabe.pfadspec ?? VERLAUF_PFADSPEC);
  const descriptor = createSeDescriptor(policy);
  const engine = new DefaultRuleEngine(descriptor.version);
  engine.register(descriptor.rules ?? []);
  const katalog: Katalog = { engine, ids: (descriptor.rules ?? []).map((r) => r.id) };

  const out: VerlaufStand[] = [];
  let measured = 0;
  let skipped = 0;
  for (const s of staende) {
    const key = verlaufSchluessel(s.hash, policy, policySource);
    const hit = cache.get(key);
    if (hit) {
      out.push(hit);
      continue;
    }
    try {
      const m = messeStand(JSON.parse(git(['show', `${s.hash}:${s.file}`])), s, policy, katalog);
      cache.set(key, m);
      out.push(m);
      measured += 1;
    } catch {
      skipped += 1; // nicht lesbar: gezaehlt, nicht gespeichert, der Lauf geht weiter
    }
  }
  // Welche Regeln der Verlauf nicht auswertet — aus derselben Funktion, auf einem leeren Graphen.
  const skippedRules = evaluateAll(attrappe({ nodes: [], edges: [] } as unknown as Graph, katalog)).skipped
    .filter((s) => s.startsWith(SKIPPED_RULE_PREFIX))
    .map((s) => s.slice(SKIPPED_RULE_PREFIX.length));
  return VerlaufSchema.parse({
    window,
    rulesVersion: RULES_VERSION,
    policySource,
    skippedRules,
    states: out,
    skipped,
    measured,
    fromCache: out.length - measured,
    measureMs: Math.round(performance.now() - t0),
  });
}
