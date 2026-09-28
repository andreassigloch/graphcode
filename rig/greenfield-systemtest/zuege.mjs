#!/usr/bin/env node
/**
 * zuege.mjs — was jede Runde des Executors bewirkt hat: Fokus → Zug → Gate → Fundänderung (CR-GC-708).
 *
 * Zwei Sichten, beide Teil des S2-Berichts (`report.mjs`):
 *   1. **Regelbilanz** und **Muster** je Fokusregel — aus dem Nachspiel: `run-raw.log` gibt die Runden,
 *      `audit.jsonl` die Züge, `dist/` rechnet Fokus und Funde vor und nach jeder Runde. Das Nachspiel
 *      steuert mit dem HEUTIGEN Code; stimmen berechnete Stagnation und Defer nicht mit dem Log
 *      überein, ist der Lauf „nicht nachspielbar" und liefert keine Zahlen.
 *   2. **Regel-Pareto je Zugtyp** — nur aus dem Audit (die `violations` eines Eintrags sind das
 *      Gate-Delta): wie viele Regeln müsste das Modell je Zugtyp kennen, damit 80 % / 95 % der Züge
 *      fehlerfrei durchgehen. Gilt für jeden Lauf, auch ohne Nachspiel.
 *
 *   node rig/greenfield-systemtest/zuege.mjs runs/gcrun-342 runs/gcrun-343 …
 * @author andreas@siglochconsulting
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist');
const zaehle = (m, k, n = 1) => ((m[k] = (m[k] ?? 0) + n), m);
const top = (m, n = 4) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n);
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);

/** Runden und Turns aus dem Executor-Log (`[generate N]`, `N.T: tools`, Stagnation, Defer, Ablehnung). */
export function rundenAusLog(log) {
  const runden = [];
  let r = null, t = null;
  for (const z of log.split('\n')) {
    let m;
    if ((m = z.match(/^\[generate (\d+)\] phase=(\w+)/))) { r = { n: +m[1], phase: m[2], turns: [], stagnation: 0, defer: null }; runden.push(r); t = null; continue; }
    if (!r) continue;
    if ((m = z.match(/^ {2}stagnation x(\d+)/))) { r.stagnation = +m[1]; continue; }
    if ((m = z.match(/^ {2}defer: (\S+)/))) { r.defer = m[1]; continue; }
    if ((m = z.match(/^ {2}(\d+)\.(\d+): (.*)$/))) {
      const tools = /^(call failed|\(no calls)/.test(m[3]) ? [] : m[3].split(' ')[0].split(',');
      t = { mutates: tools.filter((x) => x === 'graph_mutate').length, preflightBlock: [], abgelehnt: null };
      r.turns.push(t);
      continue;
    }
    if (!t) continue;
    if ((m = z.match(/^ {4}preflight blocked: (\S+)/))) t.preflightBlock.push(m[1]);
    else if ((m = z.match(/gate rejected \[([^\]]*)\]/))) t.abgelehnt = m[1].split(',').map((s) => s.trim());
  }
  return runden;
}

/**
 * Audit-Einträge den Turns zuordnen. Ein Mutate-Aufruf kann mehrere Einträge schreiben (Batches, die
 * `graph_mutate` nacheinander anwendet) — sie liegen < 1,5 s auseinander und teilen das Ergebnis.
 * Einträge ohne `model` sind die Saat des Rigs. Ein Turn, den nur der Preflight blockte, schrieb nichts.
 * Jede Abweichung landet in `warnungen`; mit Warnungen ist die Zuordnung nicht belastbar.
 */
