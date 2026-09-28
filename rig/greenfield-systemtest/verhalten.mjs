#!/usr/bin/env node
/**
 * verhalten.mjs — wie das Modell arbeitet: Ablehnungen, Dubletten, Struktur gegen das Golden,
 * deterministische Inhaltsprüfungen (Leitlinie T-E10, T-E11). Reine Auswertung, kein LLM.
 *
 * Herkunft: Auswertung CR-GC-682 (auswertung-cr682.md), dort noch als Einmal-Skripte. Die Zahlen
 * dort sind mit diesen Funktionen reproduzierbar; `report.mjs` ruft `verhaltensBericht` für jeden
 * Lauf mit Spur, der CLI-Aufruf für eine beliebige Laufmenge:
 *
 *   node rig/greenfield-systemtest/verhalten.mjs <golden.graph.json> runs/gcrun-310 runs/gcrun-311 …
 * @author andreas@siglochconsulting
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { leererGraph, anwenden } from './nachbau.mjs';

/**
 * Vorbild-uids aus den Executor-Prompts (`src/loop/executor-prompt.ts`, `src/loop/generate.ts`),
 * heutige und frühere. Taucht eine davon im Lauf auf, hat das Modell den Inhalt des Vorbilds
 * übernommen statt nur die Form (ITEM-2026-607). `tests/rig-verhalten.test.ts` hält die Liste
 * vollständig gegen die Quellen; frühere Vorbilder bleiben drin, damit alte Läufe messbar bleiben.
 */
export const VORBILD_UIDS = [
  // executor-prompt.ts, heute
  'REQ-beispiel-ablauf', 'REQ-beispiel-grenze', 'TEST-beispiel-ablauf', 'TEST-beispiel-grenze',
  'UC-beispiel', 'FUNC-beispiel-erzeugen', 'FCHAIN-beispiel',
  // generate.ts UC-01, heute
  'REQ-beispiel-a-ablauf', 'REQ-beispiel-a-grenze', 'REQ-beispiel-b-ablauf', 'REQ-beispiel-b-abweisung',
  'TEST-beispiel-a-ablauf', 'TEST-beispiel-a-grenze', 'TEST-beispiel-b-ablauf', 'TEST-beispiel-b-abweisung',
  'UC-beispiel-a', 'UC-beispiel-b',
  // generate.ts UC-02, heute
  'FLOW-beispiel-eingabe', 'SCHEMA-beispiel-eingabe', 'FUNC-beispiel-verarbeiten', 'ACTOR-beispiel',
  // früher (CR-GC-667 bis CR-GC-672; UC-02 bis CR-GC-703)
  'REQ-login-passwort', 'REQ-login-dauer', 'UC-login',
  'FLOW-anfrage', 'SCHEMA-anfrage', 'FUNC-anfrage-annehmen', 'ACTOR-nutzer', 'FCHAIN-sitzung',
];

const zaehle = (m, k, n = 1) => { m[k] = (m[k] ?? 0) + n; return m; };
const typVon = (uid) => uid.split('-')[0];

/** Ablehnungen und Preflight-Eingriffe aus `run-raw.log`. */
export function ablehnungen(log) {
  const gate = {}, preflightBlock = {}, satisfyPaare = {}, wiederAngelegt = {}, korrektur = {};
  for (const m of log.matchAll(/gate rejected \[([^\]]*)\]/g)) {
    for (const r of m[1].split(',').map((s) => s.trim()).filter(Boolean)) zaehle(gate, r);
  }
  for (const m of log.matchAll(/preflight blocked: (\S+) ([^\n]*)/g)) {
    zaehle(preflightBlock, m[1]);
    const p = m[2].match(/(\w+) satisfy (\w+)/);
    if (p) zaehle(satisfyPaare, `${p[1]} satisfy ${p[2]}`);
  }
  for (const m of log.matchAll(/preflight: ([^\n]*)/g)) {
    const w = m[1].match(/^bestehender Knoten (\S+) nicht ueberschrieben/);
    if (w) zaehle(wiederAngelegt, typVon(w[1]));
    else zaehle(korrektur, m[1].replace(/\b[A-Z]+-[\w-]+/g, 'X').slice(0, 60));
  }
  return { gate, preflightBlock, satisfyPaare, wiederAngelegt, korrektur };
}

const STOPP = new Set(['das', 'system', 'muss', 'der', 'die', 'und', 'den', 'eine', 'einen', 'mit', 'fuer', 'für', 'von', 'nach']);
const woerter = (s) => new Set((s ?? '').toLowerCase().replace(/[^a-zäöüß0-9 ]/g, ' ').split(/\s+/)
  .filter((w) => w.length > 2 && !STOPP.has(w)));
