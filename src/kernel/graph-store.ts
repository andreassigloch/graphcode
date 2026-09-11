/**
 * GraphStore — der EINE Besitzer des Graph-Zustands (CR-GC-503).
 *
 * Die Arbeitskopie im Speicher und der Kuzu-Store auf Platte werden nur hier geschrieben:
 * oeffnen (Store-Lock O2, Schema-Guard CR-GC-249, laden), einen vom Gate angenommenen
 * Kandidaten uebernehmen, fuer Import und Reseed ersetzen bzw. leeren, schliessen.
 * Alle anderen lesen `current()` oder fragen den Store lesend ab.
 *
 * Bis CR-GC-503 setzten drei Stellen in GraphCodeHarness dieselbe Variable: loadGraph,
 * der Import-Port (`setGraph`) und applyMutation — dort in place, mit Rueckrollen per
 * Snapshot, wenn das Gate blockte. Im Modell trug FLOW-graph-state deshalb zehn Produzenten.
 *
 * Reihenfolge beim Uebernehmen: erst auf Platte, dann im Speicher. Scheitert das Schreiben,
 * bleibt die Arbeitskopie beim gespeicherten Stand, statt dem Store vorauszulaufen.
 *
 * Die Schreib-Serialisierung (O3) bleibt beim Harness: sie klammert Gate UND Reseed, also
 * mehr als den Store.
 *
 * @author andreas@siglochconsulting
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { StorageAdapter, Graph, GraphNode, GraphEdge, OntologyDescriptor } from '@sigloch/graph-api-core';
import type { HarnessConfig } from '@sigloch/contracts/harness';
import type { StoreLock } from './store-lock.js';
import { graphSnapshotRel, applyReseed, type ImportTarget } from './harness-import.js';
import { schemaFingerprint, readStoredFingerprint, writeStoredFingerprint, resetKuzuStore } from './schema-guard.js';

/** Was ein angenommener Batch im Store aendert. */
export interface GraphDelta {
  upsertNodes: GraphNode[];
  deleteNodes: string[];
  upsertEdges: GraphEdge[];
  deleteEdges: Array<{ sourceId: string; targetId: string; edgeType: string }>;
}

export interface GraphStoreOptions {
  readonly storage: StorageAdapter;
  /** Store-ownership lock (CR-GC-218 O2): one writer per `.graphcode` store. */
  readonly lock: StoreLock;
  readonly scope: HarnessConfig['scope'];
  readonly repoRoot: string;
  /**
   * Actual Kuzu store file path the injected adapter opens (CR-GC-249). Present
   * only in production wiring (createHarness); when set, open() runs the
   * schema-drift guard. Absent for tests that inject an adapter on an arbitrary
   * temp path — the guard stays off so it never touches the wrong file.
   */
  readonly storePath: string | null;
  readonly descriptor: OntologyDescriptor;
}

export class GraphStore {
  /** In-memory working copy; the disk store is the SSOT it mirrors. */
  private graph: Graph = { nodes: [], edges: [] };

  constructor(private readonly opts: GraphStoreOptions) {}

  /** Claim the store, guard its schema, load the persisted graph into memory. */
  async open(): Promise<void> {
    const { lock, storage, storePath, scope, repoRoot, descriptor } = this.opts;
    // O2: claim single ownership of this store BEFORE opening it — a second writer
    // on the same `.graphcode` is refused loudly (StoreOwnershipError), not silently
    // clobbered. Run a second agent in its own git worktree for its own store.
    lock.acquire();
    try {
      // CR-GC-249: auto-reseed on meta-model schema drift. A persistent store freezes
      // its rel-table FROM/TO pairs at creation; when the meta-model gains a pair (e.g.
      // FUNC→FUNC compose) the frozen schema rejects the new edge. If the store's DDL
      // fingerprint no longer matches the current descriptor, delete the store (so init
      // regenerates the DDL) and reseed from the committed SSOT — automating the manual
      // `rm .graphcode/kuzu*` + reseed recovery. Only runs in production wiring (a known
      // store path); the marker lives beside the store file.
      const markerDir = storePath ? dirname(storePath) : null;
      // CR-GC-374: the SSOT to reseed from is docs/graph/<systemId>.graph.json — the
      // file graph_export actually writes.
      const snapshotRel = graphSnapshotRel(scope.systemId);
      const graphJson = join(repoRoot, snapshotRel);
      const current = schemaFingerprint(descriptor);
      const stored = markerDir ? readStoredFingerprint(markerDir) : null;
      // Only reset when we have a stored fingerprint that differs AND a SSOT to reseed
      // from. A store with no marker (pre-249 or fresh) is adopted at the current
      // fingerprint without a wipe.
      const staleSchema =
        markerDir !== null &&
        stored !== null &&
        stored !== current &&
        existsSync(storePath!) &&
        existsSync(graphJson);
      if (staleSchema) resetKuzuStore(storePath!);

      await storage.initialize();
      await this.load();

      if (staleSchema) await applyReseed(this.importTarget(), snapshotRel);
      if (markerDir && stored !== current) writeStoredFingerprint(markerDir, current);
    } catch (err) {
      lock.release();
      throw err;
    }
  }

  /** Load the persisted graph (disk Kuzu) into the working copy — also the restore after a dryRun. */
  async load(): Promise<Graph> {
    this.graph = await this.opts.storage.loadGraph(this.opts.scope);
    return this.graph;
  }

  /** The working copy, read-only by convention: nobody outside this class assigns it. */
  current(): Graph {
    return this.graph;
  }

  /**
   * Take over a candidate the gate accepted. With a delta it is written to disk first;
   * without one (dryRun, CR-GC-234) it only becomes the working copy, so a sequential
   * replay previews cumulatively — the caller restores the store state via load().
   */
  async commit(candidate: Graph, delta: GraphDelta | null): Promise<void> {
    if (delta) {
      const { storage } = this.opts;
      // Order: nodes before edges (FK), deletes last.
      if (delta.upsertNodes.length) await storage.saveNodes(delta.upsertNodes);
      if (delta.upsertEdges.length) await storage.saveEdges(delta.upsertEdges);
      if (delta.deleteEdges.length) await storage.deleteEdges(delta.deleteEdges);
      if (delta.deleteNodes.length) await storage.deleteNodes(delta.deleteNodes);
    }
    this.graph = candidate;
  }

  /**
   * The port the import path gets (CR-GC-260): replace and clear — no store handle and
   * no setter, so harness-import.ts cannot write past the owner.
   */
  importTarget(): ImportTarget {
    const { storage, repoRoot, scope } = this.opts;
    return {
      repoRoot,
      systemId: scope.systemId,
      replace: async (graph: Graph) => {
        await storage.saveNodes(graph.nodes);
        await storage.saveEdges(graph.edges);
        this.graph = graph;
      },
      clear: async () => {
        // `deleteNodes` issues DETACH DELETE — incident edges go with each node.
        const uids = this.graph.nodes.map((n) => n.uid);
        if (uids.length) await storage.deleteNodes(uids);
        this.graph = { nodes: [], edges: [] };
      },
    };
  }

  /** Release the store handle + the ownership lock (single-writer cleanup). */
  async close(): Promise<void> {
    try {
      await this.opts.storage.shutdown();
    } finally {
      this.opts.lock.release();
    }
  }
}