export function zuordnen(runden, audit) {
  const saat = audit.filter((a) => !a.model);
  const gruppen = [];
  for (const a of audit.filter((x) => x.model)) {
    const g = gruppen.at(-1);
    if (g && Date.parse(a.timestamp) - Date.parse(g.at(-1).timestamp) < 1500 && a.result === g[0].result) g.push(a);
    else gruppen.push([a]);
  }
  let i = 0;
  const warnungen = [];
  for (const r of runden) {
    r.audit = [];
    for (const t of r.turns) {
      if (!t.mutates) continue;
      if (t.preflightBlock.length && t.abgelehnt?.every((q) => t.preflightBlock.includes(q))) continue;
      const erwartet = t.abgelehnt ? 'rejected' : 'applied';
      const g = gruppen[i];
      if (!g) { warnungen.push(`Runde ${r.n}: kein Audit-Eintrag mehr`); continue; }
      if (g[0].result !== erwartet) warnungen.push(`Runde ${r.n}: erwartet ${erwartet}, Audit ${g[0].result}`);
      r.audit.push(...g);
      i++;
    }
  }
  if (i < gruppen.length) warnungen.push(`${gruppen.length - i} Audit-Gruppe(n) ohne Turn`);
  return { saat, warnungen };
}

/** Zug einer Runde als Kurzform: angelegte/geänderte Knotentypen, sonst die Kantentypen. */
export function zugForm(commands, typVon) {
  const k = new Set(), e = new Set();
  for (const c of commands) {
    if (c.op === 'add-node') k.add(`+${c.node.type}`);
    else if (c.op === 'update-node') k.add(`~${c.node.type ?? typVon(c.node.uid)}`);
    else if (c.op === 'delete-node') k.add(`-${typVon(c.uid)}`);
    else if (c.op === 'merge-nodes') k.add('M');
    else if (c.edge) e.add(`${c.op.startsWith('add') ? '+' : c.op.startsWith('update') ? '~' : '-'}${c.edge.edgeType}`);
  }
  return k.size ? [...k].sort().join('') : e.size ? `Kanten ${[...e].sort().join('')}` : 'nichts';
}

/**
 * Nachspiel eines Laufs: je Runde Fokus (mit dem heutigen `generationStep`), Zug, Gate, Fundänderung.
 * Selbstprüfung gegen das Log: Stagnation und Defer müssen übereinstimmen.
 */
export async function nachspielen(dir) {
  const log = readFileSync(join(dir, 'run-raw.log'), 'utf8');
  const audit = readFileSync(join(dir, 'audit.jsonl'), 'utf8').split('\n').filter((z) => z.trim()).map((z) => JSON.parse(z))
    .filter((a) => a.operation === 'mutate');
  const runden = rundenAusLog(log);
  if (!runden.length) return { nachspielbar: false, grund: 'kein Executor-Log (`[generate N]`)' };
  const { saat, warnungen } = zuordnen(runden, audit);
  if (warnungen.length) return { nachspielbar: false, grund: `Zuordnung Audit → Runde: ${warnungen.slice(0, 2).join('; ')}` };

  const lade = (p) => import(pathToFileURL(join(DIST, p)).href);
  const { applyCommands, cloneGraph } = await lade('kernel/apply-commands.js');
  const { takeSteeringSnapshot } = await lade('kernel/measure/steering-snapshot.js');
  const { generationStep } = await lade('loop/generate.js');
  const { DEFAULT_CONFIG } = await lade('kernel/config.js');
  const policy = DEFAULT_CONFIG.metricPolicy, schwelle = DEFAULT_CONFIG.focusThreshold;
  const schluessel = (v) => `${v.rule_id}|${v.element_id}`;
  const jeRegel = (ks) => ks.reduce((m, k) => zaehle(m, k.split('|')[0]), {});

  let graph = { nodes: [], edges: [] };
  const defer = [];
  const abweichung = [];
  let letzterPrompt, stagnation = 0;
  const zeilen = [];
  // Ein alter Lauf kann Werte tragen, die das heutige Schema verbietet (z. B. REQ-kinds vor CR-SM-366):
  // der Snapshot wirft dann einen ZodError. Das ist ein Befund über den Lauf, kein Fehler der Auswertung.
  try {
    for (const a of saat) if (a.result === 'applied') graph = applyCommands(cloneGraph(graph), a.commands).graph;
    for (const r of runden) {
      const gen = generationStep(graph, policy, undefined, schwelle, [...defer], 'driver', null, 'kern', null);
      stagnation = gen.prompt === letzterPrompt ? stagnation + 1 : 0;
      if (stagnation !== r.stagnation) abweichung.push(`Runde ${r.n}: Stagnation ${stagnation} statt ${r.stagnation}`);
      if (r.defer && r.defer !== gen.focusKey) abweichung.push(`Runde ${r.n}: Defer ${r.defer} statt ${gen.focusKey}`);
      const vorher = takeSteeringSnapshot(graph, policy);
      const typVon = (uid) => graph.nodes.find((n) => n.uid === uid)?.type ?? uid.split('-')[0];
      const angewandt = r.audit.filter((a) => a.result === 'applied');
      const zug = angewandt.length ? zugForm(angewandt.flatMap((a) => a.commands), typVon) : 'ohne Zug';
      for (const a of angewandt) graph = applyCommands(cloneGraph(graph), a.commands).graph;
      const nachher = takeSteeringSnapshot(graph, policy);
      const [vF, nF] = [new Set(vorher.focus.map(schluessel)), new Set(nachher.focus.map(schluessel))];
      const nAlle = new Set(nachher.violations.map(schluessel));
      const [, regel = null, ids = ''] = gen.focusKey?.split(':') ?? [];
      const fenster = regel ? ids.split(',').map((e) => `${regel}|${e}`) : [];
      zeilen.push({
        runde: r.n, phase: gen.phase, fokus: gen.focusKey ?? null, regel, zug,
        geloest: fenster.length > 0 && fenster.every((k) => !nAlle.has(k)),
        ablehnungen: r.audit.filter((a) => a.result === 'rejected')
          .map((a) => [...new Set((a.violations ?? []).filter((v) => v.severity === 'error').map((v) => v.ruleId))].join(',') || 'STRUCT'),
        neu: jeRegel([...nF].filter((k) => !vF.has(k))),
        fokusmenge: [vF.size, nF.size],
      });
      if (r.defer) defer.push(r.defer);
      letzterPrompt = gen.prompt;
    }
  } catch (e) {
    if (e?.name !== 'ZodError') throw e;
    const i = e.issues?.[0];
    return { nachspielbar: false, grund: `Graph verletzt das heutige Schema (${i?.path?.join('.') ?? '?'}: ${i?.message ?? e.message})` };
  }
  if (abweichung.length) return { nachspielbar: false, grund: `Steuerung weicht vom Log ab (Code seit dem Lauf geändert?): ${abweichung.slice(0, 2).join('; ')}` };
  return { nachspielbar: true, zeilen };
}

