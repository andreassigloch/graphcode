#!/usr/bin/env node
/**
 * `npm run verify:model` (CR-GC-399) — die Testmenge einer Modelländerung fahren,
 * statt der vollen Suite.
 *
 * Die Menge kommt aus `model-test-set.mjs`: gemessene Leser von Modell, Sichten, CRs und
 * Markdown (CR-GC-1034). `tests/verify-model.completeness.test.ts` haelt die Messung aktuell.
 *
 * @author andreas@siglochconsulting
 */
import { spawnSync } from 'node:child_process';
import { INCLUDED, AUSNAHMEN, FILE_PARALLELISM } from './model-test-set.mjs';

console.error(`[verify:model] ${INCLUDED.length} Testdateien (Modell-Spur, gemessen).`);
// Kein stiller Deckel: was trotz Lesezugriff NICHT läuft, steht mit Grund im Log (CR-GC-399).
for (const [f, grund] of Object.entries(AUSNAHMEN)) console.error(`[verify:model] ausgenommen: ${f} — ${grund}`);

const args = ['vitest', 'run', `--fileParallelism=${FILE_PARALLELISM}`, ...INCLUDED];
const res = spawnSync('npx', args, { stdio: 'inherit' });
process.exit(res.status ?? 1);
