/**
 * TEST-commit-check (CR-GC-848) — der pre-commit-Hook bricht einen Commit ab, dessen Code dem Modell widerspricht.
 *
 * Ein Wegwerf-Repo mit echtem TypeScript-Quellbaum und eigenem Snapshot; `core.hooksPath` zeigt auf den ECHTEN
 * Hook dieses Repos, committet wird mit echtem `git commit`. Drei FUNCs in `src/a.ts`: `anfrage` ruft `ziel`
 * (synchroner FLOW-x dahinter), `allein` ruft niemand. Je Fall erst der Commit ohne Modellzug (Abbruch), dann
 * derselbe Commit mit dem Zug im Snapshot (geht durch):
 *
 *   RC-13  `anfrage` ruft zusätzlich `allein`, kein FLOW dazwischen
 *   RC-12  `anfrage` ruft `ziel` nicht mehr, FLOW-x ist sync
 *   RC-01  `allein` heißt jetzt `alleinNeu`, die `realRef` steht noch auf `allein`
 *   docs   ein Commit nur mit docs/ — die Prüfung läuft nicht
 *
 * `VERIFY_MODEL_CMD=true` ersetzt nur den 45-s-Lauf der Modell-Spur (CR-GC-535), die Prüfung selbst ist echt.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HOOKS = join(process.cwd(), 'scripts', 'githooks');
const SNAPSHOT = join('docs', 'graph', 'wegwerf.graph.json');

interface El {
  id: string;
  type: string;
  name: string;
  description: string;
  [k: string]: unknown;
}
interface Tr {
  source: string;
  target: string;
  type: string;
}

const func = (sym: string): El => ({
  id: `FUNC-${sym}`,
  type: 'FUNC',
  name: sym,
  description: `Funktion ${sym}`,
  realRef: { file: 'src/a.ts', symbol: sym, lang: 'ts' },
});
const flow = (id: string, from: string, to: string): { el: El; tr: Tr[] } => ({
  el: { id, type: 'FLOW', name: id, description: `Fluss ${id}`, sync: 'sync' },
  tr: [
    { source: from, target: id, type: 'io' },
    { source: id, target: to, type: 'io' },
  ],
});

const quelle = (anfrage: string, alleinName = 'allein'): string =>
  `export function anfrage(): void { ${anfrage} }\nexport function ziel(): void {}\nexport function ${alleinName}(): void {}\n`;

let repo: string;
const model = { elements: [] as El[], traces: [] as Tr[] };

function write(rel: string, body: string): void {
  mkdirSync(join(repo, rel, '..'), { recursive: true });
  writeFileSync(join(repo, rel), body);
}
function writeSnapshot(): void {
  write(SNAPSHOT, JSON.stringify({ elements: model.elements, traces: model.traces, graphVersion: 1 }, null, 2) + '\n');
}
function commit(...paths: string[]): { status: number; stderr: string } {
  execFileSync('git', ['add', ...paths], { cwd: repo });
  const r = spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'x'], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, VERIFY_MODEL_CMD: 'true' },
  });
  return { status: r.status ?? -1, stderr: r.stderr };
}

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), 'commit-pruefung-'));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'core.hooksPath', HOOKS], { cwd: repo });
  write('tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ES2020', module: 'ES2020', strict: true }, include: ['src/**/*'] }));
  write('src/a.ts', quelle('ziel();'));
  const x = flow('FLOW-x', 'FUNC-anfrage', 'FUNC-ziel');
  model.elements.push(func('anfrage'), func('ziel'), func('allein'), x.el);
  model.traces.push(...x.tr);
  writeSnapshot();
});

afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe('TEST-commit-check (CR-GC-848): Commit-Prüfung Fluss gegen Aufruf am Wegwerf-Repo', () => {
  it('Ausgangsstand: Modell und Code passen — der erste Commit mit .ts geht durch, die Prüfung lief', () => {
    const r = commit('-A');
    expect(r.status, r.stderr).toBe(0);
    expect(r.stderr).toMatch(/\[commit-pruefung\] RC-01\/RC-12\/RC-13: 0 Befunde an 1 gestagten/);
  }, 60_000);

  it('RC-13: ein neuer Aufruf zwischen zwei verankerten FUNCs ohne FLOW bricht ab und nennt das Paar', () => {
    write('src/a.ts', quelle('ziel(); allein();'));
    const r = commit('src/a.ts');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('BLOCKED (CR-GC-848)');
    expect(r.stderr).toContain('RC-13  FUNC-anfrage → FUNC-allein');
    expect(r.stderr).toContain('Weg im Code: src/a.ts#anfrage → src/a.ts#allein');

    const y = flow('FLOW-y', 'FUNC-anfrage', 'FUNC-allein');
    model.elements.push(y.el);
    model.traces.push(...y.tr);
    writeSnapshot();
    const mitZug = commit('src/a.ts', SNAPSHOT);
    expect(mitZug.status, mitZug.stderr).toBe(0);
  }, 60_000);

  it('RC-12: der Aufruf hinter einem synchronen FLOW fällt weg — Abbruch nennt RC-12 und das Paar', () => {
    write('src/a.ts', quelle('allein();'));
    const r = commit('src/a.ts');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('RC-12  FLOW-x: FUNC-anfrage → FUNC-ziel');
    expect(r.stderr).toContain('keiner zwischen src/a.ts#anfrage und src/a.ts#ziel');

    model.elements = model.elements.filter((e) => e.id !== 'FLOW-x');
    model.traces = model.traces.filter((t) => t.source !== 'FLOW-x' && t.target !== 'FLOW-x');
    writeSnapshot();
    const mitZug = commit('src/a.ts', SNAPSHOT);
    expect(mitZug.status, mitZug.stderr).toBe(0);
  }, 60_000);

  it('RC-01: ein verankertes Symbol umbenannt, realRef nicht nachgezogen — Abbruch nennt update-node mit dem neuen Symbol', () => {
    write('src/a.ts', quelle('alleinNeu();', 'alleinNeu'));
    const r = commit('src/a.ts');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('RC-01  FUNC-allein: allein ist in src/a.ts nicht deklariert');
    expect(r.stderr).toContain('Zug (update-node): ~ FUNC-allein');
    expect(r.stderr).toContain('@realRef {"file":"src/a.ts","symbol":"alleinNeu","lang":"ts"}');

    model.elements = model.elements.map((e) => (e.id === 'FUNC-allein' ? { ...e, realRef: { file: 'src/a.ts', symbol: 'alleinNeu', lang: 'ts' } } : e));
    writeSnapshot();
    const mitZug = commit('src/a.ts', SNAPSHOT);
    expect(mitZug.status, mitZug.stderr).toBe(0);
  }, 60_000);

  it('ein Commit nur mit docs/ — die Prüfung läuft nicht', () => {
    write('docs/notiz.md', '# Notiz\n');
    const r = commit('docs/notiz.md');
    expect(r.status, r.stderr).toBe(0);
    expect(r.stderr).not.toContain('[commit-pruefung]');
    expect(r.stderr).toContain('Spur: MODELL');
  }, 60_000);
});