/** Je Fokusregel: Runden, gelöst, ohne Zug, typischer Zug, neue Fokusfunde je Runde. */
export function regelBilanz(zeilen) {
  const b = {};
  for (const z of zeilen) {
    const k = z.regel ?? `(${z.phase})`;
    const e = (b[k] ??= { runden: 0, geloest: 0, ohneZug: 0, ablehnungen: 0, zuege: {}, neu: {} });
    e.runden++;
    if (z.geloest) e.geloest++;
    if (z.zug === 'ohne Zug') e.ohneZug++;
    e.ablehnungen += z.ablehnungen.length;
    zaehle(e.zuege, z.zug);
    for (const [r, n] of Object.entries(z.neu)) zaehle(e.neu, r, n);
  }
  return b;
}

/** Fokusregel → Zug → neue Funde: Anzahl, gelöst, Beispielrunde. */
export function muster(laeufe) {
  const m = {};
  for (const { label, zeilen } of laeufe) {
    for (const z of zeilen) {
      if (!z.regel) continue;
      const e = (m[`${z.regel} → ${z.zug}`] ??= { n: 0, geloest: 0, neu: {}, beispiel: `${label}/r${z.runde}` });
      e.n++;
      if (z.geloest) e.geloest++;
      for (const [r, n] of Object.entries(z.neu)) zaehle(e.neu, r, n);
    }
  }
  return m;
}

// ---------------------------------------------------------------------------
// Regel-Pareto je Zugtyp — nur Audit
// ---------------------------------------------------------------------------

