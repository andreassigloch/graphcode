/**
 * TEST-graph-metrics (CR-GC-326) — Modulkennzahlen je MOD, unabhaengig von Verstoessen.
 *
 * Der gemessene Mangel (Dashboard-Audit graph-view-edit, 2026-08-12): MT-01 meldet
 * nur die zwei Module ueber 70 %; fuer die anderen drei ist ueber MCP kein Wert zu
 * bekommen — nicht „gut", sondern gar nichts. Ein Trend („war 62 %, ist 68 %") ist
 * damit unmoeglich, obwohl genau das die Steuerungsgroesse waere.
 *
 * Der Kern ist NICHT „ein neues Tool", sondern EINE Rechnung mit zwei Ausgaben:
 * `graph_metrics` reicht `moduleMetrics()` aus contracts durch (CR-SM-232) — dieselbe
 * Funktion, aus der MT-01 seine Verstoesse ableitet. Der Test unten belegt das
 * ueber die Zahl aus der MT-01-Meldung, nicht ueber ein Behaupten im Kommentar.
 *
 * Reales Disk-Kuzu im tmp-Verzeichnis, nie `:memory:`. Keine Mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness, type MCPToolRegistry } from '../src/mcp-tools.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

function makeHarness(repoRoot: string): GraphCodeHarness {
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'metrics-ws', systemId: 'metrics' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

const node = (uid: string, type: string, name: string): MutateCommand => ({
  op: 'add-node',
  node: { uid, type, name, description: `${name}.`, attributes: {} },
});
const edge = (sourceId: string, edgeType: string, targetId: string): MutateCommand => ({
  op: 'add-edge',
  edge: { sourceId, targetId, edgeType, attributes: {} },
});

/**
 * `MOD-loud` koppelt stark nach aussen (MT-01 feuert), `MOD-quiet` traegt EINE
 * allokierte FUNC und reisst keine Schwelle — ueber es sagt keine Regel etwas.
 */
const SEED: MutateCommand[] = [
  node('SYS-m', 'SYS', 'Metrics system'),
  node('MOD-loud', 'MOD', 'Loud module'),
  node('MOD-quiet', 'MOD', 'Quiet module'),
  node('FUNC-a', 'FUNC', 'Function A'),
  node('FUNC-b', 'FUNC', 'Function B'),
  node('FUNC-solo', 'FUNC', 'Solo function'),
  node('FLOW-1', 'FLOW', 'Flow one'),
  node('FLOW-2', 'FLOW', 'Flow two'),
  node('FLOW-3', 'FLOW', 'Flow three'),
  node('FLOW-4', 'FLOW', 'Flow four'),
  node('FLOW-5', 'FLOW', 'Flow five'),
  edge('FUNC-a', 'allocate', 'MOD-loud'),
  edge('FUNC-b', 'allocate', 'MOD-loud'),
  edge('FUNC-solo', 'allocate', 'MOD-quiet'),
  // fan_out 5 gegen fan_in 2 (die allocate-Kanten) → I = 5/7 = 71 %, ueber 70 %.
  edge('FUNC-a', 'io', 'FLOW-1'),
  edge('FUNC-a', 'io', 'FLOW-2'),
  edge('FUNC-a', 'io', 'FLOW-3'),
  edge('FUNC-b', 'io', 'FLOW-4'),
  edge('FUNC-b', 'io', 'FLOW-5'),
];

describe('TEST-graph-metrics: Kennzahlen je MOD, auch ohne Verstoss (CR-GC-326)', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-metrics-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
    expect((await harness.mutate(SEED)).success).toBe(true);
    tools = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('liefert eine Zeile je MOD — auch fuer das Modul, ueber das keine Regel etwas meldet', async () => {
    const { modules } = await tools.graph_metrics.handler({});

    expect(modules.map((m) => m.moduleId).sort()).toEqual(['MOD-loud', 'MOD-quiet']);

    const mtFindings = harness.evaluateRules().filter((v) => v.ruleId === 'MT-01' || v.ruleId === 'MT-02');
    expect(mtFindings.some((v) => v.elementId === 'MOD-quiet'), 'Fixture-Annahme: MOD-quiet ist verstossfrei').toBe(false);

    const quiet = modules.find((m) => m.moduleId === 'MOD-quiet')!;
    expect(quiet.moduleName).toBe('Quiet module');
    expect(quiet.allocatedFuncs).toBe(1);
    expect(typeof quiet.fanIn).toBe('number');
    expect(typeof quiet.fanOut).toBe('number');
  });

  it('ist EINE Rechnung mit zwei Ausgaben: instability deckt sich mit der MT-01-Meldung', async () => {
    const { modules } = await tools.graph_metrics.handler({});
    const loud = modules.find((m) => m.moduleId === 'MOD-loud')!;

    const mt01 = harness.evaluateRules().find((v) => v.ruleId === 'MT-01' && v.elementId === 'MOD-loud');
    expect(mt01, 'Fixture soll MT-01 ausloesen').toBeDefined();

    // Die Meldung traegt die Zahlen als Fliesstext — kein Konsument muss sie mehr parsen.
    expect(mt01!.message).toContain(`${Math.round(loud.instability! * 100)}%`);
    expect(mt01!.message).toContain(`fan_in=${loud.fanIn}`);
    expect(mt01!.message).toContain(`fan_out=${loud.fanOut}`);
    expect(loud.instability).toBeCloseTo(loud.fanOut / (loud.fanIn + loud.fanOut), 10);
  });

  it('liefert null statt 0, wo nichts messbar ist', async () => {
    const { modules } = await tools.graph_metrics.handler({});
    const quiet = modules.find((m) => m.moduleId === 'MOD-quiet')!;

    // Ein MOD mit einer einzigen allokierten FUNC hat kein LCOM4 und keine Kohaesion —
    // eine 0 dort waere eine Messung, die es nicht gibt.
    expect(quiet.lcom4).toBeNull();
    expect(quiet.cohesion).toBeNull();
  });

  it('sortiert schlechteste Kohaesion zuerst; Module ohne Messwert stehen hinten', async () => {
    const { modules } = await tools.graph_metrics.handler({});
    const measured = modules.filter((m) => m.cohesion !== null);
    const ratios = measured.map((m) => m.cohesion!.ratio);

    expect([...ratios].sort((a, b) => a - b)).toEqual(ratios);
    // Alles Unmessbare kommt nach allem Gemessenen — die Rangfolge IST das Signal.
    const firstNull = modules.findIndex((m) => m.cohesion === null);
    if (firstNull >= 0) {
      expect(modules.slice(firstNull).every((m) => m.cohesion === null)).toBe(true);
    }
  });

  it('traegt die graphVersion des gelesenen Standes', async () => {
    const res = await tools.graph_metrics.handler({});
    expect(typeof res.graphVersion).toBe('number');
    expect(res.graphVersion).toBeGreaterThanOrEqual(0);
  });
});
