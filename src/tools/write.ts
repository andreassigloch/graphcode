/**
 * tools/write.ts — the gated WRITE tools (MOD-mcp-tools, CR-GC-256).
 *
 * graph_mutate / graph_realize / graph_merge / graph_reseed. Every one of them
 * delegates to `harness.mutate()` (L2 gate symmetry — no bypass, no second write
 * path) and runs inside `ctx.serializeToolWrite()`, so the OCC check, the gate
 * apply and the audit record stay one atomic unit against other tool writes.
 *
 * @author andreas@siglochconsulting
 */

import { z } from 'zod/v4';
import { isAbsolute, join } from 'node:path';
import type { MutateCommand, MutateResult, RuleViolation, StaleDelta } from '@sigloch/contracts/harness';
import { GraphVersionSchema } from '@sigloch/contracts/harness';
import { readBranchLog, replayBranchLog, type MergeReport } from '../merge.js';
import type { MCPTool, MCPToolRegistry } from '../mcp-tools.js';
import type { ToolContext } from '../tool-context.js';

// -------------------------------------------------------------------------
// Input schemas
// -------------------------------------------------------------------------

/**
 * OCC base version: the graphVersion the writer READ before composing this write.
 * Uses the promoted contracts schema (CR-GC-243): `GraphVersionSchema` from
 * `@sigloch/contracts/harness` (sigloch-modules CR-199/CR-200 adopted CR-GC-233's
 * shape) — no local parallel schema.
 */
const baseVersionField = GraphVersionSchema.optional().describe(
  'Optimistic concurrency (CR-GC-233): the graphVersion your last read returned. ' +
    'If the graph moved since (baseVersion < current graphVersion) the write is REJECTED ' +
    'with the staleDelta (applied batches since baseVersion) — re-read, adapt, retry. ' +
    'Omitting it skips the check (warning only; lost-update window).',
);

const GraphMutateInputSchema = z
  .object({
    // commands is validated by harness.mutate() via MutateCommandSchema internally.
    // We accept any array here to avoid cross-Zod-version schema composition issues (D1).
    commands: z.array(z.unknown()).min(1).optional(),
    formatE: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Token-leane Alternative zu commands (CR-GC-276): ein Format-E-v2-Block (dasselbe Dialekt wie ' +
          'die Read-Slices) wird zu add-node/add-edge-Kommandos decodiert und läuft durch DASSELBE Gate. ' +
          'Bevorzugt für LLM-Autoring (~2–3× weniger Tokens); upsert-Semantik. Deletes/updates/merges ' +
          'brauchen weiterhin commands.',
      ),
    dryRun: z
      .boolean()
      .default(false)
      .describe(
        'true = volles Gate-Verdict (tier/violations/fitAdvisory), NICHTS persistiert (CR-GC-234); ' +
          'der Preview wird als validate-Eintrag auditiert (Vorschlag→Verdict, F2-Evidenz), die ' +
          'graphVersion bewegt sich nicht.',
      ),
    consumerId: z.string().default('mcp-client'),
    baseVersion: baseVersionField,
  })
  .refine((i) => (i.commands === undefined) !== (i.formatE === undefined), {
    message: 'graph_mutate: supply exactly one of commands or formatE.',
  });

/** Flat realize affordance (CR-GC-216) — the write-twin of graph_context, no nested union. */
const GraphRealizeInputSchema = z
  .object({
    funcUid: z.string().optional().describe('The FUNC node to realize — sets its realRef (R-20).'),
    file: z.string().optional().describe('Implementation file path, e.g. src/x.ts (required with funcUid).'),
    symbol: z.string().optional().describe('The exported symbol (function/class) that realizes the FUNC (required with funcUid).'),
    lang: z.string().optional().describe('Language id (default ts).'),
    // CR-211/228: bind a SCHEMA to its Zod export (realRef, R-26/RC-03) in the same call.
    schemaUid: z.string().optional().describe('Optional SCHEMA node to bind — sets its realRef (R-26/RC-03).'),
    schemaFile: z.string().optional().describe('File declaring the Zod schema (required when schemaUid is given).'),
    schemaSymbol: z.string().optional().describe('The exported Zod schema symbol (required when schemaUid is given).'),
    testUid: z.string().optional().describe('Optional TEST node to bind — sets its testRef (R-19).'),
    testFile: z.string().optional().describe('Test file path (required when testUid is given).'),
    testCase: z.string().optional().describe('Optional test case name.'),
    tool: z.string().optional().describe('Test tool for the testRef (default vitest).'),
    consumerId: z.string().default('mcp-client'),
    baseVersion: baseVersionField,
  })
  .refine((i) => i.funcUid !== undefined || i.schemaUid !== undefined, {
    message: 'graph_realize: supply at least one of funcUid or schemaUid.',
  })
  .refine((i) => i.funcUid === undefined || (i.file !== undefined && i.symbol !== undefined), {
    message: 'graph_realize: file and symbol are required with funcUid.',
  })
  .refine((i) => i.schemaUid === undefined || (i.schemaFile !== undefined && i.schemaSymbol !== undefined), {
    message: 'graph_realize: schemaFile and schemaSymbol are required with schemaUid.',
  });

