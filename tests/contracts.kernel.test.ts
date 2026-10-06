/**
 * CR-GC-719 — Vertragstests der Kernel-Schnittstellen, die bis hier keinen gebundenen TEST hatten.
 *
 * Je Vertrag ein Gutfall über den ECHTEN Erzeuger bzw. Leser und ein Abweisungsfall an der
 * Stelle, an der graphcode das Schema parst (R-32: jede Variante inkl. Abweisung):
 *   SCHEMA-graph-delta     → `GraphDeltaSchema.parse` in `GraphStore.commit` (Persistenzgrenze)
 *   SCHEMA-ontology-json   → `OntologyJsonSchema.parse` in `importOntologyGraph` / `heldBackTraces`
 *
 * CR-GC-748: der dritte Vertrag dieser Datei (SCHEMA-phase-readiness, `PhaseGateReadiness`) ist mit der
 * Phasenabdeckung entfallen — es gibt die Zeile nicht mehr, die er beschrieb.
 *
 * Keine Mocks: Kuzu auf Platte in mkdtemp, echte Tool-Registry.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SE_DESCRIPTOR, type Graph } from '@sigloch/graph-api-core';
import type { HarnessConfig } from '@sigloch/contracts/harness';
import { KuzuAdapter } from './helpers/store.js';
import { GraphStore, GraphDeltaSchema } from '../src/kernel/graph-store.js';
import { StoreLock } from '../src/kernel/store-lock.js';
import { OntologyJsonSchema, heldBackTraces } from '../src/kernel/harness-import.js';
import { GraphCodeHarness } from '../src/kernel/harness.js';

const SCOPE = { workspaceId: 'contracts-ws', systemId: 'contracts' };

function makeConfig(repoRoot: string): HarnessConfig {
  return { repoRoot, scope: SCOPE, consumerType: 'system', preCommitTimeout: 5000 };
}

// ---------------------------------------------------------------------------
// SCHEMA-graph-delta — FLOW-graph-delta, Gate → GraphStore → Platte
// ---------------------------------------------------------------------------

describe('SCHEMA-graph-delta wird an der Persistenzgrenze geprüft', () => {
  let tmp: string;
  let store: GraphStore;
  let storage: KuzuAdapter;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-contract-delta-'));
    mkdirSync(join(tmp, '.graphcode'), { recursive: true });
    storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    store = new GraphStore({
      storage,
      lock: new StoreLock(join(tmp, '.graphcode', 'owner.lock')),
      scope: SCOPE,
      repoRoot: tmp,
      storePath: null,
      descriptor: SE_DESCRIPTOR,
    });
    await store.open();
  });

  afterEach(async () => {
    await store.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  const node = { uid: 'FUNC-a', type: 'FUNC', name: 'a', description: '', attributes: {} };

  it('ein vertragstreues Delta landet auf der Platte', async () => {
    const candidate: Graph = { nodes: [node], edges: [] };
    const delta = { upsertNodes: [node], deleteNodes: [], upsertEdges: [], deleteEdges: [] };
    expect(GraphDeltaSchema.safeParse(delta).success).toBe(true);

    await store.commit(candidate, delta);

    expect((await store.load()).nodes.map((n) => n.uid)).toEqual(['FUNC-a']);
  });

  it('ein formfremdes Delta wird vor dem ersten Schreibzug abgewiesen — die Platte bleibt leer', async () => {
    // Ein Knoten ohne `type`: ohne den Parse schriebe saveNodes einen typlosen Knoten.
    const broken = { upsertNodes: [{ uid: 'FUNC-x', name: 'x' }], deleteNodes: [], upsertEdges: [], deleteEdges: [] };
    await expect(store.commit({ nodes: [], edges: [] }, broken as never)).rejects.toThrow(/type/);
    expect((await store.load()).nodes).toEqual([]);
  });

  it('ein Delta ohne deleteEdges ist kein Delta (Vertrag, nicht Teilform)', () => {
    expect(GraphDeltaSchema.safeParse({ upsertNodes: [], deleteNodes: [], upsertEdges: [] }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SCHEMA-ontology-json — FLOW-ontology-json, SSOT-Datei → Harness
// ---------------------------------------------------------------------------

describe('SCHEMA-ontology-json wird geprüft, wo die SSOT-Datei das Programm betritt', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-contract-ontology-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  const GOOD = {
    elements: [
      { id: 'FUNC-a', type: 'FUNC', name: 'a', description: '' },
      { id: 'FUNC-b', type: 'FUNC', name: 'b', description: '', realRef: { file: 'src/b.ts', symbol: 'b' } },
    ],
    traces: [{ source: 'FUNC-a', target: 'FUNC-b', type: 'compose' }],
  };

  it('eine vertragstreue Datei wird importiert; flache Attribute bleiben lose (eigene Verträge)', async () => {
    expect(OntologyJsonSchema.safeParse(GOOD).success).toBe(true);
    await harness.importGraph(GOOD);
    const uids = harness.getGraph().nodes.map((n) => n.uid);
    expect(uids).toEqual(expect.arrayContaining(['FUNC-a', 'FUNC-b']));
  });

  it('ein Element ohne name wird abgewiesen, und der Store bleibt unberührt', async () => {
    const vorher = harness.getGraph().nodes.map((n) => n.uid).sort();
    const broken = { elements: [{ id: 'FUNC-a', type: 'FUNC' }], traces: [] };
    await expect(harness.importGraph(broken as never)).rejects.toThrow(/name/);
    await harness.loadGraph();
    expect(harness.getGraph().nodes.map((n) => n.uid).sort()).toEqual(vorher);
  });

  it('der Leser der committeten Datei (heldBackTraces) weist eine formfremde Datei laut ab', () => {
    mkdirSync(join(tmp, 'docs', 'graph'), { recursive: true });
    writeFileSync(join(tmp, 'docs', 'graph', `${SCOPE.systemId}.graph.json`), JSON.stringify({ elements: [] }));
    expect(() => heldBackTraces(tmp, SCOPE.systemId, { nodes: [], edges: [] })).toThrow(/traces/);

    writeFileSync(join(tmp, 'docs', 'graph', `${SCOPE.systemId}.graph.json`), JSON.stringify(GOOD));
    expect(heldBackTraces(tmp, SCOPE.systemId, { nodes: [], edges: [] })).toEqual(expect.any(Array));
  });
});
