#!/usr/bin/env node
/**
 * faltung.mjs — SPIKE-GC-compose-faltung: traegt ein entlang `compose` gefalteter Graph die
 * Mutationen, die in den aufgezeichneten Laeufen tatsaechlich gemacht wurden?
 *
 * Nachspiel je Lauf aus `audit.jsonl`: Graph vor jeder angewandten Mutation nachbauen, Saat aus
 * `respondsTo` (sonst: was die vorige Mutation beruehrt hat), falten, gegen die beruehrten
 * Knoten pruefen. Reine Auswertung, kein LLM. Definitionen: docs/spikes/SPIKE-GC-compose-faltung.md §2.
 *
 *   node rig/greenfield-systemtest/faltung.mjs [runs-dir] [--json out.json]
 * @author andreas@siglochconsulting
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const EIGNER_KANTEN = ['verify', 'io', 'relation', 'satisfy', 'allocate'];
const MIN_GROESSE = 50;

/** Graph-Zustand als Maps; Kanten-Schluessel `quelle|typ|ziel`. */
export function leererGraph() {
  return { nodes: new Map(), edges: new Map() };
}

const kante = (e) => `${e.sourceId}|${e.edgeType}|${e.targetId}`;

export function anwenden(g, c) {
  switch (c.op) {
    case 'add-node':
    case 'update-node': {
      const alt = g.nodes.get(c.node.uid) ?? {};
      g.nodes.set(c.node.uid, { ...alt, ...c.node, attributes: { ...(alt.attributes ?? {}), ...(c.node.attributes ?? {}) } });
      break;
    }
    case 'delete-node':
      g.nodes.delete(c.uid);
      for (const [k, e] of g.edges) if (e.sourceId === c.uid || e.targetId === c.uid) g.edges.delete(k);
      break;
    case 'add-edge':
      g.edges.set(kante(c.edge), c.edge);
      break;
    case 'delete-edge':
    case 'remove-edge':
      g.edges.delete(kante(c.edge));
      break;
    case 'merge-nodes':
      for (const [k, e] of [...g.edges]) {
        if (e.sourceId !== c.sourceUid && e.targetId !== c.sourceUid) continue;
        g.edges.delete(k);
        const n = { ...e, sourceId: e.sourceId === c.sourceUid ? c.targetUid : e.sourceId, targetId: e.targetId === c.sourceUid ? c.targetUid : e.targetId };
        g.edges.set(kante(n), n);
      }
      g.nodes.delete(c.sourceUid);
      break;
    default:
      break;
  }
}

/** Welche VORHER existierenden Knoten eine Mutation anfasst, und welche davon inhaltlich. */
export function beruehrt(g, cmds) {
  const ref = new Set();
  const inhalt = new Set();
  const neu = new Set();
  for (const c of cmds) {
    if (c.op === 'add-node') { if (!g.nodes.has(c.node.uid)) neu.add(c.node.uid); else inhalt.add(c.node.uid); }
    else if (c.op === 'update-node') inhalt.add(c.node.uid);
    else if (c.op === 'delete-node') inhalt.add(c.uid);
    else if (c.op === 'merge-nodes') { inhalt.add(c.sourceUid); inhalt.add(c.targetUid); }
    else if (c.edge) { ref.add(c.edge.sourceId); ref.add(c.edge.targetId); }
  }
  const existiert = (u) => g.nodes.has(u) && !neu.has(u);
  return {
    ref: [...ref].filter((u) => existiert(u) && !inhalt.has(u)),
    inhalt: [...inhalt].filter(existiert),
    alle: new Set([...ref, ...inhalt, ...neu]),
  };
}

