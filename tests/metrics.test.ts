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
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';
import { computeFitAdvisory } from '../src/kernel/measure/fit-advisory.js';
import { METRIC_DIMENSIONS, toArray } from '@sigloch/se-engine';
import { DEFAULT_METRIC_POLICY, chainMetrics, type MetricPolicy, type OntologyGraph } from '@sigloch/contracts/se';
import { openMeasured } from '../src/surface/measured.js';
import { CONFIG_FILENAME, DEFAULT_CONFIG } from '../src/kernel/config.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

function makeHarness(repoRoot: string, metricPolicy?: MetricPolicy): GraphCodeHarness {
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'metrics-ws', systemId: 'metrics' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  // CR-SM-293: MT-01 urteilt per Default nicht mehr. Wer eine Meldung braucht, gibt die
  // Schwelle hier ausdruecklich mit — dieselbe Stelle, an der `createHarness` sie aus
  // `graphcode.config.jsonc` einsetzt.
  return new GraphCodeHarness(
    config,
    storage,
    undefined, // hooks — der dritte Parameter, nicht die Optionen
    metricPolicy
      ? { graphcodeConfig: { config: { ...DEFAULT_CONFIG, metricPolicy }, source: 'config', path: join(repoRoot, CONFIG_FILENAME) } }
      : undefined,
  );
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
  node('MOD-supplier', 'MOD', 'Supplier module'),
  node('FUNC-a', 'FUNC', 'Function A'),
  node('FUNC-b', 'FUNC', 'Function B'),
  node('FUNC-s', 'FUNC', 'Supplying function'),
  node('MOD-quiet', 'MOD', 'Quiet module'),
  node('FUNC-solo', 'FUNC', 'Solo function'),
  edge('FUNC-solo', 'allocate', 'MOD-quiet'),
  edge('FUNC-a', 'allocate', 'MOD-loud'),
  edge('FUNC-b', 'allocate', 'MOD-loud'),
  edge('FUNC-s', 'allocate', 'MOD-supplier'),
  // CR-SM-293: fan_in/fan_out sind querende VERTRAEGE, und die Richtung folgt Martin — wer
  // von draussen BEZIEHT, haengt ab (fan_out), wer nach draussen LIEFERT, wird gebraucht
  // (fan_in). Frueher genuegten fuenf FLOWs ohne Gegenseite plus die zwei allocate-Kanten;
  // heute quert davon kein einziger Vertrag einen Rand. MOD-loud bezieht deshalb fuenf
  // Vertraege von MOD-supplier und liefert zwei zurueck: I = 5/7 = 71 %, wie zuvor.
  //
  // Je Fluss ein EIGENES SCHEMA: ein geteilter Vertrag waere EINER, nicht fuenf (CR-SM-274
  // zaehlt Vertraege, nicht Querungen).
  ...([1, 2, 3, 4, 5] as const).flatMap((i) => [
    node(`FLOW-in${i}`, 'FLOW', `Inbound flow ${i}`),
    node(`SCHEMA-in${i}`, 'SCHEMA', `Inbound contract ${i}`),
    edge('FUNC-s', 'io', `FLOW-in${i}`),
    edge(`FLOW-in${i}`, 'io', i <= 3 ? 'FUNC-a' : 'FUNC-b'),
    edge(`FLOW-in${i}`, 'relation', `SCHEMA-in${i}`),
  ]),
  ...([1, 2] as const).flatMap((i) => [
    node(`FLOW-out${i}`, 'FLOW', `Outbound flow ${i}`),
    node(`SCHEMA-out${i}`, 'SCHEMA', `Outbound contract ${i}`),
    edge(i === 1 ? 'FUNC-a' : 'FUNC-b', 'io', `FLOW-out${i}`),
    edge(`FLOW-out${i}`, 'io', 'FUNC-s'),
    edge(`FLOW-out${i}`, 'relation', `SCHEMA-out${i}`),
  ]),
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

    expect(modules.map((m) => m.moduleId).sort()).toEqual(['MOD-loud', 'MOD-quiet', 'MOD-supplier']);

    const mtFindings = harness.evaluateRules().filter((v) => v.ruleId === 'MT-01' || v.ruleId === 'MT-02');
    expect(mtFindings.some((v) => v.elementId === 'MOD-quiet'), 'Fixture-Annahme: MOD-quiet ist verstossfrei').toBe(false);

    const quiet = modules.find((m) => m.moduleId === 'MOD-quiet')!;
    expect(quiet.moduleName).toBe('Quiet module');
    expect(quiet.allocatedFuncs).toBe(1);
    expect(typeof quiet.fanIn).toBe('number');
    expect(typeof quiet.fanOut).toBe('number');
  });

  /**
   * CR-SM-293: MT-01 urteilt per Default nicht mehr (`instability: null`). Die Aussage dieses
   * Tests ist aber die KOPPLUNG von Kennzahl und Meldung, nicht der Default — also bekommt der
   * Harness hier ausdruecklich eine Schwelle. Mit dem Startwert waere der Test gruen, ohne je
   * eine Meldung gesehen zu haben.
   */
  it('ist EINE Rechnung mit zwei Ausgaben: instability deckt sich mit der MT-01-Meldung', async () => {
    // Die Schwelle geht direkt in den Harness — `new GraphCodeHarness(...)` liest die
    // jsonc-Datei NICHT (das tut `createHarness`), eine geschriebene Config waere hier
    // wirkungslos gewesen.
    await harness.close();
    harness = makeHarness(repoRoot, { ...DEFAULT_METRIC_POLICY, instability: 0.7 });
    await harness.initialize();
    tools = bindToolsToHarness(harness);

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

  /**
   * CR-GC-518 — die Kritikalitaet je FUNC reist in DERSELBEN Antwort (CR-SM-314).
   *
   * Eigener Schluessel, nicht dieselbe Liste breiter: MOD ist der Abhaengigkeitsbaum, FUNC der
   * Wertbaum, und sie spiegeln einander ausdruecklich nicht. Der Test belegt die BINDUNG an
   * contracts' Definition — Ketten heissen hier, was R-30 darunter versteht (direkte
   * FCHAIN-Kante, kein Rollup ueber compose-Vorfahren) — statt sie nachzurechnen.
   */
  it('liefert eine Zeile je FUNC mit Ketten- und Use-Case-Zahl, kritischste zuerst', async () => {
    const { functions } = await tools.graph_metrics.handler({});

    // Eine Zeile je FUNC der Fixture — auch fuer FUNC-solo, ueber das keine Regel etwas meldet
    // und das in keiner Kette liegt. Genau dort ist "0" eine AUSSAGE und kein fehlender Wert.
    expect(functions.map((f) => f.funcId).sort()).toEqual(['FUNC-a', 'FUNC-b', 'FUNC-s', 'FUNC-solo']);
    expect(functions.find((f) => f.funcId === 'FUNC-solo')).toMatchObject({ chains: 0, useCases: 0 });

    // Die Rangfolge IST das Signal — absteigend, nie nach Zufall der Einlesereihenfolge.
    const ketten = functions.map((f) => f.chains);
    expect([...ketten].sort((a, b) => b - a)).toEqual(ketten);

    // Jede Zeile misst, keine urteilt: vier Felder, kein Infrastruktur-Flag. Die Schwelle
    // steht in der Policy und wird hier NICHT angewandt.
    expect(Object.keys(functions[0]).sort()).toEqual(['chains', 'funcId', 'funcName', 'useCases']);
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

/**
 * CR-GC-767 — Kettenkennzahlen je FCHAIN und die Bewertbarkeitsquote in DERSELBEN Antwort.
 *
 * Gerechnet wird in contracts (`chainMetrics`, CR-SM-404); hier steht, dass die Zahlen am echten
 * Werkzeug ankommen: die Referenzkette „Zahlung ausloesen" aus dem Konzept durch das Gate in ein
 * Disk-Kuzu, dann `graph_metrics`. Die Gegenprobe haengt Schleife und Ast an, und die Kennzahlen
 * muessen umschlagen — ein Block, der immer dieselbe Zahl zeigt, bestuende sonst auch.
 */
describe('graph_metrics — Kettenkennzahlen und Bewertbarkeit (CR-GC-767)', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  const STEPS = ['validieren', 'deckung', 'betrug', 'buchung', 'audit', 'bestaetigung'];
  const MOD_OF: Record<string, string> = {
    validieren: 'MOD-ui', deckung: 'MOD-core', betrug: 'MOD-core', buchung: 'MOD-core', audit: 'MOD-core',
    bestaetigung: 'MOD-ui',
  };
  /** Ein FLOW mit seinem Vertrag; `from: null` laesst den Erzeuger weg. */
  const flow = (id: string, from: string | null, to: string): MutateCommand[] => [
    node(`FLOW-${id}`, 'FLOW', `Flow ${id}`),
    node(`SCHEMA-${id}`, 'SCHEMA', `Contract ${id}`),
    edge(`FLOW-${id}`, 'relation', `SCHEMA-${id}`),
    ...(from ? [edge(from, 'io', `FLOW-${id}`)] : []),
    edge(`FLOW-${id}`, 'io', to),
  ];
  /** ACTOR, sechs Schritte linear, ACTOR; `FCHAIN-storno` teilt sich `FUNC-buchung`. */
  const ZAHLUNG: MutateCommand[] = [
    node('SYS-pay', 'SYS', 'Payment system'),
    node('ACTOR-kunde', 'ACTOR', 'Kunde'),
    node('FCHAIN-zahlung', 'FCHAIN', 'Zahlung ausloesen'),
    node('FCHAIN-storno', 'FCHAIN', 'Storno'),
    node('MOD-ui', 'MOD', 'UI'),
    node('MOD-core', 'MOD', 'Core'),
    ...STEPS.flatMap((s) => [
      node(`FUNC-${s}`, 'FUNC', s),
      edge(`FUNC-${s}`, 'allocate', MOD_OF[s]),
      edge('FCHAIN-zahlung', 'compose', `FUNC-${s}`),
    ]),
    edge('FCHAIN-storno', 'compose', 'FUNC-buchung'),
    ...flow('in', 'ACTOR-kunde', 'FUNC-validieren'),
    ...STEPS.slice(0, -1).flatMap((s, i) => flow(`s${i}`, `FUNC-${s}`, `FUNC-${STEPS[i + 1]}`)),
    ...flow('out', 'FUNC-bestaetigung', 'ACTOR-kunde'),
  ];

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-chain-metrics-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
    const seeded = await harness.mutate(ZAHLUNG);
    expect(seeded.success, JSON.stringify(seeded.violations ?? seeded)).toBe(true);
    tools = bindToolsToHarness(harness);
  });
  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  const zahlung = async () =>
    (await tools.graph_metrics.handler({})).chains.find((c) => c.chainId === 'FCHAIN-zahlung')!;

  it('Referenzkette: Laenge 6, Verzweigung 1, 2 Modulgrenzen, 0 Rueckkopplungen, 1 geteilter Knoten', async () => {
    expect(await zahlung()).toEqual({
      chainId: 'FCHAIN-zahlung',
      chainName: 'Zahlung ausloesen',
      measurable: true,
      length: 6,
      branching: 1,
      moduleBoundaries: 2,
      feedbackLoops: 0,
      sharedFuncs: 1,
      bottlenecks: 1,
      // Stufe 1 rechnet sie nicht — `null` ist die Aussage, eine 0 waere eine Messung.
      syncDepth: null,
      errorPathDepth: null,
    });
  });

  it('Gegenprobe: Schleife und Ast lassen Rueckkopplungen und Verzweigung umschlagen', async () => {
    const more = await harness.mutate([
      ...flow('retry', 'FUNC-betrug', 'FUNC-deckung'),
      ...flow('branch', 'FUNC-buchung', 'FUNC-bestaetigung'),
    ]);
    expect(more.success).toBe(true);
    // deckung und betrug fallen zu EINEM Schritt zusammen: 6 wird 5.
    expect(await zahlung()).toMatchObject({ measurable: true, feedbackLoops: 1, branching: 2, length: 5 });
  });

  it('eine Kette ohne Eingang traegt den Grund statt einer Zahl und zaehlt im Nenner der Quote', async () => {
    const before = (await tools.graph_metrics.handler({})).measurability;
    // FCHAIN-storno hat nur FUNC-buchung: gespeist und entleert von Gliedern der ANDEREN Kette,
    // also bewertbar. Ohne den Ausloeser verliert FCHAIN-zahlung ihren einzigen Eingang.
    expect(before).toEqual({ chains: 2, measurable: 2, ratio: 1 });
    const cut = await harness.mutate([{ op: 'delete-edge', edge: { sourceId: 'ACTOR-kunde', targetId: 'FLOW-in', edgeType: 'io' } }]);
    expect(cut.success).toBe(true);

    const res = await tools.graph_metrics.handler({});
    const kette = res.chains.find((c) => c.chainId === 'FCHAIN-zahlung')!;
    expect(kette).toEqual({ chainId: 'FCHAIN-zahlung', chainName: 'Zahlung ausloesen', measurable: false, reasons: ['no-entry'] });
    expect(res.measurability).toEqual({ chains: 2, measurable: 1, ratio: 0.5 });
  });

  it('ohne FCHAIN: leere Liste und Quote `null` — kein erfundenes 100 %', async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-chain-metrics-none-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
    expect((await harness.mutate(SEED)).success).toBe(true);
    const res = await bindToolsToHarness(harness).graph_metrics.handler({});
    expect(res.chains).toEqual([]);
    expect(res.measurability).toEqual({ chains: 0, measurable: 0, ratio: null });
  });
});

