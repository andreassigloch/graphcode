/**
 * TEST-executor-truncation (CR-GC-688) — eine am Token-Budget abgeschnittene Antwort ist kein Batch.
 *
 * Gemessen: `seed:actor` legte 8 ACTORs an, und die Antwort war am `maxTokens`-Budget abgeschnitten.
 * Der Salvage-Pfad (`executor-parse.ts`) birgt aus einem abgeschnittenen `"commands": [ … ` jedes
 * vollstaendige Objekt — gebaut fuer devstrals Mega-Batches, aber ohne Blick auf den Stop-Grund.
 * Der Rest der Antwort (weitere ACTORs, ihre Anbindung) fehlt still; die Seed-Stufe sieht „es gibt
 * ACTORs" und ist durch.
 *
 * Reale Persistenz (Disk-Kuzu im temp repoRoot), gescriptetes Modell — der Modell-Endpoint ist die
 * einzige simulierte Grenze. Beide Pfade: Best-of-N (`executor-bestofn.ts`, CR-GC-688) und der
 * Ein-Kandidaten-Pfad in `executor.ts` (CR-GC-691) — auf ihm lief der gemessene `seed:actor`.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness, bindToolsToHarness } from '../src/index.js';
import { runExecutor, ExecutorConfigSchema, type ModelResponse, type CallModel } from '../src/loop/executor.js';
import { istAbgeschnitten } from '../src/loop/model-answer-contract.js';

const usage = { in: 10, out: 10, reasoning: 0 };

const SEED = {
  commands: [
    { op: 'add-node', node: { uid: 'SYS-app', type: 'SYS', name: 'Test App', description: 'Eine Test-App.', attributes: {} } },
    { op: 'add-node', node: { uid: 'ACTOR-user', type: 'ACTOR', name: 'User', description: 'Nutzt die App.', attributes: {} } },
    { op: 'add-node', node: { uid: 'UC-login', type: 'UC', name: 'Login', description: 'User meldet sich an und erhält Zugriff.', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: 'SYS-app', targetId: 'UC-login', edgeType: 'compose', attributes: {} } },
  ],
};

const actor = (k: string): string =>
  JSON.stringify({ op: 'add-node', node: { uid: `ACTOR-${k}`, type: 'ACTOR', name: `Rolle ${k}`, description: `Rolle ${k} am System.`, attributes: {} } });

/** Zwei vollstaendige ACTORs, der dritte mitten im Objekt abgeschnitten — so endet ein max_tokens-Stopp. */
const ABGESCHNITTEN_TEXT = `{"commands": [${actor('a')}, ${actor('b')}, {"op":"add-node","node":{"uid":"ACTOR-c","ty`;

const UPDATE_SYS = {
  commands: [{ op: 'update-node', node: { uid: 'SYS-app', type: 'SYS', attributes: { note: 'aktualisiert' } } }],
};

function text(t: string, stopReason: string): ModelResponse {
  return { text: t, toolCalls: [], stopReason, assistantMsg: { role: 'assistant', content: t }, usage };
}

function mutateCall(id: string, input: unknown, stopReason = 'tool_use'): ModelResponse {
  return {
    text: '',
    toolCalls: [{ id, name: 'graphcode_graph_mutate', input }],
    stopReason,
    assistantMsg: {
      role: 'assistant',
      content: null,
      tool_calls: [{ id, type: 'function', function: { name: 'graphcode_graph_mutate', arguments: JSON.stringify(input) } }],
    },
    usage,
  };
}

/**
 * Modell, das abgeschnitten antwortet, bis es den Abschneide-Hinweis liest — dann vollstaendig.
 * Ohne Hinweis (vor dem Fix) bleibt jeder Kandidat der abgeschnittene Teil-Batch.
 */
function modell(abgeschnitten: () => ModelResponse): { callModel: CallModel; calls: unknown[][] } {
  const calls: unknown[][] = [];
  const callModel: CallModel = (_system, messages) => {
    calls.push(JSON.parse(JSON.stringify(messages)) as unknown[]);
    const hinweis = JSON.stringify(messages[messages.length - 1]).includes('Token-Budget abgeschnitten');
    return Promise.resolve(hinweis ? mutateCall(`ok${calls.length}`, UPDATE_SYS) : abgeschnitten());
  };
  return { callModel, calls };
}

describe('CR-GC-688: istAbgeschnitten kennt die Stop-Vokabeln aller Backends', () => {
  it('anthropic max_tokens und openai/sigllm length sind abgeschnitten, alles andere nicht', () => {
    expect(istAbgeschnitten('max_tokens')).toBe(true);
    expect(istAbgeschnitten('length')).toBe(true);
    for (const ok of ['end_turn', 'stop', 'tool_use', 'tool_calls', null]) expect(istAbgeschnitten(ok)).toBe(false);
  });
});

