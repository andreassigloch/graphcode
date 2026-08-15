/**
 * mcp-tools.ts — MCP Tool Registry for graphcode (MOD-mcp-tools).
 *
 * Realizes:
 *   - REQ-mcp-tool-registry    : read/write/rules/audit/query tools
 *   - REQ-mcp-gate-symmetry    : graph_mutate delegates to harness.mutate() — identical semantics (L2)
 *   - REQ-query-precision      : graph_impact returns exact blast-radius as Format-E slice, no full dump
 *   - REQ-subgraph-slicing     : sub-graph slice is the context primitive
 *   - REQ-progressive-expansion: graph_expand deepens via in-memory re-traversal (no originals store)
 *   - REQ-audit-trail          : audit_trail / audit_stats over InMemoryAuditLog
 *   - REQ-single-transport     : NO HTTP server added — stdio transport wiring is the MCP host's job.
 *
 * COMPOSITION ROOT (CR-GC-256). The tools themselves live in one module per group:
 *   - `tools/read.ts`   — graph_elements / get_node / get_edges / impact / expand / context
 *   - `tools/write.ts`  — graph_mutate / realize / merge / reseed (all gated)
 *   - `tools/report.ts` — rules / audit / readiness / tests / help / authoring / next_step
 *   - `tools/export.ts` — graph_export (+ the assertInRepo containment guard, CR-GC-255)
 *   - `tools/suggest.ts`— graph_suggest (se-optimizer binding, dryRun-Verdict, CR-GC-273)
 * Each is bound against ONE `ToolContext` (`tool-context.ts`), which owns the shared state
 * whose invariants require a single instance: the monotone `graphVersion` and the write
 * chain that keeps OCC-check + gate + audit-record atomic. This file adds no behaviour —
 * it creates that context and merges the four groups.
 *
 * Usage: const registry = bindToolsToHarness(harness, auditLog);
 *        // Then hand the registry to your MCP stdio server (out of scope here).
 *
 * @author andreas@siglochconsulting
 */

import type { ZodType } from 'zod/v4';
import type { AuditLog } from '@sigloch/graph-api-core';
import type { GraphCodeHarness } from './harness.js';
import { createToolContext, type ToolContext } from './tool-context.js';
import { bindReadTools } from './tools/read.js';
import { bindWriteTools } from './tools/write.js';
import { bindReportTools } from './tools/report.js';
import { bindExportTools } from './tools/export.js';
import { bindSuggestTools } from './tools/suggest.js';
import { bindMetricsTools } from './tools/metrics.js';
import { bindTestReportTools } from './tools/testreport.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface MCPTool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: ZodType<TInput>;
  handler: (input: TInput) => Promise<TOutput>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MCPToolRegistry = Record<string, MCPTool<any, any>>;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Bind all MCP tools to a live `GraphCodeHarness` instance.
 * Optionally pass an existing `AuditLog`; defaults to the durable `FileOperationsLog`
 * beside the store — that default lives in `createToolContext`, exactly once.
 *
 * Returns an `MCPToolRegistry` — a named map of tools that a MCP stdio host can
 * enumerate and dispatch. The stdio server itself is the host's concern (single-
 * transport constraint: no HTTP added here).
 */
/**
 * Bind the registry AND hand back the context behind it (CR-GC-354).
 *
 * The registry alone cannot carry provenance: `setOrigin` is deliberately out of band, so
 * a caller that knows the model and the prompt — the embedded executor (CR-GC-355), the
 * prompt hook (CR-GC-356) — needs the context itself. Exposing it as an extra registry key
 * would leak a non-tool into every registry enumeration (`tests/mcp.symmetry.test.ts`),
 * hence a second VIEW on the same single binding, never a second binding.
 */
export function bindToolsWithContext(
  harness: GraphCodeHarness,
  auditLog?: AuditLog,
): { registry: MCPToolRegistry; ctx: ToolContext } {
  // Exactly one context per registry — the whole reason the groups take `ctx`
  // instead of `(harness, auditLog)` (CR-GC-256 Decision §1).
  const ctx = createToolContext(harness, auditLog);

  return {
    ctx,
    registry: {
      ...bindReadTools(ctx),
      ...bindWriteTools(ctx),
      ...bindReportTools(ctx),
      ...bindExportTools(ctx),
      ...bindSuggestTools(ctx),
      ...bindMetricsTools(ctx),
      ...bindTestReportTools(ctx),
    },
  };
}

export function bindToolsToHarness(harness: GraphCodeHarness, auditLog?: AuditLog): MCPToolRegistry {
  return bindToolsWithContext(harness, auditLog).registry;
}
