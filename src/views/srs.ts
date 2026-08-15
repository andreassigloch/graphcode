/**
 * views/srs.ts — the SRS projection (Specimen #2), the largest single view
 * (MOD-docs / FUNC-render-views, split out of exporter-views.ts by CR-GC-260).
 *
 * Its own module because it is the only view with a non-trivial ordering algorithm
 * (`ioTopoOrder`, used nowhere else) and it alone exceeded the other eleven views
 * combined. DISTINCT from `spec` (#12, the type-grouped dump) — they must differ.
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
import { nodesOfType, nodeIndex, adjacency, reqKinds, testLevel, status, ref, refList } from './helpers.js';

// ---------------------------------------------------------------------------
// 2. SRS — System Requirements Specification (RENDER · textual spec).
//    Specimen #2 — DISTINCT from `spec` (#12, type-grouped dump). CR-GVE-172
//    (aise text-view pattern): compose = hierarchy, io = sibling order.
//    Chapters: Scope(SYS) · Akteure(ACTOR) · Use Cases & Verhalten
//    (UC→FCHAIN→FUNC, io-topologically ordered) · Schnittstellen(FLOW/SCHEMA)
//    · Architektur(MOD) · Cross-cutting · Verifikation(TEST) · Traceability.
//    Every REQ sits under the element that satisfy-s it; multiple satisfiers
//    repeat the full entry (readability) with an "auch unter" cross-note.
//    Elements are HEADINGS so a heading-based TOC lists them and a per-line
//    edit hotspot finds their uid.
// ---------------------------------------------------------------------------

/**
 * Deterministic io-topological order of a member FUNC list (aise text-view
 * principle: chain edges order siblings). Successor = FUNC ─io→ FLOW ─io→ FUNC
 * between member CLUSTERS — a blackbox parent FUNC (FUNC→FUNC compose, R-20)
 * carries no io itself, so each member's cluster = itself + its non-member
 * FUNC compose-descendants, and any descendant's flow orders the parent.
 * Order = depth-first flow-following from the uid-sorted zero-indegree starts
 * (reads as the chain runs), cycle/disconnected remainder appended in uid order.
 */
function ioTopoOrder(
  members: GraphNode[],
  io: { fwd: Map<string, string[]> },
  compose: { fwd: Map<string, string[]> },
  idx: Map<string, GraphNode>,
): GraphNode[] {
  const uids = members.map((m) => m.uid).sort((a, b) => a.localeCompare(b));
  const memberSet = new Set(uids);
  // funcUid → owning member (itself, or the member whose compose subtree holds it).
  const owner = new Map<string, string>();
  for (const u of uids) {
    const stack = [u];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (owner.has(cur)) continue;
      owner.set(cur, u);
      for (const child of compose.fwd.get(cur) ?? []) {
        if (idx.get(child)?.type === 'FUNC' && !memberSet.has(child)) stack.push(child);
      }
    }
  }
  const succ = new Map<string, string[]>(uids.map((u) => [u, []]));
  const hasIncoming = new Set<string>();
  const ownedUids = [...owner.keys()].sort((a, b) => a.localeCompare(b));
  for (const funcUid of ownedUids) {
    const u = owner.get(funcUid)!;
    for (const flow of io.fwd.get(funcUid) ?? []) {
      for (const tgt of io.fwd.get(flow) ?? []) {
        const v = owner.get(tgt);
        if (!v || v === u) continue;
        succ.get(u)!.push(v);
        hasIncoming.add(v);
      }
    }
  }
  const out: string[] = [];
  const seen = new Set<string>();
  const follow = (u: string): void => {
    if (seen.has(u)) return;
    seen.add(u);
    out.push(u);
    for (const v of succ.get(u) ?? []) follow(v);
  };
  for (const u of uids) if (!hasIncoming.has(u)) follow(u);
  for (const u of uids) follow(u);
  const order = new Map(out.map((u, i) => [u, i]));
  return [...members].sort((a, b) => order.get(a.uid)! - order.get(b.uid)!);
}

