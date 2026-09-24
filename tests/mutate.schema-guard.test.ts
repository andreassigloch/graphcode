/**
 * TEST-mutate-schema-guard (CR-GC-239) — malformed commands are rejected HARD.
 *
 * Live finding (graph-view-edit closeout 2026-07-05): a batch of `op:"add_node"`
 * commands (underscore, flat fields) passed the gate as success:true /
 * appliedCommands:21 / mutations:0 — graphVersion bumped, audit said "applied",
 * nothing persisted. Root cause: applyCommands' switch silently skipped unknown
 * ops. The gate now Zod-parses EVERY command against MutateCommandSchema
 * (contracts) and blocks the whole batch on any shape error.
 *
 * Real disk Kuzu in mkdtemp, real FileOperationsLog — no mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';
import type { AuditEntry } from '@sigloch/graph-api-core';
import type { HarnessConfig, MutateCommand, RuleViolation } from '@sigloch/contracts/harness';

function makeHarness(repoRoot: string): GraphCodeHarness {
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'guard-ws', systemId: 'guard-svc' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

/** The exact malformed shape from the live finding: underscore op, flat fields. */
const MALFORMED = { op: 'add_node', uid: 'REQ-typo', type: 'REQ', name: 'typo' };

const VALID: MutateCommand[] = [
  { op: 'add-node', node: { uid: 'REQ-ok', type: 'REQ', name: 'ok', description: '', attributes: {} } },
  { op: 'add-node', node: { uid: 'TEST-ok', type: 'TEST', name: 't', description: '', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'TEST-ok', targetId: 'REQ-ok', edgeType: 'verify', attributes: {} } },
];

describe('TEST-mutate-schema-guard (CR-GC-239)', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-guard-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
    tools = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('gate BLOCKS a malformed command with SCHEMA-01 + fixHint, nothing applied', async () => {
    const result = await harness.mutate([MALFORMED as unknown as MutateCommand]);
    expect(result.success).toBe(false);
    expect(result.tier).toBe('block');
    expect(result.appliedCommands).toBe(0);
    expect(result.mutations).toBe(0);
    const v = result.violations.find((x) => x.ruleId === 'SCHEMA-01');
    expect(v).toBeDefined();
    expect(v?.severity).toBe('error');
    expect(v?.message).toContain('command[0]');
    expect(v?.fixHint).toContain("op:'add-node'"); // points to the canonical shape
    expect(harness.getGraph().nodes.some((n) => n.uid === 'REQ-typo')).toBe(false);
  });

  it('one malformed command blocks the WHOLE batch (valid siblings not applied)', async () => {
    const result = await harness.mutate([...VALID, MALFORMED as unknown as MutateCommand]);
    expect(result.success).toBe(false);
    expect(result.tier).toBe('block');
    expect(harness.getGraph().nodes.some((n) => n.uid === 'REQ-ok')).toBe(false);
  });

  it('graph_mutate: no graphVersion bump, audit records result:"rejected"', async () => {
    const ok = await tools.graph_mutate.handler({ commands: VALID, consumerId: 'guard-test' });
    expect((ok as { graphVersion: number }).graphVersion).toBe(1);

    const bad = await tools.graph_mutate.handler({ commands: [MALFORMED], consumerId: 'guard-test' });
    expect((bad as { success: boolean }).success).toBe(false);
    expect((bad as { graphVersion: number }).graphVersion).toBe(1); // unchanged

    const { entries } = (await tools.audit_trail.handler({ consumerId: 'guard-test' })) as {
      entries: AuditEntry[];
    };
    const rejected = entries.filter((e) => e.result === 'rejected');
    expect(rejected.length).toBe(1);
    expect(rejected[0].graphVersion).toBe(1); // rejected entry never moves the version
  });

  it('canonical batches are regression-free (valid set still applies)', async () => {
    const result = await harness.mutate(VALID);
    expect(result.success).toBe(true);
    expect(result.mutations).toBe(3);
  });

  // CR-GC-524 (ITEM-2026-103): the exported snapshot flattens attributes, so the
  // nearest write shape after reading it is {uid, realRef:{...}} —
  // Zod strips the unknown key, the batch "applies" with 0 change and a
  // graphVersion bump. Unknown node fields must block as SCHEMA-01, not vanish.
  it('update-node with an unknown node field (flattened realRef) BLOCKS as SCHEMA-01', async () => {
    await harness.mutate(VALID);
    const before = harness.getGraph().nodes.find((n) => n.uid === 'REQ-ok');
    const flat = { op: 'update-node', node: { uid: 'REQ-ok', realRef: { file: 'src/x.ts', symbol: 'x' } } };
    const result = await harness.mutate([flat as unknown as MutateCommand]);
    expect(result.success).toBe(false);
    expect(result.tier).toBe('block');
    expect(result.mutations).toBe(0);
    const v = result.violations.find((x) => x.ruleId === 'SCHEMA-01');
    expect(v?.message).toContain('realRef');
    expect(v?.message).toContain('attributes');
    expect(harness.getGraph().nodes.find((n) => n.uid === 'REQ-ok')).toEqual(before);
  });

  it('add-node with an unknown node field BLOCKS as SCHEMA-01 (same guard, both ops)', async () => {
    const flat = { op: 'add-node', node: { uid: 'FUNC-x', type: 'FUNC', name: 'x', realRef: { file: 'a', symbol: 'b' } } };
    const result = await harness.mutate([flat as unknown as MutateCommand]);
    expect(result.success).toBe(false);
    expect(result.violations.some((x) => x.ruleId === 'SCHEMA-01' && x.message.includes('realRef'))).toBe(true);
  });

  it('update-node that changes nothing: 0 mutations, graphVersion stays, no export-pending', async () => {
    const ok = await tools.graph_mutate.handler({ commands: VALID, consumerId: 'guard-test' });
    expect((ok as { graphVersion: number }).graphVersion).toBe(1);
    const noop: MutateCommand = { op: 'update-node', node: { uid: 'REQ-ok', name: 'ok', attributes: {} } };
    const res = (await tools.graph_mutate.handler({ commands: [noop], consumerId: 'guard-test' })) as {
      success: boolean;
      mutations: number;
      graphVersion: number;
    };
    expect(res.success).toBe(true);
    expect(res.mutations).toBe(0);
    expect(res.graphVersion).toBe(1); // nothing happened → no progress reported
    // a real change still moves it
    const real = (await tools.graph_mutate.handler({
      commands: [{ op: 'update-node', node: { uid: 'REQ-ok', attributes: { realRef: { file: 'src/x.ts', symbol: 'x' } } } }],
      consumerId: 'guard-test',
    })) as { mutations: number; graphVersion: number };
    expect(real.mutations).toBe(1);
    expect(real.graphVersion).toBe(2);
  });
});

