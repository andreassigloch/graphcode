/**
 * GraphCode Harness Core
 *
 * Extracted from aimprove-harness. Responsibilities:
 * - Load/Save OntologyGraph from Kuzu
 * - Apply mutations (nodes/edges) via Gate
 * - Enforce rules (L1–L4 Drift-Locks)
 * - Export Trajectory/Outcome for learning-core
 *
 * NOT this module's responsibility:
 * - Generator logic (F1–F15 pipelines) → stays in aimprove
 * - Learning-Engine (training/models) → learning-core
 * - Dashboard/UI → aimprove or separate app
 */

import type { OntologyGraph, OntologyElement, Trace } from '@sigloch/contracts/se';
import type { StorageAdapter } from '@sigloch/graph-api-core';
import { z } from 'zod';

/**
 * Harness configuration (repo-specific).
 */
export const HarnessConfigSchema = z.object({
  repoPath: z.string().describe('Root path of repo'),
  projectId: z.string().optional().describe('Project ID or workspace (for scoping)'),
  kuzu: z.object({
    persistDir: z.string().optional().describe('Default: `.graphcode/kuzu`'),
    wasm: z.boolean().optional().default(false).describe('Use WASM or native'),
  }).optional(),
  hooks: z.object({
    storageDir: z.string().optional().describe('Default: `.graphcode/hooks`'),
    preCommitTimeout: z.number().optional().default(5000),
    nightly: z.object({
      enabled: z.boolean().optional().default(false),
      cronSchedule: z.string().optional().describe('e.g. "0 2 * * *" (2am daily)'),
    }).optional(),
  }).optional(),
});

export type HarnessConfig = z.infer<typeof HarnessConfigSchema>;

/**
 * Mutation command (from graphify, aimprove UI, or learning).
 */
export const MutateCommandSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('add-node'),
    node: z.object({
      id: z.string(),
      type: z.string().describe('ElementType'),
      name: z.string(),
      attributes: z.record(z.unknown()).optional(),
    }),
  }),
  z.object({
    op: z.literal('add-edge'),
    edge: z.object({
      source: z.string(),
      target: z.string(),
      type: z.string().describe('TraceType'),
      label: z.string().optional(),
    }),
  }),
  z.object({
    op: z.literal('update-node'),
    nodeId: z.string(),
    updates: z.record(z.unknown()),
  }),
  z.object({
    op: z.literal('delete-node'),
    nodeId: z.string(),
    cascade: z.boolean().optional().default(false),
  }),
  z.object({
    op: z.literal('delete-edge'),
    source: z.string(),
    target: z.string(),
    type: z.string(),
  }),
]);

export type MutateCommand = z.infer<typeof MutateCommandSchema>;

/**
 * Result of mutation (with rule-check results).
 */
export const MutateResultSchema = z.object({
  success: z.boolean(),
  appliedCommands: z.number(),
  mutations: z.array(z.object({
    op: z.string(),
    nodeId: z.string().optional(),
    edgeId: z.string().optional(),
  })),
  violations: z.array(z.object({
    ruleId: z.string(),
    severity: z.enum(['error', 'warning', 'info']),
    elementId: z.string(),
    message: z.string(),
  })).optional(),
  trajectoryId: z.string().optional().describe('For learning-core'),
});

export type MutateResult = z.infer<typeof MutateResultSchema>;

/**
 * GraphCode Harness — Core graph operations.
 */
export class GraphCodeHarness {
  private config: HarnessConfig;
  private storage: StorageAdapter;
  private graph: OntologyGraph | null = null;

  constructor(config: HarnessConfig, storage: StorageAdapter) {
    this.config = config;
    this.storage = storage;
  }

  /**
   * Load current OntologyGraph from storage.
   */
  async loadGraph(): Promise<OntologyGraph> {
    if (!this.graph) {
      this.graph = await this.storage.loadGraph();
    }
    return this.graph;
  }

  /**
   * Save graph to storage (idempotent).
   */
  async saveGraph(graph: OntologyGraph): Promise<void> {
    this.graph = graph;
    await this.storage.saveGraph(graph);
  }

  /**
   * Apply mutation(s) with rule validation (Gate).
   *
   * Steps:
   * 1. Run pre-commit hooks
   * 2. Apply mutation to in-memory graph
   * 3. Validate rules (L2 check)
   * 4. Save to storage (if no errors)
   * 5. Run post-apply hooks
   * 6. Emit Trajectory for learning-core
   *
   * Returns result with violation details if rules fail.
   */
  async mutate(commands: MutateCommand[]): Promise<MutateResult> {
    // TODO: Extract from aimprove harness
    // - Pre-commit hook execution
    // - Graph mutation logic
    // - Rule evaluation (contracts/se V3_RULES)
    // - Storage save
    // - Post-apply hooks
    // - Trajectory emission

    throw new Error('mutate() not yet implemented — awaiting carve-out from aimprove');
  }

  /**
   * Evaluate rules on current graph (without mutation).
   */
  async evaluateRules(): Promise<Array<{ ruleId: string; severity: string; message: string }>> {
    // TODO: Rule engine integration
    throw new Error('evaluateRules() not yet implemented');
  }

  /**
   * Close harness (cleanup storage, stop hooks).
   */
  async close(): Promise<void> {
    if (this.storage) {
      await this.storage.close?.();
    }
  }
}