/** Eltern je Knoten: compose zuerst, sonst der Eigner ueber EIGNER_KANTEN. */
export function elternBaum(g) {
  const eltern = new Map();
  for (const e of g.edges.values()) {
    if (e.edgeType === 'compose' && g.nodes.has(e.sourceId) && g.nodes.has(e.targetId) && !eltern.has(e.targetId)) {
      eltern.set(e.targetId, e.sourceId);
    }
  }
  const imBaum = (u) => eltern.has(u) || [...g.edges.values()].some((e) => e.edgeType === 'compose' && e.sourceId === u);
  const baum = new Set([...g.nodes.keys()].filter(imBaum));
  for (const typ of EIGNER_KANTEN) {
    for (const e of g.edges.values()) {
      if (e.edgeType !== typ) continue;
      for (const [kind, eigner] of [[e.sourceId, e.targetId], [e.targetId, e.sourceId]]) {
        if (!g.nodes.has(kind) || !g.nodes.has(eigner) || eltern.has(kind) || baum.has(kind) || kind === eigner) continue;
        if (!baum.has(eigner) && !eltern.has(eigner)) continue;
        eltern.set(kind, eigner);
      }
    }
  }
  // Zyklen brechen: ein Knoten, der ueber seine Eltern zu sich selbst kommt, wird Wurzel.
  for (const u of [...eltern.keys()]) {
    const seen = new Set([u]);
    let p = eltern.get(u);
    while (p !== undefined) {
      if (seen.has(p)) { eltern.delete(u); break; }
      seen.add(p);
      p = eltern.get(p);
    }
  }
  const kinder = new Map();
  for (const [k, p] of eltern) kinder.set(p, [...(kinder.get(p) ?? []), k]);
  return { eltern, kinder };
}

/** offen / box / (verborgen = Rest) fuer eine Saat. */
export function falten(g, baum, saat) {
  const offen = new Set();
  const stapel = [...saat];
  while (stapel.length) {
    const u = stapel.pop();
    if (offen.has(u)) continue;
    offen.add(u);
    stapel.push(...(baum.kinder.get(u) ?? []));
  }
  const vorfahren = new Set();
  for (const s of saat) {
    let p = baum.eltern.get(s);
    while (p !== undefined && !vorfahren.has(p)) { vorfahren.add(p); p = baum.eltern.get(p); }
  }
  for (const v of vorfahren) offen.add(v);
  const box = new Set();
  for (const v of vorfahren) for (const k of baum.kinder.get(v) ?? []) if (!offen.has(k)) box.add(k);
  for (const u of g.nodes.keys()) if (!baum.eltern.has(u) && !offen.has(u)) box.add(u);
  return { offen, box };
}

const zeileOffen = (n) => `+ ${n.uid}|${n.description ?? ''}${Object.keys(n.attributes ?? {}).length ? ' ' + JSON.stringify(n.attributes) : ''}\n`;
const zeileBox = (n) => `+ ${n.uid} [${n.name ?? ''}]\n`;
const zeileKante = (e) => `+ ${e.sourceId} -${e.edgeType}-> ${e.targetId}\n`;

export function groesseVoll(g) {
  let z = 0;
  for (const n of g.nodes.values()) z += zeileOffen(n).length;
  for (const e of g.edges.values()) z += zeileKante(e).length;
  return z;
}

export function groesseGefaltet(g, { offen, box }) {
  let z = 0;
  for (const u of offen) z += zeileOffen(g.nodes.get(u)).length;
  for (const u of box) z += zeileBox(g.nodes.get(u)).length;
  for (const e of g.edges.values()) {
    const sichtbar = (u) => offen.has(u) || box.has(u);
    if (sichtbar(e.sourceId) && sichtbar(e.targetId)) z += zeileKante(e).length;
  }
  return z;
}

/** Ebenen nachzuladen, bis u offen ist: Abstand zum naechsten offenen Vorfahren. */
function ebenen(baum, offen, u) {
  let n = 0;
  let p = u;
  while (p !== undefined && !offen.has(p)) { n += 1; p = baum.eltern.get(p); }
  return n;
}

