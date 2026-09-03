/**
 * trajectory.ts — der Lernfeed als REINE PROJEKTION des Operations-Logs (CR-252).
 *
 * Herausgelöst aus `hooks/emit.ts` mit CR-GC-447. Die alte Datei war eine Ablage
 * für zwei Dinge, die nichts miteinander zu tun haben: ein Live-Event für die
 * SSE-Oberfläche (jetzt `surface/emit.ts`) und diese Projektion. CR-GC-446 hat
 * die beiden FUNCs deshalb getrennt alloziert — `FUNC-emit-update-event` nach
 * `MOD-surface`, `FUNC-emit-trajectory` nach `MOD-projections`; hier ist der
 * Code-Nachzug. Es gibt keinen gemeinsamen Zustand zwischen beiden Hälften.
 *
 * `materializeTrajectory` schreibt `<outDir>/trajectory.jsonl` vollständig neu,
 * aus dem Log und sonst nichts. Das Log (CR-207) ist die eine Wahrheit; der Feed
 * ist abgeleitet, nie ein zweiter Schreibpfad. Der Projektionsvertrag
 * (`Trajectory`) kommt aus `@sigloch/learning-core` — kein zweites Schema hier.
 *
 * @author andreas@siglochconsulting
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AuditLog } from '@sigloch/graph-api-core';
import { projectTrajectory } from '@sigloch/learning-core';
// Der Feed-Dateiname steht einmal (scaffold-templates) — dieselbe Konstante, die
// `graphcode remove` beim Aufräumen der Alt-Kopie liest (CR-GC-331).
import { TRAJECTORY_FILE, GRAPHCODE_DIR } from '../kernel/workspace.js';
import { readExportPending } from '../kernel/export-marker.js';

// ---------------------------------------------------------------------------
// Trajectory stamps (CR-GC-434) — the trigger of a mutation, on the record.
// ---------------------------------------------------------------------------

/** One violation a mutation answered — identified, never guessed (CR-GC-434). */
export interface RespondsToViolation {
  ruleId: string;
  /** Absent when the violation carried no elementId (graph-level finding). */
  elementId?: string;
}

/**
 * 'human-order' = the FIRST mutation under a NEW verbatim human prompt;
 * 'agent-round' = a further mutation under the SAME standing prompt (the agent's
 * own round). Purely mechanical — derived from prompt identity (CR-GC-354/356
 * provenance), never from interpreting the prompt text.
 */
export type MutationTrigger = 'human-order' | 'agent-round';

/**
 * 'suggestion-template' = the batch IS a template edit graph_suggest delivered in
 * this session; 'authored' = the author's own formulation. This is the circularity
 * stamp CR-GC-432 was missing: whether the fix template was actually used.
 */
export type EditSource = 'suggestion-template' | 'authored';

/**
 * The four trigger stamps of CR-GC-434, recorded per mutation on the audit entry
 * and projected verbatim onto the trajectory line. Every field is optional with
 * the CR-GC-354 asymmetry: ABSENT means NOT RECORDED (pre-CR-434 records, or not
 * determinable — e.g. a merge-replayed foreign batch's editSource), while an
 * explicit empty value ([] / 'authored') is a determined statement. Nothing here
 * is ever guessed.
 *
 * GAP, NO LONGER MERELY DOCUMENTED (CR-GC-449): a raw in-process `harness.mutate()`
 * bypassing the tool layer writes neither log nor feed — and therefore no stamps.
 * Same for a session that mutates this repo through a store of its own. The gate
 * applies; the trajectory does not see it. That stays true (the gate has no feed of
 * its own and must not grow a second audit surface), but it is now COUNTED, not
 * trusted: `countUnfedMutations` below, surfaced by `graph_export`.
 */
export interface TrajectoryStamps {
  /** Pre-existing gate violations (error/warning) this mutation closed; [] = none. */
  respondsTo?: RespondsToViolation[];
  trigger?: MutationTrigger;
  /** Read tools that ran since the last recorded mutation; [] = provably no consultation. */
  consultedTools?: string[];
  editSource?: EditSource;
}

