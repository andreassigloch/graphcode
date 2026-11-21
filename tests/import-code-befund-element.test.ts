/**
 * CR-GC-985 — der Code-Import gibt graphify je Befund das Element mit.
 *
 * `reseedTransport` liest die Antwort von `graph_mutate`. Im Default `summary` faltet das Werkzeug je Regel und
 * Meldungsmuster: kein `elementId`, die uid steht als `{el}` in der Meldung. Der Import reichte das als
 * `GateViolation` weiter, deren `elementId` Pflicht ist, und schrieb `''` (Befund wie CR-GC-860 für se:import-doc).
 * Er fordert darum `full` an. Echter Disk-Kuzu im Temp-Repo.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness } from '../src/index.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import { reseedTransport } from '../src/surface/import-code-verb.js';

const GELIEFERT = [
  { op: 'add-node', node: { uid: 'MOD-a', type: 'MOD', name: 'a', attributes: { status: 'draft' } } },
  { op: 'add-node', node: { uid: 'FUNC-a', type: 'FUNC', name: 'a', attributes: { realRef: { file: 'a/index.ts', symbol: 'a', lang: 'ts' }, status: 'draft' } } },
  { op: 'add-node', node: { uid: 'FUNC-b', type: 'FUNC', name: 'b', attributes: { realRef: { file: 'a/index.ts', symbol: 'b', lang: 'ts' }, status: 'draft' } } },
  { op: 'add-edge', edge: { sourceId: 'FUNC-a', targetId: 'MOD-a', edgeType: 'allocate', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'FUNC-b', targetId: 'MOD-a', edgeType: 'allocate', attributes: {} } },
];

describe('import-code: Befunde tragen ihr Element (CR-GC-985)', () => {
  it('jeder Befund an einem Element nennt es in elementId und lässt keinen Platzhalter in der Meldung', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-import-befund-'));
    const harness = await createHarness({ repoRoot, scope: { workspaceId: 'fix', systemId: 'fix' } });
    await harness.initialize();
    try {
      const registry = bindToolsToHarness(harness);
      const res = await reseedTransport(harness.getGraph(), registry, 'fix')(GELIEFERT);
      const jeElement = (res.violations ?? []).filter((v) => /^(FUNC|MOD)-/.test(v.elementId));
      expect(jeElement.length, 'die Fixture muss Befunde an Elementen erzeugen').toBeGreaterThan(1);
      expect(jeElement.map((v) => v.elementId)).toEqual(expect.arrayContaining(['FUNC-a', 'FUNC-b']));
      for (const v of res.violations ?? []) expect(v.message, `${v.ruleId}`).not.toContain('{el}');
    } finally {
      await harness.close();
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
