#!/usr/bin/env node
/**
 * turn-analyse.mjs (CR-GC-567) — was kostet ein Turn, und wer verursacht es?
 *
 * `--output-format json` liefert EINE Usage-Zeile je Lauf. Damit ist nicht zu trennen,
 * welche Werkzeugantwort den Cache entwertet. `stream-json` liefert sie je Assistant-
 * Nachricht; diese Auswertung liest den Strom und beantwortet drei Fragen:
 *
 *  1. Verbrauch je Turn (Eingabe / Cache-Lesung / Cache-Schreibung / Ausgabe).
 *  2. Welches Werkzeug ging dem teuersten `cache_creation` voraus.
 *  3. Dry-Run-Wirksamkeit: wurde nach Previews der bessere Batch angewandt?
 *  4. Was kostet ein zusaetzlicher Turn, je Ausloeser (graphcode / Datei-Code / ToolSearch)?
 *  5. Bedarf: was wollte das Modell je Aufruf — hatte es das schon, oder haette der Graph es geliefert?
 *
 * Reine Auswertung, keine Messung — sie liest, was der Lauf geschrieben hat.
 * @author andreas@siglochconsulting
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Eine Zeile des stream-json-Protokolls, tolerant gegen Teilzeilen. */
export function* zeilen(pfad) {
  for (const z of readFileSync(pfad, 'utf8').split('\n')) {
    const t = z.trim();
    if (!t) continue;
    try { yield JSON.parse(t); } catch { /* Teilzeile am Ende — überspringen */ }
  }
}

const LEER = { input: 0, cacheRead: 0, cacheCreate: 0 };
const summe = (a, b) => ({
  input: a.input + b.input, cacheRead: a.cacheRead + b.cacheRead,
  cacheCreate: a.cacheCreate + b.cacheCreate,
});

/**
 * Turns aus dem Strom. Ein Turn = EINE Assistant-Nachricht; die Werkzeuge, deren
 * ERGEBNIS ihr vorausging, sind die Verursacher ihres Kontextzuwachses.
 *
 * Eine Nachricht kommt MEHRFACH im Strom vor — einmal je Content-Block, jedes Mal
 * mit derselben `usage`. Gemessen an opus5-5: 126 Assistant-Ereignisse, 57 distinkte
 * `message.id`; naiv summiert ergab das 746.749 statt 368.297 Cache-Schreibung, also
 * das Doppelte. Deshalb wird je `message.id` zusammengefasst und feldweise das
 * MAXIMUM genommen (spaetere Ereignisse derselben Nachricht sind vollstaendiger).
 * `pruefeGegenResultzeile()` haelt genau diese Gleichheit fest.
 *
 * AUSNAHME `output`: der Strom meldet ihn zum Zeitpunkt des Ereignisses, also noch
 * unfertig — 615 gegen 114.568 in der `result`-Zeile. Er ist je Turn NICHT messbar
 * und wird darum nirgends summiert; die Ausgabemenge steht in der Ergebniszeile.
 */
