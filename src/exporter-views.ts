/**
 * Graph → Markdown SE-artifact projections (CR-GC-220, MOD-docs / FUNC-render-views).
 *
 * The 12 deterministic render-form views that previously existed only as
 * agent-rendered `se-view:*` skills. Rendering is a PURE FUNCTION of the graph,
 * so it belongs in code, not in a non-deterministic agent prompt. Each function
 * projects the live graph per its specimen in docs/proposals/document-specimens.md.
 *
 * DETERMINISM (the core requirement): every view iterates nodes/edges in a STABLE
 * order sorted by uid (and, for traces, by source/type/target). No `Date`, no
 * `Math.random`, no unordered Map/Set iteration reaches the output — every Map is
 * read back through a sorted key list. Same graph → byte-identical bytes.
 *
 * Helpers (generatedHeader / byUid / cell / nodesOfTypes) are imported from
 * exporter.ts — one renderer, no parallel paths.
 *
 * @author andreas@siglochconsulting
 */
import type { Graph, GraphNode } from '@sigloch/graph-api-core';
import { generatedHeader, byUid, cell } from './exporter.js';

// ---------------------------------------------------------------------------
// Shared deterministic graph-projection helpers.
// ---------------------------------------------------------------------------

/** All nodes of a single type, sorted by uid. */
function nodesOfType(graph: Graph, type: string): GraphNode[] {
  return graph.nodes.filter((n) => n.type === type).sort(byUid);
}

/** uid → node lookup (for name/attr resolution). */
function nodeIndex(graph: Graph): Map<string, GraphNode> {
  const m = new Map<string, GraphNode>();
  for (const n of graph.nodes) m.set(n.uid, n);
  return m;
}

/**
 * Index `edgeType` edges as source → sorted targets[] and target → sorted
 * sources[]. Values are sorted, so any later iteration over them is stable.
 */
function adjacency(graph: Graph, edgeType: string): {
  fwd: Map<string, string[]>; // source → targets
  rev: Map<string, string[]>; // target → sources
} {
  const fwd = new Map<string, string[]>();
  const rev = new Map<string, string[]>();
  const push = (m: Map<string, string[]>, k: string, v: string): void => {
    const arr = m.get(k);
    if (arr) arr.push(v);
    else m.set(k, [v]);
  };
  for (const e of graph.edges) {
    if (e.edgeType !== edgeType) continue;
    push(fwd, e.sourceId, e.targetId);
    push(rev, e.targetId, e.sourceId);
  }
  for (const arr of fwd.values()) arr.sort((a, b) => a.localeCompare(b));
  for (const arr of rev.values()) arr.sort((a, b) => a.localeCompare(b));
  return { fwd, rev };
}

/** REQ.kinds → string[]; tolerant of missing / non-array. */
function reqKinds(n: GraphNode): string[] {
  const k = n.attributes['kinds'];
  return Array.isArray(k) ? k.map(String) : [];
}

/**
 * TEST level from nested testRef.level, falling back to a top-level `level` attr.
 * Descriptive test-inventory metadata only (CR-GC-240) — the pyramid classification
 * in renderTestConcept uses levelsOfTest() (graph position), not this attribute.
 */
function testLevel(n: GraphNode): string {
  const ref = n.attributes['testRef'] as { level?: unknown } | null | undefined;
  if (ref && typeof ref === 'object' && typeof ref.level === 'string') return ref.level;
  const top = n.attributes['level'];
  return typeof top === 'string' ? top : '';
}

/**
 * Pyramid level(s) of a TEST, derived from the graph POSITION of the REQ(s) it
 * verifies (CR-GC-240) — a real TEST node almost never carries testRef.level, so
 * an attribute-based classification degenerates to all-unleveled even when every
 * REQ is verified. A test verifying a SYS-composed REQ is System/e2e; a UC-composed
 * REQ is Use-Case/integration; a FUNC-satisfied REQ is Function/unit. A test
 * inherits every level of every REQ it verifies (multi-assignment allowed).
 */
