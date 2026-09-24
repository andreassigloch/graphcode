/**
 * CR-GC-588 — der naechste Schritt faehrt mit der angewandten Mutation mit.
 *
 * Runde 7/8: ~55 % der Mutationen kamen ohne frisches `graph_generate`; dort steuerte nur die
 * Gate-Antwort. `next` ist DERSELBE Schritt, den `graph_generate` unmittelbar danach liefern
 * wuerde — keine zweite Stimme, ein Roundtrip weniger. Nur nach Anwendung, nie auf Probe oder
 * Ablehnung. Echte Kuzu, echtes Gate.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness, bindToolsToHarness, type GraphCodeHarness } from '../src/index.js';
import { compactStep, NextStep } from '../src/loop/next-step.js';

type Antwort = Record<string, unknown>;
let repoRoot: string;
let harness: GraphCodeHarness;
let tools: ReturnType<typeof bindToolsToHarness>;

const knoten = (uid: string, type: string, name: string, description: string) =>
  ({ op: 'add-node', node: { uid, type, name, description, attributes: {} } });
const SYS = knoten('SYS-s', 'SYS', 'S', 'Ein System, das Bestellungen fuer Kunden annimmt und liefert.');

beforeEach(async () => {
  repoRoot = mkdtempSync(join(tmpdir(), 'gc-next-'));
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  harness = await createHarness({ repoRoot, scope: { workspaceId: 'w', systemId: 's' } });
  await harness.initialize();
  tools = bindToolsToHarness(harness);
});
afterEach(async () => {
  await harness.close();
  rmSync(repoRoot, { recursive: true, force: true });
});

describe('CR-GC-588: next an der angewandten Mutation', () => {
  it('ist genau der Schritt, den graph_generate danach liefert — kompakt, ohne Protokoll und Tabellen', async () => {
    const antwort = (await tools.graph_mutate.handler({ commands: [SYS], consumerId: 'test' })) as Antwort;
    expect(antwort.success).toBe(true);
    const next = NextStep.parse(antwort.next);
    const gen = await tools.graph_generate.handler({});
    expect(next).toEqual(compactStep(gen));
    expect(next.phase).toBe('seed');
    expect(next.focusDimension).toBe('seed:uc');
    expect(gen.prompt.startsWith(next.prompt)).toBe(true);
    expect(next.prompt).not.toContain('Gate-Protokoll');
    expect(antwort.next).not.toHaveProperty('readiness');
    expect(antwort.next).not.toHaveProperty('phaseReadiness');
  });

  it('kostet wenig: next ist kleiner als der Prompt, den es ersetzt', async () => {
    const antwort = (await tools.graph_mutate.handler({ commands: [SYS], consumerId: 'test' })) as Antwort;
    const gen = await tools.graph_generate.handler({});
    expect(JSON.stringify(antwort.next).length).toBeLessThan(JSON.stringify(gen).length);
  });

  it('nicht auf der Probe und nicht auf der Ablehnung — dort ist das Urteil der Kanal', async () => {
    const probe = (await tools.graph_mutate.handler({ commands: [SYS], consumerId: 'test', dryRun: true })) as Antwort;
    expect(probe).not.toHaveProperty('next');
    await tools.graph_mutate.handler({ commands: [SYS], consumerId: 'test' });
    // Eine illegale Kante (R-18) wird abgelehnt.
    const abgelehnt = (await tools.graph_mutate.handler({
      commands: [knoten('MOD-m', 'MOD', 'M', 'Ein Modul.'), { op: 'add-edge', edge: { sourceId: 'SYS-s', targetId: 'MOD-m', edgeType: 'verify', attributes: {} } }],
      consumerId: 'test',
    })) as Antwort;
    expect(abgelehnt.success).toBe(false);
    expect(abgelehnt).not.toHaveProperty('next');
  });

  it('der Host-Prompt zeigt auf next, der Treiber-Prompt nicht', async () => {
    await tools.graph_mutate.handler({ commands: [SYS], consumerId: 'test' });
    const host = await tools.graph_generate.handler({});
    expect(host.prompt).toContain('als `next` in der Antwort');
    const driver = await tools.graph_generate.handler({ selection: 'driver' });
    expect(driver.prompt, 'CR-GC-647: der Treiber ruft graph_generate, nicht das Modell').not.toContain('graph_generate');
    expect(driver.prompt).not.toContain('`next`');
  });
});
