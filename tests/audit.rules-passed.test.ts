/**
 * TEST-audit-rules-passed (CR-GC-314) — the audit trail records the POSITIVE half.
 *
 * `violations` has always held what went wrong. What a mutation CONFIRMED was nowhere:
 * an accepted mutation left an empty field, and "R-18 checked this edit and passed it"
 * cannot be recovered from "no violation". A learning mechanism can use the first
 * statement and nothing at all from the second — that asymmetry is the whole CR.
 *
 * Two assertions carry the weight, and neither is about the happy path:
 *   - `audit_trail` must NOT hand the field to an agent by default (REQ-A06): it is ~60
 *     rule ids per entry, written for a file reader. The default answer has to stay
 *     byte-identical to before the CR.
 *   - an entry WITHOUT the field means "not recorded", never "passed nothing" (REQ-A05).
 *     Absence and emptiness must stay distinguishable, or old records silently read as
 *     total failure.
 *
 * Real disk Kuzu (temp dir, never :memory:). No mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { RULES_VERSION } from '@sigloch/contracts/se';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness, type MCPToolRegistry } from '../src/mcp-tools.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

/** A MOD with no allocated FUNC — trips R-23, so exactly one rule has a finding. */
const ADD_MOD = [
  { op: 'add-node', node: { uid: 'MOD-neu', type: 'MOD', name: 'neu', description: 'Ein Modul.' } },
];

type Entry = {
  operation: string;
  result: string;
  violations?: Array<{ ruleId: string }>;
  rulesPassed?: string[];
  rulesetVersion?: string;
};

describe('TEST-audit-rules-passed (CR-GC-314): the positive half is recorded', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-rules-passed-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph({
      elements: [{ id: 'SYS-x', type: 'SYS', name: 'x', description: 'Ein System.' }],
      traces: [],
    });
    tools = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  /** Read the raw log, bypassing the tool's REQ-A06 projection. */
  async function rawEntries(): Promise<Entry[]> {
    return (await tools.audit_trail.handler({ includeRulesPassed: true })) .entries as Entry[];
  }

  it('records the rules that ran without a finding', async () => {
    await tools.graph_mutate.handler({ commands: ADD_MOD, consumerId: 't' });
    const [entry] = await rawEntries();

    expect(entry.rulesPassed, 'positive half missing').toBeDefined();
    expect(entry.rulesPassed!.length).toBeGreaterThan(0);
  });

  it('is exactly complementary to violations — the two halves are the full finding', async () => {
    const res = await tools.graph_mutate.handler({ commands: ADD_MOD, consumerId: 't' });
    const [entry] = await rawEntries();

    const fired = new Set((res.violations as Array<{ ruleId: string }>).map((v) => v.ruleId));
    const registered = (SE_DESCRIPTOR.rules ?? []).map((r) => r.id);

    expect(entry.rulesPassed!.sort()).toEqual(registered.filter((id) => !fired.has(id)).sort());
    // No rule may appear on both sides — that would make the record self-contradictory.
    for (const id of entry.rulesPassed!) expect(fired.has(id)).toBe(false);
  });

  it('carries the rule-set version from the loaded package (REQ-A02)', async () => {
    await tools.graph_mutate.handler({ commands: ADD_MOD, consumerId: 't' });
    const [entry] = await rawEntries();
    expect(entry.rulesetVersion).toBe(RULES_VERSION);
  });

  it('records it for a rejected mutation too — a block is also evidence', async () => {
    // A blocked batch says just as much about which rules looked and were satisfied.
    const res = await tools.graph_mutate.handler({
      commands: [{ op: 'add-edge', edge: { sourceId: 'SYS-x', targetId: 'SYS-x', edgeType: 'verify' } }],
      consumerId: 't',
    });
    expect(res.success).toBe(false);

    const [entry] = await rawEntries();
    expect(entry.result).toBe('rejected');
    expect(entry.rulesPassed).toBeDefined();
  });

  it('records it on a dryRun preview (recordPreview writes the same halves)', async () => {
    await tools.graph_mutate.handler({ commands: ADD_MOD, consumerId: 't', dryRun: true });
    const [entry] = await rawEntries();
    expect(entry.operation).toBe('validate');
    expect(entry.rulesPassed).toBeDefined();
  });

  // -- REQ-A06: the agent payload must not grow ------------------------------

  it('WITHHOLDS rulesPassed from audit_trail by default', async () => {
    // The load-bearing one. ~60 rule ids per entry × the default limit of 50 would put a
    // five-figure token block into an agent's context for a field it has no use for.
    await tools.graph_mutate.handler({ commands: ADD_MOD, consumerId: 't' });
    const { entries } = await tools.audit_trail.handler({});

    for (const e of entries as Entry[]) {
      expect(e).not.toHaveProperty('rulesPassed');
    }
  });

  it('withholds by ABSENCE, not by an empty array (REQ-A05)', async () => {
    // An empty array would read as "nothing passed" — the exact opposite of the truth.
    // Absence is the only honest way to say "not included here".
    await tools.graph_mutate.handler({ commands: ADD_MOD, consumerId: 't' });
    const { entries } = await tools.audit_trail.handler({});
    const e = (entries as Entry[])[0];

    expect(e.rulesPassed).toBeUndefined();
    expect(Object.keys(e)).not.toContain('rulesPassed');
    // The finding itself stays — withholding the positive half must not cost the negative.
    expect(e.violations).toBeDefined();
    // `rulesetVersion` travels WITH `rulesPassed` since CR-GC-319: both describe the rule
    // set rather than what happened, and both address the learning consumer. It is on the
    // record (asserted above), just not in the default answer.
    expect(e.rulesetVersion).toBeUndefined();
  });

  it('hands it over when explicitly asked', async () => {
    await tools.graph_mutate.handler({ commands: ADD_MOD, consumerId: 't' });
    const { entries } = await tools.audit_trail.handler({ includeRulesPassed: true });
    expect((entries as Entry[])[0].rulesPassed).toBeDefined();
  });
});
