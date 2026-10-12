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
import { readTestRefs } from '@sigloch/contracts/se';
import {
  planIngest,
  planWithdrawal,
  parseVitestJson,
  samePath,
  verificationReport,
  type RunnerFileResult,
  type TestResultWithdrawal,
  fasseZusammen,
  type VerificationReport,
} from './verification-report.js';
import { mitGetragenenReq, schneide, type Umfang } from '../kernel/measure/working-set.js';
import type { MCPTool, MCPToolRegistry, ToolPort } from '../kernel/tool-contract.js';

const GraphTestIngestInputSchema = z
  .object({
    report: z
      .string()
      .optional()
      .describe('Raw vitest `--reporter=json` output.'),
    results: z
      .array(z.object({ file: z.string().min(1), result: TestResult }))
      .optional()
      .describe('Pre-parsed [{file, result}]; at most one of report/results.'),
    changeSet: z
      .array(z.string().min(1))
      .min(1)
      .optional()
      .describe('Changed node uids, as for graph_tests.'),
    consumerId: z.string().default('test-ingest'),
    dryRun: z.boolean().default(false).describe('true = the plan only, nothing written.'),
  })
  .refine((i) => i.report === undefined || i.results === undefined, {
    message: 'graph_test_ingest: supply at most one of report or results.',
  })
  .refine((i) => i.report !== undefined || i.results !== undefined || i.changeSet !== undefined, {
    message: 'graph_test_ingest: supply report, results or changeSet.',
  });

const GraphTestReportInputSchema = z.looseObject({});

