/**
 * TEST-werkzeug-eingang-geparst — das Register parst jede Eingabe, auch beim direkten Aufruf (CR-GC-866).
 *
 * Geparst wurde an zwei Grenzen: im MCP-Server und am Host-Socket. Wer `handler()` direkt
 * rief — `import-code`, der Auto-Export, die Tests —, bekam die Eingabe roh: ohne Defaults
 * und ohne Prüfung. `graph_elements({})` lieferte dann alle Knoten statt der Default-Grenze 100.
 *
 * Disk-Kuzu im Temp-Verzeichnis, 120 Knoten durchs Gate — mehr als die Default-Grenze.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import type { MutateCommand } from '@sigloch/contracts/harness';

describe('TEST-werkzeug-eingang-geparst', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-eingang-'));
    mkdirSync(join(tmp, '.graphcode'), { recursive: true });
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, '.graphcode', 'kuzu') });
    harness = new GraphCodeHarness(
      {
        repoRoot: tmp,
        scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
        consumerType: 'system',
        preCommitTimeout: 5000,
      },
      storage,
    );
    await harness.initialize();
    const commands: MutateCommand[] = Array.from({ length: 120 }, (_, i) => ({
      op: 'add-node',
      node: { uid: `MOD-m${i}`, type: 'MOD', name: `m${i}`, description: '', attributes: {} },
    }));
    const applied = await harness.mutate(commands);
    expect(applied.success, JSON.stringify(applied.violations.slice(0, 2))).toBe(true);
  });

  afterAll(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('ein direkter Aufruf bekommt die Defaults des Schemas', async () => {
    expect(harness.getGraph().nodes.length).toBeGreaterThan(100);
    const res = (await bindToolsToHarness(harness).graph_elements.handler({})) as { nodes: unknown[]; total: number };
    expect(res.total).toBe(harness.getGraph().nodes.length);
    expect(res.nodes.length, 'Default limit 100 aus GraphElementsInputSchema').toBe(100);
  });

  it('ein direkter Aufruf mit ungültiger Eingabe scheitert an der Prüfung, nicht im Werkzeug', async () => {
    await expect(bindToolsToHarness(harness).graph_elements.handler({ limit: -1 })).rejects.toThrow(/limit|too_small|greater than/i);
  });
});
