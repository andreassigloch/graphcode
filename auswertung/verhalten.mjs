/**
 * verhalten.mjs — wie der Agent arbeitete (Leitlinie T-E11, T-V5), deterministisch aus Audit und Graph:
 *   - Ablehnungen des Gates je Regel (Fehler in abgelehnten Mutationen) und Warnungen, die mit angenommenen
 *     Mutationen ins Modell kamen;
 *   - Dubletten: ein neuer Knoten, dessen Text zu ≥ 70 % (gleicher Name: ≥ 40 %) einem Knoten desselben Typs
 *     gleicht — je Kommando, Schablonentext getrennt;
 *   - Struktur gegen den Referenzlauf der Aufgabe (Jaccard über Typ-Kante-Typ-Muster, Typverteilung, FUNC je
 *     Wirkkette) — ohne Referenz entfällt nur dieser Teil;
 *   - Prüfungen am Graphen: REQ ohne kinds, ohne Erfüller, namensgleiche REQ.
 * Herkunft: rig/greenfield-systemtest/verhalten.mjs (CR-GC-682) ohne die Executor-Eingänge (`run-raw.log`,
 * Preflight, Vorbild-Leck der Executor-Prompts). Hierher mit CR-GC-739.
 *
 * @author andreas@siglochconsulting
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mutationen } from './nachspielen.mjs';

const zaehle = (m, k, n = 1) => { m[k] = (m[k] ?? 0) + n; return m; };
const STOPP = new Set(['das', 'system', 'muss', 'der', 'die', 'und', 'den', 'eine', 'einen', 'mit', 'fuer', 'für', 'von', 'nach', 'ein', 'im', 'in', 'an', 'zu']);
const PLATZHALTER = /\b(beispiel|platzhalter|tbd|todo:)\b/i;
const normName = (s) => String(s ?? '').toLowerCase().replace(/[^a-zäöüß0-9]+/g, ' ').trim();
const woerter = (s) => new Set(normName(s).split(' ').filter((w) => w.length > 2 && !STOPP.has(w)));
/** Jaccard über die Wortmengen zweier Texte (Stoppwörter ausgenommen). */
export function textAehnlich(a, b) {
  const A = woerter(a), B = woerter(b);
  if (A.size === 0 && B.size === 0) return 1;
  let i = 0; for (const w of A) if (B.has(w)) i++;
  return i / (A.size + B.size - i);
}

/** Ablehnungen und mitgenommene Warnungen aus den Mutationen eines Audits. */
export function ablehnungen(mutationenListe) {
  const fehlerJeRegel = {}, warnungenAngenommen = {};
  let abgelehnt = 0, angenommen = 0;
  for (const a of mutationenListe) {
    if (a.result === 'rejected') {
      abgelehnt++;
      for (const v of a.violations ?? []) if (v.severity === 'error') zaehle(fehlerJeRegel, v.ruleId);
    } else if (a.result === 'applied') {
      angenommen++;
      for (const v of a.violations ?? []) zaehle(warnungenAngenommen, v.ruleId);
    }
  }
  return { angenommen, abgelehnt, fehlerJeRegel, warnungenAngenommen };
}

/** Dubletten unter den angelegten Knoten — je Kommando, in Reihenfolge der angewandten Mutationen. */
export function dubletten(mutationenListe) {
  const knoten = new Map();
  const typ = {}, form = {}, ausloeser = {};
  let anzahl = 0, platzhalter = 0;
  for (const a of mutationenListe) {
    if (a.result !== 'applied') continue;
    const befund = [...new Set((a.respondsTo ?? []).map((r) => r.ruleId))];
    for (const c of a.commands ?? []) {
      if (c.op === 'delete-node') { knoten.delete(c.uid); continue; }
      if (c.op !== 'add-node' || knoten.has(c.node.uid)) { if (c.op === 'update-node' && knoten.has(c.uid)) Object.assign(knoten.get(c.uid), c.patch ?? {}); continue; }
      const neu = c.node;
      // Gleicher Name allein reicht nicht: „Benachrichtigung prüfen" heißen verschiedene TESTs.
      const zwilling = [...knoten.values()].find((o) => o.type === neu.type && (textAehnlich(o.description, neu.description) >= 0.7
        || (normName(o.name) === normName(neu.name) && textAehnlich(o.description, neu.description) >= 0.4)));
      knoten.set(neu.uid, { ...neu });
      if (!zwilling) continue;
      if (PLATZHALTER.test(neu.description ?? '')) { platzhalter++; continue; }
      anzahl++;
      zaehle(typ, neu.type);
      zaehle(form, neu.uid.startsWith(zwilling.uid) ? 'Suffix an den Zwilling'
        : normName(neu.name) === normName(zwilling.name) ? 'gleicher Name, neue uid' : 'ähnlicher Text, neue uid');
      zaehle(ausloeser, befund.length ? befund.join('+') : 'ohne Befund');
    }
  }
  return { anzahl, typ, form, ausloeser, platzhalter };
}

