/**
 * TEST-attributvertraege (CR-GC-643 / CR-SM-360) — die Vertragstests von SCHEMA-test-refs und
 * SCHEMA-real-ref auf der Konsumentenseite.
 *
 * graphcode las `testRefs`/`realRef` an 9 Stellen selbst, und die Leser wichen ab: `graph_tests`
 * meldete ungueltige testRefs, die anderen behandelten sie still wie fehlende (Klasse CR-GC-338).
 * Jetzt geht jede Stelle ueber den dreiwertigen Familienleser. Hier steht, was graphcode damit
 * zusichert: jeder der drei Zustaende hat an der Stelle, die ihn berichten muss, seine eigene
 * Aussage. Dass kein graphcode-Leser den Vertrag noch selbst parst, prueft RC-09 am committeten
 * Modell in `conformance.test.ts` (Modell-Spur).
 *
 * Echter Disk-Kuzu im Wegwerf-Verzeichnis, keine Mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { HarnessConfig } from '@sigloch/contracts/harness';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import { resultOf } from '../src/projections/verification-report.js';
import { extractCodeFacts } from '../src/kernel/conformance.js';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';

const REPO = join(__dirname, '..');

const SEED = {
  elements: [
    { id: 'SYS-x', type: 'SYS', name: 'System', description: 'Ein System.' },
    { id: 'REQ-a', type: 'REQ', name: 'Anforderung', description: 'Das System muss etwas tun.', kinds: ['functional'] },
    { id: 'FUNC-a', type: 'FUNC', name: 'Funktion', description: 'Tut es.' },
    { id: 'TEST-gut', type: 'TEST', name: 'gut', description: 'gebunden', testRefs: [{ file: 'tests/attributvertraege.test.ts', tool: 'vitest', result: 'passed' }] },
    { id: 'TEST-kaputt', type: 'TEST', name: 'kaputt', description: 'Vertrag verletzt', testRefs: 'tests/attributvertraege.test.ts' },
    { id: 'TEST-ohne', type: 'TEST', name: 'ohne', description: 'keine Bindung' },
  ],
  traces: [
    { source: 'FUNC-a', target: 'REQ-a', type: 'satisfy' },
    { source: 'TEST-gut', target: 'REQ-a', type: 'verify' },
    { source: 'TEST-kaputt', target: 'REQ-a', type: 'verify' },
    { source: 'TEST-ohne', target: 'REQ-a', type: 'verify' },
  ],
};

let tmp: string;
let harness: GraphCodeHarness;
let tools: MCPToolRegistry;
const knoten = (uid: string) => harness.getGraph().nodes.find((n) => n.uid === uid)!;

beforeEach(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'graphcode-attributvertraege-'));
  const config: HarnessConfig = { repoRoot: tmp, scope: { workspaceId: 'gc-643', systemId: 'graphcode' }, consumerType: 'system', preCommitTimeout: 5000 };
  harness = new GraphCodeHarness(config, new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') }));
  await harness.initialize();
  await harness.importGraph(SEED);
  tools = bindToolsToHarness(harness);
});

afterEach(async () => {
  await harness.close();
  rmSync(tmp, { recursive: true, force: true });
});

describe('TEST-attributvertraege: drei Zustaende, jeder mit eigener Aussage (CR-GC-643)', () => {
  it('graph_tests: gebunden → im Lauf; kaputt → „invalid testRefs: …"; fehlt → „no testRefs attribute"', async () => {
    const res = (await tools.graph_tests.handler({ changeSet: ['REQ-a'] })) as {
      tests: Array<{ id: string }>;
      unresolved: Array<{ id: string; reason: string }>;
    };
    expect(res.tests.map((t) => t.id)).toEqual(['TEST-gut']);
    const grund = Object.fromEntries(res.unresolved.map((u) => [u.id, u.reason]));
    expect(grund['TEST-kaputt']).toMatch(/^invalid testRefs: /);
    expect(grund['TEST-ohne']).toBe('no testRefs attribute');
  });

  it('Verifikationsbericht: nur eine GUELTIGE Bindung traegt ein Ergebnis — kaputt ist nicht gelaufen', () => {
    expect(resultOf(knoten('TEST-gut'))).toBe('passed');
    expect(resultOf(knoten('TEST-kaputt'))).toBe('not-run');
    expect(resultOf(knoten('TEST-ohne'))).toBe('not-run');
  });

  it('Code-Fakten: eine kaputte Bindung verweist auf keine Datei', () => {
    const facts = extractCodeFacts({ nodes: [knoten('TEST-kaputt')], edges: [] }, REPO);
    expect(facts.files['tests/attributvertraege.test.ts']).toBeUndefined();
  });
});
