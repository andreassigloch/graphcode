/**
 * TEST-formate-binding (CR-GC-334) — eine über Format-E gesetzte Bindung kommt am Gate an.
 *
 * Der gemessene Schaden (Modellierung CR-GC-332, 2026-08-13): ein Batch mit `@realRef`/
 * `@testRef` je Knoten kam mit R-19/R-20 für JEDEN dieser Knoten zurück — „Bindung fehlt",
 * obwohl jede Zeile eine trug. Ursache: `FormatECodec.parse` reichte den `@key`-Wert als
 * String durch, und `RealRefSchema`/`TestRefSchema` weisen einen String ab. Damit war der
 * Format-E-Pfad für gebundene Elemente unbenutzbar — und genau für ihn wirbt die
 * Tool-Beschreibung („~2–3× weniger Tokens").
 *
 * Geprüft wird deshalb nicht der Codec (das tut graph-api-core), sondern die Wirkung
 * DORT, WO SIE ZÄHLT: nach dem Gate darf die Regel nicht feuern.
 *
 * Reales Disk-Kuzu im tmp-Verzeichnis, nie `:memory:`. Keine Mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness, type MCPToolRegistry } from '../src/mcp-tools.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

const SEED = {
  elements: [
    { id: 'SYS-x', type: 'SYS', name: 'Beispielsystem', description: 'Ein System.' },
    {
      id: 'REQ-seed',
      type: 'REQ',
      name: 'Bestehende Anforderung',
      description: 'Das System muss eine Bindung ueber Format-E annehmen koennen.',
    },
  ],
  traces: [],
};

/** FUNC mit realRef, TEST mit testRef — beide als `@key {json}`-Folgezeile. */
const BOUND_BATCH =
  '## Nodes\n' +
  '### FUNC\n' +
  '+ FUNC-bound|Erfuellt die bestehende Anforderung. [__name:boundFunction(x)]\n' +
  '@realRef {"file":"src/steering.ts","symbol":"nextStep","lang":"ts"}\n' +
  '### TEST\n' +
  '+ TEST-bound|Prueft die bestehende Anforderung. [__name:Bindungs-Test,method:test]\n' +
  '@testRef {"file":"tests/steering.test.ts","tool":"vitest","level":"integration"}\n' +
  '\n## Edges\n' +
  '+ FUNC-bound -satisfy-> REQ-seed\n' +
  '+ TEST-bound -verify-> REQ-seed\n';

/** Dieselben Knoten OHNE Bindung — der Kontrast, der zeigt, dass die Regel überhaupt feuert. */
const UNBOUND_BATCH =
  '## Nodes\n' +
  '### FUNC\n' +
  '+ FUNC-unbound|Erfuellt die bestehende Anforderung auch. [__name:unboundFunction(x)]\n' +
  '\n## Edges\n' +
  '+ FUNC-unbound -satisfy-> REQ-seed\n';

type MutateOut = { success: boolean; violations: Array<{ ruleId: string; elementId?: string }> };

describe('TEST-formate-binding: @realRef/@testRef ueberleben den Format-E-Schreibpfad (CR-GC-334)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-formate-binding-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(SEED);
    tools = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('R-20/R-19 feuern nicht fuer Knoten, die ihre Bindung als @key-Zeile mitbringen', async () => {
    const res = (await tools.graph_mutate.handler({
      formatE: BOUND_BATCH,
      consumerId: 'test',
    })) as MutateOut;

    expect(res.success).toBe(true);

    const open = harness.evaluateRules();
    expect(open.filter((v) => v.ruleId === 'R-20' && v.elementId === 'FUNC-bound')).toEqual([]);
    expect(open.filter((v) => v.ruleId === 'R-19' && v.elementId === 'TEST-bound')).toEqual([]);
  });

  it('die Bindung liegt als OBJEKT im Graphen, nicht als String', async () => {
    await tools.graph_mutate.handler({ formatE: BOUND_BATCH, consumerId: 'test' });

    const func = harness.getGraph().nodes.find((n) => n.uid === 'FUNC-bound')!;
    expect(func.attributes.realRef).toEqual({
      file: 'src/steering.ts',
      symbol: 'nextStep',
      lang: 'ts',
    });
    const test = harness.getGraph().nodes.find((n) => n.uid === 'TEST-bound')!;
    expect(test.attributes.testRef).toEqual({
      file: 'tests/steering.test.ts',
      tool: 'vitest',
      level: 'integration',
    });
  });

  /**
   * Der Kontrast: ohne den würde der Test auch dann grün, wenn R-20 gar nicht mehr
   * ausgewertet wird. Rot-zuerst heißt hier: die Regel muss beweisbar noch feuern.
   */
  it('R-20 feuert weiterhin fuer eine FUNC ohne Bindung', async () => {
    const res = (await tools.graph_mutate.handler({
      formatE: UNBOUND_BATCH,
      consumerId: 'test',
    })) as MutateOut;

    expect(res.success).toBe(true);
    expect(
      harness.evaluateRules().some((v) => v.ruleId === 'R-20' && v.elementId === 'FUNC-unbound'),
    ).toBe(true);
  });
});
