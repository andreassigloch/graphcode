/**
 * CR-GC-684 — graph_suggest wendet add-node-Vorschlaege als EIN Batch an.
 *
 * Seit se-engine CR-SM-367/356 kennt `SuggestedEdit` die Form `op:'add-node'`: ein neuer Knoten
 * (`node`) samt den Kanten, die ihn einbinden (`edges`), optional die Kanten, die im selben Zug
 * weichen (`retires`, die RD-04-Zwischenebene). `source/target/type` spiegeln `edges[0]`. Ein
 * Konsument, der die Form nicht kennt, uebersetzt den Zug in ein nacktes `add-edge` auf einen
 * Knoten, den es noch nicht gibt — das Gate lehnt ab, der Vorschlag ist nie anwendbar.
 *
 * DREI NACHWEISE, am echten Gate mit Disk-Kuzu (nie :memory:):
 *
 *   1. DIE UEBERSETZUNG — `batchFor` liefert `[add-node, ...delete-edge(retires), ...add-edge(edges)]`.
 *      Rot vor CR-GC-684: nur das gespiegelte `add-edge(edges[0])`.
 *   2. R-32 — `graph_suggest` liefert den TEST-Knoten + verify als anwendbaren Zug; angewandt ist
 *      der Befund am SCHEMA weg.
 *   3. RD-04 — die Zwischenebene (add-node + retires) passiert das Gate, der Steuerwert sinkt
 *      (`score = steer.improvement > 0`); angewandt feuert RD-04 am Eltern nicht mehr.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { SuggestedEdit } from '@sigloch/se-engine';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness, bindToolsWithContext } from '../src/surface/mcp-tools.js';
import type { AuditEntry } from '@sigloch/graph-api-core';
import type { TrajectoryStamps } from '../src/projections/trajectory.js';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';
import { makeSteeringConfig, type FixtureGraph } from './fixtures/steering-graphs.js';
import { batchFor, type GraphSuggestResult } from '../src/loop/suggest.js';

interface Rig {
  tmp: string;
  harness: GraphCodeHarness;
  tools: MCPToolRegistry;
}

async function makeRig(fixture: FixtureGraph): Promise<Rig> {
  const tmp = mkdtempSync(join(tmpdir(), 'graphcode-addnode-'));
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
  const harness = new GraphCodeHarness(makeSteeringConfig(tmp), storage);
  await harness.initialize();
  await harness.importGraph(fixture);
  return { tmp, harness, tools: bindToolsToHarness(harness) };
}

async function dropRig(rig: Rig): Promise<void> {
  await rig.harness.close();
  rmSync(rig.tmp, { recursive: true, force: true });
}

const realRef = { file: 'tests/fixtures/steering-graphs.ts', symbol: 'FixtureGraph', lang: 'ts' };

/**
 * R-32: ein realisierter SCHEMA ohne Vertragstest (Fixture aus se-engine CR-SM-367), daneben ein
 * zweiter mit Vertragstest. Der zweite ist kein Zierrat: se-engine `suggestEdits` nimmt einen
 * Operator-Befund nur auf, wenn die generische Sonde (`applyRule`, EINE Kante zwischen
 * BESTEHENDEN Knoten) greift — ohne irgendeinen TEST im Graphen fiele der R-32-Befund dort
 * heraus, bevor die add-node-Vorlage gefragt wird (Befund an se-engine, nicht hier zu heilen).
 */
const R32_FIXTURE: FixtureGraph = {
  elements: [
    { id: 'SCHEMA-order', type: 'SCHEMA', name: 'Order', description: 'Vertrag einer Bestellung.', realRef },
    { id: 'FLOW-order', type: 'FLOW', name: 'order', description: 'Die Bestellung.' },
    { id: 'SCHEMA-invoice', type: 'SCHEMA', name: 'Invoice', description: 'Vertrag einer Rechnung.', realRef },
    { id: 'FLOW-invoice', type: 'FLOW', name: 'invoice', description: 'Die Rechnung.' },
    { id: 'TEST-invoice-contract', type: 'TEST', name: 'Vertragstest Invoice', description: 'Prueft jede Variante von SCHEMA-invoice.' },
  ],
  traces: [
    { source: 'FLOW-order', target: 'SCHEMA-order', type: 'relation' },
    { source: 'FLOW-invoice', target: 'SCHEMA-invoice', type: 'relation' },
    { source: 'TEST-invoice-contract', target: 'SCHEMA-invoice', type: 'verify' },
  ],
};

