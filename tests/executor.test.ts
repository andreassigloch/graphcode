/**
 * CR-GC-278 — Embedded Executor Core.
 *
 * Reale Persistenz (Disk-Kuzu in temp repoRoot), gescriptetes Modell-Backend
 * (injizierter `callModel`) — der Modell-Endpoint ist die einzige simulierte
 * Grenze, der Gate-/Store-Pfad ist der echte.
 *
 * Kern-Invariante (der behobene Rig-Fehler): eine Gate-Rejection beendet den
 * Step NICHT — die violations gehen als Feedback zurück ans Modell, und ein
 * danach korrigierter Batch landet durable im Store.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness, bindToolsToHarness } from '../src/index.js';
import {
  runExecutor,
  buildToolSpecs,
  extractMutateFromText,
  ExecutorConfigSchema,
  type ModelResponse,
  type CallModel,
} from '../src/executor.js';

const CONFIG = ExecutorConfigSchema.parse({
  baseUrl: 'http://scripted.invalid',
  model: 'scripted',
  maxRounds: 1,
  maxStepTurns: 4,
});

/** Gescriptetes Backend: liefert die Antworten der Reihe nach, protokolliert die Calls. */
function scriptedModel(responses: ModelResponse[]): {
  callModel: CallModel;
  calls: { system: string; messages: unknown[] }[];
} {
  const calls: { system: string; messages: unknown[] }[] = [];
  const queue = [...responses];
  const callModel: CallModel = (system, messages) => {
    calls.push({ system, messages: JSON.parse(JSON.stringify(messages)) as unknown[] });
    const next = queue.shift();
    if (!next) throw new Error('scripted model exhausted');
    return Promise.resolve(next);
  };
  return { callModel, calls };
}

const usage = { in: 10, out: 10, reasoning: 0 };

function toolCallResponse(id: string, input: unknown): ModelResponse {
  return {
    text: '',
    toolCalls: [{ id, name: 'graphcode_graph_mutate', input }],
    assistantMsg: {
      role: 'assistant',
      content: null,
      tool_calls: [
        { id, type: 'function', function: { name: 'graphcode_graph_mutate', arguments: JSON.stringify(input) } },
      ],
    },
    usage,
  };
}

const INVALID_BATCH = {
  commands: [
    {
      op: 'add-edge',
      edge: { sourceId: 'ACTOR-ghost', targetId: 'UC-ghost', edgeType: 'io', attributes: {} },
    },
  ],
};

const VALID_SEED_BATCH = {
  commands: [
    {
      op: 'add-node',
      node: {
        uid: 'SYS-app',
        type: 'SYS',
        name: 'Test App',
        description: 'Eine Test-App für den Executor-Repair-Loop.',
        attributes: {},
      },
    },
    {
      op: 'add-node',
      node: {
        uid: 'ACTOR-user',
        type: 'ACTOR',
        name: 'User',
        description: 'Nutzt die App.',
        attributes: {},
      },
    },
    {
      op: 'add-node',
      node: {
        uid: 'UC-login',
        type: 'UC',
        name: 'Login',
        description: 'User meldet sich an und erhält Zugriff auf die App.',
        attributes: {},
      },
    },
    { op: 'add-edge', edge: { sourceId: 'ACTOR-user', targetId: 'UC-login', edgeType: 'io', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: 'SYS-app', targetId: 'UC-login', edgeType: 'compose', attributes: {} } },
  ],
};

