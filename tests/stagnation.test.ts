/**
 * CR-GC-596 — die Abbruchregel: zweimal dasselbe Feedback nach einem Zug → weiter; nur noch
 * Zurueckgestelltes → `stalled`, nie `done`.
 *
 * Gemessen in Lauf 11: R-04 stand sechsmal hintereinander im Fokus, kein Zug bewegte den Term,
 * sieben Zuege verbrannt. Ein MCP-Host hatte kein Gedaechtnis; der Executor zaehlte fuer sich.
 * Echte Kuzu, echtes Gate, der Zug ohne Wirkung ist eine echte Mutation (Beschreibung am SYS).
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness, bindToolsToHarness, type GraphCodeHarness } from '../src/index.js';

type Antwort = { success: boolean; next?: { phase: string; done: boolean; focusKey: string | null; prompt: string } };
let repoRoot: string;
let harness: GraphCodeHarness;
let tools: ReturnType<typeof bindToolsToHarness>;

const knoten = (uid: string, type: string, name: string, description: string) =>
  ({ op: 'add-node', node: { uid, type, name, description, attributes: {} } });
const kante = (sourceId: string, targetId: string, edgeType: string) =>
  ({ op: 'add-edge', edge: { sourceId, targetId, edgeType, attributes: {} } });
let n = 0;
/** Ein Zug, der die Version hebt und keinen Fund loest. */
const zugOhneWirkung = async (): Promise<Antwort> =>
  (await tools.graph_mutate.handler({
    commands: [{ op: 'update-node', node: { uid: 'SYS-s', description: `Ein System fuer Bestellungen, Fassung ${++n}.` } }],
    consumerId: 'test',
  })) as Antwort;

beforeEach(async () => {
  repoRoot = mkdtempSync(join(tmpdir(), 'gc-stag-'));
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  harness = await createHarness({ repoRoot, scope: { workspaceId: 'w', systemId: 's' } });
  await harness.initialize();
  tools = bindToolsToHarness(harness);
  // SYS + UC + ACTOR: die Saat ist durch, die Maschine steht in expand mit echten Funden.
  const r = (await tools.graph_mutate.handler({
    commands: [
      knoten('SYS-s', 'SYS', 'S', 'Ein System fuer Bestellungen.'),
      knoten('UC-a', 'UC', 'Bestellen', 'Kunde bestellt ein Teil und erhaelt eine Bestaetigung.'),
      knoten('ACTOR-k', 'ACTOR', 'Kunde', 'Wer bestellt.'),
      kante('SYS-s', 'UC-a', 'compose'),
    ],
    consumerId: 'test',
  })) as Antwort;
  expect(r.success).toBe(true);
});
afterEach(async () => {
  await harness.close();
  rmSync(repoRoot, { recursive: true, force: true });
});

describe('CR-GC-596: zweimal dasselbe Feedback → weiter', () => {
  it('derselbe Fokus nach einem Zug ohne Wirkung wird zurueckgestellt — next nennt einen anderen', async () => {
    const erst = await tools.graph_generate.handler({});
    expect(erst.phase).toBe('expand');
    const nach = await zugOhneWirkung();
    expect(nach.next!.focusKey).not.toBe(erst.focusKey);
  });

  it('zweimal graph_generate OHNE Zug: gleiche Antwort — kein Zug, kein Abbruch (Determinismus)', async () => {
    const a = await tools.graph_generate.handler({});
    const b = await tools.graph_generate.handler({});
    expect(b.focusKey).toBe(a.focusKey);
  });

  it('der Treiber (selection driver) fuehrt vorerst selbst Buch — die Maschine stellt fuer ihn nichts zurueck', async () => {
    const a = await tools.graph_generate.handler({ selection: 'driver' });
    await zugOhneWirkung();
    const b = await tools.graph_generate.handler({ selection: 'driver' });
    expect(b.focusKey).toBe(a.focusKey);
  });
});

describe('CR-GC-596: nur noch Zurueckgestelltes → stalled, nicht done', () => {
  it('nach genug Zuegen ohne Wirkung endet die Maschine stalled — mit Liste, ohne Fokus, nie done', async () => {
    let s = await tools.graph_generate.handler({});
    let letzte: Antwort['next'] = undefined;
    for (let i = 0; i < 60 && s.phase !== 'stalled'; i++) {
      const r = await zugOhneWirkung();
      letzte = r.next;
      if (letzte!.phase === 'stalled') break;
    }
    expect(letzte!.phase).toBe('stalled');
    expect(letzte!.done).toBe(false);
    expect(letzte!.focusKey).toBeNull();
    expect(letzte!.prompt).toMatch(/Festgefahren/);
    expect(letzte!.prompt).toMatch(/Nicht weiter mutieren/);
  });

  it('stalled gilt auch fuer graph_generate — dasselbe Gedaechtnis wie next', async () => {
    for (let i = 0; i < 60; i++) {
      const r = await zugOhneWirkung();
      if (r.next!.phase === 'stalled') break;
    }
    const s = await tools.graph_generate.handler({});
    expect(s.phase).toBe('stalled');
    expect(s.done).toBe(false);
  });
});
