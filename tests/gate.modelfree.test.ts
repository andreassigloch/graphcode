/**
 * TEST-reduced-llm (gebunden in CR-GC-719) — Gate und Regelprüfung laufen ohne Modell.
 *
 * Zusage (REQ-graceful-degradation, REQ-post-modelfree-gate): bei nicht erreichbarem LLM bleibt
 * der Harness voll funktionsfähig — Apply, Regel-Evaluation und Readiness sind deterministisch
 * und machen keinen einzigen Modell-Call. Eine LLM-Zusatzfunktion trägt der Host seit CR-GC-775
 * nicht mehr (der eingebettete Executor ist ausgelagert).
 *
 * „Nicht erreichbar" ist hier wörtlich: `fetch` ist für die Dauer des Tests eine Stolperfalle, die
 * jeden Aufruf zählt und abweist. Das ersetzt kein Stück graphcode, es nimmt ihm nur das Netz.
 * Kuzu auf Platte in mkdtemp.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';
import { KuzuAdapter } from './helpers/store.js';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';

const validSet: MutateCommand[] = [
  { op: 'add-node', node: { uid: 'REQ-m', type: 'REQ', name: 'm', description: '', attributes: {} } },
  { op: 'add-node', node: { uid: 'TEST-m', type: 'TEST', name: 'm', description: '', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'TEST-m', targetId: 'REQ-m', edgeType: 'verify', attributes: {} } },
];
const lonelyReq: MutateCommand[] = [
  { op: 'add-node', node: { uid: 'REQ-allein', type: 'REQ', name: 'allein', description: '', attributes: {} } },
];

/** Das Verdict ohne das, was sich per Uhr unterscheiden darf. */
const kern = (r: { success: boolean; tier?: string; mutations: number; violations: Array<{ ruleId?: string; rule_id?: string; severity?: string }> }) => ({
  success: r.success,
  tier: r.tier,
  mutations: r.mutations,
  violations: r.violations.map((v) => `${v.ruleId ?? v.rule_id}:${v.severity}`).sort(),
});

describe('TEST-reduced-llm: das Gate braucht kein Modell', () => {
  let tmp: string;
  let echtesFetch: typeof globalThis.fetch;
  let netzAufrufe: number;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-modelfree-'));
    echtesFetch = globalThis.fetch;
    netzAufrufe = 0;
    globalThis.fetch = (() => {
      netzAufrufe++;
      return Promise.reject(new Error('LLM nicht erreichbar'));
    }) as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = echtesFetch;
    rmSync(tmp, { recursive: true, force: true });
  });

  async function lauf(name: string) {
    const config: HarnessConfig = {
      repoRoot: join(tmp, name),
      scope: { workspaceId: 'w', systemId: name },
      consumerType: 'system',
      preCommitTimeout: 5000,
    };
    const harness = new GraphCodeHarness(config, new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, `kuzu-${name}`) }));
    await harness.initialize();
    try {
      const angewandt = await harness.mutate(validSet);
      const geblockt = await harness.mutate(lonelyReq);
      const regeln = (await harness.evaluateRules()).map((v) => `${v.ruleId}:${v.severity}`).sort();
      // computedAt ist ein Uhrstempel, keine Messung.
      const { computedAt: _uhr, ...readiness } = (await bindToolsToHarness(harness).graph_readiness.handler({})) as Record<string, unknown>;
      return { angewandt: kern(angewandt), geblockt: kern(geblockt), regeln, readiness };
    } finally {
      await harness.close();
    }
  }

  it('Apply, Block, Regel-Evaluation und Readiness laufen ohne einen Netz-Aufruf', async () => {
    const a = await lauf('a');
    expect(netzAufrufe).toBe(0);
    expect(a.angewandt).toMatchObject({ success: true, mutations: 3 });
    expect(a.geblockt).toMatchObject({ success: false, tier: 'block', mutations: 0 });
    expect(a.geblockt.violations).toContain('R-01:error');
  });

  it('deterministisch: zwei unabhängige Läufe liefern dieselben Verdicts und dieselbe Readiness', async () => {
    const a = await lauf('a');
    const b = await lauf('b');
    expect(b.angewandt).toEqual(a.angewandt);
    expect(b.geblockt).toEqual(a.geblockt);
    expect(b.regeln).toEqual(a.regeln);
    expect(b.readiness).toEqual(a.readiness);
    expect(netzAufrufe).toBe(0);
  });
});