/**
 * CR-GC-767 — graphcodes eigenes Modell: `graph_metrics` und der Spike zeigen DIESELBE Zahl.
 *
 * Der Spike (`scripts/spike-kettenkennzahlen.mjs`) gibt die committete SSOT-Datei roh an
 * `chainMetrics`; das Werkzeug geht ueber Store und `toOntologyGraph`. Stimmen beide Wege je Kette
 * ueberein, ist der Adapter verlustfrei. Keine harte Zahl: das Modell lebt, die Gleichheit nicht.
 */
describe('graph_metrics auf dem eigenen Modell (CR-GC-767)', () => {
  it('zeigt jede FCHAIN der SSOT mit Quote — je Kette gleich dem direkten Aufruf des Spikes', async () => {
    // Das Repo wird nur GELESEN: `openMeasured` legt Store und Lock in ein Wegwerf-Verzeichnis (CR-GC-496).
    const repo = join(__dirname, '..');
    const ssot = join(repo, 'docs', 'graph', 'graphcode.graph.json');
    const roh = JSON.parse(readFileSync(ssot, 'utf8')) as OntologyGraph;
    const direkt = chainMetrics(roh);
    expect(direkt.measurability.chains, 'Praemisse: das eigene Modell traegt Ketten').toBeGreaterThan(0);

    const measured = await openMeasured({ graph: ssot, repoRoot: repo, systemId: 'graphcode' });
    try {
      const res = await bindToolsToHarness(measured.harness).graph_metrics.handler({});
      const nachId = <T extends { chainId: string }>(xs: T[]): T[] => [...xs].sort((a, b) => a.chainId.localeCompare(b.chainId));
      expect(nachId(res.chains)).toEqual(nachId(direkt.chains));
      expect(res.measurability).toEqual(direkt.measurability);
      expect(res.measurability.chains).toBe(roh.elements.filter((e) => e.type === 'FCHAIN').length);
    } finally {
      await measured.close();
    }
  });
});
