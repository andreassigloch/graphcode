/**
 * help.ts — the help DATA LAYER (CR-GC-228): a pure projection from
 * HELP_CONTENT + V3_RULES + readiness + the artifact catalog to `HelpEntry[]`,
 * the read-only sibling of `panels.ts`. No DOM, no HTTP, no mutation — every
 * surface (the `graph_help` MCP tool, the `se:help` skill, a renderer) consumes
 * these view-models instead of re-assembling the layers itself (no parallel path).
 *
 * Roll-up, NOT detection (help-system.md §2): every `HelpEntry` ALWAYS carries all
 * three layers (`plain` / `se` / the exact `prompt` where one applies); the surface
 * picks the depth — graphcode is headless and has no user identity to profile.
 *
 * Anti-drift: the authored two layers come from `help-content.ts`; the derived
 * fields (a rule's title/severity, its owning gate, the artifact label) are read
 * from the live sources — a new rule appears in help automatically (CR-GC-227).
 *
 * @author andreas@siglochconsulting
 */
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { RuleViolation } from '@sigloch/contracts/harness';
import {
  PHASE_GATE_RULES,
  PHASE_GATE_LABELS,
  IMPL_GATE_MILESTONES,
  IMPL_GATE_RULES,
  creationBlockingMsg,
  type ReadinessReport,
} from '../readiness.js';
import { ARTIFACT_CATALOG } from './panels.js';
import { HELP_CONTENT, HELP_VOCAB, HELP_PANEL_IDS } from './help-content.js';

/** A fully-assembled help item — all three layers + the derived skeleton. */
export interface HelpEntry {
  id: string;
  kind: 'rule' | 'gate' | 'panel' | 'artifact' | 'token';
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
  /** Rules only — the gate that owns the rule, from readiness.ts (derived). */
  ownedByGate?: string;
  source: 'derived' | 'authored';
}

/** A ranked, explained measure from `contextualHelp` — the explained Recommendations. */
export interface ContextualMeasure {
  entry: HelpEntry;
  severity: 'error' | 'warning' | 'info';
  /** A failing rule (keyed `ruleId`) or a not-done creation (keyed artifact id, CR-GC-221). */
  blockerKind: 'rule' | 'creation';
  /** The offending element (rule blockers). */
  elementId?: string;
  /** The gate that surfaced the blocker (creation blockers). */
  gateId?: string;
  message: string;
}

const RULE_BY_ID = new Map(
  (SE_DESCRIPTOR.rules as Array<{ id: string; name: string; severity: string }>).map((r) => [r.id, r]),
);
const ARTIFACT_BY_ID = new Map(ARTIFACT_CATALOG.map((a) => [a.id, a]));

/** rule id → the gate that owns it (phase gates + the impl-gate milestone rules). */
const GATE_OF_RULE: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [gate, ruleIds] of Object.entries(PHASE_GATE_RULES)) {
    for (const r of ruleIds) m.set(r, gate);
  }
  for (const r of IMPL_GATE_RULES) m.set(r, 'impl');
  return m;
})();

const PANEL_IDS = new Set<string>(HELP_PANEL_IDS);
const isReadinessNumber = (id: string) => id === 'compliance' || id === 'totalElements' || id === 'elementsWithErrors';

/**
 * Assemble the `HelpEntry` for any dashboard id — a ruleId, gate id, panel id,
 * artifact id, or vocabulary token — merging the authored layers with the derived
 * skeleton. Returns `undefined` for an unknown id.
 */
export function helpEntry(id: string): HelpEntry | undefined {
  const content = HELP_CONTENT[id];

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
      ownedByGate: GATE_OF_RULE.get(id),
      source: 'derived',
    };
  }

  // Gate — title from the readiness labels.
  if (content && (id in PHASE_GATE_RULES || id in IMPL_GATE_MILESTONES)) {
    const title = PHASE_GATE_LABELS[id] ?? IMPL_GATE_MILESTONES[id]?.label ?? id;
    return { id, kind: 'gate', title, token: id, plain: content.plain, se: content.se, prompt: content.prompt, source: 'authored' };
  }

  // Artifact — label from the catalog (CR-GC-222).
  const art = ARTIFACT_BY_ID.get(id);
  if (art && content) {
    return { id, kind: 'artifact', title: art.label, plain: content.plain, se: content.se, prompt: content.prompt, source: 'authored' };
  }

  // Panel or readiness number.
  if (content && (PANEL_IDS.has(id) || isReadinessNumber(id))) {
    return { id, kind: 'panel', title: id, plain: content.plain, se: content.se, prompt: content.prompt, source: 'authored' };
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
 * The full rule catalog grouped by its owning gate (§8 Rules tab). Phase rules sit
 * under SRR/PDR/CDR/TRR; the milestone rules (MS-01/MS-02) under `impl`. Derived from
 * `readiness.ts`, so it covers exactly the live `V3_RULES` set — no hand-count.
 */
export function helpForRules(): Record<string, HelpEntry[]> {
  const groups: Record<string, HelpEntry[]> = {};
  for (const [gate, ruleIds] of Object.entries(PHASE_GATE_RULES)) {
    groups[gate] = ruleIds.map((r) => helpEntry(r)).filter((e): e is HelpEntry => !!e);
  }
  groups.impl = [...IMPL_GATE_RULES].map((r) => helpEntry(r)).filter((e): e is HelpEntry => !!e);
  return groups;
}

const SEVERITY_RANK: Record<string, number> = { error: 0, warning: 1, info: 2 };

/**
 * The explained sibling of Recommendations (§7): ranked, explained measures from the
 * live readiness + violations. Handles BOTH blocker kinds (CR-GC-221): rule violations
 * (keyed `ruleId`) and not-done creations from `ReadinessGate.blocking[]` (keyed artifact
 * id, NOT a `ruleId`). Errors rank before warnings before info; ties keep input order.
 */
export function contextualHelp(readiness: ReadinessReport, violations: RuleViolation[]): ContextualMeasure[] {
  const measures: ContextualMeasure[] = [];

  // Rule blockers.
  for (const v of violations) {
    const entry = helpEntry(v.ruleId);
    if (entry) {
      measures.push({ entry, severity: v.severity, blockerKind: 'rule', elementId: v.elementId, message: v.message });
    }
  }

  // Creation-not-done blockers — a creation in a gate's creationArtifacts whose
  // blocking message is present (CR-GC-221). Deduped across gates.
  const seen = new Set<string>();
  for (const g of [...readiness.phaseGates, ...readiness.implGates]) {
    for (const c of g.creationArtifacts) {
      if (seen.has(c)) continue;
      const msg = creationBlockingMsg(c, g.id);
      if (g.blocking.includes(msg)) {
        seen.add(c);
        const entry = helpEntry(c);
        if (entry) measures.push({ entry, severity: 'error', blockerKind: 'creation', gateId: g.id, message: msg });
      }
    }
  }

  return measures.sort((a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3));
}
