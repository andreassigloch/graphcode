/**
 * CR-GC-444 — der Konsolidierungs-Operator: der Vorschlagspfad kann mergen.
 *
 * Das Gate beherrscht `merge-nodes` seit CR-196; der VORSCHLAGSPFAD kannte es
 * nicht. Seit se-engine 1.4.0 (additiv, CR-SM-277) trägt `SuggestedEdit` die
 * Merge-Ausdrucksform — `op:'merge-nodes'` plus die GEKOPPELTEN `merges` —, und
 * `graph_suggest` schickt genau diesen Verbund als EINEN Batch durch den
 * Gate-dryRun.
 *
 * Die Kopplung ist keine Konvention: `FLOW -relation-> SCHEMA` ist seit
 * contracts 10.0.0 `1..1` (drittes R-18-Bein). Ein zusammengelegter FLOW mit
 * zwei SCHEMAs wird abgewiesen — in CR-GC-438 Kill 2 gemessen (5 FLOWs mit
 * > 1 SCHEMA, Zug tot).
 *
 * DREI NACHWEISE, die ersten beiden am echten Gate mit Disk-Kuzu (nie :memory:):
 *
 *   1. ROT-ZUERST — `merge-nodes(FLOW→FLOW)` ALLEIN blockt mit R-18.
 *   2. ATOMARITÄT + STORE-RÜCKLESE — der Verbund [FLOW-Merge, SCHEMA-Merge]
 *      kommt durch, und AUS DEM STORE zurückgelesen (nicht aus der
 *      Arbeitskopie) steht genau ein FLOW mit genau einem SCHEMA, die
 *      weichenden Knoten sind weg, die io-Kanten sind umgehängt. Damit ist
 *      belegt, dass der Merge-Batch NICHT in den bekannten persist-Fallstrick
 *      läuft (delete+add derselben uid in EINEM Batch — deletes laufen zuletzt).
 *   3. DER REPO-GRAPH — `graph_suggest` liefert auf docs/graph/
 *      graphcode.graph.json Merge-Vorschläge mit `applicable: true`.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness, type MCPToolRegistry } from '../src/surface/mcp-tools.js';
import { makeSteeringConfig, type FixtureGraph } from './fixtures/steering-graphs.js';
import type { GraphSuggestResult } from '../src/loop/suggest.js';

/**
 * Zwei FLOWs zwischen denselben Funktionen, jeder mit EIGENEM Vertrag — der
 * Fall, an dem sich die Kopplung entscheidet. Bewusst lokal und minimal: die
 * bestehenden Fixtures tragen absichtlich vertragslose FLOWs (SC-02-Funde), und
 * ein Merge-Nachweis braucht das Gegenteil.
 */
const MERGE_FIXTURE: FixtureGraph = {
  elements: [
    { id: 'FUNC-produce', type: 'FUNC', name: 'produce()', description: 'Erzeugt beide Ergebnisflüsse.' },
    { id: 'FUNC-consume-a', type: 'FUNC', name: 'consumeA()', description: 'Liest das erste Ergebnis.' },
    { id: 'FUNC-consume-b', type: 'FUNC', name: 'consumeB()', description: 'Liest das zweite Ergebnis.' },
    { id: 'FLOW-a', type: 'FLOW', name: 'result a', description: 'Das erste Ergebnis.' },
    { id: 'FLOW-b', type: 'FLOW', name: 'result b', description: 'Das zweite Ergebnis.' },
    { id: 'SCHEMA-a', type: 'SCHEMA', name: 'ResultA', description: 'Vertrag des ersten Ergebnisses.' },
    { id: 'SCHEMA-b', type: 'SCHEMA', name: 'ResultB', description: 'Vertrag des zweiten Ergebnisses.' },
  ],
  traces: [
    { source: 'FUNC-produce', target: 'FLOW-a', type: 'io' },
    { source: 'FLOW-a', target: 'FUNC-consume-a', type: 'io' },
    { source: 'FUNC-produce', target: 'FLOW-b', type: 'io' },
    { source: 'FLOW-b', target: 'FUNC-consume-b', type: 'io' },
    { source: 'FLOW-a', target: 'SCHEMA-a', type: 'relation' },
    { source: 'FLOW-b', target: 'SCHEMA-b', type: 'relation' },
  ],
};

interface Rig {
  tmp: string;
  harness: GraphCodeHarness;
  tools: MCPToolRegistry;
}

