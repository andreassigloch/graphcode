/**
 * tool-context.ts — the ONE carrier of tool-layer shared state (MOD-mcp-tools, CR-GC-256).
 *
 * WHY a factory and not module-level state: `_graphVersion` and `toolWriteChain` carry
 * invariants that only hold with EXACTLY ONE instance per bound registry —
 *   - `_graphVersion` is monotone and resumed from the durable log (CR-GC-232/233); a
 *     second copy would hand two writers different OCC baselines.
 *   - `toolWriteChain` serializes check+gate+record as one unit; a second chain would
 *     let two tool writes interleave between the OCC check and the gate apply.
 * Splitting the registry into per-group modules that each built their own factory would
 * silently create those copies. So the state lives here, behind `createToolContext()`,
 * reachable only as `graphVersion()` (read) and `recordAudit()` (the single writer) —
 * structurally enforced instead of commented.
 *
 * @author andreas@siglochconsulting
 */

import { join } from 'node:path';
import type { GraphCodeHarness } from './harness.js';
import type { AuditLog, AuditEntry, OperationsLog } from '@sigloch/graph-api-core';
import { FormatECodec, SE_DESCRIPTOR, FileOperationsLog } from '@sigloch/graph-api-core';
// CR-GC-314 REQ-A02: the rule-set version comes from the LOADED package, never from
// config — otherwise the trail records a claim instead of a fact.
import { RULES_VERSION } from '@sigloch/contracts/se';
import type { MutateCommand, MutateResult, StaleDelta, StaleDeltaEntry } from '@sigloch/contracts/harness';
import { GraphCodeCodec } from './codec.js';
import { materializeTrajectory } from './emit.js';

/** Everything a tool group needs; the state behind it exists once per bound registry. */
export interface ToolContext {
  readonly harness: GraphCodeHarness;
  readonly auditLog: AuditLog;
  /** Format-E serializer for the slice tools. */
  readonly codec: FormatECodec;
  /** Format-E v2 wrapper for the opt-in read-tool slices (CR-GC-210, CR-GC-269). */
  readonly gcCodec: GraphCodeCodec;
  /** Read accessor for the applied-batch counter (never a settable field). */
  graphVersion(): number;
  /** The ONLY writer of the version + the audit log (no audit bypass, CR-GC-232). */
  recordAudit(consumerId: string, result: MutateResult, commands?: MutateCommand[]): Promise<void>;
  /**
   * Audit a dryRun preview as `operation:'validate'` (CR-GC-276, F2-Evidenz):
   * Vorschlag + Verdict landen im Log, die Version bewegt sich NICHT (nichts
   * wurde angewendet) und der Merge-Replay überspringt validate-Einträge.
   */
  recordPreview(consumerId: string, result: MutateResult, commands: MutateCommand[]): Promise<void>;
  /** Run a write body on the single tool-write chain (check+gate+record atomic). */
  serializeToolWrite<T>(body: () => Promise<T>): Promise<T>;
  /** Stale-base rejection with staleDelta, or null when the base is fresh (CR-GC-233). */
  occReject(
    consumerId: string,
    baseVersion: number | undefined,
    commands: MutateCommand[] | undefined,
  ): Promise<(MutateResult & { graphVersion: number }) | null>;
}

/**
 * Create the single tool-layer context for one harness.
 *
 * Durable by default (CR-GC-232): the command log survives the process, anchored
 * BESIDE the store it describes (per store, never per repo — same rule as the O2
 * lock). Tests may inject an InMemoryAuditLog (dependency injection, no parallel path).
 */
