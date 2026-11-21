/**
 * TEST-mutate-answer (CR-GC-985) — jede Antwort, die `graph_mutate` heute liefert, erfüllt
 * `GraphMutateAnswerSchema`. Das Werkzeug parst seine Antwort selbst (der Aufruf wirft bei einem Bruch);
 * dieser Test fährt die Varianten am echten Werkzeug auf einem echten Kuzu und prüft zusätzlich, dass die
 * Variante wirklich entstanden ist — sonst prüfte er nichts.
 *
 * Varianten: Probelauf und Anwendung, summary und full, Erfolg und Ablehnung durch die Regeln,
 * OCC-Ablehnung, unbekannter Skill, Parse-Fehler des Formats, mit und ohne vorschlag, nameWarning,
 * occWarning, Berichte, refs. Echte DB, keine Mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness, type ToolRegistry } from '../src/surface/mcp-tools.js';
import { GraphMutateAnswerSchema } from '../src/surface/mutate-answer.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

const config = (repoRoot: string): HarnessConfig => ({
  repoRoot,
  scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
  consumerType: 'system',
  preCommitTimeout: 5000,
});

const MOD = '## Nodes\n### MOD\n+ MOD-neu|Ein Modul. [__name:Neu]\n';
const MOD_OHNE_NAMEN = '## Nodes\n### MOD\n+ MOD-ohne|Ein Modul.\n';
const LONE_REQ =
  '## Nodes\n### REQ\n+ REQ-offen|Das System muss Sache innerhalb von 2 Sekunden bestaetigen und protokollieren. [__name:Offen]\n';
const SCHEMA_OHNE_BINDUNG = '## Nodes\n### SCHEMA\n+ SCHEMA-lose|Ein Vertrag. [__name:Lose]\n';
const SCHEMA_BINDEN = '## Nodes\n### SCHEMA\n~ SCHEMA-lose\n@realRef {"file":"src/x.ts","symbol":"X","lang":"ts"}\n';

describe('TEST-mutate-answer: jede Antwort von graph_mutate erfüllt ihren Vertrag (CR-GC-985)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let tools: ToolRegistry;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-mutate-answer-'));
    harness = new GraphCodeHarness(config(tmp), new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') }));
    await harness.initialize();
    await harness.importGraph({ elements: [{ id: 'SYS-x', type: 'SYS', name: 'x', description: 'Ein System.' }], traces: [] });
    tools = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  /** Ruft das Werkzeug und liest die Antwort noch einmal gegen den Vertrag, ohne dem Erzeuger zu glauben. */
  const rufe = async (input: Record<string, unknown>) => {
    const res = await tools.graph_mutate.handler({ consumerId: 't', ...input } as never);
    expect(GraphMutateAnswerSchema.safeParse(res).success).toBe(true);
    return res as Record<string, unknown> & { violations: Array<Record<string, unknown>>; graphVersion: number };
  };

  it('Probelauf, summary: gefaltete Befunde, Steuerdelta, metricsAfter, steerAdvisory', async () => {
    const res = await rufe({ formatE: MOD, dryRun: true });
    expect(res['success']).toBe(true);
    expect(res.violations.length).toBeGreaterThan(0);
    expect(res.violations.every((v) => Array.isArray(v['elements']))).toBe(true);
    expect(res['steeringDelta']).toBeDefined();
    expect(res['metricsAfter']).toBeDefined();
    expect(res['vorschlag']).toBeUndefined();
  });

  it('Probelauf, full: ein Befund je Element mit elementId', async () => {
    const res = await rufe({ formatE: MOD, dryRun: true, violations: 'full' });
    expect(res.violations.some((v) => typeof v['elementId'] === 'string')).toBe(true);
    expect(res.violations.every((v) => v['elements'] === undefined)).toBe(true);
  });

  it('Anwendung ohne baseVersion: occWarning, vorschlag, höhere graphVersion', async () => {
    const vorher = (await rufe({ formatE: MOD, dryRun: true })).graphVersion;
    const res = await rufe({ formatE: MOD });
    expect(res['success']).toBe(true);
    expect(typeof res['occWarning']).toBe('string');
    expect(typeof res['vorschlag']).toBe('string');
    expect(res.graphVersion).toBeGreaterThan(vorher);
    expect(res['metricsAfter']).toBeUndefined();
  });

  it('Anwendung mit baseVersion, full: kein occWarning', async () => {
    const base = (await rufe({ formatE: MOD, dryRun: true })).graphVersion;
    const res = await rufe({ formatE: MOD, baseVersion: base, violations: 'full' });
    expect(res['success']).toBe(true);
    expect(res['occWarning']).toBeUndefined();
    expect(res.violations.some((v) => typeof v['elementId'] === 'string')).toBe(true);
  });

  it('Ablehnung durch eine Fehlerregel (block): success false, tier block', async () => {
    const res = await rufe({ formatE: LONE_REQ });
    expect(res['success']).toBe(false);
    expect(res['tier']).toBe('block');
    expect(res.violations.length).toBeGreaterThan(0);
  });

  it('OCC-Ablehnung: stale und staleDelta', async () => {
    const base = (await rufe({ formatE: MOD, dryRun: true })).graphVersion;
    await rufe({ formatE: MOD, baseVersion: base });
    const res = await rufe({ formatE: MOD_OHNE_NAMEN, baseVersion: base });
    expect(res['success']).toBe(false);
    expect(res['stale']).toBe(true);
    expect(res['staleDelta']).toBeDefined();
    expect(res.violations[0]?.['ruleId']).toBe('OCC');
  });

  it('unbekannter Skill: Ablehnung vor dem Gate mit je Element geführter Liste', async () => {
    const res = await rufe({ formatE: MOD, skill: 'gibt-es-nicht' });
    expect(res['success']).toBe(false);
    expect(res.violations[0]?.['ruleId']).toBe('SKILL');
  });

  it('Parse-Fehler des Formats: Ablehnung STRUCT, im Probelauf wie bei der Anwendung', async () => {
    for (const dryRun of [true, false]) {
      const res = await rufe({ formatE: '+ MOD-x|ohne Abschnitt\n', dryRun });
      expect(res['success']).toBe(false);
      expect(res.violations[0]?.['ruleId']).toBe('STRUCT');
    }
  });

  it('Knoten ohne Namen: nameWarning, im Probelauf und bei der Anwendung', async () => {
    const probe = await rufe({ formatE: MOD_OHNE_NAMEN, dryRun: true });
    expect(typeof probe['nameWarning']).toBe('string');
    const echt = await rufe({ formatE: MOD_OHNE_NAMEN });
    expect(typeof echt['nameWarning']).toBe('string');
  });

  it('Bindung: refs nennt das geschlossene SCHEMA', async () => {
    await rufe({ formatE: SCHEMA_OHNE_BINDUNG });
    const res = await rufe({ formatE: SCHEMA_BINDEN });
    const refs = res['refs'] as { resolved: string[]; openRefs: number } | undefined;
    expect(refs?.resolved).toContain('SCHEMA-lose');
  });
});