/**
 * CR-GC-646 (ITEM-2026-537): the element contract at the gate. `status`, `kinds`, `method`
 * live in the attribute bag but the rules read them as typed OntologyElement fields.
 * POSITIVKONTROLLE: without Step 0b the first two cases apply with success:true — the
 * dryRun in the item passed and only R-01 complained.
 */
describe('TEST-mutate-schema-guard: element contract (CR-GC-646)', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-guard-el-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
    tools = bindToolsToHarness(harness);
    await harness.mutate(VALID);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  const kindsOf = (uid: string) => harness.getGraph().nodes.find((n) => n.uid === uid)?.attributes?.kinds;

  it('Format-E `[kinds:functional]` (a string) BLOCKS as SCHEMA-02 and names field + value', async () => {
    const res = (await tools.graph_mutate.handler({
      formatE: '## Nodes\n### REQ\n+ REQ-str|Das System muss X. [kinds:functional]\n',
      consumerId: 't',
    })) as { success: boolean; violations: RuleViolation[] };
    expect(res.success).toBe(false);
    const v = res.violations.find((x) => x.ruleId === 'SCHEMA-02');
    expect(v?.severity).toBe('error');
    // The tool output folds the elementId into `{el}` (evaluation.ts ELEMENT_PLACEHOLDER) and lists it.
    expect(v?.message).toContain('.kinds = "functional"');
    expect(JSON.stringify(v)).toContain('REQ-str');
    expect(v?.fixHint).toContain('@kinds ["functional"]');
    expect(harness.getGraph().nodes.some((n) => n.uid === 'REQ-str')).toBe(false);
  });

  it('a status outside the contract (dropped) BLOCKS the whole batch', async () => {
    const result = await harness.mutate([
      { op: 'add-node', node: { uid: 'CR-x', type: 'CR', name: 'x', description: '', attributes: { status: 'dropped' } } },
      { op: 'update-node', node: { uid: 'REQ-ok', attributes: { status: 'approved' } } },
    ]);
    expect(result.success).toBe(false);
    expect(result.tier).toBe('block');
    const messages = result.violations.filter((x) => x.ruleId === 'SCHEMA-02').map((x) => x.message);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain('CR-x.status = "dropped"');
    expect(messages[1]).toContain('REQ-ok.status = "approved"');
  });

  it('an unknown kind and an unknown method block too — the enum is the contract, not just the shape', async () => {
    const result = await harness.mutate([
      { op: 'update-node', node: { uid: 'REQ-ok', attributes: { kinds: ['operational'] } } },
      { op: 'update-node', node: { uid: 'TEST-ok', attributes: { method: 'review' } } },
    ]);
    expect(result.success).toBe(false);
    expect(result.violations.filter((x) => x.ruleId === 'SCHEMA-02')).toHaveLength(2);
  });

  it('the canonical Format-E list form applies; null is the tombstone and passes', async () => {
    const res = (await tools.graph_mutate.handler({
      formatE: '## Nodes\n### REQ\n~ REQ-ok|ok\n@kinds ["functional"]\n',
      consumerId: 't',
    })) as { success: boolean; violations: RuleViolation[] };
    expect(res.success, JSON.stringify(res.violations)).toBe(true);
    expect(kindsOf('REQ-ok')).toEqual(['functional']);

    const cleared = await harness.mutate([{ op: 'update-node', node: { uid: 'REQ-ok', attributes: { kinds: null } } }]);
    expect(cleared.success, JSON.stringify(cleared.violations)).toBe(true);
  });

  it('a legacy value on a field the batch does NOT write never freezes the node', async () => {
    // Legacy data enters through the import port (a load, not an edit) — exactly how old SSOTs arrive.
    await harness.importGraph({
      elements: [{ id: 'REQ-leg', type: 'REQ', name: 'leg', description: '', kinds: 'functional' }],
      traces: [],
    });
    expect(kindsOf('REQ-leg')).toBe('functional');
    const result = await harness.mutate([{ op: 'update-node', node: { uid: 'REQ-leg', description: 'neu' } }]);
    expect(result.success, JSON.stringify(result.violations)).toBe(true);
  });
});
