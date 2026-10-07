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
import type { RuleViolation } from '@sigloch/contracts/harness';
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

/** A ranked, explained measure from `contextualHelp` — the explained Recommendations. */
export interface ContextualMeasure {
  entry: HelpEntry;
  /** Highest severity among the grouped violations (CR-GC-316) — order-independent. */
  severity: 'error' | 'warning' | 'info';
  /**
   * How often this rule fires (CR-GC-316). The TRUE count — `elementIds` may be
   * shorter, so a caller can always tell that the list was cut.
   */
  count: number;
  /** Up to `MAX_EXAMPLE_ELEMENTS` offending uids (rule blockers). Evidence, not the full set. */
  elementIds: string[];
  /** The first grouped violation's message, as an example of the shape. */
  message: string;
}

/**
 * How many offending uids a measure carries (CR-GC-316). Deliberately small: the
 * explanation belongs to the RULE, the elements are evidence for it. `count` sits next
 * to the list, so the cut is visible rather than silent — and whoever needs all of them
 * asks `rules_get_violations`, the diagnosis tool that stays at full depth.
 */
export const MAX_EXAMPLE_ELEMENTS = 5;

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

  // Metric dimension (CR-GC-458) — the six ℝ⁶ names that steer graph_suggest and
  // stand in every target profile. `plain` collapses purpose+lever into one sentence
  // for consumers that read only the two classic layers; `se` names the formula.
  // The one action that follows from understanding a dimension is setting its goal.
  const metric = METRIC_HELP[id];
  if (metric) {
    return {
      id,
      kind: 'metric',
      title: metric.title,
      token: id,
      plain: `${metric.purpose} ${metric.lever}`,
      se: `${metric.measure} Skala 0–5 (metrics(), layer 'arch', @sigloch/se-engine).`,
      prompt: 'se:target-profile',
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

const SEVERITY_RANK: Record<string, number> = { error: 0, warning: 1, info: 2 };

/**
 * The explained sibling of Recommendations (§7): ranked, explained measures from the live
 * violations — one per failing rule. Errors rank before warnings before info; ties keep input order.
 *
 * CR-GC-748: only rule findings. The creation blockers (CR-GC-221) and the `not-reached` gates
 * (CR-GC-746) are gone with the gate computation: what holds a mark IS a rule finding (an error or
 * an open existence finding), so it already stands in `violations` — and an empty graph is no
 * longer silent (R-33).
 */
export function contextualHelp(violations: RuleViolation[]): ContextualMeasure[] {
  const measures: ContextualMeasure[] = [];

  // Rule blockers — ONE measure per rule, not per violation (CR-GC-316). Each measure
  // used to carry a full copy of the HelpEntry, so a rule firing 96 times put the same
  // ~380 bytes of explanation into the answer 96 times. Grouping turns the repetition
  // into a number and leaves the payload a function of how many DISTINCT rules fire —
  // bounded by the catalog (66), not by the graph (403 elements and growing).
  const byRule = new Map<string, ContextualMeasure>();
  for (const v of violations) {
    const entry = helpEntry(v.ruleId);
    if (!entry) continue;
    const existing = byRule.get(v.ruleId);
    if (!existing) {
      byRule.set(v.ruleId, {
        entry,
        severity: v.severity,
        count: 1,
        elementIds: v.elementId ? [v.elementId] : [],
        message: v.message,
      });
      continue;
    }
    existing.count += 1;
    // Highest severity wins, so the ranking below does not depend on input order.
    if ((SEVERITY_RANK[v.severity] ?? 3) < (SEVERITY_RANK[existing.severity] ?? 3)) {
      existing.severity = v.severity;
    }
    if (v.elementId && existing.elementIds.length < MAX_EXAMPLE_ELEMENTS) {
      existing.elementIds.push(v.elementId);
    }
  }
  measures.push(...byRule.values());

  return measures.sort((a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3));
}
