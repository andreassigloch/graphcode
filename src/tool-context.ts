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
import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { GraphCodeHarness } from './harness.js';
import type { AuditLog, AuditEntry, OperationsLog } from '@sigloch/graph-api-core';
import { FormatECodec, SE_DESCRIPTOR, FileOperationsLog } from '@sigloch/graph-api-core';
// CR-GC-314 REQ-A02: the rule-set version comes from the LOADED package, never from
// config — otherwise the trail records a claim instead of a fact.
import { RULES_VERSION } from '@sigloch/contracts/se';
import type { MutateCommand, MutateResult, StaleDelta, StaleDeltaEntry } from '@sigloch/contracts/harness';
import { GraphCodeCodec } from './codec.js';
import { materializeTrajectory } from './emit.js';
// The per-repo workspace dir is named ONCE (scaffold-templates); the feed lands in
// graphcode's own workspace, not the predecessor's `.aimprove/` (CR-GC-330).
import { GRAPHCODE_DIR } from './scaffold-templates.js';

/**
 * Truncation policy for `AuditEntry.intent` (CR-GC-354). The CONTRACT says the prompt is
 * truncated; this says where. Measured against 379 real prompts from 51 sessions of this
 * repo: median 126 chars, 7 of 379 above this bound — the cap costs almost nothing and
 * bounds the one pathological case (a 616 KB paste) that would otherwise dominate the trail.
 */
export const INTENT_MAX_CHARS = 4000;

/**
 * Provenance the recording host knows about the CURRENT write (CR-GC-354).
 *
 * DERIVED, never self-declared: this is deliberately NOT part of any tool input schema.
 * `consumerId` is the counter-example — it is a caller-supplied field and 40% of the
 * records carry its anonymous default; and a prompt a model writes about its own prompt
 * is a paraphrase, which is worthless as provenance precisely because it already contains
 * the interpretation. So the host sets this out of band and the model cannot reach it.
 *
 * SINGLE-SESSION ASSUMPTION: one context serves one writing session. `graphcode run`
 * (CR-GC-355) satisfies this by construction — it owns its process. The MCP path does
 * NOT when the host-shim proxies several sessions onto one host (CR-GC-235), so the
 * hook path (CR-GC-356) must key the prompt by session before it may set `intent` here.
 * Until then only `model` and `sessionId` are populated, both of which are constant per
 * process and therefore unaffected.
 */
export interface AuditOrigin {
  /** The LLM that emitted the commands, e.g. the executor's configured model. */
  model?: string;
  /** The triggering prompt VERBATIM. Capped here, on the way into the record. */
  intent?: string;
}

/** Where `.claude/hooks/record-prompt.sh` relays the verbatim user prompt (CR-GC-356). */
export const PROMPT_RELAY_DIR = join(GRAPHCODE_DIR, 'prompts');

/**
 * The client process this graphcode process belongs to (CR-GC-357), or null.
 *
 * Walks the parent chain to the first ancestor whose executable is named `claude`. Measured
 * ancestry of a real server: `node …/graphcode mcp` → `npm exec @sigloch/graphcode` → `claude`.
 * The match is on the EXECUTABLE basename, not on the command line, because the hook's own
 * shell carries `.claude/hooks/record-prompt.sh` in its arguments and would otherwise match
 * itself.
 *
 * This is the exact join key the relay needed. Time-based disambiguation cannot work here and
 * that is measured, not assumed: this machine ran FIVE live client processes with four relay
 * files written inside 24 minutes — no window separates them, but the ancestry does.
 */
export function resolveOwnerPid(startPid: number = process.ppid): string | null {
  let pid = startPid;
  for (let hop = 0; hop < 8 && pid > 1; hop++) {
    let comm: string;
    let ppid: string;
    try {
      comm = execFileSync('ps', ['-o', 'comm=', '-p', String(pid)], { encoding: 'utf8' }).trim();
      ppid = execFileSync('ps', ['-o', 'ppid=', '-p', String(pid)], { encoding: 'utf8' }).trim();
    } catch {
      return null; // process gone mid-walk, or no `ps` — not recorded, never a guess
    }
    if (comm.split('/').pop() === 'claude') return String(pid);
    const next = Number(ppid);
    if (!Number.isFinite(next) || next === pid) return null;
    pid = next;
  }
  return null;
}

/**
 * Proxied-call depth (CR-GC-357). PROCESS-global on purpose, unlike everything else in this
 * file: it answers "is this process currently executing a call on someone else's behalf",
 * which is a property of the process, not of a bound registry.
 *
 * The elected host serves other sessions over the shim socket (CR-GC-235), and a proxied call
 * is indistinguishable from a local one at the handler. Its own relay would therefore be
 * stamped onto a foreign session's write — the exact wrong-pairing CR-GC-356 refuses to make.
 * While any proxied call is in flight NOBODY gets a prompt stamp: a concurrent local call
 * loses its stamp (a gap) rather than a proxied one gaining a false one (a defect).
 */
let _proxiedDepth = 0;
export function beginProxiedCall(): void {
  _proxiedDepth += 1;
}
export function endProxiedCall(): void {
  _proxiedDepth = Math.max(0, _proxiedDepth - 1);
}

/**
 * Read the prompt the client relayed for the CURRENT session (CR-GC-356), or null.
 *
 * AMBIGUITY IS RECORDED AS ABSENCE. One host process can serve several proxied sessions
 * (CR-GC-235) and the relay carries no marker tying a prompt to a specific tool call, so with
 * two live relays there is no way to tell whose prompt caused this write. Guessing — newest
 * wins, say — would stamp session B's prompt onto session A's record, and a wrong prompt→result
 * pairing is worse than a missing one: it poisons exactly the data this is collected for.
 * So: exactly one relay ⇒ use it, anything else ⇒ nothing. The hook prunes day-old files, which
 * is what keeps the ordinary one-session-per-repo case unambiguous.
 */
