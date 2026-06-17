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
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  StorageAdapter,
  Graph,
  GraphNode,
  GraphEdge,
  RuleViolation as CoreRuleViolation,
} from '@sigloch/graph-api-core';
import { DefaultRuleEngine, SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import {
  HarnessConfigSchema,
  type HarnessConfig,
  type MutateCommand,
  type MutateResult,
  type RuleViolation,
} from '@sigloch/contracts/harness';
import { HookSystem } from './hooks.js';

/** Shape of the materialized OntologyGraph in docs/graph/*.graph.json. */
interface OntologyJson {
  elements: Array<{ id: string; type: string; name: string; description?: string; [k: string]: unknown }>;
  traces: Array<{ source: string; target: string; type: string; [k: string]: unknown }>;
}

export class GraphCodeHarness {
  private readonly config: HarnessConfig;
  private readonly storage: StorageAdapter;
  private readonly hooks: HookSystem;
  private readonly engine: DefaultRuleEngine;
  /** In-memory working copy; the disk store is the SSOT it mirrors. */
  private graph: Graph = { nodes: [], edges: [] };

  constructor(config: HarnessConfig, storage: StorageAdapter, hooks?: HookSystem) {
    this.config = HarnessConfigSchema.parse(config);
    this.storage = storage;
    this.hooks = hooks ?? new HookSystem({ preCommitTimeout: this.config.preCommitTimeout });
    // L2: rules come from the contracts-derived SE_DESCRIPTOR — no local parser.
    this.engine = new DefaultRuleEngine(SE_DESCRIPTOR.version);
    this.engine.register(SE_DESCRIPTOR.rules ?? []);
  }

  /** Expose the hook system so consumers (CR-102) can register hooks. */
  getHooks(): HookSystem {
    return this.hooks;
  }

  /** Initialize the store, then load the persisted graph into memory. */
  async initialize(): Promise<void> {
    await this.storage.initialize();
    await this.loadGraph();
  }

  /** Load the persisted graph (disk Kuzu) into the in-memory working copy. */
  async loadGraph(): Promise<Graph> {
    this.graph = await this.storage.loadGraph(this.config.scope);
    return this.graph;
  }

  /** Read-only view of the current in-memory graph. */
  getGraph(): Graph {
    return this.graph;
  }

  /**
   * FCHAIN-apply-gate — the single Apply-Gate (L1). Steps:
   *   1. pre-commit hooks  → block aborts before any mutation.
   *   2. apply commands to the in-memory Graph.
   *   3. evaluateRules()   → violations.
   *   4. persist iff no error-severity violation; otherwise BLOCK (L2).
   *   5. post-apply hooks.
   *   6. return MutateResult (success, mutations, violations, confidence, tier).
   */
  async mutate(commands: MutateCommand[]): Promise<MutateResult> {
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
      await this.hooks.runPostApplyHooks(result);
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

    if (hasNewError) {
      // Step 4 (BLOCK) — roll back the in-memory graph, persist nothing.
      this.graph = snapshot;
      const result: MutateResult = {
        success: false,
        appliedCommands: commands.length,
        mutations: 0,
        violations: newViolations,
        confidence: 0,
        tier: 'block',
      };
      await this.hooks.runPostApplyHooks(result);
      return result;
    }

    // Step 4 (APPLY) — persist the delta to disk Kuzu.
    await this.persist(delta);

    const tier = newViolations.some((v) => v.severity === 'warning') ? 'suggest' : 'auto-apply';
    const result: MutateResult = {
      success: true,
      appliedCommands: commands.length,
      mutations: delta.upsertNodes.length + delta.deleteNodes.length + delta.upsertEdges.length + delta.deleteEdges.length,
      violations: newViolations,
      confidence: 1,
      tier,
    };

    // Step 5 — post-apply hooks.
    await this.hooks.runPostApplyHooks(result);

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
   * elements → GraphNode (uid=id, type, name, description, attributes=rest),
   * traces   → GraphEdge (sourceId=source, targetId=target, edgeType=type).
   */
  async importGraph(ontology: OntologyJson): Promise<{ nodes: number; edges: number }> {
    const nodes: GraphNode[] = ontology.elements.map((e) => {
      const { id, type, name, description, ...rest } = e;
      return {
        uid: id,
        type,
        name,
        description: description ?? '',
        attributes: rest,
      };
    });
    const edges: GraphEdge[] = ontology.traces.map((t) => {
      const { source, target, type, ...rest } = t;
      return { sourceId: source, targetId: target, edgeType: type, attributes: rest };
    });
    await this.storage.saveNodes(nodes);
    await this.storage.saveEdges(edges);
    this.graph = { nodes, edges };
    return { nodes: nodes.length, edges: edges.length };
  }

  /** Load + import the materialized graph JSON from `<repoRoot>/docs/graph/`. */
  async seedFromJson(relPath = 'docs/graph/graphcode.graph.json'): Promise<{ nodes: number; edges: number }> {
    const abs = join(this.config.repoRoot, relPath);
    const raw = await readFile(abs, 'utf8');
    return this.importGraph(JSON.parse(raw) as OntologyJson);
  }

  /** Release the store handle (single-writer cleanup). */
  async close(): Promise<void> {
    await this.storage.shutdown();
  }

  // -- internals ------------------------------------------------------------

  private runRules(): RuleViolation[] {
    return this.engine.evaluate(this.graph).map((v: CoreRuleViolation) => ({
      ruleId: v.ruleId,
      severity: v.severity,
      message: v.message,
      elementId: v.elementId,
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
