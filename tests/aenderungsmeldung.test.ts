/**
 * TEST-lane-reports-change (CR-GC-800) — die Spur meldet Änderung und Lauf zurück.
 *
 * CR-GC-799 baute die Rücknahme, aber nichts meldete die Änderung: der Aufrufer musste daran
 * denken. Hier steht die Meldung an der Stelle, die die Änderung ohnehin kennt — `verify:code`
 * und `verify:full`. Zwei Teile: (1) geänderte Dateien → Knoten-uids über dieselbe Abbildung
 * wie die Testauswahl, (2) der Aufruf von `graph_test_ingest` über MCP-stdio gegen einen
 * echten Host und einen Store auf Platte. Keine Mocks. Teil 2 setzt einen Build voraus.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  changeSetFor,
  fileToNodes,
  snapshotToGraph,
  type AuditContext,
} from '../src/projections/test-selection-audit.js';
// @ts-expect-error — schlanker Runner-Helfer ohne Typdatei
import { meldeZurueck } from '../scripts/aenderung-melden.mjs';

const SNAPSHOT = {
  elements: [
    { id: 'SYS-m', type: 'SYS', name: 'System', description: 'System.' },
    { id: 'MOD-m', type: 'MOD', name: 'Module', description: 'Module.', path: 'src/m' },
    { id: 'FUNC-a', type: 'FUNC', name: 'A', description: 'A.', realRef: { file: 'src/m/a.ts', symbol: 'a' } },
    { id: 'REQ-a', type: 'REQ', name: 'Req a', description: 'Req a.', kinds: ['functional'] },
    { id: 'REQ-b', type: 'REQ', name: 'Req b', description: 'Req b.', kinds: ['non-functional'] },
    {
      id: 'TEST-a',
      type: 'TEST',
      name: 'Test a',
      description: 'Test a.',
      testRefs: [{ file: 'tests/a.test.ts', tool: 'vitest', result: 'passed', ranAt: '2026-08-21T07:52:28.796Z' }],
    },
    {
      id: 'TEST-b',
      type: 'TEST',
      name: 'Test b',
      description: 'Test b.',
      testRefs: [{ file: 'tests/b.test.ts', tool: 'vitest', result: 'passed', ranAt: '2026-08-21T07:52:28.796Z' }],
    },
  ],
  traces: [
    { source: 'SYS-m', target: 'REQ-a', type: 'compose' },
    { source: 'SYS-m', target: 'REQ-b', type: 'compose' },
    { source: 'FUNC-a', target: 'MOD-m', type: 'allocate' },
    { source: 'FUNC-a', target: 'REQ-a', type: 'satisfy' },
    { source: 'SYS-m', target: 'REQ-b', type: 'satisfy' },
    { source: 'TEST-a', target: 'REQ-a', type: 'verify' },
    { source: 'TEST-b', target: 'REQ-b', type: 'verify' },
  ],
};

describe('TEST-lane-reports-change: geaenderte Dateien → changeSet (CR-GC-800)', () => {
  const graph = snapshotToGraph(SNAPSHOT as never);
  const ctx: AuditContext = {
    graph,
    byFile: fileToNodes(graph),
    mods: [{ uid: 'MOD-m', path: 'src/m' }],
    importsByTest: new Map(),
    allSources: ['src/m/a.ts', 'src/m/neu.ts'],
    allTests: ['tests/a.test.ts', 'tests/b.test.ts'],
  };

  it('eine Quelldatei mit Knoten meldet ihren Knoten', () => {
    expect(changeSetFor(['src/m/a.ts'], ctx)).toEqual(['FUNC-a']);
  });

  it('eine Quelldatei ohne eigenen Knoten meldet das Modul, in dem sie liegt', () => {
    expect(changeSetFor(['src/m/neu.ts'], ctx)).toEqual(['MOD-m']);
  });

  it('eine geaenderte Testdatei meldet die TEST-Knoten, die sie binden', () => {
    expect(changeSetFor(['tests/b.test.ts'], ctx)).toEqual(['TEST-b']);
  });

  it('Doku, Snapshot und Dateien ausserhalb des Modells melden nichts', () => {
    expect(changeSetFor(['docs/cr/open/CR-1.md', 'docs/graph/x.graph.json', 'src/fremd/x.ts'], ctx)).toEqual([]);
  });
});

describe('TEST-lane-reports-change: Meldung ueber MCP-stdio an einen echten Host (CR-GC-800)', () => {
  let repoRoot: string;
  const cli = join(__dirname, '..', 'dist', 'cli.js');

  beforeAll(() => {
    repoRoot = realpathSync(mkdtempSync(join(tmpdir(), 'graphcode-meldung-')));
    mkdirSync(join(repoRoot, 'docs/graph'), { recursive: true });
    writeFileSync(join(repoRoot, 'package.json'), JSON.stringify({ name: 'meldung' }));
    writeFileSync(join(repoRoot, 'docs/graph/meldung.graph.json'), JSON.stringify({ ...SNAPSHOT, graphVersion: 1 }));
  });

  afterAll(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('nimmt das Ergebnis des betroffenen Tests zurueck und schreibt das frische des Laufs', async () => {
    const bericht = join(repoRoot, 'vitest.json');
    writeFileSync(
      bericht,
      JSON.stringify({ testResults: [{ name: join(repoRoot, 'tests/b.test.ts'), status: 'failed', assertionResults: [{ status: 'failed' }] }] }),
    );

    const res = await meldeZurueck({ repoRoot, changeSet: ['FUNC-a'], berichtPfad: bericht, cli });

    expect(res.success).toBe(true);
    expect(res.withdrawn).toEqual([{ testUid: 'TEST-a', file: 'tests/a.test.ts' }]);
    expect(res.assignments.map((a: { testUid: string; result: string }) => [a.testUid, a.result])).toEqual([['TEST-b', 'failed']]);
  }, 60_000);

  it('ohne Aenderung und ohne Bericht gibt es nichts zu melden', async () => {
    expect(await meldeZurueck({ repoRoot, changeSet: [], berichtPfad: join(repoRoot, 'fehlt.json'), cli })).toBeNull();
  });
});
