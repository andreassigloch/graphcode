/**
 * testreport.ts — der RÜCKWEG: Testergebnisse in den Graphen und je REQ heraus (CR-GC-327).
 *
 * Der Hinweg stand seit CR-GC-134/204: `graph_tests` löst einen changeSet über
 * `TEST.attributes.testRefs` in einen minimalen `vitest run`-Befehl auf. Der Rückweg
 * fehlte — kein Pfad brachte das Ergebnis eines Laufs zurück. Das Feld dafür ist seit
 * jeher deklariert (`testResult: passed|failed|skipped|pending`), es schrieb es nur nie
 * jemand: auf graph-view-edit feuerte VR-01 für ALLE 14 TEST-Knoten, während die Suite
 * dort 537/537 grün lief.
 *
 * Die teure Folge steht in einem ausgelieferten Dokument: die VCRM
 * (`docs/views/testmatrix.md`) zeigte für jeden REQ ein `✓`, und dieses Häkchen bedeutet
 * ausschließlich „es existiert eine verify-Kante" — nicht „ein Test lief und bestand".
 * Ein Prüfer, der es als Verifikationsnachweis liest, liest es falsch.
 *
 * Zwei Regeln, an denen hier nichts weich wird:
 *   1. **Nie still verwerfen.** Eine Runner-Datei ohne passenden `testRefs`-Eintrag erscheint als
 *      `unresolved` — dieselbe Regel wie bei `graph_tests`.
 *   2. **Kein Default auf grün.** Ein TEST ohne Ergebnis ist `not-run`, weder bestanden
 *      noch weggelassen.
 *
 * ÜBERSCHREIBEN, nicht stapeln (Entscheidung 2026-08-12): ein neuer Lauf ersetzt das
 * Ergebnis; wer den alten Stand sehen will, geht über die Historie zurück (Audit-Trail /
 * `graph_timetravel`, CR-GC-311) — dort steht jede Ingest-Mutation mit ihrer
 * graphVersion. Deshalb trägt der Knoten KEINEN eigenen Lauf-Stempel. Ein Evidenzfeld am
 * TEST braucht ein Ontologie-Feld und ist bewusst nicht Teil dieses CR.
 *
 * graphcode führt nichts aus: hier kommt das Ergebnis eines fremden Laufs an.
 *
 * @author andreas@siglochconsulting
 */

import type { Graph, GraphNode } from '@sigloch/graph-api-core';
import { TestResult, TestRefsSchema } from '@sigloch/contracts/se';

/** Das Ergebnis eines Laufs, wie die Ontologie es kennt. */
export type TestResultValue = (typeof TestResult.options)[number];

/** Eine Datei aus dem Runner-Report, auf das Nötigste reduziert. */
export interface RunnerFileResult {
  /** Repo-relativer Pfad der Testdatei, wie der Runner ihn meldet. */
  file: string;
  result: TestResultValue;
}

/** Was der Ingest je TEST-Knoten zu schreiben hat. */
export interface TestResultAssignment {
  testUid: string;
  file: string;
  result: TestResultValue;
}

export interface IngestPlan {
  assignments: TestResultAssignment[];
  /** Runner-Dateien ohne passenden `testRefs`-Eintrag — gemeldet, nie still verworfen. */
  unresolved: Array<{ file: string; reason: string }>;
}

/**
 * Normalisiert einen Pfad für den Vergleich Runner ↔ `testRefs[].file`.
 *
 * Der Runner meldet je nach Aufruf absolut oder mit `./`-Präfix, der Graph hält den
 * repo-relativen Pfad. Verglichen wird deshalb auf dem gemeinsamen Suffix — aber NUR
 * auf ganzen Segmenten, damit `atests/foo.test.ts` nicht als `tests/foo.test.ts` gilt.
 */
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

/** true, wenn beide Pfade auf dieselbe Datei zeigen (Segment-Suffix-Vergleich). */
export function samePath(a: string, b: string): boolean {
  const x = normalizePath(a);
  const y = normalizePath(b);
  if (x === y) return true;
  const shorter = x.length <= y.length ? x : y;
  const longer = x.length <= y.length ? y : x;
  return longer.endsWith(`/${shorter}`);
}