/** R-18 und STRUCT sind Sammelregeln; die Meldung sagt, welche Teilregel griff. */
export function regelSchluessel(v) {
  if (v.ruleId === 'R-18') {
    if (/allocate traces to MOD/.test(v.message)) return 'R-18/ein MOD je FUNC';
    if (/relation trace to a SCHEMA/.test(v.message)) return 'R-18/FLOW braucht SCHEMA';
    if (/satisfy pattern admits only kinds/.test(v.message)) return 'R-18/satisfy-kind';
    if (/compose parents/.test(v.message)) return 'R-18/ein compose-Parent';
    return 'R-18/Kantenmuster';
  }
  if (v.ruleId === 'STRUCT') return /parse/.test(v.message ?? '') ? 'STRUCT/Format-E' : 'STRUCT';
  return v.ruleId;
}

/** Zugtyp nach dem, was der Zug anlegt — der Architekturzug (MOD) zuerst, reine Kantenzüge zuletzt. */
export function zugTyp(commands) {
  if (!commands?.length) return 'Format-E unlesbar';
  const k = new Set(commands.filter((c) => c.op === 'add-node').map((c) => c.node.type));
  const e = new Set(commands.filter((c) => c.op === 'add-edge').map((c) => c.edge.edgeType));
  if (k.has('MOD')) return 'MOD + allocate';
  if (k.has('FUNC') || k.has('FCHAIN')) return 'FUNC/FCHAIN';
  if (k.has('FLOW') || k.has('SCHEMA')) return 'FLOW/SCHEMA';
  if (k.has('REQ') || k.has('TEST')) return 'REQ/TEST';
  if (k.has('UC')) return 'UC';
  if (k.has('SYS') || k.has('ACTOR')) return 'SYS/ACTOR';
  if (commands.some((c) => c.op === 'update-node')) return 'Knoten ändern';
  if (e.has('allocate')) return 'nur allocate-Kanten';
  return 'nur Kanten';
}

const beruehrt = (commands) => new Set((commands ?? []).flatMap((c) =>
  [c.node?.uid, c.uid, c.edge?.sourceId, c.edge?.targetId, c.sourceUid, c.targetUid].filter(Boolean)));

/** Greedy: kleinste Regelmenge, deren Kenntnis den Anteil `ziel` der Züge fehlerfrei machte. */
export function deckung(zuege, ziel) {
  const gewaehlt = new Set();
  const sauber = () => zuege.filter((z) => [...z.regeln].every((r) => gewaehlt.has(r))).length / (zuege.length || 1);
  while (sauber() < ziel) {
    const kand = {};
    for (const z of zuege) {
      const fehlt = [...z.regeln].filter((r) => !gewaehlt.has(r));
      for (const r of fehlt) zaehle(kand, r, 1 / fehlt.length ** 2);
    }
    const [beste] = top(kand, 1)[0] ?? [];
    if (!beste) break;
    gewaehlt.add(beste);
  }
  return [...gewaehlt];
}

/**
 * Je Zugtyp: n, durchs Gate, ohne neuen Befund am berührten Element, und die Regelmengen für 80 / 95 %
 * — einmal nur Gate-Fehler (`fehler`), einmal alle neuen Befunde am berührten Element (`befunde`).
 */
export function zugPareto(audits) {
  const typen = {};
  for (const text of audits) {
    for (const z of text.split('\n')) {
      if (!z.trim()) continue;
      const a = JSON.parse(z);
      if (a.operation !== 'mutate' || !a.model) continue;
      const b = beruehrt(a.commands);
      const vs = (a.violations ?? []).filter((v) => v.severity !== 'info');
      const fehler = new Set(vs.filter((v) => v.severity === 'error').map(regelSchluessel));
      const befunde = new Set(vs.filter((v) => v.severity === 'error' || !v.elementId || b.has(v.elementId)).map(regelSchluessel));
      (typen[zugTyp(a.commands)] ??= []).push({ durch: a.result === 'applied', fehler, befunde });
    }
  }
  return Object.fromEntries(Object.entries(typen).map(([t, zs]) => {
    const f = zs.map((z) => ({ regeln: z.fehler })), w = zs.map((z) => ({ regeln: z.befunde }));
    return [t, {
      n: zs.length,
      durchGate: pct(zs.filter((z) => z.durch).length, zs.length),
      ohneBefund: pct(zs.filter((z) => !z.befunde.size).length, zs.length),
      fehler80: deckung(f, 0.8), fehler95: deckung(f, 0.95),
      befunde80: deckung(w, 0.8).length, befunde95: deckung(w, 0.95).length,
    }];
  }));
}

