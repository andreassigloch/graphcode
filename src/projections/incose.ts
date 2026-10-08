/**
 * views/incose.ts — the INCOSE artifact projections (MOD-docs / FUNC-render-views,
 * split out of exporter-views.ts by CR-GC-260).
 *
 * nfr · icd · rtm · testconcept · testmatrix · intplan — the views that answer to an
 * INCOSE/ISO-15288 review (NFR budget, interface control, traceability matrix, test
 * concept + matrix, integration plan). `srs` is the seventh of that family and lives
 * in views/srs.ts (size).
 *
 * DETERMINISM (the core requirement): nodes/edges are iterated in a STABLE order
 * sorted by uid (and, for traces, by source/type/target). No `Date`, no
 * `Math.random`, no unordered Map/Set iteration reaches the output — every Map is
 * read back through a sorted key list. Same graph → byte-identical bytes.
 *
 * @author andreas@siglochconsulting
 */
import type { Graph, GraphNode } from '@sigloch/graph-api-core';
import { ALL_RULE_DEFS, isDue } from '@sigloch/contracts/se';
import { toOntologyGraph } from '../kernel/conformance.js';
import { generatedHeader, cell } from './exporter.js';
// CR-GC-327: DIESELBE Lesart von "was ist das Ergebnis dieses TEST" wie der
// Prüfreport — inklusive `not-run` statt Leerstring. Kein zweiter Begriff.
import { resultOf } from './verification-report.js';
import { nodesOfType, nodeIndex, adjacency, reqKinds, testLevel, testResult, levelsOfTest, reqLevels, rolledUpCoverage, status, ref, refList, topoOrderMilestones, type ReqLevel, type TestLevel } from './helpers.js';

// ---------------------------------------------------------------------------
// 3. NFR Register (RENDER · REQ kind=non-functional). Specimen #3.
// ---------------------------------------------------------------------------

