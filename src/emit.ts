/**
 * CR-GC-102 / CR-GC-252 — Emission helpers: live-update event + learning feed.
 *
 * One post-apply hook factory + one projection materializer:
 *   - makeUpdateEventHook  → emits exactly ONE live-update event per mutation
 *     via an `onEvent` sink (no HTTP; caller owns the SSE transport).
 *   - materializeTrajectory → writes `<outDir>/trajectory.jsonl` as a PURE
 *     PROJECTION of the operations log (CR-252). The log (CR-207) is the one
 *     source of truth; the feed is derived, never a parallel write. The
 *     projection contract (`Trajectory`) is imported from `@sigloch/learning-core`,
 *     not hand-rolled here (no second schema).
 *
 * `makeUpdateEventHook` is wired via `registerEmitters(hooks, opts)`; the feed is
 * materialized in the tool layer next to the log write (mcp-tools `recordAudit`),
 * the one place the operations log is produced.
 *
 * Version-keyed response cache (REQ-versioned-cache):
 *   `ResponseCache` — a tiny in-module class keyed by a store version string.
 *   Mutations invalidate it via dirty-flag; callers read `get(version, key)`.
 *
 * @author andreas@siglochconsulting
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { MutateResult, UpdateDomain, LiveUpdateEvent } from '@sigloch/contracts/harness';
import type { AuditLog } from '@sigloch/graph-api-core';
import { projectTrajectory } from '@sigloch/learning-core';
import type { HookSystem } from './hooks.js';
import type { HookData, HookResult } from './hooks.js';

// ---------------------------------------------------------------------------
// LiveUpdateEvent — the SSE invalidation contract is defined ONCE in
// @sigloch/contracts/harness (CR-GC-109), so the dashboard/host-bridge import
// the same Zod schema this harness emits (no fork, analog D1). Re-exported for
// graphcode-local consumers; runtime validation lives in LiveUpdateEventSchema.
// ---------------------------------------------------------------------------

export type { UpdateDomain, LiveUpdateEvent };

// ---------------------------------------------------------------------------
// Domain computation
// ---------------------------------------------------------------------------

/**
 * Derive the affected domains from a MutateResult.
 * Always includes 'graph'. Adds 'rules' when violations are present,
 * 'readiness' always (a mutation changes the readiness picture),
 * 'suggestions' when the tier is 'suggest'.
 */
export function computeDomains(result: MutateResult): UpdateDomain[] {
  const domains: UpdateDomain[] = ['graph'];
  if (result.violations.length > 0) {
    domains.push('rules');
  }
  domains.push('readiness');
  if (result.tier === 'suggest') {
    domains.push('suggestions');
  }
  return domains;
}

// ---------------------------------------------------------------------------
// Hook factories
// ---------------------------------------------------------------------------

/**
 * Returns a post-apply HookHandler that emits exactly ONE LiveUpdateEvent per
 * mutation via `onEvent`. Does not block (post-apply fire-and-collect).
 */
export function makeUpdateEventHook(
  onEvent: (event: LiveUpdateEvent) => void,
): (data: HookData) => HookResult | void {
  return (data: HookData): HookResult | void => {
    if (data.phase !== 'post-apply') return;
    const result = data.result;
    const event: LiveUpdateEvent = {
      type: 'invalidate',
      domains: computeDomains(result),
      ts: new Date().toISOString(),
    };
    onEvent(event);
    // No return → HookResult is { hookId: <registered id> } via the runner default.
  };
}

/**
 * Materialize the learning feed `<outDir>/trajectory.jsonl` as a PURE PROJECTION
 * of the operations log (CR-252). Reads every log entry and projects each to a
 * `Trajectory` line via the `@sigloch/learning-core` contract, then rewrites the
 * feed file wholesale. Full rewrite (not append) is what makes the feed a
 * projection by construction: `trajectory.jsonl === project(log)` exactly, with no
 * independent second computation to drift. The durable log (CR-207) is the history;
 * the feed is derived, so a rewrite loses nothing.
 *
 * Called in the tool layer right after the log write (mcp-tools `recordAudit`) —
 * the one place the operations log is produced. Deterministic: identical log ⇒
 * identical file.
 */
export async function materializeTrajectory(log: AuditLog, outDir: string): Promise<void> {
  const entries = await log.query({});
  const body = entries.map((entry) => JSON.stringify(projectTrajectory(entry))).join('\n');
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'trajectory.jsonl'), body ? body + '\n' : '', 'utf8');
}

// ---------------------------------------------------------------------------
// registerEmitters — canonical wiring point (CR-GC-102 public surface).
// ---------------------------------------------------------------------------

export interface RegisterEmittersOptions {
  /**
   * SSE / event sink. Called once per mutation with the LiveUpdateEvent.
   * Production host wires the SSE broadcast here; tests capture events.
   * If omitted, update-event hook is still registered but no-ops.
   */
  onEvent?: (event: LiveUpdateEvent) => void;
}

/**
 * Register the built-in live-update emitter on `hooks` (id: 'emit-update-event').
 * The learning feed is NOT a hook: it is materialized in the tool layer as a
 * projection of the operations log (CR-252, `materializeTrajectory`), so there is
 * no per-mutation parallel write path here.
 *
 * Hook order is deterministic (registration order, per REQ-hook-order-deterministic).
 */
export function registerEmitters(
  hooks: HookSystem,
  opts: RegisterEmittersOptions = {},
): { updateEventHookId: string } {
  const sink = opts.onEvent ?? (() => { /* no-op when no SSE host */ });
  const updateEventHookId = hooks.registerHook(
    'post-apply',
    makeUpdateEventHook(sink),
    { id: 'emit-update-event' },
  );
  return { updateEventHookId };
}

// ---------------------------------------------------------------------------
// ResponseCache — version-keyed cache with dirty-flag (REQ-versioned-cache).
// ---------------------------------------------------------------------------

/**
 * Minimal version-keyed response cache. Invalidated by a dirty-flag that is
 * set whenever a live-update event is emitted (i.e., after every mutation).
 *
 * Usage pattern:
 *   const cache = new ResponseCache();
 *   // After each mutation (wired via onEvent):
 *   cache.invalidate();
 *   // On read:
 *   const hit = cache.get(storeVersion, 'query:nodes');
 *   if (!hit) { ... compute ... cache.set(storeVersion, 'query:nodes', value); }
 */
export class ResponseCache {
  private readonly store = new Map<string, unknown>();
  private dirty = false;

  /** Mark all entries dirty (called by the update-event emitter). */
  invalidate(): void {
    this.dirty = true;
    this.store.clear();
  }

  /** True iff the cache has been invalidated since last cleared. */
  isDirty(): boolean {
    return this.dirty;
  }

  /** Return a cached value keyed by (version, key), or undefined on miss/dirty. */
  get<T>(version: string, key: string): T | undefined {
    if (this.dirty) return undefined;
    return this.store.get(`${version}:${key}`) as T | undefined;
  }

  /** Store a value keyed by (version, key); clears the dirty flag. */
  set<T>(version: string, key: string, value: T): void {
    this.dirty = false;
    this.store.set(`${version}:${key}`, value);
  }
}