/**
 * Project the CR-GC-434 stamps off a log entry — verbatim pass-through of the
 * fields `recordAudit` wrote, absent stays absent. Local extension of the
 * `@sigloch/learning-core` Trajectory contract: `projectTrajectory` (a closed Zod
 * object) stays the base line, the stamps ride on top until the family promotes
 * them into `TrajectorySchema` (a learning-core version bump, not a local fork).
 */
export function projectStamps(entry: Record<string, unknown>): TrajectoryStamps {
  const out: TrajectoryStamps = {};
  if (Array.isArray(entry.respondsTo)) out.respondsTo = entry.respondsTo as RespondsToViolation[];
  if (entry.trigger === 'human-order' || entry.trigger === 'agent-round') out.trigger = entry.trigger;
  if (Array.isArray(entry.consultedTools)) out.consultedTools = entry.consultedTools as string[];
  if (entry.editSource === 'suggestion-template' || entry.editSource === 'authored') out.editSource = entry.editSource;
  return out;
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
  // CR-GC-434: the trigger stamps ride on the base line — same source entry, same
  // determinism (identical log ⇒ identical file). Absent on pre-CR-434 records.
  const body = entries
    .map((entry) =>
      JSON.stringify({
        ...projectTrajectory(entry),
        ...projectStamps(entry as unknown as Record<string, unknown>),
      }),
    )
    .join('\n');
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, TRAJECTORY_FILE), body ? body + '\n' : '', 'utf8');
}

// ---------------------------------------------------------------------------
// Der gemessene Rest-Verlust (CR-GC-449) — Lücke zählen statt Lücke behaupten.
// ---------------------------------------------------------------------------

/**
 * Wie viele ANGEWENDETE Gate-Mutationen dieses Repos der Repo-Feed nicht kennt.
 *
 * Zwei Zähler, die dasselbe Ereignis sehen müssten, verglichen — kein dritter
 * Schreibpfad, keine zweite Audit-Fläche:
 *
 *  - `EXPORT_PENDING.versionsBehind` (CR-GC-217/426) steht am **repoRoot** und wird
 *    von `harness.mutate()` selbst hochgezählt: EINS pro angewendeter Mutation,
 *    unabhängig davon, welcher Store, welcher Prozess, welcher Aufrufpfad. Das ist
 *    die einzige Zahl im Repo, die eine Mutation auch dann zählt, wenn sie am
 *    Tool-Layer vorbeiging (rohes `harness.mutate()`, Bootstrap, Fremd-Store).
 *  - Der Repo-Feed ist die Projektion dessen, was der Tool-Layer aufgeschrieben hat.
 *
 * Die Differenz seit `since` ist exakt das, was das Gate anwandte und der Feed nie
 * sah. `0`, wenn keine Marke liegt (nichts steht aus) oder sie vertragslos alt ist
 * (dann ist ihr Rückstand unbekannt — geraten wird nicht, die CR-GC-354-Asymmetrie).
 */
export function countUnfedMutations(repoRoot: string): number {
  const pending = readExportPending(repoRoot);
  if (!pending) return 0;
  const file = join(repoRoot, GRAPHCODE_DIR, TRAJECTORY_FILE);
  if (!existsSync(file)) return pending.versionsBehind;
  let fed = 0;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue;
    let rec: { ts?: unknown; operation?: unknown; applied?: unknown };
    try {
      rec = JSON.parse(line) as typeof rec;
    } catch {
      continue; // eine unlesbare Zeile ist kein Nachweis für eine gefeedete Mutation
    }
    // Nur angewendete Mutationen — `validate`-Previews bewegen die Marke nicht,
    // Rejections auch nicht. ISO-Zeitstempel sind lexikografisch vergleichbar.
    if (rec.operation !== 'mutate' || rec.applied !== true) continue;
    if (typeof rec.ts === 'string' && rec.ts >= pending.since) fed += 1;
  }
  return Math.max(0, pending.versionsBehind - fed);
}
