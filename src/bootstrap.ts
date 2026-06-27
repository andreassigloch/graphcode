/**
 * New-member bootstrap through the gate (CR-GC-122, FUNC-import / REQ-bootstrap-through-gate).
 *
 * Fills the EMPTY graph of a NEW family member exclusively through the
 * `mutate()` Apply-Gate (L1) — the source is UNGOVERNED Format-E text
 * (e.g. graphify/slicer output, FLOW-bulk-formatE), NOT a direct write.
 *
 *   Format-E text → GraphCodeCodec.decode() → Graph
 *                 → MutateCommand[] (all add-node FIRST, then add-edge)
 *                 → harness.mutate()  ← the ONE gate (REQ-one-gate-per-repo, L1)
 *                 → BootstrapResult (filled graph + violations report)
 *
 * ── Distinction from seedFromJson()/importGraph() (NOT a parallel path) ─────────
 *   harness.seedFromJson()/importGraph() are a DIRECT LOAD of the ALREADY
 *   GOVERNED, committed SSOT (graphcode's own graph, which carries legacy
 *   R-01 debt). That load MUST stay direct: routed through the gate it would
 *   BLOCK, because against an empty baseline graph every legacy violation would
 *   count as "newly introduced" (see the delta semantics in harness.mutate).
 *
 *   bootstrap() is the SECOND, separate path: UNGOVERNED foreign input MUST pass
 *   through the gate, so cold-start data lands governed or is reported/blocked.
 *   Both operations are needed and semantically different — do not merge them.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';
import type { Graph } from '@sigloch/graph-api-core';
import type { MutateCommand, MutateResult } from '@sigloch/contracts/harness';
import { MutateResultSchema } from '@sigloch/contracts/harness';
import { GraphCodeHarness } from './harness.js';
import { GraphCodeCodec } from './codec.js';

/**
 * BootstrapResult (FLOW-bootstrap-result → SCHEMA-mutate-result): the gate
 * result (MutateResult) plus the count of nodes/edges fed in. MutateResult is
 * imported from @sigloch/contracts/harness — NOT redefined; only the
 * app-specific wrapper is local (schema-first).
 */
export const BootstrapResultSchema = z.object({
  /** Apply-Gate result (success/tier/violations/…) — the one gate (L1). */
  result: MutateResultSchema,
  /** Nodes parsed from the Format-E input (volume in, before the gate verdict). */
  nodes: z.number().int().nonnegative(),
  /** Edges parsed from the Format-E input (volume in, before the gate verdict). */
  edges: z.number().int().nonnegative(),
});
export type BootstrapResult = z.infer<typeof BootstrapResultSchema>;

/** Cold-start mode for a new member graph. */
export type BootstrapMode = 'replace' | 'merge';

/**
 * Minimal template of a GATE-VALID cold-start graph for a new member.
 *
 * Structure (all nodes + edges land in ONE gate batch):
 *   SYS  -compose-> REQ     (R-17: SYS is not empty)
 *   REQ  <-verify-  TEST     (R-01: REQ is verified — error otherwise)
 *   REQ  <-satisfy- MOD      (RD-01: REQ is resolved, not a leaf)
 *
 * With this, neither an error- nor a warning-rule fires: `harness.mutate()`
 * returns success=true with tier='auto-apply' on an empty disk Kuzu graph.
 *
 * Format-E matches the GraphCodeCodec encoding (uid.TYPE suffix, __name attr).
 */
export const TEMPLATE_FORMAT_E = [
  '## Nodes',
  '+ MOD-template.MOD|Module that satisfies the template requirement [__name:Template module]',
  '+ REQ-template-root.REQ|First requirement of the new member graph [__name:Template root requirement]',
  '+ SYS-template.SYS|Cold-start system of a new family member [__name:Template system]',
  '+ TEST-template-root.TEST|Verifies the template root requirement [__name:Template root test]',
  '',
  '## Edges',
  '+ MOD-template.MOD -satisfy-> REQ-template-root.REQ',
  '+ SYS-template.SYS -compose-> REQ-template-root.REQ',
  '+ TEST-template-root.TEST -verify-> REQ-template-root.REQ',
].join('\n');

/**
 * Fill a (typically empty) member graph through the Apply-Gate from Format-E text.
 *
 * @param harness  Disk Kuzu harness of the new member (NEVER :memory:).
 * @param formatE  UNGOVERNED Format-E text (graphify/slicer output or template).
 * @param mode     Cold-start: 'replace'|'merge' both reduce to pure adds (the
 *                 graph is empty). Replace-on-nonempty (delete-then-add) is OUT
 *                 OF SCOPE for MVP-1 — cold-start is the only path here.
 *
 * Throws on Format-E parse errors (Codec.decode surfaces them). Rule violations
 * are NOT thrown: they are the governed gate verdict in the result
 * (success=false, tier='block', e.g. R-01) — the graph then stays unchanged.
 */
export async function bootstrap(
  harness: GraphCodeHarness,
  formatE: string,
  mode: BootstrapMode = 'replace',
): Promise<BootstrapResult> {
  void mode; // Cold-start: both modes = pure adds (see @param).

  // 1. Parse: Format-E → Graph (authoritative parser; throws on parse errors).
  const codec = new GraphCodeCodec();
  const graph: Graph = codec.decode(formatE);

  // 2. Convert to MutateCommand[]: FIRST all nodes, THEN all edges. Endpoints
  //    created in the same batch are fine — the gate applies the commands in
  //    order before it evaluates the rules.
  const commands: MutateCommand[] = [
    ...graph.nodes.map(
      (n): MutateCommand => ({
        op: 'add-node',
        node: {
          uid: n.uid,
          type: n.type,
          name: n.name,
          description: n.description ?? '',
          attributes: n.attributes ?? {},
        },
      }),
    ),
    ...graph.edges.map(
      (e): MutateCommand => ({
        op: 'add-edge',
        edge: {
          sourceId: e.sourceId,
          targetId: e.targetId,
          edgeType: e.edgeType,
          attributes: e.attributes ?? {},
        },
      }),
    ),
  ];

  // 3. Through the ONE gate (L1) — no direct write. On newly introduced
  //    error-violations the gate blocks and persists nothing.
  const result: MutateResult = await harness.mutate(commands);

  return {
    result,
    nodes: graph.nodes.length,
    edges: graph.edges.length,
  };
}