const textAehnlich = (a, b) => {
  const A = woerter(a), B = woerter(b);
  if (!A.size || !B.size) return 0;
  let i = 0;
  for (const x of A) if (B.has(x)) i++;
  return i / (A.size + B.size - i);
};
const normName = (s) => (s ?? '').toLowerCase().replace(/[^a-zäöüß]/g, '');
/**
 * Schablonentext — aus einem Vorbild („Feld1 und Feld2", „Ergebnis A") oder der TEST-Rumpf, den der
 * Preflight ergänzt („it.todo: Prüfe …"). Ein Qualitätsmangel bzw. Werkzeugtext, keine Dublette des Modells.
 */
const PLATZHALTER = /\bFeld ?(?:[0-9]|[A-Z]\b)|\bErgebnis [A-Z]\b|^it\.todo:/;

/**
 * Dubletten aus `audit.jsonl`: ein neu angelegter Knoten, zu dem schon ein Knoten desselben Typs mit
 * gleichem Namen oder ≥ 70 % Wortgleichheit steht — jeder Typ, und geprüft je Kommando gegen den
 * laufenden Bestand, also auch innerhalb eines Batches (CR-GC-708: bis dahin nur REQ/FUNC/UC/FCHAIN
 * gegen den Stand vor dem Batch — gcrun-342 zeigte 28 %, über alle Typen waren es 58 %). Je Dublette:
 * Typ, Form und Auslöser (Regel-IDs aus `respondsTo`, sonst „ohne Befund“ = Seed- oder Phasenauftrag).
 * Gleicher Name zählt nur mit ≥ 40 % Wortgleichheit; Kopien von Schablonentext zählen getrennt.
 * Unschärfe bleiben kurze TEST-Texte („X auslösen, Benachrichtigung prüfen"): Stichprobe 2026-09-28 ~80 % echt.
 */
