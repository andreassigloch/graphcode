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
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness, type MCPToolRegistry } from '../src/surface/mcp-tools.js';
import { computeFitAdvisory } from '../src/projections/fit-advisory.js';
import { METRIC_DIMENSIONS, toArray } from '@sigloch/se-engine';
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
  // R-18 (contracts 10): jeder FLOW braucht GENAU EINE relation auf ein SCHEMA.
  // Ein geteiltes SCHEMA reicht — die Regel zaehlt je FLOW, nicht je SCHEMA. Die
  // Kanten sind FLOW→SCHEMA und beruehren die Modulzahlen nicht: fan_in/fan_out
  // eines MOD zaehlen seine eigenen Traces und die seiner allozierten FUNC.
  node('SCHEMA-c', 'SCHEMA', 'Shared contract'),
  edge('FLOW-1', 'relation', 'SCHEMA-c'),
  edge('FLOW-2', 'relation', 'SCHEMA-c'),
  edge('FLOW-3', 'relation', 'SCHEMA-c'),
  edge('FLOW-4', 'relation', 'SCHEMA-c'),
  edge('FLOW-5', 'relation', 'SCHEMA-c'),
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

  // CR-GC-451: der ℝ⁶-Ist-Vektor verlaesst den Host. Er wurde laengst gerechnet
  // und entschied ueber jede graph_suggest-Empfehlung, kam aber an kein Tool —
  // ein Dashboard konnte nur die Zielrichtung zeigen.
  describe('fit — der Ist-Vektor auf der Architektur-Ebene (CR-GC-451)', () => {
    it('liefert alle sechs Dimensionen, benannt und als Zahl', async () => {
      const { fit } = await tools.graph_metrics.handler({});
      expect(fit.layer).toBe('arch');
      expect(Object.keys(fit.metrics).sort()).toEqual([...METRIC_DIMENSIONS].sort());
      for (const d of METRIC_DIMENSIONS) expect(Number.isFinite(fit.metrics[d])).toBe(true);
    });

    it('ist DIESELBE Messung, gegen die graph_suggest sein Δm rechnet', async () => {
      // Das ist der Kern des CR: nicht „ein Vektor mit passendem Schema", sondern
      // GENAU der, auf dem das Ranking sitzt. Beweis ohne zweite Rechnung im Test:
      // das Fit-Advisory einer Nullmutation (before === after) hat als `before`
      // exakt den Vektor, den das Tool herausgibt.
      const { fit } = await tools.graph_metrics.handler({});
      const graph = harness.getGraph();
      const advisory = computeFitAdvisory(graph, graph);
      expect(advisory.before).toEqual(toArray(fit.metrics));
      expect(advisory.delta.every((d) => d === 0)).toBe(true);
    });

    it('ohne Zielprofil: source `none` und leere Gewichte — kein erfundener Nullvektor', async () => {
      const { fit } = await tools.graph_metrics.handler({});
      expect(fit.target.source).toBe('none');
      expect(fit.target.weights).toEqual({});
    });

    it('mit Zielprofil reisen Wert und Zielmarke in EINER Antwort (Regel aus CR-GC-329)', async () => {
      writeFileSync(
        join(repoRoot, '.graphcode', 'target-profile.json'),
        JSON.stringify({ weights: { coherence: 1, scalability: -0.5 } }),
      );
      const { fit } = await tools.graph_metrics.handler({});
      expect(fit.target.source).toBe('profile');
      expect(fit.target.weights).toEqual({ coherence: 1, scalability: -0.5 });
      // …und der Ist-Wert steht daneben, nicht in einer zweiten Antwort.
      expect(Number.isFinite(fit.metrics.coherence)).toBe(true);
    });
  });
});

