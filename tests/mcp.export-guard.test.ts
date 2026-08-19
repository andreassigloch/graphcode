/**
 * TEST-mcp-export-guard — graph_export refuses to clobber the committed SSOT.
 *
 * A long-running MCP server (or a parallel ist-vs-soll sync) can hold a graph
 * that is BEHIND the committed docs/graph/<name>.graph.json. The original
 * graph_export blindly writeFileSync'd over it, silently DROPPING committed
 * elements/traces (observed in the wild: a stale export deleted CR-GC-133).
 *
 * This locks the two guards (mirroring scripts/export-graph.mjs): refuse on an
 * empty live graph, and refuse if the write would delete anything the committed
 * file still has — unless force:true marks the deletion intentional.
 *
 * Real disk Kuzu on a temp repo, no mocks. The "newer committed SSOT" is
 * simulated by injecting an extra element into the on-disk file (test setup),
 * NOT by hand-editing any real project graph.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

function makeHarness(repoRoot: string): GraphCodeHarness {
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'demo-ws', systemId: 'auth-service' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

// Gate-valid member spec: REQ + verifying TEST (R-01) + satisfying MOD (RD-01) + SYS compose.
const SPEC: MutateCommand[] = [
  { op: 'add-node', node: { uid: 'SYS-auth', type: 'SYS', name: 'Auth service', description: 'demo member', attributes: {} } },
  { op: 'add-node', node: { uid: 'REQ-reset', type: 'REQ', name: 'Password reset', description: 'reset capability', attributes: {} } },
  { op: 'add-node', node: { uid: 'TEST-reset', type: 'TEST', name: 'Reset test', description: '', attributes: {} } },
  { op: 'add-node', node: { uid: 'MOD-reset', type: 'MOD', name: 'Reset handler', description: '', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'SYS-auth', targetId: 'REQ-reset', edgeType: 'compose', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'TEST-reset', targetId: 'REQ-reset', edgeType: 'verify', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'MOD-reset', targetId: 'REQ-reset', edgeType: 'satisfy', attributes: {} } },
];

const JSON_REL = join('docs', 'graph', 'auth-service.graph.json');

describe('TEST-mcp-export-guard: graph_export refuses to clobber the committed SSOT', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-export-guard-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('refuses to overwrite a populated SSOT with an empty live graph', async () => {
    const tools = bindToolsToHarness(harness);
    // Seed a committed file via a first valid export, then point an empty graph at it.
    await harness.mutate(SPEC);
    await tools.graph_export.handler({ force: false });
    // New empty harness on the SAME repo (fresh Kuzu wiped → 0 nodes).
    await harness.close();
    rmSync(join(repoRoot, '.graphcode'), { recursive: true, force: true });
    harness = makeHarness(repoRoot);
    await harness.initialize();
    const emptyTools = bindToolsToHarness(harness);
    await expect(emptyTools.graph_export.handler({ force: false })).rejects.toThrow(/0 elements/);
  });

  it('refuses when the write would drop an element present in the committed file', async () => {
    const tools = bindToolsToHarness(harness);
    await harness.mutate(SPEC);
    await tools.graph_export.handler({ force: false });

    // Simulate a NEWER committed SSOT (parallel writer added one element + trace).
    const jsonAbs = join(repoRoot, JSON_REL);
    const committed = JSON.parse(readFileSync(jsonAbs, 'utf8')) as {
      elements: Array<Record<string, unknown>>;
      traces: Array<Record<string, unknown>>;
    };
    committed.elements.push({ id: 'TEST-parallel', type: 'TEST', name: 'Parallel', description: '' });
    committed.traces.push({ source: 'TEST-parallel', target: 'REQ-reset', type: 'verify', weight: 1 });
    writeFileSync(jsonAbs, JSON.stringify(committed, null, 2));

    // The live graph still has 4 nodes → export would delete TEST-parallel → refuse.
    await expect(tools.graph_export.handler({ force: false })).rejects.toThrow(/would delete .*TEST-parallel/s);

    // The committed file is untouched by the refused write.
    const after = JSON.parse(readFileSync(jsonAbs, 'utf8')) as { elements: Array<{ id: string }> };
    expect(after.elements.map((e) => e.id)).toContain('TEST-parallel');
  });

  it('force:true overrides the guard for an intentional deletion', async () => {
    const tools = bindToolsToHarness(harness);
    await harness.mutate(SPEC);
    await tools.graph_export.handler({ force: false });

    const jsonAbs = join(repoRoot, JSON_REL);
    const committed = JSON.parse(readFileSync(jsonAbs, 'utf8')) as { elements: Array<Record<string, unknown>> };
    committed.elements.push({ id: 'TEST-parallel', type: 'TEST', name: 'Parallel', description: '' });
    writeFileSync(jsonAbs, JSON.stringify(committed, null, 2));

    const res = await tools.graph_export.handler({ force: true });
    expect(res.graphJson.nodes).toBe(4);
    const after = JSON.parse(readFileSync(jsonAbs, 'utf8')) as { elements: Array<{ id: string }> };
    expect(after.elements.map((e) => e.id)).not.toContain('TEST-parallel');
  });

  // CR-GC-296 (GVE-Audit F9) — export-after-own-mutate: the tool decides from
  // provenance instead of the caller passing a blind force:true.
  describe('export-after-own-mutate (CR-GC-296)', () => {
    // Provenance is read from the AUDIT LOG (recordAudit), which only the write
    // TOOLS populate — so this block drives mutations via tools.graph_mutate,
    // never harness.mutate() directly (that would silently bypass the audit trail).
    const addMod2 = { op: 'add-node', node: { uid: 'MOD-reset2', type: 'MOD', name: 'Reset handler v2', description: '', attributes: {} } };
    const mergeMod = { op: 'merge-nodes', sourceUid: 'MOD-reset', targetUid: 'MOD-reset2' };

    it('merge→export without force: the audited merge-nodes deletion is self-accounted, no force needed', async () => {
      const tools = bindToolsToHarness(harness);
      expect((await tools.graph_mutate.handler({ commands: SPEC })).success).toBe(true);
      await tools.graph_export.handler({ force: false }); // baseline commit: MOD-reset present

      // A second MOD absorbs MOD-reset via an audited, applied merge-nodes batch —
      // MOD-reset (+ its satisfy→REQ-reset edge identity) vanishes from the live graph.
      expect((await tools.graph_mutate.handler({ commands: [addMod2] })).success).toBe(true);
      const merged = await tools.graph_mutate.handler({ commands: [mergeMod] });
      expect(merged.success).toBe(true);
      expect(harness.getGraph().nodes.some((n) => n.uid === 'MOD-reset')).toBe(false);

      // Same process, no force:true — the guard sees the drop is self-inflicted.
      const res = await tools.graph_export.handler({});
      expect(res.graphJson.nodes).toBe(4); // SYS/REQ/TEST/MOD-reset2 (MOD-reset merged away)

      const jsonAbs = join(repoRoot, JSON_REL);
      const after = JSON.parse(readFileSync(jsonAbs, 'utf8')) as { elements: Array<{ id: string }> };
      expect(after.elements.map((e) => e.id)).not.toContain('MOD-reset');
      expect(after.elements.map((e) => e.id)).toContain('MOD-reset2');
    });

    it('a foreign drop (no audited own-process deletion) is still refused without force', async () => {
      const tools = bindToolsToHarness(harness);
      expect((await tools.graph_mutate.handler({ commands: SPEC })).success).toBe(true);
      await tools.graph_export.handler({ force: false });

      // Same scenario as the "refuses when the write would drop..." test above, but
      // explicitly named for CR-GC-296: the committed file gained an element the
      // live graph never held and no audited batch ever touched — export-after-
      // own-mutate must NOT wave this through.
      const jsonAbs = join(repoRoot, JSON_REL);
      const committed = JSON.parse(readFileSync(jsonAbs, 'utf8')) as {
        elements: Array<Record<string, unknown>>;
        traces: Array<Record<string, unknown>>;
      };
      committed.elements.push({ id: 'TEST-foreign', type: 'TEST', name: 'Foreign', description: '' });
      writeFileSync(jsonAbs, JSON.stringify(committed, null, 2));

      await expect(tools.graph_export.handler({})).rejects.toThrow(/would delete .*TEST-foreign/s);
    });

    it('a merge from a PRIOR process (before this registry booted) is not "own" — still refused without force', async () => {
      // Simulates a stale-but-not-obviously-so case: the deletion WAS a legitimate,
      // audited merge-nodes at some point, but not by THIS process instance — the
      // durable audit log survives, but processStartVersion (captured at THIS
      // bindExportTools call) is now past it, so it must not count as self-provenance.
      const priorTools = bindToolsToHarness(harness);
      expect((await priorTools.graph_mutate.handler({ commands: SPEC })).success).toBe(true);
      await priorTools.graph_export.handler({ force: false }); // baseline commit
      expect((await priorTools.graph_mutate.handler({ commands: [addMod2] })).success).toBe(true);
      expect((await priorTools.graph_mutate.handler({ commands: [mergeMod] })).success).toBe(true);
      // Do NOT re-export here — the committed file still has MOD-reset (stale relative
      // to the live graph), exactly like a process that merged but crashed before export.

      // A NEW registry (fresh bindExportTools call, fresh processStartVersion) on
      // the SAME harness/audit log — the prior process's merge is no longer "own".
      const freshTools = bindToolsToHarness(harness);
      await expect(freshTools.graph_export.handler({})).rejects.toThrow(/would delete .*MOD-reset\b/s);
    });
  });
});