export function createToolContext(
  harness: GraphCodeHarness,
  auditLog: AuditLog = new FileOperationsLog(harness.getStoreDir()),
): ToolContext {
  const codec = new FormatECodec(SE_DESCRIPTOR);
  // Round-trip-stable Format-E for the opt-in read-tool slices (CR-GC-210): the wrapper
  // adds/strips the .TYPE uid suffix so the slice re-imports via the same codec.
  const gcCodec = new GraphCodeCodec();
  // Version continuity (CR-GC-232): resume from the durable log's highest version —
  // never reset to 0 per session (CR-233 builds its OCC on this monotonicity).
  const versioned = auditLog as Partial<Pick<OperationsLog, 'latestVersion'>>;
  let _graphVersion = versioned.latestVersion?.() ?? 0;

  // Record a gated write in the audit log — WITH its command batch, so the log is
  // replayable (CR-GC-234). Every write tool must call this (no audit bypass).
  // OCC invariant (CR-GC-233): graphVersion counts APPLIED batches only — a rejected
  // write changes no state, so it must not move the version (or a bystander's
  // rejected attempt would spuriously stale every other writer's baseVersion).
  /**
   * The positive half of the finding (CR-GC-314): which rules ran on this mutation and
   * returned nothing, plus the rule-set version they came from.
   *
   * `violations` is the negative half and has always been recorded. The positive half
   * was not, so an accepted mutation left an empty field — and "R-18 checked this edit
   * and passed it" cannot be recovered from "no violation". A later learning mechanism
   * can use the first statement and nothing at all from the second.
   *
   * REQ-A03 — no second rule run and no new engine API: this is set arithmetic over the
   * registered catalog and the violations the result already carries. The two halves are
   * therefore exactly complementary WITHIN one record, which is what makes the pair
   * readable at all.
   *
   * Rule IDs only, never rule text (REQ-A04).
   */
  function positiveHalf(result: MutateResult): { rulesPassed: string[]; rulesetVersion: string } {
    const fired = new Set(result.violations.map((v) => v.ruleId));
    return {
      rulesPassed: (SE_DESCRIPTOR.rules ?? []).map((r) => r.id).filter((id) => !fired.has(id)),
      rulesetVersion: RULES_VERSION,
    };
  }

  async function recordAudit(
    consumerId: string,
    result: MutateResult,
    commands?: MutateCommand[],
  ): Promise<void> {
    if (result.success) _graphVersion += 1;
    const entry: AuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      consumerId,
      consumerType: 'agent',
      operation: 'mutate',
      result: result.success ? 'applied' : 'rejected',
      violations: result.violations as import('@sigloch/graph-api-core').RuleViolation[],
      graphVersion: _graphVersion,
      commands,
      ...positiveHalf(result),
    };
    await auditLog.record(entry);
    // Re-project the feed from the log as the single source (CR-252). The write
    // above is the one truth; the feed is derived, so this can never diverge. The
    // repoRoot is read HERE (on a real write), never at bind time — the tool
    // template must stay unbound (host-shim proxy invariant, CR-GC-235).
    await materializeTrajectory(auditLog, join(harness.getRepoRoot(), '.aimprove'));
  }

  // Preview-Audit (CR-GC-276): dryRun-Verdicts sind die halbe F2-Evidenz — auch
  // VERWORFENE Kandidaten (Vorschlag → Ablehnung) müssen im Log stehen. Als
  // `operation:'validate'` von echten Writes unterscheidbar; die Version bewegt
  // sich nicht (nichts angewendet ⇒ kein OCC-Stale für andere Writer), der
  // Merge-Replay filtert auf operation:'mutate'.
  async function recordPreview(
    consumerId: string,
    result: MutateResult,
    commands: MutateCommand[],
  ): Promise<void> {
    const entry: AuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      consumerId,
      consumerType: 'agent',
      operation: 'validate',
      result: result.success ? 'applied' : 'rejected',
      violations: result.violations as import('@sigloch/graph-api-core').RuleViolation[],
      graphVersion: _graphVersion,
      commands,
      ...positiveHalf(result),
    };
    await auditLog.record(entry);
    await materializeTrajectory(auditLog, join(harness.getRepoRoot(), '.aimprove'));
  }

  // OCC (CR-GC-233): stale-write rejection at the tool layer. The check and the
  // gate apply must be ATOMIC relative to other tool-layer writes, so write tools
  // run on one promise chain (same pattern as the harness O3 mutex — the harness
  // serializes gate bodies; this serializes check+gate+record as one unit).
  // ---------------------------------------------------------------------------

  let toolWriteChain: Promise<unknown> = Promise.resolve();
  function serializeToolWrite<T>(body: () => Promise<T>): Promise<T> {
    const result = toolWriteChain.then(body, body);
    toolWriteChain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /** Elements a command batch touched — the boundary projection into StaleDeltaEntry.changedUids. */
  function batchUids(commands: MutateCommand[] | undefined): string[] {
    const uids = new Set<string>();
    for (const cmd of commands ?? []) {
      switch (cmd.op) {
        case 'add-node':
        case 'update-node':
          uids.add(cmd.node.uid);
          break;
        case 'delete-node':
          uids.add(cmd.uid);
          break;
        case 'add-edge':
        case 'delete-edge':
        case 'update-edge':
          uids.add(cmd.edge.sourceId);
          uids.add(cmd.edge.targetId);
          break;
        case 'merge-nodes':
          uids.add(cmd.sourceUid);
          uids.add(cmd.targetUid);
          break;
      }
    }
    return [...uids];
  }

  /**
   * Reject a write whose base is older than the current graph — with the staleDelta
   * (CR-GC-243, contracts `StaleDeltaSchema`): the applied batches since baseVersion,
   * so the writer sees WHAT changed, re-reads, retries. Returns null when fresh.
   * audit-file stays internal; this is the boundary that maps its entries into the
   * contracts `StaleDeltaEntry` shape (`{ graphVersion, ts, changedUids }`).
   */
  async function occReject(
    consumerId: string,
    baseVersion: number | undefined,
    commands: MutateCommand[] | undefined,
  ): Promise<(MutateResult & { graphVersion: number }) | null> {
    if (baseVersion === undefined || baseVersion >= _graphVersion) return null;
    const all = (await auditLog.query({})) as AuditEntry[];
    const applied = all.filter((e) => e.result === 'applied' && (e.graphVersion ?? 0) > baseVersion);
    const entries: StaleDeltaEntry[] = applied.map((e) => ({
      graphVersion: e.graphVersion ?? 0,
      ts: e.timestamp,
      changedUids: batchUids(e.commands),
    }));
    const changedUids = [...new Set(entries.flatMap((e) => e.changedUids))];
    const staleDelta: StaleDelta = {
      sinceVersion: baseVersion,
      currentVersion: _graphVersion,
      entries,
      changedUids,
    };
    const result: MutateResult = {
      success: false,
      appliedCommands: 0,
      mutations: 0,
      violations: [
        {
          ruleId: 'OCC',
          severity: 'error',
          message:
            `stale baseVersion ${baseVersion}: the graph is at version ${_graphVersion} — ` +
            `${entries.length} applied batch(es) landed since your read. Re-read (any read tool ` +
            `returns the current graphVersion), reconcile with the staleDelta, retry.`,
        },
      ],
      confidence: 0,
      tier: 'block',
      stale: true,
      staleDelta,
    };
    await recordAudit(consumerId, result, commands);
    return { ...result, graphVersion: _graphVersion };
  }

  return {
    harness,
    auditLog,
    codec,
    gcCodec,
    graphVersion: () => _graphVersion,
    recordAudit,
    recordPreview,
    serializeToolWrite,
    occReject,
  };
}