function levelsOfTest(
  t: GraphNode,
  idx: Map<string, GraphNode>,
  verify: { fwd: Map<string, string[]> },
  compose: { rev: Map<string, string[]> },
  satisfy: { rev: Map<string, string[]> },
): Set<'e2e' | 'integration' | 'unit'> {
  const levels = new Set<'e2e' | 'integration' | 'unit'>();
  for (const reqUid of verify.fwd.get(t.uid) ?? []) {
    for (const parent of compose.rev.get(reqUid) ?? []) {
      const type = idx.get(parent)?.type;
      if (type === 'SYS') levels.add('e2e');
      else if (type === 'UC') levels.add('integration');
    }
    for (const satisfier of satisfy.rev.get(reqUid) ?? []) {
      if (idx.get(satisfier)?.type === 'FUNC') levels.add('unit');
    }
  }
  return levels;
}

function status(n: GraphNode): string {
  return String(n.attributes['status'] ?? '');
}

/** A code-spanned uid, or `—` when absent. */
function ref(uid: string | undefined): string {
  return uid ? `\`${uid}\`` : '—';
}

/** Join a sorted uid list as code spans, or `—`. */
function refList(uids: string[] | undefined): string {
  if (!uids || uids.length === 0) return '—';
  return uids.map((u) => `\`${u}\``).join(' · ');
}

// ---------------------------------------------------------------------------
// 2. SRS — System Requirements Specification (RENDER · REQ slice, 29148 shape).
//    Specimen #2 — DISTINCT from `spec` (#12, full dump): grouped by the UC/FUNC
//    a REQ serves, each REQ with statement / priority / status / verification /
//    full trace. Orphan REQs (no UC, no FUNC) are flagged in their own section.
// ---------------------------------------------------------------------------

export function renderSrs(graph: Graph, name: string): string {
  const idx = nodeIndex(graph);
  const reqs = nodesOfType(graph, 'REQ');
  const verify = adjacency(graph, 'verify'); // TEST → REQ : rev[req] = tests
  const satisfy = adjacency(graph, 'satisfy'); // FUNC/FCHAIN → REQ : rev[req] = satisfiers
  const allocate = adjacency(graph, 'allocate'); // FUNC → MOD : fwd[func] = modules
  const compose = adjacency(graph, 'compose'); // UC → REQ : rev[req] = parents(incl. UC)

  // REQ → owning UC (a REQ is composed by a UC). Deterministic: first UC by uid.
  const ucOfReq = new Map<string, string>();
  for (const r of reqs) {
    const parents = (compose.rev.get(r.uid) ?? []).filter((p) => p.startsWith('UC-'));
    if (parents.length > 0) ucOfReq.set(r.uid, parents[0]);
  }

  const lines: string[] = [
    generatedHeader(
      name,
      `System Requirements Specification · SRS-${name}`,
      `REQ-Slice nach ISO/IEC/IEEE 29148, gruppiert nach UC. ${reqs.length} REQ. Deterministisch generiert.`,
    ),
  ];

  // 1 Scope / 2 References / 3 Definitions — stable static front matter.
  lines.push('## 1  Scope', '');
  const sys = nodesOfType(graph, 'SYS')[0];
  lines.push(
    sys
      ? `${ref(sys.uid)} — ${cell(sys.description ?? sys.name)}`
      : 'SYS-graphcode — a governed graph substrate.',
    '',
    'This SRS is the REQ-slice render of the live graph (SSOT). It is NOT the model spec (full dump).',
    '',
    '## 2  References',
    '',
    '@sigloch/contracts/se (ontology + V3_RULES) · ADR-001 (goal & constraints) · Format-E codec spec.',
    '',
    '## 3  Definitions',
    '',
    'Apply-Gate · mutate() · Trace pattern (TRACE_PATTERNS) · Readiness gate (SRR/PDR/CDR/TRR).',
    '',
    '## 4  Requirements',
    '',
  );

  // Group REQ under their UC (sorted by UC uid), then orphan section.
  const ucs = nodesOfType(graph, 'UC');
  let section = 0;
  let verifiedCount = 0;
  for (const uc of ucs) {
    const members = reqs.filter((r) => ucOfReq.get(r.uid) === uc.uid);
    if (members.length === 0) continue;
    section += 1;
    lines.push(`### 4.${section}  ${ref(uc.uid)} — ${cell(uc.name)}`, '');
    for (const r of members) {
      verifiedCount += renderReqEntry(lines, r, idx, verify, satisfy, allocate);
    }
  }

  // Cross-cutting / operational: a REQ with NO UC parent.
  const orphans = reqs.filter((r) => !ucOfReq.has(r.uid));
  section += 1;
  lines.push(`### 4.${section}  Cross-cutting / operational (no single UC)`, '');
  if (orphans.length === 0) {
    lines.push('— none —', '');
  } else {
    for (const r of orphans) {
      verifiedCount += renderReqEntry(lines, r, idx, verify, satisfy, allocate);
    }
  }

  lines.push('## 5  Traceability summary', '');
  lines.push(
    `${reqs.length} REQ · ${verifiedCount} verified · ${reqs.length - verifiedCount} without a verifying TEST (R-01).`,
    '',
  );
  return lines.join('\n');
}