/** Alle `testRefs`-Dateien eines Knotens — leer, wenn er keine gültige Bindung trägt. */
function testRefFiles(node: GraphNode): string[] {
  const parsed = TestRefsSchema.safeParse(node.attributes?.testRefs);
  return parsed.success ? parsed.data.map((r) => r.file) : [];
}

/**
 * Runner-Ergebnis → Schreibplan.
 *
 * Zugeordnet wird über `testRefs[].file`, NICHT über Namensraten: ein TEST-Knoten, der auf
 * eine Datei zeigt, bekommt deren Ergebnis. Zeigen mehrere Knoten auf dieselbe Datei,
 * bekommen alle dasselbe Ergebnis (1:n ist zulässig — ein File verifiziert mehrere REQ).
 */
export function planIngest(graph: Graph, files: RunnerFileResult[]): IngestPlan {
  const tests = graph.nodes.filter((n) => n.type === 'TEST');
  const assignments: TestResultAssignment[] = [];
  const unresolved: IngestPlan['unresolved'] = [];

  for (const entry of files) {
    // CR-GC-338: ein Knoten kann n Dateien binden — er passt, wenn IRGENDEINE davon
    // die gelaufene ist. Nur die erste zu pruefen liesse den Visual-Lauf einer Abnahme
    // als "no TEST node carries a binding" auflaufen, obwohl er gebunden ist.
    const matches = tests.filter((t) => testRefFiles(t).some((f) => samePath(f, entry.file)));
    if (matches.length === 0) {
      unresolved.push({
        file: entry.file,
        reason: 'no TEST node carries a testRefs entry pointing at this file',
      });
      continue;
    }
    for (const t of matches) {
      assignments.push({ testUid: t.uid, file: entry.file, result: entry.result });
    }
  }

  return { assignments, unresolved };
}

/**
 * Der vitest-JSON-Report, auf die zwei Felder reduziert, die hier zählen.
 * `--reporter=json` liefert `testResults[] = {name, status, assertionResults[]}`.
 */
interface VitestJsonReport {
  testResults?: Array<{ name?: string; status?: string; assertionResults?: Array<{ status?: string }> }>;
}

/**
 * vitest `--reporter=json` → `RunnerFileResult[]`.
 *
 * Datei-Status-Abbildung: `passed`/`failed` direkt; eine Datei, deren Fälle alle
 * übersprungen wurden, ist `skipped`. Alles andere ist `pending` — nicht `passed`.
 * Ein unbekannter Status darf nie nach grün aufgerundet werden.
 */
