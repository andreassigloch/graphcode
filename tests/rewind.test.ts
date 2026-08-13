/**
 * TEST-rewind (CR-GC-311) — `graphcode rewind <ref>` restores the graph state
 * committed at a ref, the recall half of `UC-graph-time-travel`.
 *
 * The mechanism was already proven by `tests/graph-timetravel.test.ts` (marker →
 * export → reseed). What this file covers is the OPERATION on top of it, and above
 * all its failure modes — a recall that half-succeeds is worse than one that refuses,
 * because the store would then silently belong to a different commit than the code.
 *
 * The design that makes the invariant cheap: no checkout. The snapshot is read from
 * git object storage, so there is exactly ONE state change (the reseed) and every
 * error path leaves the store untouched. Each of these tests asserts that — not that
 * an error was raised, but that the store survived it unchanged.
 *
 * Real temp git repo, real disk Kuzu (never :memory:). No mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluateAllRules } from '@sigloch/contracts/se';
import { executeRewind, RewindError } from '../src/rewind.js';
import { createHarness } from '../src/index.js';
import { setExportPending, isExportPending } from '../src/export-marker.js';
import { DEFAULT_GRAPH_JSON } from '../src/harness-import.js';

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

/** A snapshot in the committed SSOT shape: `elements` / `traces` / `graphVersion`. */
function snapshot(reqs: string[], version: number): string {
  return JSON.stringify(
    {
      elements: [
        { id: 'SYS-x', type: 'SYS', name: 'x', description: 'Ein System.' },
        ...reqs.map((uid) => ({
          id: uid,
          type: 'REQ',
          name: uid,
          description: `Das System muss ${uid} innerhalb von zwei Sekunden bestaetigen.`,
        })),
      ],
      traces: [],
      graphVersion: version,
    },
    null,
    2,
  );
}

/** Commit `content` as the SSOT snapshot and return the resulting sha. */
function commitSnapshot(repo: string, content: string, message: string): string {
  const abs = join(repo, DEFAULT_GRAPH_JSON);
  mkdirSync(join(repo, 'docs', 'graph'), { recursive: true });
  writeFileSync(abs, content);
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', message);
  return git(repo, 'rev-parse', 'HEAD').trim();
}

/** Element uids currently in the live store — the observable a recall must move. */
async function liveUids(repoRoot: string): Promise<string[]> {
  const harness = await createHarness({
    repoRoot,
    scope: { workspaceId: 'rewind-probe', systemId: 'rewind-probe' },
  });
  await harness.initialize();
  try {
    return harness
      .getGraph()
      .nodes.map((n) => n.uid)
      .sort();
  } finally {
    await harness.close();
  }
}

