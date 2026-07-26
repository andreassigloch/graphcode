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
import { nodesOfType, nodeIndex, adjacency, reqKinds, status, ref, refList, topoOrderMilestones } from './helpers.js';

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
