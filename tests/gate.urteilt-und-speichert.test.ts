/**
 * CR-GC-778 — das Gate urteilt und speichert, sonst nichts.
 *
 * Bis hierher rechnete das Gate nach dem Speichern drei Berichte (Architekturmass, Steuerwert,
 * Dateiliste) und haengte sie an seine Antwort. Das zog das Messwerk in den Kern zurueck und lief
 * bei jedem der rund zwanzig Aufrufer mit, obwohl nur zwei Werkzeuge die Berichte lesen. Jetzt
 * gibt das Gate neben dem Urteil den Stand davor und danach heraus; wer berichten will, rechnet
 * aus diesem Paar.
 *
 * Real disk Kuzu (temp dir), no mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR, type Graph } from '@sigloch/graph-api-core';
import { DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { zugBericht, mitBericht, ZugBericht } from '../src/kernel/measure/zug-bericht.js';

const FIXTURE = {
  elements: [
    { id: 'FUNC-a', type: 'FUNC', name: 'a', description: '' },
    { id: 'FUNC-b', type: 'FUNC', name: 'b', description: '' },
    { id: 'FUNC-c', type: 'FUNC', name: 'c', description: '' },
    { id: 'REQ-x', type: 'REQ', name: 'x', description: '' },
    { id: 'TEST-x', type: 'TEST', name: 'x test', description: '' },
  ],
  traces: [
    { source: 'FUNC-a', target: 'FUNC-b', type: 'compose' },
    { source: 'TEST-x', target: 'REQ-x', type: 'verify' },
  ],
};
const BRUECKE: MutateCommand[] = [
  { op: 'add-edge', edge: { sourceId: 'FUNC-b', targetId: 'FUNC-c', edgeType: 'compose', attributes: {} } },
];
const ILLEGAL: MutateCommand[] = [
  { op: 'add-edge', edge: { sourceId: 'REQ-x', targetId: 'TEST-x', edgeType: 'compose', attributes: {} } },
];

describe('CR-GC-778: das Gate urteilt und speichert', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-gate-778-'));
    const config: HarnessConfig = {
      repoRoot: tmp,
      scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
      consumerType: 'system',
      preCommitTimeout: 5000,
    };
    harness = new GraphCodeHarness(config, new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') }));
    await harness.initialize();
    await harness.importGraph(FIXTURE);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('die Antwort des Gates traegt keinen der drei Berichte mehr', async () => {
    const res = await harness.mutate(BRUECKE);
    expect(res.success).toBe(true);
    expect(res).not.toHaveProperty('fitAdvisory');
    expect(res).not.toHaveProperty('steerAdvisory');
    expect(res).not.toHaveProperty('workOrder');
  });

  it('das Gate importiert das Messwerk nicht', () => {
    const quelle = readFileSync(fileURLToPath(new URL('../src/kernel/gate.ts', import.meta.url)), 'utf8');
    expect(quelle).not.toMatch(/from '\.\/measure\//);
  });

  it('ein angewandter Zug gibt den Stand davor und danach heraus — danach ist der Stand des Stores', async () => {
    const vorher = harness.getGraph();
    const { result, states } = await harness.mutateWithStates(BRUECKE);
    expect(result.success).toBe(true);
    expect(states).not.toBeNull();
    expect(states!.before).toBe(vorher);
    expect(states!.after).toBe(harness.getGraph());
    expect(states!.after.edges.length).toBe(states!.before.edges.length + 1);
  });

  it('ein geblockter Zug gibt kein Paar heraus — es gibt nichts zu berichten', async () => {
    const { result, states } = await harness.mutateWithStates(ILLEGAL);
    expect(result.success).toBe(false);
    expect(states).toBeNull();
  });

  it('der Probelauf gibt das Paar heraus, ohne zu speichern', async () => {
    const { result, states } = await harness.mutateWithStates(BRUECKE, { dryRun: true });
    expect(result.success).toBe(true);
    expect(states!.after.edges.length).toBe(states!.before.edges.length + 1);
    await harness.loadGraph();
    expect(harness.getGraph().edges.length).toBe(FIXTURE.traces.length);
  });

  it('der Bericht entsteht aus dem Paar: Steuerwert und Dateiliste immer, das Architekturmass nur auf Wunsch', async () => {
    const outcome = await harness.mutateWithStates(BRUECKE);
    const ohne = mitBericht(outcome, DEFAULT_METRIC_POLICY, { fit: false });
    expect(ohne).toHaveProperty('steerAdvisory');
    expect(ohne).toHaveProperty('workOrder');
    expect(ohne).not.toHaveProperty('fitAdvisory');
    const mit = mitBericht(outcome, DEFAULT_METRIC_POLICY, { fit: true }) as { fitAdvisory: { delta: number[]; dimensions: string[] } };
    // Die Brueckenkante verschmilzt zwei Komponenten → viability steigt.
    expect(mit.fitAdvisory.delta[mit.fitAdvisory.dimensions.indexOf('viability')]).toBeGreaterThan(0);
  });

  it('der Bericht traegt seinen Vertrag — ohne Dateiliste ist es keiner', async () => {
    const { states } = await harness.mutateWithStates(BRUECKE);
    const bericht = zugBericht(states!.before, states!.after, DEFAULT_METRIC_POLICY, { fit: true });
    expect(ZugBericht.parse(bericht)).toEqual(bericht);
    const { workOrder: _ohne, ...rest } = bericht as ZugBericht;
    expect(ZugBericht.safeParse(rest).success).toBe(false);
  });

  it('ein geblockter Zug bleibt ohne Bericht', async () => {
    const outcome = await harness.mutateWithStates(ILLEGAL);
    const res = mitBericht(outcome, DEFAULT_METRIC_POLICY, { fit: true });
    expect(res).not.toHaveProperty('steerAdvisory');
    expect(res).not.toHaveProperty('fitAdvisory');
    expect(res).not.toHaveProperty('workOrder');
  });

  it('scheitert die Messung, bleibt der Zug angewandt und gemeldet — und die Antwort sagt, dass der Bericht fehlt', async () => {
    const outcome = await harness.mutateWithStates(BRUECKE);
    // Ein Stand, den keine Messung lesen kann: der Graph ohne Knotenliste.
    const kaputt = { ...outcome, states: { before: outcome.states!.before, after: { edges: [] } as unknown as Graph } };
    const res = mitBericht(kaputt, DEFAULT_METRIC_POLICY, { fit: true }) as { success: boolean; berichtFehlt?: string };
    expect(res.success).toBe(true);
    expect(res.berichtFehlt).toMatch(/Bericht zum Zug nicht berechenbar/);
    expect(res).not.toHaveProperty('steerAdvisory');
    expect(harness.getGraph().edges.length).toBe(FIXTURE.traces.length + 1);
    expect(zugBericht(outcome.states!.before, outcome.states!.after, DEFAULT_METRIC_POLICY, { fit: false })).not.toHaveProperty('berichtFehlt');
  });
});