function readRelayedPrompt(
  repoRoot: string,
  ownerPid: string | null,
): { sessionId: string; prompt: string } | null {
  if (_proxiedDepth > 0) return null; // serving someone else — see beginProxiedCall
  if (!ownerPid) return null; // ancestry unknown ⇒ no exact match is possible ⇒ not recorded
  const dir = join(repoRoot, PROMPT_RELAY_DIR);
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return null; // no relay dir = no hook installed = not recorded
  }
  const mine: Array<{ sessionId: string; prompt: string }> = [];
  for (const f of files) {
    try {
      const raw = JSON.parse(readFileSync(join(dir, f), 'utf8')) as {
        sessionId?: unknown;
        prompt?: unknown;
        ownerPid?: unknown;
      };
      if (String(raw.ownerPid ?? '') !== ownerPid) continue;
      if (typeof raw.sessionId !== 'string' || typeof raw.prompt !== 'string' || !raw.prompt) continue;
      mine.push({ sessionId: raw.sessionId, prompt: raw.prompt });
    } catch {
      // torn or hand-mangled relay: skip the file, never throw on the write path
    }
  }
  // One client process, one relay. Two would mean the join key is not a key after all, and a
  // guess between them is exactly what this replaced.
  return mine.length === 1 ? mine[0] : null;
}

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
  /**
   * Set the provenance stamped onto every SUBSEQUENT record (CR-GC-354). Out-of-band on
   * purpose — see `AuditOrigin`. Replaces wholesale, so a caller that stops knowing the
   * prompt clears it by passing `{}` instead of leaving a stale one behind.
   */
  setOrigin(origin: AuditOrigin): void;
  /** The session id stamped on this context's records — one per host process. */
  sessionId(): string;
  /** The client process this one belongs to (CR-GC-357), or null when the ancestry is unknown. */
  ownerPid(): string | null;
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
  opts: { ownerPid?: string | null } = {},
): ToolContext {
  const codec = new FormatECodec(SE_DESCRIPTOR);
  // Round-trip-stable Format-E for the opt-in read-tool slices (CR-GC-210): the wrapper
  // adds/strips the .TYPE uid suffix so the slice re-imports via the same codec.
  const gcCodec = new GraphCodeCodec();
  // Version continuity (CR-GC-232): resume from the durable log's highest version —
  // never reset to 0 per session (CR-233 builds its OCC on this monotonicity).
  const versioned = auditLog as Partial<Pick<OperationsLog, 'latestVersion'>>;
  let _graphVersion = versioned.latestVersion?.() ?? 0;

  // Provenance (CR-GC-354). The session id is minted ONCE per context: it is the join key
  // that turns a flat record stream back into conversations, so it must be stable across
  // every record this process writes and distinct across processes.
  const _sessionId = `sess-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  // The client process that owns this one (CR-GC-357) — resolved ONCE at bind: the ancestry
  // cannot change for a live process, and re-walking it per write would spawn `ps` per mutation.
  const _ownerPid = opts.ownerPid !== undefined ? opts.ownerPid : resolveOwnerPid();
  let _origin: AuditOrigin = {};
  function setOrigin(origin: AuditOrigin): void {
    _origin = { ...origin };
  }

  /**
   * The provenance half of a record (CR-GC-354): who, and on which prompt.
   *
   * ABSENCE IS THE STATEMENT — the same asymmetry `rulesPassed` established (CR-GC-314
   * REQ-A05). A missing `intent` means NOT RECORDED, never "empty prompt", so an unset or
   * empty origin must leave the field OFF the record rather than write `''`. Likewise
   * `intentTruncated` appears only when a cut actually happened: emitting `false` on the
   * 372-of-379 records that fit would be noise claiming to be information.
   */
  function provenance(): Pick<AuditEntry, 'sessionId' | 'model' | 'intent' | 'intentTruncated'> {
    const relayed = _origin.intent ? null : readRelayedPrompt(harness.getRepoRoot(), _ownerPid);
    const out: Pick<AuditEntry, 'sessionId' | 'model' | 'intent' | 'intentTruncated'> = {
      // A relayed prompt brings the CLIENT's session id, which is strictly better provenance
      // than our minted one: it is the same id that names the transcript in ~/.claude/projects,
      // so a record stays joinable to its conversation for the ~30 days that one survives.
      sessionId: relayed?.sessionId ?? _sessionId,
    };
    if (_origin.model) out.model = _origin.model;
    const intent = _origin.intent ?? relayed?.prompt;
    if (intent) {
      if (intent.length > INTENT_MAX_CHARS) {
        out.intent = intent.slice(0, INTENT_MAX_CHARS);
        out.intentTruncated = true;
      } else {
        out.intent = intent;
      }
    }
    return out;
  }

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
      ...provenance(),
    };
    await auditLog.record(entry);
    // Re-project the feed from the log as the single source (CR-252). The write
    // above is the one truth; the feed is derived, so this can never diverge. The
    // repoRoot is read HERE (on a real write), never at bind time — the tool
    // template must stay unbound (host-shim proxy invariant, CR-GC-235).
    await materializeTrajectory(auditLog, join(harness.getRepoRoot(), GRAPHCODE_DIR));
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
      ...provenance(),
    };
    await auditLog.record(entry);
    await materializeTrajectory(auditLog, join(harness.getRepoRoot(), GRAPHCODE_DIR));
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
    setOrigin,
    sessionId: () => _sessionId,
    ownerPid: () => _ownerPid,
    serializeToolWrite,
    occReject,
  };
}
