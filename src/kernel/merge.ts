/**
 * merge.ts — replay-based branch reintegration (CR-GC-234, "semantic rebase").
 *
 * Ends the manual merge: instead of git-TEXT-merging two graph.json states, the
 * BRANCH's command log (the durable audit log of its worktree store, CR-GC-232)
 * is replayed AFTER the fork point (`sinceVersion`, CR-GC-233) through the
 * EXISTING Apply-Gate onto the current base — event-sourcing's "replay operations,
 * don't diff states". CRDT was rejected: our ops do not commute (delete-node vs
 * update-node) and V3_RULES are global invariants (governance, not convergence).
 *
 * Conflicts speak GATE language, never text-diff language:
 *   - a replayed batch that introduces an error-violation on the new base
 *     (R-08 dangling after a foreign delete, R-18 illegal pair, delta errors)
 *     → skipped + reported under `conflicted[]` with violations + fixHint;
 *   - `update-node` on a node the base DELETED → conflicted (replay precondition:
 *     the gate's update-as-upsert would silently RESURRECT the node — the classic
 *     lost-delete anomaly — so the merge surfaces it instead of applying it);
 *   - a batch whose effect the base already contains → `skipped` (idempotent,
 *     e.g. shared pre-fork history or the same fix landed on both sides).
 *
 * `dryRun` previews the verdict CUMULATIVELY (batch N+1 judged on top of batch N,
 * via the gate's own dryRun mode) and leaves graph + log byte-identical — the
 * caller (graph_merge tool) restores the in-memory working copy via loadGraph().
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync } from 'node:fs';
import type { Graph } from '@sigloch/graph-api-core';
import type { MutateCommand, MutateResult, RuleViolation } from '@sigloch/contracts/harness';
import type { GraphCodeHarness } from './harness.js';
import type { AuditEntry } from '@sigloch/graph-api-core';

/** One replayed batch in the report — enough context to resolve it machine-side. */
export interface MergeBatch {
  /** Audit entry id in the branch log. */
  id: string;
  /** The graphVersion the batch had ON THE BRANCH (its log position, not the target's). */
  branchVersion: number;
  consumerId: string;
  commands: MutateCommand[];
}

export interface MergeConflict extends MergeBatch {
  /** Gate violations (incl. fixHint/context) — the machine-resolvable conflict report. */
  violations: RuleViolation[];
}

export interface MergeReport {
  sinceVersion: number;
  dryRun: boolean;
  /** Batches found in the branch log after the fork point. */
  replayed: number;
  applied: MergeBatch[];
  conflicted: MergeConflict[];
  /** Idempotent batches — their effect is already contained in the base. */
  skipped: Array<MergeBatch & { reason: string }>;
}

/**
 * Read the replayable batches of a branch command log: applied entries with a
 * command batch, in log order, strictly AFTER the fork point. Checkpoint lines
 * and a torn tail are skipped (same torn-tail tolerance as the store log) — but the file is
 * never touched (a foreign worktree's log is read-only to the merge).
 */
export function readBranchLog(logPath: string, sinceVersion: number): AuditEntry[] {
  const raw = readFileSync(logPath, 'utf8');
  const entries: AuditEntry[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let parsed: AuditEntry & { checkpoint?: boolean };
    try {
      parsed = JSON.parse(line) as AuditEntry & { checkpoint?: boolean };
    } catch {
      continue; // torn tail — tolerated, never fatal
    }
    if (parsed.checkpoint === true) continue;
    if (parsed.operation !== 'mutate') continue; // validate = dryRun-Preview (CR-GC-276), nie replayen
    if (parsed.result !== 'applied') continue; // rejected batches never happened
    if (!parsed.commands || parsed.commands.length === 0) continue;
    if ((parsed.graphVersion ?? 0) <= sinceVersion) continue; // pre-fork = shared history
    entries.push(parsed);
  }
  return entries;
}

