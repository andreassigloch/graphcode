/**
 * TEST-verlauf (CR-GC-946) — der Verlauf der Marken und Befunde je Stufe ueber committete Staende.
 *
 * Echtes Git-Repo in mkdtemp mit drei Staenden von `docs/graph/x.graph.json`; echter Harness auf
 * einem Wegwerf-Store fuer den Vergleich mit `graph_readiness`. Keine Mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import { rechneVerlauf, type VerlaufCache, type VerlaufStand } from '../src/projections/verlauf.js';
import { verlaufAmRepo } from '../src/projections/verlauf-repo.js';
import { VERLAUF_CACHE_DATEI } from '../src/projections/verlauf-cache.js';

const req = (i: number) => ({ id: `REQ-r${i}`, type: 'REQ', name: `Anforderung ${i}`, description: `Das System muss ${i} tun.` });
const test = (i: number, result?: string) => ({
  id: `TEST-t${i}`,
  type: 'TEST',
  name: `Test ${i}`,
  description: `Prueft ${i}.`,
  testRefs: [{ file: `tests/t${i}.test.ts`, tool: 'vitest', ...(result ? { result } : {}) }],
});
const stand = (reqs: number, results: (string | undefined)[]) => ({
  elements: [
    { id: 'SYS-x', type: 'SYS', name: 'X', description: 'Das System.' },
    ...Array.from({ length: reqs }, (_, i) => req(i)),
    ...results.map((r, i) => test(i, r)),
  ],
  traces: [
    ...Array.from({ length: reqs }, (_, i) => ({ source: 'SYS-x', target: `REQ-r${i}`, type: 'compose' })),
    ...results.map((_, i) => ({ source: `TEST-t${i}`, target: `REQ-r${i}`, type: 'verify' })),
  ],
  graphVersion: 1,
});

const STAENDE = [stand(1, [undefined]), stand(2, ['passed', undefined]), stand(3, ['passed', 'failed', undefined])];
const tmps: string[] = [];
afterAll(() => tmps.forEach((t) => rmSync(t, { recursive: true, force: true })));
const tmp = (p: string) => {
  const d = mkdtempSync(join(tmpdir(), p));
  tmps.push(d);
  return d;
};

function repoMitDreiStaenden() {
  const repo = tmp('verlauf-');
  const git = (...a: string[]) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8' });
  git('init', '-q');
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  mkdirSync(join(repo, 'docs/graph'), { recursive: true });
  for (const [i, g] of STAENDE.entries()) {
    writeFileSync(join(repo, 'docs/graph/x.graph.json'), JSON.stringify(g));
    git('add', '.');
    git('commit', '-q', '-m', `stand ${i}`);
  }
  return repo;
}

const gitIn = (repo: string) => (args: string[]) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const speicher = (): VerlaufCache & { n: () => number } => {
  const m = new Map<string, VerlaufStand>();
  return { get: (k) => m.get(k), set: (k, v) => void m.set(k, v), n: () => m.size };
};
const eingabe = (repo: string, cache: VerlaufCache, policy = DEFAULT_METRIC_POLICY) => ({
  git: gitIn(repo),
  policy,
  policySource: 'default',
  window: null,
  cache,
});

describe('TEST-verlauf: Marken und Befunde je Stufe je committetem Stand (CR-GC-946)', () => {
  it('drei Staende: je Stand Marken, Befunde je Stufe, Tests; der juengste gleicht graph_readiness ohne RC', async () => {
    const repo = repoMitDreiStaenden();
    const v = rechneVerlauf(eingabe(repo, speicher()));
    expect(v.states.map((s) => s.elements)).toEqual([3, 5, 7]);
    expect(v.states.map((s) => s.tests.neverRun)).toEqual([1, 1, 1]);
    expect(v.states.map((s) => s.tests.passed)).toEqual([0, 1, 1]);
    expect(v.states.map((s) => s.tests.failed)).toEqual([0, 0, 1]);
    for (const s of v.states) {
      expect(s.marks.map((m) => m.id)).toEqual(['SRR', 'PDR', 'CDR', 'TRR', 'Bau']);
      expect(s.stages.length).toBeGreaterThan(0);
    }
    expect(v.skippedRules).toContain('RC-01');

    // der juengste Stand gegen den Live-Weg: gleiche Daten im Harness, Repo-Wurzel ohne Quellbaum (kein RC)
    const dir = tmp('verlauf-harness-');
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(dir, 'kuzu') });
    const harness = new GraphCodeHarness(
      { repoRoot: join(dir, 'gibt-es-nicht'), scope: { workspaceId: 'w', systemId: 's' }, consumerType: 'system', preCommitTimeout: 5000 },
      storage,
      undefined,
      { lockDir: dir },
    );
    await harness.initialize();
    try {
      await harness.importGraph(STAENDE[2] as never);
      const live = (await bindToolsToHarness(harness).graph_readiness.handler({ detail: false })) as unknown as {
        marks: { id: string; reached: boolean }[];
        stages: { name: string; findings: number }[];
        steer: { worst: number; mean: number; score: number; measured: number; terms: { ruleId: string }[] };
      };
      const letzter = v.states.at(-1)!;
      expect(letzter.marks).toEqual(live.marks.map((m) => ({ id: m.id, reached: m.reached })));
      expect(letzter.stages).toEqual(live.stages);
      expect(letzter.steer.score).toBe(live.steer.score);
      expect(letzter.steer.measured).toBe(live.steer.measured);
      expect(letzter.steer.worst).toBe(live.steer.worst);
      expect(letzter.steer.byRule.reduce((n, r) => n + r.terms, 0)).toBe(live.steer.terms.length);
    } finally {
      await harness.close();
    }
  });

  it('der zweite Aufruf misst keinen Stand neu; eine andere Policy misst neu', () => {
    const repo = repoMitDreiStaenden();
    const cache = speicher();
    const erst = rechneVerlauf(eingabe(repo, cache));
    expect([erst.measured, erst.fromCache]).toEqual([3, 0]);
    const zweit = rechneVerlauf(eingabe(repo, cache));
    expect([zweit.measured, zweit.fromCache]).toEqual([0, 3]);
    expect(zweit.states).toEqual(erst.states);
    const andere = rechneVerlauf(eingabe(repo, cache, { ...DEFAULT_METRIC_POLICY, instability: 0.123 } as typeof DEFAULT_METRIC_POLICY));
    expect([andere.measured, andere.fromCache]).toEqual([3, 0]);
  });

  it('ein unlesbarer Stand zaehlt unter skipped, der Lauf bricht nicht ab', () => {
    const repo = repoMitDreiStaenden();
    const git = (...a: string[]) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8' });
    writeFileSync(join(repo, 'docs/graph/x.graph.json'), '{ kaputt');
    git('commit', '-qam', 'kaputt');
    writeFileSync(join(repo, 'docs/graph/x.graph.json'), JSON.stringify(STAENDE[2]));
    git('commit', '-qam', 'repariert');
    const v = rechneVerlauf(eingabe(repo, speicher()));
    expect(v.skipped).toBe(1);
    expect(v.states).toHaveLength(4);
  });

  it('window nimmt nur die juengsten Staende', () => {
    const repo = repoMitDreiStaenden();
    const v = rechneVerlauf({ ...eingabe(repo, speicher()), window: 2 });
    expect(v.states.map((s) => s.elements)).toEqual([5, 7]);
  });

  it('der Zwischenspeicher liegt im Store-Verzeichnis, nicht fest in .graphcode', () => {
    const repo = repoMitDreiStaenden();
    const storeDir = tmp('verlauf-store-');
    const a = verlaufAmRepo({ repoRoot: repo, storeDir, policy: DEFAULT_METRIC_POLICY, policySource: 'default', window: null });
    expect(existsSync(join(storeDir, VERLAUF_CACHE_DATEI))).toBe(true);
    expect(existsSync(join(repo, '.graphcode'))).toBe(false);
    const b = verlaufAmRepo({ repoRoot: repo, storeDir, policy: DEFAULT_METRIC_POLICY, policySource: 'default', window: null });
    expect([a.measured, b.measured, b.fromCache]).toEqual([3, 0, 3]);
  });

  it('graph_readiness: ohne verlauf kein Feld, mit verlauf die Reihe', async () => {
    const repo = repoMitDreiStaenden();
    const dir = tmp('verlauf-tool-');
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(dir, 'kuzu') });
    const harness = new GraphCodeHarness(
      { repoRoot: repo, scope: { workspaceId: 'w', systemId: 'x' }, consumerType: 'system', preCommitTimeout: 5000 },
      storage,
      undefined,
      { lockDir: dir },
    );
    await harness.initialize();
    try {
      const t = bindToolsToHarness(harness).graph_readiness;
      const ohne = (await t.handler({ detail: false })) as { verlauf?: unknown };
      expect(ohne.verlauf).toBeUndefined();
      const mit = (await t.handler({ detail: false, verlauf: 2 })) as { verlauf?: { states: unknown[]; window: number } };
      expect(mit.verlauf?.states).toHaveLength(2);
      expect(mit.verlauf?.window).toBe(2);
      expect(existsSync(join(dir, VERLAUF_CACHE_DATEI))).toBe(true);
    } finally {
      await harness.close();
    }
  });
});
