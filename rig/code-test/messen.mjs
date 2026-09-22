#!/usr/bin/env node
/**
 * messen.mjs — die Auswertung des Code-Tests (CR-GC-610). Je Arbeitsbereich fuenf Blöcke, fuer beide
 * Arme mit DENSELBEN Werkzeugen gemessen:
 *
 *   1. Funktion     — verdeckte Abnahme (abnahme/*.test.ts) ueber den Vertrag: bestanden / gesamt.
 *   2. Eigene Tests — `vitest run` im Arbeitsbereich: Dateien, Tests, gruen.
 *   3. Code         — direkt am Quelltext (src/, ohne Tests): Dateien, Zeilen, groesste Datei, Exporte,
 *                     relative Importe, Importzyklen, Verzeichnisse als Module.
 *   4. Architektur  — `graphcode import-code` auf einer KOPIE des Codes (beide Arme gleich, deterministisch,
 *                     ohne LLM) → MOD/FUNC/FLOW/SCHEMA und der Steuerwert (RD-04, BW-02, R-04, CR-01, MT-02).
 *   5. Kongruenz    — nur wo ein Modell gefuehrt wurde: RC-Urteil und Bindungsquote am Modell des Arms.
 * Dazu die Effizienz aus usage.json. Schreibt <arbeitsbereich>/messung.json und druckt die Vergleichstabelle.
 *
 * Aufruf (von graphcode/): node rig/code-test/messen.mjs ~/.graphcode-code-test/runs/gefuehrt-0 ~/.graphcode-code-test/runs/frei-0
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import { codeVerdict } from '../greenfield-systemtest/metrics.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const GC_ROOT = resolve(HERE, '..', '..');
const CLI = join(GC_ROOT, 'dist', 'cli.js');

const istTest = (p) => /(^|\/)(tests?|__tests__)\//.test(p) || /\.(test|spec)\.ts$/.test(p);
/** Unveraenderte Stubs, die graphcode aus Bindungen erzeugt (TEST: CR-GC-205, SCHEMA: BOK-CR-026) — nicht die Arbeit des Arms. */
const istStub = (inhalt) => /GENERATED STUB \((CR-GC-205|BOK-CR-026)\)/.test(inhalt);

/** Alle .ts unter dir (ohne node_modules), relativ. */
function tsDateien(dir, basis = dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (n === 'node_modules' || n.startsWith('.')) return [];
    return statSync(p).isDirectory() ? tsDateien(p, basis) : n.endsWith('.ts') ? [relative(basis, p)] : [];
  });
}

/** Rein: Kennzahlen des Quelltexts aus {pfad: inhalt}. Importe relativ, Zyklen per Tiefensuche. */
export function codeKennzahlen(dateien) {
  const pfade = Object.keys(dateien).filter((p) => !istTest(p) && !istStub(dateien[p]));
  const zeilen = (t) => t.split('\n').filter((z) => z.trim() && !z.trim().startsWith('//') && !z.trim().startsWith('*')).length;
  const kanten = new Map();
  let exporte = 0;
  for (const p of pfade) {
    const t = dateien[p];
    exporte += (t.match(/^export\s+(?:const|function|class|type|interface|async function|default)/gm) ?? []).length;
    const ziele = [...t.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)]
      .map((m) => join(dirname(p), m[1]).replace(/\.js$/, '.ts'))
      .filter((z) => pfade.includes(z));
    kanten.set(p, ziele);
  }
  const zyklen = new Set();
  const besuche = (p, stapel) => {
    for (const z of kanten.get(p) ?? []) {
      const i = stapel.indexOf(z);
      if (i >= 0) zyklen.add([...stapel.slice(i)].sort().join(' → '));
      else if (stapel.length < 50) besuche(z, [...stapel, z]);
    }
  };
  for (const p of pfade) besuche(p, [p]);
  const loc = pfade.map((p) => zeilen(dateien[p]));
  return {
    dateien: pfade.length,
    zeilen: loc.reduce((a, b) => a + b, 0),
    groessteDatei: Math.max(0, ...loc),
    exporte,
    importe: [...kanten.values()].reduce((a, z) => a + z.length, 0),
    importzyklen: zyklen.size,
    module: new Set(pfade.map((p) => dirname(p))).size,
  };
}

function vitestJson(cwd, args, env = {}) {
  const out = join(mkdtempSync(join(tmpdir(), 'vt-')), 'r.json');
  spawnSync('npx', ['vitest', 'run', ...args, '--reporter=json', `--outputFile=${out}`], { cwd, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 600_000 });
  if (!existsSync(out)) return null;
  const j = JSON.parse(readFileSync(out, 'utf8'));
  return { dateien: j.numTotalTestSuites ?? j.testResults?.length ?? 0, tests: j.numTotalTests, gruen: j.numPassedTests, offen: (j.numPendingTests ?? 0) + (j.numTodoTests ?? 0) };
}

