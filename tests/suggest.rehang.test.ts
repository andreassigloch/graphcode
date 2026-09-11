/**
 * CR-GC-435 — Fix-Templates können umhängen, nicht nur anhängen.
 *
 * Eine Allokations-Änderung ist ein Umhängen: alte Kante weg, neue hin. Der
 * Template-Rückgabetyp trägt das seit se-engine 1.4.0 als `retire` am
 * `SuggestedEdit`; graphcodes `graph_suggest` schickt den Verbund als EINEN
 * Batch `[delete-edge(retire), add-edge(edit)]` durchs Gate-dryRun — vorher
 * war der Batch fest ein einzelnes `add-edge`, und am Repo-Graphen war KEIN
 * Architektur-Vorschlag anwendbar (der Gate-Spruch galt einem anderen Edit
 * als dem, der angewandt worden wäre).
 *
 * DREI NACHWEISE, alle am echten Gate mit Disk-Kuzu (nie :memory:):
 *
 *   1. ATOMARES UMHÄNGEN — der Zwei-Kommando-Batch verschiedener Kanten kommt
 *      durch, und aus dem Store zurückgelesen steht genau EINE Allokation.
 *      Rot-zuerst eingebaut: derselbe Edit OHNE das delete-edge blockt mit
 *      R-18 (zweites Bein, Kardinalität 0..1).
 *   2. DIE GRENZE — delete+add DERSELBEN Kante in einem Batch führt zu
 *      Store ≠ Memory (persist schreibt upserts vor deletes). Die bekannte
 *      Einschränkung (import-code-verb) ist damit erzwungen, nicht behauptet.
 *   3. DER REPO-GRAPH — `graph_suggest` auf docs/graph/graphcode.graph.json,
 *      layer:'arch': jeder anwendbare Umhänge-Edit wurde als VERBUND beurteilt,
 *      und kein Merge-Vorschlag scheitert am Gate. Die Anwendbarkeit des
 *      Umhängens selbst belegt Nachweis 1 an der Fixture. CR-SM-309: am
 *      Repo-Graphen (v261) ist seitdem KEIN Architektur-Zug anwendbar — die
 *      einzigen anwendbaren waren FLOW-Merges, die IO-02 verletzten
 *      (Messung 2026-08-26 vor CR-GC-435: null, danach ≥ 1, jetzt wieder null
 *      aus dem neuen Grund). Die Zahl wird berichtet, nicht gefordert.
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
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';
import { makeSteeringConfig, type FixtureGraph } from './fixtures/steering-graphs.js';
import { DIVERGENCE_FIXTURE } from './fixtures/divergence-graph.js';
import type { GraphSuggestResult } from '../src/loop/suggest.js';

interface Rig {
  tmp: string;
  harness: GraphCodeHarness;
  tools: MCPToolRegistry;
}

async function makeRig(fixture: FixtureGraph): Promise<Rig> {
  const tmp = mkdtempSync(join(tmpdir(), 'graphcode-rehang-'));
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

/** allocate-Kanten einer FUNC, gelesen aus dem aktuellen Harness-Graphen. */
const allocationsOf = (h: GraphCodeHarness, funcId: string) =>
  h.getGraph().edges.filter((e) => e.sourceId === funcId && e.edgeType === 'allocate');

