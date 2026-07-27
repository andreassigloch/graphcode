/**
 * tools/export.ts — graph_export, the single graph→docs sync path (MOD-mcp-tools).
 *
 * Also the home of `assertInRepo()` (CR-GC-255 Decision §6 parked it in mcp-tools.ts
 * until this split): the containment guard for write targets that are NOT ontology
 * fields. `*Ref.file` paths are closed at the contract root by contracts'
 * `RepoRelativePathSchema`; this guard covers tool input and is the backstop that
 * catches a future third sink. Exactly one guard implementation, here.
 *
 * @author andreas@siglochconsulting
 */

import { join, dirname, resolve, relative, isAbsolute } from 'node:path';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { z } from 'zod/v4';
import { exportGraphJson, exportMarkdown, renderTestStubs, renderSchemaStubs, MarkdownViewSchema, MARKDOWN_VIEWS, VIEW_FILENAMES } from '../exporter.js';
import { clearExportPending } from '../export-marker.js';
import type { MCPTool, MCPToolRegistry } from '../mcp-tools.js';
import type { ToolContext } from '../tool-context.js';

/**
 * Path containment for graph-/agent-supplied write targets (CR-GC-255).
 *
 * The ontology closes the `*Ref.file` sinks at the contract root (`RepoRelativePathSchema`).
 * This is the guard for what contracts CANNOT cover — tool input that is not an ontology
 * field — and the backstop that also catches a future third sink: every write target of a
 * tool passes through here before `writeFileSync`. Rejecting is not cosmetic: a JSON written
 * outside `docs/graph/` escapes BOTH the deny-graph-write hook glob and the pre-commit
 * freshness guard while `clearExportPending()` still fires — drift marker gone, SSOT stale.
 */
function assertInRepo(repoRoot: string, rel: string): string {
  const abs = resolve(repoRoot, rel);
  const back = relative(repoRoot, abs);
  if (back === '' || back.startsWith('..') || isAbsolute(back)) {
    throw new Error(
      `path containment violated: '${rel}' resolves outside the repo root (${repoRoot}). ` +
        'Write targets must stay repo-relative (CR-GC-255).',
    );
  }
  return abs;
}

const GraphExportInputSchema = z.object({
  name: z
    .string()
    .regex(/^[A-Za-z0-9._-]+$/, 'name must be a bare basename: letters, digits, dot, underscore, hyphen — no path separator')
    .optional()
    .describe('Base filename for the graph JSON (default: scope.systemId). Bare basename, no path separator.'),
  views: z.array(MarkdownViewSchema).optional().describe('Markdown views to render (default: all)'),
  force: z
    .boolean()
    .default(false)
    .describe(
      'Override the refuse-to-clobber guard. By default the export ABORTS if it would delete ' +
        'elements/traces present in the committed SSOT JSON but missing from the live graph (stale ' +
        'process / parallel writer). Set true only for intentional deletions.',
    ),
});

// -------------------------------------------------------------------------
// Binding
// -------------------------------------------------------------------------

