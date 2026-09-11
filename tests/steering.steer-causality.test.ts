/**
 * T-S1..T-S4 (CR-GC-484) — der Kausalitaetsnachweis der STEUERUNG.
 *
 * Diese Datei war bis 2026-09-07 der Nachweis fuer den ℝ⁶ (T-C1 „the target direction reaches
 * the ranking", T-C2 „an applied suggestion moves ℝ⁶", T-C4 Placebo). Zwei Dinge waren mit ihr
 * passiert, und beide gehoeren in den Kopf:
 *
 *  1. Sie war **10 von 12 rot**, schon vor dem Umbau — der Nachweis hatte laengst aufgehoert zu
 *     halten, und niemand hat es gesehen, weil `npm test` an der Wurzel dauerhaft rot war
 *     (CR-SM-290) und graphcodes Suite 18 rote Dateien traegt.
 *  2. Seit CR-GC-483 prueft sie einen **geloeschten** Vertrag: das Eingabefeld `target` von
 *     `graph_suggest` gibt es nicht mehr. Eine rote Datei ist schlecht; eine rote Datei, die
 *     einen nicht mehr existierenden Vertrag prueft, ist irrefuehrend.
 *
 * Ersetzt durch den Nachweis fuer den Chebyshev-Score (CR-SM-292 `steer.ts`). Dieselbe Methode
 * wie zuvor: A/B ueber EINE Stellgroesse, behauptet wird die DIFFERENZ und ihr Vorzeichen, nie
 * ein absoluter Score.
 *
 *   T-S1  Score → Rangfolge            (die publizierte Zahl IST die Rangfolge)
 *   T-S2  Zug → Score am Gate          (der Kernnachweis: die gemeldete Zahl ist die echte)
 *   T-S3  Budget → Score               (die Stellgroesse; sie ersetzt die Zielrichtung)
 *   T-C3  MetricPolicy/Config → Urteil (unveraendert uebernommen, war und ist gruen)
 *   T-S4  innerhalb aller Budgets      (Placebo: Blindheit, dokumentiert statt bestanden)
 *
 * **T-S3 ist der Kern.** Beim ℝ⁶ war die Stellgroesse ein Gewichtsvektor, den der Nutzer setzt.
 * Den gibt es nicht mehr: normiert wird gegen die REGELSCHWELLE, und die ist die einzige
 * Stellschraube, die es noch gibt. Ein Nachweis, der sie nicht bewegt, prueft die Steuerung
 * nicht.
 *
 * Kein LLM: `graph_suggest` liefert den Template-Edit mit dem Fund, der Aktuator ist skriptbar,
 * die ganze Kette deterministisch. Echtes Disk-Kuzu (Temp-Verzeichnis), keine Mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { steerScore } from '@sigloch/se-engine';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';
import { toOntologyGraph } from '../src/kernel/conformance.js';
import { takeSteeringSnapshot } from '../src/kernel/measure/steering-snapshot.js';
import { generationStep } from '../src/loop/generate.js';
import { CONFIG_FILENAME, DEFAULT_FOCUS_THRESHOLD, loadGraphcodeConfig } from '../src/kernel/config.js';
import { DEFAULT_METRIC_POLICY, evaluateAllRules } from '@sigloch/contracts/se';
import { ARCH_FIXTURE, makeSteeringConfig } from './fixtures/steering-graphs.js';
import { batchFor, type GraphSuggestResult } from '../src/loop/suggest.js';

/**
 * Das ENGE Budget fuer die A/B-Arme von T-S3.
 *
 * Der Fixture-Graph ist klein: sein breitester Container ist `SYS-steering` mit 2 Kindern. Beim
 * Default 11 liegt er weit innerhalb des Budgets, der Score ist 0. Erst bei `warning: 2` meldet
 * RD-04 dort, mit normiertem Ueberschuss 0,5 — GEMESSEN, nicht gewuenscht, und die einzige
 * Einstellung, die den Score an dieser Fixture ueberhaupt von 0 wegbewegt. Ein A/B mit zwei
 * Nullen waere kein A/B, sondern derselbe Lauf zweimal.
 */
const ENGES_BUDGET = 2;

/** Numeric slack for float comparison — named, not magic. */
const EPS = 1e-9;

