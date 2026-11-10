/**
 * TEST-testref-kopf-bindung (CR-GC-901) — der Testlauf bindet die Testdatei selbst.
 *
 * Befund (BOK-CR-080, immo-infra 2026-11-04..09): testRefs wurden nach jedem neuen Test von Hand
 * per graph_mutate gebunden — Buchfuehrung, die der Lauf selbst wissen kann. Nennt der Kopf einer
 * ungebundenen Testdatei GENAU EINE TEST-uid des Modells, bindet `graph_test_ingest` sie samt
 * Ergebnis. Sonst bleibt sie `unresolved`, und der Grund sagt, was fehlt.
 *
 * Reales Disk-Kuzu und echte Dateien im tmp-Repo, keine Mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { readTestRefs } from '@sigloch/contracts/se';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness, type ToolRegistry } from '../src/surface/mcp-tools.js';
import { testUidsImKopf } from '../src/projections/verification-report.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

describe('testUidsImKopf: nur der Kopf zaehlt', () => {
  it('liest die uid aus dem Kommentarkopf, nicht aus dem Rumpf', () => {
    expect(testUidsImKopf('/**\n * TEST-a — Abnahme\n */\nimport x from "y";\nconst u = "TEST-b";\n')).toEqual(['TEST-a']);
    expect(testUidsImKopf('// TEST-a und TEST-a\n#!/x TEST-c\n\ncode();')).toEqual(['TEST-a', 'TEST-c']);
    expect(testUidsImKopf('import x from "y";\n// TEST-a\n')).toEqual([]);
    expect(testUidsImKopf('/** XTEST-a, MY-TEST-b */')).toEqual([]);
  });
});

function makeHarness(repoRoot: string): GraphCodeHarness {
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'kopf-ws', systemId: 'kopf' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

const node = (uid: string, type: string, attributes: Record<string, unknown> = {}): MutateCommand => ({
  op: 'add-node',
  node: { uid, type, name: uid, description: `${uid}.`, attributes },
});
const edge = (sourceId: string, edgeType: string, targetId: string): MutateCommand => ({
  op: 'add-edge',
  edge: { sourceId, targetId, edgeType, attributes: {} },
});

const SEED: MutateCommand[] = [
  node('SYS-k', 'SYS'),
  node('REQ-k', 'REQ', { kinds: ['functional'] }),
  node('TEST-neu', 'TEST'),
  node('TEST-alt', 'TEST', { testRefs: [{ file: 'tests/alt.test.ts', tool: 'vitest' }] }),
  edge('SYS-k', 'compose', 'REQ-k'),
  edge('TEST-neu', 'verify', 'REQ-k'),
  edge('TEST-alt', 'verify', 'REQ-k'),
];

describe('TEST-testref-kopf-bindung: graph_test_ingest bindet ueber den Kopf (CR-GC-901)', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;
  let tools: ToolRegistry;
  const datei = (rel: string, text: string) => {
    mkdirSync(join(repoRoot, 'tests'), { recursive: true });
    writeFileSync(join(repoRoot, rel), text);
  };
  const refs = (uid: string) => {
    const r = readTestRefs(harness.getGraph().nodes.find((n) => n.uid === uid)!.attributes);
    return r.state === 'bound' ? r.value : [];
  };

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-kopf-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
    expect((await harness.mutate(SEED)).success).toBe(true);
    tools = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('bindet eine ungebundene Datei, deren Kopf die TEST-uid nennt — mit Ergebnis, ohne Handzug', async () => {
    datei('tests/neu.test.ts', '/**\n * TEST-neu — Abnahme\n */\nimport { it } from "vitest";\n');
    const report = JSON.stringify({
      testResults: [{ name: join(repoRoot, 'tests/neu.test.ts'), status: 'passed', assertionResults: [{ status: 'passed' }] }],
    });

    const res = await tools.graph_test_ingest.handler({ report, consumerId: 'runner' });

    expect(res.success).toBe(true);
    expect(res.bindings.map((b) => [b.testUid, b.file, b.tool])).toEqual([['TEST-neu', 'tests/neu.test.ts', 'vitest']]);
    expect(res.unresolved).toEqual([]);
    const r = refs('TEST-neu');
    expect(r.map((x) => [x.file, x.tool, x.result])).toEqual([['tests/neu.test.ts', 'vitest', 'passed']]);
    expect(r[0].ranAt).toBeTruthy();

    // Der naechste Lauf trifft die Bindung — keine zweite.
    const zweiter = await tools.graph_test_ingest.handler({ report, consumerId: 'runner' });
    expect(zweiter.bindings).toEqual([]);
    expect(zweiter.assignments.map((a) => a.testUid)).toEqual(['TEST-neu']);
    expect(refs('TEST-neu')).toHaveLength(1);
  });

  it('haengt die neue Datei an einen schon gebundenen TEST an, ohne dessen Eintrag zu verlieren', async () => {
    datei('tests/alt-zwei.test.ts', '// TEST-alt\nimport { it } from "vitest";\n');
    const res = await tools.graph_test_ingest.handler({
      results: [
        { file: 'tests/alt.test.ts', result: 'passed' },
        { file: 'tests/alt-zwei.test.ts', result: 'failed', tool: 'vitest' },
      ],
      consumerId: 'runner',
    });

    expect(res.success).toBe(true);
    expect(refs('TEST-alt').map((x) => [x.file, x.result])).toEqual([
      ['tests/alt.test.ts', 'passed'],
      ['tests/alt-zwei.test.ts', 'failed'],
    ]);
  });

  it('meldet, was fehlt, statt zu raten', async () => {
    datei('tests/ohne.test.ts', 'import { it } from "vitest";\n// TEST-neu steht im Rumpf\n');
    datei('tests/zwei.test.ts', '/** TEST-neu und TEST-alt */\n');
    datei('tests/fremd.test.ts', '/** TEST-gibtsnicht */\n');
    datei('tests/ohne-tool.test.ts', '/** TEST-neu */\n');

    const res = await tools.graph_test_ingest.handler({
      results: [
        { file: 'tests/ohne.test.ts', result: 'passed', tool: 'vitest' },
        { file: 'tests/zwei.test.ts', result: 'passed', tool: 'vitest' },
        { file: 'tests/fremd.test.ts', result: 'passed', tool: 'vitest' },
        { file: 'tests/ohne-tool.test.ts', result: 'passed' },
        { file: 'tests/fehlt.test.ts', result: 'passed', tool: 'vitest' },
        { file: '/ganz/woanders/x.test.ts', result: 'passed', tool: 'vitest' },
      ],
      consumerId: 'runner',
    });

    const grund = Object.fromEntries(res.unresolved.map((u) => [u.file, u.reason]));
    expect(res.bindings).toEqual([]);
    expect(grund['tests/ohne.test.ts']).toMatch(/names no TEST uid/);
    expect(grund['tests/zwei.test.ts']).toMatch(/TEST-neu, TEST-alt — a test file belongs to one TEST/);
    expect(grund['tests/fremd.test.ts']).toMatch(/TEST-gibtsnicht, which is no TEST/);
    expect(grund['tests/ohne-tool.test.ts']).toMatch(/no tool/);
    expect(grund['tests/fehlt.test.ts']).toMatch(/not readable/);
    expect(grund['/ganz/woanders/x.test.ts']).toMatch(/outside the repo/);
    expect(refs('TEST-neu')).toEqual([]);
  });
});
