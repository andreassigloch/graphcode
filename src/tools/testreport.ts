/**
 * tools/testreport.ts — der Rückweg vom Testlauf in den Graphen (CR-GC-327).
 *
 * Zwei Tools, eine Sache: `graph_test_ingest` nimmt ein Runner-Ergebnis entgegen und
 * schreibt es über DAS Gate an die TEST-Knoten; `graph_test_report` gibt je REQ heraus,
 * welcher TEST mit welchem Ergebnis dahintersteht — inklusive des expliziten Zustands
 * „nicht gelaufen".
 *
 * Eigene Gruppe, nicht in `tools/report.ts`: dessen Größen-Guard (CR-GC-256 §6) sagt,
 * der nächste Reporting-Tool splittet die Datei.
 *
 * KEIN Testrunner: graphcode führt nichts aus. Wer den Lauf startet, bleibt Sache des
 * Aufrufers — hier kommt nur sein Ergebnis an. Und KEIN Seitenkanal: der Ingest baut
 * `update-node`-Kommandos und schickt sie durch `harness.mutate()` wie jeder andere
 * Write (Gate, Audit, Provenienz).
 *
 * @author andreas@siglochconsulting
 */

import { z } from 'zod/v4';
import { TestResult } from '@sigloch/contracts/se';
import type { MutateCommand, MutateResult } from '@sigloch/contracts/harness';
import { TestRefsSchema } from '@sigloch/contracts/se';
import {
  planIngest,
  parseVitestJson,
  samePath,
  verificationReport,
  type RunnerFileResult,
  type VerificationReport,
} from '../testreport.js';
import type { MCPTool, MCPToolRegistry } from '../mcp-tools.js';
import type { ToolContext } from '../tool-context.js';

const GraphTestIngestInputSchema = z
  .object({
    report: z
      .string()
      .optional()
      .describe(
        'Raw vitest `--reporter=json` output (the whole JSON document). Files are matched to TEST ' +
          'nodes via testRef.file — never by name guessing.',
      ),
    results: z
      .array(z.object({ file: z.string().min(1), result: TestResult }))
      .optional()
      .describe(
        'Pre-parsed alternative to `report` for runners other than vitest: [{file, result}]. ' +
          'Exactly one of report/results.',
      ),
    consumerId: z.string().default('test-ingest'),
    dryRun: z
      .boolean()
      .default(false)
      .describe('true = show the plan (assignments + unresolved) without writing anything.'),
  })
  .refine((i) => (i.report === undefined) !== (i.results === undefined), {
    message: 'graph_test_ingest: supply exactly one of report or results.',
  });

const GraphTestReportInputSchema = z.looseObject({});

export function bindTestReportTools(ctx: ToolContext): MCPToolRegistry {
  const { harness, graphVersion, recordAudit, serializeToolWrite } = ctx;

  const graph_test_ingest: MCPTool<
    z.infer<typeof GraphTestIngestInputSchema>,
    {
      applied: number;
      assignments: Array<{ testUid: string; file: string; result: string }>;
      unresolved: Array<{ file: string; reason: string }>;
      success: boolean;
      tier: MutateResult['tier'];
      violations: MutateResult['violations'];
      graphVersion: number;
    }
  > = {
    name: 'graph_test_ingest',
    description:
      'Write the outcome of a test RUN back onto the TEST nodes (CR-GC-327) — the return leg of ' +
      'graph_tests. Takes a vitest `--reporter=json` document (`report`) or pre-parsed [{file,result}] ' +
      '(`results`) and maps each file onto the TEST nodes whose `testRef.file` points at it — mapping ' +
      'by binding, never by name guessing. A runner file that matches no testRef comes back as ' +
      '`unresolved`, never silently dropped (same rule as graph_tests). Writes `result`/`ranAt` onto the ' +
      '(passed|failed|skipped|pending) through the SAME Apply-Gate as graph_mutate: gated, audited, ' +
      'no side channel. OVERWRITES: a new run replaces the previous result — the earlier one stays ' +
      'readable through the history (audit trail / graph_timetravel), so the node carries no run stamp. ' +
      'graphcode never EXECUTES anything; starting the run stays the caller\'s job. dryRun:true returns ' +
      'the plan without writing.',
    inputSchema: GraphTestIngestInputSchema,
    async handler(input) {
      const files: RunnerFileResult[] =
        input.report !== undefined ? parseVitestJson(input.report) : (input.results as RunnerFileResult[]);
      const plan = planIngest(harness.getGraph(), files);

      if (input.dryRun || plan.assignments.length === 0) {
        return {
          applied: 0,
          assignments: plan.assignments,
          unresolved: plan.unresolved,
          success: true,
          tier: 'auto-apply' as const,
          violations: [],
          graphVersion: graphVersion(),
        };
      }

      return serializeToolWrite(async () => {
        const nodes = harness.getGraph().nodes;
        // CR-SM-231b / CR-GC-338: das Ergebnis haengt PRO EINTRAG, nicht am Knoten. Ein Lauf,
        // der EINE von zwei Dateien betrifft, faerbt nur diese — „einer rot, einer gruen" ist
        // damit ueberhaupt erst darstellbar. Ein Knoten-Attribut konnte das nie.
        const commands: MutateCommand[] = plan.assignments.map((a) => {
          const node = nodes.find((n) => n.uid === a.testUid)!;
          const parsed = TestRefsSchema.safeParse(node.attributes?.testRefs);
          const refs = parsed.success ? parsed.data : [];
          const ranAt = new Date().toISOString();
          return {
            op: 'update-node' as const,
            node: {
              uid: a.testUid,
              type: node.type,
              attributes: {
                testRefs: refs.map((r) =>
                  samePath(r.file, a.file) ? { ...r, result: a.result, ranAt } : r,
                ),
              },
            },
          };
        });
        const result = await harness.mutate(commands);
        // Kein Audit-Bypass (CR-GC-232): der Ingest wird geloggt wie jeder gated Write.
        await recordAudit(input.consumerId, result, commands);
        return {
          applied: result.success ? plan.assignments.length : 0,
          assignments: plan.assignments,
          unresolved: plan.unresolved,
          success: result.success,
          tier: result.tier,
          violations: result.violations,
          graphVersion: graphVersion(),
        };
      });
    },
  };

  const graph_test_report: MCPTool<
    z.infer<typeof GraphTestReportInputSchema>,
    VerificationReport & { graphVersion: number }
  > = {
    name: 'graph_test_report',
    description:
      'Verification report per REQ (CR-GC-327): which TESTs verify it, their testRef, and their ' +
      'result — with `not-run` as an EXPLICIT state for a TEST that never ran. No default to green, ' +
      'no omitted row. This is the honest reading of the VCRM: `hasVerifyTrace` says a verify edge ' +
      'exists, `passed` says every verifying TEST actually passed — the VCRM used to show one ✓ for ' +
      'both, so a reviewer read "verified" where the graph only claimed "linked" (72 of 72 REQ on ' +
      'this repo). The summary carries withVerifyTrace / passed / neverRun / failed side by side so ' +
      'the gap is a number, not a footnote. Read-only.',
    inputSchema: GraphTestReportInputSchema,
    async handler(_input) {
      return { ...verificationReport(harness.getGraph()), graphVersion: graphVersion() };
    },
  };

  return { graph_test_ingest, graph_test_report };
}