async function architektur(ws) {
  const kopie = mkdtempSync(join(tmpdir(), 'ct-import-'));
  for (const d of ['src', 'vertrag']) if (existsSync(join(ws, d))) cpSync(join(ws, d), join(kopie, d), { recursive: true });
  cpSync(join(ws, 'package.json'), join(kopie, 'package.json'));
  for (const p of tsDateien(join(kopie, 'src'))) if (istStub(readFileSync(join(kopie, 'src', p), 'utf8'))) rmSync(join(kopie, 'src', p));
  execFileSync('git', ['init', '-q'], { cwd: kopie });
  execFileSync('node', [CLI, 'init'], { cwd: kopie, stdio: 'pipe' });
  execFileSync('node', [CLI, 'import-code', '.'], { cwd: kopie, stdio: 'pipe', timeout: 300_000 });
  const { createHarness } = await import(join(GC_ROOT, 'dist', 'index.js'));
  const { generationStep } = await import(join(GC_ROOT, 'dist', 'loop', 'generate.js'));
  const h = await createHarness({ repoRoot: kopie, scope: { workspaceId: 'ct', systemId: 'ct' } });
  await h.initialize();
  try {
    const g = h.getGraph();
    const zahl = (t) => g.nodes.filter((n) => n.type === t).length;
    const steer = generationStep(g, h.getMetricPolicy(), undefined, 0.8, [], 'driver', null, 'kern').steer;
    return { MOD: zahl('MOD'), FUNC: zahl('FUNC'), FLOW: zahl('FLOW'), SCHEMA: zahl('SCHEMA'), steuerwert: Number((steer?.sum ?? 0).toFixed(3)), terme: steer?.terms ?? [] };
  } finally {
    await h.close();
    rmSync(kopie, { recursive: true, force: true });
  }
}

async function kongruenz(ws) {
  if (!existsSync(join(ws, '.graphcode'))) return null;
  const { createHarness, bindToolsToHarness } = await import(join(GC_ROOT, 'dist', 'index.js'));
  const label = ws.split('/').pop();
  const h = await createHarness({ repoRoot: ws, scope: { workspaceId: label, systemId: label } });
  await h.initialize();
  try {
    const reg = bindToolsToHarness(h);
    const r = await reg['graph_readiness'].handler({});
    const exp = await reg['graph_export'].handler({ force: false }).catch(() => null);
    const graphPfad = join(ws, 'docs', 'graph', `${label}.graph.json`);
    const graph = JSON.parse(readFileSync(graphPfad, 'utf8'));
    const v = codeVerdict(r, graph);
    return { urteil: v.verdict, bindung: v.binding ?? v.bind ?? null, rc: Object.fromEntries(Object.entries(r.violationsByRule ?? {}).filter(([k]) => k.startsWith('RC-'))), export: !!exp };
  } finally {
    await h.close();
  }
}

export async function messe(ws) {
  const dateien = Object.fromEntries(tsDateien(join(ws, 'src')).map((p) => [p, readFileSync(join(ws, 'src', p), 'utf8')]));
  const m = {
    arm: ws.split('/').pop(),
    funktion: vitestJson(GC_ROOT, ['--config', join(HERE, 'vitest.config.ts')], { IMPL: ws }),
    eigeneTests: vitestJson(ws, []),
    code: codeKennzahlen(dateien),
    architektur: await architektur(ws),
    kongruenz: await kongruenz(ws),
    effizienz: existsSync(join(ws, 'usage.json')) ? JSON.parse(readFileSync(join(ws, 'usage.json'), 'utf8')) : null,
  };
  writeFileSync(join(ws, 'messung.json'), JSON.stringify(m, null, 2) + '\n');
  return m;
}

export function vergleich(ms) {
  const zeile = (name, f) => `| ${name} | ${ms.map((m) => { try { return f(m) ?? '—'; } catch { return '—'; } }).join(' | ')} |`;
  return [
    `| | ${ms.map((m) => m.arm).join(' | ')} |`,
    `|---|${ms.map(() => '---:').join('|')}|`,
    zeile('Abnahme bestanden', (m) => (m.funktion?.tests ? `${m.funktion.gruen}/${m.funktion.tests}` : 'laedt nicht')),
    zeile('eigene Tests gruen (todo)', (m) => `${m.eigeneTests.gruen}/${m.eigeneTests.tests}${m.eigeneTests.offen ? ` (${m.eigeneTests.offen} todo)` : ''}`),
    zeile('Dateien / Module (src)', (m) => `${m.code.dateien} / ${m.code.module}`),
    zeile('Zeilen / groesste Datei', (m) => `${m.code.zeilen} / ${m.code.groessteDatei}`),
    zeile('Exporte / relative Importe', (m) => `${m.code.exporte} / ${m.code.importe}`),
    zeile('Importzyklen', (m) => m.code.importzyklen),
    zeile('import-code: MOD / FUNC / FLOW / SCHEMA', (m) => `${m.architektur.MOD} / ${m.architektur.FUNC} / ${m.architektur.FLOW} / ${m.architektur.SCHEMA}`),
    zeile('Steuerwert des Codes', (m) => m.architektur.steuerwert),
    zeile('Kongruenz (RC)', (m) => m.kongruenz?.urteil ?? 'kein Modell'),
    zeile('Kosten $ / Turns / Sekunden', (m) => m.effizienz ? `${m.effizienz.cost_usd} / ${m.effizienz.turns} / ${m.effizienz.wall_s}` : null),
  ].join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const ws = process.argv.slice(2).map((p) => resolve(p));
  if (!ws.length) { console.error('Aufruf: node rig/code-test/messen.mjs <arbeitsbereich> …'); process.exit(2); }
  const ms = [];
  for (const w of ws) ms.push(await messe(w));
  console.log(vergleich(ms));
}
