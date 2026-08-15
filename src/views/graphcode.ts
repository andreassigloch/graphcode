/**
 * views/graphcode.ts — the project-facing artifact projections (MOD-docs /
 * FUNC-render-views, split out of exporter-views.ts by CR-GC-260).
 *
 * changelog · fmea · conops · trade · implplan — the render-form views that carry
 * project history and decisions rather than an INCOSE review artifact (those are in
 * views/incose.ts).
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
import { nodesOfType, nodeIndex, adjacency, reqKinds, status, ref, refList, topoOrderMilestones, testResult } from './helpers.js';

// ---------------------------------------------------------------------------
// 13. Change Log (RENDER · CR rollup by milestone + status). Specimen #13.
// ---------------------------------------------------------------------------

export function renderChangelog(graph: Graph, name: string): string {
  const crs = nodesOfType(graph, 'CR');
  const relation = adjacency(graph, 'relation'); // CR → MS : fwd[cr] = MSs
  const lines: string[] = [
    generatedHeader(
      name,
      'Change Log',
      `${crs.length} CR, gruppiert nach Milestone. Deterministisch generiert. Nie hand-maintained.`,
    ),
  ];

  // CR → MS über `CR -relation-> MS` — die EINZIGE deklarierte Richtung.
  // CR-GC-308: hier stand zusätzlich ein `MS -compose-> CR`-Zweig. Diese Kante gibt
  // es im Meta-Modell nicht (legal ist MS compose → FUNC/REQ/UC/MS); sie war
  // symptomlos, weil der legale relation-Zweig danebenstand und die Union das Loch
  // füllte. Toter Code, der behauptete, das Modell sähe anders aus, als es aussieht.
  const msOfCr = new Map<string, string>();
  for (const cr of crs) {
    const viaRel = (relation.fwd.get(cr.uid) ?? []).filter((t) => t.startsWith('MS-')).sort((a, b) => a.localeCompare(b))[0];
    msOfCr.set(cr.uid, viaRel ?? '');
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
// 10. FMEA — render-form of risk/mitigation REQ (Specimen #10).
//
// CR-GC-308: this view read a vocabulary nothing produced. `FM-01`/`FM-02`/`FM-03`
// in @sigloch/contracts/se define the FMEA model completely and run in
// `evaluateAllRules`; the renderer read something else on every axis:
//
//   FM-01 says `severity`/`occurrence`/`detection`   — it read `S`/`O`/`D`
//   FM-02 says compose → REQ[kinds ∋ mitigation]     — it read `relation` → REQ-*
//   FM-03 says verify AND testResult === 'passed'    — it read "a verify edge exists"
//
// The mitigation column was therefore STRUCTURALLY unfillable: `TRACE_PATTERNS` has
// no `REQ -relation-> REQ`, so R-18 flags exactly the edge the view was looking for.
// In the field test it was empty in all 16 rows while the gate reported compliance
// 1.0 — the "green dashboard, blank document" failure class.
//
// Root cause was the skill, not the renderer: `se-fmea.md` named S/O/D only as
// markdown column headers and never said which graph attributes to write. The model
// invented `S`/`O`/`D`, the exporter read the same invention — both drifted away
// from contracts together, which is why nothing ever failed.
//
// The rule is now the source; this only renders it.
// ---------------------------------------------------------------------------

export function renderFmea(graph: Graph, name: string): string {
  const idx = nodeIndex(graph);
  const risks = nodesOfType(graph, 'REQ').filter((r) => reqKinds(r).includes('risk'));
  const verify = adjacency(graph, 'verify');
  const compose = adjacency(graph, 'compose'); // FM-02: risk REQ ─compose→ mitigation REQ
  const lines: string[] = [
    generatedHeader(
      name,
      'FMEA (functional risk)',
      `Render-Form von REQ kind=risk (severity/occurrence/detection nach FM-01). ` +
        `${risks.length} Risiken. Deterministisch generiert.`,
    ),
  ];
  lines.push(
    '| Failure mode (REQ kind=risk) | S | O | D | RPN | Mitigation | verifiziert |',
    '|---|---|---|---|---|---|---|',
  );
  const num = (n: GraphNode, k: string): string => {
    const v = Number(n.attributes[k]);
    return Number.isFinite(v) ? String(v) : '—';
  };
  /**
   * RPN = S·O·D, exakt die Zahl, die FM-03 für seine >100-Schwelle bildet — keine
   * eigene Formel. Die frühere AP-Spalte (`S >= 8 ? 'High' : …`) war hier erfunden
   * und entsprach keinem Standard; die echte AIAG-VDA-Action-Priority kommt aus
   * `actionPriority()`/`apMethod()` in contracts (CR-SM-229) und ist noch nicht
   * publiziert. Bis dahin lieber die nachvollziehbare Regel-Zahl als eine zweite,
   * hauseigene Klassifikation für einen sicherheitsrelevanten Sachverhalt.
   */
  const rpn = (n: GraphNode): string => {
    const s = Number(n.attributes['severity']);
    const o = Number(n.attributes['occurrence']);
    const d = Number(n.attributes['detection']);
    if (!Number.isFinite(s) || !Number.isFinite(o) || !Number.isFinite(d)) return '—';
    return String(s * o * d);
  };
  for (const r of risks) {
    const mitig = (compose.fwd.get(r.uid) ?? [])
      .filter((t) => {
        const n = idx.get(t);
        return n?.type === 'REQ' && reqKinds(n).includes('mitigation');
      })
      .sort((a, b) => a.localeCompare(b));
    // FM-03: nur ein BESTANDENER Test zählt. "Test vorhanden" und "Test bestanden"
    // auseinanderzuhalten ist der ganze Punkt — die alte Version zeigte ✓, sobald
    // irgendeine verify-Kante existierte, was die gefährlichere Lesart ist.
    const verified = (verify.rev.get(r.uid) ?? []).some(
      // CR-GC-338: „bestanden" heisst JEDER testRefs-Eintrag ist `passed` — ein gruener
      // Unit-Lauf darf einen roten Visual-Lauf nicht verdecken (CR-SM-231b).
      (t) => testResult(idx.get(t)!) === 'passed',
    )
      ? '✓'
      : '✗';
    lines.push(
      `| ${cell(r.description ?? r.name)} | ${num(r, 'severity')} | ${num(r, 'occurrence')} | ` +
        `${num(r, 'detection')} | ${rpn(r)} | ${refList(mitig)} | ${verified} |`,
    );
  }
  if (risks.length === 0) {
    lines.push('| — keine REQ kind=risk im Graph (FMEA noch nicht durchgeführt) | — | — | — | — | — | — |');
  }
  lines.push(
    '',
    '> RENDER der risk/mitigation-REQ, die `se-fmea` durchs Gate geschrieben hat.',
    '> Attribute + Kanten exakt wie FM-01/FM-02/FM-03 sie prüfen: `severity`/`occurrence`/',
    '> `detection`, Mitigation über `compose` → REQ[`kinds` ∋ `mitigation`], „verifiziert" nur',
    '> bei einem TEST mit `testResult: passed`. RPN = S·O·D (die FM-03-Zahl).',
    '',
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 1. ConOps — the ISO/IEC/IEEE 29148 §5.2.4 OpsCon projection (Specimen #1).
//
// CR-GC-304 re-cut this view. Three things were wrong:
//
//   1. The operational-REQ filter tested `kinds ∋ "operational"` — UNSATISFIABLE.
//      `ReqKind` in @sigloch/contracts has exactly 7 values and `operational` is
//      not one of them, so the gate can never accept such a REQ. The table was
//      structurally unfillable, no matter how often the create skill ran.
//   2. The view advertised "actors/system/use-cases" and rendered no UC at all.
//      Operational scenarios are the CORE of a ConOps and were entirely absent.
//   3. The change sections had no rendering, although the meta-model has carried
//      `CR relation → {UC, REQ, FUNC, MOD}` since CR-155 exactly to bundle what a
//      change produced.
//
// Section → graph source (nothing invented, every row walks a real edge):
//   §1 System overview                  SYS.description
//   §2 Operational policies/constraints non-functional REQ at SYS/ACTOR scope
//   §3 User classes                     ACTOR + `ACTOR io UC`
//   §4 Operational scenarios            `UC compose FCHAIN compose FUNC`
//   §5 Modes of operation               NAMED GAP — no MODE element type exists
//   §6 Nature of changes / impacts      CR + `CR relation → {UC,REQ,FUNC,MOD}`
// ---------------------------------------------------------------------------

/** Element types a `CR relation` edge points at to mean "this change touched it". */
const CR_IMPACT_TYPES = new Set(['UC', 'REQ', 'FUNC', 'MOD']);

/**
 * The operational slice of the REQ set (CR-GC-304).
 *
 * Operational scope is a GRAPH POSITION, not a `kind`. A non-functional REQ hanging
 * off the SYS root (`SYS compose|satisfy REQ`) or off an ACTOR constrains the system
 * as a whole — deployment, persistence, recovery, degraded operation, ownership,
 * credentials. A REQ allocated only to a single FUNC/MOD is design, not ConOps, and
 * stays out.
 */
export function operationalReqs(graph: Graph): GraphNode[] {
  const idx = nodeIndex(graph);
  const systemScoped = new Set<string>();
  for (const e of graph.edges) {
    const src = idx.get(e.sourceId);
    const tgt = idx.get(e.targetId);
    if (!src || !tgt) continue;
    if (tgt.type === 'REQ' && src.type === 'SYS' && (e.edgeType === 'compose' || e.edgeType === 'satisfy')) {
      systemScoped.add(tgt.uid);
    }
    // An ACTOR-touching REQ is operational by the same argument (user-mgmt/creds).
    if (tgt.type === 'REQ' && src.type === 'ACTOR') systemScoped.add(tgt.uid);
    if (src.type === 'REQ' && tgt.type === 'ACTOR') systemScoped.add(src.uid);
  }
  return nodesOfType(graph, 'REQ').filter((r) => reqKinds(r).includes('non-functional') && systemScoped.has(r.uid));
}

export function renderConOps(graph: Graph, name: string): string {
  const idx = nodeIndex(graph);
  const actors = nodesOfType(graph, 'ACTOR');
  const ucs = nodesOfType(graph, 'UC');
  const sys = nodesOfType(graph, 'SYS')[0];
  const opReqs = operationalReqs(graph);
  const io = adjacency(graph, 'io');
  const compose = adjacency(graph, 'compose');
  const relation = adjacency(graph, 'relation');

  const lines: string[] = [
    generatedHeader(
      name,
      'Concept of Operations',
      `OpsCon nach ISO/IEC/IEEE 29148 §5.2.4, projiziert aus dem Graphen: ${actors.length} ACTOR, ` +
        `${ucs.length} UC, ${opReqs.length} operationale REQ. Deterministisch generiert.`,
    ),
  ];

  // ── §1 System overview ────────────────────────────────────────────────────
  lines.push('## 1  System overview', '');
  lines.push(sys ? `${ref(sys.uid)} — ${cell(sys.description || sys.name)}` : '— kein SYS im Graph —', '');

  // ── §2 Operational policies and constraints ───────────────────────────────
  lines.push('## 2  Operational policies & constraints', '');
  lines.push('| Constraint | Aussage | status |', '|---|---|---|');
  if (opReqs.length === 0) {
    lines.push('| — keine system-/actor-gebundene REQ kind=non-functional im Graph | — | — |');
  } else {
    for (const r of opReqs) lines.push(`| ${ref(r.uid)} | ${cell(r.description || r.name)} | ${status(r) || 'n/a'} |`);
  }
  lines.push(
    '',
    '> Systemweit bindende non-functional REQ (am SYS-Anker oder an einem ACTOR).',
    '> Eine REQ, die nur an einem FUNC/MOD haengt, ist Design und steht hier nicht.',
    '',
  );

  // ── §3 User classes and involved personnel ────────────────────────────────
  lines.push(`## 3  User classes & involved personnel (${actors.length})`, '');
  if (actors.length === 0) {
    lines.push('— keine ACTOR im Graph —', '');
  } else {
    for (const a of actors) {
      const triggered = (io.fwd.get(a.uid) ?? [])
        .filter((t) => idx.get(t)?.type === 'UC')
        .sort((x, y) => x.localeCompare(y));
      const suffix = triggered.length > 0 ? ` — triggert ${refList(triggered)}` : ' — keine UC-Kopplung im Graph';
      lines.push(`- ${ref(a.uid)} — ${cell(a.name)}${suffix}`);
    }
    lines.push('');
  }

  // ── §4 Operational scenarios ──────────────────────────────────────────────
  lines.push(`## 4  Operational scenarios (${ucs.length} UC)`, '');
  if (ucs.length === 0) {
    lines.push('— keine UC im Graph —', '');
  } else {
    for (const uc of ucs) {
      const actorsOf = (io.rev.get(uc.uid) ?? [])
        .filter((s) => idx.get(s)?.type === 'ACTOR')
        .sort((x, y) => x.localeCompare(y));
      lines.push(`### ${ref(uc.uid)} — ${cell(uc.name)}`, '');
      lines.push(cell(uc.description || uc.name), '');
      if (actorsOf.length > 0) lines.push(`Ausgeloest von: ${refList(actorsOf)}`, '');
      const chains = (compose.fwd.get(uc.uid) ?? [])
        .filter((t) => idx.get(t)?.type === 'FCHAIN')
        .sort((x, y) => x.localeCompare(y));
      if (chains.length === 0) {
        // Never silently dropped: "no operational flow described for this use case"
        // IS the ConOps statement, and the gap is the point of the section.
        lines.push('— kein Betriebsablauf beschrieben (keine FCHAIN) —', '');
        continue;
      }
      for (const c of chains) {
        const funcs = (compose.fwd.get(c) ?? [])
          .filter((t) => idx.get(t)?.type === 'FUNC')
          .sort((x, y) => x.localeCompare(y));
        const seq = funcs.length > 0 ? funcs.map((f) => ref(f)).join(' → ') : '— keine FUNC in der Kette —';
        lines.push(`- ${ref(c)} — ${cell(idx.get(c)?.name ?? c)}: ${seq}`);
      }
      lines.push('');
    }
  }

  // ── §5 Modes of operation — the named gap ─────────────────────────────────
  lines.push('## 5  Modes of operation', '');
  lines.push(
    '— **Lücke, bewusst offen.** 29148 zählt Betriebsmodi (normal / degraded /',
    'maintenance / recovery) zum ConOps-Kern. Die SE-Ontologie hat **keinen',
    'MODE-Elementtyp**; heute reist ein Modus als REQ mit. Ein neuer ElementType ist',
    'Familie-Review + contracts-Bump (Drift-Lock L1/L2), kein lokaler View-Fix — die',
    'Lücke steht deshalb hier, statt verschwiegen zu werden. —',
    '',
  );

  // ── §6 Nature of changes and summary of impacts ───────────────────────────
  // `CR relation → MS` is the PLAN axis (rendered by the changelog view), not a
  // change to the operational concept — only {UC,REQ,FUNC,MOD} targets count.
  const changes = nodesOfType(graph, 'CR')
    .map((cr) => ({
      cr,
      touched: (relation.fwd.get(cr.uid) ?? [])
        .filter((t) => CR_IMPACT_TYPES.has(idx.get(t)?.type ?? ''))
        .sort((x, y) => x.localeCompare(y)),
    }))
    .filter((c) => c.touched.length > 0);

  lines.push('## 6  Nature of changes & summary of impacts', '');
  lines.push('| CR | status | Änderung | Betroffene Elemente |', '|---|---|---|---|');
  if (changes.length === 0) {
    lines.push('| — kein CR mit relation auf UC/REQ/FUNC/MOD im Graph | — | — | — |');
  } else {
    for (const { cr, touched } of changes) {
      lines.push(`| ${ref(cr.uid)} | ${status(cr) || 'n/a'} | ${cell(cr.name)} | ${refList(touched)} |`);
    }
  }
  lines.push(
    '',
    '> Jeder CR buendelt, was er erzeugt/veraendert hat — nicht immer ein neuer Use Case,',
    '> oft nur eine Funktion oder ein Requirement. Reine Milestone-Zuordnungen',
    '> (`CR relation MS`) sind Planung und stehen im Changelog-View, nicht hier.',
    '',
  );
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
  // CR-GC-308: `MS -compose-> CR` gibt es im Meta-Modell nicht — der Zweig ist raus.
  const relation = adjacency(graph, 'relation'); // CR → MS : rev[ms] = CRs
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
    const crs = (relation.rev.get(ms.uid) ?? [])
      .filter((c) => c.startsWith('CR-'))
      .sort((a, b) => a.localeCompare(b));
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
