/**
 * TEST-mutate-violations (CR-GC-309) — `graph_mutate` answers with a summary by
 * default; the one-pass apply the CR also proposed turned out to need no flag.
 *
 * `graph_mutate` echoed the whole `MutateResult`: every warning with its full
 * `context`, `candidate_targets` included. In the Graphview field test one answer
 * listed 39 candidates and two answers (70.3 KB / 64.9 KB) blew the tool-result
 * limit; across the run, mutate results were 189 KB of 929 KB of all tool output
 * (~20 %, ≈47k tokens) — and every one of them stays in each later cache read.
 *
 * It never showed up in the driver because the embedded executor truncates on its
 * own. That truncation is its own defect: a byte-slice cuts mid-JSON, so a local
 * model receives an unparseable blob instead of a violation it could act on.
 *
 * `rules_evaluate` / `rules_get_violations` keep full depth — they are the diagnosis
 * tools. That is query precision, not result compression: whoever needs
 * `candidate_targets` asks the tool whose job that is.
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

/** Adding a MOD with no allocated FUNC yields an R-23 warning that carries `context`. */
const ADD_MOD = [
  { op: 'add-node', node: { uid: 'MOD-neu', type: 'MOD', name: 'neu', description: 'Ein Modul.' } },
];

const BULK = 30;

/**
 * The field-test shape. A batch of lone REQs against a graph full of TESTs: each
 * REQ trips R-01, and every R-01 carries the ENTIRE TEST list as
 * `candidate_targets` — so the payload grows with batch × candidates. That
 * quadratic is what produced the 70.3 KB and 64.9 KB answers.
 *
 * The verdict is `block` (R-01 is an error), which is realistic: the blocked
 * batches were among the biggest answers in the run.
 */
function bulkyFixture(): { elements: unknown[]; traces: unknown[] } {
  const elements: unknown[] = [{ id: 'SYS-x', type: 'SYS', name: 'x', description: 'Ein System.' }];
  for (let i = 0; i < BULK; i++) {
    elements.push({ id: `TEST-kandidat-${i}`, type: 'TEST', name: `Kandidat ${i}`, description: '' });
  }
  return { elements, traces: [] };
}

/** One lone REQ per slot — each one an R-01 listing every TEST as a candidate. */
const BULKY_BATCH = Array.from({ length: BULK }, (_, i) => ({
  op: 'add-node',
  node: {
    uid: `REQ-offen-${i}`,
    type: 'REQ',
    name: `Offene Anforderung ${i}`,
    description: `Das System muss Sache ${i} innerhalb von 2 Sekunden bestaetigen und protokollieren.`,
  },
}));

type Violation = {
  ruleId: string;
  severity: string;
  message: string;
  elementId?: string;
  fixHint?: string;
  context?: unknown;
};

describe('TEST-mutate-violations: summary is the default (CR-GC-309)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-mutate-violations-'));
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

  it('drops `context` (and with it candidate_targets) by default', async () => {
    const res = await tools.graph_mutate.handler({ commands: ADD_MOD, consumerId: 't' });
    expect(res.violations.length).toBeGreaterThan(0);
    for (const v of res.violations as Violation[]) {
      expect(v.context, `${v.ruleId} must not carry context in a summary`).toBeUndefined();
    }
  });

  it('KEEPS fixHint — the driver reads it to repair a batch', async () => {
    // Non-negotiable: `formatGateFeedback` in the executor renders fixHint. Dropping
    // it to save bytes would turn a fixable violation into an opaque one.
    const res = await tools.graph_mutate.handler({ commands: ADD_MOD, consumerId: 't' });
    const withHint = (res.violations as Violation[]).filter((v) => v.fixHint !== undefined);
    expect(withHint.length).toBeGreaterThan(0);
  });

  it('keeps ruleId, severity, message and the affected uid', async () => {
    const res = await tools.graph_mutate.handler({ commands: ADD_MOD, consumerId: 't' });
    const v = (res.violations as Violation[])[0];
    expect(v.ruleId).toBeTruthy();
    expect(v.severity).toBeTruthy();
    expect(v.message).toBeTruthy();
    expect(v.elementId).toBe('MOD-neu');
  });

  it("violations: 'full' returns exactly today's payload, context included", async () => {
    const res = await tools.graph_mutate.handler({ commands: ADD_MOD, consumerId: 't', violations: 'full' });
    const withCtx = (res.violations as Violation[]).filter((v) => v.context !== undefined);
    expect(withCtx.length).toBeGreaterThan(0);
  });

  it('summary and full differ ONLY in context — same rules, same order, same hints', async () => {
    // The projection must not quietly drop or reorder findings; that would be a
    // different defect wearing the same fix.
    const full = await tools.graph_mutate.handler({ commands: ADD_MOD, consumerId: 't', violations: 'full', dryRun: true });
    const summary = await tools.graph_mutate.handler({ commands: ADD_MOD, consumerId: 't', dryRun: true });
    const strip = (vs: Violation[]) => vs.map(({ context: _c, ...rest }) => rest);
    expect(strip(summary.violations as Violation[])).toEqual(strip(full.violations as Violation[]));
  });

  it('dryRun is unchanged: steeringDelta present, nothing persisted', async () => {
    const before = harness.getGraph().nodes.length;
    const res = await tools.graph_mutate.handler({ commands: ADD_MOD, consumerId: 't', dryRun: true });
    expect(res.steeringDelta).toBeDefined();
    // `mutations` counts what the gate applied IN MEMORY before rolling back
    // (CR-GC-234) — the persistence claim has to be read off the graph, not off
    // that counter.
    expect(harness.getGraph().nodes.length).toBe(before);
  });
});