// ---------------------------------------------------------------------------
// Bericht
// ---------------------------------------------------------------------------

/** Markdown-Abschnitt für den S2-Bericht; `laeufe` = [{label, dir}]. */
export async function zugBericht(laeufe) {
  const z = ['## Züge je Runde: Fokus → Zug → Wirkung (CR-GC-708)', ''];
  const gespielt = [];
  for (const l of laeufe) {
    if (!existsSync(join(l.dir, 'audit.jsonl')) || !existsSync(join(l.dir, 'run-raw.log'))) continue;
    const s = await nachspielen(l.dir);
    if (s.nachspielbar) gespielt.push({ label: l.label, zeilen: s.zeilen });
    else z.push(`- ${l.label}: nicht nachspielbar — ${s.grund}`);
  }
  if (gespielt.length) {
    const b = regelBilanz(gespielt.flatMap((g) => g.zeilen));
    z.push(`**Regelbilanz** (${gespielt.map((g) => g.label).join(', ')}; gelöst = alle Funde des Fokusfensters nach der Runde weg)`, '',
      '| Fokusregel | Runden | gelöst | ohne Zug | Ablehnungen | häufigster Zug | neue Fokusfunde je Runde |', '|---|---:|---:|---:|---:|---|---|');
    for (const [r, e] of Object.entries(b).sort((x, y) => y[1].runden - x[1].runden)) {
      const neu = top(e.neu, 4).map(([k, n]) => `${k} ${(n / e.runden).toFixed(1)}`).join(', ') || '—';
      z.push(`| ${r} | ${e.runden} | ${pct(e.geloest, e.runden)} % | ${e.ohneZug} | ${e.ablehnungen} | ${top(e.zuege, 1)[0]?.[0] ?? '—'} | ${neu} |`);
    }
    const m = Object.entries(muster(gespielt)).filter(([, e]) => e.n >= 2).sort((x, y) => y[1].n - x[1].n).slice(0, 10);
    z.push('', '**Muster** (Fokusregel → Zug, ab 2 Runden)', '', '| Muster | Runden | gelöst | neue Fokusfunde | Beispiel |', '|---|---:|---:|---|---|');
    for (const [k, e] of m) z.push(`| ${k} | ${e.n} | ${e.geloest} | ${top(e.neu, 4).map(([r, n]) => `${r} +${n}`).join(', ') || '—'} | ${e.beispiel} |`);
  }
  const audits = laeufe.map((l) => join(l.dir, 'audit.jsonl')).filter(existsSync).map((p) => readFileSync(p, 'utf8'));
  const p = zugPareto(audits);
  const summeN = Object.values(p).reduce((s, e) => s + e.n, 0);
  if (summeN) {
    z.push('', `**Regel-Pareto je Zugtyp** (${summeN} Züge; Regeln, deren Kenntnis 80 % / 95 % der Züge fehlerfrei durchs Gate brächte — und wie viele es für „ohne jeden neuen Befund" bräuchte)`, '',
      '| Zugtyp | n | durchs Gate | ohne Befund | Gate-Regeln 80 % | Gate-Regeln 95 % | Befund-Regeln 80 / 95 % |', '|---|---:|---:|---:|---|---|---:|');
    for (const [t, e] of Object.entries(p).sort((x, y) => y[1].n - x[1].n)) {
      const liste = (rs) => (rs.length ? `${rs.length}: ${rs.join(', ')}` : '0');
      z.push(`| ${t} | ${e.n} | ${e.durchGate} % | ${e.ohneBefund} % | ${liste(e.fehler80)} | ${liste(e.fehler95)} | ${e.befunde80} / ${e.befunde95} |`);
    }
  }
  return z.join('\n');
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const dirs = process.argv.slice(2);
  if (!dirs.length) {
    console.error('node zuege.mjs <lauf-dir> …');
    process.exit(1);
  }
  console.log(await zugBericht(dirs.map((d) => ({ label: d.replace(/\/$/, '').split('/').pop(), dir: d }))));
}