export function bindExportTools(ctx: ToolContext): MCPToolRegistry {
  const { harness } = ctx;

  // EXPORT tool — the agent-facing re-export sync path (CR-GC-113 over MCP).
  // Serializes the LIVE in-memory graph (full fidelity) — the only place that
  // holds it across the session — to commit-able docs under the repo root.

  const graph_export: MCPTool<
    z.infer<typeof GraphExportInputSchema>,
    {
      graphJson: { path: string; bytes: number; nodes: number; edges: number };
      views: Array<{ view: string; path: string; bytes: number }>;
      stubs: string[];
    }
  > = {
    name: 'graph_export',
    description:
      'Re-export the live governed graph to commit-able docs — the single sync path (CR-GC-113). ' +
      'Writes canonical docs/graph/<name>.graph.json plus deterministic docs/views/*.md (GENERATED header) ' +
      'under the repo root, from the live in-memory graph (full fidelity). Closes the agent loop: ' +
      'spec → impact → implement → export. REFUSES to clobber: aborts if the live graph is empty, or if ' +
      'the write would drop elements/traces present in the committed SSOT (stale process / parallel ' +
      'writer) unless force:true. Also MATERIALIZES the artifact behind an absent binding — a runnable ' +
      '`it.todo` stub for a bound TEST testRef (CR-GC-205 Item 4) and a `z.unknown()` Zod stub for a bound ' +
      'SCHEMA realRef (BOK-CR-026) — so no binding resolves to a phantom path; existing files are never ' +
      'overwritten. Returns the written paths, byte sizes, and the scaffolded stub files.',
    inputSchema: GraphExportInputSchema,
    async handler(input) {
      const graph = harness.getGraph();
      const repoRoot = harness.getRepoRoot();
      const name = input.name ?? harness.getScope().systemId;

      const json = exportGraphJson(graph);
      const jsonRel = join('docs', 'graph', `${name}.graph.json`);
      // Containment BEFORE the clobber guards: an escaping target must not even be
      // read/compared, let alone written (CR-GC-255).
      const jsonAbs = assertInRepo(repoRoot, jsonRel);

      // Refuse-to-clobber (parallels scripts/export-graph.mjs guards): a stale
      // long-running server or a parallel writer can hold a graph that is BEHIND
      // the committed SSOT. Blindly overwriting then silently DROPS committed
      // elements/traces (observed: a stale export deleted CR-GC-133). Guard 1:
      // never write an empty graph over a populated SSOT. Guard 2: abort if the
      // export would remove anything the committed file still has, unless `force`.
      if (graph.nodes.length === 0) {
        throw new Error(
          `graph_export refused: live graph has 0 elements — refusing to overwrite ${jsonRel} with an empty graph.`,
        );
      }
      if (!input.force && existsSync(jsonAbs)) {
        const committed = JSON.parse(readFileSync(jsonAbs, 'utf8')) as {
          elements?: Array<{ id: string }>;
          traces?: Array<{ source: string; target: string; type: string }>;
        };
        const liveNodeIds = new Set(graph.nodes.map((n) => n.uid));
        const liveEdgeKeys = new Set(graph.edges.map((e) => `${e.sourceId}>${e.edgeType}>${e.targetId}`));
        const droppedNodes = (committed.elements ?? []).map((e) => e.id).filter((id) => !liveNodeIds.has(id));
        const droppedEdges = (committed.traces ?? [])
          .map((t) => `${t.source}>${t.type}>${t.target}`)
          .filter((k) => !liveEdgeKeys.has(k));
        if (droppedNodes.length || droppedEdges.length) {
          throw new Error(
            `graph_export refused: would delete ${droppedNodes.length} element(s) + ${droppedEdges.length} trace(s) ` +
              `present in committed ${jsonRel} but missing from the live graph — likely a stale process or a ` +
              `parallel sync. Re-seed the live graph from the committed SSOT first, or pass force:true for an ` +
              `intentional deletion. Dropped elements: ${droppedNodes.slice(0, 10).join(', ')}` +
              `${droppedNodes.length > 10 ? ` …(+${droppedNodes.length - 10})` : ''}.`,
          );
        }
      }

      mkdirSync(dirname(jsonAbs), { recursive: true });
      writeFileSync(jsonAbs, json);

      const views = input.views ?? MARKDOWN_VIEWS;
      const written = views.map((v) => {
        const md = exportMarkdown(graph, v, name);
        const rel = join('docs', 'views', VIEW_FILENAMES[v]);
        const abs = assertInRepo(repoRoot, rel);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, md);
        return { view: v, path: rel, bytes: Buffer.byteLength(md) };
      });

      // Stub materialization: scaffold the artifact behind a binding whose file is
      // ABSENT, so a binding never resolves to a phantom path. Both arms are
      // existence-checked and NEVER overwrite a real file.
      //   TEST   → `it.todo` for a bound testRef (CR-GC-205 Item 4)
      //   SCHEMA → `z.unknown()` export for a bound realRef (BOK-CR-026 §6b)
      const stubs: string[] = [];
      for (const stub of [...renderTestStubs(graph), ...renderSchemaStubs(graph)]) {
        // The renderers already drop a stub whose ref fails TestRefSchema/RealRefSchema
        // (CR-GC-255: `..`/absolute no longer parse) — this is the backstop, not the check.
        const abs = assertInRepo(repoRoot, stub.file);
        if (existsSync(abs)) continue;
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, stub.content);
        stubs.push(stub.file);
      }

      // CR-GC-217: the committed snapshot now equals the live model — clear the
      // drift marker the gate left on the last mutate() so the pre-commit freshness
      // guard lets the commit through. Only reached after the writes above succeed
      // (a refused export throws before here, leaving the marker set, by design).
      clearExportPending(repoRoot);

      return {
        graphJson: { path: jsonRel, bytes: Buffer.byteLength(json), nodes: graph.nodes.length, edges: graph.edges.length },
        views: written,
        stubs,
      };
    },
  };

  return { graph_export };
}