describe('TEST-mutate-violations: the payload actually shrinks (CR-GC-309)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-mutate-size-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(bulkyFixture());
    tools = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('a candidate_targets-heavy answer is far smaller with the default — measured, not estimated', async () => {
    const full = await tools.graph_mutate.handler({
      commands: BULKY_BATCH,
      consumerId: 't',
      violations: 'full',
      dryRun: true,
    });
    const summary = await tools.graph_mutate.handler({ commands: BULKY_BATCH, consumerId: 't', dryRun: true });
    const fullBytes = JSON.stringify(full).length;
    const summaryBytes = JSON.stringify(summary).length;
    // The fixture must really be at field-test scale, or the ratio below proves
    // nothing. Measured on this fixture: 60.6 KB → 10.7 KB (5.7×, 82 % less).
    expect(fullBytes).toBeGreaterThan(50_000);
    expect(summaryBytes).toBeLessThan(fullBytes / 5);
    // The residual is the irreducible part: one message + one fixHint per finding.
    // It grows LINEARLY with the batch while `candidate_targets` grows quadratically,
    // which is why the ratio improves with size (measured 5.7× at 30 commands,
    // 9.7× at 60). Bounded here so a future regression that re-inflates the
    // per-violation payload is caught, not just the context removal.
    expect(summaryBytes).toBeLessThan(13_000);
  });

  it('rules_get_violations still returns full depth — the diagnosis tool is untouched', async () => {
    const res = (await tools.rules_get_violations.handler({})) as { violations: Violation[] };
    expect(res.violations.some((v) => v.context !== undefined)).toBe(true);
  });
});

describe('TEST-mutate-violations: the second dryRun pass is already redundant (CR-GC-309)', () => {
  // CR-GC-309 proposed `applyIf: 'not-blocked'` so a single-alternative batch would
  // not have to go over the wire twice (dryRun, then apply). It was NOT added: the
  // gate already behaves that way. `tier: 'block'` is set only on the reject paths,
  // which persist nothing (harness.ts — the success path can only ever assign
  // 'suggest' or 'auto-apply'). A flag whose two values behave identically is a
  // parallel path with no semantic content.
  //
  // What the flag was meant to guarantee is real, though, so it is pinned HERE
  // instead — as the invariant that makes the second pass unnecessary.
  let tmp: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-mutate-onepass-'));
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

  it('a blocked batch persists NOTHING in a single direct call — no dry run needed first', async () => {
    const before = harness.getGraph().nodes.length;
    const res = await tools.graph_mutate.handler({
      commands: [
        { op: 'add-node', node: { uid: 'REQ-allein', type: 'REQ', name: 'Allein', description: 'Ohne Test.' } },
      ],
      consumerId: 't',
    });
    expect(res.tier).toBe('block');
    expect(res.success).toBe(false);
    expect(res.mutations).toBe(0);
    expect(harness.getGraph().nodes.length).toBe(before);
    expect(harness.getGraph().nodes.some((n) => n.uid === 'REQ-allein')).toBe(false);
  });

  it('a clean batch applies in that same single call', async () => {
    const res = await tools.graph_mutate.handler({ commands: ADD_MOD, consumerId: 't' });
    expect(res.success).toBe(true);
    expect(res.mutations).toBeGreaterThan(0);
    expect(harness.getGraph().nodes.some((n) => n.uid === 'MOD-neu')).toBe(true);
  });

  it("tier 'block' and non-persistence are the SAME condition — never one without the other", async () => {
    // If a future change ever let a `block` verdict write, the redundancy argument
    // above collapses and `applyIf` would become necessary. This is the tripwire.
    const before = harness.getGraph().nodes.length;
    const blocked = await tools.graph_mutate.handler({
      commands: [
        { op: 'add-node', node: { uid: 'REQ-zwei', type: 'REQ', name: 'Zwei', description: 'Auch ohne Test.' } },
      ],
      consumerId: 't',
    });
    const persisted = harness.getGraph().nodes.length > before;
    expect(blocked.tier === 'block').toBe(!persisted);
  });
});
