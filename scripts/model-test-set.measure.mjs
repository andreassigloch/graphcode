#!/usr/bin/env node
/**
 * `npm run verify:model:messen` (CR-GC-1034) — misst, welche Testdatei eine Datei der Modell-Spur
 * liest, und schreibt `model-test-set.json`.
 *
 * Je Testdatei ein eigener vitest-Lauf mit dem Lese-Protokoll (`model-test-set.trace.cjs`) in jedem
 * Node-Prozess. Ohne Argument misst es nur, was fehlt oder sich geändert hat (Fingerabdruck), und
 * streicht Einträge gelöschter Dateien — nach einem neuen Test sind das Sekunden. `--alle` misst
 * alles neu (~12 min); nötig, wenn sich `isModelLanePath` ändert. Ein roter Test bricht ab: was er
 * gelesen hätte, ist unbekannt, und eine unvollständige Messung würde ihn still aus der Spur nehmen.
 *
 * @author andreas@siglochconsulting
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MEASUREMENT, MEASUREMENT_FILE, hashOf, isModelLanePath } from './model-test-set.mjs';

const REPO = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const TRACER = fileURLToPath(new URL('./model-test-set.trace.cjs', import.meta.url));
const alle = process.argv.includes('--alle');

const files = readdirSync(join(REPO, 'tests'))
  .filter((f) => f.endsWith('.test.ts'))
  .map((f) => `tests/${f}`)
  .sort();
const old = MEASUREMENT.dateien;
const hashes = Object.fromEntries(files.map((f) => [f, hashOf(readFileSync(join(REPO, f), 'utf8'))]));
// Wer die Messung selbst liest (der Vollständigkeits-Test), läuft zuletzt — vorher wäre sie unvollständig.
const liestMessung = (f) => readFileSync(join(REPO, f), 'utf8').includes('model-test-set.mjs');
const todo = files
  .filter((f) => alle || old[f]?.hash !== hashes[f])
  .sort((a, b) => Number(liestMessung(a)) - Number(liestMessung(b)) || a.localeCompare(b));

/** Mehr als 20 gelesene Dateien in einem Verzeichnis werden zu `verzeichnis/*` — Beleg, kein Inventar. */
function verdichte(paths) {
  const perDir = new Map();
  for (const p of paths) {
    const dir = p.slice(0, p.lastIndexOf('/') + 1);
    perDir.set(dir, [...(perDir.get(dir) ?? []), p]);
  }
  return [...perDir.entries()].flatMap(([dir, ps]) => (ps.length > 20 ? [`${dir}* (${ps.length} Dateien)`] : ps)).sort();
}

const dateien = Object.fromEntries(files.filter((f) => !todo.includes(f)).map((f) => [f, old[f]]));
const write = () => {
  const sorted = Object.fromEntries(Object.keys(dateien).sort().map((f) => [f, dateien[f]]));
  const doc = {
    hinweis: 'Erzeugt von scripts/model-test-set.measure.mjs (CR-GC-1034). Nicht von Hand ändern.',
    dateien: sorted,
  };
  writeFileSync(MEASUREMENT_FILE, JSON.stringify(doc, null, 2) + '\n');
};

console.error(`[verify:model:messen] ${todo.length} von ${files.length} Testdateien zu messen.`);
const tmp = mkdtempSync(join(tmpdir(), 'gc-spur-'));
try {
  for (const [i, f] of todo.entries()) {
    const out = join(tmp, `${i}.reads`);
    writeFileSync(out, '');
    // Vorläufiger Eintrag: der Vollständigkeits-Test sieht sich selbst schon als gemessen.
    dateien[f] = { hash: hashes[f], liest: [] };
    write();
    const r = spawnSync(join(REPO, 'node_modules', '.bin', 'vitest'), ['run', f], {
      cwd: REPO,
      encoding: 'utf8',
      env: {
        ...process.env,
        TRACE_REPO: REPO,
        TRACE_OUT: out,
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --require ${TRACER}`.trim(),
      },
    });
    if (r.status !== 0) {
      // Der vorläufige Eintrag fällt: stünde er mit leerer Liste da, wäre der Test still aus der Spur.
      delete dateien[f];
      write();
      console.error(r.stdout.slice(-2000) + r.stderr.slice(-2000));
      console.error(`[verify:model:messen] ${f} ist rot — Messung abgebrochen, bisherige Einträge gespeichert.`);
      process.exit(1);
    }
    const liest = verdichte([...new Set(readFileSync(out, 'utf8').split('\n').filter((p) => p && isModelLanePath(p)))]);
    dateien[f] = { hash: hashes[f], liest };
    console.error(`[verify:model:messen] ${i + 1}/${todo.length} ${f}: ${liest.length ? liest.length + ' Spur-Dateien' : '-'}`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
write();