async function makeRig(fixture: FixtureGraph): Promise<Rig> {
  const tmp = mkdtempSync(join(tmpdir(), 'graphcode-merge-'));
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

/** Die SCHEMAs eines FLOW, gelesen aus dem aktuellen Harness-Graphen. */
const schemasOf = (h: GraphCodeHarness, flowId: string) =>
  h
    .getGraph()
    .edges.filter((e) => e.sourceId === flowId && e.edgeType === 'relation')
    .map((e) => e.targetId)
    .sort();

const hasNode = (h: GraphCodeHarness, uid: string) => h.getGraph().nodes.some((n) => n.uid === uid);
const hasEdge = (h: GraphCodeHarness, s: string, t: string, type: string) =>
  h.getGraph().edges.some((e) => e.sourceId === s && e.targetId === t && e.edgeType === type);

describe('CR-GC-444: der gekoppelte Merge geht atomar durchs Gate', () => {
  it('rot-zuerst: der FLOW-Merge ALLEIN blockt mit R-18 (zwei SCHEMAs an einem FLOW)', async () => {
    const rig = await makeRig(MERGE_FIXTURE);
    try {
      expect(schemasOf(rig.harness, 'FLOW-a')).toEqual(['SCHEMA-a']);
      const res = await rig.harness.mutate([
        { op: 'merge-nodes', sourceUid: 'FLOW-b', targetUid: 'FLOW-a' },
      ]);
      expect(res.success).toBe(false);
      expect(
        res.violations.some((v) => v.ruleId === 'R-18' && v.severity === 'error'),
        `erwartet R-18, bekommen: ${res.violations.map((v) => `${v.ruleId}: ${v.message}`).join(' | ')}`,
      ).toBe(true);
    } finally {
      await dropRig(rig);
    }
  }, 120_000);

  it('der Verbund [merge FLOW, merge SCHEMA] kommt durch; aus dem STORE zurückgelesen bleibt ein FLOW mit einem SCHEMA', async () => {
    const rig = await makeRig(MERGE_FIXTURE);
    try {
      const res = await rig.harness.mutate([
        { op: 'merge-nodes', sourceUid: 'FLOW-b', targetUid: 'FLOW-a' },
        { op: 'merge-nodes', sourceUid: 'SCHEMA-b', targetUid: 'SCHEMA-a' },
      ]);
      expect(
        res.success,
        `Gate wies den Verbund ab: ${res.violations.map((v) => `${v.ruleId}: ${v.message}`).join(' | ')}`,
      ).toBe(true);

      // ENTSCHEIDEND: aus dem Store, nicht aus der Arbeitskopie. Liefe der Batch in
      // den persist-Fallstrick (upserts vor deletes), stünde hier etwas anderes als
      // im Memory-Zustand — genau die Divergenz, die der Import-Pfad verbietet.
      await rig.harness.loadGraph();
      expect(hasNode(rig.harness, 'FLOW-b')).toBe(false);
      expect(hasNode(rig.harness, 'SCHEMA-b')).toBe(false);
      expect(hasNode(rig.harness, 'FLOW-a')).toBe(true);
      expect(schemasOf(rig.harness, 'FLOW-a')).toEqual(['SCHEMA-a']);
      // Die io-Kanten des weichenden FLOW hängen jetzt am überlebenden.
      expect(hasEdge(rig.harness, 'FLOW-a', 'FUNC-consume-b', 'io')).toBe(true);
      expect(hasEdge(rig.harness, 'FUNC-produce', 'FLOW-a', 'io')).toBe(true);
      // Und nichts hängt mehr an den verschwundenen Knoten.
      expect(rig.harness.getGraph().edges.some((e) => e.sourceId === 'FLOW-b' || e.targetId === 'FLOW-b')).toBe(false);
      expect(rig.harness.getGraph().edges.some((e) => e.sourceId === 'SCHEMA-b' || e.targetId === 'SCHEMA-b')).toBe(false);
    } finally {
      await dropRig(rig);
    }
  }, 120_000);
});

describe('CR-GC-444: am Repo-Graphen ist ein Merge-Vorschlag anwendbar', () => {
  it('graph_suggest liefert Merge-Vorschläge mit applicable:true und dem vollständigen Verbund im dryRun', async () => {
    const repoGraph = JSON.parse(
      readFileSync(join(__dirname, '..', 'docs/graph/graphcode.graph.json'), 'utf8'),
    ) as FixtureGraph;
    const rig = await makeRig(repoGraph);
    try {
      const res = (await rig.tools.graph_suggest.handler({ target: { coherence: 1 }, k: 20, layer: 'arch' })) as GraphSuggestResult;
      const merges = res.suggestions.filter((s) => s.edit?.op === 'merge-nodes');
      const applicable = merges.filter((s) => s.applicable);

      // eslint-disable-next-line no-console
      console.log(
        `[CR-GC-444] Merge-Vorschläge am Repo-Graphen: ${merges.length} geliefert, ${applicable.length} applicable — ` +
          merges.map((s) => `${s.edit?.source}→${s.edit?.target}${s.applicable ? '' : '(refused)'}`).join(', '),
      );

      expect(
        applicable.length,
        'kein anwendbarer Merge-Vorschlag am Repo-Graphen — genau das Werkzeug, das CR-GC-444 liefert ' +
          `(gelieferte Merges: ${merges.map((s) => `${s.edit?.source}→${s.edit?.target}`).join(', ') || 'keine'})`,
      ).toBeGreaterThan(0);

      for (const s of merges) {
        expect(s.ruleId).toBe('OP-MERGE');
        // Ein Merge-Vorschlag ist NIE eine additive Kante — sonst hätte der dryRun
        // etwas anderes beurteilt als das, was angewandt würde (CR-GC-431).
        expect(s.edit?.retire).toBeUndefined();
        expect(s.edit?.source).not.toBe(s.edit?.target);
      }
    } finally {
      await dropRig(rig);
    }
  }, 300_000);
});
