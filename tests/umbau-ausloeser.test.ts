/**
 * CR-GC-934 — Auslöser für graph_suggest.
 *
 * Ein offener Befund einer Regel mit Zug (se-engine `STEER_OPERATORS`) lässt `graph_generate` und
 * `rules_get_violations` im Feld `umbau` `graph_suggest` nennen. Nach einem Aufruf von graph_suggest
 * schweigt das Feld, bis sich Modellstand und Befundmenge geändert haben. Real disk Kuzu, keine Mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { STEER_OPERATORS } from '@sigloch/se-engine';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { HarnessConfig } from '@sigloch/contracts/harness';
import { KuzuAdapter } from './helpers/store.js';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness, type ToolRegistry } from '../src/surface/mcp-tools.js';
import { AUSLOESER_REGELN, gedaempft, hinweisAus, merkeSuggestAufruf } from '../src/loop/umbau-ausloeser.js';

describe('CR-GC-934: welche Regeln auslösen', () => {
  it('die Liste ist die Zug-Tabelle von se-engine, keine zweite', () => {
    expect(AUSLOESER_REGELN).toEqual(Object.keys(STEER_OPERATORS).sort());
  });

  // Stand 2026-11-19. Ändert se-engine die Tabelle, muss der FAQ-Eintrag `architektur-vor-hygiene`
  // (aise-bok) dieselbe Liste nennen — dieser Test zeigt die Änderung an.
  it('Stand heute: BW-02, CR-01, R-04, RD-04; MT-02 hat keinen Zug', () => {
    expect(AUSLOESER_REGELN).toEqual(['BW-02', 'CR-01', 'R-04', 'RD-04']);
    expect(hinweisAus([{ ruleId: 'MT-02', elementId: 'MOD-a' }])).toBeNull();
  });

  it.each(AUSLOESER_REGELN)('ein offener Befund von %s nennt graph_suggest', (ruleId) => {
    expect(hinweisAus([{ ruleId, elementId: 'X-1' }])).toEqual({
      werkzeug: 'graph_suggest',
      befunde: [{ ruleId, elementId: 'X-1' }],
    });
  });

  it('ein Befund ohne Element löst nicht aus; Doppel stehen einmal', () => {
    expect(hinweisAus([{ ruleId: 'R-04' }])).toBeNull();
    expect(hinweisAus([{ ruleId: 'R-04', elementId: 'A' }, { ruleId: 'R-04', elementId: 'A' }])?.befunde).toHaveLength(1);
  });
});

describe('CR-GC-934: neu rufen erst nach einer Modelländerung', () => {
  const owner = {};
  const a = hinweisAus([{ ruleId: 'RD-04', elementId: 'FUNC-a' }]);
  const ab = hinweisAus([{ ruleId: 'RD-04', elementId: 'FUNC-a' }, { ruleId: 'RD-04', elementId: 'FUNC-b' }]);

  it('vor dem ersten Aufruf steht der Hinweis', () => {
    expect(gedaempft(owner, 5, a)).toEqual(a);
  });

  it('nach dem Aufruf schweigt er bei gleichem Stand oder gleicher Befundmenge, neu bei beidem geändert', () => {
    merkeSuggestAufruf(owner, 5, a!.befunde);
    expect(gedaempft(owner, 5, a)).toBeNull();
    expect(gedaempft(owner, 6, a)).toBeNull();
    expect(gedaempft(owner, 6, ab)).toEqual(ab);
  });
});

function makeConfig(repoRoot: string): HarnessConfig {
  return { repoRoot, scope: { workspaceId: 'test-ws', systemId: 'graphcode' }, consumerType: 'system', preCommitTimeout: 5000 };
}

const kinder = (eltern: string) => Array.from({ length: 12 }, (_, i) => `${eltern}-k${i}`);

/** Eine FUNC mit zwölf FUNC-Kindern: RD-04 meldet an ihr. */
const FIXTURE = {
  elements: [
    { id: 'SYS-s', type: 'SYS', name: 's', description: 'System' },
    { id: 'FUNC-root', type: 'FUNC', name: 'root', description: 'Wurzel' },
    ...kinder('FUNC-root').map((id) => ({ id, type: 'FUNC', name: id, description: 'Kind' })),
  ],
  traces: [
    { source: 'SYS-s', target: 'FUNC-root', type: 'compose' },
    ...kinder('FUNC-root').map((k) => ({ source: 'FUNC-root', target: k, type: 'compose' })),
  ],
};

describe('CR-GC-934: graph_generate und rules_get_violations nennen graph_suggest', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let tools: ToolRegistry;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-umbau-'));
    harness = new GraphCodeHarness(makeConfig(tmp), new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') }));
    await harness.initialize();
    await harness.importGraph(FIXTURE);
    tools = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  const umbauBeider = async () => [
    (await tools.rules_get_violations.handler({})).umbau,
    (await tools.graph_generate.handler({ peek: true })).umbau,
  ];

  it('nennen den offenen RD-04-Befund, schweigen nach graph_suggest, melden neu nach einer Änderung von Stand und Befundmenge', async () => {
    const offen = { werkzeug: 'graph_suggest', befunde: [{ ruleId: 'RD-04', elementId: 'FUNC-root' }] };
    expect(await umbauBeider()).toEqual([offen, offen]);

    await tools.graph_suggest.handler({});
    expect(await umbauBeider()).toEqual([null, null]);

    // Modell geändert, Befundmenge gleich: weiter still.
    const r1 = await tools.graph_mutate.handler({ formatE: '## Nodes\n### FUNC\n+ FUNC-extra|Ein weiterer Knoten [__name:extra]' });
    expect(r1.success).toBe(true);
    expect(await umbauBeider()).toEqual([null, null]);

    // Zweite FUNC mit zwölf Kindern unter der ersten: neuer RD-04-Befund, der Hinweis kommt wieder.
    const zweite = kinder('FUNC-root2');
    const r2 = await tools.graph_mutate.handler({
      formatE:
        '## Nodes\n### FUNC\n+ FUNC-root2|Zweite Wurzel [__name:root2]\n' +
        zweite.map((k) => `+ ${k}|Kind [__name:${k}]`).join('\n') +
        `\n\n## Edges\n+ FUNC-root -compose-> FUNC-root2\n+ FUNC-root2 -compose-> ${zweite.join(', ')}`,
    });
    expect(r2.success).toBe(true);
    const neu = (await tools.rules_get_violations.handler({})).umbau;
    expect(neu?.befunde).toEqual([
      { ruleId: 'RD-04', elementId: 'FUNC-root' },
      { ruleId: 'RD-04', elementId: 'FUNC-root2' },
    ]);
  });
});