/** Replay-based branch reintegration (CR-GC-234) — the semantic rebase. */
const GraphMergeInputSchema = z.object({
  log: z
    .string()
    .describe(
      "Path to the BRANCH's durable command log (the worktree's .graphcode/audit.jsonl, CR-GC-232) — " +
        'absolute, or relative to this repoRoot.',
    ),
  sinceVersion: z
    .number()
    .int()
    .nonnegative()
    .describe(
      'The fork point: the shared base graphVersion (CR-GC-233). Branch entries with graphVersion > ' +
        'sinceVersion are replayed; everything at or before it is shared history.',
    ),
  dryRun: z
    .boolean()
    .default(false)
    .describe('true = merge preview: full report, but graph + log stay byte-identical.'),
  consumerId: z.string().default('graph-merge'),
});

const GraphReseedInputSchema = z.object({
  path: z
    .string()
    .optional()
    .describe('Committed graph JSON path relative to repoRoot (default docs/graph/graphcode.graph.json).'),
});

// -------------------------------------------------------------------------
// Binding
// -------------------------------------------------------------------------

export function bindWriteTools(ctx: ToolContext): MCPToolRegistry {
  const { harness, graphVersion, recordAudit, recordPreview, serializeToolWrite, occReject } = ctx;

  /** Format-E-Block → additive MutateCommands (CR-GC-276). Ein Input-Codec, KEIN zweiter Schreibweg. */
  const formatEToCommands = (text: string): MutateCommand[] => {
    const graph = ctx.gcCodec.decode(text);
    return [
      ...graph.nodes.map(
        (n) => ({ op: 'add-node', node: { uid: n.uid, type: n.type, name: n.name, description: n.description ?? '', attributes: n.attributes ?? {} } }) as MutateCommand,
      ),
      ...graph.edges.map(
        (e) => ({ op: 'add-edge', edge: { sourceId: e.sourceId, targetId: e.targetId, edgeType: e.edgeType, attributes: e.attributes ?? {} } }) as MutateCommand,
      ),
    ];
  };

  const OCC_WARNING =
    'no baseVersion supplied — OCC check skipped (lost-update window). Pass the graphVersion ' +
    'your last read returned as baseVersion (CR-GC-233).';

  const missingRefIds = (): Set<string> =>
    new Set(
      harness
        .evaluateRules()
        // R-19 testRef, R-20 FUNC realRef, R-26 SCHEMA realRef (CR-211/228) — the presence rules
        // whose binding graph_realize resolves; the delta confirms the realization.
        .filter((v) => v.ruleId === 'R-19' || v.ruleId === 'R-20' || v.ruleId === 'R-26')
        .map((v) => v.elementId)
        .filter((id): id is string => !!id),
    );

  // -------------------------------------------------------------------------
  // WRITE tools — gate symmetry (L2): delegate to harness.mutate(), no bypass
  // -------------------------------------------------------------------------

  const graph_mutate: MCPTool<
    z.infer<typeof GraphMutateInputSchema>,
    MutateResult & { graphVersion: number; occWarning?: string }
  > = {
    name: 'graph_mutate',
    description:
      'Apply a batch of graph mutations through the Apply-Gate (L2). ' +
      'Every write goes through harness.mutate() — identical semantics to in-process calls. ' +
      'No direct Kuzu access; blocked by rules identical to any in-process mutation. ' +
      'OCC (CR-GC-233): pass the graphVersion your last read returned as baseVersion — a stale ' +
      'base is rejected (tier block) with the delta of applied batches since; re-read + retry. ' +
      'Additive Batches bevorzugt als formatE-Block statt commands (~2–3× weniger Tokens); ' +
      'dryRun:true liefert das volle Verdict inkl. fitAdvisory ohne anzuwenden (auditiert als Preview).',
    inputSchema: GraphMutateInputSchema,
    async handler(input) {
      return serializeToolWrite(async () => {
        // Format-E-Decode VOR dem Gate: ein Parse-Fehler ist ein Block-Verdict,
        // kein Transport-Crash — der Autor bekommt die Codec-Meldung als Violation.
        let commands: MutateCommand[];
        try {
          commands = input.formatE !== undefined ? formatEToCommands(input.formatE) : (input.commands as MutateCommand[]);
        } catch (err) {
          return {
            success: false,
            appliedCommands: 0,
            mutations: 0,
            violations: [
              { ruleId: 'STRUCT', severity: 'error' as const, message: err instanceof Error ? err.message : String(err) },
            ],
            confidence: 0,
            tier: 'block' as const,
            graphVersion: graphVersion(),
          };
        }
        const stale = await occReject(input.consumerId, input.baseVersion, commands);
        if (stale) return stale;
        // L2: identical semantics — delegate straight to the gate, no bypass.
        // Cast: MCP transports deserialize commands as plain objects; harness.mutate()
        // validates internally via MutateCommandSchema.
        const result = await harness.mutate(commands, { dryRun: input.dryRun });
        if (input.dryRun) {
          // Working copy restaurieren (der Gate-dryRun lässt den Applied-Zustand
          // in-memory, CR-GC-234) und den Vorschlag→Verdict auditieren (F2).
          await harness.loadGraph();
          await recordPreview(input.consumerId, result, commands);
        } else {
          await recordAudit(input.consumerId, result, commands);
        }
        return {
          ...result,
          graphVersion: graphVersion(),
          ...(input.baseVersion === undefined && !input.dryRun ? { occWarning: OCC_WARNING } : {}),
        };
      });
    },
  };

  const graph_realize: MCPTool<
    z.infer<typeof GraphRealizeInputSchema>,
    {
      success: boolean;
      tier: MutateResult['tier'];
      violations: RuleViolation[];
      missingRefsBefore: string[];
      missingRefsAfter: string[];
      resolved: string[];
      graphVersion: number;
      occWarning?: string;
      stale?: boolean;
      staleDelta?: StaleDelta;
    }
  > = {
    name: 'graph_realize',
    description:
      'Flat realize affordance (CR-GC-216) — the write-twin of graph_context. Binds a FUNC to its code ' +
      '(realRef, R-20), a SCHEMA to its Zod export (realRef, R-26/RC-03 — CR-211/228), and/or a TEST to its ' +
      'test file (testRef, R-19) in ONE call, through the same Apply-Gate as graph_mutate (no parallel write ' +
      "path — it composes harness.mutate). Use instead of hand-building graph_mutate's nested update-node union " +
      "for the 90% case 'I just realized FUNC/SCHEMA X'. Supply at least one of funcUid/schemaUid. " +
      'Returns the missingRefs delta (before/after + resolved) so the realization is confirmed, not blind. ' +
      'Unknown funcUid/schemaUid/testUid → a clear error. OCC (CR-GC-233): optional baseVersion as in graph_mutate.',
    inputSchema: GraphRealizeInputSchema,
    async handler(input) {
      const nodes = harness.getGraph().nodes;
      const commands: MutateCommand[] = [];

      if (input.funcUid) {
        const fn = nodes.find((n) => n.uid === input.funcUid);
        if (!fn) throw new Error(`graph_realize: unknown funcUid '${input.funcUid}'.`);
        commands.push({
          op: 'update-node',
          node: {
            uid: input.funcUid,
            type: fn.type,
            attributes: { realRef: { file: input.file!, symbol: input.symbol!, ...(input.lang ? { lang: input.lang } : {}) } },
          },
        });
      }

      // CR-211/228: SCHEMA realRef binding — same update-node/apply-gate path as FUNC realRef.
      if (input.schemaUid) {
        const sc = nodes.find((n) => n.uid === input.schemaUid);
        if (!sc) throw new Error(`graph_realize: unknown schemaUid '${input.schemaUid}'.`);
        commands.push({
          op: 'update-node',
          node: {
            uid: input.schemaUid,
            type: sc.type,
            attributes: { realRef: { file: input.schemaFile!, symbol: input.schemaSymbol!, ...(input.lang ? { lang: input.lang } : {}) } },
          },
        });
      }

      if (!input.funcUid && !input.schemaUid) {
        throw new Error('graph_realize: supply at least one of funcUid or schemaUid.');
      }

      if (input.testUid) {
        if (!input.testFile) throw new Error('graph_realize: testFile is required when testUid is given.');
        const test = nodes.find((n) => n.uid === input.testUid);
        if (!test) throw new Error(`graph_realize: unknown testUid '${input.testUid}'.`);
        commands.push({
          op: 'update-node',
          node: {
            uid: input.testUid,
            type: test.type,
            attributes: {
              testRef: { file: input.testFile, tool: input.tool ?? 'vitest', ...(input.testCase ? { case: input.testCase } : {}) },
            },
          },
        });
      }

      return serializeToolWrite(async () => {
        const before = missingRefIds();
        const stale = await occReject(input.consumerId, input.baseVersion, commands);
        if (stale) {
          return {
            success: false,
            tier: stale.tier,
            violations: stale.violations,
            missingRefsBefore: [...before],
            missingRefsAfter: [...before],
            resolved: [],
            graphVersion: stale.graphVersion,
            stale: true,
            staleDelta: stale.staleDelta,
          };
        }
        const result = await harness.mutate(commands);
        // No audit bypass (CR-GC-232): realize writes are logged like any gated write.
        await recordAudit(input.consumerId, result, commands);
        const after = missingRefIds();
        return {
          success: result.success,
          tier: result.tier,
          violations: result.violations,
          missingRefsBefore: [...before],
          missingRefsAfter: [...after],
          resolved: [...before].filter((id) => !after.has(id)),
          graphVersion: graphVersion(),
          ...(input.baseVersion === undefined ? { occWarning: OCC_WARNING } : {}),
        };
      });
    },
  };

  const graph_merge: MCPTool<
    z.infer<typeof GraphMergeInputSchema>,
    MergeReport & { graphVersion: number }
  > = {
    name: 'graph_merge',
    description:
      'Replay-based branch reintegration (CR-GC-234) — the semantic rebase that ends the manual ' +
      "graph.json text-merge. Reads the BRANCH's durable command log (its worktree's " +
      '.graphcode/audit.jsonl), takes the applied batches AFTER the fork point (sinceVersion, the ' +
      'shared base graphVersion) and re-applies them in log order through the EXISTING Apply-Gate ' +
      'onto the current base — every batch rule-validated, O3-serialized, no parallel write path. ' +
      'Conflicts are GATE violations, not text conflicts: a batch that is illegal on the new base ' +
      '(R-08 dangling after a foreign delete, R-18 illegal pair, delta errors) or would resurrect a ' +
      'deleted node (update-node on a missing uid) is skipped + reported under conflicted[] with ' +
      'violations + fixHint — machine-resolvable. Batches already contained in the base are skipped ' +
      "as idempotent. dryRun:true = merge preview (full report, graph + log byte-identical). " +
      'Workflow: gcw <branch> → work → graph_export + commit → on the target base: ' +
      'graph_merge {log, sinceVersion} → graph_export.',
    inputSchema: GraphMergeInputSchema,
    async handler(input) {
      const logPath = isAbsolute(input.log) ? input.log : join(harness.getRepoRoot(), input.log);
      const entries = readBranchLog(logPath, input.sinceVersion);
      return serializeToolWrite(async () => {
        const report = await replayBranchLog(harness, entries, {
          dryRun: input.dryRun,
          // Real merge: every replayed batch lands in the TARGET's durable log like
          // any gated write (applied → version++, conflicted → logged rejected).
          // A dry run records NOTHING (byte-identical log guarantee).
          onBatchResult: input.dryRun ? undefined : (result, commands) => recordAudit(input.consumerId, result, commands),
        });
        report.sinceVersion = input.sinceVersion;
        // Dry run: the gate's dryRun mode accumulated the preview in the in-memory
        // working copy — restore it from the (untouched) disk store.
        if (input.dryRun) await harness.loadGraph();
        return { ...report, graphVersion: graphVersion() };
      });
    },
  };

  // RESEED tool — re-sync the live store to the committed SSOT (CR-GC-203 item 4).
  // In-process clear+reimport behind the single writer; replaces the corrupting
  // stop-server → rm .graphcode/kuzu → restart dance.

  const graph_reseed: MCPTool<z.infer<typeof GraphReseedInputSchema>, { reseeded: true; nodes: number; edges: number }> = {
    name: 'graph_reseed',
    description:
      'Re-sync the live store to the committed SSOT JSON (CR-GC-203 item 4). The single-writer owner ' +
      'clears the store IN-PROCESS (DETACH DELETE through the open handle) then re-imports the committed ' +
      'graph — replacing the stop-server → rm .graphcode/kuzu → restart dance, which corrupts the store ' +
      'when the file is removed under a live handle. DISCARDS un-exported gate mutations; pairs with the ' +
      'export drift guard. Single-writer; no direct Kuzu access.',
    inputSchema: GraphReseedInputSchema,
    async handler(input) {
      const { nodes, edges } = await harness.reseed(input.path);
      return { reseeded: true as const, nodes, edges };
    },
  };

  return { graph_mutate, graph_realize, graph_merge, graph_reseed };
}