describe('TEST-rewind: recall the graph state of a commit (CR-GC-311)', () => {
  let repo: string;
  let first: string;

  beforeEach(async () => {
    repo = mkdtempSync(join(tmpdir(), 'graphcode-rewind-'));
    git(repo, 'init', '-q', '-b', 'master');
    git(repo, 'config', 'user.email', 'test@example.com');
    git(repo, 'config', 'user.name', 'Test');
    // `.graphcode/` must be ignored, exactly as in a scaffolded repo — the staging
    // file lands there and must never dirty the working tree.
    writeFileSync(join(repo, '.gitignore'), '.graphcode/\n');

    first = commitSnapshot(repo, snapshot(['REQ-alpha'], 1), 'first');
    commitSnapshot(repo, snapshot(['REQ-alpha', 'REQ-beta'], 2), 'second');

    // Bring the live store up on the LATEST state, so a recall has somewhere to move from.
    const harness = await createHarness({
      repoRoot: repo,
      scope: { workspaceId: 'rewind-probe', systemId: 'rewind-probe' },
    });
    await harness.initialize();
    await harness.seedFromJson();
    await harness.close();
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it('restores the earlier state and drops what only the later commit had', async () => {
    expect(await liveUids(repo)).toContain('REQ-beta');

    const summary = await executeRewind({ repoRoot: repo, ref: first });

    expect(summary.commit).toBe(first);
    expect(summary.restored.nodes).toBe(2); // SYS-x + REQ-alpha
    const uids = await liveUids(repo);
    expect(uids).toContain('REQ-alpha');
    expect(uids).not.toContain('REQ-beta');
  });

  it('is idempotent — rewinding to HEAD twice lands on the same state', async () => {
    await executeRewind({ repoRoot: repo, ref: 'HEAD' });
    const once = await liveUids(repo);
    await executeRewind({ repoRoot: repo, ref: 'HEAD' });
    expect(await liveUids(repo)).toEqual(once);
    expect(once).toContain('REQ-beta');
  });

  it('accepts symbolic refs, not just shas', async () => {
    const summary = await executeRewind({ repoRoot: repo, ref: 'HEAD~1' });
    expect(summary.commit).toBe(first);
    expect(await liveUids(repo)).not.toContain('REQ-beta');
  });

  it('never touches the working tree — git status is identical before and after', async () => {
    const before = git(repo, 'status', '--porcelain');
    const head = git(repo, 'rev-parse', 'HEAD').trim();

    await executeRewind({ repoRoot: repo, ref: first });

    expect(git(repo, 'status', '--porcelain')).toBe(before);
    // The point of reading via `git show`: HEAD does not move either.
    expect(git(repo, 'rev-parse', 'HEAD').trim()).toBe(head);
    // The committed snapshot still describes the LATER state — a recall changes the
    // store, not history.
    expect(readFileSync(join(repo, DEFAULT_GRAPH_JSON), 'utf8')).toContain('REQ-beta');
  });

  it('removes its staging file', async () => {
    await executeRewind({ repoRoot: repo, ref: first });
    expect(existsSync(join(repo, '.graphcode', 'rewind-staged.graph.json'))).toBe(false);
  });

  it('aborts while un-exported mutations are pending, leaving the store untouched', async () => {
    const before = await liveUids(repo);
    setExportPending(repo);

    await expect(executeRewind({ repoRoot: repo, ref: first })).rejects.toThrow(RewindError);

    expect(await liveUids(repo)).toEqual(before);
    expect(isExportPending(repo), 'the marker must survive a refused rewind').toBe(true);
  });

  it('--force drops pending mutations and reports that it did', async () => {
    setExportPending(repo);
    const summary = await executeRewind({ repoRoot: repo, ref: first, force: true });

    expect(summary.forced).toBe(true);
    expect(await liveUids(repo)).not.toContain('REQ-beta');
    // reseed re-syncs store and snapshot, so the drift signal is gone afterwards.
    expect(isExportPending(repo)).toBe(false);
  });

  it('rejects an unknown ref without touching the store', async () => {
    const before = await liveUids(repo);
    await expect(executeRewind({ repoRoot: repo, ref: 'kein-solcher-ref' })).rejects.toThrow(
      /unknown git ref/,
    );
    expect(await liveUids(repo)).toEqual(before);
  });

  it('rejects a ref whose commit carries no snapshot, without touching the store', async () => {
    // A commit from before the SSOT existed.
    git(repo, 'rm', '-q', DEFAULT_GRAPH_JSON);
    git(repo, 'commit', '-q', '-m', 'drop snapshot');
    const bare = git(repo, 'rev-parse', 'HEAD').trim();
    const before = await liveUids(repo);

    await expect(executeRewind({ repoRoot: repo, ref: bare })).rejects.toThrow(/carries no/);
    expect(await liveUids(repo)).toEqual(before);
  });

  it('rejects a corrupt snapshot before reseeding anything', async () => {
    commitSnapshot(repo, '{ das ist kein JSON', 'broken');
    const broken = git(repo, 'rev-parse', 'HEAD').trim();
    const before = await liveUids(repo);

    await expect(executeRewind({ repoRoot: repo, ref: broken })).rejects.toThrow(/not valid JSON/);
    expect(await liveUids(repo)).toEqual(before);
  });
});

/**
 * The other half of CR-311: the UC is only "implemented" once the graph SAYS so. The
 * verb alone would leave the same silent gap that started this — a use case whose
 * operational chain exists in code and nowhere in the model.
 *
 * These assert against the committed SSOT rather than a fixture on purpose: the claim
 * is about THIS repo's model, and a fixture could not go stale with it.
 */
describe('UC-graph-time-travel is modelled, not just built (CR-GC-311)', () => {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), 'docs/graph/graphcode.graph.json'), 'utf8'),
  ) as { elements: Array<Record<string, unknown>>; traces: Array<Record<string, string>> };

  /** The committed snapshot flattens attributes onto the element; the rules read `.attributes`. */
  const CORE = new Set(['id', 'type', 'name', 'description', 'attributes']);
  const graph = {
    elements: raw.elements.map((e) => {
      const attributes: Record<string, unknown> = { ...((e.attributes as object) ?? {}) };
      for (const [k, v] of Object.entries(e)) if (!CORE.has(k)) attributes[k] = v;
      return {
        id: e.id as string,
        type: e.type as string,
        name: e.name as string,
        description: e.description as string,
        attributes,
      };
    }),
    traces: raw.traces,
  };

  it('carries both operational chains under the UC', () => {
    const chains = graph.traces
      .filter((t) => t.source === 'UC-graph-time-travel' && t.type === 'compose')
      .map((t) => t.target)
      .filter((id) => graph.elements.some((e) => e.id === id && e.type === 'FCHAIN'));

    expect(chains.sort()).toEqual(['FCHAIN-recall', 'FCHAIN-snapshot-freshness']);
  });

  it('trips none of the UC/FCHAIN completeness rules any more', () => {
    // UC-02 (error, no ACTOR), UC-03 and FC-02 (no scenario) all fired on this UC
    // before the CR — the exact rules that should have flagged it and never ran,
    // because SE_DESCRIPTOR wires only V3_RULES + MT_RULES (CR-GC-312).
    // Cast: the SSOT is the runtime shape the rules read; the exported TS type demands
    // literal unions the JSON cannot carry.
    const fired = evaluateAllRules(graph as unknown as Parameters<typeof evaluateAllRules>[0], DEFAULT_METRIC_POLICY)
      .filter((v) => v.element_id === 'UC-graph-time-travel')
      .map((v) => v.rule_id);

    expect(fired).not.toContain('UC-02');
    expect(fired).not.toContain('UC-03');
    expect(fired).not.toContain('FC-02');
  });

  it('binds every new FUNC to a symbol that exists on disk (RC-01)', () => {
    const bindings = ['FUNC-graph-export-snapshot', 'FUNC-reseed', 'FUNC-rewind'].map((uid) => {
      const node = graph.elements.find((e) => e.id === uid);
      expect(node, `${uid} missing from the SSOT`).toBeDefined();
      return { uid, ref: node!.attributes.realRef as { file: string; symbol: string } };
    });

    for (const { uid, ref } of bindings) {
      expect(ref, `${uid} carries no realRef`).toBeDefined();
      const source = readFileSync(join(process.cwd(), ref.file), 'utf8');
      expect(source, `${uid}: ${ref.symbol} not declared in ${ref.file}`).toContain(ref.symbol);
    }
  });
});