describe.each([
  { pfad: 'Best-of-N (CR-GC-688)', candidates: 2 },
  { pfad: 'Ein-Kandidaten-Pfad (CR-GC-691)', candidates: 1 },
])('$pfad uebernimmt nichts aus einer abgeschnittenen Antwort', ({ candidates }) => {
  let repoRoot: string;
  let harness: Awaited<ReturnType<typeof createHarness>>;
  let registry: ReturnType<typeof bindToolsToHarness>;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-truncation-'));
    harness = await createHarness({
      repoRoot,
      scope: { workspaceId: 'truncation-test', systemId: 'truncation-test' },
      consumerType: 'system',
      preCommitTimeout: 5000,
    });
    await harness.initialize();
    registry = bindToolsToHarness(harness);
    const res = (await registry['graph_mutate'].handler(SEED)) as { success: boolean };
    expect(res.success).toBe(true);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  const uids = (): string[] => harness.getGraph().nodes.map((n) => n.uid);
  const config = ExecutorConfigSchema.parse({
    baseUrl: 'http://scripted.invalid',
    model: 'scripted',
    maxRounds: 1,
    maxStepTurns: 4,
    candidates,
  });

  it('der geborgene Teil-Batch wird verworfen, das Modell erfaehrt den Grund und liefert neu', async () => {
    const { callModel, calls } = modell(() => text(ABGESCHNITTEN_TEXT, 'length'));
    const traces: string[] = [];
    await runExecutor({ registry, workspaceDir: repoRoot, config, callModel, trace: (l) => traces.push(l) });

    expect(uids()).not.toContain('ACTOR-a');
    expect(uids()).not.toContain('ACTOR-b');
    expect(traces.some((l) => /abgeschnitten \(stop=length\)/.test(l))).toBe(true);
    // Der zweite Turn traegt den Hinweis — und erst die vollstaendige Antwort wird angewandt.
    expect(JSON.stringify(calls[1])).toContain('Token-Budget abgeschnitten');
    const sys = harness.getGraph().nodes.find((n) => n.uid === 'SYS-app') as { attributes?: Record<string, unknown> };
    expect(sys.attributes?.note).toBe('aktualisiert');
  });

  it.each(['max_tokens', 'length'])('auch ein abgeschnittener Werkzeugaufruf (stop=%s) ist kein Kandidat', async (stop) => {
    const teil = { commands: [JSON.parse(actor('a')) as unknown] };
    const { callModel } = modell(() => mutateCall('k', teil, stop));
    const traces: string[] = [];
    await runExecutor({ registry, workspaceDir: repoRoot, config, callModel, trace: (l) => traces.push(l) });
    expect(uids()).not.toContain('ACTOR-a');
    expect(traces.some((l) => l.includes(`abgeschnitten (stop=${stop})`))).toBe(true);
    const sys = harness.getGraph().nodes.find((n) => n.uid === 'SYS-app') as { attributes?: Record<string, unknown> };
    expect(sys.attributes?.note).toBe('aktualisiert');
  });
});

/**
 * CR-GC-692 (ITEM-2026-427) — das runde7-Muster: 38/38 Ablehnungen, 6 Turns je Schritt verbrannt.
 *
 * Am Budget gekappter Werkzeugaufruf: beide Backends liefern `input: {}` (`safeParse` bzw. der
 * Stream-Zusammenbau) mit Stop-Grund `max_tokens`/`length`. Vorher ging `{}` ans Gate, und das
 * Modell las „INPUT-SCHEMA: supply exactly one of commands or formatE" — kein Wort vom Budget.
 * Es schickte denselben zu grossen Batch erneut, bis das Turn-Budget leer war.
 */
describe('CR-GC-692: gekappter Werkzeugaufruf ist Budget-Ueberlauf, nicht INPUT-SCHEMA', () => {
  let repoRoot: string;
  let harness: Awaited<ReturnType<typeof createHarness>>;
  let registry: ReturnType<typeof bindToolsToHarness>;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-truncation-692-'));
    harness = await createHarness({
      repoRoot,
      scope: { workspaceId: 'truncation-692', systemId: 'truncation-692' },
      consumerType: 'system',
      preCommitTimeout: 5000,
    });
    await harness.initialize();
    registry = bindToolsToHarness(harness);
    expect(((await registry['graph_mutate'].handler(SEED)) as { success: boolean }).success).toBe(true);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it.each([
    { candidates: 1, stop: 'max_tokens' },
    { candidates: 1, stop: 'length' },
    { candidates: 2, stop: 'max_tokens' },
  ])('candidates=$candidates, stop=$stop: kein INPUT-SCHEMA, das Modell erfaehrt das Budget', async ({ candidates, stop }) => {
    // Das Modell wiederholt den gekappten Aufruf, solange es keinen Budget-Hinweis liest (runde7).
    const { callModel, calls } = modell(() => mutateCall('gross', {}, stop));
    const traces: string[] = [];
    const config = ExecutorConfigSchema.parse({
      baseUrl: 'http://scripted.invalid',
      model: 'scripted',
      maxRounds: 1,
      maxStepTurns: 6,
      candidates,
    });
    const stats = await runExecutor({ registry, workspaceDir: repoRoot, config, callModel, trace: (l) => traces.push(l) });

    expect(stats.mutatesRejected).toBe(0);
    expect(JSON.stringify(calls)).not.toContain('INPUT-SCHEMA');
    expect(traces.some((l) => l.includes('INPUT-SCHEMA') || l.includes('input-schema'))).toBe(false);
    expect(JSON.stringify(calls[1])).toContain('Token-Budget abgeschnitten');
    const sys = harness.getGraph().nodes.find((n) => n.uid === 'SYS-app') as { attributes?: Record<string, unknown> };
    expect(sys.attributes?.note).toBe('aktualisiert');
  });
});
