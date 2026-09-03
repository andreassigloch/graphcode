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

import type { AuditLog } from '@sigloch/graph-api-core';
import type { MCPTool, MCPToolRegistry } from '../kernel/tool-contract.js';
import type { GraphCodeHarness } from '../kernel/harness.js';
import { createToolContext, type ToolContext } from './tool-context.js';
import { bindReadTools } from './read.js';
import { bindWriteTools } from './write.js';
import { bindReportTools } from '../projections/report.js';
import { bindAuditTools } from './audit.js';
import { bindExportTools } from '../projections/export.js';
import { bindSuggestTools } from '../loop/suggest.js';
import { bindMetricsTools } from '../projections/metrics.js';
import { bindTestReportTools } from '../projections/testreport.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Consultation tracking (CR-GC-434)
// ---------------------------------------------------------------------------

/**
 * Tools whose calls are NOT consultation: the gated writes (they ARE the mutation
 * the stamps describe, incl. graph_test_ingest) and graph_export (a file
 * materialization, not steering input).
 */
const NON_CONSULTING_TOOLS = new Set([
  'graph_mutate',
  'graph_realize',
  'graph_merge',
  'graph_reseed',
  'graph_test_ingest',
  'graph_export',
]);

/**
 * Wrap every READ tool so a completed call notes its NAME on the context
 * (CR-GC-434 `consultedTools` — names only, no payload, no second audit surface).
 * ONE wrapping point for all groups instead of per-tool edits; a throwing handler
 * delivered nothing and is not noted. graph_suggest additionally registers the
 * template edits it DELIVERED, the identity set `editSource` matches against —
 * closing exactly the CR-GC-432 gap "ob das Template benutzt wurde, ist nirgends
 * gestempelt".
 */
function withConsultationTracking(registry: MCPToolRegistry, ctx: ToolContext): MCPToolRegistry {
  const wrapped: MCPToolRegistry = {};
  for (const [name, tool] of Object.entries(registry)) {
    if (NON_CONSULTING_TOOLS.has(name)) {
      wrapped[name] = tool;
      continue;
    }
    wrapped[name] = {
      ...tool,
      async handler(input: unknown) {
        const out = await tool.handler(input);
        ctx.noteConsulted(name);
        if (name === 'graph_suggest') {
          const suggestions = (out as { suggestions?: Array<{ edit?: { source: string; target: string; type: string } }> })
            .suggestions;
          ctx.noteTemplateEdits((suggestions ?? []).flatMap((s) => (s.edit ? [s.edit] : [])));
        }
        return out;
      },
    };
  }
  return wrapped;
}

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
  opts?: { ownerPid?: string | null },
): { registry: MCPToolRegistry; ctx: ToolContext } {
  // Exactly one context per registry — the whole reason the groups take `ctx`
  // instead of `(harness, auditLog)` (CR-GC-256 Decision §1).
  const ctx = createToolContext(harness, auditLog, opts);

  return {
    ctx,
    // CR-GC-434: one wrapping point for consultedTools/template-edit capture —
    // the groups stay unchanged, the registry surface (names/schemas) is identical.
    registry: withConsultationTracking(
      {
        ...bindReadTools(ctx),
        ...bindWriteTools(ctx),
        ...bindReportTools(ctx),
        ...bindAuditTools(ctx),
        ...bindExportTools(ctx),
        ...bindSuggestTools(ctx),
        ...bindMetricsTools(ctx),
        ...bindTestReportTools(ctx),
      },
      ctx,
    ),
  };
}

export function bindToolsToHarness(harness: GraphCodeHarness, auditLog?: AuditLog): MCPToolRegistry {
  return bindToolsWithContext(harness, auditLog).registry;
}
