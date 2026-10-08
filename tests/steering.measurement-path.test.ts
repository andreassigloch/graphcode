/**
 * T-0 (CR-GC-340) — ONE measurement path.
 *
 * `generationStep()` and the `steeringDelta` branch of the dryRun
 * verdict must return the SAME violation set, the SAME per-dimension readiness
 * scores and the SAME blocking-error count for the SAME graph. If they drift,
 * claims a), b) and c) are all void no matter how green their own tests are:
 * every one of them is stated in these numbers.
 *
 * Regression guard for the bug class CR-GC-303/324. The flat export encoding
 * (CR-216/219) lifts `attributes.*` to the top level, while the contracts rules
 * read `element.attributes?.x`. Any surface that measures via
 * `JSON.parse(exportGraphJson(...))` therefore sees R-19/R-20/R-26/VR-01/AF-01..05
 * differently from the surfaces that go through `takeSteeringSnapshot` — which
 * silently reorders the focus (and shifts the findings per stage). `ARCH_FIXTURE` carries `realRef`,
 * `testRefs` and `SYS.analysisFreshness` precisely so that divergence is visible
 * here instead of in production.
 *
 * Real disk Kuzu (temp dir), no mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';
import { generationStep } from '../src/loop/generate.js';
import { takeSteeringSnapshot } from '../src/kernel/measure/steering-snapshot.js';
import { ARCH_FIXTURE, makeSteeringConfig } from './fixtures/steering-graphs.js';
import { alsFormatE } from './helpers/format-e.js';
import type { SteeringDelta } from '../src/kernel/measure/steering-snapshot.js';
import { STAGE_SETS } from '@sigloch/contracts/se';

/** The attribute-borne bindings whose judgement flips on a flattened encoding. */
const ATTRIBUTE_BORNE_RULES = ['R-19', 'R-20', 'R-26', 'VR-01', 'AF-01', 'AF-02', 'AF-03', 'AF-04', 'AF-05'];

