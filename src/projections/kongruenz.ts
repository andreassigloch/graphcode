/**
 * Das dreiwertige Code-Urteil (kongruent · gedriftet · nicht pruefbar) samt seiner Reichweite: Bindungsquote der
 * Blatt-FUNC (`realRef`) und Import-Deckung. Rein; Eingang ist das Ergebnis von `graph_readiness` und der flache Graph.
 *
 * Herkunft: `rig/greenfield-systemtest/metrics.mjs` (CR-GC-574), dann `scripts/kongruenz.mjs` (CR-GC-740); im Paket seit
 * CR-GC-1008, damit ein Leser ausserhalb des Repos (der Nachtlauf von aise-bok, ITEM-2026-1587) dieselbe Rechnung nutzt
 * statt sie zu kopieren. Leser im Repo: `scripts/messung.mjs` (T-V4).
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';

/** Ein Element des flachen Graphen: Felder direkt oder unter `attributes`. */
export interface KongruenzElement {
  id: string;
  type: string;
  realRef?: unknown;
  attributes?: Record<string, unknown>;
}
export interface KongruenzGraph {
  elements: KongruenzElement[];
  traces?: { source: string; target: string; type: string }[];
}
/** Der Teil des Readiness-Berichts, den das Urteil liest. */
export interface KongruenzReadiness {
  violationsByRule?: Record<string, number>;
  skipped?: string[];
  importCoverage?: { endpoints: number; assigned: number } | null;
}
/** Der Vertrag des Urteils (SCHEMA-code-urteil): ein Leser ausserhalb des Repos parst damit an seiner Grenze. */
export const BindungSchema = z.object({ leafFuncs: z.number().int(), bound: z.number().int(), pct: z.number().nullable() });
export const CodeVerdictSchema = z.object({
  verdict: z.enum(['kongruent', 'gedriftet', 'nicht pruefbar']),
  why: z.string(),
  reach: z.object({ endpoints: z.number().int(), assigned: z.number().int(), pct: z.number() }),
  binding: BindungSchema,
  rcViolations: z.record(z.string(), z.number().int()),
});
export type Bindung = z.infer<typeof BindungSchema>;
export type CodeVerdict = z.infer<typeof CodeVerdictSchema>;
export type CodeUrteil = CodeVerdict['verdict'];

/** Bindungsquote der BLATT-FUNC: ein Elter ohne realRef ist keine Luecke, seine Kinder tragen die Bindung. */
export function binding(graph: KongruenzGraph): Bindung {
  const at = (e: KongruenzElement, k: string): unknown => (e as unknown as Record<string, unknown>)[k] ?? e.attributes?.[k];
  const kinder = new Map<string, string[]>();
  for (const t of graph.traces ?? []) {
    if (t.type !== 'compose') continue;
    if (!kinder.has(t.source)) kinder.set(t.source, []);
    kinder.get(t.source)!.push(t.target);
  }
  const typeOf = new Map(graph.elements.map((e) => [e.id, e.type]));
  const funcs = graph.elements.filter((e) => e.type === 'FUNC');
  const leaves = funcs.filter((f) => !(kinder.get(f.id) ?? []).some((c) => typeOf.get(c) === 'FUNC'));
  const bound = leaves.filter((f) => at(f, 'realRef') != null);
  return { leafFuncs: leaves.length, bound: bound.length, pct: leaves.length ? Math.round((100 * bound.length) / leaves.length) : null };
}

/** Das Urteil nennt IMMER seine Reichweite — nie nur das Wort. */
export function codeVerdict(r: KongruenzReadiness, graph: KongruenzGraph): CodeVerdict {
  const rc = Object.entries(r.violationsByRule ?? {}).filter(([id]) => id.startsWith('RC-'));
  const nieGelaufen = (r.skipped ?? []).filter((s) => s.startsWith('rule:RC-'));
  const cov = r.importCoverage ?? { endpoints: 0, assigned: 0 };
  const reach = cov.endpoints ? Math.round((100 * cov.assigned) / cov.endpoints) : 0;
  const bind = binding(graph);

  let verdict: CodeUrteil;
  if (nieGelaufen.length) verdict = 'nicht pruefbar';
  else if (!cov.endpoints && !bind.bound) verdict = 'nicht pruefbar';
  else if (rc.length) verdict = 'gedriftet';
  else verdict = 'kongruent';

  // Der Erzeuger parst seinen Vertrag (FAQ erzeuger-parst-vertrag): was hier herausgeht, haelt CodeVerdictSchema.
  return CodeVerdictSchema.parse({
    verdict,
    why: nieGelaufen.length
      ? `RC-Regeln nicht ausgewertet: ${nieGelaufen.join(', ')}`
      : !cov.endpoints && !bind.bound
        ? 'keine Bindung und keine aufloesbare Quelldatei — es gibt nichts zu pruefen'
        : rc.length
          ? `RC-Befunde: ${rc.map(([id, n]) => `${id} x${n}`).join(', ')}`
          : `keine RC-Befunde bei ${reach} % Reichweite`,
    reach: { endpoints: cov.endpoints, assigned: cov.assigned, pct: reach },
    binding: bind,
    rcViolations: Object.fromEntries(rc),
  });
}
