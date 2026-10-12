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
import { alsFormatE } from './helpers/format-e.js';
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
    // CR-GC-686: the hint leads with the preferred path — Format-E — before the JSON shapes.
    expect(v?.fixHint).toMatch(/^Prefer formatE/);
    expect(v?.fixHint).toContain('## Nodes');
    expect(v?.fixHint).toContain('### <TYPE>');
    expect(v?.fixHint).toContain('## Edges');
    expect(harness.getGraph().nodes.some((n) => n.uid === 'REQ-typo')).toBe(false);
  });

  it('one malformed command blocks the WHOLE batch (valid siblings not applied)', async () => {
    const result = await harness.mutate([...VALID, MALFORMED as unknown as MutateCommand]);
    expect(result.success).toBe(false);
    expect(result.tier).toBe('block');
    expect(harness.getGraph().nodes.some((n) => n.uid === 'REQ-ok')).toBe(false);
  });

  it('graph_mutate: no graphVersion bump, audit records result:"rejected"', async () => {
    const ok = await tools.graph_mutate.handler({ formatE: alsFormatE(VALID, harness), consumerId: 'guard-test' });
    expect((ok as { graphVersion: number }).graphVersion).toBe(1);

    const bad = await tools.graph_mutate.handler({ formatE: alsFormatE([MALFORMED], harness), consumerId: 'guard-test' });
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
    const ok = await tools.graph_mutate.handler({ formatE: alsFormatE(VALID, harness), consumerId: 'guard-test' });
    expect((ok as { graphVersion: number }).graphVersion).toBe(1);
    const noop: MutateCommand = { op: 'update-node', node: { uid: 'REQ-ok', name: 'ok', attributes: {} } };
    const res = (await tools.graph_mutate.handler({ formatE: alsFormatE([noop], harness), consumerId: 'guard-test' })) as {
      success: boolean;
      mutations: number;
      graphVersion: number;
    };
    expect(res.success).toBe(true);
    expect(res.mutations).toBe(0);
    expect(res.graphVersion).toBe(1); // nothing happened → no progress reported
    // a real change still moves it
    const real = (await tools.graph_mutate.handler({
      formatE: alsFormatE([{ op: 'update-node', node: { uid: 'REQ-ok', attributes: { realRef: { file: 'src/x.ts', symbol: 'x' } } } }], harness),
      consumerId: 'guard-test',
    })) as { mutations: number; graphVersion: number };
    expect(real.mutations).toBe(1);
    expect(real.graphVersion).toBe(2);
  });
});

/**
 * The element contract at the gate (CR-GC-646, ITEM-2026-537; since CR-GC-786 judged by rule R-08).
 * `status`, `kinds`, `method` live in the attribute bag but the rules read them as typed
 * OntologyElement fields. Until CR-GC-786 a local check (`SCHEMA-02`) judged what a batch writes;
 * now R-08 (contracts 12.5, CR-SM-411) judges the state, and the gate blocks what a move newly
 * introduces. POSITIVKONTROLLE: against contracts < 12.5 (R-08 without the second case) every
 * blocking case below applies with success:true.
 */
