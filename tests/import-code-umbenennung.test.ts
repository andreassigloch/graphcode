/**
 * CR-GC-856 — import-code verliert nach dem graphify-Upgrade keine Handkanten.
 *
 * graphify CR-GF-132 vergibt lesbare uids (`FUNC-adddays` statt `func_adddays_index_ts_adddays`);
 * CR-GF-154 liefert die alte uid als `attributes.candidateId` an jedem Code-Knoten. Gemessen an
 * einer Kopie von gc_test-sqlite: 35 von 35 Handkanten `SYS -compose-> MOD` verloren; ohne
 * origin-Stempel (moneyflow) entstehen Duplikate. Der Reseed ordnet darum alte uid und neue uid
 * über `candidateId` zu und benennt um (merge-nodes), statt zu löschen und neu anzulegen.
 *
 * Realer Disk-Kuzu im Temp-Repo; die gelieferten Kommandos haben genau die Form von graphify
 * 0fdb641 (Ordner-MOD und Datei-MOD heißen beide nach dem Pfad — Zuordnung nur über candidateId).
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness } from '../src/index.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import { reseedTransport, umbenennungen } from '../src/surface/import-code-verb.js';

/** Was graphify (CR-GF-132/154) für `addDays/index.ts` mit `export function addDays` liefert. */
const GELIEFERT = [
  { op: 'add-node', node: { uid: 'MOD-adddays', type: 'MOD', name: 'addDays', attributes: { candidateId: 'mod_adddays', status: 'draft' } } },
  { op: 'add-node', node: { uid: 'MOD-adddays-index-ts', type: 'MOD', name: 'addDays/index.ts', attributes: { candidateId: 'mod_adddays_index_ts', status: 'draft' } } },
  {
    op: 'add-node',
    node: {
      uid: 'FUNC-adddays',
      type: 'FUNC',
      name: 'addDays',
      attributes: { candidateId: 'func_adddays_index_ts_adddays', confidence: 1, realRef: { file: 'addDays/index.ts', symbol: 'addDays', lang: 'ts' }, status: 'draft' },
    },
  },
  { op: 'add-edge', edge: { sourceId: 'MOD-adddays', targetId: 'MOD-adddays-index-ts', edgeType: 'compose', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'FUNC-adddays', targetId: 'MOD-adddays-index-ts', edgeType: 'allocate', attributes: {} } },
];

/** Der Bestand aus dem Import VOR CR-GF-132: alte uids, eine Handkante, ein Handattribut. */
function bestand(stempel: boolean): string {
  const o = stempel ? 'origin:import-code,' : '';
  return [
    '## Nodes',
    '### SYS',
    '+ SYS-fix|Fixture-System [__name:Fixture]',
    '### MOD',
    `+ mod_adddays|Ordner addDays [${o}status:draft,__name:addDays]`,
    `+ mod_adddays_index_ts|Datei addDays/index.ts [${o}status:draft,__name:addDays/index.ts]`,
    '### FUNC',
    `+ func_adddays_index_ts_adddays|addDays [${o}status:draft,owner:team-zeit,__name:addDays]`,
    '',
    '## Edges',
    '+ SYS-fix -compose-> mod_adddays',
    '+ mod_adddays -compose-> mod_adddays_index_ts',
    '+ func_adddays_index_ts_adddays -allocate-> mod_adddays_index_ts',
  ].join('\n');
}

async function reimport(stempel: boolean) {
  const repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-umbenennung-'));
  const harness = await createHarness({ repoRoot, scope: { workspaceId: 'fix', systemId: 'fix' } });
  await harness.initialize();
  try {
    const registry = bindToolsToHarness(harness);
    const seed = (await registry['graph_mutate'].handler({ formatE: bestand(stempel), consumerId: 'test' })) as { success: boolean };
    expect(seed.success).toBe(true);

    const res = await reseedTransport(harness.getGraph(), registry, 'fix')(GELIEFERT);
    const g = harness.getGraph();
    return { res, uids: g.nodes.map((n) => n.uid).sort(), nodes: g.nodes, edges: g.edges };
  } finally {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  }
}

