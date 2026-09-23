#!/usr/bin/env node
/**
 * gegenprobe.mjs — was der Graph geantwortet HAETTE (CR-GC-633).
 *
 * Die Messung in `messen.mjs` sagt, was ein Agent getan hat. Diese Gegenprobe sagt, was er
 * stattdessen haette fragen koennen — gegen den Stand VOR dem Change, damit die Antwort die
 * ist, die er bekommen haette, nicht die von heute.
 *
 * Positivkontrolle statt Behauptung: beide Antworten kommen aus den Routinen, die die
 * Werkzeuge selbst fahren (`selectForChange` hinter `graph_tests`/`verify:code`), bzw. direkt
 * aus dem committeten Schnappschuss.
 *
 * @author andreas@siglochconsulting
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const VORHER = process.argv[2] ?? 'd1285ef';
const DATEI = process.argv[3] ?? 'src/projections/codec.ts';
const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const gitShow = (ref, pfad) => execFileSync('git', ['show', `${ref}:${pfad}`], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

console.log(`Stand vor dem Change: ${VORHER}   betroffene Datei: ${DATEI}\n`);

// --- 1. graph_tests: welche Tests haette die Auswahl genannt? ---------------
const { buildContext, selectForChange } = await import(join(REPO, 'dist/projections/test-selection-audit.js'));
const tmp = mkdtempSync(join(tmpdir(), 'referenz-change-'));
try {
  // Der Schnappschuss von DAMALS, nicht der von heute — sonst misst die Gegenprobe den
  // Zustand, den der Change erst hergestellt hat.
  const altSnap = join(tmp, 'vorher.graph.json');
  writeFileSync(altSnap, gitShow(VORHER, 'docs/graph/graphcode.graph.json'));
  const ctx = buildContext(REPO, altSnap);
  const r = selectForChange([DATEI], ctx);
  console.log('FRAGE  "Welche Tests muss ich fuer diese Aenderung fahren?"  →  graph_tests');
  if (r.graphOnly.length === 0) {
    console.log(`  kein Knoten bindet ${DATEI} im Schnappschuss ${VORHER}`);
  } else {
    for (const f of r.graphOnly) console.log(`  ${f}`);
    console.log(`  Bindung ${r.binding.bound}/${r.binding.sources}, vollstaendig: ${r.complete}`);
    console.log(`  → ${r.graphOnly.length} Dateien statt ${ctx.allTests.length}.`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// --- 2. graph_impact: was hing am Modell? -----------------------------------
const snap = JSON.parse(gitShow(VORHER, 'docs/graph/graphcode.graph.json'));
const anDerDatei = snap.elements.filter((e) => JSON.stringify(e).includes(DATEI)).map((e) => e.id);

console.log('\nFRAGE  "Was bricht, wenn diese Datei faellt?"  →  graph_impact');
if (anDerDatei.length === 0) {
  console.log(`  kein Knoten im Schnappschuss ${VORHER} bindet ${DATEI}`);
} else {
  for (const id of anDerDatei) {
    const raus = snap.traces.filter((t) => t.source === id);
    const rein = snap.traces.filter((t) => t.target === id);
    console.log(`  ${id}  (${raus.length} ausgehend, ${rein.length} eingehend)`);
    for (const t of raus) console.log(`      ${id} -${t.type}-> ${t.target}`);
    for (const t of rein) console.log(`      ${t.source} -${t.type}-> ${id}`);
  }
  console.log('\n  Jede satisfy-Kante hier ist eine REQ, die nach dem Loeschen unerfuellt dasteht,');
  console.log('  und jeder realRef ist ein RC-01, das die VOLL-Spur erst nach ~5 Minuten meldet.');
}
