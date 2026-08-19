// Modell-Tool-Calls aus den Arm-Trace-Logs auszählen — ein Aufruf, eine Tabelle.
//
//   node rig/minimal-whitebox/tally-toolcalls.mjs [verzeichnis ...]   (default: results/, rekursiv)
//
// Warum aus dem Trace: `modelUnfilteredCalls` in `run-armC.mjs` sitzt am
// Registry-Handler und sieht deshalb auch die executor-internen Preflight-
// Snapshots (`graph_elements({limit:100000})` je `runMutate`) und, im Modus
// `full`, den Injektions-Aufruf selbst. Der Executor tracet dagegen JEDEN
// Modell-Turn mit den Namen der emittierten Tool-Calls — das ist die exakte
// Quelle.
//
// DREI Label-Formen, alle drei zählen (src/executor.ts):
//   `  cand k/n.t: …`        collectCandidateBatch, candidates > 1   (Zeile 852)
//   `  repair cand k.t: …`   Repair-Pfad nach Gate-Reject            (Zeile 878/926)
//   `  R.T: …`               Ein-Kandidaten-Pfad (candidates = 1)    (Zeile ~1022)
// Wer nur die erste Form greppt, verliert die Repair-Turns; wer nur Form 1+3
// greppt, ebenfalls. Beides kommt im Bestand vor (qwen36/whitebox: 2 Repair-
// Turns, davon einer mit graph_mutate).
//
// VIERTE Quelle, bewusst mitgezählt: `    recovered text tool-call <name>`.
// Das Modell emittiert den Call als Prosa statt als strukturierten Tool-Call;
// der Executor erkennt ihn (`extractToolCallFromText`), FÜHRT IHN AUS und
// tracet diese Zeile. Der zugehörige Turn steht davor als `(no calls)`, es gibt
// also keine Doppelzählung. Weglassen wäre falsch — es sind echte, ausgeführte
// Lesezugriffe des Modells: devstral 19/14/3 (full/whitebox/off) gegen qwen 0/0/0.
// Sie stehen als eigene Spalte `textRec` und im JSON getrennt als
// `callsStructured` / `callsTextRecovered`, damit strukturierte und
// zurückgewonnene Calls unterscheidbar bleiben; die Tool-Spalten sind die Summe.
//
// NICHT erfasst (Executor tracet dafür keine Zeile): ein `graph_mutate`, das
// `extractMutateFromText` aus Prosa zurückgewinnt — dieser Pfad loggt nichts.
// Die mutate-Spalte ist deshalb eine Untergrenze; `stats.mutatesApplied` im
// Ergebnis-JSON ist die belastbare Zahl für angewandte Batches.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULTS = join(HERE, 'results');
const roots = process.argv.slice(2).map((d) => resolve(HERE, d));
if (roots.length === 0) roots.push(RESULTS);

const TURN = /^\s{2}(?:cand \d+\/\d+|repair cand \d+|\d+)\.\d+: (.+)$/;
const RECOVER = /recovered text tool-call (\S+)/;

/** Spalten der Tabelle — die Trias EINZELN, dann die Breitleser, dann der Rest. */
const COLS = [
  'graph_context',
  'graph_impact',
  'graph_expand',
  'graph_elements',
  'graph_authoring_guide',
  'graph_get_node',
  'graph_readiness',
  'graph_mutate',
];

const walk = (dir, out = []) => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (n.endsWith('.run.log')) out.push(p);
  }
  return out;
};

const rows = [];
for (const root of roots) {
  for (const file of walk(root).sort()) {
    const structured = {};
    const textRec = {};
    const calls = {};
    let turns = 0;
    let recovered = 0;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = TURN.exec(line);
      if (m) {
        turns += 1;
        if (!m[1].startsWith('(')) {
          for (const raw of m[1].split(',')) {
            const n = raw.trim();
            if (/^[a-z_]+$/.test(n)) {
              structured[n] = (structured[n] ?? 0) + 1;
              calls[n] = (calls[n] ?? 0) + 1;
            }
          }
        }
      }
      const r = RECOVER.exec(line);
      if (r) {
        textRec[r[1]] = (textRec[r[1]] ?? 0) + 1;
        calls[r[1]] = (calls[r[1]] ?? 0) + 1;
        recovered += 1;
      }
    }
    // Lauf-Kennzahlen aus dem Ergebnis-JSON danebenstellen, falls vorhanden.
    let meta = {};
    try {
      const d = JSON.parse(readFileSync(file.replace('.run.log', '.result.json'), 'utf8'));
      meta = {
        elements: d.elements,
        traces: d.traces,
        REQ: d.byType?.REQ ?? 0,
        TEST: d.byType?.TEST ?? 0,
        wallMin: Math.round(d.wallSeconds / 60),
        modelTurns: d.stats?.modelTurns,
        applied: d.stats?.mutatesApplied,
        rejected: d.stats?.mutatesRejected,
      };
    } catch {
      meta = { note: 'kein result.json — Lauf unvollständig oder noch aktiv' };
    }
    rows.push({
      run: relative(RESULTS, file).replace('.run.log', ''),
      tracedTurns: turns,
      textRecovered: recovered,
      calls,
      callsStructured: structured,
      callsTextRecovered: textRec,
      meta,
    });
  }
}

const pad = (s, n) => String(s).padEnd(n);
const w = Math.max(20, ...rows.map((r) => r.run.length));
const head = [pad('run', w), pad('turns', 6), pad('textRec', 8), ...COLS.map((c) => pad(c.replace('graph_', ''), 15)), 'rest'];
console.log(head.join(' '));
console.log('-'.repeat(head.join(' ').length));
for (const r of rows) {
  const rest = Object.entries(r.calls).filter(([k]) => !COLS.includes(k));
  console.log(
    [
      pad(r.run, w),
      pad(r.tracedTurns, 6),
      pad(r.textRecovered, 8),
      ...COLS.map((c) => pad(r.calls[c] ?? 0, 15)),
      rest.length > 0 ? rest.map(([k, v]) => `${k}:${v}`).join(' ') : '-',
    ].join(' '),
  );
}
console.log('\nLauf-Kennzahlen:');
for (const r of rows) console.log(' ', pad(r.run, w), JSON.stringify(r.meta));

const target = join(RESULTS, 'armC-modeltoolcalls.json');
writeFileSync(target, JSON.stringify(Object.fromEntries(rows.map((r) => [r.run, r])), null, 2));
console.log('\n->', target);