export function leseTurns(pfad) {
  const proNachricht = new Map(); // message.id → Turn (zusammengefasst)
  const reihenfolge = [];
  let offen = [];            // Werkzeuge, deren Ergebnis seit dem letzten Turn eintraf
  let offenDetail = [];      // dieselben Ergebnisse mit id und Text (fuer die Bedarfsanalyse)
  const letzteIds = new Map(); // tool_use_id → Name, um Ergebnisse zuzuordnen

  for (const e of zeilen(pfad)) {
    if (e.type === 'assistant' && e.message) {
      const u = e.message.usage ?? {};
      const uses = (e.message.content ?? []).filter((c) => c.type === 'tool_use');
      const rufe = uses.map((c) => { letzteIds.set(c.id, c.name); return c.name; });
      const aufrufe = uses.map((c) => ({ id: c.id, name: c.name, input: c.input ?? {} }));
      const id = e.message.id ?? `ohne-id-${reihenfolge.length}`;
      const vorhanden = proNachricht.get(id);
      if (!vorhanden) {
        proNachricht.set(id, {
          nr: reihenfolge.length + 1,
          verbrauch: {
            input: u.input_tokens ?? 0,
            cacheRead: u.cache_read_input_tokens ?? 0,
            cacheCreate: u.cache_creation_input_tokens ?? 0,
          },
          ruft: rufe,
          aufrufe,
          nachErgebnisVon: offen,
          ergebnisse: offenDetail,
        });
        reihenfolge.push(id);
        offen = [];
        offenDetail = [];
      } else {
        // Dasselbe Ereignis, weiterer Content-Block: Verbrauch NICHT addieren.
        vorhanden.verbrauch.input = Math.max(vorhanden.verbrauch.input, u.input_tokens ?? 0);
        vorhanden.verbrauch.cacheRead = Math.max(vorhanden.verbrauch.cacheRead, u.cache_read_input_tokens ?? 0);
        vorhanden.verbrauch.cacheCreate = Math.max(vorhanden.verbrauch.cacheCreate, u.cache_creation_input_tokens ?? 0);
        for (const r of rufe) if (!vorhanden.ruft.includes(r)) vorhanden.ruft.push(r);
        for (const a of aufrufe) if (!vorhanden.aufrufe.some((x) => x.id === a.id)) vorhanden.aufrufe.push(a);
      }
    }
    if (e.type === 'user' && e.message) {
      for (const c of e.message.content ?? []) {
        if (c.type !== 'tool_result') continue;
        offen.push(letzteIds.get(c.tool_use_id) ?? 'unbekannt');
        const text = typeof c.content === 'string' ? c.content : JSON.stringify(c.content ?? '');
        offenDetail.push({ id: c.tool_use_id, text });
      }
    }
  }
  return reihenfolge.map((id) => proNachricht.get(id));
}

/**
 * Abnahme-Kriterium 2 als Code: stimmt die Summe aus dem Strom mit der `result`-Zeile
 * ueberein? Wenn nicht, misst die Auswertung etwas anderes als der Lauf gekostet hat —
 * und jede Zuschreibung darunter ist wertlos. `output` bleibt aussen vor (s.o.).
 */
export function pruefeGegenResultzeile(dir) {
  const rohPfad = `${dir}/claude-raw.json`;
  const stromPfad = `${dir}/claude-stream.jsonl`;
  if (!existsSync(rohPfad) || !existsSync(stromPfad)) return null;
  let roh;
  try { roh = JSON.parse(readFileSync(rohPfad, 'utf8')); } catch { return null; }
  const u = roh.usage ?? {};
  const turns = leseTurns(stromPfad);
  const strom = turns.reduce((a, t) => summe(a, t.verbrauch), LEER);
  const felder = [
    ['input', strom.input, u.input_tokens ?? 0],
    ['cacheRead', strom.cacheRead, u.cache_read_input_tokens ?? 0],
    ['cacheCreate', strom.cacheCreate, u.cache_creation_input_tokens ?? 0],
  ];
  return {
    ok: felder.every(([, a, b]) => a === b),
    felder: felder.map(([name, strom, resultZeile]) => ({ name, strom, resultZeile })),
    turns: turns.length,
  };
}

/** cache_creation, zugeschrieben dem Werkzeug, dessen Ergebnis dem Turn voranging. */
export function cacheVerursacher(turns) {
  const je = new Map();
  for (const t of turns) {
    if (!t.nachErgebnisVon.length) continue;
    // Gleichverteilt, wenn mehrere Ergebnisse vor demselben Turn eintrafen — die
    // Zuordnung ist eine Naeherung und wird als solche berichtet.
    const anteil = t.verbrauch.cacheCreate / t.nachErgebnisVon.length;
    for (const w of t.nachErgebnisVon) je.set(w, (je.get(w) ?? 0) + anteil);
  }
  return [...je.entries()].map(([werkzeug, tokens]) => ({ werkzeug, tokens: Math.round(tokens) }))
    .sort((a, b) => b.tokens - a.tokens);
}

/** Werkzeugklasse eines Turn-Ausloesers: graphcode-Antwort, ToolSearch oder Datei-/Code-Arbeit. */
export function klasse(werkzeug) {
  if (werkzeug.startsWith('mcp__graphcode__')) return 'graphcode';
  if (werkzeug === 'ToolSearch') return 'ToolSearch';
  return 'datei/code';
}

