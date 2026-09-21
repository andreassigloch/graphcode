/**
 * trajektorie.mjs (CR-GC-586) — Auto gegen Hand.
 *
 * Der Bezugspunkt jeder Steuerungsaussage ist der HANDGEFUEHRTE Lauf: der Auto-Modus soll ihn so
 * abbilden, dass daraus verwertbare Verbesserungen folgen. Zwei Blicke, beide mit demselben
 * Regelkatalog fuer beide Seiten:
 *
 *  1. Trajektorie (Rechenweg aus docs/research/fremdlauf-sigllm-2026-09.md §18): der Audit-Trail
 *     wird Zug fuer Zug nachgespielt; je Zug Steuerwert, sein Anker, Modularitaet, Engpass und die
 *     drei Quoten. Gezaehlt wird, wie oft sich eine Groesse BEWEGT — eine Kennzahl, die sich nie
 *     bewegt, kann nicht steuern — und wie lange ein Anker steht.
 *  2. Profil des Endgraphen gegen das Golden: Typen, Fehler, Steuerwert, Anker, ℝ⁶.
 *
 * Der Hand-Trail liegt als `referenz-trail.jsonl` NEBEN dem Golden (Korpus-Konvention). Bis
 * hierher liefen beide Blicke nur als Scratch-Skripte.
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { applyCommands, cloneGraph } from '../../dist/kernel/apply-commands.js';
import { toOntologyGraph } from '../../dist/kernel/conformance.js';
import { metrics, METRIC_DIMENSIONS, steerScore, projectLayer, buildAdjacency, betweenness, modularityOf, modularityQ } from '@sigloch/se-engine';
import { evaluateAllRules, DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';

const at = (e, k) => e[k] ?? e.attributes?.[k];
const r4 = (x) => (x == null || Number.isNaN(x) ? null : Number(x.toFixed(4)));

/** Der Hand-Trail eines Korpus: neben dem Golden, sonst keiner. */
export function referenzTrail(goldenPfad) {
  if (!goldenPfad) return null;
  const p = join(dirname(goldenPfad), 'referenz-trail.jsonl');
  return existsSync(p) ? p : null;
}

/** Modulzugehoerigkeit laut Allokation — die DEKLARIERTE Zerlegung, gegen die Q gemessen wird. */
function deklariert(arch) {
  const modOf = new Map(); for (const t of arch.traces) if (t.type === 'allocate') modOf.set(t.source, t.target);
  const prod = new Map(); for (const t of arch.traces) if (t.type === 'io' && !prod.has(t.target)) prod.set(t.target, t.source);
  const flowOf = new Map(); for (const t of arch.traces) if (t.type === 'relation' && !flowOf.has(t.target)) flowOf.set(t.target, t.source);
  const g = new Map(); const ids = new Map(); let next = 0;
  const gid = (m) => { if (!ids.has(m)) ids.set(m, next++); return ids.get(m); };
  for (const e of arch.elements) {
    let m = null;
    if (e.type === 'MOD') m = e.id;
    else if (e.type === 'FUNC') m = modOf.get(e.id) ?? null;
    else if (e.type === 'FLOW') m = modOf.get(prod.get(e.id)) ?? null;
    else if (e.type === 'SCHEMA') m = modOf.get(prod.get(flowOf.get(e.id))) ?? null;
    g.set(e.id, m ? gid(m) : next++);
  }
  return g;
}

/** Bindung (Blatt-FUNC mit realRef), Testbindung (TEST mit testRefs), REQ-Deckung durch CRs. */
function quoten(og) {
  const kinder = new Map();
  for (const t of og.traces) if (t.type === 'compose') { if (!kinder.has(t.source)) kinder.set(t.source, []); kinder.get(t.source).push(t.target); }
  const typOf = new Map(og.elements.map((e) => [e.id, e.type]));
  const blatt = (e) => !(kinder.get(e.id) ?? []).some((c) => typOf.get(c) === e.type);
  const bl = og.elements.filter((e) => e.type === 'FUNC').filter(blatt);
  const tests = og.elements.filter((e) => e.type === 'TEST');
  const req = og.elements.filter((e) => e.type === 'REQ').filter(blatt);
  const crZiel = new Set();
  for (const t of og.traces) if (t.type === 'relation' && typOf.get(t.source) === 'CR') crZiel.add(t.target);
  const traeger = new Map();
  for (const t of og.traces) if (t.type === 'satisfy' && ['FUNC', 'FCHAIN'].includes(typOf.get(t.source))) {
    if (!traeger.has(t.target)) traeger.set(t.target, []); traeger.get(t.target).push(t.source);
  }
  const q = (a, b) => (b ? r4(a / b) : null);
  return {
    bindung: q(bl.filter((e) => at(e, 'realRef') != null).length, bl.length),
    test: q(tests.filter((e) => Array.isArray(at(e, 'testRefs')) && at(e, 'testRefs').length).length, tests.length),
    reqDeckung: q(req.filter((r) => crZiel.has(r.id) || (traeger.get(r.id) ?? []).some((x) => crZiel.has(x))).length, req.length),
  };
}