/** RD-04: `FUNC-P` hat zehn Kinder; vier reichen einander Daten weiter, sechs sind stumm. */
function rd04Fixture(): FixtureGraph {
  const kids = Array.from({ length: 10 }, (_, i) => `FUNC-c${i}`);
  const elements: FixtureGraph['elements'] = [
    { id: 'FUNC-P', type: 'FUNC', name: 'P', description: 'Eltern mit zu vielen Kindern.' },
    ...kids.map((id) => ({ id, type: 'FUNC', name: id, description: `Kind ${id}.` })),
  ];
  const traces: FixtureGraph['traces'] = kids.map((c) => ({ source: 'FUNC-P', target: c, type: 'compose' }));
  for (let i = 0; i < 3; i++) {
    const flow = `FLOW-k${i}`;
    const schema = `SCHEMA-k${i}`;
    elements.push(
      { id: flow, type: 'FLOW', name: flow, description: `Uebergabe ${i}.` },
      { id: schema, type: 'SCHEMA', name: schema, description: `Vertrag ${i}.` },
    );
    traces.push(
      { source: `FUNC-c${i}`, target: flow, type: 'io' },
      { source: flow, target: `FUNC-c${i + 1}`, type: 'io' },
      { source: flow, target: schema, type: 'relation' },
    );
  }
  return { elements, traces };
}

const has = (rig: Rig, ruleId: string, elementId: string) =>
  rig.harness.evaluateRules().some((v) => v.ruleId === ruleId && v.elementId === elementId);

describe('CR-GC-684: batchFor uebersetzt add-node als EIN Batch', () => {
  it('[add-node, ...delete-edge(retires), ...add-edge(edges)] — nicht das gespiegelte add-edge(edges[0])', () => {
    const edit: SuggestedEdit = {
      op: 'add-node',
      source: 'FUNC-P', target: 'FUNC-mid', type: 'compose',
      rationale: 'x',
      node: { uid: 'FUNC-mid', type: 'FUNC', name: 'mid', description: 'Zwischenebene.' },
      edges: [
        { source: 'FUNC-P', target: 'FUNC-mid', type: 'compose' },
        { source: 'FUNC-mid', target: 'FUNC-c0', type: 'compose' },
      ],
      retires: [{ source: 'FUNC-P', target: 'FUNC-c0', type: 'compose', rationale: 'umgehaengt' }],
    };
    expect(batchFor(edit)).toEqual([
      { op: 'add-node', node: { uid: 'FUNC-mid', type: 'FUNC', name: 'mid', description: 'Zwischenebene.', attributes: {} } },
      { op: 'delete-edge', edge: { sourceId: 'FUNC-P', targetId: 'FUNC-c0', edgeType: 'compose' } },
      { op: 'add-edge', edge: { sourceId: 'FUNC-P', targetId: 'FUNC-mid', edgeType: 'compose', attributes: {} } },
      { op: 'add-edge', edge: { sourceId: 'FUNC-mid', targetId: 'FUNC-c0', edgeType: 'compose', attributes: {} } },
    ]);
  });
});