export function bindTestReportTools(ctx: ToolPort): MCPToolRegistry {
  const { harness, graphVersion, recordAudit, serializeToolWrite, arbeitsmenge } = ctx;

  /**
   * CR-GC-799: die von einer Aenderung betroffenen Tests kommen aus `harness.testImpact` —
   * derselben Auswahl wie `graph_tests` und `verify:code`, keine zweite. Ein TEST im changeSet
   * ist selbst betroffen. Eine unbekannte uid wird abgewiesen: sie naehme still nichts zurueck.
   */
  async function planeRuecknahme(changeSet: string[] | undefined, frisch: RunnerFileResult[]): Promise<TestResultWithdrawal[]> {
    if (!changeSet) return [];
    const graph = harness.getGraph();
    const bekannt = new Map(graph.nodes.map((n) => [n.uid, n.type]));
    const fremd = changeSet.filter((id) => !bekannt.has(id));
    if (fremd.length > 0) {
      throw new Error(`graph_test_ingest: changeSet takes uids of this model; unknown: ${fremd.join(', ')}.`);
    }
    const impacted = await harness.testImpact(changeSet, 4);
    const testUids = [
      ...impacted.nodes.filter((n) => n.type === 'TEST').map((n) => n.uid),
      ...changeSet.filter((id) => bekannt.get(id) === 'TEST'),
    ];
    return planWithdrawal(graph, testUids, frisch);
  }

  const graph_test_ingest: MCPTool<
    z.infer<typeof GraphTestIngestInputSchema>,
    {
      applied: number;
      assignments: Array<{ testUid: string; file: string; result: string }>;
      unresolved: Array<{ file: string; reason: string }>;
      withdrawn: TestResultWithdrawal[];
      success: boolean;
      tier: MutateResult['tier'];
      violations: MutateResult['violations'];
      graphVersion: number;
    }
  > = {
    name: 'graph_test_ingest',
    description:
      'Feed a test run back into the model: vitest `--reporter=json` (or pre-parsed [{file,result}]) is ' +
      'matched to TEST nodes via testRef.file and written through the gate, so `passed` stops being an ' +
      'assumption. A file without a matching testRef comes back as `unresolved`. `changeSet` withdraws ' +
      'the result of every TEST the change impacts (`withdrawn`), unless this call brings a fresh one.',
    inputSchema: GraphTestIngestInputSchema,
    async handler(input) {
      const files: RunnerFileResult[] =
        input.report !== undefined ? parseVitestJson(input.report) : ((input.results ?? []) as RunnerFileResult[]);
      const plan = planIngest(harness.getGraph(), files);
      const withdrawn = await planeRuecknahme(input.changeSet, files);

      if (input.dryRun || (plan.assignments.length === 0 && withdrawn.length === 0)) {
        return {
          applied: 0,
          assignments: plan.assignments,
          unresolved: plan.unresolved,
          withdrawn,
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
        // EIN Kommando je Knoten, nicht je Zuordnung (CR-GC-386): die Kommandos werden aus
        // dem Zustand VOR dem Batch gebaut, und `testRefs` ist ein Array-Attribut, das als
        // Ganzes ersetzt wird. Bei einer Abnahme aus zwei Dateien überschrieb das zweite
        // Kommando den Stempel des ersten — der Lauf war grün, die Evidenz für eine der
        // beiden Dateien blieb verschwunden und VR-01 meldete sie dauerhaft als pending.
        // CR-GC-799: Zuordnung und Ruecknahme desselben Knotens gehen aus demselben Grund in EIN
        // Kommando — das zweite ueberschriebe sonst das Array des ersten.
        const byNode = new Map<string, typeof plan.assignments>();
        for (const a of plan.assignments) {
          const bucket = byNode.get(a.testUid);
          if (bucket) bucket.push(a);
          else byNode.set(a.testUid, [a]);
        }
        for (const w of withdrawn) if (!byNode.has(w.testUid)) byNode.set(w.testUid, []);
        const ranAt = new Date().toISOString();
        const commands: MutateCommand[] = [...byNode].map(([uid, assignments]) => {
          const node = nodes.find((n) => n.uid === uid)!;
          const read = readTestRefs(node.attributes);
          const refs = read.state === 'bound' ? read.value : [];
          return {
            op: 'update-node' as const,
            node: {
              uid,
              type: node.type,
              attributes: {
                testRefs: refs.map((r) => {
                  const hit = assignments.find((a) => samePath(r.file, a.file));
                  if (hit) return { ...r, result: hit.result, ranAt };
                  if (!withdrawn.some((w) => w.testUid === uid && samePath(r.file, w.file))) return r;
                  const { result: _result, ranAt: _ranAt, evidence: _evidence, ...ohneErgebnis } = r;
                  return ohneErgebnis;
                }),
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
          withdrawn: result.success ? withdrawn : [],
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
    VerificationReport & { graphVersion: number; umfang: Umfang }
  > = {
    name: 'graph_test_report',
    description:
      'Verification report per REQ (CR-GC-327): which TESTs verify it, their testRef, and their ' +
      'result — with `not-run` as an EXPLICIT state for a TEST that never ran. No default to green, ' +
      'no omitted row. This is the honest reading of the VCRM: `hasVerifyTrace` says a verify edge ' +
      'exists, `passed` says every verifying TEST actually passed — the VCRM used to show one ✓ for ' +
      'both, so a reviewer read "verified" where the graph only claimed "linked" (72 of 72 REQ on ' +
      'this repo). The summary carries withVerifyTrace / passed / neverRun / failed side by side so ' +
      'the gap is a number, not a footnote. Read-only. SCOPE (CR-GC-613): answers over the uids ' +
      'this session WROTE (plus the REQ they satisfy); `umfang` sizes the slice taken and how many ' +
      'rows lie outside it. No write moves yet = whole model.',
    inputSchema: GraphTestReportInputSchema,
    async handler(_input) {
      const graph = harness.getGraph();
      const voll = verificationReport(graph);
      // CR-GC-613: die Antwort geht vorgabeweise ueber die ARBEITSMENGE der Sitzung, nicht ueber
      // das ganze Modell. Gemessen im Code-Test: 25.602 Zeichen fuer 81 REQ, von denen 70 nie
      // gelaufen waren — die Scheibe hatte ~10, und der Bericht kam NACH dem Export und loeste
      // gar nichts mehr aus. Ein Schritt ueber `satisfy`, weil ein Agent FUNCs realisiert, nicht REQ.
      const menge = mitGetragenenReq(await arbeitsmenge(), graph.edges);
      const { genommen, umfang } = schneide(voll.requirements, menge, (r) => r.reqUid);
      // Die Kopfzahlen gelten ueber GENAU die gelieferten Zeilen — sonst stuenden zwei Wahrheiten
      // in einer Antwort.
      return { requirements: genommen, summary: fasseZusammen(genommen), umfang, graphVersion: graphVersion() };
    },
  };

  return { graph_test_ingest, graph_test_report };
}
