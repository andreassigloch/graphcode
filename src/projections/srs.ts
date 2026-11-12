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
import { generatedHeader, cell } from './exporter.js';
import { nodesOfType, nodeIndex, adjacency, reqKinds, reqRole, testLevel, status, ref, refList } from './helpers.js';

// ---------------------------------------------------------------------------
// 2. SRS — System Requirements Specification (RENDER · textual spec).
//    Specimen #2 — DISTINCT from `spec` (#12, type-grouped dump). CR-GVE-172
//    (aise text-view pattern): compose = hierarchy, io = sibling order.
//    CR-GC-909: gegliedert nach ISO/IEC/IEEE 29148:2018 Kl. 9 — BRS (9.3), StRS (9.4) und
//    SyRS (9.5) als Teile EINER Sicht. Die Abschnitte und ihre Reihenfolge stehen in
//    `SRS_OUTLINE`; jeder Abschnitt ist eine Ueberschrift, auch leer (dann `SRS_EMPTY`).
//    Welche REQ in welchem Abschnitt steht, entscheidet `srsSection` aus `kinds` und dem
//    satisfy-Traeger — kein eigenes Attribut. Elements are HEADINGS so a heading-based TOC
//    lists them and a per-line edit hotspot finds their uid.
// ---------------------------------------------------------------------------

/** Ein Abschnitt der Gliederung: Dezimalnummer (= Tiefe) und Titel der Norm. */
export interface SrsSection {
  readonly num: string;
  readonly title: string;
}

/**
 * DIE Gliederung der SRS-Sicht (CR-GC-909), in Normreihenfolge. Teil 1 ist die BRS
 * (Geschaeftsziele = SYS-Beschreibung und UC), Teil 2 die StRS (Stakeholder = ACTOR),
 * Teil 3 die SyRS mit den Anforderungsabschnitten 3.3.1–3.3.13 aus 29148 9.5.
 */
export const SRS_OUTLINE: readonly SrsSection[] = [
  { num: '1', title: 'Business Requirements (BRS)' },
  { num: '1.1', title: 'Business purpose' },
  { num: '1.2', title: 'Mission, goals and objectives' },
  { num: '2', title: 'Stakeholder Requirements (StRS)' },
  { num: '2.1', title: 'Stakeholders' },
  { num: '3', title: 'System Requirements (SyRS)' },
  { num: '3.1', title: 'Introduction' },
  { num: '3.1.1', title: 'System purpose' },
  { num: '3.1.2', title: 'System scope' },
  { num: '3.1.3', title: 'System overview' },
  { num: '3.2', title: 'References' },
  { num: '3.3', title: 'System requirements' },
  { num: '3.3.1', title: 'Functional requirements' },
  { num: '3.3.2', title: 'Usability requirements' },
  { num: '3.3.3', title: 'Performance requirements' },
  { num: '3.3.4', title: 'System interfaces' },
  { num: '3.3.5', title: 'System operations' },
  { num: '3.3.6', title: 'System modes and states' },
  { num: '3.3.7', title: 'Physical characteristics' },
  { num: '3.3.8', title: 'Environmental conditions' },
  { num: '3.3.9', title: 'System security' },
  { num: '3.3.10', title: 'Information management' },
  { num: '3.3.11', title: 'Policies and regulations' },
  { num: '3.3.12', title: 'System life cycle sustainment' },
  { num: '3.3.13', title: 'Packaging, handling, shipping and transportation' },
  { num: '3.4', title: 'Verification' },
  { num: '3.5', title: 'Appendices' },
  { num: '3.5.1', title: 'Assumptions and dependencies' },
  { num: '3.5.2', title: 'Acronyms and abbreviations' },
];

/** Der Satz unter einem Abschnitt, den das Modell nicht fuellt. */
export const SRS_EMPTY = '— keine Anforderung dieser Art im Modell —';

/**
 * Abschnitt einer REQ je satisfy-Traeger (Entscheidung des Auftraggebers 2026-11-12, CR-GC-909):
 * functional → Functional requirements, gleich welcher Traeger; non-functional an FCHAIN oder
 * FUNC → Performance, an MOD → Physical characteristics, an SYS oder ohne Traeger → Policies.
 * Eine REQ ohne `kinds` gilt als functional — wie bisher die Prioritaet `must`.
 */
