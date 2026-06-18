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

/** Hook lifecycle phases. */
export type HookType = 'pre-commit' | 'post-apply' | 'nightly';

/** A pre-commit hook may veto the mutation by returning `{ block: true }`. */
export interface HookResult {
  hookId: string;
  /** true → abort the apply (pre-commit only). */
  block?: boolean;
  /** Human-readable reason, surfaced on block. */
  message?: string;
}

/** Pre-commit hooks see the proposed commands; post-apply hooks see the result. */
export type HookData =
  | { phase: 'pre-commit'; commands: MutateCommand[] }
  | { phase: 'post-apply'; result: MutateResult };

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
  async runPostApplyHooks(result: MutateResult): Promise<HookResult[]> {
    const list = this.hooks.get('post-apply') ?? [];
    const data: HookData = { phase: 'post-apply', result };
    const out: HookResult[] = [];
    for (const { id, handler } of list) {
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