/** Den Audit-Trail nachspielen: je angewandtem Zug die Groessen des Graphen danach. */
export function spieleNach(auditPfad) {
  const saetze = readFileSync(auditPfad, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  let graph = { nodes: [], edges: [] };
  const zuege = [];
  let abgelehnt = 0;
  for (const r of saetze) {
    const angewandt = r.operation === 'mutate' && r.result === 'applied';
    if (r.operation === 'mutate' && !angewandt) abgelehnt++;
    if (!angewandt || !r.commands?.length) continue;
    graph = applyCommands(cloneGraph(graph), r.commands).graph;
    const og = toOntologyGraph(graph);
    const arch = projectLayer(og, 'arch');
    const adj = buildAdjacency(arch);
    const befunde = evaluateAllRules(og, DEFAULT_METRIC_POLICY);
    const s = steerScore(befunde);
    const m = metrics(og, { layer: 'arch' });
    const eng = [...betweenness(adj).entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    zuege.push({
      v: r.graphVersion,
      elemente: og.elements.length,
      r6: Object.fromEntries(METRIC_DIMENSIONS.map((d) => [d, r4(m[d])])),
      steuerwert: r4(s.worst ?? 0),
      anker: s.worstAt ? `${s.worstAt.ruleId}@${s.worstAt.elementId}` : null,
      fehler: befunde.filter((v) => v.severity === 'error').length,
      qDeklariert: arch.elements.length ? r4(modularityOf(adj, deklariert(arch))) : null,
      qErkannt: arch.elements.length ? r4(modularityQ(adj)) : null,
      engpass: eng ? eng[0] : null,
      ...quoten(og),
    });
  }
  return { zuege, abgelehnt, graph };
}

/** Wie oft bewegt sich eine Groesse von Zug zu Zug, und wie lange stehen die Anker? */
export function bewegung(zuege) {
  const bew = (f) => { let n = 0; for (let i = 1; i < zuege.length; i++) if (f(zuege[i]) !== f(zuege[i - 1])) n++; return n; };
  const standzeiten = [];
  let start = 0;
  for (let i = 1; i <= zuege.length; i++) {
    if (i === zuege.length || zuege[i].anker !== zuege[start].anker) {
      standzeiten.push({ anker: zuege[start].anker, zuege: i - start });
      start = i;
    }
  }
  return {
    uebergaenge: Math.max(0, zuege.length - 1),
    r6: bew((z) => JSON.stringify(z.r6)),
    steuerwert: bew((z) => z.steuerwert),
    anker: bew((z) => z.anker),
    qDeklariert: bew((z) => z.qDeklariert),
    engpass: bew((z) => z.engpass),
    quoten: bew((z) => `${z.bindung}|${z.test}|${z.reqDeckung}`),
    laengsteStandzeit: standzeiten.sort((a, b) => b.zuege - a.zuege)[0] ?? null,
  };
}

/** Profil eines Endgraphen im Format des graph.json-Exports ({elements, traces}). */
export function profil(g) {
  const og = { elements: g.elements, traces: g.traces ?? [] };
  const befunde = evaluateAllRules(og, DEFAULT_METRIC_POLICY);
  const s = steerScore(befunde);
  const m = metrics(og, { layer: 'arch' });
  const typen = {};
  for (const e of og.elements) typen[e.type] = (typen[e.type] || 0) + 1;
  return {
    elemente: og.elements.length,
    kanten: og.traces.length,
    typen,
    fehler: befunde.filter((v) => v.severity === 'error').length,
    warnungen: befunde.filter((v) => v.severity === 'warning').length,
    steuerwert: r4(s.worst ?? 0),
    anker: s.worstAt ? `${s.worstAt.ruleId}@${s.worstAt.elementId}` : null,
    r6: Object.fromEntries(METRIC_DIMENSIONS.map((d) => [d, r4(m[d])])),
  };
}

const pct = (n, d) => (d > 0 ? `${n} (${Math.round((100 * n) / d)} %)` : '—');
const TYPEN = ['UC', 'ACTOR', 'FCHAIN', 'FUNC', 'MOD', 'FLOW', 'SCHEMA', 'REQ', 'TEST', 'CR', 'MS'];

/**
 * Der Berichtsabschnitt. `laeufe` = [{ label, audit, graph }] (Pfade), `golden` = Pfad zum Golden.
 * Die Hand-Seite steht als erste Zeile jeder Tabelle — sie ist der Massstab, nicht ein Arm unter vielen.
 */
export function vergleichBericht(laeufe, golden) {
  const trail = referenzTrail(golden);
  const zeilen = [];
  if (trail) zeilen.push({ label: '**Hand** (Referenz-Trail)', audit: trail, profil: profil(JSON.parse(readFileSync(golden, 'utf8'))) });
  for (const l of laeufe) zeilen.push({ label: l.label, audit: l.audit, profil: existsSync(l.graph) ? profil(JSON.parse(readFileSync(l.graph, 'utf8'))) : null });
  const mit = zeilen.map((z) => {
    const t = existsSync(z.audit) ? spieleNach(z.audit) : null;
    return { ...z, t, b: t ? bewegung(t.zuege) : null };
  });

  const out = [];
  out.push('## Auto gegen Hand (CR-GC-586)\n');
  if (!trail) out.push(`_Kein Referenz-Trail neben dem Golden (${golden ?? 'GOLDEN nicht gesetzt'}) — nur die Arme._\n`);
  out.push('### Trajektorie: wie oft bewegt sich eine Groesse von Zug zu Zug (Review §18)\n');
  out.push('| Lauf | Zuege | abgelehnt | ℝ⁶ | Steuerwert | Anker | Q deklariert | Engpass | drei Quoten | laengste Anker-Standzeit |');
  out.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const { label, t, b } of mit) {
    if (!t) { out.push(`| ${label} | — | — | — | — | — | — | — | — | — |`); continue; }
    const d = b.uebergaenge;
    out.push(`| ${label} | ${t.zuege.length} | ${t.abgelehnt} | ${pct(b.r6, d)} | ${pct(b.steuerwert, d)} | ${pct(b.anker, d)} `
      + `| ${pct(b.qDeklariert, d)} | ${pct(b.engpass, d)} | ${pct(b.quoten, d)} `
      + `| ${b.laengsteStandzeit ? `${b.laengsteStandzeit.zuege} Zuege ${b.laengsteStandzeit.anker ?? '(kein Ueberschuss)'}` : '—'} |`);
  }
  out.push('\nEine Groesse, die sich kaum bewegt, kann nicht steuern; ein Anker, der viele Zuege steht, wird nicht');
  out.push('bearbeitet. Die Hand-Zeile ist der Massstab: bewegt sich dort eine Groesse und im Auto-Lauf nicht,');
  out.push('fehlt dem Auto-Modus ein Kanal, der sie adressiert.\n');

  out.push('### Endgraph gegen Golden (derselbe Regelkatalog)\n');
  out.push(`| Lauf | Elemente | ${TYPEN.join(' | ')} | Fehler | Warnungen | Steuerwert @ Anker |`);
  out.push(`|---|---:|${TYPEN.map(() => '---:').join('|')}|---:|---:|---|`);
  for (const { label, profil: p } of mit) {
    if (!p) { out.push(`| ${label} | — |${TYPEN.map(() => ' — ').join('|')}| — | — | — |`); continue; }
    out.push(`| ${label} | ${p.elemente} | ${TYPEN.map((t) => p.typen[t] ?? 0).join(' | ')} | ${p.fehler} | ${p.warnungen} `
      + `| ${p.steuerwert} @ ${p.anker ?? '—'} |`);
  }
  return out.join('\n');
}