/**
 * Cache-LESUNG je Ausloeser-Klasse. Jeder Turn liest den ganzen bisherigen Kontext; wer den
 * Turn ausloest, verursacht diese Lesung. Anders als `cacheVerursacher` (was kam NEU in den
 * Kontext) beantwortet das, was ein zusaetzlicher Turn kostet — gemessen am Code-Test: der
 * gefuehrte Arm liest 12,8 M statt 1,4 M, und das kommt aus Turn-Zahl mal Kontextgroesse,
 * nicht aus dem Modellinhalt. Exakt je Turn; nur Turns mit mehreren Klassen werden
 * gleichverteilt. Der erste Turn heisst `start`.
 */
export function lesenJeAusloeser(turns) {
  const je = new Map();
  for (const t of turns) {
    const klassen = t.nachErgebnisVon.length ? [...new Set(t.nachErgebnisVon.map(klasse))] : ['start'];
    for (const k of klassen) {
      const e = je.get(k) ?? { klasse: k, turns: 0, cacheRead: 0 };
      e.turns += 1 / klassen.length;
      e.cacheRead += t.verbrauch.cacheRead / klassen.length;
      je.set(k, e);
    }
  }
  return [...je.values()]
    .map((e) => ({
      klasse: e.klasse,
      turns: +e.turns.toFixed(1),
      cacheRead: Math.round(e.cacheRead),
      kontextJeTurn: Math.round(e.cacheRead / (e.turns || 1)),
    }))
    .sort((a, b) => b.cacheRead - a.cacheRead);
}

