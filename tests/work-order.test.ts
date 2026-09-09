/**
 * CR-GC-490 — der Modell-Zug erzeugt einen Arbeitsauftrag.
 *
 * Wandert eine `allocate`-Kante, sagt heute niemand, welche Datei mitwandern muss. Das Gate
 * prueft den Graphen, der Build prueft den Code — die Bruecke dazwischen war der Mensch, der
 * sich erinnert. Die Ableitung ist klein und vollstaendig aus vorhandenen Daten moeglich:
 *
 *   FUNC X -realRef-> Datei F  UND  FUNC X -allocate-> MOD A   =>   F gehoert zu A
 *
 * Das Ergebnis ist eine LISTE, kein Refactoring: Datei verschieben, Imports nachziehen kann der
 * Coding-Agent. graphcode liefert Spezifikation und Verdict (optimierungsring.md 9.1).
 *
 * `blind` ist Pflicht, nicht Kuer: eine FUNC ohne `realRef` erzeugt keinen Auftrag und MUSS als
 * nicht ableitbar erscheinen. Eine leere `moves`-Liste bei 30 blinden FUNCs waere dieselbe
 * Fail-open-Luege wie das Sammel-Token aus CR-GC-489.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openMeasured } from '../src/surface/measured.js';
import { congruenceWorkOrder, type FileMove } from '../src/kernel/measure/work-order.js';

type N = { uid: string; type: string; name: string; attributes?: Record<string, unknown> };
type E = { sourceId: string; targetId: string; edgeType: string };
const g = (nodes: N[], edges: E[]) => ({ nodes, edges }) as never;

const FUNC = (uid: string, file?: string): N => ({
  uid, type: 'FUNC', name: uid,
  attributes: file ? { realRef: { file } } : {},
});
const MOD = (uid: string): N => ({ uid, type: 'MOD', name: uid, attributes: {} });
const alloc = (f: string, m: string): E => ({ sourceId: f, targetId: m, edgeType: 'allocate' });

describe('CR-GC-490: aus dem Modell-Delta wird eine Datei-Liste', () => {
  it('wandert die allocate-Kante, wandert die Datei mit', () => {
    const nodes = [FUNC('FUNC-a', 'src/a.ts'), MOD('MOD-x'), MOD('MOD-y')];
    const wo = congruenceWorkOrder(
      g(nodes, [alloc('FUNC-a', 'MOD-x')]),
      g(nodes, [alloc('FUNC-a', 'MOD-y')]),
    );
    expect(wo.moves).toEqual([{ file: 'src/a.ts', funcId: 'FUNC-a', fromMod: 'MOD-x', toMod: 'MOD-y' }]);
    expect(wo.blind).toEqual([]);
  });

  it('eine FUNC OHNE realRef steht in blind — nicht in moves und nicht im Schweigen', () => {
    const nodes = [FUNC('FUNC-b'), MOD('MOD-x'), MOD('MOD-y')];
    const wo = congruenceWorkOrder(
      g(nodes, [alloc('FUNC-b', 'MOD-x')]),
      g(nodes, [alloc('FUNC-b', 'MOD-y')]),
    );
    expect(wo.moves).toEqual([]);
    expect(wo.blind).toEqual([{ funcId: 'FUNC-b', reason: 'kein realRef — die Datei ist nicht ableitbar' }]);
  });

  it('eine NEUE Zuordnung ist auch ein Auftrag — fromMod ist dann null', () => {
    const nodes = [FUNC('FUNC-c', 'src/c.ts'), MOD('MOD-x')];
    const wo = congruenceWorkOrder(g(nodes, []), g(nodes, [alloc('FUNC-c', 'MOD-x')]));
    expect(wo.moves).toEqual([{ file: 'src/c.ts', funcId: 'FUNC-c', fromMod: null, toMod: 'MOD-x' }]);
  });

  it('kein Zug an der Zuordnung, kein Auftrag — auch wenn sich sonst etwas aendert', () => {
    const before = [FUNC('FUNC-a', 'src/a.ts'), MOD('MOD-x')];
    const after = [{ ...FUNC('FUNC-a', 'src/a.ts'), name: 'anders benannt' }, MOD('MOD-x')];
    const wo = congruenceWorkOrder(g(before, [alloc('FUNC-a', 'MOD-x')]), g(after, [alloc('FUNC-a', 'MOD-x')]));
    expect(wo.moves).toEqual([]);
    expect(wo.blind).toEqual([]);
  });

  it('die Liste ist stabil sortiert — zwei Laeufe sind zeichengleich', () => {
    const nodes = [FUNC('FUNC-b', 'src/b.ts'), FUNC('FUNC-a', 'src/a.ts'), MOD('MOD-x'), MOD('MOD-y')];
    const before = g(nodes, [alloc('FUNC-b', 'MOD-x'), alloc('FUNC-a', 'MOD-x')]);
    const after = g(nodes, [alloc('FUNC-b', 'MOD-y'), alloc('FUNC-a', 'MOD-y')]);
    expect(congruenceWorkOrder(before, after).moves.map((m) => m.funcId)).toEqual(['FUNC-a', 'FUNC-b']);
  });

  it('faellt die Zuordnung WEG, ist toMod null — die Datei gehoert dann zu keinem Modul', () => {
    const nodes = [FUNC('FUNC-a', 'src/a.ts'), MOD('MOD-x')];
    const wo = congruenceWorkOrder(g(nodes, [alloc('FUNC-a', 'MOD-x')]), g(nodes, []));
    expect(wo.moves).toEqual([{ file: 'src/a.ts', funcId: 'FUNC-a', fromMod: 'MOD-x', toMod: null }]);
  });
});

/**
 * Der Verdrahtungs-Nachweis: die Ableitung muss den ECHTEN Zug erreichen, sonst ist sie eine
 * Funktion ohne Pfad. Gefahren durch `openMeasured` (CR-GC-491) — also durch `createHarness`,
 * mit Herkunftsstempel und ohne handgebauten Store.
 */