interface Rig {
  tmp: string;
  harness: GraphCodeHarness;
  tools: MCPToolRegistry;
}

/** A fresh disk store with the shared fixture — one per A/B arm, never shared. */
async function makeRig(config?: Record<string, unknown>): Promise<Rig> {
  const tmp = mkdtempSync(join(tmpdir(), 'graphcode-arch-causality-'));
  if (config) writeFileSync(join(tmp, CONFIG_FILENAME), JSON.stringify(config, null, 2));
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
  // The config is an explicit constructor opt (production wiring does this in
  // `createHarness`). Writing the file without passing it loads the DEFAULT policy —
  // which would make the T-C3 arms two identical runs wearing different labels.
  const harness = new GraphCodeHarness(makeSteeringConfig(tmp), storage, undefined, {
    graphcodeConfig: loadGraphcodeConfig(tmp),
  });
  await harness.initialize();
  await harness.importGraph(ARCH_FIXTURE);
  return { tmp, harness, tools: bindToolsToHarness(harness) };
}

/**
 * A COMPLETE config with one value overridden. `GraphcodeConfigSchema` requires both
 * `metricPolicy` and `focusThreshold` — a partial file is schema-invalid, and an
 * invalid file is not an A/B arm, it is the default config wearing a costume.
 */
function configWith(policy: Partial<Record<string, unknown>> = {}, focusThreshold = DEFAULT_FOCUS_THRESHOLD): Record<string, unknown> {
  return {
    metricPolicy: { ...DEFAULT_METRIC_POLICY, ...policy },
    focusThreshold,
  };
}

async function dropRig(rig: Rig): Promise<void> {
  await rig.harness.close();
  rmSync(rig.tmp, { recursive: true, force: true });
}

/**
 * Der Chebyshev-Score des LEBENDEN Graphen, unabhaengig nachgerechnet.
 *
 * Bewusst NICHT aus dem Gate-Advisory gelesen: der Kernnachweis (T-S2) ist genau, dass die
 * gemeldete Zahl mit der echten uebereinstimmt. Wer beide Seiten aus derselben Quelle liest,
 * prueft nichts.
 */
const steerOf = (harness: GraphCodeHarness, policy = DEFAULT_METRIC_POLICY) =>
  steerScore(evaluateAllRules(toOntologyGraph(harness.getGraph()), policy));

const rank = (res: GraphSuggestResult) => res.suggestions.map((s) => `${s.ruleId}/${s.elementId}`);
const keyOf = (s: { ruleId: string; elementId: string }) => `${s.ruleId}/${s.elementId}`;

describe('T-C3 (CR-GC-340): the judging threshold is a knob in the config, not a literal in the rule', () => {
  it('the same graph flips a moduleMetrics verdict when MetricPolicy moves', async () => {
    // Same graph, same rules — only the instability threshold differs.
    // `null` is the documented "measure, do not judge" setting: MT-01 never fires.
    const lenient = await makeRig(configWith({ instability: null }));
    const strict = await makeRig(configWith({ instability: 0.1 }));
    try {
      const mt01 = (rig: Rig) =>
        takeSteeringSnapshot(rig.harness.getGraph(), rig.harness.getMetricPolicy())
          .violations.filter((v) => v.rule_id === 'MT-01');

      expect(mt01(lenient)).toEqual([]);
      expect(mt01(strict).length).toBeGreaterThan(0);

      // The measurement itself is unchanged — only the judgement moved. If the
      // module rows differed too, this would be two graphs, not one knob.
      const modulesOf = (rig: Rig) =>
        (rig.tools.graph_metrics.handler({}) as Promise<{ modules: { moduleId: string; instability: number | null }[] }>);
      const a = await modulesOf(lenient);
      const b = await modulesOf(strict);
      expect(a.modules.map((m) => `${m.moduleId}:${m.instability}`)).toEqual(b.modules.map((m) => `${m.moduleId}:${m.instability}`));
    } finally {
      await dropRig(lenient);
      await dropRig(strict);
    }
  });

  it('moving focusThreshold leaves the measurement untouched and reaches only the focus judgment', async () => {
    const low = await makeRig(configWith({}, 0.05));
    const high = await makeRig(configWith({}, 0.99));
    try {
      const snap = (rig: Rig) => takeSteeringSnapshot(rig.harness.getGraph(), rig.harness.getMetricPolicy());
      const a = snap(low);
      const b = snap(high);

      // Same findings AND same scores — the threshold judges, it does not measure (CR-GC-514:
      // the snapshot no longer takes it; before CR-SM-310 it turned it into a `ready` flag).
      const ids = (s: typeof a) => s.violations.map((v) => `${v.rule_id}/${v.element_id}`).sort();
      expect(ids(a)).toEqual(ids(b));
      expect(a.blockingErrors).toBe(b.blockingErrors);
      expect(a.report.scores).toEqual(b.report.scores);

      // The config value arrives where the focus is judged — and only there. That the verdict
      // flips with it (handoff at threshold 0) is proven on a real fixture in generate.test.ts.
      const step = (rig: Rig) =>
        generationStep(rig.harness.getGraph(), rig.harness.getMetricPolicy(), 'steering causality', rig.harness.getFocusThreshold(), []);
      const sLow = step(low);
      const sHigh = step(high);
      expect(sLow.threshold).toBe(0.05);
      expect(sHigh.threshold).toBe(0.99);
      expect(sLow.readiness).toEqual(sHigh.readiness);
    } finally {
      await dropRig(low);
      await dropRig(high);
    }
  });
});