export function dubletten(audit) {
  const g = leererGraph();
  const typ = {}, form = {}, ausloeser = {};
  let anzahl = 0, platzhalter = 0;
  for (const z of audit.split('\n')) {
    if (!z.trim()) continue;
    const a = JSON.parse(z);
    if (a.operation !== 'mutate' || a.result !== 'applied') continue;
    const befund = [...new Set((a.respondsTo ?? []).map((r) => r.ruleId))];
    for (const c of a.commands) {
      const neu = c.op === 'add-node' && !g.nodes.has(c.node.uid) ? c.node : null;
      // Gleicher Name allein reicht nicht: „Benachrichtigung prüfen" heißen verschiedene TESTs.
      const zwilling = neu && [...g.nodes.values()].find((o) => o.type === neu.type && (textAehnlich(o.description, neu.description) >= 0.7
        || (normName(o.name) === normName(neu.name) && textAehnlich(o.description, neu.description) >= 0.4)));
      anwenden(g, c);
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
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

/**
 * Struktur über mehrere Läufe gegen das Golden: Ähnlichkeit (Jaccard über die Menge der
 * Typ-Kante-Typ-Muster) Lauf↔Lauf und Lauf↔Golden, Muster in allen / in keinem Lauf, Typverteilung,
 * FUNC je Wirkkette.
 */
export function struktur(graphen, golden) {
  const M = graphen.map(muster), MG = muster(golden);
  const paare = [];
  for (let i = 0; i < M.length; i++) for (let j = i + 1; j < M.length; j++) paare.push(jaccard(M[i], M[j]));
  const zuGolden = M.map((m) => jaccard(m, MG));
  const inAllen = [...MG].filter((k) => M.every((m) => m.has(k)));
  const inKeinem = [...MG].filter((k) => M.every((m) => !m.has(k)));
  const typen = (g) => [...g.el.values()].reduce((m, e) => zaehle(m, e.type), {});
  const alleTypen = [...new Set([...graphen, golden].flatMap((g) => [...g.el.values()].map((e) => e.type)))].sort();
  const typMedian = Object.fromEntries(alleTypen.map((t) => [t, { lauf: median(graphen.map((g) => typen(g)[t] ?? 0)), golden: typen(golden)[t] ?? 0 }]));
  const funcJeKette = (g) => [...g.el.values()].filter((e) => e.type === 'FCHAIN')
    .map((k) => g.tr.filter((t) => t.source === k.id && t.type === 'compose' && g.el.get(t.target).type === 'FUNC').length);
  const ketten = graphen.flatMap(funcJeKette);
  return {
    aehnlichLaeufe: median(paare),
    aehnlichGolden: zuGolden,
    inAllen, inKeinem,
    typMedian,
    ketten: {
      mitFunc: ketten.filter((n) => n > 0).length,
      ohneFunc: ketten.filter((n) => n === 0).length,
      mitEinerFunc: ketten.filter((n) => n === 1).length,
      golden: funcJeKette(golden),
    },
  };
}

/** Deterministische Inhaltsprüfungen an einem Lauf — ohne Urteil, nur Zählung. */
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
    vorbildLeck: VORBILD_UIDS.filter((u) => el.has(u)),
  };
}

/** Markdown-Abschnitt für den Report: je Lauf Ablehnungen, Dubletten, Prüfungen; dann die Struktur. */
export function verhaltensBericht(laeufe, goldenPfad) {
  const top = (o, n = 4) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} ${v}`).join(', ') || '—';
  const summe = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const z = ['## Verhalten des Modells (Leitlinie T-E10, T-E11)', '',
    '| Lauf | Gate-Ablehnungen | Preflight-Block | Bestand neu angelegt | Dubletten (Typ; Auslöser) | REQ · ohne kinds · ohne Erfüller · namensgleich überzählig | Vorbild-Leck |',
    '|---|---|---|---|---|---|---|'];
  const graphen = [];
  for (const l of laeufe) {
    const a = existsSync(l.log) ? ablehnungen(readFileSync(l.log, 'utf8')) : null;
    const d = existsSync(l.audit) ? dubletten(readFileSync(l.audit, 'utf8')) : null;
    const g = existsSync(l.graph) ? ladeGraph(l.graph) : null;
    if (g) graphen.push(g);
    const p = g ? pruefungen(g) : null;
    z.push(`| ${l.label} | ${a ? `${summe(a.gate)}: ${top(a.gate, 3)}` : '—'} | ${a ? summe(a.preflightBlock) : '—'} `
      + `| ${a ? `${summe(a.wiederAngelegt)}: ${top(a.wiederAngelegt, 3)}` : '—'} | ${d ? `${d.anzahl}: ${top(d.typ, 3)}; ${top(d.ausloeser, 2)}${d.platzhalter ? ` (+${d.platzhalter} Schablone)` : ''}` : '—'} `
      + `| ${p ? `${p.req} · ${p.ohneKinds} · ${p.ohneErfueller} · ${p.namensgleich}` : '—'} | ${p ? p.vorbildLeck.join(', ') || '—' : '—'} |`);
  }
  if (goldenPfad && existsSync(goldenPfad) && graphen.length) {
    const s = struktur(graphen, ladeGraph(goldenPfad));
    const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)} %`);
    z.push('', `**Struktur** (Jaccard über Typ-Kante-Typ-Muster): Läufe untereinander ${pct(s.aehnlichLaeufe)}, `
      + `zum Golden ${s.aehnlichGolden.map(pct).join(' · ')}.`,
    `- In allen Läufen und im Golden: ${s.inAllen.join('; ') || '—'}`,
    `- Im Golden, in keinem Lauf: ${s.inKeinem.join('; ') || '—'}`,
    `- Typen (Median Lauf / Golden): ${Object.entries(s.typMedian).map(([t, v]) => `${t} ${v.lauf}/${v.golden}`).join(', ')}`,
    `- Wirkketten mit genau einer FUNC: ${s.ketten.mitEinerFunc} von ${s.ketten.mitFunc}, ohne FUNC: ${s.ketten.ohneFunc} `
      + `(Golden: ${s.ketten.golden.join(', ') || '—'} FUNC je Kette)`);
  }
  z.push('', 'Je Lauf im Detail: `node rig/greenfield-systemtest/verhalten.mjs <golden> runs/<arm>-<n> …`');
  return z.join('\n');
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const [golden, ...dirs] = process.argv.slice(2);
  if (!golden || !dirs.length) {
    console.error('node verhalten.mjs <golden.graph.json> <lauf-dir> …');
    process.exit(1);
  }
  const laeufe = dirs.map((d) => ({ label: d.split('/').pop(), log: join(d, 'run-raw.log'), audit: join(d, 'audit.jsonl'), graph: join(d, 'graph.json') }));
  console.log(verhaltensBericht(laeufe, golden));
  for (const l of laeufe) {
    if (!existsSync(l.log)) continue;
    const a = ablehnungen(readFileSync(l.log, 'utf8'));
    console.log(`\n### ${l.label}\n\`\`\`\n${JSON.stringify({ ...a, dubletten: existsSync(l.audit) ? dubletten(readFileSync(l.audit, 'utf8')) : null }, null, 1)}\n\`\`\``);
  }
}
