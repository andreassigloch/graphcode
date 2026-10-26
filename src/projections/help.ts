/**
 * help.ts — the help DATA LAYER (CR-GC-228): a pure projection from
 * HELP_CONTENT + V3_RULES + readiness + the artifact catalog to `HelpEntry[]`,
 * the read-only sibling of `panels.ts`. No DOM, no HTTP, no mutation — every
 * surface (the `graph_help` MCP tool, the `se:help` skill, a renderer) consumes
 * these view-models instead of re-assembling the layers itself (no parallel path).
 *
 * Roll-up, NOT detection (docs/archive/proposals/help-system.md §2): every `HelpEntry` ALWAYS carries all
 * three layers (`plain` / `se` / the exact `prompt` where one applies); the surface
 * picks the depth — graphcode is headless and has no user identity to profile.
 *
 * Anti-drift: the authored two layers come from `help-content.ts`; the derived
 * fields (a rule's title/severity, its stage and mark, the artifact label) are read
 * from the live sources — a new rule appears in help automatically (CR-GC-227).
 *
 * @author andreas@siglochconsulting
 */
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { ALL_RULE_DEFS, Mark } from '@sigloch/contracts/se';
import { MARK_LABELS } from '../kernel/measure/readiness.js';
import { ARTIFACT_CATALOG } from './panels.js';
import { HELP_CONTENT, HELP_VOCAB, HELP_PANEL_IDS, METRIC_HELP } from './help-content.js';
import { TOOL_HELP } from './tool-help.js';

/** A fully-assembled help item — all three layers + the derived skeleton. */
export interface HelpEntry {
  id: string;
  kind: 'rule' | 'mark' | 'panel' | 'artifact' | 'token' | 'metric' | 'tool';
  /** Plain-language title — derived (rule/gate/artifact name) or the token. */
  title: string;
  /** The raw on-screen token, if different from the title (e.g. `R-04`, `CDR`). */
  token?: string;
  /** Layer 0 — no SE jargon. */
  plain: string;
  /** Layer 1 — the standard SE concept. */
  se: string;
  /** Layer 2 — the exact copy-prompt, where one applies. */
  prompt?: string;
  /** Rules only — severity, from V3_RULES (derived). */
  severity?: string;
  /** Rules only — the stage the rule carries at its definition, 1–12 or `'immer'` (`ALL_RULE_DEFS[].stage`, derived). */
  stage?: number | 'immer';
  /** Rules only — the mark that stage lies before (`ALL_RULE_DEFS[].mark`, derived); absent for `'immer'`. */
  mark?: string;
  /**
   * Metrics only (CR-GC-458) — the three questions a NUMBER raises, which are not the
   * ones a rule raises: what is counted, what it is for, what moves it. `plain`/`se`
   * stay filled alongside them, so a consumer reading only those two keeps working.
   */
  measure?: string;
  purpose?: string;
  lever?: string;
  /** Metrics only — the scale the value lives on, so nobody guesses at it. */
  scale?: { min: number; max: number };
  source: 'derived' | 'authored';
}

const RULE_BY_ID = new Map(
  (SE_DESCRIPTOR.rules as Array<{ id: string; name: string; severity: string }>).map((r) => [r.id, r]),
);
const ARTIFACT_BY_ID = new Map(ARTIFACT_CATALOG.map((a) => [a.id, a]));

/** rule id → its definition in the catalog: stage and the mark derived from it (CR-SM-395). */
const RULE_DEF = new Map(ALL_RULE_DEFS.map((r) => [r.id, r]));
/** The group of the rules that belong to no single mark (`stage: 'immer'`). */
export const RULES_WITHOUT_MARK = 'immer';

const PANEL_IDS = new Set<string>(HELP_PANEL_IDS);

/**
 * Assemble the `HelpEntry` for any dashboard id — a ruleId, gate id, panel id,
 * artifact id, or vocabulary token — merging the authored layers with the derived
 * skeleton. Returns `undefined` for an unknown id.
 */
