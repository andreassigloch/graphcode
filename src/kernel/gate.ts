/**
 * gate.ts — der Apply-Gate-Ablauf (FCHAIN-apply-gate, CR-GC-504).
 *
 * Schema-Pruefung, Pre-Commit-Hooks, Batch auf einem Kandidaten, Delta-Regeln (nur neue
 * error-Befunde blocken), Typ-Guard vor dem Persistieren, Advisories, Uebergabe an den
 * GraphStore, Post-Apply-Hooks. Aus harness.ts herausgeloest, damit die Fassade
 * (Konfiguration, Lese-Abfragen, Schreib-Serialisierung O3) und das Urteil getrennt lesbar
 * sind; harness.ts lag nach CR-GC-503 noch bei 607 Zeilen.
 *
 * Das Gate haelt keinen Zustand: es liest die Arbeitskopie beim GraphStore und uebergibt ihm
 * einen angenommenen Kandidaten. Serialisiert wird es vom Aufrufer (GraphCodeHarness.mutate).
 *
 * @author andreas@siglochconsulting
 */
import type { Graph, OntologyDescriptor, RuleViolation as CoreRuleViolation, DefaultRuleEngine } from '@sigloch/graph-api-core';
import type { MetricPolicy } from '@sigloch/contracts/se';
import { MutateCommandSchema, type MutateCommand, type MutateResult, type RuleViolation } from '@sigloch/contracts/harness';
import type { HookSystem } from './hooks.js';
import type { GraphStore } from './graph-store.js';
import { applyCommands, cloneGraph } from './apply-commands.js';
import { setExportPending } from './export-marker.js';
import { computeFitAdvisory, computeSteerAdvisory, type FitAdvisory, type SteerAdvisory } from './measure/fit-advisory.js';
import { congruenceWorkOrder, type WorkOrder } from './measure/work-order.js';

export interface GateDeps {
  readonly store: GraphStore;
  readonly engine: DefaultRuleEngine;
  /** The SE descriptor the engine was built from — its node/edge types feed the pre-persist guard. */
  readonly descriptor: OntologyDescriptor;
  readonly hooks: HookSystem;
  /** The judging thresholds (CR-GC-329) — same object graph_metrics reports. */
  readonly metricPolicy: MetricPolicy;
  /** Repo root for the export-pending drift marker (CR-GC-217). */
  readonly repoRoot: string;
}

export class Gate {
  constructor(private readonly deps: GateDeps) {}