export function srsSection(kinds: readonly string[], carrierType: string | undefined): '3.3.1' | '3.3.3' | '3.3.7' | '3.3.11' {
  if (!kinds.includes('non-functional')) return '3.3.1';
  if (carrierType === 'FCHAIN' || carrierType === 'FUNC') return '3.3.3';
  if (carrierType === 'MOD') return '3.3.7';
  return '3.3.11';
}

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
      `Gliederung nach ISO/IEC/IEEE 29148:2018 Kl. 9 (BRS, StRS, SyRS): compose=Hierarchie, io=Reihenfolge, REQ unter ihrem satisfy-Element. ${reqs.length} REQ. Deterministisch generiert.`,
    ),
  ];

  // Markdown caps headings at h6 — deeper nesting stays h6 (still a heading,
  // still in the TOC; only the visual level saturates). REQ-Eintraege sind die
  // unterste Ebene (Statements) und bleiben unnummeriert.
  const heading = (level: number, path: number[] | null, n: GraphNode): string =>
    `${'#'.repeat(Math.min(level, 6))} ${path ? `${path.join('.')}  ` : ''}\`${n.uid}\` — ${cell(n.name)}`;
  const outline = new Map(SRS_OUTLINE.map((s) => [s.num, s]));
  /** Die Ueberschrift eines Abschnitts der Gliederung — Titel nur aus `SRS_OUTLINE`. */
  const section = (num: string): number => {
    const level = num.split('.').length + 1;
    lines.push(`${'#'.repeat(level)} ${num}  ${outline.get(num)!.title}`, '');
    return level;
  };
  const path = (num: string, ...rest: number[]): number[] => [...num.split('.').map(Number), ...rest];
  const empty = (): void => {
    lines.push(SRS_EMPTY, '');
  };

  const sectionOf = (r: GraphNode, carrier: string | undefined): string =>
    srsSection(reqKinds(r), carrier ? idx.get(carrier)?.type : undefined);
  /** REQs satisfied by `uid` that land in section `num`. */
  const reqsIn = (uid: string, num: string): GraphNode[] =>
    (satisfy.fwd.get(uid) ?? [])
      .map((r) => idx.get(r))
      .filter((n): n is GraphNode => n?.type === 'REQ' && sectionOf(n, uid) === num);

  /** One 29148 REQ entry: heading + statement + meta + trace. `under` = the
   *  satisfier this occurrence sits beneath (cross-note lists the others). */
  const reqEntry = (r: GraphNode, level: number, under: string | null): void => {
    const kinds = reqKinds(r);
    const role = reqRole(r); // CR-GC-673: die FMEA-Rolle ist ein eigenes Feld, keine Art
    const priority = kinds.includes('non-functional') ? 'should' : 'must';
    const tests = verify.rev.get(r.uid) ?? [];
    const satisfiers = satisfy.rev.get(r.uid) ?? [];
    const others = under ? satisfiers.filter((s) => s !== under) : [];
    // allocate is FUNC → MOD; a REQ's modules = union of its satisfiers' modules.
    const mods = new Set<string>();
    for (const s of satisfiers) for (const m of allocate.fwd.get(s) ?? []) mods.add(m);
    const modList = [...mods].sort((a, b) => a.localeCompare(b));
    lines.push(heading(level, null, r), '');
    if (others.length > 0) lines.push(`> auch unter: ${refList(others)}`, '');
    lines.push(cell(r.description ?? r.name), '');
    lines.push(
      `priority: ${priority} · status: ${status(r) || 'n/a'}${kinds.length ? ` · kinds: ${kinds.join('/')}` : ''}` +
        (role ? ` · role: ${role}` : ''),
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

  const sys = nodesOfType(graph, 'SYS')[0];
  const ucs = nodesOfType(graph, 'UC');
  const actors = nodesOfType(graph, 'ACTOR');
  const mods = nodesOfType(graph, 'MOD');
  const modRoots = mods.filter((m) => !(compose.rev.get(m.uid) ?? []).some((p) => idx.get(p)?.type === 'MOD'));

  // ── 1 BRS — Geschaeftsziele: SYS-Beschreibung und die Anwendungsfaelle ──
  section('1');
  section('1.1');
  lines.push(sys ? `${ref(sys.uid)} — ${cell(sys.description ?? sys.name)}` : '— kein SYS-Element im Graph —', '');
  section('1.2');
  if (ucs.length === 0) empty();
  for (const uc of ucs) lines.push(`- ${ref(uc.uid)} — ${cell(uc.name)}${uc.description ? `: ${cell(uc.description)}` : ''}`);
  if (ucs.length > 0) lines.push('');

  // ── 2 StRS — Stakeholder sind die Akteure ──
  section('2');
  const lvlStake = section('2.1');
  if (actors.length === 0) empty();
  actors.forEach((a, i) => {
    lines.push(heading(lvlStake + 1, path('2.1', i + 1), a), '');
    if (a.description) lines.push(cell(a.description), '');
    lines.push(`io ▶ ${refList(io.fwd.get(a.uid))} · io ◀ ${refList(io.rev.get(a.uid))}`, '');
  });

  // ── 3 SyRS ──
  section('3');
  section('3.1');
  section('3.1.1');
  lines.push(sys ? `${ref(sys.uid)} — ${cell(sys.name)}` : '— kein SYS-Element im Graph —', '');
  section('3.1.2');
  lines.push(`Anwendungsfälle: ${refList(ucs.map((u) => u.uid))}`, '');
  section('3.1.3');
  lines.push(`Akteure: ${refList(actors.map((a) => a.uid))} · Module: ${refList(modRoots.map((m) => m.uid))}`, '');
  section('3.2');
  empty();
  section('3.3');

  // ── 3.3.1 Functional — UC → FCHAIN → FUNC (io-topological), functional REQ darunter ──
  const lvlFun = section('3.3.1');
  const funcs = nodesOfType(graph, 'FUNC');
  const fchains = nodesOfType(graph, 'FCHAIN');
  const shownFunctional = new Set<string>();
  const functionalUnder = (uid: string, level: number): void => {
    for (const r of reqsIn(uid, '3.3.1')) {
      shownFunctional.add(r.uid);
      reqEntry(r, level, uid);
    }
  };
  /** FUNC entry with its functional REQs and compose-child FUNCs (blackbox decomposition)
   *  one level deeper. `context` = the parent this occurrence renders under. */
  const funcEntry = (f: GraphNode, level: number, at: number[], context: string | null): void => {
    const parents = (compose.rev.get(f.uid) ?? []).filter((p) => {
      const t = idx.get(p)?.type;
      return t === 'FCHAIN' || t === 'FUNC';
    });
    const others = context ? parents.filter((p) => p !== context) : [];
    const inflows = (io.rev.get(f.uid) ?? []).filter((u) => idx.get(u)?.type === 'FLOW');
    const outflows = (io.fwd.get(f.uid) ?? []).filter((u) => idx.get(u)?.type === 'FLOW');
    lines.push(heading(level, at, f), '');
    if (others.length > 0) lines.push(`> auch in: ${refList(others)}`, '');
    if (f.description) lines.push(cell(f.description), '');
    lines.push(`io ◀ ${refList(inflows)} · io ▶ ${refList(outflows)} · allocate ▶ ${refList(allocate.fwd.get(f.uid))}`, '');
    functionalUnder(f.uid, level + 1);
    const children = (compose.fwd.get(f.uid) ?? []).map((c) => idx.get(c)).filter((n): n is GraphNode => n?.type === 'FUNC');
    children.forEach((child, i) => funcEntry(child, level + 1, [...at, i + 1], f.uid));
  };
  const renderedChains = new Set<string>();
  const chainEntry = (fc: GraphNode, level: number, at: number[], context: string | null): void => {
    renderedChains.add(fc.uid);
    const parents = (compose.rev.get(fc.uid) ?? []).filter((p) => idx.get(p)?.type === 'UC');
    const others = context ? parents.filter((p) => p !== context) : [];
    lines.push(heading(level, at, fc), '');
    if (others.length > 0) lines.push(`> auch in: ${refList(others)}`, '');
    if (fc.description) lines.push(cell(fc.description), '');
    functionalUnder(fc.uid, level + 1);
    const members = (compose.fwd.get(fc.uid) ?? []).map((m) => idx.get(m)).filter((n): n is GraphNode => n?.type === 'FUNC');
    ioTopoOrder(members, io, compose, idx).forEach((f, i) => funcEntry(f, level + 1, [...at, i + 1], fc.uid));
  };
  let k = 0;
  for (const uc of ucs) {
    k += 1;
    lines.push(heading(lvlFun + 1, path('3.3.1', k), uc), '');
    if (uc.description) lines.push(cell(uc.description), '');
    const triggers = (io.rev.get(uc.uid) ?? []).filter((u) => ['ACTOR', 'FLOW'].includes(idx.get(u)?.type ?? ''));
    if (triggers.length > 0) lines.push(`io ◀ ${refList(triggers)}`, '');
    const chains = (compose.fwd.get(uc.uid) ?? []).map((c) => idx.get(c)).filter((n): n is GraphNode => n?.type === 'FCHAIN');
    chains.forEach((fc, i) => chainEntry(fc, lvlFun + 2, path('3.3.1', k, i + 1), uc.uid));
  }
  const looseChains = fchains.filter((fc) => !renderedChains.has(fc.uid));
  if (looseChains.length > 0) {
    k += 1;
    lines.push(`${'#'.repeat(lvlFun + 1)} 3.3.1.${k}  Funktionsketten ohne UC`, '');
    looseChains.forEach((fc, i) => chainEntry(fc, lvlFun + 2, path('3.3.1', k, i + 1), null));
  }
  // FUNCs reachable from no FCHAIN and no FUNC parent — completeness guard.
  const looseFuncs = funcs.filter(
    (f) => !(compose.rev.get(f.uid) ?? []).some((p) => ['FCHAIN', 'FUNC'].includes(idx.get(p)?.type ?? '')),
  );
  if (looseFuncs.length > 0) {
    k += 1;
    lines.push(`${'#'.repeat(lvlFun + 1)} 3.3.1.${k}  Funktionen ohne FCHAIN`, '');
    looseFuncs.forEach((f, i) => funcEntry(f, lvlFun + 2, path('3.3.1', k, i + 1), null));
  }
  // functional REQs whose carrier is no FUNC/FCHAIN of the tree (SYS, MOD, none).
  const restFunctional = reqs.filter((r) => sectionOf(r, undefined) === '3.3.1' && !shownFunctional.has(r.uid));
  if (restFunctional.length > 0) {
    k += 1;
    lines.push(`${'#'.repeat(lvlFun + 1)} 3.3.1.${k}  Anforderungen ohne Funktion`, '');
    for (const r of restFunctional) reqEntry(r, lvlFun + 2, null);
  }
  if (ucs.length === 0 && fchains.length === 0 && funcs.length === 0 && restFunctional.length === 0) empty();

  section('3.3.2');
  empty();

  // ── 3.3.3 Performance — non-functional REQ an FCHAIN oder FUNC ──
  const lvlPerf = section('3.3.3');
  const perfCarriers = [...fchains, ...funcs].filter((c) => reqsIn(c.uid, '3.3.3').length > 0);
  if (perfCarriers.length === 0) empty();
  perfCarriers.forEach((c, i) => {
    lines.push(heading(lvlPerf + 1, path('3.3.3', i + 1), c), '');
    for (const r of reqsIn(c.uid, '3.3.3')) reqEntry(r, lvlPerf + 2, c.uid);
  });

  // ── 3.3.4 System interfaces — FLOW und SCHEMA ──
  const lvlIf = section('3.3.4');
  const flows = nodesOfType(graph, 'FLOW');
  const schemas = nodesOfType(graph, 'SCHEMA');
  if (flows.length === 0 && schemas.length === 0) empty();
  if (flows.length > 0) lines.push(`${'#'.repeat(lvlIf + 1)} 3.3.4.1  Datenflüsse`, '');
  flows.forEach((fl, i) => {
    const sc = (relation.fwd.get(fl.uid) ?? []).filter((u) => idx.get(u)?.type === 'SCHEMA');
    lines.push(heading(lvlIf + 2, path('3.3.4', 1, i + 1), fl), '');
    if (fl.description) lines.push(cell(fl.description), '');
    lines.push(`io ◀ ${refList(io.rev.get(fl.uid))} · io ▶ ${refList(io.fwd.get(fl.uid))} · schema ▶ ${refList(sc)}`, '');
  });
  if (schemas.length > 0) lines.push(`${'#'.repeat(lvlIf + 1)} 3.3.4.2  Datenformate`, '');
  schemas.forEach((sc, i) => {
    const boundFlows = (relation.rev.get(sc.uid) ?? []).filter((u) => idx.get(u)?.type === 'FLOW');
    lines.push(heading(lvlIf + 2, path('3.3.4', 2, i + 1), sc), '');
    if (sc.description) lines.push(cell(sc.description), '');
    if (boundFlows.length > 0) lines.push(`schema ◀ ${refList(boundFlows)}`, '');
  });

  section('3.3.5');
  empty();
  section('3.3.6');
  empty();

  // ── 3.3.7 Physical characteristics — der MOD-Baum mit seinen non-functional REQ ──
  const lvlPhys = section('3.3.7');
  if (mods.length === 0) empty();
  const modEntry = (m: GraphNode, level: number, at: number[]): void => {
    lines.push(heading(level, at, m), '');
    if (m.description) lines.push(cell(m.description), '');
    const modReqs = (satisfy.fwd.get(m.uid) ?? []).filter((r) => idx.get(r)?.type === 'REQ');
    lines.push(`allocate ◀ ${refList(allocate.rev.get(m.uid))}${modReqs.length ? ` · satisfy ▶ ${refList(modReqs)}` : ''}`, '');
    for (const r of reqsIn(m.uid, '3.3.7')) reqEntry(r, level + 1, m.uid);
    const children = (compose.fwd.get(m.uid) ?? []).map((c) => idx.get(c)).filter((n): n is GraphNode => n?.type === 'MOD');
    children.forEach((child, i) => modEntry(child, level + 1, [...at, i + 1]));
  };
  modRoots.forEach((m, i) => modEntry(m, lvlPhys + 1, path('3.3.7', i + 1)));

  for (const num of ['3.3.8', '3.3.9', '3.3.10']) {
    section(num);
    empty();
  }

  // ── 3.3.11 Policies and regulations — non-functional REQ an SYS oder ohne Traeger ──
  const lvlPol = section('3.3.11');
  const policies: Array<[GraphNode, string | null]> = [];
  for (const r of reqs) {
    const carriers = satisfy.rev.get(r.uid) ?? [];
    if (carriers.length === 0 && sectionOf(r, undefined) === '3.3.11') policies.push([r, null]);
    for (const c of carriers) if (sectionOf(r, c) === '3.3.11') policies.push([r, c]);
  }
  if (policies.length === 0) empty();
  for (const [r, c] of policies) reqEntry(r, lvlPol + 1, c);

  for (const num of ['3.3.12', '3.3.13']) {
    section(num);
    empty();
  }

  // ── 3.4 Verification — TEST inventory with verified REQs ──
  const lvlVer = section('3.4');
  const tests = nodesOfType(graph, 'TEST');
  if (tests.length === 0) empty();
  tests.forEach((t, i) => {
    lines.push(heading(lvlVer + 1, path('3.4', i + 1), t), '');
    if (t.description) lines.push(cell(t.description), '');
    // CR-GC-338: 1:n — eine Abnahme kann mehrere Laufdateien belegen (CR-SM-231).
    const refs = Array.isArray(t.attributes['testRefs']) ? (t.attributes['testRefs'] as { file?: unknown }[]) : [];
    const files = refs.map((r) => r?.file).filter((f): f is string => typeof f === 'string');
    const fileNote = files.length > 0 ? ` · testRefs: ${files.map((f) => `\`${f}\``).join(', ')}` : '';
    lines.push(`verify ▶ ${refList(verify.fwd.get(t.uid))}${fileNote}`, '');
  });
  const verifiedCount = reqs.filter((r) => (verify.rev.get(r.uid) ?? []).length > 0).length;
  lines.push(
    `Traceability: ${reqs.length} REQ · ${verifiedCount} verified · ${reqs.length - verifiedCount} without a verifying TEST (R-01).`,
    '',
  );

  section('3.5');
  section('3.5.1');
  empty();
  section('3.5.2');
  empty();
  return lines.join('\n');
}