const UID = /\b(?:SYS|UC|REQ|FUNC|FCHAIN|MOD|SCHEMA|FLOW|TEST|ACTOR|CR|MS)-[A-Za-z0-9][\w.-]*/g;
const MODELLDATEI = /(^|[\s/'"])(docs\/graph|docs\/views|\.graphcode)(\/|\s|$)/;
const GRAPH_SCHREIBT = /mutate|realize|test_ingest|export|reseed|merge/;
const DETAIL = new Set(['graph_context', 'graph_get_node']);

/**
 * Was ein Modell ueber den Graphen haette erfahren koennen: uids, realRef-Symbole und
 * ob TESTs mit testRefs existieren (dann haette `graph_tests` die Auswahl geliefert).
 * `pfad` ist ein Graph-Export (Arbeitsbereich) oder das Golden (Gegenprobe fuer den freien Arm).
 */
export function modellIndex(pfad) {
  if (!pfad || !existsSync(pfad)) return null;
  const g = JSON.parse(readFileSync(pfad, 'utf8'));
  const uids = new Set();
  const symbole = new Set();
  const testDateien = new Set();
  for (const e of g.elements ?? []) {
    uids.add(e.id ?? e.uid);
    const a = e.attributes ?? {};
    if (a.realRef?.symbol) symbole.add(a.realRef.symbol);
    for (const r of [...(a.testRefs ?? []), ...(a.testRef ? [a.testRef] : [])]) testDateien.add(typeof r === 'string' ? r.split('#')[0] : r.file);
  }
  return { pfad, uids, symbole, testDateien };
}

/** Der erste Graph-Export eines Arbeitsbereichs, sonst null. */
export function modellImArbeitsbereich(ws) {
  const d = join(ws, 'docs', 'graph');
  if (existsSync(d)) {
    const f = readdirSync(d).find((n) => n.endsWith('.graph.json'));
    if (f) return join(d, f);
  }
  return existsSync(join(ws, 'graph.json')) ? join(ws, 'graph.json') : null;
}

/** Was ein Aufruf wollte: Art des Bedarfs und ein Schluessel, an dem Wiederholung erkennbar ist. */
export function bedarf(name, input, wurzel = '') {
  const rel = (p) => (wurzel ? (p ?? '').replace(`${wurzel}/`, '') : (p ?? ''));
  if (name === 'Read') return { art: 'lesen', schluessel: `datei:${rel(input.file_path)}`, datei: rel(input.file_path) };
  if (name === 'Grep' || name === 'Glob') {
    return { art: 'suchen', schluessel: `${name}:${input.pattern}@${rel(input.path)}`, muster: input.pattern ?? '', datei: rel(input.path) };
  }
  if (name === 'Write' || name === 'Edit' || name === 'NotebookEdit') return { art: 'schreiben', datei: rel(input.file_path), neu: name === 'Write' };
  if (name.startsWith('mcp__graphcode__')) {
    const w = name.slice('mcp__graphcode__'.length);
    if (GRAPH_SCHREIBT.test(w)) return { art: 'graph-schreiben' };
    return { art: 'graph-lesen', schluessel: `${w}:${JSON.stringify(input)}`, werkzeug: w };
  }
  if (name === 'ToolSearch') return { art: 'werkzeug-laden', schluessel: `ToolSearch:${input.query}` };
  if (name === 'Bash') {
    const c = (input.command ?? '').trim();
    if (/\b(npm (run )?test|npx vitest run|vitest run)\b/.test(c) && !/\.test\.ts|\btests?\/\S/.test(c)) return { art: 'testlauf-voll' };
    if (/^(grep|rg|find|ls|git grep)\b/.test(c)) return { art: 'suchen', schluessel: `bash:${c}`, muster: c, datei: rel(c) };
    if (/^(cat|head|tail|sed -n|wc)\b/.test(c)) return { art: 'lesen', schluessel: `bash:${c}`, muster: c, datei: rel(c) };
    return { art: 'ausfuehren' };
  }
  return { art: 'sonst', schluessel: `${name}:${JSON.stringify(input)}` };
}

const INFO = new Set(['lesen', 'suchen', 'graph-lesen', 'werkzeug-laden', 'testlauf-voll', 'sonst']);

/**
 * Bedarfsanalyse (Leitlinie T-E9): was wollte das Modell je Informations-Aufruf, hatte es das
 * schon, und wo haette es das herbekommen? Deterministische Regeln, in dieser Reihenfolge:
 *   doppelt        — wortgleicher Aufruf im SELBEN Turn: parallel abgesetzt, dieselbe Antwort.
 *   schon-da       — derselbe Aufruf seit der letzten Aenderung schon gestellt, oder die Datei
 *                    selbst geschrieben (der Inhalt steht im Kontext).
 *   teilweise-da   — die angefragte uid stand schon in einer DETAIL-Antwort (`graph_context`,
 *                    `graph_get_node`) seit dem letzten Graph-Schreibzug. Listen (`graph_elements`,
 *                    `graph_expand`) zaehlen nicht: von der Liste ins Detail ist der gewollte Weg.
 *   buendelbar     — dasselbe Graph-Werkzeug mit anderem Argument im direkt folgenden Turn:
 *                    ein paralleler Aufruf haette den Turn gespart (z. B. `graph_help` RC-03, dann RC-01…).
 *   werkzeug-laden — ToolSearch: Harness-Overhead, entfaellt ohne deferred Werkzeuge.
 *   graph-haette   — Modelldatei gelesen statt abgefragt; Suche nach einer uid oder einem
 *                    realRef-Symbol des Modells (`graph_context`); Volllauf, obwohl gebundene
 *                    Testdateien im Arbeitsbereich liegen (`graph_tests`). Nur mit `modell`.
 *   neu            — alles andere: echter Bedarf.
 * Kosten je Aufruf: sein Anteil an der Cache-Lesung des Turns, den sein Ergebnis ausloest.
 * Eine Wiederholung nach einer Kompaktierung zaehlt als schon-da, obwohl der Inhalt aus dem
 * Kontext gefallen sein kann — die Regel sieht Ereignisse, nicht das Kontextfenster.
 */
export function bedarfsAnalyse(turns, { modell = null, wurzel = '' } = {}) {
  const anteil = new Map(); // tool_use_id → Cache-Lesung des ausgeloesten Turns, anteilig
  const ergebnisText = new Map();
  for (const t of turns) {
    for (const e of t.ergebnisse ?? []) {
      anteil.set(e.id, t.verbrauch.cacheRead / t.ergebnisse.length);
      ergebnisText.set(e.id, e.text);
    }
  }
  const gebundeneTests = modell
    ? [...modell.testDateien].filter((f) => f && existsSync(join(wurzel, f))).length : 0;
  const gesehen = new Map();    // schluessel → Turn-Nr
  const uidGesehen = new Map(); // uid aus Graph-Antworten → Turn-Nr
  let vorher = null;            // letzter Informationsaufruf: { werkzeug, turn }
  const urteile = [];
  for (const t of turns) {
    for (const a of t.aufrufe ?? []) {
      const b = bedarf(a.name, a.input, wurzel);
      if (b.art === 'schreiben') {
        for (const k of [...gesehen.keys()]) if (!k.startsWith('datei:') && !/^[a-z_]+:\{/.test(k) && !k.startsWith('ToolSearch')) gesehen.delete(k);
        if (b.neu) gesehen.set(`datei:${b.datei}`, t.nr); else gesehen.delete(`datei:${b.datei}`);
        continue;
      }
      if (b.art === 'graph-schreiben') {
        for (const k of [...gesehen.keys()]) if (/^[a-z_]+:\{/.test(k)) gesehen.delete(k);
        uidGesehen.clear();
        continue;
      }
      if (!INFO.has(b.art)) continue;
      const uids = b.art === 'graph-lesen' ? [...JSON.stringify(a.input).matchAll(UID)].map((m) => m[0]) : [];
      let urteil = 'neu';
      let grund = '';
      // Nur was VOR diesem Turn zurueckkam, kann das Modell gekannt haben: parallele Aufrufe
      // im selben Turn sehen die Antworten ihrer Geschwister nicht (und sind schon gebuendelt).
      const frueher = (nr) => nr !== undefined && nr < t.nr;
      if (b.schluessel && gesehen.get(b.schluessel) === t.nr) {
        urteil = 'doppelt'; grund = 'wortgleich im selben Turn';
      } else if (b.schluessel && frueher(gesehen.get(b.schluessel))) {
        urteil = 'schon-da'; grund = `seit Turn ${gesehen.get(b.schluessel)} im Kontext`;
      } else if (uids.length && uids.every((u) => frueher(uidGesehen.get(u)))) {
        urteil = 'teilweise-da'; grund = `${uids[0]} stand in der Graph-Antwort aus Turn ${uidGesehen.get(uids[0])}`;
      } else if (b.art === 'werkzeug-laden') {
        urteil = 'werkzeug-laden'; grund = 'deferred Werkzeug nachgeladen';
      } else if (vorher && vorher.werkzeug === a.name && t.nr - vorher.turn === 1 && b.art === 'graph-lesen') {
        urteil = 'buendelbar'; grund = `${b.werkzeug} schon im Turn davor mit anderem Argument`;
      } else if (b.art === 'testlauf-voll' && gebundeneTests > 0) {
        urteil = 'graph-haette'; grund = `graph_tests statt Volllauf (${gebundeneTests} gebundene Testdateien)`;
      } else if (modell && (b.art === 'lesen' || b.art === 'suchen')) {
        const uid = [...((b.muster ?? '').matchAll(UID))].map((m) => m[0]).find((u) => modell.uids.has(u));
        const sym = [...modell.symbole].find((x) => x.length > 3 && new RegExp(`\\b${x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(b.muster ?? ''));
        if (MODELLDATEI.test(` ${b.datei ?? ''}`)) { urteil = 'graph-haette'; grund = 'Modelldatei gelesen statt abgefragt'; }
        else if (uid) { urteil = 'graph-haette'; grund = `graph_context ${uid}`; }
        else if (sym) { urteil = 'graph-haette'; grund = `realRef ${sym} steht im Modell`; }
      }
      if (b.schluessel && urteil !== 'doppelt') gesehen.set(b.schluessel, t.nr);
      if (b.art === 'graph-lesen' && DETAIL.has(b.werkzeug)) {
        for (const m of (ergebnisText.get(a.id) ?? '').matchAll(UID)) if (!uidGesehen.has(m[0])) uidGesehen.set(m[0], t.nr);
      }
      vorher = { werkzeug: a.name, turn: t.nr };
      urteile.push({ turn: t.nr, werkzeug: a.name, art: b.art, ziel: b.schluessel ?? b.art, urteil, grund, cacheRead: Math.round(anteil.get(a.id) ?? 0) });
    }
  }
  const summe = {};
  for (const u of urteile) {
    const x = (summe[u.urteil] ??= { aufrufe: 0, cacheRead: 0 });
    x.aufrufe += 1;
    x.cacheRead += u.cacheRead;
  }
  return { modell: modell?.pfad ?? null, summe, urteile };
}

/**
 * Die Spur des Executors (`graphcode run`, run-raw.log) als Aufrufliste. Der Executor schreibt
 * keinen stream-json, aber je Runde `[generate N]`, je Turn `N.k: werkzeuge` und je Lese-Aufruf
 * `read <werkzeug> <json, auf 160 Zeichen gekappt> → <n> Z.[ ERROR| gekappt]` (CR-GC-652).
 * Tokens je Turn stehen nicht darin; die Groesse der Antwort in Zeichen ist das Kostenmass.
 */
export function leseExecutorSpur(pfad) {
  const aufrufe = [];
  let runde = 0;
  let turn = '';
  for (const z of readFileSync(pfad, 'utf8').split('\n')) {
    const r = z.match(/^\[generate (\d+)\]/);
    if (r) { runde = Number(r[1]); continue; }
    const t = z.match(/^ {2}(\d+\.\d+): (.*)$/);
    if (t) {
      turn = t[1];
      if (/\bgraph_mutate\b/.test(t[2])) aufrufe.push({ runde, turn, werkzeug: 'graph_mutate', roh: '', zeichen: 0, flag: '' });
      continue;
    }
    const l = z.match(/^ {4}read (\S+) (.*) → (\d+) Z\.( ERROR| gekappt)?$/);
    if (l) aufrufe.push({ runde, turn, werkzeug: l[1], roh: l[2], zeichen: Number(l[3]), flag: (l[4] ?? '').trim() });
  }
  return aufrufe;
}

/** Executor-Werkzeug → Claude-Code-Form, damit dieselbe Bedarfsregel (`bedarf`) greift. */
function alsClaudeRuf(werkzeug, roh) {
  let input = {};
  try { input = JSON.parse(roh); } catch { input = { roh }; } // auf 160 Zeichen gekappt
  if (werkzeug === 'read_file') return { name: 'Read', input: { file_path: input.path ?? input.roh } };
  if (werkzeug === 'list_dir') return { name: 'Glob', input: { pattern: '*', path: input.path ?? input.roh } };
  if (werkzeug === 'grep') return { name: 'Grep', input: { pattern: input.pattern ?? input.roh, path: input.path } };
  return { name: `mcp__graphcode__${werkzeug}`, input };
}

/**
 * Bedarfsanalyse fuer den Executor. Sein Kontext beginnt JEDE Runde neu (`messages` je Runde),
 * deshalb gilt `schon-da` nur innerhalb einer Runde, und ein neues Urteil kommt dazu:
 *   je-runde — derselbe Lesezugriff schon in einer frueheren Runde. Das Modell brauchte ihn
 *              wieder, weil der Rundenprompt ihn nicht traegt: Kandidat fuer den Prompt (Push
 *              statt Pull) — oder ein Zeichen, dass der Prompt ihn nicht verstaendlich traegt.
 * `doppelt` wie beim Claude-Code-Arm. `teilweise-da` entfaellt: die Spur hat keine Antworttexte. Graph-Lesungen verfallen mit jedem
 * `graph_mutate`, Dateilesungen nicht (der Executor schreibt keine Dateien).
 */
export function bedarfsAnalyseExecutor(aufrufe, { modell = null } = {}) {
  const dieseRunde = new Map(); // schluessel → Turn, nur laufende Runde
  const frueher = new Map();    // schluessel → Anzahl frueherer Runden
  let runde = 0;
  let vorher = null;
  const urteile = [];
  for (const a of aufrufe) {
    if (a.runde !== runde) {
      for (const k of dieseRunde.keys()) frueher.set(k, (frueher.get(k) ?? 0) + 1);
      dieseRunde.clear();
      runde = a.runde;
      vorher = null;
    }
    if (a.werkzeug === 'graph_mutate') {
      for (const k of [...dieseRunde.keys()]) if (/^[a-z_]+:\{/.test(k)) dieseRunde.delete(k);
      continue;
    }
    const { name, input } = alsClaudeRuf(a.werkzeug, a.roh);
    const b = bedarf(name, input, '');
    const schluessel = b.schluessel ?? `${a.werkzeug}:${a.roh}`;
    let urteil = 'neu';
    let grund = '';
    if (dieseRunde.get(schluessel) === a.turn) {
      urteil = 'doppelt'; grund = 'wortgleich im selben Turn';
    } else if (dieseRunde.has(schluessel)) {
      urteil = 'schon-da'; grund = `in dieser Runde schon in Turn ${dieseRunde.get(schluessel)}`;
    } else if (frueher.has(schluessel)) {
      urteil = 'je-runde'; grund = `schon in ${frueher.get(schluessel)} frueheren Runden gelesen`;
    } else if (vorher && vorher.werkzeug === a.werkzeug && vorher.turn !== a.turn && b.art === 'graph-lesen') {
      urteil = 'buendelbar'; grund = `${a.werkzeug} schon im Turn davor mit anderem Argument`;
    } else if (modell && (b.art === 'lesen' || b.art === 'suchen')) {
      const uid = [...((b.muster ?? '').matchAll(UID))].map((m) => m[0]).find((u) => modell.uids.has(u));
      if (MODELLDATEI.test(` ${b.datei ?? ''}`)) { urteil = 'graph-haette'; grund = 'Modelldatei gelesen statt abgefragt'; }
      else if (uid) { urteil = 'graph-haette'; grund = `graph_context ${uid}`; }
    }
    if (!dieseRunde.has(schluessel)) dieseRunde.set(schluessel, a.turn);
    vorher = a;
    urteile.push({ runde: a.runde, turn: a.turn, werkzeug: a.werkzeug, ziel: schluessel, urteil, grund, zeichen: a.zeichen, flag: a.flag });
  }
  const summe = {};
  for (const u of urteile) {
    const x = (summe[u.urteil] ??= { aufrufe: 0, zeichen: 0 });
    x.aufrufe += 1;
    x.zeichen += u.zeichen;
  }
  const leer = urteile.filter((u) => u.flag === 'ERROR').length;
  const gekappt = urteile.filter((u) => u.flag === 'gekappt').length;
  return { modell: modell?.pfad ?? null, summe, urteile, fehler: leer, gekappt };
}

/**
 * Dry-Run-Wirksamkeit aus dem Audit: wie viele Previews gingen einer Anwendung voraus,
 * und wurde tatsaechlich gewaehlt statt nur geprobt? `validate` ohne folgendes `mutate`
 * heisst: geprobt und verworfen — das ist der Beleg, dass die Metrik die Auswahl traegt.
 */
export function dryRunWirkung(auditPfad) {
  if (!existsSync(auditPfad)) return null;
  let previews = 0, anwendungen = 0, verworfen = 0, laufend = 0;
  for (const e of zeilen(auditPfad)) {
    if (e.operation === 'validate') { previews++; laufend++; }
    else if (e.operation === 'mutate') { anwendungen++; if (laufend > 1) verworfen += laufend - 1; laufend = 0; }
  }
  verworfen += laufend;
  return { previews, anwendungen, verworfen, quote: previews ? +(verworfen / previews).toFixed(2) : 0 };
}

const fmt = (n) => n.toLocaleString('de-DE');

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: node turn-analyse.mjs <run-dir>'); process.exit(1); }
  const strom = `${dir}/claude-stream.jsonl`;
  const spur = `${dir}/run-raw.log`;
  if (!existsSync(strom) && existsSync(spur)) {
    // Executor-Lauf: keine Tokens je Turn, aber die Spur je Lese-Aufruf (Bedarf, T-E9).
    const ba = bedarfsAnalyseExecutor(leseExecutorSpur(spur), { modell: modellIndex(process.argv[3] ?? modellImArbeitsbereich(dir)) });
    console.log(`Executor-Spur: ${ba.urteile.length} Lese-Aufrufe, ${ba.fehler} mit ERROR, ${ba.gekappt} gekappt`);
    for (const [u, x] of Object.entries(ba.summe)) {
      console.log(`  ${u.padEnd(12)} ${String(x.aufrufe).padStart(4)} Aufrufe  ${fmt(x.zeichen).padStart(9)} Zeichen gelesen`);
    }
    const jeZiel = new Map();
    for (const u of ba.urteile.filter((x) => x.urteil === 'je-runde')) {
      const e = jeZiel.get(u.ziel) ?? { n: 0, zeichen: 0 };
      e.n += 1; e.zeichen += u.zeichen; jeZiel.set(u.ziel, e);
    }
    console.log('\nIn mehreren Runden wieder gelesen — Kandidaten fuer den Rundenprompt:');
    for (const [ziel, e] of [...jeZiel].sort((a, b) => b[1].zeichen - a[1].zeichen).slice(0, 10)) {
      console.log(`  ${String(e.n).padStart(3)}×  ${fmt(e.zeichen).padStart(8)} Z.  ${ziel.slice(0, 90)}`);
    }
    process.exit(0);
  }
  if (!existsSync(strom)) { console.error(`kein ${strom} — der Lauf lief ohne stream-json`); process.exit(1); }

  const turns = leseTurns(strom);
  const ges = turns.reduce((a, t) => summe(a, t.verbrauch), LEER);
  const pruef = pruefeGegenResultzeile(dir);
  if (pruef) {
    console.log(pruef.ok
      ? 'Abgleich mit der result-Zeile: OK — der Strom misst denselben Lauf.'
      : 'Abgleich mit der result-Zeile: ABWEICHUNG — die Zuschreibung unten ist NICHT belastbar:');
    if (!pruef.ok) for (const f of pruef.felder) {
      if (f.strom !== f.resultZeile) console.log(`  ${f.name}: Strom ${fmt(f.strom)} vs. result ${fmt(f.resultZeile)}`);
    }
  }
  console.log(`Turns: ${turns.length}`);
  console.log(`Eingabe ungecacht ${fmt(ges.input)} · Cache-Lesung ${fmt(ges.cacheRead)} · Cache-Schreibung ${fmt(ges.cacheCreate)}`);
  console.log(`Cache-Schreibung je Turn im Mittel: ${fmt(Math.round(ges.cacheCreate / (turns.length || 1)))}\n`);

  console.log('Teuerste Turns (Cache-Schreibung):');
  for (const t of [...turns].sort((a, b) => b.verbrauch.cacheCreate - a.verbrauch.cacheCreate).slice(0, 8)) {
    console.log(`  Turn ${String(t.nr).padStart(3)}  +${fmt(t.verbrauch.cacheCreate).padStart(8)}  nach: ${t.nachErgebnisVon.join(', ') || '—'}`);
  }

  console.log('\nCache-Lesung je Ausloeser (was ein zusaetzlicher Turn kostet):');
  for (const e of lesenJeAusloeser(turns)) {
    console.log(`  ${e.klasse.padEnd(12)} ${String(e.turns).padStart(5)} Turns  ${fmt(e.cacheRead).padStart(11)}  (${fmt(e.kontextJeTurn)} je Turn)`);
  }

  const modell = modellIndex(process.argv[3] ?? modellImArbeitsbereich(dir));
  const ba = bedarfsAnalyse(turns, { modell, wurzel: dir.replace(/\/$/, '') });
  console.log(`\nBedarf je Informationsaufruf (Modell: ${ba.modell ?? 'keins — graph-haette nicht entscheidbar'}):`);
  for (const [u, s] of Object.entries(ba.summe)) {
    console.log(`  ${u.padEnd(13)} ${String(s.aufrufe).padStart(4)} Aufrufe  ${fmt(s.cacheRead).padStart(11)} Cache-Lesung ausgeloest`);
  }
  for (const u of ba.urteile.filter((x) => x.urteil !== 'neu').slice(0, 12)) {
    console.log(`    Turn ${String(u.turn).padStart(3)} ${u.urteil.padEnd(12)} ${u.ziel.slice(0, 60).padEnd(60)} ${u.grund}`);
  }

  console.log('\nCache-Schreibung je vorausgegangenem Werkzeug (Naeherung bei mehreren):');
  for (const { werkzeug, tokens } of cacheVerursacher(turns).slice(0, 10)) {
    console.log(`  ${werkzeug.padEnd(38)} ${fmt(tokens).padStart(9)}`);
  }

  const dr = dryRunWirkung(`${dir}/.graphcode/audit.jsonl`);
  if (dr) {
    console.log(`\nDry-Run: ${dr.previews} Previews, ${dr.anwendungen} Anwendungen, ${dr.verworfen} geprobt-und-verworfen (Quote ${dr.quote})`);
    console.log('  Quote 0 = jeder Preview wurde angewandt (die Metrik waehlt nicht aus, sie bestaetigt nur).');
  }
}