/** Render one 29148-shaped REQ entry; returns 1 if the REQ has a verifying TEST. */
function renderReqEntry(
  lines: string[],
  r: GraphNode,
  idx: Map<string, GraphNode>,
  verify: { rev: Map<string, string[]> },
  satisfy: { rev: Map<string, string[]> },
  allocate: { fwd: Map<string, string[]> },
): number {
  const kinds = reqKinds(r);
  const priority = kinds.includes('non-functional') ? 'should' : 'must';
  const tests = verify.rev.get(r.uid) ?? [];
  const satisfiers = satisfy.rev.get(r.uid) ?? [];
  // allocate is FUNC → MOD; a REQ's modules = union of its satisfiers' modules.
  const mods = new Set<string>();
  for (const s of satisfiers) for (const m of allocate.fwd.get(s) ?? []) mods.add(m);
  const modList = [...mods].sort((a, b) => a.localeCompare(b));

  lines.push(
    `${ref(r.uid)}  priority: ${priority} · status: ${status(r) || 'n/a'}${
      kinds.length ? ` · kinds: ${kinds.join('/')}` : ''
    }`,
  );
  lines.push(`  Statement      ${cell(r.description ?? r.name)}`);
  lines.push(
    `  Verification   ${
      tests.length ? tests.map((t) => `${t} (${testLevel(idx.get(t) ?? ({} as GraphNode))})`).join(', ') : '⚠ no TEST (R-01)'
    }`,
  );
  lines.push(
    `  Trace          satisfy ◀ ${refList(satisfiers)} · allocate ▶ ${refList(modList)} · verify ◀ ${refList(tests)}`,
  );
  lines.push('');
  return tests.length > 0 ? 1 : 0;
}

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

  lines.push('## Schemas (Zod contracts)', '', '| Interface (SCHEMA) | Contract (Zod) | status |', '|---|---|---|');
  for (const s of schemas) {
    const attrs = (s.attributes['attributes'] as { zodDefinition?: unknown } | undefined) ?? undefined;
    const zod = attrs && typeof attrs.zodDefinition === 'string' ? attrs.zodDefinition : (s.description ?? s.name);
    lines.push(`| ${ref(s.uid)} | ${cell(String(zod))} | ${status(s) || 'n/a'} |`);
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
  lines.push('```', '              ╱╲', '             ╱E2╲          System level · SYS-graphcode');
  lines.push(`            ╱ E  ╲         ${sysGap}`);
  lines.push('           ╱──────╲');
  lines.push(`          ╱  UC /   ╲       Use-case level · ${ucCount} UC`);
  lines.push(`         ╱integration╲      ⚠ ${ucScenario} / ${ucCount} UC exercised by a scenario test`);
  lines.push('        ╱────────────╲');
  lines.push(`       ╱  Function /   ╲     Function level · ${funcCount} FUNC`);
  lines.push('      ╱      unit       ╲');
  lines.push('     ╱───────────────────╲', '```', '');

  lines.push('| Level | Element | Test kind | Tests | Coverage | Verdict |', '|---|---|---|---|---|---|');
  lines.push(`| System | SYS (${sysCount}) | E2E | ${e2e} | ${e2e} / ${sysCount} | ${sysVerdict} |`);
  lines.push(
    `| Use-case | UC (${ucCount}) | integration / acceptance | ${ucLevel} | ${ucScenario} / ${ucCount} scenario | ${ucVerdict} |`,
  );
  lines.push(`| Function | FUNC (${funcCount}) | unit | ${unit} | ${funcCount} / ${funcCount} | ${funcVerdict} |`);
  lines.push(`| (support) | — | conformance | ${conformance} | codec round-trip | ✓ |`);
  lines.push('');
  lines.push(
    `> GENERATED — TEST level derived from the graph position of the REQ it verifies (SYS/UC/FUNC),`,
    `> not a testRef.level attribute; System & UC rows are DERIVED from coverage, so a missing E2E`,
    `> run surfaces as ✗ (currently ${e2e} E2E test(s)) instead of being silently absent.`,
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
  // CR → MS via relation; MS compose → CR also exists. Use both, dedup, sort.
  const relation = adjacency(graph, 'relation'); // CR → MS : rev[ms] = CRs
  const compose = adjacency(graph, 'compose'); // MS → CR : fwd[ms] = CRs
  const idx = nodeIndex(graph);
  for (const ms of ordered) {
    const crSet = new Set<string>([...(relation.rev.get(ms.uid) ?? []), ...(compose.fwd.get(ms.uid) ?? [])]);
    const crs = [...crSet].filter((c) => c.startsWith('CR-')).sort((a, b) => a.localeCompare(b));
    const open = crs.filter((c) => status(idx.get(c) ?? ({} as GraphNode)) === 'open');
    const blocking = open.length > 0 ? refList(open) : '—';
    lines.push(`| ${ref(ms.uid)} | ${status(ms) || 'n/a'} | ${open.length} / ${crs.length} | ${blocking} |`);
  }
  lines.push('', '> GENERATED — renders the milestones/CRs the Impl Plan created. Originates nothing.', '');
  return lines.join('\n');
}

/**
 * Deterministic topological order of milestones by the depends-on relation
 * (dependency before dependent). Ties and cycles fall back to uid order. Pure.
 */
function topoOrderMilestones(graph: Graph, milestones: GraphNode[]): GraphNode[] {
  const ids = new Set(milestones.map((m) => m.uid));
  // depends-on: source depends-on target → target must come first.
  const deps = new Map<string, Set<string>>(); // node → its prerequisites
  for (const m of milestones) deps.set(m.uid, new Set());
  for (const e of graph.edges) {
    if (e.attributes['label'] !== 'depends-on') continue;
    if (!ids.has(e.sourceId) || !ids.has(e.targetId)) continue;
    deps.get(e.sourceId)!.add(e.targetId);
  }
  const remaining = milestones.map((m) => m.uid).sort((a, b) => a.localeCompare(b));
  const placed = new Set<string>();
  const order: string[] = [];
  // Kahn-style with uid tiebreak; bounded by node count to avoid infinite loop on a cycle.
  for (let guard = 0; guard < milestones.length && remaining.length > placed.size; guard++) {
    let progressed = false;
    for (const uid of remaining) {
      if (placed.has(uid)) continue;
      const prereqs = deps.get(uid)!;
      if ([...prereqs].every((p) => placed.has(p) || !ids.has(p))) {
        order.push(uid);
        placed.add(uid);
        progressed = true;
      }
    }
    if (!progressed) break; // cycle — emit the rest in uid order below.
  }
  for (const uid of remaining) if (!placed.has(uid)) order.push(uid);
  const idx = nodeIndex(graph);
  return order.map((uid) => idx.get(uid)!).filter(Boolean);
}

// ---------------------------------------------------------------------------
// 13. Change Log (RENDER · CR rollup by milestone + status). Specimen #13.
// ---------------------------------------------------------------------------

export function renderChangelog(graph: Graph, name: string): string {
  const crs = nodesOfType(graph, 'CR');
  const relation = adjacency(graph, 'relation'); // CR → MS : fwd[cr] = MSs
  const compose = adjacency(graph, 'compose'); // MS → CR
  const lines: string[] = [
    generatedHeader(
      name,
      'Change Log',
      `${crs.length} CR, gruppiert nach Milestone. Deterministisch generiert. Nie hand-maintained.`,
    ),
  ];

  // CR → MS: prefer the CR's relation target that is an MS; else the MS that composes it.
  const msOfCr = new Map<string, string>();
  for (const cr of crs) {
    const viaRel = (relation.fwd.get(cr.uid) ?? []).filter((t) => t.startsWith('MS-')).sort((a, b) => a.localeCompare(b))[0];
    msOfCr.set(cr.uid, viaRel ?? '');
  }
  for (const ms of nodesOfType(graph, 'MS')) {
    for (const cr of compose.fwd.get(ms.uid) ?? []) {
      if (cr.startsWith('CR-') && !msOfCr.get(cr)) msOfCr.set(cr, ms.uid);
    }
  }

  const done = crs.filter((c) => status(c) === 'done').length;
  const open = crs.filter((c) => status(c) === 'open').length;
  lines.push(`Total: ${crs.length} CR · ${done} done · ${open} open.`, '');

  for (const ms of nodesOfType(graph, 'MS')) {
    const members = crs.filter((c) => msOfCr.get(c.uid) === ms.uid);
    lines.push(`## ${ref(ms.uid)} — ${cell(ms.name)}`, '');
    if (members.length === 0) {
      lines.push('— no CR —', '');
      continue;
    }
    lines.push('| CR | status | name |', '|---|---|---|');
    for (const cr of members) lines.push(`| ${ref(cr.uid)} | ${status(cr) || 'n/a'} | ${cell(cr.name)} |`);
    lines.push('');
  }

  // CRs not assigned to any milestone.
  const unassigned = crs.filter((c) => !msOfCr.get(c.uid));
  lines.push('## (unassigned)', '');
  if (unassigned.length === 0) {
    lines.push('— none —', '');
  } else {
    lines.push('| CR | status | name |', '|---|---|---|');
    for (const cr of unassigned) lines.push(`| ${ref(cr.uid)} | ${status(cr) || 'n/a'} | ${cell(cr.name)} |`);
    lines.push('');
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 10. FMEA — render-form of risk/mitigation REQ + S/O/D (Specimen #10).
//    CREATE populates the graph; this is the deterministic RENDER of it. An empty
//    risk set renders an explicit empty-state, never a silently blank file.
// ---------------------------------------------------------------------------

export function renderFmea(graph: Graph, name: string): string {
  const risks = nodesOfType(graph, 'REQ').filter((r) => reqKinds(r).includes('risk'));
  const verify = adjacency(graph, 'verify');
  const relation = adjacency(graph, 'relation'); // risk REQ → mitigation REQ (label may vary)
  const lines: string[] = [
    generatedHeader(
      name,
      'FMEA (functional risk)',
      `Render-Form von REQ kind=risk + S/O/D. ${risks.length} Risiken. Deterministisch generiert.`,
    ),
  ];
  lines.push(
    '| Failure mode (REQ kind=risk) | S | O | D | AP | Mitigation | verify |',
    '|---|---|---|---|---|---|---|',
  );
  const num = (n: GraphNode, k: string): string => {
    const v = n.attributes[k];
    return typeof v === 'number' ? String(v) : '—';
  };
  const ap = (n: GraphNode): string => {
    const s = Number(n.attributes['S']);
    if (!Number.isFinite(s)) return '—';
    return s >= 8 ? 'High' : s >= 4 ? 'Med' : 'Low';
  };
  for (const r of risks) {
    const mitig = (relation.fwd.get(r.uid) ?? []).filter((t) => t.startsWith('REQ-')).sort((a, b) => a.localeCompare(b));
    const verified = (verify.rev.get(r.uid) ?? []).length > 0 ? '✓' : '✗';
    lines.push(
      `| ${cell(r.description ?? r.name)} | ${num(r, 'S')} | ${num(r, 'O')} | ${num(r, 'D')} | ${ap(r)} | ${refList(mitig)} | ${verified} |`,
    );
  }
  if (risks.length === 0) {
    lines.push('| — keine REQ kind=risk im Graph (FMEA noch nicht durchgeführt) | — | — | — | — | — | — |');
  }
  lines.push(
    '',
    '> RENDER of the risk/mitigation REQ the se-fmea CREATE mutated into the graph (S/O/D, AP severity-first).',
    '',
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 1. ConOps — render-form of the operational REQ + ACTOR frame (Specimen #1).
//    CREATE authors the operational REQ before the UCs; this RENDER projects them.
// ---------------------------------------------------------------------------

export function renderConOps(graph: Graph, name: string): string {
  const actors = nodesOfType(graph, 'ACTOR');
  const sys = nodesOfType(graph, 'SYS')[0];
  // Operational REQ: kinds ∋ "operational"; fall back to none → empty-state.
  const opReqs = nodesOfType(graph, 'REQ').filter((r) => reqKinds(r).includes('operational'));
  const lines: string[] = [
    generatedHeader(
      name,
      'Concept of Operations',
      `Operationaler Rahmen: ACTOR + operationale REQ. ${actors.length} ACTOR. Deterministisch generiert.`,
    ),
  ];
  lines.push('## System context', '');
  lines.push(sys ? `${ref(sys.uid)} — ${cell(sys.description ?? sys.name)}` : '— no SYS —', '');

  lines.push('## Operational requirements (authored before the use cases)', '');
  lines.push('| Operational REQ | Decision | status |', '|---|---|---|');
  if (opReqs.length === 0) {
    lines.push('| — keine REQ kind=operational im Graph | — | — |');
  } else {
    for (const r of opReqs) lines.push(`| ${ref(r.uid)} | ${cell(r.description ?? r.name)} | ${status(r) || 'n/a'} |`);
  }
  lines.push('');

  lines.push(`## Actors (${actors.length}) — who operates / consumes`, '');
  for (const a of actors) lines.push(`- ${ref(a.uid)} — ${cell(a.name)}`);
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 11. Trade Study — render-form of decision CRs + relation edges (Specimen #11).
//    Walks relation(label ∈ {alternative, superseded-by, decides}); empty → note.
// ---------------------------------------------------------------------------

export function renderTrade(graph: Graph, name: string): string {
  const idx = nodeIndex(graph);
  const tradeLabels = new Set(['alternative', 'superseded-by', 'decides']);
  const edges = graph.edges
    .filter((e) => e.edgeType === 'relation' && tradeLabels.has(String(e.attributes['label'])))
    .sort(
      (a, b) =>
        a.sourceId.localeCompare(b.sourceId) ||
        String(a.attributes['label']).localeCompare(String(b.attributes['label'])) ||
        a.targetId.localeCompare(b.targetId),
    );
  const lines: string[] = [
    generatedHeader(
      name,
      'Trade Studies',
      `Render der decision-CRs + relation(decides/alternative/superseded-by). Deterministisch generiert.`,
    ),
  ];
  lines.push('| Decision (CR) | label | → target | CR status |', '|---|---|---|---|');
  if (edges.length === 0) {
    lines.push('| — keine Trade-Study-relation im Graph | — | — | — |');
  } else {
    for (const e of edges) {
      const cr = idx.get(e.sourceId);
      lines.push(`| ${ref(e.sourceId)} | ${String(e.attributes['label'])} | ${ref(e.targetId)} | ${cr ? status(cr) || 'n/a' : '—'} |`);
    }
  }
  lines.push(
    '',
    '> RENDER — walks relation(label ∈ {alternative, superseded-by, decides}) + CR status.',
    '> The comparison matrix stays in the spike; only the decision + links live in the graph.',
    '',
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 14. Implementation Plan — render-form of the MS/CR slices + depends-on chain
//     (Specimen #14). CREATE (se-plan) originates the slices; this RENDERs them
//     leaf→root by milestone with the test-level mapping mirroring the pyramid.
// ---------------------------------------------------------------------------

export function renderImplPlan(graph: Graph, name: string): string {
  const milestones = topoOrderMilestones(graph, nodesOfType(graph, 'MS'));
  const relation = adjacency(graph, 'relation'); // CR → MS : rev[ms] = CRs
  const compose = adjacency(graph, 'compose'); // MS → CR
  const idx = nodeIndex(graph);
  const lines: string[] = [
    generatedHeader(
      name,
      'Implementation Plan',
      `MS/CR-Slices + depends-on, leaf ▲ root. Deterministisch generiert.`,
    ),
  ];
  lines.push(`depends-on:  ${milestones.map((m) => m.uid).join('  ◀  ')}`, '');
  for (const ms of milestones) {
    const crSet = new Set<string>([...(relation.rev.get(ms.uid) ?? []), ...(compose.fwd.get(ms.uid) ?? [])]);
    const crs = [...crSet].filter((c) => c.startsWith('CR-')).sort((a, b) => a.localeCompare(b));
    lines.push(`## ${ref(ms.uid)} — ${cell(ms.name)} · status: ${status(ms) || 'n/a'}`, '');
    if (crs.length === 0) {
      lines.push('— no CR —', '');
      continue;
    }
    lines.push('| CR | status | name |', '|---|---|---|');
    for (const c of crs) {
      const cr = idx.get(c);
      lines.push(`| ${ref(c)} | ${cr ? status(cr) || 'n/a' : '—'} | ${cr ? cell(cr.name) : '—'} |`);
    }
    lines.push('');
  }
  lines.push(
    '> RENDER — the leaf→root MS/CR cut se-plan CREATEd; the test-level mapping mirrors the pyramid (#7).',
    '',
  );
  return lines.join('\n');
}