describe('T-S1 (CR-GC-484): der Score erreicht die Rangfolge', () => {
  let rig: Rig;
  beforeEach(async () => { rig = await makeRig(); });
  afterEach(async () => { await dropRig(rig); });

  it('die publizierte `score` IST die Chebyshev-Verbesserung des Gate-Advisorys', async () => {
    const res = (await rig.tools.graph_suggest.handler({ k: 20, layer: 'arch' })) as GraphSuggestResult;
    const anwendbar = res.suggestions.filter((s) => s.applicable);
    expect(anwendbar.length).toBeGreaterThan(0);
    for (const s of anwendbar) {
      // Kein zweiter Messpfad: was gerankt wird, ist genau das, was das Gate zum
      // ausgelieferten Edit gemessen hat.
      expect(s.verdict?.steer).toBeDefined();
      expect(s.score).toBeCloseTo(s.verdict!.steer!.improvement, 12);
    }
  });

  it('die Rangfolge folgt dem Score — anwendbar zuerst, dann absteigend', async () => {
    const res = (await rig.tools.graph_suggest.handler({ k: 20, layer: 'arch' })) as GraphSuggestResult;
    const gruppe = (s: (typeof res.suggestions)[number]) => (s.applicable && s.score > 0 ? 0 : 1);
    for (let i = 1; i < res.suggestions.length; i++) {
      const a = res.suggestions[i - 1], b = res.suggestions[i];
      expect(gruppe(a)).toBeLessThanOrEqual(gruppe(b));
      if (gruppe(a) !== gruppe(b)) continue;
      const entfernt = (x: typeof a) => (x.verdict?.steer?.removesElements ? 1 : 0);
      if (entfernt(a) !== entfernt(b)) { expect(entfernt(a)).toBeLessThan(entfernt(b)); continue; }
      expect(a.score).toBeGreaterThanOrEqual(b.score);
    }
  });

  it('deterministisch — derselbe Graph zweimal, dieselbe Rangfolge', async () => {
    const a = (await rig.tools.graph_suggest.handler({ k: 20, layer: 'arch' })) as GraphSuggestResult;
    const b = (await rig.tools.graph_suggest.handler({ k: 20, layer: 'arch' })) as GraphSuggestResult;
    expect(rank(a)).toEqual(rank(b));
  });
});