describe('TEST-mutate-schema-guard: element contract (CR-GC-646, R-08 since CR-GC-786)', () => {
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

  const r08 = (violations: RuleViolation[]) => violations.filter((x) => x.ruleId === 'R-08');

  // CR-GC-786, vom Auftraggeber so gewollt: `[kinds:functional]` ist die Schreibform von Format-E.
  // Der Schreibpfad hebt sie zur Liste (apply-commands.ts, CR-GC-551); im Store steht nie ein String.
  // Bis CR-GC-786 wies `SCHEMA-02` den Zug ab.
  it('Format-E `[kinds:functional]` (a string) applies and lands as a LIST in the store', async () => {
    const res = (await tools.graph_mutate.handler({
      formatE:
        '## Nodes\n### REQ\n+ REQ-str|Das System muss X. [kinds:functional]\n### TEST\n+ TEST-str|prueft X\n' +
        '## Edges\n+ TEST-str -verify-> REQ-str\n',
      consumerId: 't',
    })) as { success: boolean; violations: RuleViolation[] };
    expect(res.success, JSON.stringify(res.violations)).toBe(true);
    expect(r08(res.violations)).toEqual([]);
    expect(kindsOf('REQ-str')).toEqual(['functional']);
  });

  it('a status outside the contract (dropped) BLOCKS the whole batch with R-08', async () => {
    const result = await harness.mutate([
      { op: 'add-node', node: { uid: 'CR-x', type: 'CR', name: 'x', description: '', attributes: { status: 'dropped' } } },
      { op: 'update-node', node: { uid: 'REQ-ok', attributes: { status: 'approved' } } },
    ]);
    expect(result.success).toBe(false);
    expect(result.tier).toBe('block');
    const messages = r08(result.violations).map((x) => x.message);
    expect(messages).toHaveLength(2);
    expect(messages).toContain('CR-x.status = "dropped" is outside the element contract');
    expect(messages).toContain('REQ-ok.status = "approved" is outside the element contract');
    expect(r08(result.violations)[0].severity).toBe('error');
    expect(harness.getGraph().nodes.some((n) => n.uid === 'CR-x')).toBe(false);
    expect(harness.getGraph().nodes.find((n) => n.uid === 'REQ-ok')?.attributes?.status).toBeUndefined();
  });

  it('an unknown kind and an unknown method block too — the enum is the contract, not just the shape', async () => {
    const result = await harness.mutate([
      { op: 'update-node', node: { uid: 'REQ-ok', attributes: { kinds: ['operational'] } } },
      { op: 'update-node', node: { uid: 'TEST-ok', attributes: { method: 'review' } } },
    ]);
    expect(result.success).toBe(false);
    expect(r08(result.violations).map((x) => x.elementId).sort()).toEqual(['REQ-ok', 'TEST-ok']);
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

  it('legacy data on an untouched element never freezes the node — nor its neighbours', async () => {
    // Legacy data enters through the import port (a load, not an edit) — exactly how old SSOTs arrive.
    await harness.importGraph({
      elements: [{ id: 'REQ-leg', type: 'REQ', name: 'leg', description: '', kinds: ['risk'] }],
      traces: [],
    } as Parameters<typeof harness.importGraph>[0]);
    expect(kindsOf('REQ-leg')).toEqual(['risk']);
    // The legacy finding is there (R-08 reports the state) …
    expect(harness.evaluateRules().filter((v) => v.ruleId === 'R-08').map((v) => v.message)).toEqual([
      'REQ-leg.kinds = ["risk"] is outside the element contract',
    ]);
    // … and blocks neither a move on the node itself nor one elsewhere: it is not NEW.
    const self = await harness.mutate([{ op: 'update-node', node: { uid: 'REQ-leg', description: 'neu' } }]);
    expect(self.success, JSON.stringify(self.violations)).toBe(true);
    // (the import replaced the state, so the neighbour move brings its own valid set)
    const other = await harness.mutate(VALID);
    expect(other.success, JSON.stringify(other.violations)).toBe(true);
  });

  // ITEM-2026-570 / CR-GC-786: die Probe einer Migration auf Altbestand wirft nicht und der
  // Steuerraum ist GERECHNET — das Delta zeigt den Befund, den die Migration schliesst.
  // POSITIVKONTROLLE: mit `SteeringSnapshotSchema.parse` in der Messung wirft dieser Fall (ZodError).
  it('dryRun on legacy data returns the verdict and a steering delta that shows the migration', async () => {
    await harness.importGraph({
      elements: [{ id: 'CR-leg', type: 'CR', name: 'leg', description: '', status: 'dropped' }],
      traces: [],
    } as Parameters<typeof harness.importGraph>[0]);
    const res = (await tools.graph_mutate.handler({
      formatE: alsFormatE([{ op: 'update-node', node: { uid: 'CR-leg', attributes: { status: 'done' } } }], harness),
      consumerId: 't',
      dryRun: true,
    })) as { success: boolean; steeringDelta?: { blockingErrors: { before: number; after: number }; stages: Record<string, { before: number; after: number }> } };
    expect(res.success).toBe(true);
    expect(res.steeringDelta?.blockingErrors).toEqual({ before: 1, after: 0 });
    expect(res.steeringDelta?.stages.immer).toMatchObject({ before: 1, after: 0 });
    expect(res).not.toHaveProperty('steeringUnmeasurable');
  });

  // CR-GC-671: der Ontologie-Major (contracts 10.x, CR-SM-365/366). risk/mitigation/pre/post
  // sind keine kinds mehr; die Rolle ist ein REQ-Attribut mit EINEM Leser (readReqRole).
  // POSITIVKONTROLLE: ohne den role-Zweig in R-08 (contracts `elementContract`) geht `role:"hazard"` durch
  // (success:true) — die FM-Regeln saehen die Rolle dann still nicht.
  it('an old kind (risk) blocks, and the hint names role instead', async () => {
    const res = await harness.mutate([{ op: 'update-node', node: { uid: 'REQ-ok', attributes: { kinds: ['risk'] } } }]);
    expect(res.success).toBe(false);
    const v = r08(res.violations)[0];
    expect(v?.message).toBe('REQ-ok.kinds = ["risk"] is outside the element contract');
    expect(v?.fixHint).toContain('kinds ∈ functional|non-functional');
    expect(v?.fixHint).toContain('risk|mitigation is REQ.attributes.role');
    expect(v?.fixHint).not.toMatch(/precondition|postcondition/);
  });

  it('a REQ role outside risk|mitigation blocks — on update-node without type, too', async () => {
    const res = await harness.mutate([{ op: 'update-node', node: { uid: 'REQ-ok', attributes: { role: 'hazard' } } }]);
    expect(res.success).toBe(false);
    expect(r08(res.violations)[0]?.message).toBe('REQ-ok.role = "hazard" is outside the element contract');
  });

  it('a valid role passes and persists; a foreign node with its own role attribute is not judged', async () => {
    const ok = await harness.mutate([
      { op: 'update-node', node: { uid: 'REQ-ok', attributes: { kinds: ['non-functional'], role: 'mitigation' } } },
      { op: 'add-node', node: { uid: 'CR-t', type: 'CR', name: 't', description: '', attributes: { role: 'decision' } } },
    ]);
    expect(ok.success, JSON.stringify(ok.violations)).toBe(true);
    expect(harness.getGraph().nodes.find((n) => n.uid === 'REQ-ok')?.attributes).toMatchObject({ role: 'mitigation' });
    const cleared = await harness.mutate([{ op: 'update-node', node: { uid: 'REQ-ok', attributes: { role: null } } }]);
    expect(cleared.success, JSON.stringify(cleared.violations)).toBe(true);
  });
});
