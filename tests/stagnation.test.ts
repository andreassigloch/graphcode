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

describe('CR-GC-596/606: dreimal dasselbe Feedback → weiter', () => {
  it('nach einem Zug ohne Wirkung bleibt der Fokus (Folgezug ist kein Versuch), nach dem zweiten kommt ein anderer', async () => {
    const erst = await tools.graph_generate.handler({});
    expect(erst.phase).toBe('expand');
    const eins = await zugOhneWirkung();
    expect(eins.next!.focusKey).toBe(erst.focusKey);
    const zwei = await zugOhneWirkung();
    expect(zwei.next!.focusKey).not.toBe(erst.focusKey);
  });

  it('graph_generate ohne Zug dazwischen zaehlt nicht und setzt den Zaehler nicht zurueck', async () => {
    const erst = await tools.graph_generate.handler({});
    await zugOhneWirkung();
    expect((await tools.graph_generate.handler({})).focusKey).toBe(erst.focusKey);
    const zwei = await zugOhneWirkung();
    expect(zwei.next!.focusKey).not.toBe(erst.focusKey);
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

/** Alle Eintrittspunkte abnehmen — sonst bleibt immer einer offen (CR-GC-604) und stalled ist unerreichbar. */
const eintritteAbnehmen = async () => {
  const acceptedFindings = ['AF-01', 'AF-02', 'AF-03', 'AF-04', 'AF-05'].map((ruleId) => ({ ruleId, reason: 'schlanker Umfang' }));
  const r = (await tools.graph_mutate.handler({
    commands: [{ op: 'update-node', node: { uid: 'SYS-s', attributes: { acceptedFindings } } }],
    consumerId: 'test',
  })) as Antwort;
  expect(r.success).toBe(true);
};

describe('CR-GC-604: Eintrittspunkte stellt die Abbruchregel nie zurueck', () => {
  it('bleibt ein Eintrittspunkt nach Zuegen ohne Wirkung stehen, nennt next weiter ihn — mit dem Skill des Tasks', async () => {
    let r: Antwort | undefined;
    for (let i = 0; i < 60; i++) {
      r = await zugOhneWirkung();
      if (/:AF-0\d:/.test(r.next!.focusKey ?? '')) break;
    }
    const eintritt = r!.next!.focusKey!;
    expect(eintritt).toMatch(/:AF-0\d:/);
    const danach = (await zugOhneWirkung()) as { next?: { focusKey: string | null; skill: string | null } };
    expect(danach.next!.focusKey).toBe(eintritt);
    expect(danach.next!.skill).toMatch(/^se-(conops|trade|irr|fmea|plan)$/);
  });

  it('festgefahren im Task heisst: zurueck in den Kern, nicht "uebergib an den Menschen"', async () => {
    await tools.graph_mutate.handler({
      commands: [
        knoten('MS-1', 'MS', 'Fundament', 'Erster Meilenstein.'),
        { op: 'update-node', node: { uid: 'SYS-s', attributes: { acceptedFindings: [{ ruleId: 'AF-05', reason: 'schlank' }] } } },
      ],
      consumerId: 'test',
    });
    const s = await tools.graph_generate.handler({ task: 'plan' });
    expect(s.phase).toBe('expand');
    let letzte: Antwort['next'];
    for (let i = 0; i < 20; i++) {
      letzte = (await zugOhneWirkung()).next;
      if (letzte!.phase === 'stalled') break;
    }
    expect(letzte!.phase).toBe('stalled');
    expect(letzte!.prompt).toMatch(/Task plan festgefahren/);
    expect(letzte!.prompt).toMatch(/graph_generate ohne task/);
    expect(letzte!.prompt).not.toMatch(/Menschen/);
  });
});

describe('CR-GC-596: nur noch Zurueckgestelltes → stalled, nicht done', () => {
  beforeEach(eintritteAbnehmen);

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
