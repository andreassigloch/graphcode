/**
 * TEST-trajectory-feed-anchor — der Lernfeed gehört zu SEINEM Log (CR-GC-449).
 *
 * Der Befund, der diesen Test erzwungen hat: am 2026-08-27 gingen ~250 Gate-
 * Mutationen durch (CR-GC-445/446/447), und `.graphcode/trajectory.jsonl` im Repo
 * hatte danach ZWEI Zeilen — die zwei Mutationen der letzten Temp-Store-Session.
 * Nicht „es kam wenig an": der Feed wurde ÜBERSCHRIEBEN.
 *
 * Ursache: `materializeTrajectory` schrieb den Feed nach `repoRoot/.graphcode`,
 * las ihn aber aus dem Log, das BEIM STORE liegt (`getStoreDir()`, CR-GC-232).
 * Solange Store == `repoRoot/.graphcode` fällt das nicht auf. Eine Harness mit
 * Temp-Store und echtem repoRoot (das Muster, mit dem hier gearbeitet wird —
 * `lockDir: tmp`) schrieb damit bei JEDER Mutation den Repo-Feed aus einem
 * FREMDEN, frischen Log neu. Vollüberschreibung, also Totalverlust.
 *
 * Gepinnt wird deshalb:
 *   1. eine Temp-Store-Harness fasst den Repo-Feed nicht an,
 *   2. ihr Feed liegt neben ihrem Log (Projektionsidentität per Konstruktion),
 *   3. der Rest-Verlust ist MASCHINELL SICHTBAR: `graph_export` meldet, wie viele
 *      angewendete Gate-Mutationen dieses Repos im Repo-Feed fehlen.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR, AUDIT_BASENAME } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import { countUnfedMutations } from '../src/projections/trajectory.js';
import { readExportPending } from '../src/kernel/export-marker.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

/** Eine Feed-Zeile, wie sie die Projektion schreibt — hier als ALTER Bestand. */
const SENTINEL = (n: number): string =>
  JSON.stringify({
    ts: `2020-01-0${n}T00:00:00.000Z`,
    consumerId: 'earlier-session',
    consumerType: 'agent',
    operation: 'mutate',
    opCounts: 1,
    applied: true,
    outcome: 'applied',
    violations: { error: 0, warning: 0, info: 0 },
    graphVersion: n,
  });

function verifiedReq(n: string): MutateCommand[] {
  return [
    { op: 'add-node', node: { uid: `REQ-${n}`, type: 'REQ', name: `Req ${n}`, description: '', attributes: {} } },
    { op: 'add-node', node: { uid: `TEST-${n}`, type: 'TEST', name: `Test ${n}`, description: '', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: `TEST-${n}`, targetId: `REQ-${n}`, edgeType: 'verify', attributes: {} } },
  ];
}

function makeHarness(repoRoot: string, storeDir: string): GraphCodeHarness {
  mkdirSync(storeDir, { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(storeDir, 'kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'anchor' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage, undefined, { lockDir: storeDir });
}

function feedLines(dir: string): string[] {
  const file = join(dir, 'trajectory.jsonl');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter(Boolean);
}

describe('CR-GC-449: the learning feed is anchored to the log it projects', () => {
  let repoRoot: string;
  let storeDir: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-anchor-repo-'));
    storeDir = mkdtempSync(join(tmpdir(), 'graphcode-anchor-store-'));
    // Der Repo-Workspace mit BESTEHENDEM Feed — die Historie, die verloren ging.
    mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
    writeFileSync(join(repoRoot, '.graphcode', 'trajectory.jsonl'), [SENTINEL(1), SENTINEL(2), SENTINEL(3)].join('\n') + '\n');
    harness = makeHarness(repoRoot, storeDir);
    await harness.initialize();
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
    rmSync(storeDir, { recursive: true, force: true });
  });

  it('a temp-store session does not overwrite the repo feed with its own foreign log', async () => {
    const tools = bindToolsToHarness(harness);
    await tools.graph_mutate.handler({ commands: verifiedReq('01'), consumerId: 'agent-a' });

    // Der Repo-Feed gehört dem Repo-Store. Diese Harness schreibt in einen anderen
    // Store, also hat sie hier nichts zu suchen — schon gar nicht mit voller
    // Überschreibung aus einem Log, das die drei Zeilen nie gesehen hat.
    expect(feedLines(join(repoRoot, '.graphcode'))).toEqual([SENTINEL(1), SENTINEL(2), SENTINEL(3)]);
  });

  it('materializes the feed beside the log it projects — projection identity by construction', async () => {
    const tools = bindToolsToHarness(harness);
    await tools.graph_mutate.handler({ commands: verifiedReq('02'), consumerId: 'agent-a' });
    await tools.graph_mutate.handler({ commands: verifiedReq('03'), consumerId: 'agent-a' });

    // Log und Feed liegen im selben Verzeichnis und haben dieselbe Länge — genau
    // das ist die Zusicherung „feed === project(log)".
    const log = readFileSync(join(storeDir, AUDIT_BASENAME), 'utf8').trim().split('\n');
    expect(log).toHaveLength(2);
    expect(feedLines(storeDir)).toHaveLength(2);
  });

  it('counts applied gate mutations the repo feed never saw (machine-visible gap)', async () => {
    const tools = bindToolsToHarness(harness);
    await tools.graph_mutate.handler({ commands: verifiedReq('04'), consumerId: 'agent-a' });
    await tools.graph_mutate.handler({ commands: verifiedReq('05'), consumerId: 'agent-a' });
    await tools.graph_mutate.handler({ commands: verifiedReq('06'), consumerId: 'agent-a' });

    // Die Gate-Marke zählt repoRoot-seitig JEDE angewendete Mutation (CR-GC-217/426) —
    // egal, in welchem Store sie landete. Der Repo-Feed hat davon keine Zeile.
    expect(readExportPending(repoRoot)?.versionsBehind).toBe(3);
    expect(countUnfedMutations(repoRoot)).toBe(3);

    // Und der Export sagt es laut, statt die Marke still wegzuräumen.
    const report = (await tools.graph_export.handler({ force: false })) as { unfedMutations?: number };
    expect(report.unfedMutations).toBe(3);
  });

  it('reports no gap when store and repo are the same workspace (no false alarm)', async () => {
    await harness.close();
    rmSync(storeDir, { recursive: true, force: true });
    // Der Normalfall: Store == repoRoot/.graphcode, Log und Feed sind die des Repos.
    harness = makeHarness(repoRoot, join(repoRoot, '.graphcode'));
    await harness.initialize();
    const tools = bindToolsToHarness(harness);
    await tools.graph_mutate.handler({ commands: verifiedReq('07'), consumerId: 'agent-a' });
    await tools.graph_mutate.handler({ commands: verifiedReq('08'), consumerId: 'agent-a' });

    expect(countUnfedMutations(repoRoot)).toBe(0);
    const report = (await tools.graph_export.handler({ force: false })) as { unfedMutations?: number };
    expect(report.unfedMutations).toBeUndefined();
    // Und nach dem Export ist die Marke weg — die Zählung startet bei der nächsten Mutation neu.
    expect(countUnfedMutations(repoRoot)).toBe(0);
  });
});
