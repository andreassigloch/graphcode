/**
 * HookSystem — pre-commit / post-apply hook runner + CR-GC-102 enrichments.
 *
 * CR-GC-100 scope: Apply-Gate hook runner (FCHAIN-apply-gate steps 1 & 5).
 * CR-GC-102 adds: trajectory/event emission via post-apply hooks, version-keyed
 * response cache with dirty-flag (REQ-versioned-cache), and the
 * `registerEmitters` helper that wires those two built-in post-apply hooks.
 *
 * Public method signatures are STABLE — CR-102 enriches only impl + new exports.
 *
 * @author andreas@siglochconsulting
 */
import type { MutateCommand, MutateResult } from '@sigloch/contracts/harness';
import type { GraphDelta } from '@sigloch/graph-api-core';

/** Hook lifecycle phases. `post-reset` = the whole graph was replaced beside the gate (CR-GC-885). */
export type HookType = 'pre-commit' | 'post-apply' | 'post-reset' | 'nightly';

/** A pre-commit hook may veto the mutation by returning `{ block: true }`. */
export interface HookResult {
  hookId: string;
  /** true → abort the apply (pre-commit only). */
  block?: boolean;
  /** Human-readable reason, surfaced on block. */
  message?: string;
}

/** What an applied batch did to the store (CR-GC-809). Absent where the batch never reached it. */
export interface AppliedDelta {
  delta: GraphDelta;
  /** Node types of the state BEFORE the batch — a deleted node has none afterwards. */
  typeOf: (uid: string) => string | undefined;
}

/**
 * Pre-commit hooks see the proposed commands; post-apply hooks see the result. `version` is the graph
 * version this result leads to: the counter moves in `recordAudit`, after these hooks, and writes are
 * serialized, so the value is known here (CR-GC-809). Unset for a harness without a tool layer.
 */
export type HookData =
  | { phase: 'pre-commit'; commands: MutateCommand[] }
  | { phase: 'post-apply'; result: MutateResult; applied?: AppliedDelta; version?: number }
  | { phase: 'post-reset'; version?: number };

export type HookHandler = (data: HookData) => HookResult | void | Promise<HookResult | void>;

export interface HookOptions {
  /** Stable id; defaults to `${type}-${index}`. */
  id?: string;
}

interface RegisteredHook {
  id: string;
  handler: HookHandler;
}

export interface HookSystemConfig {
  /** Max wall-clock per pre-commit hook before it is treated as a block. */
  preCommitTimeout: number;
}

/** Run a handler with a timeout; a timeout is treated as a block. */
async function withTimeout(
  id: string,
  handler: HookHandler,
  data: HookData,
  timeoutMs: number,
): Promise<HookResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<HookResult>((resolve) => {
    timer = setTimeout(
      () => resolve({ hookId: id, block: true, message: `hook ${id} timed out after ${timeoutMs}ms` }),
      timeoutMs,
    );
  });
  try {
    const run = Promise.resolve(handler(data)).then(
      (r): HookResult => r ?? { hookId: id },
    );
    return await Promise.race([run, timeout]);
  } catch (err) {
    // A throwing pre-commit hook is treated as a block (fail-closed, no silent swallow).
    return { hookId: id, block: true, message: err instanceof Error ? err.message : String(err) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class HookSystem {
  private readonly hooks = new Map<HookType, RegisteredHook[]>();
  private readonly preCommitTimeout: number;
  private versionSource?: () => number;

  constructor(config: HookSystemConfig) {
    this.preCommitTimeout = config.preCommitTimeout;
  }

  /** Register a handler for a phase. Hooks run in registration order. */
  registerHook(type: HookType, handler: HookHandler, opts: HookOptions = {}): string {
    const list = this.hooks.get(type) ?? [];
    const id = opts.id ?? `${type}-${list.length}`;
    list.push({ id, handler });
    this.hooks.set(type, list);
    return id;
  }

  /**
   * Step 1 of FCHAIN-apply-gate. Runs pre-commit hooks in registration order.
   * Returns one HookResult per hook (empty when none registered → no-op).
   * The caller blocks the apply iff any result has `block: true`.
   */
  async runPreCommitHooks(commands: MutateCommand[]): Promise<HookResult[]> {
    const list = this.hooks.get('pre-commit') ?? [];
    const data: HookData = { phase: 'pre-commit', commands };
    const results: HookResult[] = [];
    for (const { id, handler } of list) {
      results.push(await withTimeout(id, handler, data, this.preCommitTimeout));
    }
    return results;
  }

  /**
   * Step 5 of FCHAIN-apply-gate. Runs post-apply hooks in registration order.
   * Fire-and-collect: results are returned but never block. (CR-102 adds
   * trajectory/event emission behind this same call site.)
   */
  async runPostApplyHooks(result: MutateResult, applied?: AppliedDelta): Promise<HookResult[]> {
    const bumps = result.success && result.mutations > 0 ? 1 : 0;
    const current = this.versionSource?.();
    return this.runFireAndCollect('post-apply', {
      phase: 'post-apply', result,
      ...(applied ? { applied } : {}),
      ...(current !== undefined ? { version: current + bumps } : {}),
    });
  }

  /** After a reseed: the graph was replaced beside the gate, and the live view must hear of it (CR-GC-885). */
  async runPostResetHooks(): Promise<HookResult[]> {
    const version = this.versionSource?.();
    return this.runFireAndCollect('post-reset', { phase: 'post-reset', ...(version !== undefined ? { version } : {}) });
  }

  /** The tool layer owns the version counter; it tells the hooks where it stands (CR-GC-809). */
  setVersionSource(source: () => number): void {
    this.versionSource = source;
  }

  currentVersion(): number {
    return this.versionSource?.() ?? 0;
  }

  private async runFireAndCollect(type: HookType, data: HookData): Promise<HookResult[]> {
    const out: HookResult[] = [];
    for (const { id, handler } of this.hooks.get(type) ?? []) {
      try {
        const r = await Promise.resolve(handler(data));
        out.push(r ?? { hookId: id });
      } catch (err) {
        // Post-apply never blocks; record the failure, keep going.
        out.push({ hookId: id, message: err instanceof Error ? err.message : String(err) });
      }
    }
    return out;
  }

  /**
   * Minimal typed entry point for the nightly batch (CR-102 fills in the
   * scheduling/learning logic). Runs registered nightly hooks once, now.
   */
  async scheduleNightlyBatch(): Promise<HookResult[]> {
    const list = this.hooks.get('nightly') ?? [];
    const out: HookResult[] = [];
    for (const { id, handler } of list) {
      const r = await Promise.resolve(
        handler({ phase: 'post-apply', result: {
          success: true, appliedCommands: 0, mutations: 0, violations: [],
        } }),
      );
      out.push(r ?? { hookId: id });
    }
    return out;
  }
}
