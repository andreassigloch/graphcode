#!/usr/bin/env node
/**
 * `npm run verify:code` (CR-GC-541) — die dritte Spur: die Testmenge einer CODE-Änderung
 * fahren statt der vollen Suite.
 *
 * Anlass, gemessen am Zug 2026-09-16: `graph_tests` nannte für alle vier Changesets
 * bitgenau die Dateien, die im jeweiligen CR von Hand als Testmenge standen — gefahren
 * wurde trotzdem achtmal `npm test` (141 Dateien, ~280 s), rund 40 Minuten Wanduhr.
 *
 * Die Ableitung `code → REQ → TEST` (plus der Vertragspfad FUNC → FLOW → SCHEMA → TEST)
 * kommt aus `impactedTests()`, derselben Funktion, die `graph_tests` benutzt — kein
 * zweiter Pfad. Quelle ist der COMMITTETE Snapshot, nie der Kuzu-Store: der MCP-Server
 * besitzt das einzige Handle (REQ-single-kuzu-owner).
 *
 * Die Honigfalle und ihre zwei Riegel: eine abgeleitete Menge ist nur so gut wie die
 * Bindung, aus der sie kommt. Deshalb (1) fällt jede nicht auflösbare Quelldatei — und
 * jede leere Auswahl — auf die VOLLE Spur zurück, nie auf `--passWithNoTests`, und (2)
 * stehen die Bindungsquote und jeder TEST ohne `testRefs` in der Ausgabe, nicht nur das
 * Urteil. Die volle Suite bleibt der Riegel vor Publish und in CI.
 *
 * Logik liegt in `src/projections/test-selection-audit.ts` (unit-getestet in
 * `tests/test-selection.audit.test.ts`); dieser Runner ist dünn und setzt einen aktuellen
 * Build voraus (`npm run build`).
 *
 * Usage: node scripts/verify-code.mjs [--plan] [--staged] [datei ...]
 *   --plan    nur ansagen, nichts fahren (der pre-commit-Hook benutzt das)
 *   --staged  ChangeSet = der gestagte Diff statt des Arbeitsbaums
 *
 * @author andreas@siglochconsulting
 */
import { spawnSync, execFileSync } from 'node:child_process';
import { buildContext, planCodeLane } from '../dist/projections/test-selection-audit.js';

const argv = process.argv.slice(2);
const plan = argv.includes('--plan');
const staged = argv.includes('--staged');
const explicit = argv.filter((a) => !a.startsWith('--'));

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const git = (args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });

/** Der ChangeSet: explizit genannt, sonst der gestagte Diff, sonst der ganze Arbeitsbaum. */
function changedFiles() {
  if (explicit.length > 0) return explicit;
  if (staged) return git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']).split('\n').filter(Boolean);
  // `status --porcelain` statt `diff HEAD`: eine NEUE, noch untrackte Quelldatei hat im
  // Modell keinen Knoten und muss den Volllauf auslösen — `diff` sähe sie gar nicht.
  return git(['status', '--porcelain'])
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).trim().split(' -> ').pop());
}

const files = changedFiles();
const result = planCodeLane(files, buildContext(repoRoot));
for (const line of result.lines) console.error(line);

if (result.command === null) {
  console.error(`[verify:code] -> nichts zu fahren.`);
  process.exit(0);
}
console.error(`[verify:code] -> ${result.command}`);
if (plan) process.exit(0);

// Seriell: die Parallelität der Modell-Spur ist dort per Test bewiesen (kein Test der
// Menge öffnet den Repo-Store). Für eine BELIEBIGE Auswahl gilt dieser Beweis nicht —
// Kuzu ist ein Schreiber pro Store, also fährt die CODE-Spur wie die volle Suite.
// VOLLE Spur = die ganze Suite, also ohne Dateiargumente; CODE-Spur = genau ihre Dateien.
const args = result.lane === 'VOLL' ? ['vitest', 'run'] : ['vitest', 'run', ...result.files];
const res = spawnSync('npx', args, { stdio: 'inherit', cwd: repoRoot });
process.exit(res.status ?? 1);
