/**
 * CR-GC-102 — Emission helpers: trajectory append + live-update event.
 *
 * Two exported post-apply hook factories:
 *   - makeUpdateEventHook  → emits exactly ONE live-update event per mutation
 *     via an `onEvent` sink (no HTTP; caller owns the SSE transport).
 *   - makeTrajectoryHook   → appends one JSONL line per mutation to
 *     `<outDir>/trajectory.jsonl` (append-only, stable schema).
 *
 * Composed via `registerEmitters(hooks, opts)` — the canonical wiring point
 * consumed by `createHarness` or tests.
 *
 * Version-keyed response cache (REQ-versioned-cache):
 *   `ResponseCache` — a tiny in-module class keyed by a store version string.
 *   Mutations invalidate it via dirty-flag; callers read `get(version, key)`.
 *
 * @author andreas@siglochconsulting
 */

import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { MutateResult } from '@sigloch/contracts/harness';
import type { HookSystem } from './hooks.js';
import type { HookData, HookResult } from './hooks.js';

// ---------------------------------------------------------------------------
// LiveUpdateEvent — shape of the event emitted to the SSE sink.
// ---------------------------------------------------------------------------

/** Domains affected by a mutation (superset; always at least ['graph']). */
export type UpdateDomain = 'graph' | 'rules' | 'readiness' | 'suggestions';

/**
 * Emitted once per mutation via the `onEvent` sink.
 * Consumers (SSE handler) serialise this as an `invalidate` event.
 */
export interface LiveUpdateEvent {
  type: 'invalidate';
  domains: UpdateDomain[];
  /** ISO timestamp of when the event was produced. */
  ts: string;
}

// ---------------------------------------------------------------------------
// TrajectoryEntry — stable JSONL schema (REQ-trajectory-emit L1).
// ---------------------------------------------------------------------------

/**
 * One line in `trajectory.jsonl`. Schema is STABLE — changing field names or
 * types is a breaking change (bump version comment below).
 *
 * Schema version: 1.0.0
 *   ts          — ISO 8601 timestamp
 *   consumerType — always 'system' (harness-internal; extend to config if needed)
 *   opCounts    — number of commands in the mutation batch
 *   applied     — whether the mutation was persisted
 *   violations  — violation count by severity
 *   tier        — 'auto-apply' | 'suggest' | 'block' | undefined
 */
export interface TrajectoryEntry {
  ts: string;
  consumerType: 'system';
  opCounts: number;
  applied: boolean;
  violations: {
    error: number;
    warning: number;
    info: number;
  };
  tier: string | undefined;
}

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
 * Returns a post-apply HookHandler that appends one TrajectoryEntry (JSONL)
 * to `<outDir>/trajectory.jsonl` after each mutation (append-only).
 */
export function makeTrajectoryHook(
  outDir: string,
): (data: HookData) => Promise<HookResult | void> {
  const filePath = join(outDir, 'trajectory.jsonl');
  // Ensure the dir exists once per hook lifetime (lazy, idempotent).
  const ensureDir = mkdir(outDir, { recursive: true });

  return async (data: HookData): Promise<HookResult | void> => {
    if (data.phase !== 'post-apply') return;
    await ensureDir; // resolves immediately after first call
    const result = data.result;
    const entry: TrajectoryEntry = {
      ts: new Date().toISOString(),
      consumerType: 'system',
      opCounts: result.appliedCommands,
      applied: result.success,
      violations: {
        error: result.violations.filter((v) => v.severity === 'error').length,
        warning: result.violations.filter((v) => v.severity === 'warning').length,
        info: result.violations.filter((v) => v.severity === 'info').length,
      },
      tier: result.tier,
    };
    await appendFile(filePath, JSON.stringify(entry) + '\n', 'utf8');
  };
}

// ---------------------------------------------------------------------------
// registerEmitters — canonical wiring point (CR-GC-102 public surface).
// ---------------------------------------------------------------------------

export interface RegisterEmittersOptions {
  /**
   * Output directory for trajectory.jsonl. Typically `<repoRoot>/.aimprove`
   * per FUNC-emit-trajectory; tests pass a tmp dir.
   */
  outDir: string;
  /**
   * SSE / event sink. Called once per mutation with the LiveUpdateEvent.
   * Production host wires the SSE broadcast here; tests capture events.
   * If omitted, update-event hook is still registered but no-ops.
   */
  onEvent?: (event: LiveUpdateEvent) => void;
}

/**
 * Register the two built-in post-apply emitters on `hooks`:
 *   1. live-update event hook   (id: 'emit-update-event')
 *   2. trajectory append hook   (id: 'emit-trajectory')
 *
 * Hook order is deterministic (registration order, per REQ-hook-order-deterministic).
 * Returns the two registered hook IDs.
 */
export function registerEmitters(
  hooks: HookSystem,
  opts: RegisterEmittersOptions,
): { updateEventHookId: string; trajectoryHookId: string } {
  const sink = opts.onEvent ?? (() => { /* no-op when no SSE host */ });
  const updateEventHookId = hooks.registerHook(
    'post-apply',
    makeUpdateEventHook(sink),
    { id: 'emit-update-event' },
  );
  const trajectoryHookId = hooks.registerHook(
    'post-apply',
    makeTrajectoryHook(opts.outDir),
    { id: 'emit-trajectory' },
  );
  return { updateEventHookId, trajectoryHookId };
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