/** Deterministic deep-equality for attribute bags (plain JSON by construction). */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Would this command change the graph at all? (add/update = same merged node; deletes = already gone.) */
function commandIsNoOp(graph: Graph, cmd: MutateCommand): boolean {
  switch (cmd.op) {
    case 'add-node':
    case 'update-node': {
      const base = graph.nodes.find((n) => n.uid === cmd.node.uid);
      if (!base) return false;
      const merged = {
        type: cmd.node.type ?? base.type,
        name: cmd.node.name ?? base.name,
        description: cmd.node.description ?? base.description ?? '',
        attributes: { ...base.attributes, ...(cmd.node.attributes ?? {}) },
      };
      return (
        base.type === merged.type &&
        base.name === merged.name &&
        (base.description ?? '') === merged.description &&
        stableStringify(base.attributes) === stableStringify(merged.attributes)
      );
    }
    case 'delete-node':
      return !graph.nodes.some((n) => n.uid === cmd.uid);
    case 'add-edge':
      return graph.edges.some(
        (e) => e.sourceId === cmd.edge.sourceId && e.targetId === cmd.edge.targetId && e.edgeType === cmd.edge.edgeType,
      );
    case 'delete-edge':
      return !graph.edges.some(
        (e) => e.sourceId === cmd.edge.sourceId && e.targetId === cmd.edge.targetId && e.edgeType === cmd.edge.edgeType,
      );
    // CR-GC-238: mirrors applyCommands — a missing edge/source is a no-op there.
    case 'update-edge': {
      const prev = graph.edges.find(
        (e) => e.sourceId === cmd.edge.sourceId && e.targetId === cmd.edge.targetId && e.edgeType === cmd.edge.edgeType,
      );
      if (!prev) return true;
      const flip = cmd.set.flip === true;
      const mergedAttrs = { ...prev.attributes, ...(cmd.set.attributes ?? {}) };
      return (
        !flip &&
        (cmd.set.edgeType ?? prev.edgeType) === prev.edgeType &&
        stableStringify(prev.attributes) === stableStringify(mergedAttrs)
      );
    }
    case 'merge-nodes':
      return cmd.sourceUid === cmd.targetUid || !graph.nodes.some((n) => n.uid === cmd.sourceUid);
  }
}

/**
 * Replay precondition beyond the rule base: `update-node` on a uid the base does
 * not have. In an AUTHORING context the gate's update-as-upsert is a feature; in
 * a MERGE context it silently resurrects a node the base deleted (the delete-vs-
 * update conflict, CR-GC-234 acceptance) — so it must surface, never auto-apply.
 */
function resurrectionConflicts(graph: Graph, commands: MutateCommand[]): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const uids = new Set(graph.nodes.map((n) => n.uid));
  // Track uids the batch itself introduces — updating a node the SAME batch adds is legal.
  for (const cmd of commands) {
    if (cmd.op === 'add-node') uids.add(cmd.node.uid);
    else if (cmd.op === 'update-node' && !uids.has(cmd.node.uid)) {
      violations.push({
        ruleId: 'MERGE',
        severity: 'error',
        message: `update-node on '${cmd.node.uid}': the node does not exist on the target base (deleted or never created) — applying would resurrect it.`,
        elementId: cmd.node.uid,
        fixHint:
          'Decide the semantic conflict: re-create the node intentionally (add-node with the full payload) or drop the branch change.',
      });
    } else if (cmd.op === 'update-node') {
      uids.add(cmd.node.uid);
    }
  }
  return violations;
}

/**
 * Replay `entries` (a branch command log after the fork point) through the gate
 * onto the current base. Every batch is gate-validated (O3-serialized inside
 * harness.mutate — no parallel write path). `onBatchResult` lets the caller
 * audit-log applied/conflicted batches (the MCP tool records them; a dry run
 * records nothing).
 */
export async function replayBranchLog(
  harness: GraphCodeHarness,
  entries: AuditEntry[],
  opts: {
    dryRun: boolean;
    onBatchResult?: (result: MutateResult, commands: MutateCommand[]) => Promise<void>;
  },
): Promise<MergeReport> {
  const report: MergeReport = {
    sinceVersion: -1, // caller fills in
    dryRun: opts.dryRun,
    replayed: entries.length,
    applied: [],
    conflicted: [],
    skipped: [],
  };

  for (const entry of entries) {
    const batch: MergeBatch = {
      id: entry.id,
      branchVersion: entry.graphVersion ?? 0,
      consumerId: entry.consumerId,
      commands: entry.commands ?? [],
    };

    // Idempotent: the base already contains the batch's full effect.
    if (batch.commands.every((cmd) => commandIsNoOp(harness.getGraph(), cmd))) {
      report.skipped.push({ ...batch, reason: 'already-contained' });
      continue;
    }

    // Delete-vs-update: surfaced as a conflict, never silently resurrected.
    const resurrections = resurrectionConflicts(harness.getGraph(), batch.commands);
    if (resurrections.length > 0) {
      report.conflicted.push({ ...batch, violations: resurrections });
      continue;
    }

    // The gate IS the conflict detector: a batch that is illegal on the new base
    // (R-08 dangling, R-18 illegal pair, delta errors) blocks and rolls back.
    const result = await harness.mutate(batch.commands, { dryRun: opts.dryRun });
    if (result.success) {
      report.applied.push(batch);
      await opts.onBatchResult?.(result, batch.commands);
    } else {
      report.conflicted.push({ ...batch, violations: result.violations });
      await opts.onBatchResult?.(result, batch.commands);
    }
  }

  return report;
}
