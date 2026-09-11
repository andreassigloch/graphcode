/**
 * GraphCodeHarness — the Apply-Gate over a single Kuzu store (MOD-harness).
 *
 * Realizes FCHAIN-apply-gate (6 steps) and the locked constraints:
 *   - REQ-one-gate-per-repo  : every edit (human OR AI) goes through `mutate()`;
 *     the author is logged as `consumerType`, never used to skip the gate (L1).
 *   - REQ-rule-enforcement   : `evaluateRules()` runs V3_RULES via SE_DESCRIPTOR;
 *     any `error`-severity violation BLOCKS the apply — nothing is persisted (L2).
 *   - REQ-confidence-tier    : MutateResult carries confidence + a 3-tier gate
 *     decision (auto-apply | suggest | block).
 *   - REQ-single-kuzu-owner  : exactly one StorageAdapter owns `.graphcode/kuzu`, and
 *     only GraphStore writes it and the working copy (CR-GC-503).
 *   - REQ-disk-persistence   : real harness uses a disk path, never `:memory:`.
 *   - REQ-import-se-ontology : ontology + rules come from @sigloch/contracts/se
 *     via graph-api-core SE_DESCRIPTOR — never forked, never a local parser.
 *   - REQ-graph-is-ssot      : the live Kuzu graph is the runtime SSOT; the
 *     materialized JSON is imported into it via `importGraph()`.
 *
 * Storage is injected (StorageAdapter) so tests can pass a KuzuAdapter on a
 * temp disk path; production wiring uses `createHarness()` with the repo path.
 *
 * @author andreas@siglochconsulting
 */
import { join } from 'node:path';
import type {
  StorageAdapter,
  Graph,
  GraphNode,
  GraphEdge,
  OntologyDescriptor,
} from '@sigloch/graph-api-core';
import {
  DefaultRuleEngine,
  createSeDescriptor,
  impactSlice,
  type ImpactSlice,
} from '@sigloch/graph-api-core';
import { type MetricPolicy } from '@sigloch/contracts/se';
import {
  HarnessConfigSchema,
  type HarnessConfig,
  type MutateCommand,
  type MutateResult,
  type RuleViolation,
} from '@sigloch/contracts/harness';
import { HookSystem } from './hooks.js';
import { impactedTests, TestImpactResultSchema } from './measure/test-selection.js';
import { CONFIG_FILENAME, DEFAULT_CONFIG, type LoadedConfig } from './config.js';
import {
  graphSnapshotRel,
  importOntologyGraph,
  seedFromJsonFile,
  applyReseed,
  type OntologyJson,
} from './harness-import.js';
import { StoreLock } from './store-lock.js';
import { listElements, type ElementFilter } from './element-slice.js';
import { type FitAdvisory } from './measure/fit-advisory.js';
import { GraphStore } from './graph-store.js';
import { Gate } from './gate.js';

export class GraphCodeHarness {
  private readonly config: HarnessConfig;
  private readonly storage: StorageAdapter;
  private readonly hooks: HookSystem;
  /** The repo config this harness operates under (CR-GC-329) — thresholds + source. */
  private readonly graphcodeConfig: LoadedConfig;
  /** The judging thresholds this harness evaluates MT-01/MT-02 with (CR-GC-329). */
  private readonly metricPolicy: MetricPolicy;
  /** The SE descriptor built with `metricPolicy` — the ONE this harness uses. */
  private readonly descriptor: OntologyDescriptor;
  /** The one owner of working copy + disk store (CR-GC-503); the harness only reads it. */
  private readonly store: GraphStore;
  /** The Apply-Gate (FCHAIN-apply-gate, CR-GC-504): judges a batch and hands accepted candidates to the store. */
  private readonly gate: Gate;
  /** Directory of the store this harness owns (lock + audit log live here). */
  private readonly storeDir: string;
  /** Serializes writes so a reseed never interleaves with a mutate (CR-GC-218 O3). */
  private writeChain: Promise<unknown> = Promise.resolve();

