/**
 * emit.ts — das LIVE-UPDATE-EVENT der Oberfläche (CR-GC-102).
 *
 * Eine post-apply-Hook-Fabrik: `makeUpdateEventHook` emittiert genau EIN
 * `LiveUpdateEvent` pro Mutation über eine `onEvent`-Senke (kein HTTP — den
 * SSE-Transport besitzt der Aufrufer, `surface/host.ts`). Verdrahtet wird sie
 * über `registerEmitters(hooks, opts)`.
 *
 * Der Lernfeed wohnt seit CR-GC-447 NICHT mehr hier: `materializeTrajectory` ist
 * eine reine Projektion des Operations-Logs und damit `MOD-projections`
 * (`projections/trajectory.ts`). CR-GC-446 hat die beiden FUNCs getrennt
 * alloziert; diese Datei trägt nur noch die Surface-Hälfte.
 *
 * Version-keyed response cache (REQ-versioned-cache):
 *   `ResponseCache` — a tiny in-module class keyed by a store version string.
 *   Mutations invalidate it via dirty-flag; callers read `get(version, key)`.
 *
 * @author andreas@siglochconsulting
 */

import type { MutateResult, UpdateDomain, LiveUpdateEvent } from '@sigloch/contracts/harness';
import type { HookSystem } from '../kernel/hooks.js';
import type { HookData, HookResult } from '../kernel/hooks.js';

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