describe('T-0 (CR-GC-340): every steering surface measures the same graph', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-measure-path-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeSteeringConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(ARCH_FIXTURE);
    tools = bindToolsToHarness(harness);
  });

  afterAll(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  const snapshot = () =>
    takeSteeringSnapshot(harness.getGraph(), harness.getMetricPolicy());

  it('the fixture actually exercises the attribute-borne rules (otherwise this file proves nothing)', () => {
    const snap = snapshot();
    const fired = new Set(snap.violations.map((v) => v.rule_id));
    // Not all of them may fire — but the fixture must put BOTH sides of the
    // attribute question on the table, or a flattening regression stays invisible.
    const exercised = ATTRIBUTE_BORNE_RULES.filter((r) => fired.has(r));
    expect(exercised.length).toBeGreaterThan(0);

    // The satisfied side: FUNC-parse carries realRef, TEST-parse carries testRefs,
    // so R-20/R-19 must NOT fire on them. On a flattened encoding they would.
    const offenders = snap.violations
      .filter((v) => (v.rule_id === 'R-20' && v.element_id === 'FUNC-parse') || (v.rule_id === 'R-19' && v.element_id === 'TEST-parse'))
      .map((v) => `${v.rule_id}/${v.element_id}`);
    expect(offenders).toEqual([]);

    // ... and the unsatisfied side must fire, or the rules are simply off.
    const unbound = snap.violations
      .filter((v) => (v.rule_id === 'R-20' && v.element_id === 'FUNC-render') || (v.rule_id === 'R-19' && v.element_id === 'TEST-render'))
      .map((v) => v.rule_id)
      .sort();
    expect(unbound).toEqual(['R-19', 'R-20']);
  });

  // CR-GC-562: der Vergleich `nextStep` gegen `generationStep` ist weggefallen, weil es
  // `nextStep` nicht mehr gibt — zwei Rangwahlen auf einer Messung, eine davon ohne Leser.
  // Die Zusicherung, um die es hier geht, bleibt: generationStep misst ueber den GETEILTEN
  // Snapshot und nicht ueber eine eigene Graph-Abbildung (die Lektion aus CR-GC-324).
  it('generationStep reports the blocking errors and the findings per stage of the shared snapshot', async () => {
    const snap = snapshot();
    const gen = generationStep(harness.getGraph(), harness.getMetricPolicy(), 'steering fixture', harness.getFocusThreshold());

    expect(gen.blockingErrors).toBe(snap.blockingErrors);

    // CR-GC-757: the snapshot carries all 13 stages in order; the step exposes the ones with findings,
    // with the same count, in the same order (before: percentage scores of the applicable dimensions).
    expect(snap.stages.map((s) => s.name)).toEqual([...STAGE_SETS, 'immer']);
    // CR-GC-766: counted are the rules the display counts — not the text rules (BQ) of their own task.
    expect(snap.stages.reduce((n, s) => n + s.findings, 0)).toBe(snap.violations.filter((v) => !v.rule_id.startsWith('BQ-')).length);
    const fromSnapshot = snap.stages.filter((s) => s.findings > 0).map((s) => ({ stage: s.name, findings: s.findings }));
    expect(fromSnapshot.length).toBeGreaterThan(0);
    expect(gen.readiness).toEqual(fromSnapshot);

    // Die Fokus-Stufe muss eine sein, in der der Snapshot wirklich Befunde zaehlt.
    expect(gen.focusStage).not.toBeNull();
    expect(gen.focusStage!.startsWith('seed:')).toBe(false);
    expect(fromSnapshot.some((s) => s.stage === gen.focusStage)).toBe(true);
    expect(gen.focusKey!.split(':')[0]).toBe(gen.focusStage);
  });

  it('the dryRun steeringDelta measures from the same before-state as the other two', async () => {
    const snap = snapshot();

    // A no-op-shaped preview: adding an edge that is already there changes nothing,
    // so `before` and `after` of the delta must both equal the standing measurement.
    const res = (await tools.graph_mutate.handler({
      formatE: alsFormatE([{ op: 'add-edge', edge: { sourceId: 'FUNC-parse', targetId: 'MOD-parsing', edgeType: 'allocate', attributes: {} } }], harness),
      dryRun: true,
      consumerId: 't-0',
    })) as { steeringDelta?: SteeringDelta };

    const delta = res.steeringDelta;
    expect(delta).toBeDefined();
    expect(delta!.blockingErrors.before).toBe(snap.blockingErrors);

    // CR-GC-757: the delta lists exactly the stages with findings — and since nothing changes,
    // before and after both equal the standing count, delta 0.
    const standing = Object.fromEntries(
      snap.stages.filter((s) => s.findings > 0).map((s) => [s.name, { before: s.findings, after: s.findings, delta: 0 }]),
    );
    expect(Object.keys(standing).length).toBeGreaterThan(0);
    expect(delta!.stages).toEqual(standing);
    expect(delta!.blockingErrors.after).toBe(snap.blockingErrors);
  });

  it('the graph is unchanged by measuring it — all three surfaces are read-only', async () => {
    const before = harness.getGraph();
    const nodes = before.nodes.length;
    const edges = before.edges.length;

    generationStep(harness.getGraph(), harness.getMetricPolicy(), 'steering fixture', harness.getFocusThreshold());
    await tools.graph_readiness.handler({});

    expect(harness.getGraph().nodes.length).toBe(nodes);
    expect(harness.getGraph().edges.length).toBe(edges);
  });

  it('is deterministic: two consecutive snapshots of an untouched graph are identical', () => {
    const a = snapshot();
    const b = snapshot();
    const key = (s: typeof a) =>
      JSON.stringify({
        violations: s.violations.map((v) => `${v.rule_id}/${v.element_id}/${v.severity}`).sort(),
        blockingErrors: s.blockingErrors,
        stages: s.stages.map((x) => `${x.name}=${x.findings}`),
      });
    expect(key(a)).toBe(key(b));
    // Not vacuous: the fixture has findings, and the stage counts are part of the key.
    expect(a.stages.some((x) => x.findings > 0)).toBe(true);
  });

  // CR-GC-562: REQ-steering-post woertlich — „derselbe Graph liefert dieselbe EMPFEHLUNG".
  // Der Test darueber prueft den Snapshot; das ist die Messung, nicht die Empfehlung.
  // Die Zusicherung stand in `tests/steering.test.ts` an `nextStep` und waere mit der
  // Datei ersatzlos gefallen — sie gehoert hierher, an den verbliebenen Treiber.
  it('is deterministic: the same graph yields the same recommendation, prompt included', () => {
    const a = generationStep(harness.getGraph(), harness.getMetricPolicy(), 'steering fixture', harness.getFocusThreshold());
    const b = generationStep(harness.getGraph(), harness.getMetricPolicy(), 'steering fixture', harness.getFocusThreshold());
    expect(b).toEqual(a);
    expect(b.prompt).toBe(a.prompt);
    expect(b.focusKey).toBe(a.focusKey);
  });
});
