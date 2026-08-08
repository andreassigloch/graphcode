/**
 * rewind.ts — `graphcode rewind <ref>` (CR-GC-311), the recall half of
 * `UC-graph-time-travel`.
 *
 * The mechanism existed (drift marker + deterministic snapshot per commit +
 * `harness.reseed`), the OPERATION did not: recall was a hand procedure —
 * `git checkout <sha>` → `graph_reseed` with the right snapshot path → back to the
 * original ref. Three steps a human has to get right, in order.
 *
 * Why this earns a verb rather than staying an FCHAIN of existing functions: the
 * sequence carries an invariant its steps cannot. `git checkout` and `reseed` are two
 * independent state changes; break between them and the Kuzu store sits on state A
 * while the working tree sits on state B. The drift marker does NOT catch that — it
 * marks un-exported *mutations*, not a store belonging to the wrong commit.
 *
 * The invariant is bought by never doing the checkout at all: `git show
 * <ref>:<snapshot>` reads the blob straight out of object storage, so the working tree
 * is never touched and there is no half-way state to return from. What remains is one
 * state change (the reseed), and a failed read leaves the store exactly where it was.
 *
 * Un-exported mutations abort the rewind (`--force` overrides): a reseed replaces the
 * store wholesale, so proceeding would discard model edits with no trace. The marker
 * is the one signal that they exist.
 *
 * @author andreas@siglochconsulting
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHarness } from './index.js';
import { deriveMemberName } from './mcp-server.js';
import { DEFAULT_GRAPH_JSON } from './harness-import.js';
import { isExportPending, EXPORT_PENDING_REL } from './export-marker.js';

export interface RewindSummary {
  /** The git ref that was recalled, verbatim as given. */
  ref: string;
  /** The resolved commit sha the snapshot was read from. */
  commit: string;
  /** Repo-relative snapshot path inside that commit. */
  snapshot: string;
  /** Element/trace counts after the reseed. */
  restored: { nodes: number; edges: number };
  /** True when a set EXPORT_PENDING marker was overridden via `force`. */
  forced: boolean;
}

/** Raised for every expected failure — the CLI renders these without a stack. */
export class RewindError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RewindError';
  }
}

function git(repoRoot: string, args: string[]): string {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/**
 * Resolve `ref` to a commit sha. A bad ref must fail HERE, before anything is
 * written — `git show` on an unknown ref would otherwise surface as a read error
 * halfway through.
 */
function resolveCommit(repoRoot: string, ref: string): string {
  try {
    return git(repoRoot, ['rev-parse', '--verify', `${ref}^{commit}`]).trim();
  } catch {
    throw new RewindError(`unknown git ref "${ref}" — nothing was changed.`);
  }
}

/** The snapshot blob as committed under `ref`. Absent = the ref predates the snapshot. */
function readSnapshotAt(repoRoot: string, commit: string, snapshot: string): string {
  let blob: string;
  try {
    blob = git(repoRoot, ['show', `${commit}:${snapshot}`]);
  } catch {
    throw new RewindError(
      `commit ${commit.slice(0, 8)} carries no ${snapshot} — nothing was changed.`,
    );
  }
  try {
    JSON.parse(blob);
  } catch (err) {
    throw new RewindError(
      `${snapshot} at ${commit.slice(0, 8)} is not valid JSON (${
        err instanceof Error ? err.message : String(err)
      }) — nothing was changed.`,
    );
  }
  return blob;
}

/**
 * Recall the graph state committed at `ref`.
 *
 * The working tree is never touched: the snapshot is read from git object storage,
 * staged in the gitignored `.graphcode/` workspace, reseeded, and removed again. On
 * any failure the store is left untouched.
 */
export async function executeRewind(opts: {
  repoRoot: string;
  ref: string;
  /** Reseed even though un-exported mutations exist. They are lost — that is the point of the flag. */
  force?: boolean;
  /** Snapshot path inside the target commit (default docs/graph/graphcode.graph.json). */
  snapshot?: string;
  trace?: (line: string) => void;
}): Promise<RewindSummary> {
  const trace = opts.trace ?? (() => {});
  const snapshot = opts.snapshot ?? DEFAULT_GRAPH_JSON;
  const force = opts.force ?? false;

  // Everything that can fail without side effects runs first, in cost order.
  const pending = isExportPending(opts.repoRoot);
  if (pending && !force) {
    throw new RewindError(
      `un-exported model changes pending (${EXPORT_PENDING_REL}) — a rewind replaces the ` +
        'store wholesale and would discard them. Run graph_export first, or pass --force to drop them.',
    );
  }
  const commit = resolveCommit(opts.repoRoot, opts.ref);
  const blob = readSnapshotAt(opts.repoRoot, commit, snapshot);
  trace(`rewind: ${opts.ref} → ${commit.slice(0, 8)}, ${snapshot} (${blob.length} bytes)`);

  // The staging file lives under .graphcode/ (gitignored) so the working tree stays
  // clean even if the process dies between write and unlink. reseed() resolves paths
  // against repoRoot, so it has to sit inside the repo.
  const stageRel = join('.graphcode', 'rewind-staged.graph.json');
  const stageAbs = join(opts.repoRoot, stageRel);
  mkdirSync(dirname(stageAbs), { recursive: true });
  writeFileSync(stageAbs, blob);

  const member = deriveMemberName(opts.repoRoot);
  const harness = await createHarness({
    repoRoot: opts.repoRoot,
    scope: { workspaceId: member, systemId: member },
  });
  await harness.initialize();
  try {
    // reseed() clears EXPORT_PENDING itself — store and snapshot are back in sync,
    // which is exactly the post-state a recall promises.
    const restored = await harness.reseed(stageRel);
    trace(`rewind: restored ${restored.nodes} nodes, ${restored.edges} edges`);
    return { ref: opts.ref, commit, snapshot, restored, forced: pending };
  } finally {
    await harness.close();
    rmSync(stageAbs, { force: true });
  }
}
