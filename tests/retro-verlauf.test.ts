/**
 * TEST-retro-kpi (CR-GC-914) — der Verlauf der Verstöße über alle committeten Graph-Stände.
 *
 * Echtes Git-Repo mit drei Ständen, gemessen über `measureGraphHistory` aus dem installierten
 * graph-view-edit (ein Messpfad). Die Sprungliste ist rein und wird mit festen Zahlen geprüft.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sprungListe, verlauf, renderVerlauf } from '../scripts/retro-kpi.mjs';

const req = (i: number) => ({ id: `REQ-r${i}`, type: 'REQ', name: `Anforderung ${i}`, description: `Das System muss ${i} tun.` });
const stand = (reqs: number, sysText: string) => ({
  elements: [{ id: 'SYS-x', type: 'SYS', name: 'X', description: sysText }, ...Array.from({ length: reqs }, (_, i) => req(i))],
  traces: Array.from({ length: reqs }, (_, i) => ({ source: 'SYS-x', target: `REQ-r${i}`, type: 'compose' })),
  graphVersion: 1,
});

function repoMitDreiStaenden() {
  const repo = mkdtempSync(join(tmpdir(), 'retro-verlauf-'));
  const git = (...a: string[]) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8' });
  git('init', '-q');
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  mkdirSync(join(repo, 'docs/graph'), { recursive: true });
  const commit = (g: object, msg: string) => {
    writeFileSync(join(repo, 'docs/graph/x.graph.json'), JSON.stringify(g));
    git('add', '.');
    git('commit', '-q', '-m', msg);
  };
  commit(stand(1, 'erster Text'), 'erster Stand');
  commit(stand(1, 'zweiter Text'), 'nur Text geaendert');
  commit(stand(6, 'zweiter Text'), 'fuenf Anforderungen dazu');
  return repo;
}

describe('TEST-retro-kpi: Verlauf der Verstoesse (CR-GC-914)', () => {
  it('sprungListe meldet jede Aenderung der offenen Verstoesse um mehr als 10 %', () => {
    const s = [100, 105, 120, 60, 61].map((open, i) => ({ short: `c${i}`, open }));
    expect(sprungListe(s).map((x: { short: string }) => x.short)).toEqual(['c2', 'c3']);
  });

  it('drei committete Staende ergeben drei Zeilen in Commit-Reihenfolge und genau einen Sprung', async () => {
    const repo = repoMitDreiStaenden();
    try {
      const v = await verlauf(repo);
      expect(v.states.map((s: { elements: number }) => s.elements)).toEqual([2, 2, 7]);
      expect(v.states.map((s: { betreff: string }) => s.betreff)).toEqual([
        'erster Stand',
        'nur Text geaendert',
        'fuenf Anforderungen dazu',
      ]);
      expect(v.spruenge.map((s: { betreff: string }) => s.betreff)).toEqual(['fuenf Anforderungen dazu']);
      const md = renderVerlauf(v);
      const [teilVerlauf, teilSpruenge] = md.split('## Spruenge');
      const datumsZeilen = (t: string) => t.split('\n').filter((l: string) => /^\| \d{4}-/.test(l));
      expect(datumsZeilen(teilVerlauf)).toHaveLength(3);
      expect(datumsZeilen(teilSpruenge)).toHaveLength(1);
      expect(md).toContain('fuenf Anforderungen dazu');
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