describe('T-S2 (CR-GC-484): ein angewandter Zug bewegt den Score am Gate — der Kernnachweis', () => {
  /**
   * ENGES Budget, und das ist keine Kosmetik: der erste Entwurf dieses Tests lief auf dem
   * Default-Budget, wo der Fixture-Graph innerhalb aller Budgets liegt. Dort ist der Score vorn
   * wie hinten 0, die Behauptung `vorher − nachher === improvement` also 0 === 0 — und der Test
   * blieb GRUEN, als `improvement` probeweise fest auf 0 gesetzt wurde. Genau die Fake-Coverage
   * aus CLAUDE.md: ein Test, der seinen Gegenstand nicht erreicht, ist von einem bestandenen
   * nicht zu unterscheiden. Erst im engen Arm beisst er.
   */
  const POLICY = { ...DEFAULT_METRIC_POLICY, decompositionBreadth: { min: 1, warning: ENGES_BUDGET } };
  let rig: Rig;
  beforeEach(async () => { rig = await makeRig(configWith({ decompositionBreadth: { min: 1, warning: ENGES_BUDGET } })); });
  afterEach(async () => { await dropRig(rig); });

  it('die vom Gate GEMELDETE Verbesserung ist die ECHTE — unabhaengig nachgerechnet', async () => {
    const vorher = steerOf(rig.harness, POLICY).score;
    expect(vorher, 'ohne Ueberschreitung prueft dieser Test nichts').toBeGreaterThan(0);

    // Ein Zug, der die schlimmste Stelle NACHWEISLICH bewegt: eine weitere **Wurzel-FUNC**.
    // Der Befund an dieser Fixture lautet woertlich „SYS-steering has 3 root FUNC children on
    // one level (>2)" — der Zaehler ist der FUNC-WURZELWALD (CR-SM-282), nicht `compose` vom
    // SYS. Zwei Entwuerfe davor haben nichts bewegt (ein UC, dann ein sub-MOD, beide 0,50025
    // vorher wie nachher); dass der Test das jedes Mal gemeldet hat, ist der Beleg, dass er
    // beisst. Bewusst von Hand statt aus `graph_suggest` — der Nachweis gilt dem GATE.
    const version = (await rig.tools.graph_readiness.handler({ detail: false })).graphVersion;
    const res = await rig.tools.graph_mutate.handler({
      baseVersion: version,
      commands: [
        { op: 'add-node', node: { uid: 'FUNC-extra', type: 'FUNC', name: 'Extra', description: 'Kandidaten-Funktion ohne compose-Elternteil — eine vierte Wurzel.', attributes: {} } },
      ],
      violations: 'summary',
    });
    expect(res.success).toBe(true);

    const gemeldet = (res as { steerAdvisory?: { before: number; after: number; improvement: number } }).steerAdvisory;
    expect(gemeldet, 'das Gate liefert kein Steuer-Advisory').toBeDefined();

    const nachher = steerOf(rig.harness, POLICY).score;
    // Der Zug VERSCHLECHTERT — der Container wird breiter. Genau deshalb taugt er: eine
    // Verbesserung von 0 waere von einer Luege nicht zu unterscheiden.
    expect(nachher).toBeGreaterThan(vorher);
    expect(gemeldet!.improvement).toBeLessThan(0);

    // DAS ist die Kausalitaet: die Zahl im Advisory beschreibt den echten Zustandswechsel,
    // nicht eine Sonde daneben.
    expect(gemeldet!.before).toBeCloseTo(vorher, 12);
    expect(gemeldet!.after).toBeCloseTo(nachher, 12);
    expect(vorher - nachher).toBeCloseTo(gemeldet!.improvement, 12);
  });

  it('das Gate rechnet mit dem BUDGET DES HOSTS, nicht mit dem Default', async () => {
    // Der Defekt, den der Rot-Nachweis oben freigelegt hat: `computeSteerAdvisory` las zuerst
    // `DEFAULT_METRIC_POLICY` fest. Ein Host mit engerem Budget haette weiter nach dem Default
    // gerankt — die einzige Stellschraube der Steuerung waere am Gate wirkungslos gewesen.
    const version = (await rig.tools.graph_readiness.handler({ detail: false })).graphVersion;
    const res = await rig.tools.graph_mutate.handler({
      baseVersion: version,
      commands: [{ op: 'add-node', node: { uid: 'UC-probe', type: 'UC', name: 'Probe', description: 'Probe fuer die Budget-Bindung.', attributes: {} } }],
      violations: 'summary',
    });
    const gemeldet = (res as { steerAdvisory?: { before: number } }).steerAdvisory!;
    // Unter dem Default-Budget waere `before` exakt 0 (der Graph liegt dort innerhalb aller
    // Budgets, s. T-S4). Ein Wert > 0 beweist, dass das enge Host-Budget angekommen ist.
    expect(gemeldet.before).toBeGreaterThan(0);
  });
});

