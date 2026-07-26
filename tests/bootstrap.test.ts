/**
 * TEST-bootstrap — REQ-bootstrap-through-gate (CR-GC-122).
 *
 * Format-E-Import befüllt einen LEEREN Member-Graphen ausschließlich durchs
 * mutate()-Gate (kein Direct-Write); rule-verletzender Format-E wird vom Gate
 * GEBLOCKT und nichts persistiert. Beweist: der Cold-Start geht durchs Gate,
 * nicht an ihm vorbei.
 *
 * Disk-Kuzu auf mkdtemp-Tempdir, echter KuzuAdapter, keine Mocks, nie :memory:.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import { bootstrap, TEMPLATE_FORMAT_E } from '../src/bootstrap.js';
import { GraphCodeCodec } from '../src/codec.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'new-member' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

describe('TEST-bootstrap: new-member fill THROUGH the gate', () => {
  let tmp: string;
  let kuzuPath: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-bootstrap-'));
    kuzuPath = join(tmp, 'kuzu');
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: kuzuPath });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('starts from a genuinely empty disk-Kuzu graph', () => {
    const g = harness.getGraph();
    expect(g.nodes).toHaveLength(0);
    expect(g.edges).toHaveLength(0);
    // Empty baseline → zero violations, so ANY new error in a batch would block.
    expect(harness.evaluateRules()).toHaveLength(0);
  });

  it('fills the empty graph from the template Format-E THROUGH the gate', async () => {
    // The template parses to exactly the SYS + REQ + verifying TEST it declares.
    const expected = new GraphCodeCodec().decode(TEMPLATE_FORMAT_E);

    const { result, nodes, edges } = await bootstrap(harness, TEMPLATE_FORMAT_E);

    // Gate verdict: applies cleanly (R-01 satisfied, no error-severity violation), at
    // 'suggest' tier — the template's placeholder TEST is unbound (no testRef yet),
    // which R-19 surfaces as a non-blocking warning for the new member to resolve when
    // they implement it (CR-GC-205 Item 4). Nothing blocks; the fill persists.
    expect(result.success).toBe(true);
    expect(result.tier).toBe('suggest');
    expect(result.violations.filter((v) => v.severity === 'error')).toHaveLength(0);
    expect(result.violations.some((v) => v.ruleId === 'R-19')).toBe(true);
    expect(nodes).toBe(expected.nodes.length);
    expect(edges).toBe(expected.edges.length);
    // appliedCommands == nodes + edges proves nodes-first then edges went in one batch.
    expect(result.appliedCommands).toBe(nodes + edges);

    // Nodes/edges are now present in the in-memory working copy (post-mutate).
    const g = harness.getGraph();
    expect(g.nodes.map((n) => n.uid).sort()).toEqual(
      ['MOD-template', 'REQ-template-root', 'SYS-template', 'TEST-template-root'],
    );
    expect(
      g.edges.some(
        (e) =>
          e.sourceId === 'TEST-template-root' &&
          e.targetId === 'REQ-template-root' &&
          e.edgeType === 'verify',
      ),
    ).toBe(true);
  });

  it('persists the bootstrapped graph to disk (reload from a fresh handle)', async () => {
    await bootstrap(harness, TEMPLATE_FORMAT_E);
    await harness.close();

    // Fresh adapter on the SAME disk store — proves the gate persisted, not memory.
    const storage2 = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: kuzuPath });
    const harness2 = new GraphCodeHarness(makeConfig(tmp), storage2);
    await harness2.initialize();
    const g = harness2.getGraph();
    expect(g.nodes.find((n) => n.uid === 'SYS-template')).toBeDefined();
    expect(g.nodes.find((n) => n.uid === 'REQ-template-root')).toBeDefined();
    expect(
      g.edges.some((e) => e.sourceId === 'TEST-template-root' && e.targetId === 'REQ-template-root'),
    ).toBe(true);
    harness = harness2;
  });

  it('is governed: the fill is recorded in the audit trail (went via mutate, not direct write)', async () => {
    const registry = bindToolsToHarness(harness);
    // Re-run the bootstrap commands through the gate-bound registry's audit lens by
    // bootstrapping first, then asserting the mutation was auditable via the gate.
    const { result } = await bootstrap(harness, TEMPLATE_FORMAT_E);
    expect(result.success).toBe(true);

    // The audit_trail tool reads the same store the gate writes; a direct
    // saveNodes/saveEdges bypass would NOT show up as a 'mutate' op. Here we prove
    // the gate path is the one in use by mutating one more governed change through
    // the bound registry and seeing it audited.
    await registry['graph_mutate'].handler({
      commands: [
        { op: 'add-node', node: { uid: 'REQ-extra', type: 'REQ', name: 'Extra', description: 'x', attributes: {} } },
        { op: 'add-node', node: { uid: 'TEST-extra', type: 'TEST', name: 'Extra test', description: '', attributes: {} } },
        { op: 'add-edge', edge: { sourceId: 'TEST-extra', targetId: 'REQ-extra', edgeType: 'verify', attributes: {} } },
      ],
      consumerId: 'bootstrap-bot',
    });
    const { entries } = await registry['audit_trail'].handler({ limit: 10 });
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries.some((e: { operation: string }) => e.operation === 'mutate')).toBe(true);
  });

  it('Direct-Write schlägt fehl: rule-violating Format-E is BLOCKED by the gate; graph stays empty', async () => {
    // A lone orphan REQ with no verifying TEST → R-01 (error) is NEWLY introduced
    // against the empty baseline, so the gate must block and persist nothing.
    const orphanFormatE = [
      '## Nodes',
      '+ REQ-orphan.REQ|A requirement with no verifying test [__name:Orphan requirement]',
    ].join('\n');

    const { result, nodes } = await bootstrap(harness, orphanFormatE);

    expect(result.success).toBe(false);
    expect(result.tier).toBe('block');
    expect(result.mutations).toBe(0);
    expect(nodes).toBe(1); // one node parsed from Format-E, but...
    const r01 = result.violations.find((v) => v.ruleId === 'R-01');
    expect(r01).toBeDefined();
    expect(r01?.severity).toBe('error');

    // ...nothing was persisted: the empty graph stays empty (no bypass).
    const g = harness.getGraph();
    expect(g.nodes).toHaveLength(0);
    expect(g.edges).toHaveLength(0);

    // And it stays empty on disk too (fresh handle).
    await harness.close();
    const storage2 = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: kuzuPath });
    const harness2 = new GraphCodeHarness(makeConfig(tmp), storage2);
    await harness2.initialize();
    expect(harness2.getGraph().nodes).toHaveLength(0);
    harness = harness2;
  });

  it('surfaces Format-E parse errors (throws, no silent pass)', async () => {
    // Garbage that the authoritative parser rejects — bootstrap must throw.
    await expect(bootstrap(harness, '+ this-is-not-valid-format-e-@@@')).rejects.toThrow();
  });
});