const NEU = ['FUNC-adddays', 'MOD-adddays', 'MOD-adddays-index-ts', 'SYS-fix'];

describe('import-code benennt per candidateId um (CR-GC-856)', () => {
  it('mit origin-Stempel: die Handkante SYS -compose-> MOD bleibt, kein alter Knoten, kein Duplikat', async () => {
    const r = await reimport(true);
    expect(r.res.success).toBe(true);
    expect(r.uids).toEqual(NEU);
    expect(r.edges.some((e) => e.sourceId === 'SYS-fix' && e.edgeType === 'compose' && e.targetId === 'MOD-adddays')).toBe(true);
    // Ordner-MOD und Datei-MOD: jede alte uid landet bei IHRER neuen, nicht bei der gleichnamigen.
    expect(r.edges.some((e) => e.sourceId === 'MOD-adddays' && e.edgeType === 'compose' && e.targetId === 'MOD-adddays-index-ts')).toBe(true);
    expect(r.edges.some((e) => e.sourceId === 'FUNC-adddays' && e.edgeType === 'allocate' && e.targetId === 'MOD-adddays-index-ts')).toBe(true);
    // Das Handattribut des alten Knotens überlebt; die gelieferten Attribute kommen dazu und
    // gewinnen bei gleichem Schlüssel — wie beim Reimport einer unveränderten uid.
    const func = r.nodes.find((n) => n.uid === 'FUNC-adddays')!;
    expect(func.attributes?.['owner']).toBe('team-zeit');
    expect(func.attributes?.['realRef']).toEqual({ file: 'addDays/index.ts', symbol: 'addDays', lang: 'ts' });
    expect(func.attributes?.['candidateId']).toBe('func_adddays_index_ts_adddays');
    expect(func.attributes?.['origin']).toBe('import-code');
  }, 60_000);

  it('ohne origin-Stempel: uid gleich candidateId belegt die Herkunft — umbenannt statt verdoppelt', async () => {
    const r = await reimport(false);
    expect(r.res.success).toBe(true);
    expect(r.uids).toEqual(NEU);
    expect(r.edges.some((e) => e.sourceId === 'SYS-fix' && e.edgeType === 'compose' && e.targetId === 'MOD-adddays')).toBe(true);
    expect(r.nodes.find((n) => n.uid === 'FUNC-adddays')!.attributes?.['owner']).toBe('team-zeit');
  }, 60_000);
});

describe('umbenennungen (CR-GC-856)', () => {
  const neu = (uid: string, candidateId?: string) => ({ uid, attributes: candidateId ? { candidateId } : {} });

  it('ordnet über die uid ODER die candidateId des alten Knotens zu, nie über den Namen', () => {
    const m = umbenennungen(
      [neu('mod_adddays'), neu('mod_adddays_index_ts'), neu('FUNC-alt', 'func_x')],
      [neu('MOD-adddays', 'mod_adddays'), neu('MOD-adddays-index-ts', 'mod_adddays_index_ts'), neu('FUNC-x', 'func_x')],
    );
    expect([...m]).toEqual([
      ['mod_adddays', 'MOD-adddays'],
      ['mod_adddays_index_ts', 'MOD-adddays-index-ts'],
      ['FUNC-alt', 'FUNC-x'],
    ]);
  });

  it('dieselbe uid ist keine Umbenennung, ein Knoten ohne candidateId bleibt unberührt', () => {
    expect(umbenennungen([neu('MOD-a', 'mod_a'), neu('mod_b')], [neu('MOD-a', 'mod_a'), neu('MOD-b')]).size).toBe(0);
  });

  it('eine mehrdeutige Zuordnung bricht laut ab', () => {
    expect(() => umbenennungen([neu('mod_a'), neu('MOD-alt', 'mod_a')], [neu('MOD-a', 'mod_a')])).toThrow(/mod_a/);
  });
});