describe('T-S3 (CR-GC-484): das BUDGET ist die Stellgroesse — sie ersetzt die Zielrichtung', () => {
  let weit: Rig;
  let eng: Rig;
  beforeEach(async () => {
    weit = await makeRig(configWith());                                                   // Default 11
    eng = await makeRig(configWith({ decompositionBreadth: { min: 1, warning: ENGES_BUDGET } })); // 2
  });
  afterEach(async () => { await dropRig(weit); await dropRig(eng); });

  it('derselbe Graph, zwei Budgets — der Score bewegt sich, und nur das Budget hat sich geaendert', () => {
    const w = steerOf(weit.harness, { ...DEFAULT_METRIC_POLICY });
    const e = steerOf(eng.harness, { ...DEFAULT_METRIC_POLICY, decompositionBreadth: { min: 1, warning: ENGES_BUDGET } });
    expect(w.score).toBe(0);          // innerhalb aller Budgets
    expect(e.score).toBeGreaterThan(0);
  });

  it('das enge Budget BENENNT die Stelle, das weite kennt sie nicht', () => {
    const w = steerOf(weit.harness, { ...DEFAULT_METRIC_POLICY });
    const e = steerOf(eng.harness, { ...DEFAULT_METRIC_POLICY, decompositionBreadth: { min: 1, warning: ENGES_BUDGET } });
    expect(w.worstAt).toBeNull();
    expect(e.worstAt).toEqual({ ruleId: 'RD-04', elementId: 'SYS-steering' });
    // Der Ueberschuss ist die Normierung selbst: (3 − 2)/2 bei zwei Kindern ueber Budget 2.
    expect(e.worst).toBeCloseTo(0.5, 9);
  });

  it('placebo-Gegenprobe: dasselbe Budget zweimal ergibt denselben Score', () => {
    const a = steerOf(eng.harness, { ...DEFAULT_METRIC_POLICY, decompositionBreadth: { min: 1, warning: ENGES_BUDGET } });
    const b = steerOf(eng.harness, { ...DEFAULT_METRIC_POLICY, decompositionBreadth: { min: 1, warning: ENGES_BUDGET } });
    expect(a).toEqual(b);
  });
});

describe('T-S4 (CR-GC-484): innerhalb aller Budgets ist der Score BLIND — dokumentiert, nicht bestanden', () => {
  let rig: Rig;
  beforeEach(async () => { rig = await makeRig(configWith()); });
  afterEach(async () => { await dropRig(rig); });

  /**
   * CR-SM-291 Satz H, hier festgenagelt: ein budgetbasiertes Mass hat im zulaessigen Bereich
   * keinen Gradienten. Das ist KEIN Bestehen — es ist die Grenze des Verfahrens, und sie muss
   * sichtbar sein, sonst liest sich ein Null-Ranking spaeter als Zustimmung.
   *
   * Dort fuehrt `readiness`: sie zaehlt weiter, was FEHLT. Die beiden sind komplementaer —
   * readiness misst ABDECKUNG, dieser Score AUSPRAEGUNG.
   */
  it('jeder Kandidat senkt den Score um 0, und die Rangfolge bleibt trotzdem deterministisch', async () => {
    expect(steerOf(rig.harness).score).toBe(0);
    const res = (await rig.tools.graph_suggest.handler({ k: 20, layer: 'arch' })) as GraphSuggestResult;
    for (const s of res.suggestions.filter((x) => x.applicable)) expect(s.score).toBe(0);
    const nochmal = (await rig.tools.graph_suggest.handler({ k: 20, layer: 'arch' })) as GraphSuggestResult;
    expect(rank(res)).toEqual(rank(nochmal));
  });

  it('und `readiness` ist dort NICHT blind — der komplementaere Partner traegt weiter', async () => {
    const rep = await rig.tools.graph_readiness.handler({ detail: false });
    const dims = rep.dimension_readiness as { dimension: string; score: number | null }[];
    expect(dims.some((d) => d.score !== null && d.score < 1)).toBe(true);
  });
});
