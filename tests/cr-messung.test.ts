/**
 * TEST-cr-messung (CR-GC-639) — KPI 1 wird nach jedem CR-Abschluss gemessen, ohne Zutun.
 *
 * Echt, nicht gestellt: ein Temp-Repo, in dem ein CR per `git mv` nach done/ wandert, und ein
 * Temp-Verzeichnis mit einem Claude-Code-Protokoll, das die CR-ID nennt. Gefahren wird der
 * Hook-Pfad selbst (`--commit HEAD`), nicht nur die Zaehlfunktion — die testet retro-kpi.test.ts.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { geschlosseneCrs } from '../scripts/cr-messung.mjs';

const SKRIPT = join(__dirname, '..', 'scripts', 'cr-messung.mjs');
const git = (cwd: string, ...a: string[]) =>
  execFileSync('git', a, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });

describe('TEST-cr-messung: nach jedem CR-Abschluss eine Zeile KPI 1 (CR-GC-639)', () => {
  let repo: string;
  let protokolle: string;

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), 'gc-crm-repo-'));
    protokolle = mkdtempSync(join(tmpdir(), 'gc-crm-prot-'));
    mkdirSync(join(repo, 'docs/cr/open'), { recursive: true });
    mkdirSync(join(repo, 'docs/cr/done'), { recursive: true });
    git(repo, 'init', '-q');
    writeFileSync(join(repo, 'docs/cr/open/CR-GC-900-etwas.md'), '# CR-GC-900\n');
    writeFileSync(join(repo, 'alt.ts'), 'export const x = 1;\n');
    git(repo, 'add', '-A');
    git(repo, 'commit', '-qm', 'feat: anlegen (CR-GC-900)');
    git(repo, 'rm', '-q', 'alt.ts');
    git(repo, 'mv', 'docs/cr/open/CR-GC-900-etwas.md', 'docs/cr/done/');
    git(repo, 'commit', '-qm', 'refactor: alt entfernt, CR zu (CR-GC-900)');

    const satz = (o: unknown) => JSON.stringify(o) + '\n';
    const nutzung = (name: string, input: Record<string, unknown>) =>
      satz({ message: { role: 'assistant', content: [{ type: 'tool_use', name, input }] } });
    writeFileSync(
      join(protokolle, 'sitzung-a.jsonl'),
      satz({ message: { role: 'user', content: 'CR-GC-900 umsetzen' } }) +
        nutzung('mcp__graphcode__graph_impact', { id: 'FUNC-alt' }) +
        nutzung('Bash', { command: 'grep -rn alt src' }) +
        nutzung('Bash', { command: 'npm test' }) +
        satz({ message: { role: 'user', content: [{ type: 'tool_result', content: 'R docs/cr/open/CR-GC-900-etwas.md -> docs/cr/done/CR-GC-900-etwas.md' }] } }),
    );
    // Eine zweite Sitzung, die den CR NICHT nennt — darf nicht gemessen werden.
    writeFileSync(join(protokolle, 'sitzung-b.jsonl'), nutzung('Bash', { command: 'grep -rn x .' }));
  });

  afterAll(() => {
    rmSync(repo, { recursive: true, force: true });
    rmSync(protokolle, { recursive: true, force: true });
  });

  it('erkennt den Abschluss an der Umbenennung open → done, sonst nichts', () => {
    expect(geschlosseneCrs('R100\tdocs/cr/open/CR-GC-900-etwas.md\tdocs/cr/done/CR-GC-900-etwas.md')).toEqual(['CR-GC-900']);
    expect(geschlosseneCrs('R100\tdocs/cr/open/BOK-CR-068-x.md\tdocs/cr/done/BOK-CR-068-x.md')).toEqual(['BOK-CR-068']);
    expect(geschlosseneCrs('A\tdocs/cr/open/CR-GC-901-neu.md')).toEqual([]);   // anlegen ist kein Abschluss
    // Der HAEUFIGERE Fall: die CR-Datei aus `dispatch prepare` war nie eingecheckt, solange sie in
    // open/ lag — git sieht dann kein R, sondern ein A in done/. Gemessen an den acht Abschluessen
    // vom 2026-09-23: 5 × A, 3 × R. Nur auf R zu hoeren haette die Mehrheit verpasst.
    expect(geschlosseneCrs('A\tdocs/cr/done/CR-GC-630-umweg.md')).toEqual(['CR-GC-630']);
    expect(geschlosseneCrs('M\tdocs/cr/done/CR-GC-900-etwas.md')).toEqual([]); // nachtragen auch nicht
  });

  it('der Hook-Pfad schreibt EINE Zeile je Sitzung, die den CR nennt — mit KPI 1 und Umbau-Marke', () => {
    execFileSync('node', [SKRIPT, '--commit', 'HEAD', '--repo', repo, '--protokolle', protokolle], { encoding: 'utf8' });
    const datei = join(repo, '.graphcode', 'cr-messung.jsonl');
    expect(existsSync(datei)).toBe(true);
    const zeilen = readFileSync(datei, 'utf8').trim().split('\n').map((z) => JSON.parse(z));

    expect(zeilen).toHaveLength(1);                    // sitzung-b nennt den CR nicht
    const z = zeilen[0];
    expect(z.cr).toBe('CR-GC-900');
    expect(z.sitzung).toBe('sitzung-a');
    expect(z.graphReads).toBe(1);
    expect(z.grepGlobDocReads).toBe(1);
    expect(z.kpi1).toBe(1);
    expect(z.volllaeufe).toBe(1);
    expect(z.geloeschteDateien).toBe(1);               // alt.ts — ein Umbau, fuer die Auswertung
  });

  it('ohne passendes Protokoll: eine Zeile, die das SAGT, statt zu schweigen', () => {
    const leer = mkdtempSync(join(tmpdir(), 'gc-crm-leer-'));
    try {
      execFileSync('node', [SKRIPT, 'CR-GC-900', '--repo', repo, '--protokolle', leer], { encoding: 'utf8' });
      const zeilen = readFileSync(join(repo, '.graphcode', 'cr-messung.jsonl'), 'utf8').trim().split('\n');
      const letzte = JSON.parse(zeilen.at(-1)!);
      expect(letzte.sitzung).toBeNull();
      expect(letzte.grund).toMatch(/kein Protokoll/);
    } finally {
      rmSync(leer, { recursive: true, force: true });
    }
  });
});