  constructor(
    config: HarnessConfig,
    storage: StorageAdapter,
    hooks?: HookSystem,
    opts?: {
      /**
       * Directory of the Kuzu store THIS harness's adapter opens — the O2 lock
       * (CR-GC-218) guards the store, not the repo. Defaults to the standard
       * layout `<repoRoot>/.graphcode`; a harness wired to a NON-default store
       * (tests: temp Kuzu + real repoRoot for the committed docs) MUST pass its
       * real store dir, or it false-positives against the repo's live owner.
       */
      lockDir?: string;
      /**
       * Actual Kuzu store file path the adapter opens. Enables the CR-GC-249
       * schema-drift guard (auto-reseed on meta-model change). Production wiring
       * (createHarness) passes it; leave unset in adapter-injection tests.
       */
      storePath?: string;
      /**
       * The repo's loaded `graphcode.config.jsonc` (CR-GC-329) — it carries the judging
       * thresholds of the architecture metrics, so the gate judges MT-01/MT-02 against
       * the SAME number `graph_metrics` reports. Production wiring (createHarness) passes
       * it; adapter-injection tests may omit it and get `DEFAULT_CONFIG`, i.e. contracts'
       * `DEFAULT_METRIC_POLICY` — the same named constant a repo without a config file
       * gets, never a second value.
       */
      graphcodeConfig?: LoadedConfig;
      /**
       * Der Store-Lock wurde uns entzogen (CR-GC-372): ein anderer Host hat ihn
       * übernommen, während dieser hier pulslos war. Der Aufrufer beendet daraufhin
       * seine Session — weiterschreiben hieße zwei Schreiber auf einem Kuzu-Store.
       */
      onLockLost?: () => void;
    },
  ) {
    this.config = HarnessConfigSchema.parse(config);
    this.storage = storage;
    this.hooks = hooks ?? new HookSystem({ preCommitTimeout: this.config.preCommitTimeout });
    // L2: rules come from the contracts-derived SE descriptor — no local parser.
    // CR-GC-329: the descriptor is BUILT with the policy; a constant with the threshold
    // baked in would judge next to the configured value instead of with it.
    this.graphcodeConfig = opts?.graphcodeConfig
      ?? { config: DEFAULT_CONFIG, source: 'default', path: join(this.config.repoRoot, CONFIG_FILENAME) };
    this.metricPolicy = this.graphcodeConfig.config.metricPolicy;
    this.descriptor = createSeDescriptor(this.metricPolicy);
    const engine = new DefaultRuleEngine(this.descriptor.version);
    engine.register(this.descriptor.rules ?? []);
    this.storeDir = opts?.lockDir ?? join(this.config.repoRoot, '.graphcode');
    this.store = new GraphStore({
      storage,
      lock: new StoreLock(join(this.storeDir, 'owner.lock'), { onLockLost: opts?.onLockLost }),
      scope: this.config.scope,
      repoRoot: this.config.repoRoot,
      storePath: opts?.storePath ?? null,
      descriptor: this.descriptor,
    });
    this.gate = new Gate({
      store: this.store,
      engine,
      descriptor: this.descriptor,
      hooks: this.hooks,
      metricPolicy: this.metricPolicy,
      repoRoot: this.config.repoRoot,
    });
  }

  /**
   * The directory of the store this harness owns — the anchoring point for every
   * per-store artifact (O2 `owner.lock`, the durable audit log). Per store, never
   * per repo: a temp-store harness must not touch the repo's live `.graphcode`.
   */
  getStoreDir(): string {
    return this.storeDir;
  }

  /**
   * The repo config in force (CR-GC-329) — the thresholds this harness judges with and
   * where they came from. Read by `graph_metrics`, so value and threshold leave the host
   * in ONE answer and a consumer never keeps a target value of its own.
   */
  getGraphcodeConfig(): LoadedConfig {
    return this.graphcodeConfig;
  }

  /** The judging thresholds of the architecture metrics — same object the gate uses. */
  getMetricPolicy(): MetricPolicy {
    return this.metricPolicy;
  }

  /**
   * Die Regel-IDs, die DIESE Harness geladen hat (CR-GC-428) — der Katalog, den
   * `evaluateRules()` und damit das Gate wirklich fährt.
   *
   * Gebraucht, weil er kleiner ist als `ALL_RULE_DEFS`: der Steering-Pfad wertet
   * zusätzlich die BQ- und ND-Regeln aus (CR-GC-287: ND bleibt Steering, nie
   * Gate-Blocker).
   * Ohne diese Liste müsste die Auswertungsfläche die Differenz als Konstante
   * pflegen — und eine gepflegte Tabelle driftet (CR-SM-235). Ausgelesen aus dem
   * registrierten Descriptor, nie notiert.
   */
  getLoadedRuleIds(): string[] {
    return (this.descriptor.rules ?? []).map((rule) => rule.id);
  }

  /**
   * „Ist diese Dimension zu schwach?" — die EINE Zahl fuer Fokuswahl und `ready`-Flag
   * (CR-GC-329). Seit contracts 4.0.0 (CR-SM-235) verlangt `computeReadiness` sie als
   * Parameter ohne Default: se-steering hatte 0.7, `generate.ts` 0.8, und der Konsument
   * konnte nicht wissen, welche galt. Jetzt gibt es nur diese hier.
   */
  getFocusThreshold(): number {
    return this.graphcodeConfig.config.focusThreshold;
  }