describe('CR-GC-684: add-node-Vorschlaege am echten Gate', () => {
  it('R-32: graph_suggest liefert TEST-Knoten + verify als anwendbaren Batch; angewandt ist der Befund weg', async () => {
    const rig = await makeRig(R32_FIXTURE);
    try {
      expect(has(rig, 'R-32', 'SCHEMA-order'), 'R-32 feuert am Fixture nicht').toBe(true);
      const res = (await rig.tools.graph_suggest.handler({ k: 20, layer: 'all' })) as GraphSuggestResult;
      const s = res.suggestions.find((x) => x.ruleId === 'R-32' && x.elementId === 'SCHEMA-order');
      expect(s?.edit?.op).toBe('add-node');
      expect(
        s?.applicable,
        `Gate wies den Zug ab: ${s?.verdict?.violations.map((v) => `${v.ruleId}: ${v.message}`).join(' | ')}`,
      ).toBe(true);

      const applied = await rig.harness.mutate(batchFor(s!.edit!));
      expect(applied.success).toBe(true);
      await rig.harness.loadGraph();
      expect(rig.harness.getGraph().nodes.some((n) => n.uid === s!.edit!.node!.uid)).toBe(true);
      expect(has(rig, 'R-32', 'SCHEMA-order')).toBe(false);
    } finally {
      await dropRig(rig);
    }
  }, 120_000);

  it('RD-04: Zwischenebene (add-node + retires) passiert das Gate und senkt den Steuerwert', async () => {
    const rig = await makeRig(rd04Fixture());
    try {
      expect(has(rig, 'RD-04', 'FUNC-P'), 'RD-04 feuert am Fixture nicht').toBe(true);
      const res = (await rig.tools.graph_suggest.handler({ k: 20, layer: 'all' })) as GraphSuggestResult;
      const s = res.suggestions.find((x) => x.ruleId === 'RD-04' && x.elementId === 'FUNC-P');
      expect(s?.edit?.op).toBe('add-node');
      expect(s?.edit?.retires?.length).toBeGreaterThan(0);
      expect(
        s?.applicable,
        `Gate wies den Zug ab: ${s?.verdict?.violations.map((v) => `${v.ruleId}: ${v.message}`).join(' | ')}`,
      ).toBe(true);
      expect(s!.verdict!.steer!.improvement).toBeGreaterThan(0);
      expect(s!.score).toBe(s!.verdict!.steer!.improvement);

      const applied = await rig.harness.mutate(batchFor(s!.edit!));
      expect(applied.success).toBe(true);
      await rig.harness.loadGraph();
      expect(has(rig, 'RD-04', 'FUNC-P')).toBe(false);
      // Jedes umgehaengte Kind hat genau EINEN compose-Elternteil — aus dem Store gelesen.
      for (const r of s!.edit!.retires!) {
        const parents = rig.harness.getGraph().edges.filter((e) => e.edgeType === 'compose' && e.targetId === r.target);
        expect(parents.map((e) => e.sourceId)).toEqual([s!.edit!.node!.uid]);
      }
    } finally {
      await dropRig(rig);
    }
  }, 120_000);
});

describe('CR-GC-696C: der angewandte add-node-Batch zaehlt als gelieferte Vorlage', () => {
  it('RD-04: add-node + retires + edges, exakt wie geliefert angewandt → editSource suggestion-template', async () => {
    const rig = await makeRig(rd04Fixture());
    try {
      const { registry, ctx } = bindToolsWithContext(rig.harness);
      const res = (await registry.graph_suggest.handler({ k: 20, layer: 'all' })) as GraphSuggestResult;
      const s = res.suggestions.find((x) => x.ruleId === 'RD-04' && x.elementId === 'FUNC-P' && x.applicable);
      expect(s?.edit?.op).toBe('add-node');
      expect(s?.edit?.retires?.length).toBeGreaterThan(0);

      const batch = batchFor(s!.edit!);
      const out = (await registry.graph_mutate.handler({ commands: batch, consumerId: 'stamps-test' })) as { success: boolean };
      expect(out.success).toBe(true);
      const entries = (await ctx.auditLog.query({})) as Array<AuditEntry & TrajectoryStamps>;
      // Rot vor CR-GC-696C: gemerkt war nur die gespiegelte Kante, add-node und delete-edge
      // fielen durch — der gelieferte Zug galt als eigene Formulierung.
      expect(entries[entries.length - 1].editSource).toBe('suggestion-template');

      // Gegenprobe: eine eigene Formulierung danach bleibt authored.
      const fremd = (await registry.graph_mutate.handler({
        commands: [{ op: 'add-node', node: { uid: 'REQ-fremd', type: 'REQ', name: 'fremd', description: '', attributes: {} } },
          { op: 'add-node', node: { uid: 'TEST-fremd', type: 'TEST', name: 'fremd', description: '', attributes: {} } },
          { op: 'add-edge', edge: { sourceId: 'TEST-fremd', targetId: 'REQ-fremd', edgeType: 'verify', attributes: {} } }],
        consumerId: 'stamps-test',
      })) as { success: boolean };
      expect(fremd.success).toBe(true);
      const after = (await ctx.auditLog.query({})) as Array<AuditEntry & TrajectoryStamps>;
      expect(after[after.length - 1].editSource).toBe('authored');
    } finally {
      await dropRig(rig);
    }
  }, 120_000);
});