describe('CR-GC-435: Umhängen geht atomar durchs Gate', () => {
  it('rot-zuerst: NUR anhängen an eine allozierte FUNC blockt mit R-18 (Kardinalität)', async () => {
    const rig = await makeRig(DIVERGENCE_FIXTURE);
    try {
      // FUNC-report ist in MOD-delivery alloziert — die zweite Allokation allein ist illegal.
      const res = await rig.harness.mutate([
        { op: 'add-edge', edge: { sourceId: 'FUNC-report', targetId: 'MOD-retention', edgeType: 'allocate', attributes: {} } },
      ]);
      expect(res.success).toBe(false);
      expect(
        res.violations.some((v) => v.ruleId === 'R-18' && v.severity === 'error'),
        `erwartet R-18, bekommen: ${res.violations.map((v) => v.ruleId).join(', ')}`,
      ).toBe(true);
    } finally {
      await dropRig(rig);
    }
  }, 120_000);

  it('der Verbund [delete-edge(alt), add-edge(neu)] kommt durch; der Store trägt danach genau EINE Allokation', async () => {
    const rig = await makeRig(DIVERGENCE_FIXTURE);
    try {
      const res = await rig.harness.mutate([
        { op: 'delete-edge', edge: { sourceId: 'FUNC-report', targetId: 'MOD-delivery', edgeType: 'allocate' } },
        { op: 'add-edge', edge: { sourceId: 'FUNC-report', targetId: 'MOD-retention', edgeType: 'allocate', attributes: {} } },
      ]);
      expect(res.success, `Gate wies den Verbund ab: ${res.violations.map((v) => `${v.ruleId}: ${v.message}`).join(' | ')}`).toBe(true);

      // Entscheidend: AUS DEM STORE zurückgelesen, nicht aus dem Memory-Zustand.
      await rig.harness.loadGraph();
      const allocs = allocationsOf(rig.harness, 'FUNC-report');
      expect(allocs.map((e) => e.targetId)).toEqual(['MOD-retention']);
    } finally {
      await dropRig(rig);
    }
  }, 120_000);

  it('die Grenze bleibt: delete+add DERSELBEN Kante in einem Batch ⇒ Store ≠ Memory', async () => {
    // Nicht der Soll-Pfad, sondern die Gegenprobe zum bekannten Fallstrick
    // (import-code-verb: „nie delete+add derselben uid in einem Batch"): persist
    // schreibt upserts VOR deletes, also räumt das delete die eben upsertete
    // Kante im Store wieder weg, während sie in-memory steht. Würde dieser Test
    // grün-invertiert (Store = Memory), ist der Persist-Pfad umgebaut und die
    // dokumentierte Grenze — samt Kommentaren in harness.ts/import-code-verb —
    // muss nachgezogen werden.
    const rig = await makeRig(DIVERGENCE_FIXTURE);
    try {
      const res = await rig.harness.mutate([
        { op: 'delete-edge', edge: { sourceId: 'FUNC-report', targetId: 'MOD-delivery', edgeType: 'allocate' } },
        { op: 'add-edge', edge: { sourceId: 'FUNC-report', targetId: 'MOD-delivery', edgeType: 'allocate', attributes: {} } },
      ]);
      // Das Gate urteilt über den Endzustand (unverändert legal) — es lässt durch.
      expect(res.success).toBe(true);
      // Memory: die Kante steht (delete, dann add, in Reihenfolge angewandt).
      expect(allocationsOf(rig.harness, 'FUNC-report').map((e) => e.targetId)).toEqual(['MOD-delivery']);
      // Store: die Kante FEHLT (upserts vor deletes persistiert).
      await rig.harness.loadGraph();
      expect(allocationsOf(rig.harness, 'FUNC-report')).toEqual([]);
    } finally {
      await dropRig(rig);
    }
  }, 120_000);
});

describe('CR-GC-435: am Repo-Graphen urteilt der dryRun über den Verbund', () => {
  it("graph_suggest auf layer:'arch': kein Merge scheitert am Gate, jeder anwendbare retire-Edit ist ein Verbund", async () => {
    const repoGraph = JSON.parse(
      readFileSync(join(__dirname, '..', 'docs/graph/graphcode.graph.json'), 'utf8'),
    ) as FixtureGraph;
    const rig = await makeRig(repoGraph);
    try {
      const res = (await rig.tools.graph_suggest.handler({ target: { coherence: 1 }, k: 20, layer: 'arch' })) as GraphSuggestResult;

      const applicable = res.suggestions.filter((s) => s.applicable);
      // eslint-disable-next-line no-console
      console.log(
        `[CR-GC-435] am Repo-Graphen: ${res.suggestions.length} Vorschläge, ${applicable.length} applicable — ` +
          res.suggestions.map((s) => `${s.ruleId}${s.edit ? '+edit' : ''}${s.verdict?.success === false ? '(refused)' : ''}`).join(', '),
      );
      // CR-SM-309: der Operator schlägt keinen Merge mehr vor, den das Gate abweist.
      expect(
        res.suggestions.filter((s) => s.ruleId === 'OP-MERGE' && !s.applicable).map((s) => `${s.edit?.source}→${s.edit?.target}`),
        'OP-MERGE schlägt Züge vor, die das Gate abweist',
      ).toEqual([]);

      // Wo ein Edit ein retire trägt, hat der dryRun den VERBUND beurteilt — ein
      // `applicable:true` an so einem Edit ist ohne den Batch-dryRun unmöglich,
      // denn das nackte add-edge weist das Gate ab (Test oben).
      for (const s of res.suggestions) {
        if (!s.edit?.retire || !s.applicable) continue;
        expect(s.verdict?.success).toBe(true);
        expect(s.edit.retire.source).toBe(s.edit.source);
      }
    } finally {
      await dropRig(rig);
    }
  }, 300_000);
});