export function parseVitestJson(raw: string): RunnerFileResult[] {
  let report: VitestJsonReport;
  try {
    report = JSON.parse(raw) as VitestJsonReport;
  } catch (err) {
    throw new Error(`parseVitestJson: not valid JSON — ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!Array.isArray(report.testResults)) {
    throw new Error("parseVitestJson: no `testResults` array — is this a vitest `--reporter=json` report?");
  }

  const out: RunnerFileResult[] = [];
  for (const file of report.testResults) {
    if (typeof file.name !== 'string' || file.name.length === 0) continue;
    const cases = file.assertionResults ?? [];
    let result: TestResultValue;
    if (file.status === 'passed') result = 'passed';
    else if (file.status === 'failed') result = 'failed';
    else if (cases.length > 0 && cases.every((c) => c.status === 'skipped' || c.status === 'pending')) result = 'skipped';
    else result = 'pending';
    out.push({ file: file.name, result });
  }
  return out;
}

/** Eine TEST-Zeile im Prüfreport. */
export interface TestReportRow {
  testUid: string;
  testName: string;
  /** Die gebundenen Dateien — leer bei konzeptionellem TEST. */
  testRefs: string[];
  /**
   * `not-run`, solange kein Lauf ein Ergebnis geschrieben hat — nie ein Default auf grün.
   *
   * CR-GC-338/CR-SM-231b: das Ergebnis haengt PRO EINTRAG. Die Abnahme gilt als bestanden,
   * wenn JEDER Eintrag `passed` ist — "irgendeiner gruen" liesse einen gruenen Unit-Lauf
   * einen roten Visual-Lauf verdecken. Ein Eintrag ohne Ergebnis ist nicht bestanden.
   */
  result: TestResultValue | 'not-run';
}

/** Eine REQ-Zeile im Prüfreport: Kante vorhanden ist nicht dasselbe wie bestanden. */
export interface RequirementVerification {
  reqUid: string;
  reqName: string;
  /** Es existiert mindestens eine verify-Kante. Sagt NICHTS über einen Lauf aus. */
  hasVerifyTrace: boolean;
  /** Jeder verifizierende TEST bestand — nur dann ist Verifikation belegt. */
  passed: boolean;
  tests: TestReportRow[];
}

export interface VerificationReport {
  requirements: RequirementVerification[];
  summary: {
    requirements: number;
    /** REQ mit verify-Kante — der Wert, den die VCRM bisher als „verified" zeigte. */
    withVerifyTrace: number;
    /** REQ, deren TESTs alle bestanden haben — der Wert, der Verifikation BELEGT. */
    passed: number;
    /** REQ mit Kante, aber ohne einen einzigen Lauf. Die Lücke, um die es geht. */
    neverRun: number;
    failed: number;
  };
}

/**
 * Das Ergebnis einer Abnahme ueber ALLE ihre Eintraege — oder `not-run`.
 *
 * CR-SM-231b: `testResult` haengt nicht mehr am Knoten, sondern je `testRefs`-Eintrag.
 * Aggregation hier ist bewusst streng: **jeder** Eintrag muss `passed` sein. Sonst gilt das
 * schlechteste vorliegende Ergebnis; fehlt eines, ist die Abnahme `not-run` — nicht gelaufen
 * ist nicht gruen.
 */
export function resultOf(node: GraphNode): TestResultValue | 'not-run' {
  const refs = TestRefsSchema.safeParse(node.attributes?.testRefs);
  if (refs.success) {
    const results = refs.data.map((r) => r.result);
    if (results.some((r) => r === undefined)) return 'not-run';
    if (results.some((r) => r === 'failed')) return 'failed';
    if (results.some((r) => r === 'skipped')) return 'skipped';
    if (results.some((r) => r === 'pending')) return 'pending';
    return 'passed';
  }
  const parsed = TestResult.safeParse(node.attributes?.testResult);
  return parsed.success ? parsed.data : 'not-run';
}

/**
 * Projektion REQ × TEST × Ergebnis.
 *
 * `passed` verlangt: mindestens eine verify-Kante UND jeder verifizierende TEST steht
 * auf `passed`. Ein TEST ohne Lauf zieht den REQ NICHT nach grün — genau die
 * Verwechslung, wegen der die VCRM 72 von 72 REQ als verifiziert auswies.
 */
export function verificationReport(graph: Graph): VerificationReport {
  const byUid = new Map(graph.nodes.map((n) => [n.uid, n]));
  const verifiers = new Map<string, string[]>(); // REQ-uid → TEST-uids
  for (const e of graph.edges) {
    if (e.edgeType !== 'verify') continue;
    const list = verifiers.get(e.targetId);
    if (list) list.push(e.sourceId);
    else verifiers.set(e.targetId, [e.sourceId]);
  }

  const requirements: RequirementVerification[] = [];
  for (const req of graph.nodes.filter((n) => n.type === 'REQ')) {
    const testUids = verifiers.get(req.uid) ?? [];
    const tests: TestReportRow[] = [];
    for (const uid of testUids) {
      const node = byUid.get(uid);
      if (!node) continue;
      tests.push({
        testUid: uid,
        testName: node.name,
        testRefs: testRefFiles(node),
        result: resultOf(node),
      });
    }
    requirements.push({
      reqUid: req.uid,
      reqName: req.name,
      hasVerifyTrace: tests.length > 0,
      passed: tests.length > 0 && tests.every((t) => t.result === 'passed'),
      tests,
    });
  }

  return {
    requirements,
    summary: {
      requirements: requirements.length,
      withVerifyTrace: requirements.filter((r) => r.hasVerifyTrace).length,
      passed: requirements.filter((r) => r.passed).length,
      neverRun: requirements.filter((r) => r.hasVerifyTrace && r.tests.every((t) => t.result === 'not-run')).length,
      failed: requirements.filter((r) => r.tests.some((t) => t.result === 'failed')).length,
    },
  };
}
