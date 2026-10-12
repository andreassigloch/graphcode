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
import { actionPriority, apMethod, DEFAULT_METRIC_POLICY, riskCarriers } from '@sigloch/contracts/se';
import { toOntologyGraph } from '../kernel/conformance.js';
import { generatedHeader, cell } from './exporter.js';
import { nodesOfType, nodeIndex, adjacency, reqKinds, reqRole, status, ref, refList, topoOrderMilestones, testResult } from './helpers.js';

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
//   FM-02 says compose → mitigation REQ              — it read `relation` → REQ-*
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
//
// CR-GC-673: risk/mitigation are no longer `kinds` values but the REQ's ROLE
// (`attributes.role`, CR-SM-365/366) — FM-01..03 read only the role, so the view
// reads it through the same single reader (`readReqRole` via `reqRole`).
// ---------------------------------------------------------------------------

// CR-GC-801: die Sicht war ein Register (Satz, S/O/D, RPN, Gegenmaßnahme, Haken) in
// uid-Reihenfolge. Ort, Träger, Priorität, Nachweis und der Stand der Gegenmaßnahme standen
// im Modell und nicht in der Sicht. Sie rechnet weiterhin nichts selbst: die Priorität kommt
// aus `actionPriority()`, die Träger aus `riskCarriers()` (beide contracts), „verifiziert" aus
// derselben Aggregation wie FM-03 (`testResult`).
export function renderFmea(graph: Graph, name: string): string {
  const idx = nodeIndex(graph);
  const verify = adjacency(graph, 'verify');
  const compose = adjacency(graph, 'compose'); // FM-02: risk REQ ─compose→ mitigation REQ
  const satisfy = adjacency(graph, 'satisfy');
  const relation = adjacency(graph, 'relation');
  const carriers = new Map(riskCarriers(toOntologyGraph(graph)).risks.map((r) => [r.riskId, r.carriers]));
  const ofType = (uids: string[] | undefined, type: string): string[] =>
    (uids ?? []).filter((u) => idx.get(u)?.type === type).sort((a, b) => a.localeCompare(b));
  const rating = (n: GraphNode, k: string): number | null => {
    const v = Number(n.attributes[k]);
    return n.attributes[k] !== undefined && Number.isFinite(v) ? v : null;
  };
  const show = (v: number | null): string => (v === null ? '—' : String(v));
  const order = { High: 0, Medium: 1, Low: 2, '—': 3 } as const;

  const risks = nodesOfType(graph, 'REQ')
    .filter((r) => reqRole(r) === 'risk')
    .map((r) => {
      const s = rating(r, 'severity');
      const o = rating(r, 'occurrence');
      const d = rating(r, 'detection');
      const bewertet = s !== null && o !== null && d !== null;
      // RPN = S·O·D, exakt die Zahl, die FM-03 bildet — keine eigene Formel. Die Einstufung
      // kommt aus `actionPriority()` mit der Schwelle des Katalogs (CR-SM-229, CR-SM-236).
      const rpn = bewertet ? s * o * d : null;
      const schwelle = DEFAULT_METRIC_POLICY.riskRpn;
      const ap: keyof typeof order =
        bewertet && schwelle !== null ? actionPriority(s, o, d, schwelle, DEFAULT_METRIC_POLICY.apTable ?? undefined) : '—';
      const massnahmen = ofType(compose.fwd.get(r.uid), 'REQ').filter((m) => reqRole(idx.get(m)!) === 'mitigation');
      const tests = ofType(verify.rev.get(r.uid), 'TEST');
      // FM-03: nur ein BESTANDENER Test zählt, und „bestanden" heißt JEDER testRefs-Eintrag
      // ist `passed` (CR-GC-338, CR-SM-231b).
      const verifiziert = tests.some((t) => testResult(idx.get(t)!) === 'passed');
      const ohneFunktion = massnahmen.filter((m) => (satisfy.rev.get(m) ?? []).length === 0);
      return { r, s, o, d, rpn, ap, massnahmen, tests, verifiziert, ohneFunktion };
    })
    .sort((a, b) => order[a.ap] - order[b.ap] || (b.rpn ?? -1) - (a.rpn ?? -1) || a.r.uid.localeCompare(b.r.uid));

  const hoch = risks.filter((x) => x.ap === 'High').length;
  const verifiziert = risks.filter((x) => x.verifiziert).length;
  const ohne = risks.reduce((sum, x) => sum + x.ohneFunktion.length, 0);
  const lines: string[] = [
    generatedHeader(
      name,
      'FMEA (functional risk)',
      `Render-Form von REQ role=risk. ${risks.length} Risiken, ${hoch} mit hoher Priorität, ${verifiziert} verifiziert, ` +
        `${ohne} ${ohne === 1 ? 'Gegenmaßnahme' : 'Gegenmaßnahmen'} ohne Funktion. Deterministisch generiert.`,
    ),
  ];
  if (risks.length === 0) {
    lines.push('— keine REQ role=risk im Graph (FMEA noch nicht durchgeführt)', '');
    return lines.join('\n');
  }

  lines.push(
    '## Übersicht (nach Priorität)',
    '',
    '| # | Risiko | Kette | S | O | D | RPN | AP | Träger | verifiziert |',
    '|---|---|---|---|---|---|---|---|---|---|',
  );
  risks.forEach((x, i) => {
    lines.push(
      `| ${i + 1} | ${cell(x.r.name)} | ${refList(ofType(satisfy.rev.get(x.r.uid), 'FCHAIN'))} | ${show(x.s)} | ${show(x.o)} | ` +
        `${show(x.d)} | ${show(x.rpn)} | ${x.ap} | ${refList(carriers.get(x.r.uid))} | ${x.verifiziert ? '✓' : '✗'} |`,
    );
  });

  risks.forEach((x, i) => {
    const rationale = typeof x.r.attributes['rationale'] === 'string' ? (x.r.attributes['rationale'] as string) : '';
    const erfueller = ofType(satisfy.rev.get(x.r.uid), 'MOD').concat(ofType(satisfy.rev.get(x.r.uid), 'SYS'));
    const analysen = ofType(relation.rev.get(x.r.uid), 'CR');
    lines.push(
      '',
      `### ${i + 1}. ${x.r.name} (\`${x.r.uid}\`)`,
      '',
      cell(x.r.description ?? x.r.name),
      '',
      `- **Bewertung:** S ${show(x.s)} · O ${show(x.o)} · D ${show(x.d)} · RPN ${show(x.rpn)} · AP ${x.ap}`,
      `- **Kette:** ${refList(ofType(satisfy.rev.get(x.r.uid), 'FCHAIN'))}` + (erfueller.length ? ` · außerdem an ${refList(erfueller)}` : ''),
      `- **Anwendungsfall:** ${refList(ofType(compose.rev.get(x.r.uid), 'UC'))}`,
      `- **Träger:** ${refList(carriers.get(x.r.uid))}`,
    );
    if (rationale) lines.push(`- **Befund:** ${cell(rationale)}`);
    lines.push(
      `- **Analyse:** ${analysen.length ? analysen.map((c) => `\`${c}\` (${cell(idx.get(c)?.description ?? '')})`).join(' · ') : '—'}`,
      '',
      '| Gegenmaßnahme | Wortlaut | Erfüller |',
      '|---|---|---|',
    );
    for (const m of x.massnahmen) {
      const by = (satisfy.rev.get(m) ?? []).slice().sort((a, b) => a.localeCompare(b));
      lines.push(`| \`${m}\` | ${cell(idx.get(m)?.description ?? '')} | ${by.length ? refList(by) : '**Funktion fehlt**'} |`);
    }
    if (x.massnahmen.length === 0) lines.push('| — keine Gegenmaßnahme (FM-02) | — | — |');
    lines.push('', '| Nachweis | Datei | Ergebnis | gelaufen am |', '|---|---|---|---|');
    for (const t of x.tests) {
      const refs = Array.isArray(idx.get(t)?.attributes['testRefs'])
        ? (idx.get(t)!.attributes['testRefs'] as Array<{ file?: string; result?: string; ranAt?: string }>)
        : [];
      if (refs.length === 0) lines.push(`| \`${t}\` | ungebunden | — | — |`);
      for (const ref of refs) {
        lines.push(`| \`${t}\` | ${ref.file ?? '—'} | ${ref.result ?? 'kein Ergebnis'} | ${ref.ranAt ? ref.ranAt.slice(0, 10) : '—'} |`);
      }
    }
    if (x.tests.length === 0) lines.push('| — kein Test (R-01) | — | — | — |');
  });

  lines.push(
    '',
    `> RENDER der risk/mitigation-REQ, die \`se-fmea\` durchs Gate geschrieben hat. Bewertung aus`,
    `> \`severity\`/\`occurrence\`/\`detection\` (FM-01), Gegenmaßnahme über \`compose\` (FM-02), RPN = S·O·D,`,
    `> AP aus \`actionPriority()\` (Verfahren: ${apMethod(DEFAULT_METRIC_POLICY.apTable ?? undefined)}, Schwelle des Katalogs),`,
    '> Träger aus `riskCarriers()`. „Verifiziert" heißt: ein Test, dessen `testRefs` alle `passed` tragen (FM-03).',
    '> Die Sicht zeigt die Risiken, die als Anforderung im Modell stehen. Fehlerarten, die die Analyse bewertet und nicht als Anforderung geschrieben hat,',
    '> stehen mit Bewertung und Begründung im Analyse-CR.',
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
//      `ReqKind` in @sigloch/contracts (since CR-SM-366 exactly functional |
//      non-functional) has no `operational` value, so the gate can never accept such a REQ. The table was
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
  // Eine FMEA-REQ (role risk|mitigation, CR-SM-365) ist nicht-funktional und oft am SYS, aber
  // Gefaehrdung bzw. Gegenmassnahme — sie steht in der FMEA-Sicht, nicht als Betriebsvorgabe.
  return nodesOfType(graph, 'REQ').filter(
    (r) => reqKinds(r).includes('non-functional') && systemScoped.has(r.uid) && reqRole(r) === undefined,
  );
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

  // contracts 9.x: die Direktkante `ACTOR io→UC` ist entfallen — die UC-Kopplung eines
  // Actors ist die ERREICHBARKEIT über den tragenden Pfad `ACTOR io↔ FLOW io↔ FUNC`,
  // FUNC in einer FCHAIN des UC, in BEIDE Richtungen (dieselbe Ableitung wie UC-02).
  const funcToUcs = new Map<string, Set<string>>();
  for (const uc of ucs) {
    for (const chain of (compose.fwd.get(uc.uid) ?? []).filter((t) => idx.get(t)?.type === 'FCHAIN')) {
      for (const fn of (compose.fwd.get(chain) ?? []).filter((t) => idx.get(t)?.type === 'FUNC')) {
        if (!funcToUcs.has(fn)) funcToUcs.set(fn, new Set());
        funcToUcs.get(fn)!.add(uc.uid);
      }
    }
  }
  const ucsOfActor = (actorUid: string): string[] => {
    const reached = new Set<string>();
    // Trigger-Richtung: ACTOR io→ FLOW io→ FUNC.
    for (const flow of (io.fwd.get(actorUid) ?? []).filter((t) => idx.get(t)?.type === 'FLOW')) {
      for (const fn of io.fwd.get(flow) ?? []) for (const uc of funcToUcs.get(fn) ?? []) reached.add(uc);
    }
    // Liefer-Richtung: FUNC io→ FLOW io→ ACTOR.
    for (const flow of (io.rev.get(actorUid) ?? []).filter((t) => idx.get(t)?.type === 'FLOW')) {
      for (const fn of io.rev.get(flow) ?? []) {
        if (idx.get(fn)?.type !== 'FUNC') continue;
        for (const uc of funcToUcs.get(fn) ?? []) reached.add(uc);
      }
    }
    return [...reached].sort((x, y) => x.localeCompare(y));
  };

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
    // CR-GC-455: die Beschreibung MIT rendern. ISO 29148 §5.2.4 will die Nutzerklasse
    // charakterisiert sehen, nicht nur benannt — und seit die drei Menschen-Personas in
    // ACTOR-owner zusammenliegen, ist ihre Unterscheidung genau dort und nirgends sonst.
    for (const a of actors) {
      const triggered = ucsOfActor(a.uid);
      const suffix = triggered.length > 0 ? ` — triggert ${refList(triggered)}` : ' — keine UC-Kopplung im Graph';
      lines.push(`- **${cell(a.name)}** (${ref(a.uid)})${suffix}`);
      if (a.description) lines.push(`  - ${cell(a.description)}`);
    }
    lines.push('');
  }

  // ── §4 Operational scenarios ──────────────────────────────────────────────
  lines.push(`## 4  Operational scenarios (${ucs.length} UC)`, '');
  if (ucs.length === 0) {
    lines.push('— keine UC im Graph —', '');
  } else {
    for (const uc of ucs) {
      const actorsOf = actors
        .filter((a) => ucsOfActor(a.uid).includes(uc.uid))
        .map((a) => a.uid)
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
      .filter((c) => idx.get(c)?.type === 'CR') // CR-GC-525: by type, never by uid prefix (BOK-CR-*)
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