/** Knoten und Kanten eines exportierten Graphen; Kanten nur zwischen vorhandenen Knoten. */
export function ladeGraph(pfad) {
  const g = JSON.parse(readFileSync(pfad, 'utf8'));
  const el = new Map(g.elements.map((e) => [e.id, e]));
  return { el, tr: (g.traces ?? []).filter((t) => el.has(t.source) && el.has(t.target)) };
}

const muster = ({ el, tr }) => new Set(tr.map((t) => `${el.get(t.source).type} -${t.type}-> ${el.get(t.target).type}`));
const jaccard = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; const u = a.size + b.size - i; return u ? i / u : 1; };
const typen = (g) => [...g.el.values()].reduce((m, e) => zaehle(m, e.type), {});
const funcJeKette = (g) => [...g.el.values()].filter((e) => e.type === 'FCHAIN')
  .map((k) => g.tr.filter((t) => t.source === k.id && t.type === 'compose' && g.el.get(t.target).type === 'FUNC').length);

/** Struktur eines Laufs gegen die Referenz: Muster-Ähnlichkeit, Muster nur hier / nur dort, Typverteilung, Ketten. */
export function struktur(graph, referenz) {
  const M = muster(graph), R = muster(referenz);
  const alleTypen = [...new Set([...graph.el.values(), ...referenz.el.values()].map((e) => e.type))].sort();
  const tg = typen(graph), tr = typen(referenz);
  const ketten = funcJeKette(graph);
  return {
    aehnlichkeit: Number(jaccard(M, R).toFixed(3)),
    nurReferenz: [...R].filter((k) => !M.has(k)).sort(),
    nurLauf: [...M].filter((k) => !R.has(k)).sort(),
    typen: Object.fromEntries(alleTypen.map((t) => [t, { lauf: tg[t] ?? 0, referenz: tr[t] ?? 0 }])),
    ketten: { mitFunc: ketten.filter((n) => n > 0).length, ohneFunc: ketten.filter((n) => n === 0).length, mitEinerFunc: ketten.filter((n) => n === 1).length, referenz: funcJeKette(referenz) },
  };
}

/** Deterministische Prüfungen am Graphen — Zählung, kein Urteil. */
export function pruefungen({ el, tr }) {
  const req = [...el.values()].filter((e) => e.type === 'REQ');
  const kinds = (e) => e.kinds ?? e.attributes?.kinds;
  const erfuellt = new Set(tr.filter((t) => t.type === 'satisfy').map((t) => t.target));
  const namen = req.reduce((m, e) => zaehle(m, normName(e.name)), {});
  return {
    req: req.length,
    ohneKinds: req.filter((e) => !Array.isArray(kinds(e)) || !kinds(e).length).length,
    ohneErfueller: req.filter((e) => !erfuellt.has(e.id)).length,
    // überzählig: je Namensgruppe alle außer dem ersten
    namensgleich: Object.values(namen).reduce((a, n) => a + n - 1, 0),
  };
}

/** Die Analyse eines Laufs: Audit und Graph aus dem Lauf-Verzeichnis, Referenz aus der Aufgabe (oder null). */
export function verhalten(laufDir, referenzGraphPfad = null) {
  const mut = mutationen(join(laufDir, 'audit.jsonl'));
  const graphPfad = join(laufDir, 'graph.json');
  const g = existsSync(graphPfad) ? ladeGraph(graphPfad) : null;
  return {
    ...ablehnungen(mut),
    dubletten: dubletten(mut),
    pruefungen: g ? pruefungen(g) : null,
    struktur: g && referenzGraphPfad && existsSync(referenzGraphPfad) ? struktur(g, ladeGraph(referenzGraphPfad)) : null,
  };
}
