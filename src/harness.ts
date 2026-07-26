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
 *   - REQ-single-kuzu-owner  : exactly one StorageAdapter owns `.graphcode/kuzu`.
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
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type {
  StorageAdapter,
  Graph,
  GraphNode,
  GraphEdge,
  RuleViolation as CoreRuleViolation,
} from '@sigloch/graph-api-core';
import { DefaultRuleEngine, SE_DESCRIPTOR, updateEdge, mergeNodes } from '@sigloch/graph-api-core';
import {
  HarnessConfigSchema,
  MutateCommandSchema,
  type HarnessConfig,
  type MutateCommand,
  type MutateResult,
  type RuleViolation,
} from '@sigloch/contracts/harness';
import { HookSystem } from './hooks.js';
import {
  DEFAULT_GRAPH_JSON,
  importOntologyGraph,
  seedFromJsonFile,
  applyReseed,
  type ImportTarget,
  type OntologyJson,
} from './harness-import.js';
import { StoreLock } from './store-lock.js';
import { setExportPending } from './export-marker.js';
import {
  schemaFingerprint,
  readStoredFingerprint,
  writeStoredFingerprint,
  resetKuzuStore,
} from './schema-guard.js';


export class GraphCodeHarness {
  private readonly config: HarnessConfig;
  private readonly storage: StorageAdapter;
  private readonly hooks: HookSystem;
  private readonly engine: DefaultRuleEngine;
  /** In-memory working copy; the disk store is the SSOT it mirrors. */
  private graph: Graph = { nodes: [], edges: [] };
  /** Store-ownership lock (CR-GC-218 O2): one writer per `.graphcode` store. */
  private readonly storeLock: StoreLock;
  /** Directory of the store this harness owns (lock + audit log live here). */
  private readonly storeDir: string;
  /**
   * Actual Kuzu store file path the injected adapter opens (CR-GC-249). Present
   * only in production wiring (createHarness); when set, initialize() runs the
   * schema-drift guard. Absent for tests that inject an adapter on an arbitrary
   * temp path — the guard stays off so it never touches the wrong file.
   */
  private readonly storePath: string | null;
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
    },
  ) {
    this.config = HarnessConfigSchema.parse(config);
    this.storage = storage;
    this.hooks = hooks ?? new HookSystem({ preCommitTimeout: this.config.preCommitTimeout });
    // L2: rules come from the contracts-derived SE_DESCRIPTOR — no local parser.
    this.engine = new DefaultRuleEngine(SE_DESCRIPTOR.version);
    this.engine.register(SE_DESCRIPTOR.rules ?? []);
    this.storeDir = opts?.lockDir ?? join(this.config.repoRoot, '.graphcode');
    this.storePath = opts?.storePath ?? null;
    this.storeLock = new StoreLock(join(this.storeDir, 'owner.lock'));
  }

  /**
   * The directory of the store this harness owns — the anchoring point for every
   * per-store artifact (O2 `owner.lock`, the durable audit log). Per store, never
   * per repo: a temp-store harness must not touch the repo's live `.graphcode`.
   */
  getStoreDir(): string {
    return this.storeDir;
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
    // O2: claim single ownership of this store BEFORE opening it — a second writer
    // on the same `.graphcode` is refused loudly (StoreOwnershipError), not silently
    // clobbered. Run a second agent in its own git worktree for its own store.
    this.storeLock.acquire();
    try {
      // CR-GC-249: auto-reseed on meta-model schema drift. A persistent store freezes
      // its rel-table FROM/TO pairs at creation; when the meta-model gains a pair (e.g.
      // FUNC→FUNC compose) the frozen schema rejects the new edge. If the store's DDL
      // fingerprint no longer matches the current descriptor, delete the store (so init
      // regenerates the DDL) and reseed from the committed SSOT — automating the manual
      // `rm .graphcode/kuzu*` + reseed recovery. Only runs in production wiring (a known
      // store path); the marker lives beside the store file.
      const markerDir = this.storePath ? dirname(this.storePath) : null;
      const graphJson = join(this.config.repoRoot, DEFAULT_GRAPH_JSON);
      const current = schemaFingerprint(SE_DESCRIPTOR);
      const stored = markerDir ? readStoredFingerprint(markerDir) : null;
      // Only reset when we have a stored fingerprint that differs AND a SSOT to reseed
      // from. A store with no marker (pre-249 or fresh) is adopted at the current
      // fingerprint without a wipe.
      const staleSchema =
        markerDir !== null &&
        stored !== null &&
        stored !== current &&
        existsSync(this.storePath!) &&
        existsSync(graphJson);
      if (staleSchema) resetKuzuStore(this.storePath!);

      await this.storage.initialize();
      await this.loadGraph();

      if (staleSchema) await applyReseed(this.importTarget(), DEFAULT_GRAPH_JSON);
      if (markerDir && stored !== current) writeStoredFingerprint(markerDir, current);
    } catch (err) {
      this.storeLock.release();
      throw err;
    }
  }

  /** Load the persisted graph (disk Kuzu) into the in-memory working copy. */
  async loadGraph(): Promise<Graph> {
    this.graph = await this.storage.loadGraph(this.config.scope);
    return this.graph;
  }

  /** Read-only view of the current in-memory graph (gate working copy only). */
  getGraph(): Graph {
    return this.graph;
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
   * incoming edges, computed in Kuzu as `(m)-[*1..depth]->(root)`. Changing the
   * root impacts the nodes that point INTO it (TEST -verify-> REQ, MOD -realize-> REQ).
   */
  async impact(rootId: string, depth: number): Promise<Graph> {
    return this.storage.getSubgraph(rootId, depth, 'in');
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
   * This is NOT a second blast-radius: it consumes the SAME `getSubgraph` primitive
   * graph_impact/graph_expand use (one `both`-direction fetch per root) and filters
   * it by trace semantics — exactly as graph_expand prunes by edge type. A REQ
   * changeset degenerates to `verify`-dependents only — identical to the path
   * graph_tests took before (REQ → its verifying TESTs).
   *
   * Returns the directed subgraph: the changed nodes ∪ reached spec anchors ∪ the
   * TESTs verifying them. The TEST nodes are the impacted test set.
   */
  async testImpact(changeSet: string[], depth: number): Promise<Graph> {
    // Directed BFS over the realization traces. Each discovered node is expanded by
    // its 1-hop neighbourhood via the single getSubgraph primitive — a plain `both`
    // fetch on the changeset would NOT reach the tests: `getSubgraph(both)` is the
    // UNION of pure-in and pure-out reachability, and a code node reaches its TESTs
    // only by turning direction (`MOD →satisfy→ REQ ←verify← TEST`), which no single
    // directed fetch captures. So we walk hop-by-hop, following the trace semantics:
    //   - satisfy (out)  : cur → the REQ/UC it fulfils       → a spec anchor
    //   - allocate (in)  : cur(MOD) ← the FUNC allocated to it → expand the function
    //   - verify  (in)   : cur ← the TEST that verifies it    → an impacted test
    // A REQ changeset degenerates to verify-dependents only (hop 0), identical to the
    // path graph_tests took before. This is option (b) of CR-GC-204: an explicit
    // code→REQ→TEST resolver over the single store traversal, not a second blast-radius.
    const nodeMap = new Map<string, GraphNode>();
    const edgeMap = new Map<string, GraphEdge>();
    const anchors = new Set<string>(changeSet); // realization closure (changeset + specs it fulfils)
    const testIds = new Set<string>();
    const visited = new Set<string>();
    // code→FUNC→REQ→TEST is up to ~3 directed hops; floor the budget so a code
    // changeset resolves even at the default depth, allow callers to request deeper.
    const maxHops = Math.max(depth, 4);

    let frontier = [...changeSet];
    for (let hop = 0; hop < maxHops && frontier.length > 0; hop++) {
      const next: string[] = [];
      for (const cur of frontier) {
        if (visited.has(cur)) continue;
        visited.add(cur);
        const sub = await this.storage.getSubgraph(cur, 1, 'both');
        for (const n of sub.nodes) nodeMap.set(n.uid, n);
        for (const e of sub.edges) {
          edgeMap.set(`${e.sourceId}|${e.edgeType}|${e.targetId}`, e);
          if (e.edgeType === 'verify' && e.targetId === cur) {
            testIds.add(e.sourceId); // TEST → cur (cur is a verified anchor)
          } else if (e.edgeType === 'satisfy' && e.sourceId === cur && !anchors.has(e.targetId)) {
            anchors.add(e.targetId); // cur → spec
            next.push(e.targetId);
          } else if (e.edgeType === 'allocate' && e.targetId === cur && !anchors.has(e.sourceId)) {
            anchors.add(e.sourceId); // MOD ← FUNC
            next.push(e.sourceId);
          }
        }
      }
      frontier = next;
    }

    // Assemble the directed subgraph: realization anchors ∪ impacted TESTs. The TEST
    // nodes were captured as neighbours when their anchor was expanded, so nodeMap
    // carries their full attributes (incl. testRef).
    const keep = new Set<string>([...anchors, ...testIds]);
    const nodes = [...keep].map((id) => nodeMap.get(id)).filter((n): n is GraphNode => n !== undefined);
    const edges = [...edgeMap.values()].filter((e) => keep.has(e.sourceId) && keep.has(e.targetId));
    return { nodes, edges };
  }

  /** List nodes from the Kuzu store (REQ-query-precision: slice, never a full dump). */
  async listElements(filter: { type?: string; search?: string }): Promise<GraphNode[]> {
    const { nodes } = await this.storage.loadGraph(this.config.scope);
    let result = nodes;
    if (filter.type) result = result.filter((n) => n.type === filter.type);
    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(
        (n) =>
          n.uid.toLowerCase().includes(q) ||
          n.name.toLowerCase().includes(q) ||
          (n.description ?? '').toLowerCase().includes(q),
      );
    }
    return result;
  }

  /**
   * FCHAIN-apply-gate — the single Apply-Gate (L1). Steps:
   *   1. pre-commit hooks  → block aborts before any mutation.
   *   2. apply commands to the in-memory Graph.
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
  async mutate(commands: MutateCommand[], opts?: { dryRun?: boolean }): Promise<MutateResult> {
    return this.serializeWrite(() => this.applyMutation(commands, opts?.dryRun ?? false));
  }

  private async applyMutation(commands: MutateCommand[], dryRun = false): Promise<MutateResult> {
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

    // Step 2 — apply in-memory. Snapshot for rollback + a pre-mutation rule
    // baseline so the gate blocks only on violations THIS mutation introduces.
    // Pre-existing debt (e.g. 61 REQs still awaiting verification, R-01 error)
    // must not freeze the SSOT graph — otherwise no edit could ever land and
    // REQ-graph-is-ssot ("model changes via mutate") is impossible. Pre-existing
    // violations stay visible via evaluateRules()/readiness; they just don't gate.
    const snapshot = cloneGraph(this.graph);
    const baselineKeys = new Set(this.runRules().map(violationKey));
    const delta = this.applyCommands(commands);

    // Step 3 — evaluate, then keep only the violations this mutation introduced.
    const newViolations = this.runRules().filter((v) => !baselineKeys.has(violationKey(v)));
    const hasNewError = newViolations.some((v) => v.severity === 'error');

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
    const newTypeErrors = this.unknownTypeErrors(this.graph).filter((e) => !baselineTypeErrors.has(e));

    if (hasNewError || newTypeErrors.length > 0) {
      // Step 4 (BLOCK) — roll back the in-memory graph, persist nothing.
      this.graph = snapshot;
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
    if (!dryRun) {
      await this.persist(delta);

      // CR-GC-217: the live model now leads the committed snapshot. Leave the
      // single-writer-safe drift marker so the pre-commit hook blocks a commit until
      // graph_export re-materializes docs/graph/*.graph.json (each commit a graph
      // state that fits the code — REQ-graph-snapshot-per-commit).
      setExportPending(this.config.repoRoot);
    }

    const tier = newViolations.some((v) => v.severity === 'warning') ? 'suggest' : 'auto-apply';
    const result: MutateResult = {
      success: true,
      appliedCommands: commands.length,
      mutations: delta.upsertNodes.length + delta.deleteNodes.length + delta.upsertEdges.length + delta.deleteEdges.length,
      violations: newViolations,
      confidence: 1,
      tier,
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
    return this.runRules();
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
    return importOntologyGraph(this.importTarget(), ontology, opts);
  }

  /** Load + import the materialized graph JSON from `<repoRoot>/docs/graph/`. */
  async seedFromJson(
    relPath = DEFAULT_GRAPH_JSON,
    opts?: { rejectUnverifiedReqs?: boolean },
  ): Promise<{ nodes: number; edges: number; unverifiedReqs: string[] }> {
    return seedFromJsonFile(this.importTarget(), relPath, opts);
  }

  /**
   * Re-sync the live store to the committed SSOT JSON (CR-GC-203 item 4).
   * Serialized (O3): a reseed never runs while a mutate is mid-flight (or vice versa),
   * so no writer ever sees the half-cleared store during the DETACH-DELETE + re-import.
   * The clear+re-import itself is harness-import.ts `applyReseed`.
   */
  async reseed(relPath = DEFAULT_GRAPH_JSON): Promise<{ nodes: number; edges: number }> {
    return this.serializeWrite(() => applyReseed(this.importTarget(), relPath));
  }

  /**
   * The narrow port the import path gets — store handle, repo root, and read/write
   * access to the in-memory working copy. Deliberately NOT the harness itself: the
   * gate stays out of reach from that module by construction (CR-GC-260).
   */
  private importTarget(): ImportTarget {
    return {
      storage: this.storage,
      repoRoot: this.config.repoRoot,
      getGraph: () => this.graph,
      setGraph: (graph: Graph) => {
        this.graph = graph;
      },
    };
  }

  /** Release the store handle + the ownership lock (single-writer cleanup). */
  async close(): Promise<void> {
    try {
      await this.storage.shutdown();
    } finally {
      this.storeLock.release();
    }
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
    const nodeTypes = new Set(Object.keys(SE_DESCRIPTOR.nodeTypes));
    const edgeTypes = new Set(Object.keys(SE_DESCRIPTOR.edgeTypes));
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

  private runRules(): RuleViolation[] {
    return this.engine.evaluate(this.graph).map((v: CoreRuleViolation) => ({
      ruleId: v.ruleId,
      severity: v.severity,
      message: v.message,
      elementId: v.elementId,
      // CR-GC-203 item 1: stop flattening — surface fix_hint + candidate_targets so
      // rules_get_violations / rules_evaluate hand the agent an actionable violation.
      fixHint: v.fixHint,
      context: v.context,
    }));
  }

  /** Apply commands to `this.graph` in place; return the persistence delta. */
  private applyCommands(commands: MutateCommand[]): GraphDelta {
    const delta: GraphDelta = { upsertNodes: [], deleteNodes: [], upsertEdges: [], deleteEdges: [] };
    for (const cmd of commands) {
      switch (cmd.op) {
        case 'add-node':
        case 'update-node': {
          const existingIdx = this.graph.nodes.findIndex((n) => n.uid === cmd.node.uid);
          const base = existingIdx >= 0 ? this.graph.nodes[existingIdx] : undefined;
          const node: GraphNode = {
            uid: cmd.node.uid,
            type: cmd.node.type ?? base?.type ?? 'REQ',
            name: cmd.node.name ?? base?.name ?? cmd.node.uid,
            description: cmd.node.description ?? base?.description ?? '',
            attributes: { ...(base?.attributes ?? {}), ...(cmd.node.attributes ?? {}) },
          };
          if (existingIdx >= 0) this.graph.nodes[existingIdx] = node;
          else this.graph.nodes.push(node);
          delta.upsertNodes.push(node);
          break;
        }
        case 'delete-node': {
          this.graph.nodes = this.graph.nodes.filter((n) => n.uid !== cmd.uid);
          // Drop edges incident to the removed node.
          const orphaned = this.graph.edges.filter((e) => e.sourceId === cmd.uid || e.targetId === cmd.uid);
          this.graph.edges = this.graph.edges.filter((e) => e.sourceId !== cmd.uid && e.targetId !== cmd.uid);
          delta.deleteNodes.push(cmd.uid);
          for (const e of orphaned) {
            delta.deleteEdges.push({ sourceId: e.sourceId, targetId: e.targetId, edgeType: e.edgeType });
          }
          break;
        }
        case 'add-edge': {
          const edge: GraphEdge = {
            sourceId: cmd.edge.sourceId,
            targetId: cmd.edge.targetId,
            edgeType: cmd.edge.edgeType,
            attributes: cmd.edge.attributes ?? {},
          };
          const exists = this.graph.edges.some(
            (e) => e.sourceId === edge.sourceId && e.targetId === edge.targetId && e.edgeType === edge.edgeType,
          );
          if (!exists) this.graph.edges.push(edge);
          delta.upsertEdges.push(edge);
          break;
        }
        case 'delete-edge': {
          const key = cmd.edge;
          this.graph.edges = this.graph.edges.filter(
            (e) => !(e.sourceId === key.sourceId && e.targetId === key.targetId && e.edgeType === key.edgeType),
          );
          delta.deleteEdges.push(key);
          break;
        }
        // CR-GC-238: type-change / flip / attribute-patch as ONE semantic op —
        // the audit entry stays `update-edge`, distinguishable from delete+add.
        // Rewiring semantics live once in graph-api-core (CR-198); the harness
        // only turns the result into a persistence delta.
        case 'update-edge': {
          const key = cmd.edge;
          let result: ReturnType<typeof updateEdge>;
          try {
            result = updateEdge(this.graph, key, cmd.set);
          } catch {
            break; // unknown edge → no-op (mutations: 0), same as delete-edge
          }
          this.graph = result.graph;
          // Attribute-only patch keeps the edge identity — a delete of the old key
          // would remove the just-upserted edge from the store (persist runs upserts
          // before deletes), so only push the delete when the identity changed.
          const { removed, added } = result;
          const identityChanged =
            added.sourceId !== removed.sourceId || added.targetId !== removed.targetId || added.edgeType !== removed.edgeType;
          if (identityChanged) delta.deleteEdges.push({ sourceId: removed.sourceId, targetId: removed.targetId, edgeType: removed.edgeType });
          delta.upsertEdges.push(added);
          break;
        }
        // CR-GC-238: target absorbs source — incident edges rewired, source deleted.
        // An illegal result (R-18 pair, R-08 missing target) blocks via delta rules.
        case 'merge-nodes': {
          const { sourceUid, targetUid } = cmd;
          let result: ReturnType<typeof mergeNodes>;
          try {
            result = mergeNodes(this.graph, sourceUid, targetUid);
          } catch {
            break; // same uid or unknown source → no-op
          }
          this.graph = result.graph;
          for (const e of result.removedEdges) {
            delta.deleteEdges.push({ sourceId: e.sourceId, targetId: e.targetId, edgeType: e.edgeType });
          }
          delta.upsertEdges.push(...result.addedEdges);
          delta.deleteNodes.push(result.removedNode);
          break;
        }
      }
    }
    return delta;
  }

  /** Persist a delta to the store. Order: nodes before edges (FK), deletes last. */
  private async persist(delta: GraphDelta): Promise<void> {
    if (delta.upsertNodes.length) await this.storage.saveNodes(delta.upsertNodes);
    if (delta.upsertEdges.length) await this.storage.saveEdges(delta.upsertEdges);
    if (delta.deleteEdges.length) await this.storage.deleteEdges(delta.deleteEdges);
    if (delta.deleteNodes.length) await this.storage.deleteNodes(delta.deleteNodes);
  }
}

interface GraphDelta {
  upsertNodes: GraphNode[];
  deleteNodes: string[];
  upsertEdges: GraphEdge[];
  deleteEdges: Array<{ sourceId: string; targetId: string; edgeType: string }>;
}

/** Stable identity of a violation, for diffing pre/post-mutation rule results. */
function violationKey(v: RuleViolation): string {
  return `${v.ruleId}::${v.elementId ?? ''}::${v.message}`;
}

function cloneGraph(g: Graph): Graph {
  return {
    nodes: g.nodes.map((n) => ({ ...n, attributes: { ...n.attributes } })),
    edges: g.edges.map((e) => ({ ...e, attributes: { ...e.attributes } })),
  };
}
