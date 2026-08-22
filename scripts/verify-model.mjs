#!/usr/bin/env node
/**
 * `npm run verify:model` (CR-GC-399) — die Testmenge einer Modelländerung fahren,
 * statt der vollen Suite. Ein Wort statt sieben Minuten.
 *
 * Die Menge kommt aus `model-test-set.mjs` und wird von
 * `tests/verify-model.completeness.test.ts` gegen `tests/` abgeglichen — sie kann
 * nicht veralten, ohne dass ein Test rot wird.
 *
 * @author andreas@siglochconsulting
 */
import { spawnSync } from 'node:child_process';
import { INCLUDED, EXCLUDED, FILE_PARALLELISM } from './model-test-set.mjs';

const skipped = Object.keys(EXCLUDED);
console.error(`[verify:model] ${INCLUDED.length} Testdateien (Modell-Spur).`);
// Kein stiller Deckel: was NICHT läuft, steht mit Grund im Log (CR-GC-399).
for (const f of skipped) console.error(`[verify:model] ausgelassen: ${f} — ${EXCLUDED[f]}`);

const args = ['vitest', 'run', `--fileParallelism=${FILE_PARALLELISM}`, ...INCLUDED];
const res = spawnSync('npx', args, { stdio: 'inherit' });
process.exit(res.status ?? 1);
