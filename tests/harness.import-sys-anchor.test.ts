/**
 * TEST-import-sys-anchor (CR-GC-302) — every import path leaves exactly ONE SYS node.
 *
 * The SYS node is the anchor for AF-01..05 (the analysis-freshness stamps live in
 * `SYS.attributes.analysisFreshness.<artifact>.graphVersion`), for the R-28 family,
 * and for `graph_generate`'s intent (read from `SYS.description`). Without one, the
 * AF rules take their vacuous exemption ("nothing to anchor on yet") and a missing
 * analysis goes SILENT instead of loud — an imported graph is then un-governable in
 * exactly the dimension a viewer now sources from the substrate.
 *
 * ensure-semantics, never overwrite: a source that brings its own SYS is left
 * byte-identical.
 *
 * Real disk Kuzu (temp dir, never :memory:). No mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { takeSteeringSnapshot } from '../src/steering-snapshot.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

const SYSTEM_ID = 'testsystem';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: SYSTEM_ID },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

/** A code-shaped import: FUNC/MOD only, exactly what graphify emits — no SYS. */
const WITHOUT_SYS = {
  elements: [
    { id: 'MOD-core', type: 'MOD', name: 'core', description: 'Kernmodul.' },
    { id: 'FUNC-run', type: 'FUNC', name: 'run()', description: 'Startet den Lauf.' },
  ],
  traces: [{ source: 'FUNC-run', target: 'MOD-core', type: 'allocate' }],
};

/** The same import, but the source carries its own SYS — it must survive untouched. */
const WITH_SYS = {
  elements: [
    {
      id: 'SYS-eigenes',
      type: 'SYS',
      name: 'Eigenes System',
      description: 'Die mitgebrachte Intention.',
      analysisFreshness: { conops: { graphVersion: 7 } },
    },
    { id: 'MOD-core', type: 'MOD', name: 'core', description: 'Kernmodul.' },
  ],
  traces: [],
};

describe('TEST-import-sys-anchor: every import leaves exactly one SYS (CR-GC-302)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-import-sys-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('creates SYS-<systemId> when the source brings none', async () => {
    await harness.importGraph(WITHOUT_SYS);
    const sys = harness.getGraph().nodes.filter((n) => n.type === 'SYS');
    expect(sys).toHaveLength(1);
    expect(sys[0]?.uid).toBe(`SYS-${SYSTEM_ID}`);
    expect(sys[0]?.name).toBe(SYSTEM_ID);
  });

  it('persists the anchor to the store, not just the working copy', async () => {
    await harness.importGraph(WITHOUT_SYS);
    // Re-read from disk Kuzu: an anchor that only exists in memory would be gone
    // on the next process and the graph silently un-anchored again.
    const reloaded = await harness.loadGraph();
    expect(reloaded.nodes.filter((n) => n.type === 'SYS')).toHaveLength(1);
  });

  it('leaves a source-supplied SYS byte-identical — ensure, never overwrite', async () => {
    await harness.importGraph(WITH_SYS);
    const sys = harness.getGraph().nodes.filter((n) => n.type === 'SYS');
    expect(sys).toHaveLength(1);
    expect(sys[0]?.uid).toBe('SYS-eigenes');
    expect(sys[0]?.description).toBe('Die mitgebrachte Intention.');
    // The stamp the source carried must survive — clobbering it would reset the
    // freshness bookkeeping the anchor exists for in the first place.
    expect(sys[0]?.attributes?.['analysisFreshness']).toEqual({ conops: { graphVersion: 7 } });
  });

  it('does not add a second SYS when the source brings several', async () => {
    await harness.importGraph({
      elements: [
        { id: 'SYS-a', type: 'SYS', name: 'A', description: 'Erstes.' },
        { id: 'SYS-b', type: 'SYS', name: 'B', description: 'Zweites.' },
      ],
      traces: [],
    });
    // Two SYS is a modelling problem the rules report — the importer must not make
    // it three by "helpfully" adding its own.
    expect(harness.getGraph().nodes.filter((n) => n.type === 'SYS')).toHaveLength(2);
  });

  it('is idempotent across repeated imports — no SYS-<systemId> duplicate accrues', async () => {
    await harness.importGraph(WITHOUT_SYS);
    await harness.importGraph(WITHOUT_SYS);
    expect(harness.getGraph().nodes.filter((n) => n.type === 'SYS')).toHaveLength(1);
  });

  // The AF rules are NOT in the gate catalog: SE_DESCRIPTOR is [...V3_RULES, ...MT_RULES]
  // and AF_RULES ship only in `evaluateAllRules` (the steering/full catalog). So the
  // "is the gap loud?" question has to be asked where AF is actually evaluated —
  // `harness.evaluateRules()` would answer an empty list no matter what the graph says.
  it('AF-01..05 fire as warnings after the anchored import — the gap is loud, not vacuous', async () => {
    await harness.importGraph(WITHOUT_SYS);
    const af = takeSteeringSnapshot(harness.getGraph(), DEFAULT_METRIC_POLICY).violations.filter((v) => v.rule_id.startsWith('AF-'));
    // Before the anchor existed these were silently skipped ("nothing to anchor on
    // yet") — a never-performed analysis looked exactly like a completed one.
    expect(af.map((v) => v.rule_id).sort()).toEqual(['AF-01', 'AF-02', 'AF-03', 'AF-04', 'AF-05']);
    expect(af.every((v) => v.severity === 'warning')).toBe(true);
    // …and they point AT the anchor, which is the whole reason it exists.
    expect(af.every((v) => v.element_id === `SYS-${SYSTEM_ID}`)).toBe(true);
  });

  it('without any SYS the AF rules stay vacuously silent — the failure mode this CR removes', () => {
    // Pinned as the contrast case, straight from the contracts implementation
    // (`analysisFreshnessPresence`: no SYS ⇒ return []). Without the anchor an
    // un-analysed graph is indistinguishable from a fully analysed one — which is
    // exactly why the importer must supply it rather than leaving it to the source.
    const af = takeSteeringSnapshot({
      nodes: [{ uid: 'MOD-core', type: 'MOD', name: 'core', description: '', attributes: {} }],
      edges: [],
    }, DEFAULT_METRIC_POLICY).violations.filter((v) => v.rule_id.startsWith('AF-'));
    expect(af).toEqual([]);
  });
});
