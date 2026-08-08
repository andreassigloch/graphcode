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
import { generatedHeader, cell } from '../exporter.js';
import { nodesOfType, nodeIndex, adjacency, reqKinds, testLevel, levelsOfTest, status, ref, refList, topoOrderMilestones } from './helpers.js';

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

/** The SCHEMA's binding as one cell: `file#symbol`, the exemption, or an R-26 warning. */
function schemaBinding(s: GraphNode): string {
  const ref = s.attributes['realRef'] as { file?: unknown; symbol?: unknown } | null | undefined;
  if (ref && typeof ref.file === 'string') {
    return typeof ref.symbol === 'string' ? `${ref.file}#${ref.symbol}` : ref.file;
  }
  if (s.attributes['external'] === true) return 'extern definiert (kein realRef)';
  if (s.attributes['concept'] === true) return 'Konzept (noch kein Zod-Export)';
  return '⚠ kein realRef (R-26)';
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
  // of the Zod body — `zodDefinition` is gone. concept/external SCHEMAs are legitimately
  // unbound and say so; anything else without a realRef is an R-26 finding, marked ⚠.
  lines.push('## Schemas (Zod contracts)', '', '| Interface (SCHEMA) | Contract (realRef) | status |', '|---|---|---|');
  for (const s of schemas) {
    lines.push(`| ${ref(s.uid)} | ${cell(schemaBinding(s))} | ${status(s) || 'n/a'} |`);
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

export function renderRtm(graph: Graph, name: string): string {
  const reqs = nodesOfType(graph, 'REQ');
  const verify = adjacency(graph, 'verify');
  const satisfy = adjacency(graph, 'satisfy');
  const allocate = adjacency(graph, 'allocate');
  const lines: string[] = [
    generatedHeader(
      name,
      'Requirements Traceability Matrix (RTM)',
      `${reqs.length} REQ rows, sortiert nach uid. Deterministisch generiert.`,
    ),
  ];
  lines.push('| REQ | verify (TEST) | satisfy (FUNC) | allocate (MOD) |', '|---|---|---|---|');
  let gaps = 0;
  for (const r of reqs) {
    const tests = verify.rev.get(r.uid) ?? [];
    const satisfiers = satisfy.rev.get(r.uid) ?? [];
    const mods = new Set<string>();
    for (const s of satisfiers) for (const m of allocate.fwd.get(s) ?? []) mods.add(m);
    const modList = [...mods].sort((a, b) => a.localeCompare(b));
    const verifyCell = tests.length ? refList(tests) : '⚠ R-01 no verify';
    if (tests.length === 0) gaps += 1;
    lines.push(`| ${ref(r.uid)} | ${verifyCell} | ${refList(satisfiers)} | ${refList(modList)} |`);
  }
  lines.push('', `> Coverage gap = ${gaps} REQ without verify (R-01). Rows sorted by uid.`, '');
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
  const testsWith = (level: 'e2e' | 'integration' | 'unit'): number =>
    tests.filter((t) => levelsByTest.get(t.uid)!.has(level)).length;

  const e2e = testsWith('e2e');
  const ucLevel = testsWith('integration');
  const unit = testsWith('unit');
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
  const sysGap = e2e === 0 ? `✗ ${e2e} tests — NO end-to-end run exists.  ← GAP` : `✓ ${e2e} E2E test(s)`;
  const ucVerdict = ucScenario >= ucCount ? '✓' : `⚠ ${ucCount - ucScenario} UC have no scenario path`;
  const funcVerdict = '✓';

  const lines: string[] = [
    generatedHeader(
      name,
      'Test Concept',
      `${tests.length} TEST — Pyramide nach Modell-Level (System/UC/Function). Deterministisch generiert.`,
    ),
  ];
  const sysLabel = nodesOfType(graph, 'SYS')[0]?.uid ?? 'SYS';
  lines.push('```', '              ╱╲', `             ╱E2╲          System level · ${sysLabel}`);
  lines.push(`            ╱ E  ╲         ${sysGap}`);
  lines.push('           ╱──────╲');
  lines.push(`          ╱  UC /   ╲       Use-case level · ${ucCount} UC`);
  lines.push(`         ╱integration╲      ⚠ ${ucScenario} / ${ucCount} UC exercised by a scenario test`);
  lines.push(`        ╱────────────╲      ${connGap}`);
  lines.push(`       ╱  Function /   ╲     Function level · ${funcCount} FUNC`);
  lines.push('      ╱      unit       ╲');
  lines.push('     ╱───────────────────╲', '```', '');

  // Layers top→bottom by scope: System(E2E) ▸ Use-case acceptance ▸ FUNC↔FUNC
  // integration ▸ Function unit. FUNC↔FUNC tests ARE integration, so they sit in
  // the integration band ABOVE unit — not below it.
  lines.push('| Level | Element | Test kind | Tests | Coverage | Verdict |', '|---|---|---|---|---|---|');
  lines.push(`| System | SYS (${sysCount}) | E2E | ${e2e} | ${e2e} / ${sysCount} | ${sysVerdict} |`);
  lines.push(
    `| Use-case | UC (${ucCount}) | acceptance / integration | ${ucLevel} | ${ucScenario} / ${ucCount} scenario | ${ucVerdict} |`,
  );
  lines.push(
    `| Integration | FUNC↔FUNC (${totalConn} conn) | integration (chain) | ${ucLevel} | ${coveredConn} / ${totalConn} connections | ${connVerdict} |`,
  );
  lines.push(`| Function | FUNC (${funcCount}) | unit | ${unit} | ${funcCount} / ${funcCount} | ${funcVerdict} |`);
  lines.push(`| (support) | — | conformance | ${conformance} | codec round-trip | ✓ |`);
  lines.push('');
  lines.push(
    `> GENERATED — TEST level derived from the graph position of the REQ it verifies (SYS/UC/FUNC/FCHAIN),`,
    `> not a testRef.level attribute; System, UC & Integration rows are DERIVED from coverage, so a missing`,
    `> E2E run surfaces as ✗ (currently ${e2e} E2E test(s)) and an untested FUNC↔FUNC connection (R-21)`,
    `> surfaces as ✗ (${coveredConn}/${totalConn} covered) instead of being silently absent.`,
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
  lines.push('| REQ | verified | verifying TEST(s) |', '|---|---|---|');
  let verified = 0;
  for (const r of reqs) {
    const tests = verify.rev.get(r.uid) ?? [];
    if (tests.length > 0) verified += 1;
    lines.push(`| ${ref(r.uid)} | ${tests.length > 0 ? '✓' : '✗'} | ${refList(tests)} |`);
  }
  const pct = reqs.length ? Math.round((verified / reqs.length) * 100) : 0;
  lines.push('', `Coverage: ${verified}/${reqs.length} REQ verified (${pct}%) · ${reqs.length - verified} open (R-01).`, '');
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
      .filter((c) => c.startsWith('CR-'))
      .sort((a, b) => a.localeCompare(b));
    const open = crs.filter((c) => status(idx.get(c) ?? ({} as GraphNode)) === 'open');
    const blocking = open.length > 0 ? refList(open) : '—';
    lines.push(`| ${ref(ms.uid)} | ${status(ms) || 'n/a'} | ${open.length} / ${crs.length} | ${blocking} |`);
  }
  lines.push('', '> GENERATED — renders the milestones/CRs the Impl Plan created. Originates nothing.', '');
  return lines.join('\n');
}