export function nachspielen(auditPfad) {
  const g = leererGraph();
  const proben = [];
  let vorige = new Set();
  for (const zeile of readFileSync(auditPfad, 'utf8').split('\n')) {
    if (!zeile.trim()) continue;
    let a;
    try { a = JSON.parse(zeile); } catch { continue; }
    if (a.operation !== 'mutate' || a.result !== 'applied' || !Array.isArray(a.commands)) continue;
    const cmds = a.commands;
    const b = beruehrt(g, cmds);
    const befund = (a.respondsTo ?? []).map((r) => r.elementId).filter((u) => u && g.nodes.has(u));
    const saat = befund.length ? befund : [...vorige].filter((u) => g.nodes.has(u));
    if (g.nodes.size > 0 && saat.length && (b.ref.length || b.inhalt.length)) {
      const baum = elternBaum(g);
      const f = falten(g, baum, saat);
      const sichtbar = (u) => f.offen.has(u) || f.box.has(u);
      const fehltRef = b.ref.filter((u) => !sichtbar(u));
      const fehltInhalt = b.inhalt.filter((u) => !f.offen.has(u));
      const nach = [...fehltRef, ...fehltInhalt];
      proben.push({
        knoten: g.nodes.size,
        saatQuelle: befund.length ? 'befund' : 'vorige',
        voll: groesseVoll(g),
        gefaltet: groesseGefaltet(g, f),
        offen: f.offen.size,
        box: f.box.size,
        beruehrt: b.ref.length + b.inhalt.length,
        nachladen: nach.length,
        ebenen: nach.map((u) => ebenen(baum, f.offen, u)),
      });
    }
    for (const c of cmds) anwenden(g, c);
    vorige = b.alle;
  }
  return proben;
}

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const gruppe = (lauf) => lauf.replace(/-\d+$/, '');

function auswerten(proben) {
  const gross = proben.filter((p) => p.knoten >= MIN_GROESSE);
  const nach = proben.filter((p) => p.nachladen > 0);
  return {
    mutationen: proben.length,
    abGroesse: gross.length,
    anteilMedian: median(gross.map((p) => p.gefaltet / p.voll)),
    nachladeQuote: proben.length ? nach.length / proben.length : null,
    ebenenMedian: median(nach.flatMap((p) => p.ebenen)),
    ausBefund: proben.filter((p) => p.saatQuelle === 'befund').length,
    nachladeQuoteBefund: (() => {
      const x = proben.filter((p) => p.saatQuelle === 'befund');
      return x.length ? x.filter((p) => p.nachladen > 0).length / x.length : null;
    })(),
  };
}

function main() {
  const hier = dirname(fileURLToPath(import.meta.url));
  const args = process.argv.slice(2);
  const jsonIdx = args.indexOf('--json');
  const jsonOut = jsonIdx >= 0 ? args[jsonIdx + 1] : null;
  const dir = args.find((a, i) => !a.startsWith('--') && i !== jsonIdx + 1) ?? join(hier, 'runs');
  const je = new Map();
  for (const lauf of readdirSync(dir).sort()) {
    const p = join(dir, lauf, 'audit.jsonl');
    if (!existsSync(p)) continue;
    const pr = nachspielen(p);
    if (!pr.length) continue;
    je.set(gruppe(lauf), [...(je.get(gruppe(lauf)) ?? []), ...pr]);
  }
  const alle = [...je.values()].flat();
  const tabelle = { alle: auswerten(alle) };
  for (const [k, v] of je) tabelle[k] = auswerten(v);
  const pct = (x) => (x === null ? '—' : (100 * x).toFixed(0) + ' %');
  console.log('Gruppe            Mutationen  ab50  gefaltet/voll  Nachladen  (nur Befund-Saat)  Ebenen');
  for (const [k, t] of Object.entries(tabelle)) {
    console.log(
      `${k.padEnd(17)} ${String(t.mutationen).padStart(10)} ${String(t.abGroesse).padStart(5)} ${pct(t.anteilMedian).padStart(14)} ${pct(t.nachladeQuote).padStart(10)} ${(pct(t.nachladeQuoteBefund) + ' von ' + t.ausBefund).padStart(18)} ${String(t.ebenenMedian ?? '—').padStart(7)}`,
    );
  }
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ tabelle, je: Object.fromEntries(je) }, null, 1));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
