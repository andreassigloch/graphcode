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
 *
 * Reine Auswertung, keine Messung — sie liest, was der Lauf geschrieben hat.
 * @author andreas@siglochconsulting
 */
import { readFileSync, existsSync } from 'node:fs';

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
  const letzteIds = new Map(); // tool_use_id → Name, um Ergebnisse zuzuordnen

  for (const e of zeilen(pfad)) {
    if (e.type === 'assistant' && e.message) {
      const u = e.message.usage ?? {};
      const rufe = (e.message.content ?? [])
        .filter((c) => c.type === 'tool_use')
        .map((c) => { letzteIds.set(c.id, c.name); return c.name; });
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
          nachErgebnisVon: offen,
        });
        reihenfolge.push(id);
        offen = [];
      } else {
        // Dasselbe Ereignis, weiterer Content-Block: Verbrauch NICHT addieren.
        vorhanden.verbrauch.input = Math.max(vorhanden.verbrauch.input, u.input_tokens ?? 0);
        vorhanden.verbrauch.cacheRead = Math.max(vorhanden.verbrauch.cacheRead, u.cache_read_input_tokens ?? 0);
        vorhanden.verbrauch.cacheCreate = Math.max(vorhanden.verbrauch.cacheCreate, u.cache_creation_input_tokens ?? 0);
        for (const r of rufe) if (!vorhanden.ruft.includes(r)) vorhanden.ruft.push(r);
      }
    }
    if (e.type === 'user' && e.message) {
      for (const c of e.message.content ?? []) {
        if (c.type === 'tool_result') offen.push(letzteIds.get(c.tool_use_id) ?? 'unbekannt');
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