  async apply(
    commands: MutateCommand[],
    dryRun = false,
  ): Promise<MutateResult & { fitAdvisory?: FitAdvisory }> {
    // Step 0 — shape validation (CR-GC-239). MCP transports hand commands over as
    // plain JSON; a shape typo (`op:"add_node"`, flat fields) must never pass the
    // gate as a silent no-op with success:true. Parse EVERY command against the
    // contracts schema; any failure blocks the whole batch (no graphVersion bump,
    // audit records result:"rejected" — both derive from success:false).
    const schemaViolations: RuleViolation[] = [];
    const parsedCommands: MutateCommand[] = [];
    commands.forEach((cmd, i) => {
      const parsed = MutateCommandSchema.safeParse(cmd);
      if (parsed.success) {
        parsedCommands.push(parsed.data);
        return;
      }
      const detail = parsed.error.issues.map((iss) => `${iss.path.join('.') || '(root)'}: ${iss.message}`).join('; ');
      schemaViolations.push({
        ruleId: 'SCHEMA-01',
        severity: 'error',
        message: `command[${i}] does not match MutateCommandSchema — ${detail}`,
        fixHint:
          "Canonical shapes: {op:'add-node'|'update-node', node:{uid,type,name,description?,attributes?}} · " +
          "{op:'delete-node', uid} · {op:'add-edge', edge:{sourceId,targetId,edgeType,attributes?}} · " +
          "{op:'delete-edge', edge:{sourceId,targetId,edgeType}} · " +
          "{op:'update-edge', edge:{sourceId,targetId,edgeType}, set:{edgeType?|flip?|attributes?}} · " +
          "{op:'merge-nodes', sourceUid, targetUid}",
      });
    });
    if (schemaViolations.length > 0) {
      const result: MutateResult = {
        success: false,
        appliedCommands: 0,
        mutations: 0,
        violations: schemaViolations,
        confidence: 0,
        tier: 'block',
      };
      if (!dryRun) await this.deps.hooks.runPostApplyHooks(result);
      return result;
    }
    commands = parsedCommands; // normalized: schema defaults (attributes: {}) applied

    // Step 1 — pre-commit.
    const preResults = await this.deps.hooks.runPreCommitHooks(commands);
    const blockedBy = preResults.find((r) => r.block);
    if (blockedBy) {
      const result: MutateResult = {
        success: false,
        appliedCommands: 0,
        mutations: 0,
        violations: [
          { ruleId: 'pre-commit', severity: 'error', message: blockedBy.message ?? 'blocked by pre-commit hook' },
        ],
        confidence: 0,
        tier: 'block',
      };
      if (!dryRun) await this.deps.hooks.runPostApplyHooks(result);
      return result;
    }

    // Step 2 — apply to a CANDIDATE copy (CR-GC-503) + a pre-mutation rule
    // baseline so the gate blocks only on violations THIS mutation introduces.
    // Pre-existing debt (e.g. 61 REQs still awaiting verification, R-01 error)
    // must not freeze the SSOT graph — otherwise no edit could ever land and
    // REQ-graph-is-ssot ("model changes via mutate") is impossible. Pre-existing
    // violations stay visible via evaluateRules()/readiness; they just don't gate.
    // The store's working copy stays untouched until the gate accepts — a block has
    // nothing to roll back.
    const snapshot = this.deps.store.current();
    const baselineKeys = new Set(this.evaluate(snapshot).map(violationKey));
    const { graph: candidate, delta } = applyCommands(cloneGraph(snapshot), commands);

    // Step 3 — evaluate, then keep only the violations this mutation introduced.
    const newViolations = this.evaluate(candidate).filter((v) => !baselineKeys.has(violationKey(v)));
    // CR-GC-312: `gating: false` marks a rule as visible-but-not-gate-relevant. The
    // descriptor now carries all twelve contracts rule families instead of two; ten of
    // them were shipped and evaluated by nobody. Switching them on with gate power in
    // one step would block every write on pre-existing debt (114 errors in this repo's
    // own graph the day it landed) — debt the writer did not create, which is the same
    // reason the delta baseline above exists. The violations stay in the result and in
    // readiness at full severity; they just do not block until a family is promoted.
    const hasNewError = newViolations.some((v) => v.severity === 'error' && v.gating !== false);

    // Step 3b — pre-persist type guard (CR-GC-205 Item 1). Trace-pair legality is
    // now R-18 and referential integrity is R-08 — both arrive via runRules() above
    // (one rule base, one enforcement), so the gate NO LONGER calls codec.validate()
    // for structural validity (the CR-GC-200 duplication is retired; codec.validate
    // stays only as the encode/import backstop for duplicate uids, which cannot arise
    // here since applyCommands upserts by uid). The single structural class no rule
    // covers is an UNKNOWN node/edge type, which would abort the Kuzu DDL mid-persist
    // (partial persist, in-memory != store). Guard it here, delta-semantics, so an
    // unknown type is rejected ATOMICALLY before persist.
    const baselineTypeErrors = new Set(this.unknownTypeErrors(snapshot));
    const newTypeErrors = this.unknownTypeErrors(candidate).filter((e) => !baselineTypeErrors.has(e));

    if (hasNewError || newTypeErrors.length > 0) {
      // Step 4 (BLOCK) — the candidate is dropped; working copy and store never saw it.
      const violations: RuleViolation[] = [
        ...newViolations,
        ...newTypeErrors.map((message) => ({ ruleId: 'STRUCT', severity: 'error' as const, message })),
      ];
      const result: MutateResult = {
        success: false,
        appliedCommands: commands.length,
        mutations: 0,
        violations,
        confidence: 0,
        tier: 'block',
      };
      if (!dryRun) await this.deps.hooks.runPostApplyHooks(result);
      return result;
    }

    // Step 4 (APPLY) — persist the delta to disk Kuzu. A dry run (CR-GC-234)
    // stops at the verdict: no persist, no drift marker — but the in-memory
    // working copy KEEPS the applied state for cumulative replay preview
    // (the caller restores it via loadGraph()).
    await this.deps.store.commit(candidate, dryRun ? null : delta);
    if (!dryRun) {
      // CR-GC-217: the live model now leads the committed snapshot. Leave the
      // single-writer-safe drift marker so the pre-commit hook blocks a commit until
      // graph_export re-materializes docs/graph/*.graph.json (each commit a graph
      // state that fits the code — REQ-graph-snapshot-per-commit).
      setExportPending(this.deps.repoRoot);
    }

    const tier = newViolations.some((v) => v.severity === 'warning') ? 'suggest' : 'auto-apply';
    // Fit-Gate Härtegrad 1 (CR-GC-274): Δm-Advisory auf layer:'arch' pro
    // erfolgreicher Mutation — eine MESSUNG, kein Gate: tier/success bleiben
    // allein regelbestimmt ("Metrik rankt, Gate urteilt").
    const result: MutateResult & { fitAdvisory: FitAdvisory; steerAdvisory: SteerAdvisory; workOrder: WorkOrder } = {
      success: true,
      appliedCommands: commands.length,
      mutations: delta.upsertNodes.length + delta.deleteNodes.length + delta.upsertEdges.length + delta.deleteEdges.length,
      violations: newViolations,
      confidence: 1,
      tier,
      fitAdvisory: computeFitAdvisory(snapshot, candidate),
      // CR-GC-483: das Steuersignal. `fitAdvisory` bleibt daneben stehen und wird berichtet —
      // es rankt nur nichts mehr (CR-SM-292).
      steerAdvisory: computeSteerAdvisory(snapshot, candidate, this.deps.metricPolicy),
      // CR-GC-490: die vierte Kante Modell → Code. Wandert eine `allocate`-Kante, sagt das
      // Ergebnis jetzt, WELCHE Datei mitwandern muss — eine Liste, kein Refactoring, und wie
      // die beiden Advisories daneben ein Advisory: `tier` bleibt regelbestimmt.
      workOrder: congruenceWorkOrder(snapshot, candidate),
    };

    // CR-GC-239 invariant: an applied batch that changed NOTHING is suspicious.
    // Shape errors block above, so the remaining causes are legitimate no-ops
    // (idempotent delete-edge, update-edge/merge-nodes on a vanished element) —
    // surface them on stderr (stdout is the MCP transport), don't fail.
    if (commands.length > 0 && result.mutations === 0) {
      console.error(`[graphcode] mutate: ${commands.length} command(s) applied with 0 mutations — all no-ops.`);
    }

    // Step 5 — post-apply hooks (skipped on a dry run: no phantom events).
    if (!dryRun) await this.deps.hooks.runPostApplyHooks(result);

    // Step 6 — return.
    return result;
  }