  /** Run a write body with exclusive access — mutate/reseed never interleave (O3). */
  private serializeWrite<T>(body: () => Promise<T>): Promise<T> {
    const result = this.writeChain.then(body, body);
    // Keep the chain alive across failures so one error can't wedge the queue.
    this.writeChain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /** Expose the hook system so consumers (CR-102) can register hooks. */
  getHooks(): HookSystem {
    return this.hooks;
  }

  /** Initialize the store, then load the persisted graph into memory. */
  async initialize(): Promise<void> {
    // O2 lock, CR-GC-249 schema guard and the initial load belong to the owner (CR-GC-503).
    await this.store.open();
  }

  /** Load the persisted graph (disk Kuzu) into the in-memory working copy. */
  async loadGraph(): Promise<Graph> {
    return this.store.load();
  }

  /** Read-only view of the current in-memory graph (gate working copy only). */
  getGraph(): Graph {
    return this.store.current();
  }

  /**
   * The single Kuzu-backed store. Read queries (impact/expand/elements) route
   * through here so the agent KNOWS the right elements via a graph query — not
   * a TS-BFS over the in-memory mirror. The in-memory `graph` stays reserved for
   * the gate's rule-eval on the working copy during mutate().
   */
  getStore(): StorageAdapter {
    return this.storage;
  }

  /** Repo root this harness owns (the `.graphcode/` workspace + `docs/` sync target). */
  getRepoRoot(): string {
    return this.config.repoRoot;
  }

  /** The graph scope (workspaceId/systemId) this harness owns. */
  getScope(): HarnessConfig['scope'] {
    return this.config.scope;
  }

  /**
   * Exact blast-radius (REQ-query-precision): the DEPENDENTS of `rootId` —
   * incoming edges (TEST -verify-> REQ, MOD -realize-> REQ point INTO the root).
   *
   * Seit CR-GC-365 (Weg b) ist die Traversierung die GETEILTE Funktion
   * `impactSlice` aus `@sigloch/graph-api-core` — dieselbe, die graph-view-edit
   * auf dem geladenen Graphen aufruft. Ein Schreiber der Semantik, zwei Leser;
   * knotengleich zur frueheren Kuzu-Query `(m)-[*1..depth]->(root)`
   * (Konformanztest im Paket). Rollen seed|whitebox|blackbox gemaess
   * SPIKE-GC-minimal-whitebox §8; die Blackbox-Front (depth+1) materialisiert
   * den Schnitt. Facade wie `listElements`: Store + Scope sammelt der Aufrufer
   * nicht selbst ein.
   */
  async impact(rootId: string, depth: number): Promise<ImpactSlice> {
    const graph = await this.storage.loadGraph(this.config.scope);
    return impactSlice(graph, [rootId], depth);
  }

  /**
   * Direction-aware on-demand deepening (REQ-progressive-expansion) via Kuzu
   * re-traversal — no originals store. `callers` = incoming (dependents),
   * `all` = both directions; trace/test branches use the full neighbourhood and
   * are filtered to the relevant edge types by the caller.
   */
  async subgraph(rootId: string, depth: number, direction: 'in' | 'out' | 'both'): Promise<Graph> {
    return this.storage.getSubgraph(rootId, depth, direction);
  }

  /**
   * FUNC-resolve-tests-from-code — directed code→REQ→TEST resolution (CR-GC-204).
   *
   * A code changeset (MOD/FUNC) cannot reach its TESTs through plain incoming
   * `impact()`: the chain is `TEST -verify-> REQ <-satisfy- FUNC -allocate-> MOD`,
   * which turns direction TWICE. So from a changed code node we walk the
   * realization traces DIRECTIONALLY to the spec nodes it fulfils, then collect the
   * TESTs that verify those specs:
   *   - `satisfy` (out)   : a MOD/FUNC/FCHAIN → the REQ/UC it fulfils
   *   - `allocate` (in)   : a MOD ← the FUNC allocated to it (the module's functions)
   *   - `verify`   (in)   : a spec ← the TEST that verifies it
   *
   * This is NOT a second blast-radius: it filters ONE graph read by trace semantics —
   * exactly as graph_expand prunes by edge type. A REQ changeset degenerates to
   * `verify`-dependents only — identical to the path graph_tests took before
   * (REQ → its verifying TESTs).
   *
   * The traversal itself lives in `./test-selection.ts` as a pure function over a
   * loaded graph (CR-GC-381), because the measurement instrument
   * `scripts/test-selection-audit.mjs` needs the SAME semantics over the committed
   * snapshot — where no second Kuzu handle may exist (REQ-single-kuzu-owner). One
   * implementation, two callers, no drift.
   *
   * Returns the directed subgraph: the changed nodes ∪ reached spec anchors ∪ the
   * TESTs verifying them. The TEST nodes are the impacted test set.
   */
  /**
   * Fassade auf `element-slice.ts` (CR-GC-388). Die Implementierung wohnt dort —
   * sie teilt mit dem Gate weder FLOW noch REQ und ist deshalb ein eigenes MOD.
   * Diese Zeile bleibt, weil der Aufrufer Store und Scope nicht selbst einsammeln
   * soll: eine Implementierung, ein bequemer Einstieg, kein zweiter Pfad.
   */
  async listElements(filter: ElementFilter): Promise<GraphNode[]> {
    return listElements(this.storage, this.config.scope, filter);
  }

  async testImpact(changeSet: string[], depth: number): Promise<Graph> {
    // The full store read is the same primitive `listElements` (element-slice.ts) uses; a plain
    // `getSubgraph(both)` fetch on the changeset would NOT reach the tests (it is the
    // UNION of pure-in and pure-out reachability, and a code node reaches its TESTs
    // only by turning direction: `MOD →satisfy→ REQ ←verify← TEST`).
    const graph = await this.storage.loadGraph(this.config.scope);
    // FLOW-impacted-tests: der Resolver-Output passiert seinen Vertrag, BEVOR er die
    // Modulgrenze verlaesst (SCHEMA-impacted-tests). Ein leises `anchors: undefined`
    // waere hier sonst erst beim Konsumenten als leere Auswahl sichtbar geworden.
    const resolved = TestImpactResultSchema.parse(impactedTests(graph, changeSet, depth));
    return { nodes: resolved.nodes as GraphNode[], edges: resolved.edges as GraphEdge[] };
  }

  /**
   * FCHAIN-apply-gate — the single Apply-Gate (L1). Steps:
   *   1. pre-commit hooks  → block aborts before any mutation.
   *   2. apply commands to a candidate copy of the working graph.
   *   3. evaluateRules()   → violations.
   *   4. persist iff no error-severity violation; otherwise BLOCK (L2).
   *   5. post-apply hooks.
   *   6. return MutateResult (success, mutations, violations, confidence, tier).
   *
   * Serialized (O3): a mutate never interleaves with a reseed or another mutate.
   *
   * `dryRun` (CR-GC-234): the FULL gate verdict (hooks, rules, delta semantics)
   * with NOTHING persisted — the in-memory working copy keeps the applied state so
   * a sequential replay previews CUMULATIVELY (batch N+1 is judged on top of batch
   * N), which per-batch rollback could not. The caller MUST restore the working
   * copy afterwards via `loadGraph()` (graph_merge does). Post-apply hooks are
   * skipped on a dry run (no phantom live-update/learning events).
   */
  async mutate(
    commands: MutateCommand[],
    opts?: { dryRun?: boolean },
  ): Promise<MutateResult & { fitAdvisory?: FitAdvisory }> {
    return this.serializeWrite(() => this.gate.apply(commands, opts?.dryRun ?? false));
  }

  /**
   * Run V3_RULES against the current in-memory graph. Standalone, no mutation.
   * Maps graph-api-core RuleViolation → contracts harness RuleViolation.
   */
  evaluateRules(): RuleViolation[] {
    return this.gate.evaluate(this.store.current());
  }

  /**
   * Import a materialized OntologyGraph (elements/traces) into the store, making
   * the DB the runtime SSOT (REQ-graph-is-ssot / REQ-import-se-ontology).
   * The mapping + the REQ-with-test surfacing live in harness-import.ts (CR-GC-260);
   * this is the harness-facing entry point, unchanged in signature.
   */
  async importGraph(
    ontology: OntologyJson,
    opts?: { rejectUnverifiedReqs?: boolean },
  ): Promise<{ nodes: number; edges: number; unverifiedReqs: string[] }> {
    return importOntologyGraph(this.store.importTarget(), ontology, opts);
  }

  /** Load + import the materialized graph JSON from `<repoRoot>/docs/graph/`. */
  async seedFromJson(
    relPath = graphSnapshotRel(this.config.scope.systemId),
    opts?: { rejectUnverifiedReqs?: boolean },
  ): Promise<{ nodes: number; edges: number; unverifiedReqs: string[] }> {
    return seedFromJsonFile(this.store.importTarget(), relPath, opts);
  }

  /**
   * Re-sync the live store to the committed SSOT JSON (CR-GC-203 item 4).
   * Serialized (O3): a reseed never runs while a mutate is mid-flight (or vice versa),
   * so no writer ever sees the half-cleared store during the DETACH-DELETE + re-import.
   * The clear+re-import itself is harness-import.ts `applyReseed`.
   */
  async reseed(relPath = graphSnapshotRel(this.config.scope.systemId)): Promise<{ nodes: number; edges: number }> {
    return this.serializeWrite(() => applyReseed(this.store.importTarget(), relPath));
  }

  /** Release the store handle + the ownership lock (single-writer cleanup). */
  async close(): Promise<void> {
    return this.store.close();
  }

  // -- internals ------------------------------------------------------------
}
