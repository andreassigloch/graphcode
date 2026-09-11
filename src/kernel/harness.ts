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
  RuleViolation as CoreRuleViolation,
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
  MutateCommandSchema,
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
import { setExportPending } from './export-marker.js';
import { computeFitAdvisory, computeSteerAdvisory, type FitAdvisory, type SteerAdvisory } from './measure/fit-advisory.js';
import { congruenceWorkOrder, type WorkOrder } from './measure/work-order.js';
import { GraphStore } from './graph-store.js';
import { applyCommands, cloneGraph } from './apply-commands.js';


export class GraphCodeHarness {
  private readonly config: HarnessConfig;
  private readonly storage: StorageAdapter;
  private readonly hooks: HookSystem;
  private readonly engine: DefaultRuleEngine;
  /** The repo config this harness operates under (CR-GC-329) — thresholds + source. */
  private readonly graphcodeConfig: LoadedConfig;
  /** The judging thresholds this harness evaluates MT-01/MT-02 with (CR-GC-329). */
  private readonly metricPolicy: MetricPolicy;
  /** The SE descriptor built with `metricPolicy` — the ONE this harness uses. */
  private readonly descriptor: OntologyDescriptor;
  /** The one owner of working copy + disk store (CR-GC-503); the harness only reads it. */
  private readonly store: GraphStore;
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
    this.engine = new DefaultRuleEngine(this.descriptor.version);
    this.engine.register(this.descriptor.rules ?? []);
    this.storeDir = opts?.lockDir ?? join(this.config.repoRoot, '.graphcode');
    this.store = new GraphStore({
      storage,
      lock: new StoreLock(join(this.storeDir, 'owner.lock'), { onLockLost: opts?.onLockLost }),
      scope: this.config.scope,
      repoRoot: this.config.repoRoot,
      storePath: opts?.storePath ?? null,
      descriptor: this.descriptor,
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
    return this.serializeWrite(() => this.applyMutation(commands, opts?.dryRun ?? false));
  }

  private async applyMutation(
    commands: MutateCommand[],
    dryRun = false,
  ): Promise<MutateResult & { fitAdvisory?: FitAdvisory }> {
    // Step 0 — shape validation (CR-GC-239). MCP transports hand commands over as
    // plain JSON; a shape typo (`op:"add_node"`, flat fields) must never pass the
    // gate as a silent no-op with success:true. Parse EVERY command against the
    // contracts schema; any failure blocks the whole batch (no graphVersion bump,
    // audit records result:"rejected" — both derive from success:false).
    const schemaViolations: RuleViolation[] = [];
    const parsedCommands: MutateCommand[] = [];
    commands.forEach((cmd, i) => {
      const parsed = MutateCommandSchema.safeParse(cmd);
      if (parsed.success) {
        parsedCommands.push(parsed.data);
        return;
      }
      const detail = parsed.error.issues.map((iss) => `${iss.path.join('.') || '(root)'}: ${iss.message}`).join('; ');
      schemaViolations.push({
        ruleId: 'SCHEMA-01',
        severity: 'error',
        message: `command[${i}] does not match MutateCommandSchema — ${detail}`,
        fixHint:
          "Canonical shapes: {op:'add-node'|'update-node', node:{uid,type,name,description?,attributes?}} · " +
          "{op:'delete-node', uid} · {op:'add-edge', edge:{sourceId,targetId,edgeType,attributes?}} · " +
          "{op:'delete-edge', edge:{sourceId,targetId,edgeType}} · " +
          "{op:'update-edge', edge:{sourceId,targetId,edgeType}, set:{edgeType?|flip?|attributes?}} · " +
          "{op:'merge-nodes', sourceUid, targetUid}",
      });
    });
    if (schemaViolations.length > 0) {
      const result: MutateResult = {
        success: false,
        appliedCommands: 0,
        mutations: 0,
        violations: schemaViolations,
        confidence: 0,
        tier: 'block',
      };
      if (!dryRun) await this.hooks.runPostApplyHooks(result);
      return result;
    }
    commands = parsedCommands; // normalized: schema defaults (attributes: {}) applied

    // Step 1 — pre-commit.
    const preResults = await this.hooks.runPreCommitHooks(commands);
    const blockedBy = preResults.find((r) => r.block);
    if (blockedBy) {
      const result: MutateResult = {
        success: false,
        appliedCommands: 0,
        mutations: 0,
        violations: [
          { ruleId: 'pre-commit', severity: 'error', message: blockedBy.message ?? 'blocked by pre-commit hook' },
        ],
        confidence: 0,
        tier: 'block',
      };
      if (!dryRun) await this.hooks.runPostApplyHooks(result);
      return result;
    }

    // Step 2 — apply to a CANDIDATE copy (CR-GC-503) + a pre-mutation rule
    // baseline so the gate blocks only on violations THIS mutation introduces.
    // Pre-existing debt (e.g. 61 REQs still awaiting verification, R-01 error)
    // must not freeze the SSOT graph — otherwise no edit could ever land and
    // REQ-graph-is-ssot ("model changes via mutate") is impossible. Pre-existing
    // violations stay visible via evaluateRules()/readiness; they just don't gate.
    // The store's working copy stays untouched until the gate accepts — a block has
    // nothing to roll back.
    const snapshot = this.store.current();
    const baselineKeys = new Set(this.runRules(snapshot).map(violationKey));
    const { graph: candidate, delta } = applyCommands(cloneGraph(snapshot), commands);

    // Step 3 — evaluate, then keep only the violations this mutation introduced.
    const newViolations = this.runRules(candidate).filter((v) => !baselineKeys.has(violationKey(v)));
    // CR-GC-312: `gating: false` marks a rule as visible-but-not-gate-relevant. The
    // descriptor now carries all twelve contracts rule families instead of two; ten of
    // them were shipped and evaluated by nobody. Switching them on with gate power in
    // one step would block every write on pre-existing debt (114 errors in this repo's
    // own graph the day it landed) — debt the writer did not create, which is the same
    // reason the delta baseline above exists. The violations stay in the result and in
    // readiness at full severity; they just do not block until a family is promoted.
    const hasNewError = newViolations.some((v) => v.severity === 'error' && v.gating !== false);

    // Step 3b — pre-persist type guard (CR-GC-205 Item 1). Trace-pair legality is
    // now R-18 and referential integrity is R-08 — both arrive via runRules() above
    // (one rule base, one enforcement), so the gate NO LONGER calls codec.validate()
    // for structural validity (the CR-GC-200 duplication is retired; codec.validate
    // stays only as the encode/import backstop for duplicate uids, which cannot arise
    // here since applyCommands upserts by uid). The single structural class no rule
    // covers is an UNKNOWN node/edge type, which would abort the Kuzu DDL mid-persist
    // (partial persist, in-memory != store). Guard it here, delta-semantics, so an
    // unknown type is rejected ATOMICALLY before persist.
    const baselineTypeErrors = new Set(this.unknownTypeErrors(snapshot));
    const newTypeErrors = this.unknownTypeErrors(candidate).filter((e) => !baselineTypeErrors.has(e));

    if (hasNewError || newTypeErrors.length > 0) {
      // Step 4 (BLOCK) — the candidate is dropped; working copy and store never saw it.
      const violations: RuleViolation[] = [
        ...newViolations,
        ...newTypeErrors.map((message) => ({ ruleId: 'STRUCT', severity: 'error' as const, message })),
      ];
      const result: MutateResult = {
        success: false,
        appliedCommands: commands.length,
        mutations: 0,
        violations,
        confidence: 0,
        tier: 'block',
      };
      if (!dryRun) await this.hooks.runPostApplyHooks(result);
      return result;
    }

    // Step 4 (APPLY) — persist the delta to disk Kuzu. A dry run (CR-GC-234)
    // stops at the verdict: no persist, no drift marker — but the in-memory
    // working copy KEEPS the applied state for cumulative replay preview
    // (the caller restores it via loadGraph()).
    await this.store.commit(candidate, dryRun ? null : delta);
    if (!dryRun) {
      // CR-GC-217: the live model now leads the committed snapshot. Leave the
      // single-writer-safe drift marker so the pre-commit hook blocks a commit until
      // graph_export re-materializes docs/graph/*.graph.json (each commit a graph
      // state that fits the code — REQ-graph-snapshot-per-commit).
      setExportPending(this.config.repoRoot);
    }

    const tier = newViolations.some((v) => v.severity === 'warning') ? 'suggest' : 'auto-apply';
    // Fit-Gate Härtegrad 1 (CR-GC-274): Δm-Advisory auf layer:'arch' pro
    // erfolgreicher Mutation — eine MESSUNG, kein Gate: tier/success bleiben
    // allein regelbestimmt ("Metrik rankt, Gate urteilt").
    const result: MutateResult & { fitAdvisory: FitAdvisory; steerAdvisory: SteerAdvisory; workOrder: WorkOrder } = {
      success: true,
      appliedCommands: commands.length,
      mutations: delta.upsertNodes.length + delta.deleteNodes.length + delta.upsertEdges.length + delta.deleteEdges.length,
      violations: newViolations,
      confidence: 1,
      tier,
      fitAdvisory: computeFitAdvisory(snapshot, candidate),
      // CR-GC-483: das Steuersignal. `fitAdvisory` bleibt daneben stehen und wird berichtet —
      // es rankt nur nichts mehr (CR-SM-292).
      steerAdvisory: computeSteerAdvisory(snapshot, candidate, this.metricPolicy),
      // CR-GC-490: die vierte Kante Modell → Code. Wandert eine `allocate`-Kante, sagt das
      // Ergebnis jetzt, WELCHE Datei mitwandern muss — eine Liste, kein Refactoring, und wie
      // die beiden Advisories daneben ein Advisory: `tier` bleibt regelbestimmt.
      workOrder: congruenceWorkOrder(snapshot, candidate),
    };

    // CR-GC-239 invariant: an applied batch that changed NOTHING is suspicious.
    // Shape errors block above, so the remaining causes are legitimate no-ops
    // (idempotent delete-edge, update-edge/merge-nodes on a vanished element) —
    // surface them on stderr (stdout is the MCP transport), don't fail.
    if (commands.length > 0 && result.mutations === 0) {
      console.error(`[graphcode] mutate: ${commands.length} command(s) applied with 0 mutations — all no-ops.`);
    }

    // Step 5 — post-apply hooks (skipped on a dry run: no phantom events).
    if (!dryRun) await this.hooks.runPostApplyHooks(result);

    // Step 6 — return.
    return result;
  }

  /**
   * Run V3_RULES against the current in-memory graph. Standalone, no mutation.
   * Maps graph-api-core RuleViolation → contracts harness RuleViolation.
   */
  evaluateRules(): RuleViolation[] {
    return this.runRules(this.store.current());
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

  /**
   * Pre-persist Kuzu-DDL guard (CR-GC-205 Item 1): node/edge types that the SE
   * ontology does not know would abort the persist transaction mid-DDL. Pair-
   * legality (R-18) and referential integrity (R-08) are engine rules; this is the
   * one structural class no rule covers, so the gate checks it before persist.
   */
  private unknownTypeErrors(graph: Graph): string[] {
    const errors: string[] = [];
    const nodeTypes = new Set(Object.keys(this.descriptor.nodeTypes));
    const edgeTypes = new Set(Object.keys(this.descriptor.edgeTypes));
    for (const n of graph.nodes) {
      if (!nodeTypes.has(n.type)) errors.push(`Unknown node type "${n.type}" for node "${n.uid}"`);
    }
    for (const e of graph.edges) {
      if (!edgeTypes.has(e.edgeType)) {
        errors.push(`Unknown edge type "${e.edgeType}" for edge "${e.sourceId}" → "${e.targetId}"`);
      }
    }
    return errors;
  }

  private runRules(graph: Graph): GatedViolation[] {
    return this.engine.evaluate(graph).map((v: CoreRuleViolation) => ({
      ruleId: v.ruleId,
      severity: v.severity,
      message: v.message,
      elementId: v.elementId,
      // CR-GC-203 item 1: stop flattening — surface fix_hint + candidate_targets so
      // rules_get_violations / rules_evaluate hand the agent an actionable violation.
      fixHint: v.fixHint,
      context: v.context,
      // CR-GC-312: stamped by the engine from the rule. Only the GATE reads it; the
      // field stays out of the contracts harness type so no consumer has to care.
      gating: v.gating,
    }));
  }
}

/**
 * A violation plus the gate-relevance flag the engine stamps (CR-GC-312).
 *
 * Deliberately NOT in the contracts harness `RuleViolation`: only the gate reads it,
 * and widening a shared schema for one consumer's internal branch is how parallel
 * shapes start. Structurally assignable to `RuleViolation`, so everything downstream
 * is untouched.
 */
type GatedViolation = RuleViolation & { gating?: boolean };

/** Stable identity of a violation, for diffing pre/post-mutation rule results. */
function violationKey(v: RuleViolation): string {
  return `${v.ruleId}::${v.elementId ?? ''}::${v.message}`;
}