  /**
   * Pre-persist Kuzu-DDL guard (CR-GC-205 Item 1): node/edge types that the SE
   * ontology does not know would abort the persist transaction mid-DDL. Pair-
   * legality (R-18) and referential integrity (R-08) are engine rules; this is the
   * one structural class no rule covers, so the gate checks it before persist.
   */
  private unknownTypeErrors(graph: Graph): string[] {
    const errors: string[] = [];
    const nodeTypes = new Set(Object.keys(this.deps.descriptor.nodeTypes));
    const edgeTypes = new Set(Object.keys(this.deps.descriptor.edgeTypes));
    for (const n of graph.nodes) {
      if (!nodeTypes.has(n.type)) errors.push(`Unknown node type "${n.type}" for node "${n.uid}"`);
    }
    for (const e of graph.edges) {
      if (!edgeTypes.has(e.edgeType)) {
        errors.push(`Unknown edge type "${e.edgeType}" for edge "${e.sourceId}" → "${e.targetId}"`);
      }
    }
    return errors;
  }

  /** Run the gate catalog against `graph`. Maps graph-api-core RuleViolation → contracts harness RuleViolation. */
  evaluate(graph: Graph): GatedViolation[] {
    return this.deps.engine.evaluate(graph).map((v: CoreRuleViolation) => ({
      ruleId: v.ruleId,
      severity: v.severity,
      message: v.message,
      elementId: v.elementId,
      // CR-GC-203 item 1: stop flattening — surface fix_hint + candidate_targets so
      // rules_get_violations / rules_evaluate hand the agent an actionable violation.
      fixHint: v.fixHint,
      context: v.context,
      // CR-GC-312: stamped by the engine from the rule. Only the GATE reads it; the
      // field stays out of the contracts harness type so no consumer has to care.
      gating: v.gating,
    }));
  }
}

/**
 * A violation plus the gate-relevance flag the engine stamps (CR-GC-312).
 *
 * Deliberately NOT in the contracts harness `RuleViolation`: only the gate reads it,
 * and widening a shared schema for one consumer's internal branch is how parallel
 * shapes start. Structurally assignable to `RuleViolation`, so everything downstream
 * is untouched.
 */
type GatedViolation = RuleViolation & { gating?: boolean };

/** Stable identity of a violation, for diffing pre/post-mutation rule results. */
function violationKey(v: RuleViolation): string {
  return `${v.ruleId}::${v.elementId ?? ''}::${v.message}`;
}