describe('executor (CR-GC-278)', () => {
  let repoRoot: string;
  let harness: Awaited<ReturnType<typeof createHarness>>;
  let registry: ReturnType<typeof bindToolsToHarness>;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-executor-'));
    harness = await createHarness({
      repoRoot,
      scope: { workspaceId: 'exec-test', systemId: 'exec-test' },
      consumerType: 'system',
      preCommitTimeout: 5000,
    });
    await harness.initialize();
    registry = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('repair loop: gate rejection is fed back, the corrected batch lands durable', async () => {
    const { callModel, calls } = scriptedModel([
      toolCallResponse('c1', INVALID_BATCH),
      toolCallResponse('c2', VALID_SEED_BATCH),
    ]);

    const stats = await runExecutor({
      registry,
      workspaceDir: repoRoot,
      intent: 'Eine Test-App für den Repair-Loop.',
      config: CONFIG,
      callModel,
    });

    // Die Rejection hat den Step NICHT beendet — das Modell wurde erneut gerufen …
    expect(calls.length).toBe(2);
    // … und hat das Gate-Feedback (violations/fixHint-Block) in der History gesehen.
    const secondCallText = JSON.stringify(calls[1].messages);
    expect(secondCallText).toContain('NICHT übernommen');
    expect(secondCallText).toContain('success');

    expect(stats.mutatesRejected).toBe(1);
    expect(stats.mutatesApplied).toBe(1);
    expect(stats.repairedAfterRejection).toBe(1);

    // Durable: der korrigierte Seed steht im Store.
    const uids = harness.getGraph().nodes.map((n) => n.uid);
    expect(uids).toContain('SYS-app');
    expect(uids).toContain('UC-login');
  });

  it('prose recovery: a rejected text-mutate is repaired, not silently dropped', async () => {
    const prose = (batch: unknown): ModelResponse => ({
      text: 'Hier der Batch:\n' + JSON.stringify(batch),
      toolCalls: [],
      assistantMsg: { role: 'assistant', content: 'unused' },
      usage,
    });
    const { callModel, calls } = scriptedModel([prose(INVALID_BATCH), prose(VALID_SEED_BATCH)]);

    const stats = await runExecutor({
      registry,
      workspaceDir: repoRoot,
      intent: 'Eine Test-App für den Recovery-Pfad.',
      config: CONFIG,
      callModel,
    });

    expect(calls.length).toBe(2);
    expect(JSON.stringify(calls[1].messages)).toContain('NICHT übernommen');
    expect(stats.mutatesRejected).toBe(1);
    expect(stats.mutatesApplied).toBe(1);
    expect(stats.repairedAfterRejection).toBe(1);
    expect(harness.getGraph().nodes.map((n) => n.uid)).toContain('SYS-app');
  });

  it('an applied mutate ends the step — exactly one model call, node persisted', async () => {
    const { callModel, calls } = scriptedModel([toolCallResponse('c1', VALID_SEED_BATCH)]);
    const stats = await runExecutor({
      registry,
      workspaceDir: repoRoot,
      intent: 'Eine Test-App.',
      config: CONFIG,
      callModel,
    });
    expect(calls.length).toBe(1);
    expect(stats.mutatesApplied).toBe(1);
    expect(stats.mutatesRejected).toBe(0);
    expect(stats.repairedAfterRejection).toBe(0);
  });

  it('a dryRun mutate is a probe, never a step terminator — the real apply follows', async () => {
    const { callModel, calls } = scriptedModel([
      toolCallResponse('c1', { ...VALID_SEED_BATCH, dryRun: true }),
      toolCallResponse('c2', VALID_SEED_BATCH),
    ]);
    const stats = await runExecutor({
      registry,
      workspaceDir: repoRoot,
      intent: 'Eine Test-App fürs Gate-Protokoll.',
      config: CONFIG,
      callModel,
    });
    // Die dryRun-Probe hat den Step NICHT beendet — das Modell durfte den echten Apply nachreichen.
    expect(calls.length).toBe(2);
    expect(stats.dryRunProbes).toBe(1);
    expect(stats.mutatesApplied).toBe(1);
    expect(harness.getGraph().nodes.map((n) => n.uid)).toContain('SYS-app');
  });

  it('idle turn (no tool call, no recoverable batch) gets ONE nudge before giving up', async () => {
    const idle: ModelResponse = {
      text: 'Ich analysiere zunächst die Anforderungen in Prosa …',
      toolCalls: [],
      assistantMsg: { role: 'assistant', content: 'unused' },
      usage,
    };
    const { callModel, calls } = scriptedModel([idle, toolCallResponse('c2', VALID_SEED_BATCH)]);
    const stats = await runExecutor({
      registry,
      workspaceDir: repoRoot,
      intent: 'Eine Test-App gegen das Dithern.',
      config: CONFIG,
      callModel,
    });
    expect(calls.length).toBe(2);
    expect(JSON.stringify(calls[1].messages)).toContain('KEINEN graph_mutate-Call');
    expect(stats.mutatesApplied).toBe(1);
    expect(harness.getGraph().nodes.map((n) => n.uid)).toContain('SYS-app');
  });

  it('buildToolSpecs: valid object schemas for every tool, generate/next_step withheld', () => {
    const specs = buildToolSpecs(registry);
    const names = specs.map((s) => s.name);
    expect(names).not.toContain('graphcode_graph_generate');
    expect(names).not.toContain('graphcode_graph_next_step');
    expect(names).toContain('graphcode_graph_mutate');
    expect(names).toContain('read_file');
    for (const spec of specs) {
      expect(spec.schema.type).toBe('object');
      expect(typeof spec.schema.properties).toBe('object');
    }
  });

  it("toolset 'authoring' curates the minimal generative set (base-load lever)", () => {
    const names = buildToolSpecs(registry, 'authoring').map((s) => s.name);
    expect(names).toContain('graphcode_graph_mutate');
    expect(names).toContain('graphcode_graph_authoring_guide');
    expect(names).toContain('read_file');
    expect(names).not.toContain('graphcode_graph_export');
    expect(names.length).toBeLessThanOrEqual(8);
  });

  it('extractMutateFromText finds the commands object among surrounding prose/braces', () => {
    const batch = { commands: [{ op: 'add-node', node: { uid: 'SYS-x' } }] };
    const text = `Vorwort {nicht das} — hier: ${JSON.stringify(batch)} Nachwort.`;
    expect(extractMutateFromText(text)).toEqual(batch);
    expect(extractMutateFromText('kein batch hier')).toBeNull();
  });
});