/**
 * CR-GC-457 — Zielwert UND Gewicht verlassen den Host gemeinsam, und der
 * Widerspruch zwischen beiden bleibt nicht stumm.
 *
 * Der gemessene Mangel (Review graph-view-edit 30.08., Punkt 3): das Dashboard
 * hatte nur das Gewicht und schrieb „heben (1.0)" neben einen Ist-Wert von 3.71.
 * Auf der Werteskala gelesen heisst das „senken" — das Gegenteil. Der Zielwert
 * liegt jetzt auf DERSELBEN Skala wie `metrics`, damit ein Konsument den Abstand
 * zeichnen kann, ohne eine Einheit umzudeuten.
 */
describe('graph_metrics — Zielwerte je Dimension (CR-GC-457)', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-target-values-fit-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
    // Derselbe Seed wie oben: ein leerer Graph misst auf allen sechs Dimensionen
    // 0, und gegen eine 0 ist „Zielwert darunter" nicht formulierbar.
    expect((await harness.mutate(SEED)).success).toBe(true);
    tools = bindToolsToHarness(harness);
  });
  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  const writeProfile = (profile: unknown): void => {
    mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
    writeFileSync(join(repoRoot, '.graphcode', 'target-profile.json'), JSON.stringify(profile));
  };

  it('ohne Profil: leere Zielwerte und keine Widersprueche — nie eine erfundene 2.5-Mitte', async () => {
    const { fit } = await tools.graph_metrics.handler({});
    expect(fit.target.source).toBe('none');
    expect(fit.target.values).toEqual({});
    expect(fit.target.inconsistent).toEqual([]);
  });

  it('reicht die Zielwerte der Datei unveraendert durch, neben dem Gewicht', async () => {
    writeProfile({ weights: { coherence: 1 }, values: { coherence: 4.5, viability: 5 } });
    const { fit } = await tools.graph_metrics.handler({});
    expect(fit.target.values).toEqual({ coherence: 4.5, viability: 5 });
    expect(fit.target.weights).toEqual({ coherence: 1 });
    // Wert und Marke in EINER Antwort — die Regel aus CR-GC-329/451.
    expect(Number.isFinite(fit.metrics.coherence)).toBe(true);
  });

  it('meldet den Widerspruch: „heben", aber der Zielwert liegt UNTER dem Ist-Wert', async () => {
    const ist = (await tools.graph_metrics.handler({})).fit.metrics.coherence;
    // Praemisse des Tests laut machen: unter einem Ist-Wert von 0 gibt es kein
    // gueltiges Ziel darunter, dann pruefte der Test nichts.
    expect(ist).toBeGreaterThan(0);
    writeProfile({ weights: { coherence: 1 }, values: { coherence: ist / 2 } });
    const { fit } = await tools.graph_metrics.handler({});
    expect(fit.target.inconsistent).toEqual(['coherence']);
  });

  it('stimmen Richtung und Zielwert ueberein, bleibt die Liste leer', async () => {
    const ist = (await tools.graph_metrics.handler({})).fit.metrics.coherence;
    expect(ist).toBeLessThan(5);
    writeProfile({ weights: { coherence: 1 }, values: { coherence: (ist + 5) / 2 } });
    const { fit } = await tools.graph_metrics.handler({});
    expect(fit.target.inconsistent).toEqual([]);
  });

  it('ohne Gewicht gibt es keine Steuerabsicht, der der Zielwert widersprechen koennte', async () => {
    const ist = (await tools.graph_metrics.handler({})).fit.metrics.coherence;
    writeProfile({ weights: {}, values: { coherence: ist / 2 } });
    const { fit } = await tools.graph_metrics.handler({});
    expect(fit.target.values.coherence).toBeCloseTo(ist / 2);
    expect(fit.target.inconsistent).toEqual([]);
  });

  it('ein Zielwert allein aendert die Empfehlung nicht — gerankt wird gegen die Gewichte', async () => {
    writeProfile({ weights: { coherence: 1 } });
    const withoutValues = (await tools.graph_metrics.handler({})).fit.target.weights;
    writeProfile({ weights: { coherence: 1 }, values: { coherence: 4.5 } });
    const withValues = (await tools.graph_metrics.handler({})).fit.target.weights;
    expect(withValues).toEqual(withoutValues);
  });
});
