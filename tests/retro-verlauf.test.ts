/**
 * TEST-retro-kpi (CR-GC-914, CR-GC-946) — der Verlauf der Befunde über alle committeten Graph-Stände.
 *
 * Echtes Git-Repo mit drei Ständen, gemessen über `verlaufFuerRepo` aus `dist/` (die Rechnung von
 * `graph_readiness({verlauf})`, ein Messpfad). Die Sprungliste ist rein und wird mit festen Zahlen geprüft.
 * `scripts/` importiert nichts mehr aus dem Viewer-Paket.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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

describe('TEST-retro-kpi: der Verlauf kommt aus dem Host-Paket (CR-GC-946)', () => {
  it('scripts/ importiert nichts mehr aus @sigloch/graph-view-edit', () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts');
    const treffer = readdirSync(dir)
      .filter((f) => f.endsWith('.mjs') || f.endsWith('.js') || f.endsWith('.ts'))
      .filter((f) => /(?:from|import\()\s*['"]@sigloch\/graph-view-edit/.test(readFileSync(join(dir, f), 'utf8')));
    expect(treffer).toEqual([]);
  });

  it('der Verlauf traegt Marken und Plan als eigene Stufe', async () => {
    const repo = repoMitDreiStaenden();
    try {
      const v = await verlauf(repo);
      expect(v.skippedRules).toContain('RC-01');
      expect(renderVerlauf(v)).toContain('Befunde ohne Plan');
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
