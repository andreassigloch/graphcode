/**
 * TEST-aenderungs-heatmap (CR-GC-1028, CR-GC-1029) — Änderungs-Hotspots aus echter git-Historie.
 *
 * Baut ein Wegwerf-Repo mit acht datierten Commits und prüft die Rechnung von
 * scripts/aenderungs-heatmap.mjs: Symbol je Zeile, Teilsymbol in einer Funktion, Nacharbeit nur
 * durch einen anderen Auftrag (CR, sonst ITEM) binnen der Frist, Commits ohne Auftrag,
 * Umbenennung auf den heutigen Pfad, Mitänderung je Auftrag, Pareto.
 * Echte git-Operationen, keine Mocks.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyse, symbolName, MODULEBENE } from '../scripts/aenderungs-heatmap.mjs';

const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
let dir = '';
const git = (args: string[], date?: string) =>
  execFileSync('git', ['-C', dir, ...args], {
    env: { ...env, ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}) },
  }).toString();
const write = (path: string, text: string) => {
  mkdirSync(join(dir, path, '..'), { recursive: true });
  writeFileSync(join(dir, path), text);
};
const commit = (subject: string, date: string) => { git(['add', '-A']); git(['commit', '-q', '-m', subject], date); };

const X = (word: string, list: string[]) =>
  `export function alpha() {\n  return '${word}';\n}\n\nexport const LISTE = [\n${list.map((e) => `  '${e}',`).join('\n')}\n];\n`;
const Y = (word: string) => `export function beta() {\n  return '${word}';\n}\n`;
const W = (eins: string, zwei: string) =>
  `export function bindTools() {\n  const t_eins: MCPTool<X> = {\n    description: '${eins}',\n  };\n` +
  `  const t_zwei: MCPTool<X> = {\n    description: '${zwei}',\n  };\n  return [t_eins, t_zwei];\n}\n`;
const TEIL = '^  const ([A-Za-z0-9_$]+): MCPTool<';

const cfg = {
  monate: 6, nachfassTage: 14, paretoTop: 10, kopplungTop: 16,
  endungen: ['.ts'], ausschluss: '(^|/)tests?/', teilsymbole: [TEIL],
  repos: [{ name: 'R', pfad: '', graph: 'docs/graph/r.graph.json', quellen: ['src/'], einheiten: {}, tiefe: 2 }],
};
let data: any;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'heatmap-test-'));
  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.email', 'test@example.invalid']);
  git(['config', 'user.name', 'Test']);
  write('src/a/x.ts', X('eins', ['eintrag-a']));
  write('src/b/y.ts', Y('basis'));
  commit('feat: anlegen (CR-XX-1)', '2026-10-01T10:00:00Z');
  write('src/a/x.ts', X('zwei', ['eintrag-a', 'eintrag-b']));
  write('src/b/y.ts', Y('zweite'));
  commit('feat: erweitern (CR-XX-2)', '2026-10-03T10:00:00Z');
  write('src/b/y.ts', Y('dritte'));
  commit('fix: nachbessern (CR-XX-2)', '2026-10-05T10:00:00Z');
  git(['mv', 'src/b/y.ts', 'src/b/z.ts']);
  commit('refactor: umbenennen (CR-XX-3)', '2026-10-06T10:00:00Z');
  write('src/a/x.ts', X('vier', ['eintrag-a', 'eintrag-b']));
  commit('feat: spaet (CR-XX-4)', '2026-11-20T10:00:00Z');
  write('src/c/tools.ts', W('alt-eins', 'alt-zwei'));
  commit('feat: werkzeuge (ITEM-2026-7)', '2026-11-21T10:00:00Z');
  write('src/c/tools.ts', W('neu-eins', 'alt-zwei'));
  commit('fix: eins nachbessern (CR-XX-5)', '2026-11-22T10:00:00Z');
  write('src/c/tools.ts', W('neu-eins', 'neu-zwei'));
  commit('chore: paket 1.0.1', '2026-11-23T10:00:00Z');
  data = analyse({ ...cfg, repos: [{ ...cfg.repos[0], pfad: dir }] }, dir, new Date('2026-11-25T00:00:00Z'));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const unit = (k: string) => data.units.find((u: any) => u.key === `R:${k}`);
const sym = (k: string) => data.pareto.find((s: any) => s.key === `R:${k}`);

describe('aenderungs-heatmap', () => {
  it('erkennt Definitionen auf oberster Ebene, nicht eingerückte', () => {
    expect(symbolName('export async function alpha(x) {')).toBe('alpha');
    expect(symbolName('export const LISTE = [')).toBe('LISTE');
    expect(symbolName('export interface Opts {')).toBe('Opts');
    expect(symbolName('  const inner = () => 1;')).toBeNull();
    expect(symbolName("import { a } from './a';")).toBeNull();
  });

  it('erkennt ein Teilsymbol nur mit konfiguriertem Muster', () => {
    expect(symbolName('  const t_eins: MCPTool<X> = {')).toBeNull();
    expect(symbolName('  const t_eins: MCPTool<X> = {', [new RegExp(TEIL)])).toBe('t_eins');
    expect(symbolName('export function bindTools() {', [new RegExp(TEIL)])).toBe('bindTools');
  });

  it('zählt Änderungen, fix: und Aufträge je Einheit', () => {
    expect(unit('src/a')).toMatchObject({ changes: 3, fix: 0, auftraege: 3 });
    expect(unit('src/b')).toMatchObject({ changes: 4, fix: 1, auftraege: 3 });
  });

  it('ordnet Zeilen dem Teilsymbol zu; ITEM ist Auftrag, ein Commit ohne Nummer nicht', () => {
    // CR-XX-5 schreibt die Zeile von ITEM-2026-7 in t_eins nach 1 Tag um → Nacharbeit 1.
    // Der Commit ohne Nummer ändert t_zwei, trägt keinen Auftrag → keine Nacharbeit.
    expect(sym('src/c/tools.ts#t_eins')).toMatchObject({ changes: 2, reworked: 1 });
    expect(sym('src/c/tools.ts#t_zwei')).toMatchObject({ changes: 2, reworked: 0 });
    expect(unit('src/c')).toMatchObject({ changes: 3, auftraege: 2 });
    expect(data.grenzen).toMatchObject({ ohneAuftrag: 1, item: 1 });
  });

  it('Nacharbeit: anderer CR binnen 14 Tagen zählt, derselbe CR und spätere Änderungen nicht', () => {
    // CR-XX-2 schreibt 'eins' (alpha) und 'basis' (beta) von CR-XX-1 nach 2 Tagen um → je 1 Zeile.
    // Der fix in CR-XX-2 ändert die eigene Zeile → zählt nicht. CR-XX-4 kommt nach 48 Tagen → zählt nicht.
    expect(unit('src/a').reworked).toBe(1);
    expect(unit('src/b').reworked).toBe(1);
  });

  it('zieht die Umbenennung auf den heutigen Pfad und ordnet Zeilen dem Symbol je Zeile zu', () => {
    expect(sym('src/b/z.ts#beta')).toMatchObject({ changes: 3, reworked: 1 });
    expect(sym('src/a/x.ts#alpha')).toMatchObject({ changes: 3, reworked: 1 });
    expect(sym('src/a/x.ts#LISTE')).toMatchObject({ changes: 2, reworked: 0 });
    expect(data.pareto.some((s: any) => s.symbol === MODULEBENE)).toBe(false);
    expect(data.pareto[0].changes).toBe(3);
    expect(data.pareto[data.pareto.length - 1].kumAnteil).toBe(1);
  });

  it('Mitänderung: ein CR über zwei Einheiten zählt als geteilt', () => {
    const i = data.matrix.units.indexOf('R:src/a'), j = data.matrix.units.indexOf('R:src/b');
    expect(data.matrix.cells[i][j]).toBe(2); // CR-XX-1 und CR-XX-2 ändern beide
    expect(unit('src/a')).toMatchObject({ gruppen: 3, mit: 2, partner: 1 }); // CR-XX-4 nur src/a
    expect(unit('src/b')).toMatchObject({ gruppen: 3, mit: 2 }); // CR-XX-3 nur src/b
  });
});