describe('CR-GC-490: der Auftrag erreicht das Mutations-Ergebnis', () => {
  const FIXTURE = {
    elements: [
      { id: 'MOD-x', type: 'MOD', name: 'Modul X' },
      { id: 'MOD-y', type: 'MOD', name: 'Modul Y' },
      { id: 'FUNC-a', type: 'FUNC', name: 'Funktion A', attributes: { realRef: { file: 'src/a.ts' } } },
    ],
    traces: [{ source: 'FUNC-a', target: 'MOD-x', type: 'allocate' }],
  };

  it('ein allocate-Zug hinterlaesst genau eine Zeile — und blockiert nichts', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wo-'));
    mkdirSync(join(dir, 'docs', 'graph'), { recursive: true });
    const graph = join(dir, 'docs', 'graph', 'wo.graph.json');
    writeFileSync(graph, JSON.stringify(FIXTURE));
    const m = await openMeasured({ graph, systemId: 'wo' });
    try {
      const res = (await m.harness.mutate([
        { op: 'delete-edge', edge: { sourceId: 'FUNC-a', targetId: 'MOD-x', edgeType: 'allocate' } },
        { op: 'add-edge', edge: { sourceId: 'FUNC-a', targetId: 'MOD-y', edgeType: 'allocate' } },
      ])) as unknown as { success: boolean; tier: string; workOrder: { moves: FileMove[]; blind: unknown[] } };

      expect(res.success, 'der Zug selbst muss durchs Gate gehen').toBe(true);
      expect(res.workOrder.moves).toEqual([
        { file: 'src/a.ts', funcId: 'FUNC-a', fromMod: 'MOD-x', toMod: 'MOD-y' },
      ]);
      expect(res.workOrder.blind).toEqual([]);
      // Advisory, kein Gate: ein offener Auftrag haelt den Zug nicht auf.
      expect(res.tier).not.toBe('blocked');
    } finally {
      await m.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
