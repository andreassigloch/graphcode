/**
 * TEST-graph-realize (CR-GC-216, seit CR-GC-685 ueber graph_mutate) — Binden ist ein Format-E-Patch.
 *
 * `~ FUNC-x` + `@realRef {…}` (bzw. `@testRefs [...]` an einer TEST, `@realRef` an einem SCHEMA)
 * laeuft durch DASSELBE Gate wie jeder Write. Was frueher nur graph_realize lieferte — welche
 * fehlenden Code-Verweise (R-19/R-20/R-26) der Batch geschlossen oder aufgerissen hat und wie viele
 * offen bleiben — steht jetzt als `refs` im graph_mutate-Ergebnis. Real disk Kuzu.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

/** Die Zeilen des Audit-Trails — CR-GC-611 prueft daran, dass ein Batch EIN Eintrag ist. */
function readAuditLines(repoRoot: string): string[] {
  const p = join(repoRoot, '.graphcode', 'audit.jsonl');
  return existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter(Boolean) : [];
}

function makeHarness(repoRoot: string): GraphCodeHarness {
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'demo-ws', systemId: 'realize-svc' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

// A realized FUNC with no realRef (R-20) and a realized TEST with no testRefs (R-19) — both warnings,
// so the gate accepts the seed; the Format-E patch then clears them.
// FN-begonnen traegt bereits eine Bindung: die Realisierung HAT begonnen (contracts CR-SM-392), also
// sind R-19/R-20/R-26 gestellt und melden an FN-x / TEST-x. Ohne sie waere der Graph ein Entwurf,
// die Regeln schwiegen, und der Report haette nichts zu schliessen (eigener Fall unten).
const SPEC: MutateCommand[] = [
  { op: 'add-node', node: { uid: 'FN-begonnen', type: 'FUNC', name: 'Already bound', description: '', attributes: { realRef: { file: 'src/begonnen.ts', symbol: 'begonnen' } } } },
  { op: 'add-node', node: { uid: 'FN-x', type: 'FUNC', name: 'Do x', description: '', attributes: {} } },
  { op: 'add-node', node: { uid: 'TEST-x', type: 'TEST', name: 'x test', description: '', attributes: {} } },
];

/** Ein Format-E-Block aus Zeilen — `## Nodes` vorneweg, die Typ-Sektionen nennt der Aufrufer. */
const fe = (...lines: string[]): string => ['## Nodes', ...lines].join('\n');
const ref = (v: unknown): string => JSON.stringify(v);

describe('TEST-graph-realize (CR-GC-685): Binden per Format-E, Bindungsreport im mutate-Ergebnis', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-realize-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
    await harness.mutate(SPEC);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('graph_realize ist nicht mehr auf der Oberflaeche (CR-GC-685B)', () => {
    expect(bindToolsToHarness(harness)).not.toHaveProperty('graph_realize');
  });

  it('`~ FN-x @realRef` setzt die realRef durchs Gate; das Ergebnis traegt das Delta der Verweise', async () => {
    const tools = bindToolsToHarness(harness);
    const out = await tools.graph_mutate.handler({
      formatE: fe('### FUNC', '~ FN-x', `@realRef ${ref({ file: 'src/x.ts', symbol: 'doX' })}`),
    });

    expect(out.success).toBe(true);
    expect(out.refs).toEqual({ resolved: ['FN-x'], introduced: [], openRefs: 1 }); // TEST-x (R-19) bleibt offen
    const fn = harness.getGraph().nodes.find((n) => n.uid === 'FN-x')!;
    expect(fn.attributes.realRef).toEqual({ file: 'src/x.ts', symbol: 'doX' });
  });

  it('`@testRefs` an einer TEST schliesst R-19 im selben Batch', async () => {
    const tools = bindToolsToHarness(harness);
    const out = await tools.graph_mutate.handler({
      formatE: fe(
        '### FUNC', '~ FN-x', `@realRef ${ref({ file: 'src/x.ts', symbol: 'doX' })}`,
        '### TEST', '~ TEST-x', `@testRefs ${ref([{ file: 'tests/x.test.ts', tool: 'vitest' }])}`,
      ),
    });

    expect(out.refs?.resolved).toEqual(expect.arrayContaining(['FN-x', 'TEST-x']));
    expect(out.refs?.openRefs).toBe(0);
    const test = harness.getGraph().nodes.find((n) => n.uid === 'TEST-x')!;
    expect(test.attributes.testRefs).toEqual([{ file: 'tests/x.test.ts', tool: 'vitest' }]);
  });

  // CR-211: SCHEMA realRef (R-26) auf demselben Weg.
  it('bindet eine SCHEMA-realRef; R-26 schliesst', async () => {
    const tools = bindToolsToHarness(harness);
    await harness.mutate([
      { op: 'add-node', node: { uid: 'SCHEMA-x', type: 'SCHEMA', name: 'evt', description: '', attributes: {} } },
    ]);
    const out = await tools.graph_mutate.handler({
      formatE: fe('### SCHEMA', '~ SCHEMA-x', `@realRef ${ref({ file: 'src/se/ontology.ts', symbol: 'EventSchema' })}`),
    });

    expect(out.success).toBe(true);
    expect(out.refs?.resolved).toContain('SCHEMA-x');
    const sc = harness.getGraph().nodes.find((n) => n.uid === 'SCHEMA-x')!;
    expect(sc.attributes.realRef).toEqual({ file: 'src/se/ontology.ts', symbol: 'EventSchema' });
  });

  // contracts CR-SM-392 — die Klippe der ersten Bindung, am Report sichtbar: im Entwurf (keine
  // Bindung, kein Bauplan-Stempel) sind die Bindungsregeln nicht gestellt. Die ERSTE Bindung beginnt
  // die Realisierung; damit melden alle uebrigen ungebundenen Elemente — der Report nennt sie als
  // `introduced`, und `resolved` bleibt leer, weil vorher nichts gemeldet war.
  it('die ERSTE Bindung in einem Entwurf: nichts war offen, die uebrigen melden ab jetzt', async () => {
    const entwurfRoot = mkdtempSync(join(tmpdir(), 'graphcode-realize-entwurf-'));
    const entwurf = makeHarness(entwurfRoot);
    try {
      await entwurf.initialize();
      await entwurf.mutate(SPEC.filter((c) => c.op !== 'add-node' || c.node.uid !== 'FN-begonnen'));
      const bindingRules = (h: GraphCodeHarness) => h.evaluateRules().filter((v) => ['R-19', 'R-20', 'R-26'].includes(v.ruleId));
      expect(bindingRules(entwurf)).toEqual([]); // Entwurf: nicht gestellt

      const out = await bindToolsToHarness(entwurf).graph_mutate.handler({
        formatE: fe('### FUNC', '~ FN-x', `@realRef ${ref({ file: 'src/x.ts', symbol: 'doX' })}`),
      });
      expect(out.success).toBe(true);
      expect(out.refs).toEqual({ resolved: [], introduced: ['TEST-x'], openRefs: 1 });
      expect(bindingRules(entwurf).map((v) => `${v.ruleId}:${v.elementId}`)).toEqual(['R-19:TEST-x']);
    } finally {
      await entwurf.close();
      rmSync(entwurfRoot, { recursive: true, force: true });
    }
  });

  it('ein Batch, der keine Bindung beruehrt, traegt kein refs-Feld (Schweigen kostet null Zeichen)', async () => {
    const tools = bindToolsToHarness(harness);
    const out = await tools.graph_mutate.handler({ formatE: fe('### FUNC', '~ FN-x|Tut x') });
    expect(out.success).toBe(true);
    expect(out).not.toHaveProperty('refs');
  });

  it('mehrere Bindungen in EINEM Batch — ein Audit-Eintrag, alle Verweise geschlossen', async () => {
    const tools = bindToolsToHarness(harness);
    await harness.mutate([
      { op: 'add-node', node: { uid: 'FN-y', type: 'FUNC', name: 'Do y', description: '', attributes: {} } },
    ]);
    const vorher = readAuditLines(repoRoot);
    const out = await tools.graph_mutate.handler({
      formatE: fe(
        '### FUNC',
        '~ FN-x', `@realRef ${ref({ file: 'src/x.ts', symbol: 'doX' })}`,
        '~ FN-y', `@realRef ${ref({ file: 'src/y.ts', symbol: 'doY' })}`,
        '### TEST', '~ TEST-x', `@testRefs ${ref([{ file: 'tests/x.test.ts', tool: 'vitest' }])}`,
      ),
    });

    expect(out.success).toBe(true);
    expect(out.refs?.resolved).toEqual(expect.arrayContaining(['FN-x', 'FN-y', 'TEST-x']));
    expect(out.refs?.openRefs).toBe(0);
    expect(readAuditLines(repoRoot).length - vorher.length).toBe(1);
  });

  it('ein unbekannter Knoten lehnt den GANZEN Batch ab — keine Teilanwendung, kein Phantom-Knoten', async () => {
    const tools = bindToolsToHarness(harness);
    const out = await tools.graph_mutate.handler({
      formatE: fe(
        '### FUNC',
        '~ FN-x', `@realRef ${ref({ file: 'src/x.ts', symbol: 'doX' })}`,
        '~ FN-nope', `@realRef ${ref({ file: 'src/nope.ts', symbol: 'nope' })}`,
      ),
    });

    expect(out.success).toBe(false);
    expect(out.violations.map((v) => v.message).join(' ')).toMatch(/FN-nope.*does not exist/);
    expect(out).not.toHaveProperty('refs');
    const nodes = harness.getGraph().nodes;
    expect(nodes.find((n) => n.uid === 'FN-nope')).toBeUndefined();
    expect(nodes.find((n) => n.uid === 'FN-x')!.attributes.realRef).toBeUndefined();
  });
});