export function helpEntry(id: string): HelpEntry | undefined {
  const content = HELP_CONTENT[id];

  // Werkzeug (CR-GC-612) — was es im Einzelnen bedeutet, auf Abruf. Die Beschreibung im Katalog
  // sagt nur noch, WANN man es nimmt; sie steht in jeder Executor-Runde im Kontext, das hier nicht.
  const tool = TOOL_HELP[id];
  if (tool) return { id, kind: 'tool', title: id, token: id, plain: tool.plain, se: tool.se, source: 'authored' };

  // Rule — derived title/severity/owning-gate from the live registries.
  const rule = RULE_BY_ID.get(id);
  if (rule && content) {
    return {
      id,
      kind: 'rule',
      title: rule.name,
      token: id,
      plain: content.plain,
      se: content.se,
      prompt: content.prompt,
      severity: rule.severity,
      stage: RULE_DEF.get(id)?.stage,
      mark: RULE_DEF.get(id)?.mark ?? undefined,
      source: 'derived',
    };
  }

  // Mark — title from the readiness labels.
  const mark = Mark.safeParse(id);
  if (content && mark.success) {
    return { id, kind: 'mark', title: MARK_LABELS[mark.data], token: id, plain: content.plain, se: content.se, prompt: content.prompt, source: 'authored' };
  }

  // Artifact — label from the catalog (CR-GC-222).
  const art = ARTIFACT_BY_ID.get(id);
  if (art && content) {
    return { id, kind: 'artifact', title: art.label, plain: content.plain, se: content.se, prompt: content.prompt, source: 'authored' };
  }

  // Panel.
  if (content && PANEL_IDS.has(id)) {
    return { id, kind: 'panel', title: id, plain: content.plain, se: content.se, prompt: content.prompt, source: 'authored' };
  }

  // Metric dimension (CR-GC-458) — the six ℝ⁶ names `graph_metrics` reports. `plain` collapses
  // purpose+lever into one sentence for consumers that read only the two classic layers; `se`
  // names the formula. The one action that follows from understanding a dimension is writing a
  // constraint at an element (CR-GC-852: se:constraints, no weights since CR-GC-853).
  const metric = METRIC_HELP[id];
  if (metric) {
    return {
      id,
      kind: 'metric',
      title: metric.title,
      token: id,
      plain: `${metric.purpose} ${metric.lever}`,
      se: `${metric.measure} Skala 0–5 (metrics(), layer 'arch', @sigloch/se-engine).`,
      prompt: 'se:constraints',
      measure: metric.measure,
      purpose: metric.purpose,
      lever: metric.lever,
      scale: { min: 0, max: 5 },
      source: 'authored',
    };
  }

  // Vocabulary token (no copy-prompt).
  const vocab = HELP_VOCAB[id];
  if (vocab) {
    return { id, kind: 'token', title: id, plain: vocab.plain, se: vocab.se, source: 'authored' };
  }

  // Any other authored content (defensive — keeps a stray HELP_CONTENT key visible).
  if (content) {
    return { id, kind: 'panel', title: id, plain: content.plain, se: content.se, prompt: content.prompt, source: 'authored' };
  }
  return undefined;
}

/**
 * The full rule catalog grouped by mark (§8 Rules tab): SRR/PDR/CDR/TRR/Bau, plus `immer` for the
 * rules over all elements that belong to no single mark. Derived from `ALL_RULE_DEFS[].mark`, so it
 * covers exactly the live catalog — no hand-count, and a rule that moves stage moves group.
 */
export function helpForRules(): Record<string, HelpEntry[]> {
  const groups: Record<string, HelpEntry[]> = Object.fromEntries([...Mark.options, RULES_WITHOUT_MARK].map((m) => [m, []]));
  for (const r of ALL_RULE_DEFS) {
    const entry = helpEntry(r.id);
    if (entry) groups[r.mark ?? RULES_WITHOUT_MARK]!.push(entry);
  }
  return groups;
}