export function renderNfr(graph: Graph, name: string): string {
  const verify = adjacency(graph, 'verify');
  const nfrs = nodesOfType(graph, 'REQ').filter((r) => reqKinds(r).includes('non-functional'));
  const lines: string[] = [
    generatedHeader(
      name,
      'Non-Functional Requirements',
      `REQ mit kinds ∋ "non-functional". ${nfrs.length} NFR. Deterministisch generiert.`,
    ),
  ];
  lines.push('| NFR | Budget / constraint | Verified |', '|---|---|---|');
  for (const r of nfrs) {
    const verified = (verify.rev.get(r.uid) ?? []).length > 0 ? '✓' : '✗';
    lines.push(`| ${ref(r.uid)} | ${cell(r.description ?? r.name)} | ${verified} |`);
  }
  if (nfrs.length === 0) lines.push('| — | keine non-functional REQ im Graph | — |');
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 5. ICD — Interface Control Document (RENDER · SCHEMA/FLOW + io). Specimen #5.
// ---------------------------------------------------------------------------

/**
 * The SCHEMA's binding as one cell: `file#symbol`, `external`, or an R-26 warning. The warning
 * is printed only where R-26 is due (contracts `isDue`, CR-SM-395): before the build is opened an
 * unbound SCHEMA is the state of a draft, and the document must not flag what the gate does not
 * hold open (T-B4, CR-GC-353).
 */
function schemaBinding(s: GraphNode, r26Applies: boolean): string {
  const ref = s.attributes['realRef'] as { file?: unknown; symbol?: unknown } | null | undefined;
  if (ref && typeof ref.file === 'string') {
    return typeof ref.symbol === 'string' ? `${ref.file}#${ref.symbol}` : ref.file;
  }
  if (s.attributes['external'] === true) return 'extern definiert (kein realRef)';
  return r26Applies ? '⚠ kein realRef (R-26)' : 'noch nicht gebunden (Entwurf)';
}

export function renderIcd(graph: Graph, name: string): string {
  const schemas = nodesOfType(graph, 'SCHEMA');
  const flows = nodesOfType(graph, 'FLOW');
  const ioFwd = adjacency(graph, 'io'); // producer → FLOW
  const ioRev = adjacency(graph, 'io'); // FLOW → consumer (rev)
  const lines: string[] = [
    generatedHeader(
      name,
      'Interface Control Document',
      `${schemas.length} SCHEMA · ${flows.length} FLOW. Deterministisch generiert.`,
    ),
  ];

  // BOK-CR-026: the contract column shows the BINDING (realRef file#symbol), not a copy
  // of the Zod body — `zodDefinition` is gone. An `external` SCHEMA is legitimately
  // unbound and says so; anything else without a realRef is an R-26 finding, marked ⚠.
  const r26 = ALL_RULE_DEFS.find((r) => r.id === 'R-26');
  const r26Applies = r26 !== undefined && isDue(r26, toOntologyGraph(graph));
  lines.push('## Schemas (Zod contracts)', '', '| Interface (SCHEMA) | Contract (realRef) | status |', '|---|---|---|');
  for (const s of schemas) {
    lines.push(`| ${ref(s.uid)} | ${cell(schemaBinding(s, r26Applies))} | ${status(s) || 'n/a'} |`);
  }
  lines.push('');

  lines.push('## Flows (producer → consumer)', '', '| Interface (FLOW) | Producer | Consumer |', '|---|---|---|');
  for (const f of flows) {
    // producers = sources whose io target is this flow; consumers = io targets of this flow as source.
    const producers = ioRev.rev.get(f.uid) ?? [];
    const consumers = ioFwd.fwd.get(f.uid) ?? [];
    lines.push(`| ${ref(f.uid)} | ${refList(producers)} | ${refList(consumers)} |`);
  }
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 6. RTM — Requirements Traceability Matrix (RENDER · REQ × verify/satisfy/allocate).
//    Specimen #6. Rows sorted by uid; a coverage gap (REQ without verify) is ⚠.
// ---------------------------------------------------------------------------

/**
 * CR-GC-317: the layer label an assessor is looking for. A-SPICE separates system
 * requirements (SYS.2) from software ones (SWE.1); in this ontology that distinction IS
 * the compose anchor, so it needs deriving, not authoring.
 */
const REQ_LEVEL_LABEL: Record<ReqLevel, string> = {
  system: 'System (SYS.2)',
  functional: 'funktional (SWE.1 · HWE.1)',
  // CR-GC-762: SWE.4 ist die Unit-VERIFIKATION. Eine Anforderung, die eine Wirkkette erfuellt, liegt
  // auf der Architekturebene; eine, die Funktion oder Modul erfuellt, auf der des Entwurfs.
  integration: 'Architektur (SYS.3 · SWE.2)',
  component: 'Entwurf (SWE.3 · HWE.2)',
};
/** Top-down, the order an assessor reads them in. */
const REQ_LEVEL_ORDER: ReqLevel[] = ['system', 'functional', 'integration', 'component'];

export function renderRtm(graph: Graph, name: string): string {
  const reqs = nodesOfType(graph, 'REQ');
  const idx = nodeIndex(graph);
  const verify = adjacency(graph, 'verify');
  const satisfy = adjacency(graph, 'satisfy');
  const allocate = adjacency(graph, 'allocate');
  const compose = adjacency(graph, 'compose');
  const lines: string[] = [
    generatedHeader(
      name,
      'Requirements Traceability Matrix (RTM)',
      `${reqs.length} REQ rows, nach Ebene gruppiert, innerhalb sortiert nach uid. Deterministisch generiert.`,
    ),
  ];

  // CR-GC-317/318: group by layer instead of one flat uid-sorted list. The layer comes
  // from WALKING to the SYS/UC/FUNC/MOD/FCHAIN that carries the assignment (reqLevels) —
  // no attribute, no label. A REQ reachable from several of them appears in BOTH groups;
  // picking a winner would invent precision. `unassigned` stays its own group rather than
  // a silent omission: a requirement hanging off nothing is what an assessor wants to see
  // — and after CR-GC-318 it is one REQ, not the 68 the one-hop version reported.
  const groups = new Map<string, typeof reqs>();
  for (const level of REQ_LEVEL_ORDER) groups.set(level, []);
  groups.set('unassigned', []);
  for (const r of reqs) {
    const levels = reqLevels(r.uid, idx, compose, satisfy);
    if (levels.size === 0) groups.get('unassigned')!.push(r);
    else for (const l of levels) groups.get(l)!.push(r);
  }

  let gaps = 0;
  const seenForGaps = new Set<string>();
  const renderGroup = (heading: string, rows: typeof reqs): void => {
    if (rows.length === 0) return;
    lines.push('', `### ${heading} — ${rows.length} REQ`, '');
    lines.push('| REQ | verify (TEST) | satisfy (FUNC) | allocate (MOD) |', '|---|---|---|---|');
    for (const r of rows) {
      const tests = verify.rev.get(r.uid) ?? [];
      const satisfiers = satisfy.rev.get(r.uid) ?? [];
      const mods = new Set<string>();
      for (const s of satisfiers) for (const m of allocate.fwd.get(s) ?? []) mods.add(m);
      const modList = [...mods].sort((a, b) => a.localeCompare(b));
      const verifyCell = tests.length ? refList(tests) : '⚠ R-01 no verify';
      // Count each REQ once even when it appears under two layers, so the gap number
      // stays comparable with the pre-CR figure.
      if (tests.length === 0 && !seenForGaps.has(r.uid)) {
        gaps += 1;
        seenForGaps.add(r.uid);
      }
      lines.push(`| ${ref(r.uid)} | ${verifyCell} | ${refList(satisfiers)} | ${refList(modList)} |`);
    }
  };

  for (const level of REQ_LEVEL_ORDER) renderGroup(REQ_LEVEL_LABEL[level], groups.get(level)!);
  renderGroup('ohne Anker (unassigned)', groups.get('unassigned')!);

  lines.push(
    '',
    `> Coverage gap = ${gaps} REQ without verify (R-01). Ebene = gefundener Pfad zum ` +
      `zuordnenden Element: SYS -compose-> System · UC -compose-> funktional · ` +
      `FCHAIN -satisfy-> Integration · FUNC/MOD -satisfy-> Komponente. REQ -compose-> REQ ` +
      `erbt die Ebene des Elternteils (keine eigene). Ein REQ, das über mehrere Wege ` +
      `zugeordnet ist, steht in mehreren Gruppen.`,
    '',
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 7. Test Concept — pyramid by model level with a COMPUTED E2E gap. Specimen #7.
//    The System/E2E row is DERIVED from coverage, so 0 E2E tests render ✗ MISSING
//    instead of being silently absent. "Make the gap loud."
//    CR-GC-240: the level is the TEST's graph POSITION (levelsOfTest, via the REQ
//    it verifies), not a testRef.level attribute — real TEST nodes almost never
//    carry that attribute, so the old attribute-based read degenerated the
//    pyramid to all-zero even with full REQ coverage.
// ---------------------------------------------------------------------------

export function renderTestConcept(graph: Graph, name: string): string {
  const idx = nodeIndex(graph);
  const tests = nodesOfType(graph, 'TEST');
  const sysCount = nodesOfType(graph, 'SYS').length;
  const ucCount = nodesOfType(graph, 'UC').length;
  const funcCount = nodesOfType(graph, 'FUNC').length;

  const verify = adjacency(graph, 'verify'); // TEST → REQ
  const compose = adjacency(graph, 'compose'); // SYS/UC → REQ (among other pairs)
  const satisfy = adjacency(graph, 'satisfy'); // FUNC → REQ (among other pairs)

  const levelsByTest = new Map(tests.map((t) => [t.uid, levelsOfTest(t, idx, verify, compose, satisfy)]));
  const testsWith = (level: TestLevel): number =>
    tests.filter((t) => levelsByTest.get(t.uid)!.has(level)).length;

  const e2e = testsWith('system');
  const ucLevel = testsWith('requirements');
  const chainLevel = testsWith('integration');
  const modLevel = testsWith('component');
  const unit = testsWith('unit');
  const modCount = nodesOfType(graph, 'MOD').length;
  // Wie viele Funktionen bzw. Module eine gepruefte Anforderung erfuellen — vorher stand in der
  // Funktionszeile fest `n / n ✓`, ohne dass etwas gezaehlt wurde.
  const mitGeprueft = (type: 'FUNC' | 'MOD'): number =>
    nodesOfType(graph, type).filter((n) => (satisfy.fwd.get(n.uid) ?? []).some((rq) => (verify.rev.get(rq) ?? []).length > 0)).length;
  const schemas = nodesOfType(graph, 'SCHEMA');
  const schemaVerified = schemas.filter((sc) => (verify.rev.get(sc.uid) ?? []).length > 0).length;
  const schemaTests = testsWith('interface');
  // Abdeckung der Systemzeile: gepruefte Systemanforderungen, nicht „Tests je System".
  const sysReqs = nodesOfType(graph, 'SYS').flatMap((sy) => (compose.fwd.get(sy.uid) ?? []).filter((c) => idx.get(c)?.type === 'REQ'));
  const sysReqVerified = sysReqs.filter((rq) => (verify.rev.get(rq) ?? []).length > 0).length;
  const funcVerified = mitGeprueft('FUNC');
  const modVerified = mitGeprueft('MOD');
  // (support): codec round-trip tests verify no REQ, so they have no graph
  // position to derive a level from — testRef.level stays descriptive here.
  const conformance = tests.filter((t) => testLevel(t) === 'conformance').length;

  // UC scenario coverage: a UC is "exercised" if ANY test verifies a REQ it
  // composes — no test-level filter (CR-GC-240 drops the old e2e/acceptance/
  // integration attribute allowlist, which required a testRef.level nothing sets).
  const ucExercised = new Set<string>();
  for (const uc of nodesOfType(graph, 'UC')) {
    const reqs = (compose.fwd.get(uc.uid) ?? []).filter((c) => c.startsWith('REQ-'));
    if (reqs.some((rq) => (verify.rev.get(rq) ?? []).length > 0)) ucExercised.add(uc.uid);
  }
  const ucScenario = ucExercised.size;

  // Integration coverage (R-21): a FUNC↔FUNC connection (FUNC ─io→ FLOW ─io→
  // FUNC) is covered iff both endpoints share an FCHAIN whose satisfy-REQ is
  // verified by a test. Unit/UC tests do not cover the interface between two
  // functions — this makes the FUNC↔FUNC wiring gap loud, like the E2E gap.
  const io = adjacency(graph, 'io');
  const isFunc = (uid: string): boolean => idx.get(uid)?.type === 'FUNC';
  const chainsOfFunc = new Map<string, Set<string>>();
  for (const [fchainUid, members] of compose.fwd) {
    if (idx.get(fchainUid)?.type !== 'FCHAIN') continue;
    for (const m of members) {
      if (isFunc(m)) (chainsOfFunc.get(m) ?? chainsOfFunc.set(m, new Set()).get(m)!).add(fchainUid);
    }
  }
  const testedChains = new Set<string>();
  for (const fc of nodesOfType(graph, 'FCHAIN')) {
    const reqs = satisfy.fwd.get(fc.uid) ?? [];
    if (reqs.some((rq) => (verify.rev.get(rq) ?? []).length > 0)) testedChains.add(fc.uid);
  }
  const seenConn = new Set<string>();
  let totalConn = 0;
  let coveredConn = 0;
  for (const flow of nodesOfType(graph, 'FLOW')) {
    const producers = (io.rev.get(flow.uid) ?? []).filter(isFunc);
    const consumers = (io.fwd.get(flow.uid) ?? []).filter(isFunc);
    for (const p of producers)
      for (const c of consumers) {
        if (p === c) continue;
        const key = `${p}>${c}`;
        if (seenConn.has(key)) continue;
        seenConn.add(key);
        totalConn++;
        const shared = [...(chainsOfFunc.get(p) ?? [])].filter((ch) => chainsOfFunc.get(c)?.has(ch));
        if (shared.some((ch) => testedChains.has(ch))) coveredConn++;
      }
  }
  const connGap =
    totalConn === 0
      ? '· no FUNC↔FUNC connections'
      : coveredConn >= totalConn
        ? `✓ ${coveredConn}/${totalConn} FUNC↔FUNC connections integration-tested`
        : `✗ ${coveredConn}/${totalConn} FUNC↔FUNC connections tested  ← GAP`;
  const connVerdict =
    totalConn === 0 ? '—' : coveredConn >= totalConn ? '✓' : `✗ ${totalConn - coveredConn} uncovered`;

  // The E2E gap: ✗ MISSING when 0 E2E-level tests exist; ✓ otherwise. COMPUTED.
  const sysVerdict = e2e === 0 ? '✗ MISSING — must be added' : '✓';
  const sysGap = e2e === 0 ? `✗ ${e2e} tests — no system requirement is verified.  ← GAP` : `✓ ${e2e} test(s) of system requirements`;
  const ucVerdict = ucScenario >= ucCount ? '✓' : `⚠ ${ucCount - ucScenario} UC without a verified requirement`;
  const anteil = (n: number, von: number): string => (von === 0 ? '—' : n >= von ? '✓' : `⚠ ${von - n} without a verified requirement`);

  const lines: string[] = [
    generatedHeader(
      name,
      'Test Concept',
      `${tests.length} TEST — Verifikationsstufen nach der Lage der geprüften Anforderung, benannt nach Automotive SPICE. Deterministisch generiert.`,
    ),
  ];
  const sysLabel = nodesOfType(graph, 'SYS')[0]?.uid ?? 'SYS';
  lines.push('```', '              ╱╲', `             ╱SYS╲         System · ${sysLabel}`);
  lines.push(`            ╱      ╲        ${sysGap}`);
  lines.push('           ╱────────╲');
  lines.push(`          ╱ use cases ╲      ${ucCount} UC · ${ucScenario} / ${ucCount} with a verified requirement`);
  lines.push('         ╱────────────╲');
  lines.push(`        ╱ integration  ╲     ${connGap}`);
  lines.push('       ╱────────────────╲');
  lines.push(`      ╱ module · function ╲   ${modCount} MOD · ${funcCount} FUNC`);
  lines.push('     ╱────────────────────╲', '```', '');

  // Stufen von oben nach unten, benannt nach dem, WAS geprueft wird (CR-GC-762). Die Prozessnummern
  // nennen Software und Hardware: dieselbe Lage gilt fuer beide.
  lines.push('| Level | Element | Verification | Tests | Coverage | Verdict |', '|---|---|---|---|---|---|');
  lines.push(`| System | SYS (${sysCount}) | system verification (SYS.5) | ${e2e} | ${sysReqVerified} / ${sysReqs.length} system requirements | ${sysVerdict} |`);
  lines.push(
    `| Use-case | UC (${ucCount}) | requirements verification (SWE.6 · HWE.4) | ${ucLevel} | ${ucScenario} / ${ucCount} use cases | ${ucVerdict} |`,
  );
  lines.push(
    `| Integration | FUNC↔FUNC (${totalConn} conn) | integration verification (SYS.4 · SWE.5) | ${chainLevel} | ${coveredConn} / ${totalConn} connections | ${connVerdict} |`,
  );
  lines.push(
    `| Interface | SCHEMA (${schemas.length}) | integration verification (SYS.4 · SWE.5) | ${schemaTests} | ${schemaVerified} / ${schemas.length} schemas | ${schemas.length === 0 ? '—' : schemaVerified >= schemas.length ? '✓' : `⚠ ${schemas.length - schemaVerified} without a test`} |`,
  );
  lines.push(`| Module | MOD (${modCount}) | component verification (SWE.5 · HWE.3) | ${modLevel} | ${modVerified} / ${modCount} | ${anteil(modVerified, modCount)} |`);
  lines.push(`| Function | FUNC (${funcCount}) | unit verification (SWE.4 · HWE.3) | ${unit} | ${funcVerified} / ${funcCount} | ${anteil(funcVerified, funcCount)} |`);
  lines.push(`| (validation) | UC (${ucCount}) | validation (VAL.1) | — | no position in the model | — |`);
  lines.push(`| (support) | — | conformance | ${conformance} | codec round-trip | ✓ |`);
  lines.push('');
  lines.push(
    `> GENERATED — the level of a TEST is the graph position of what it verifies (a REQ under SYS/UC/FCHAIN/MOD/FUNC, or a SCHEMA):`,
    `> it says WHAT is verified, not how the test is written. A test of a system requirement counts as system`,
    `> verification even if it is a unit-style test — whether it plays the system through, this table cannot say.`,
    `> Validation against the intended use has no position: a play-through of a use case is a test of its requirements.`,
    `> An untested FUNC↔FUNC connection (R-21) surfaces as ✗ (${coveredConn}/${totalConn} covered).`,
    '',
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 8. VCRM — Verification Cross-Reference Matrix (RENDER · REQ × TEST). Specimen #8.
//    Rendered as a per-REQ coverage table (a full NxM grid is unbounded for 106×53;
//    the matrix semantics are preserved as the verifying-TEST set per REQ).
// ---------------------------------------------------------------------------

export function renderTestMatrix(graph: Graph, name: string): string {
  const reqs = nodesOfType(graph, 'REQ');
  const verify = adjacency(graph, 'verify');
  const lines: string[] = [
    generatedHeader(
      name,
      'Verification Cross-Reference Matrix (VCRM)',
      `REQ × TEST Coverage, ${reqs.length} REQ rows. Deterministisch generiert.`,
    ),
  ];
  // CR-GC-327: „verify-Kante vorhanden" ist NICHT „bestanden". Die alte Matrix zeigte
  // für beides ein `✓` — auf diesem Repo für 72 von 72 REQ, während kein einziger
  // TEST-Knoten je ein `testResult` trug. Ein Prüfer, der das Häkchen als
  // Verifikationsnachweis las, las es falsch, und das Dokument gab ihm keinen
  // Anhaltspunkt dafür. Zwei Spalten, weil es zwei Aussagen sind.
  const idxByUid = new Map(graph.nodes.map((n) => [n.uid, n]));
  const resultCell = (testUids: string[]): string => {
    if (testUids.length === 0) return '—';
    const results = testUids.map((uid) => {
      const node = idxByUid.get(uid);
      return node ? resultOf(node) : 'not-run';
    });
    if (results.some((r) => r === 'failed')) return '✗ failed';
    if (results.every((r) => r === 'passed')) return '✓ passed';
    if (results.every((r) => r === 'not-run')) return '⚠ nie gelaufen';
    return `⚠ ${results.filter((r) => r === 'passed').length}/${results.length} passed`;
  };

  lines.push('| REQ | verify-Kante | Lauf-Ergebnis | verifying TEST(s) |', '|---|---|---|---|');
  let verified = 0;
  let passed = 0;
  for (const r of reqs) {
    const tests = verify.rev.get(r.uid) ?? [];
    if (tests.length > 0) verified += 1;
    const result = resultCell(tests);
    if (result === '✓ passed') passed += 1;
    lines.push(`| ${ref(r.uid)} | ${tests.length > 0 ? '✓' : '✗'} | ${result} | ${refList(tests)} |`);
  }
  const pct = reqs.length ? Math.round((verified / reqs.length) * 100) : 0;
  const passedPct = reqs.length ? Math.round((passed / reqs.length) * 100) : 0;
  lines.push(
    '',
    `Coverage: ${verified}/${reqs.length} REQ mit verify-Kante (${pct}%) · ${reqs.length - verified} offen (R-01).`,
    `Belegt: ${passed}/${reqs.length} REQ bestanden (${passedPct}%) — eine Kante ist kein Nachweis; ` +
      'ein REQ zählt hier erst, wenn JEDER verifizierende TEST ein `testResult: passed` trägt ' +
      '(Rückweg: `graph_test_ingest`, CR-GC-327).',
    '',
  );

  // CR-GC-317: the rolled-up half. Above answers "is this requirement verified?"; an
  // assessor also asks "is this INTERFACE verified?" — and that answer sits four hops
  // away (TEST -verify-> REQ <-satisfy- FCHAIN -compose-> FUNC). GVE renders such hidden
  // chains as one link; the deterministic views did not, so the evidence existed and was
  // unreadable.
  const idx = nodeIndex(graph);
  const connections = rolledUpCoverage(
    graph,
    idx,
    adjacency(graph, 'io'),
    adjacency(graph, 'compose'),
    adjacency(graph, 'satisfy'),
    verify,
  );
  lines.push('## Integrationsabdeckung (rolled-up)', '');
  if (connections.length === 0) {
    lines.push('_Keine FUNC↔FUNC-Verbindung in einer FCHAIN deklariert._', '');
    return lines.join('\n');
  }
  lines.push(
    '| Verbindung | via FLOW | FCHAIN | deckende TEST(s) | level | Ergebnis |',
    '|---|---|---|---|---|---|',
  );
  let uncovered = 0;
  for (const c of connections) {
    const nodes = c.tests.map((t) => idx.get(t)).filter((n): n is GraphNode => !!n);
    // An empty cell reads as "nothing to say". A gap must read as a gap.
    const testCell = c.tests.length ? refList(c.tests) : '⚠ keine Abdeckung';
    if (c.tests.length === 0) uncovered += 1;
    const levels = [...new Set(nodes.map((n) => testLevel(n)).filter(Boolean))].sort();
    const results = [...new Set(nodes.map((n) => testResult(n)).filter(Boolean))].sort();
    lines.push(
      `| ${ref(c.from)} → ${ref(c.to)} | ${ref(c.via)} | ${refList(c.chains)} | ${testCell} ` +
        `| ${cell(levels.join(', '))} | ${cell(results.join(', '))} |`,
    );
  }
  lines.push(
    '',
    `> ${connections.length - uncovered}/${connections.length} deklarierte FUNC↔FUNC-Verbindungen ` +
      `sind über die Kette TEST→REQ←FCHAIN→FUNC abgedeckt · ${uncovered} offen. ` +
      'Nur Paare mit gemeinsamer FCHAIN — Ko-Adjazenz an einer geteilten FLOW ist keine ' +
      'deklarierte Schnittstelle (CR-GC-315). Leeres level/Ergebnis = am TEST nicht gepflegt.',
    '',
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 9. Integration & Test Plan (RENDER · MS chain + impl gates). Specimen #9.
//    Renders the milestones/CRs the Impl Plan created; originates nothing.
//    Topological MS order via the depends-on relation.
// ---------------------------------------------------------------------------

export function renderIntPlan(graph: Graph, name: string): string {
  const milestones = nodesOfType(graph, 'MS');
  const ordered = topoOrderMilestones(graph, milestones);
  const lines: string[] = [
    generatedHeader(
      name,
      'Integration & Test Plan',
      `${milestones.length} MS · Impl-Gates, depends-on Tier-Order. Deterministisch generiert.`,
    ),
  ];
  lines.push(`Tier order:  ${ordered.map((m) => m.uid).join('  ──▶  ')}`, '');
  lines.push('| Milestone | status | CRs (open) | blocking |', '|---|---|---|---|');
  // CR → MS via `CR -relation-> MS`, die einzige deklarierte Richtung.
  // CR-GC-308: der Kommentar behauptete hier "MS compose → CR also exists" und ein
  // zweiter Zweig walkte die Kante. Sie steht nicht in TRACE_PATTERNS (legal ist
  // MS compose → FUNC/REQ/UC/MS); die Union mit dem legalen Zweig verdeckte, dass
  // der Code eine falsche Modell-Aussage trug.
  const relation = adjacency(graph, 'relation'); // CR → MS : rev[ms] = CRs
  const idx = nodeIndex(graph);
  for (const ms of ordered) {
    const crs = (relation.rev.get(ms.uid) ?? [])
      .filter((c) => idx.get(c)?.type === 'CR') // CR-GC-525: by type, never by uid prefix (BOK-CR-*)
      .sort((a, b) => a.localeCompare(b));
    const open = crs.filter((c) => status(idx.get(c) ?? ({} as GraphNode)) === 'open');
    const blocking = open.length > 0 ? refList(open) : '—';
    lines.push(`| ${ref(ms.uid)} | ${status(ms) || 'n/a'} | ${open.length} / ${crs.length} | ${blocking} |`);
  }
  lines.push('', '> GENERATED — renders the milestones/CRs the Impl Plan created. Originates nothing.', '');
  return lines.join('\n');
}