export function renderSrs(graph: Graph, name: string): string {
  const idx = nodeIndex(graph);
  const reqs = nodesOfType(graph, 'REQ');
  const verify = adjacency(graph, 'verify'); // TEST → REQ
  const satisfy = adjacency(graph, 'satisfy'); // FUNC/FCHAIN/MOD/SYS → REQ
  const allocate = adjacency(graph, 'allocate'); // FUNC → MOD
  const compose = adjacency(graph, 'compose');
  const io = adjacency(graph, 'io');
  const relation = adjacency(graph, 'relation'); // FLOW → SCHEMA

  const lines: string[] = [
    generatedHeader(
      name,
      `System Requirements Specification · SRS-${name}`,
      `Textuelle Spezifikation (29148-Anlehnung): compose=Hierarchie, io=Reihenfolge, REQ unter ihrem satisfy-Element. ${reqs.length} REQ. Deterministisch generiert.`,
    ),
  ];

  // Markdown caps headings at h6 — deeper nesting stays h6 (still a heading,
  // still in the TOC; only the visual level saturates). Nummerierung bis zur
  // vorletzten Ebene: Struktur-Headings tragen Dezimal-Pfade; REQ-Einträge
  // sind die unterste Ebene (Statements) und bleiben unnummeriert.
  const num = (path: number[]): string => path.join('.');
  const heading = (level: number, path: number[] | null, n: GraphNode): string =>
    `${'#'.repeat(Math.min(level, 6))} ${path ? `${num(path)}  ` : ''}\`${n.uid}\` — ${cell(n.name)}`;

  /** REQ nodes satisfied by uid (satisfy also carries FUNC→UC — REQ only). */
  const satisfiedReqs = (uid: string): GraphNode[] =>
    (satisfy.fwd.get(uid) ?? [])
      .map((r) => idx.get(r))
      .filter((n): n is GraphNode => n?.type === 'REQ');

  // A REQ renders as an entry ONLY under these satisfier types (chapters 1+3);
  // MOD-satisfiers stay a `satisfy ▶` line on the module (no duplicate entries
  // in the architecture chapter — user decision, CR-GVE-172 follow-up).
  const RENDERED_SATISFIERS = new Set(['SYS', 'FCHAIN', 'FUNC']);
  const renderedSatisfiersOf = (r: GraphNode): string[] =>
    (satisfy.rev.get(r.uid) ?? []).filter((s) => RENDERED_SATISFIERS.has(idx.get(s)?.type ?? ''));

  /** One 29148 REQ entry: heading + statement + meta + trace. `under` = the
   *  satisfier this occurrence sits beneath (cross-note lists the others). */
  const reqEntry = (r: GraphNode, level: number, under: string | null): void => {
    const kinds = reqKinds(r);
    const priority = kinds.includes('non-functional') ? 'should' : 'must';
    const tests = verify.rev.get(r.uid) ?? [];
    const satisfiers = satisfy.rev.get(r.uid) ?? [];
    const others = under ? renderedSatisfiersOf(r).filter((s) => s !== under) : [];
    // allocate is FUNC → MOD; a REQ's modules = union of its satisfiers' modules.
    const mods = new Set<string>();
    for (const s of satisfiers) for (const m of allocate.fwd.get(s) ?? []) mods.add(m);
    const modList = [...mods].sort((a, b) => a.localeCompare(b));
    lines.push(heading(level, null, r), '');
    if (others.length > 0) lines.push(`> auch unter: ${refList(others)}`, '');
    lines.push(cell(r.description ?? r.name), '');
    lines.push(
      `priority: ${priority} · status: ${status(r) || 'n/a'}${kinds.length ? ` · kinds: ${kinds.join('/')}` : ''}`,
      '',
      `Verification ◀ ${
        tests.length
          ? tests
              .map((t) => {
                const lvl = testLevel(idx.get(t) ?? ({} as GraphNode));
                return lvl ? `\`${t}\` (${lvl})` : `\`${t}\``;
              })
              .join(' · ')
          : '⚠ no TEST (R-01)'
      } · satisfy ◀ ${refList(satisfiers)} · allocate ▶ ${refList(modList)}`,
      '',
    );
  };

  /** FUNC entry with its satisfied REQs and compose-child FUNCs (blackbox
   *  decomposition) nested one level deeper. `context` = the parent (FCHAIN or
   *  FUNC) this occurrence renders under; other parents become the cross-note. */
  const funcEntry = (f: GraphNode, level: number, path: number[], context: string | null): void => {
    const parents = (compose.rev.get(f.uid) ?? []).filter((p) => {
      const t = idx.get(p)?.type;
      return t === 'FCHAIN' || t === 'FUNC';
    });
    const others = context ? parents.filter((p) => p !== context) : [];
    const inflows = (io.rev.get(f.uid) ?? []).filter((u) => idx.get(u)?.type === 'FLOW');
    const outflows = (io.fwd.get(f.uid) ?? []).filter((u) => idx.get(u)?.type === 'FLOW');
    lines.push(heading(level, path, f), '');
    if (others.length > 0) lines.push(`> auch in: ${refList(others)}`, '');
    if (f.description) lines.push(cell(f.description), '');
    lines.push(
      `io ◀ ${refList(inflows)} · io ▶ ${refList(outflows)} · allocate ▶ ${refList(allocate.fwd.get(f.uid))}`,
      '',
    );
    for (const r of satisfiedReqs(f.uid)) reqEntry(r, level + 1, f.uid);
    const children = (compose.fwd.get(f.uid) ?? [])
      .map((c) => idx.get(c))
      .filter((n): n is GraphNode => n?.type === 'FUNC');
    children.forEach((child, i) => funcEntry(child, level + 1, [...path, i + 1], f.uid));
  };

  // ── 1 Scope — SYS + system-level (SYS-satisfied) REQs ──
  lines.push('## 1  Scope', '');
  const sys = nodesOfType(graph, 'SYS')[0];
  if (sys) {
    lines.push(`${ref(sys.uid)} — ${cell(sys.description ?? sys.name)}`, '');
    for (const r of satisfiedReqs(sys.uid)) reqEntry(r, 3, sys.uid);
  } else {
    lines.push('— kein SYS-Element im Graph —', '');
  }

  // ── 2 Akteure ──
  const actors = nodesOfType(graph, 'ACTOR');
  lines.push('## 2  Akteure', '');
  if (actors.length === 0) lines.push('— none —', '');
  actors.forEach((a, i) => {
    lines.push(heading(3, [2, i + 1], a), '');
    if (a.description) lines.push(cell(a.description), '');
    lines.push(`io ▶ ${refList(io.fwd.get(a.uid))} · io ◀ ${refList(io.rev.get(a.uid))}`, '');
  });

  // ── 3 Use Cases & Verhalten — UC → FCHAIN → FUNC (io-topological) ──
  lines.push('## 3  Use Cases & Verhalten', '');
  const funcs = nodesOfType(graph, 'FUNC');
  const fchains = nodesOfType(graph, 'FCHAIN');
  const renderedChains = new Set<string>();
  const chainEntry = (fc: GraphNode, level: number, path: number[], context: string | null): void => {
    renderedChains.add(fc.uid);
    const parents = (compose.rev.get(fc.uid) ?? []).filter((p) => idx.get(p)?.type === 'UC');
    const others = context ? parents.filter((p) => p !== context) : [];
    lines.push(heading(level, path, fc), '');
    if (others.length > 0) lines.push(`> auch in: ${refList(others)}`, '');
    if (fc.description) lines.push(cell(fc.description), '');
    for (const r of satisfiedReqs(fc.uid)) reqEntry(r, level + 1, fc.uid);
    const members = (compose.fwd.get(fc.uid) ?? [])
      .map((m) => idx.get(m))
      .filter((n): n is GraphNode => n?.type === 'FUNC');
    ioTopoOrder(members, io, compose, idx).forEach((f, i) =>
      funcEntry(f, level + 1, [...path, i + 1], fc.uid),
    );
  };
  let ucSection = 0;
  for (const uc of nodesOfType(graph, 'UC')) {
    ucSection += 1;
    lines.push(heading(3, [3, ucSection], uc), '');
    if (uc.description) lines.push(cell(uc.description), '');
    const triggers = (io.rev.get(uc.uid) ?? []).filter((u) => {
      const t = idx.get(u)?.type;
      return t === 'ACTOR' || t === 'FLOW';
    });
    if (triggers.length > 0) lines.push(`io ◀ ${refList(triggers)}`, '');
    const chains = (compose.fwd.get(uc.uid) ?? [])
      .map((c) => idx.get(c))
      .filter((n): n is GraphNode => n?.type === 'FCHAIN');
    chains.forEach((fc, i) => chainEntry(fc, 4, [3, ucSection, i + 1], uc.uid));
  }
  const looseChains = fchains.filter((fc) => !renderedChains.has(fc.uid));
  if (looseChains.length > 0) {
    ucSection += 1;
    lines.push(`### 3.${ucSection}  Funktionsketten ohne UC`, '');
    looseChains.forEach((fc, i) => chainEntry(fc, 4, [3, ucSection, i + 1], null));
  }
  // FUNCs reachable from no FCHAIN and no FUNC parent — completeness guard.
  const looseFuncs = funcs.filter(
    (f) =>
      !(compose.rev.get(f.uid) ?? []).some((p) => {
        const t = idx.get(p)?.type;
        return t === 'FCHAIN' || t === 'FUNC';
      }),
  );
  if (looseFuncs.length > 0) {
    ucSection += 1;
    lines.push(`### 3.${ucSection}  Funktionen ohne FCHAIN`, '');
    looseFuncs.forEach((f, i) => funcEntry(f, 4, [3, ucSection, i + 1], null));
  }

  // ── 4 Schnittstellen — FLOW (SCHEMA-Bezug als Zeile, eigenes Kapitel 5) ──
  lines.push('## 4  Schnittstellen', '');
  const flows = nodesOfType(graph, 'FLOW');
  if (flows.length === 0) lines.push('— none —', '');
  flows.forEach((fl, i) => {
    const schemas = (relation.fwd.get(fl.uid) ?? []).filter((u) => idx.get(u)?.type === 'SCHEMA');
    lines.push(heading(3, [4, i + 1], fl), '');
    if (fl.description) lines.push(cell(fl.description), '');
    lines.push(
      `io ◀ ${refList(io.rev.get(fl.uid))} · io ▶ ${refList(io.fwd.get(fl.uid))} · schema ▶ ${refList(schemas)}`,
      '',
    );
  });

  // ── 5 Schemata ──
  lines.push('## 5  Schemata', '');
  const schemas = nodesOfType(graph, 'SCHEMA');
  if (schemas.length === 0) lines.push('— none —', '');
  schemas.forEach((sc, i) => {
    const boundFlows = (relation.rev.get(sc.uid) ?? []).filter((u) => idx.get(u)?.type === 'FLOW');
    lines.push(heading(3, [5, i + 1], sc), '');
    if (sc.description) lines.push(cell(sc.description), '');
    if (boundFlows.length > 0) lines.push(`schema ◀ ${refList(boundFlows)}`, '');
  });

  // ── 6 Architektur — MOD compose tree + allocated FUNCs. KEINE REQ-Einträge
  //    (die stehen unter ihren FUNC/FCHAIN/SYS); MOD-satisfy nur als Trace-Zeile. ──
  lines.push('## 6  Architektur', '');
  const mods = nodesOfType(graph, 'MOD');
  if (mods.length === 0) lines.push('— none —', '');
  const modEntry = (m: GraphNode, level: number, path: number[]): void => {
    lines.push(heading(level, path, m), '');
    if (m.description) lines.push(cell(m.description), '');
    const modReqs = satisfiedReqs(m.uid).map((r) => r.uid);
    lines.push(
      `allocate ◀ ${refList(allocate.rev.get(m.uid))}${modReqs.length ? ` · satisfy ▶ ${refList(modReqs)}` : ''}`,
      '',
    );
    const children = (compose.fwd.get(m.uid) ?? [])
      .map((c) => idx.get(c))
      .filter((n): n is GraphNode => n?.type === 'MOD');
    children.forEach((child, i) => modEntry(child, level + 1, [...path, i + 1]));
  };
  const modRoots = mods.filter(
    (m) => !(compose.rev.get(m.uid) ?? []).some((p) => idx.get(p)?.type === 'MOD'),
  );
  modRoots.forEach((m, i) => modEntry(m, 3, [6, i + 1]));

  // ── 7 Cross-cutting — REQ ohne SYS/FCHAIN/FUNC-Satisfier (nirgends als
  //    Eintrag gerendert; ein reiner MOD-Satisfier zählt nicht, Kap. 6 listet
  //    keine REQ-Einträge mehr). ──
  lines.push('## 7  Cross-cutting Requirements', '');
  const orphans = reqs.filter((r) => renderedSatisfiersOf(r).length === 0);
  if (orphans.length === 0) lines.push('— none —', '');
  for (const r of orphans) reqEntry(r, 3, null);

  // ── 8 Verifikation — TEST inventory with verified REQs ──
  lines.push('## 8  Verifikation', '');
  const tests = nodesOfType(graph, 'TEST');
  if (tests.length === 0) lines.push('— none —', '');
  tests.forEach((t, i) => {
    lines.push(heading(3, [8, i + 1], t), '');
    if (t.description) lines.push(cell(t.description), '');
    // CR-GC-338: 1:n — eine Abnahme kann mehrere Laufdateien belegen (CR-SM-231).
    const refs = Array.isArray(t.attributes['testRefs']) ? (t.attributes['testRefs'] as { file?: unknown }[]) : [];
    const files = refs.map((r) => r?.file).filter((f): f is string => typeof f === 'string');
    const fileNote =
      files.length > 0
        ? ` · testRefs: ${files.map((f) => `\`${f}\``).join(', ')}`
        : '';
    lines.push(`verify ▶ ${refList(verify.fwd.get(t.uid))}${fileNote}`, '');
  });

  // ── 9 Traceability summary ──
  const verifiedCount = reqs.filter((r) => (verify.rev.get(r.uid) ?? []).length > 0).length;
  lines.push('## 9  Traceability summary', '');
  lines.push(
    `${reqs.length} REQ · ${verifiedCount} verified · ${reqs.length - verifiedCount} without a verifying TEST (R-01).`,
    '',
  );
  return lines.join('\n');
}

