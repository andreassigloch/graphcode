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
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness, bindToolsToHarness } from '../src/index.js';
import {
  runExecutor,
  buildToolSpecs,
  extractMutateFromText,
  extractToolCallFromText,
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

// Passiert den Batch-Preflight (CR-GC-284: keine Kanten, kein REQ), wird aber vom
// Gate abgelehnt (unknown-type STRUCT-Guard) — der ECHTE Gate-Rejection-Pfad bleibt
// getestet. (Der frühere Ghost-Kanten-Batch wird seit CR-GC-284 schon lokal geblockt;
// dieser Pfad ist in tests/executor.preflight.test.ts abgedeckt.)
const INVALID_BATCH = {
  commands: [
    {
      op: 'add-node',
      node: { uid: 'GHOST-x', type: 'GHOST', name: 'Ghost', description: 'Unbekannter Typ.', attributes: {} },
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
    const traces: string[] = [];

    const stats = await runExecutor({
      registry,
      workspaceDir: repoRoot,
      intent: 'Eine Test-App für den Repair-Loop.',
      config: CONFIG,
      callModel,
      trace: (l) => traces.push(l),
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

    // CR-GC-286: die Rejection-Trace-Zeile trägt die Regel-IDs — post-hoc-Analyse
    // braucht das run.log allein, nicht erst audit.jsonl.
    expect(traces.some((l) => /gate rejected \[[A-Z][^\]]*\] — feeding violations back \(turn \d+\/\d+\)/.test(l))).toBe(true);

    // Durable: der korrigierte Seed steht im Store.
    const uids = harness.getGraph().nodes.map((n) => n.uid);
    expect(uids).toContain('SYS-app');
    expect(uids).toContain('UC-login');
  });

  it('input-schema rejection: missing commands/formatE is fed back with the Zod message and audited (CR-GC-286)', async () => {
    const { callModel, calls } = scriptedModel([
      toolCallResponse('c1', { note: 'kein Batch — weder commands noch formatE' }),
      toolCallResponse('c2', VALID_SEED_BATCH),
    ]);
    const traces: string[] = [];

    const stats = await runExecutor({
      registry,
      workspaceDir: repoRoot,
      intent: 'Eine Test-App für die Input-Schema-Parität.',
      config: CONFIG,
      callModel,
      trace: (l) => traces.push(l),
    });

    // Kein unauditiertes executor-call-Throw: die Zod-Meldung ging als Gate-Feedback zurück …
    expect(calls.length).toBe(2);
    const secondCallText = JSON.stringify(calls[1].messages);
    expect(secondCallText).toContain('NICHT übernommen');
    expect(secondCallText).toContain('INPUT-SCHEMA');
    expect(secondCallText).toContain('commands or formatE');
    // … der Step lief weiter und der korrigierte Batch landete durable.
    expect(stats.mutatesRejected).toBe(1);
    expect(stats.mutatesApplied).toBe(1);
    expect(harness.getGraph().nodes.map((n) => n.uid)).toContain('SYS-app');

    // run.log-Zeile trägt die Regel-ID.
    expect(traces.some((l) => l.includes('gate rejected [INPUT-SCHEMA]'))).toBe(true);

    // Audit-Eintrag vorhanden (F2-Kette lückenlos) — durable neben dem Store.
    const auditPath = join(repoRoot, '.graphcode', 'audit.jsonl');
    const entries = readFileSync(auditPath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { result: string; violations?: { ruleId: string }[] });
    const rejected = entries.filter((e) => e.result === 'rejected');
    expect(rejected.length).toBe(1);
    expect(rejected[0].violations?.[0]?.ruleId).toBe('INPUT-SCHEMA');
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

  it('[ARGS] text tool-call is executed and its result carries the turn (CR-GC-280)', async () => {
    const textCall: ModelResponse = {
      text: 'Ich prüfe zunächst: graphcode_graph_readiness[ARGS]{}',
      toolCalls: [],
      assistantMsg: { role: 'assistant', content: 'unused' },
      usage,
    };
    const { callModel, calls } = scriptedModel([textCall, toolCallResponse('c2', VALID_SEED_BATCH)]);
    const stats = await runExecutor({
      registry,
      workspaceDir: repoRoot,
      intent: 'Eine Test-App für die ARGS-Recovery.',
      config: CONFIG,
      callModel,
    });
    expect(calls.length).toBe(2);
    // Der Text-Call wurde ausgeführt — sein Ergebnis steht in der History, keine Nudge nötig.
    const secondCallText = JSON.stringify(calls[1].messages);
    expect(secondCallText).toContain('Ergebnis von graph_readiness');
    expect(secondCallText).not.toContain('KEINEN graph_mutate-Call');
    expect(stats.mutatesApplied).toBe(1);
  });

  it('a mutate written as [ARGS] text goes through the applied/rejected gate logic', async () => {
    const textMutate: ModelResponse = {
      text: 'graphcode_graph_mutate[ARGS]' + JSON.stringify(VALID_SEED_BATCH),
      toolCalls: [],
      assistantMsg: { role: 'assistant', content: 'unused' },
      usage,
    };
    const { callModel, calls } = scriptedModel([textMutate]);
    const stats = await runExecutor({
      registry,
      workspaceDir: repoRoot,
      intent: 'Eine Test-App für die ARGS-Mutate-Recovery.',
      config: CONFIG,
      callModel,
    });
    expect(calls.length).toBe(1);
    expect(stats.mutatesApplied).toBe(1);
    expect(harness.getGraph().nodes.map((n) => n.uid)).toContain('SYS-app');
  });

  it('expand steps get the minimal local-profile rendering — one finding, no gate protocol (CR-GC-282)', async () => {
    // Seed direkt durchs Gate, damit graph_generate in der Expand-Phase startet.
    await registry['graph_mutate'].handler(VALID_SEED_BATCH);
    const followUp = {
      commands: [
        {
          op: 'add-node',
          node: {
            uid: 'UC-export',
            type: 'UC',
            name: 'Export',
            description: 'User exportiert den Stand und erhält die Datei.',
            attributes: {},
          },
        },
        { op: 'add-edge', edge: { sourceId: 'SYS-app', targetId: 'UC-export', edgeType: 'compose', attributes: {} } },
        { op: 'add-edge', edge: { sourceId: 'ACTOR-user', targetId: 'UC-export', edgeType: 'io', attributes: {} } },
      ],
    };
    const { callModel, calls } = scriptedModel([toolCallResponse('c1', followUp)]);
    await runExecutor({ registry, workspaceDir: repoRoot, config: CONFIG, callModel });
    const instruction = JSON.stringify(calls[0].messages[0]);
    // CR-GC-282 negativ validiert: der Executor fährt das volle Frontier-
    // Rendering (Multi-Kandidaten + Gate-Protokoll erzeugen die großen
    // Batches) — und KEIN widersprüchliches Batch-Größen-Overlay obendrauf.
    expect(instruction).toContain('Gate-Protokoll');
    expect(instruction).not.toContain('NUR den ERSTEN Fund');
  });

  it('read budget: from the 2nd read-only turn the action nudge rides in the tool result', async () => {
    const readTurn = (id: string): ModelResponse => ({
      text: '',
      toolCalls: [{ id, name: 'graphcode_graph_readiness', input: {} }],
      assistantMsg: { role: 'assistant', content: null },
      usage,
    });
    const { callModel, calls } = scriptedModel([
      readTurn('r1'),
      readTurn('r2'),
      toolCallResponse('c3', VALID_SEED_BATCH),
    ]);
    const stats = await runExecutor({
      registry,
      workspaceDir: repoRoot,
      intent: 'Eine Test-App gegen Explorations-Dither.',
      config: CONFIG,
      callModel,
    });
    // Nach Turn 1 (1. Lese-Turn): noch keine Nudge. Nach Turn 2: Nudge im Tool-Result.
    expect(JSON.stringify(calls[1].messages)).not.toContain('KEINEN graph_mutate-Call');
    expect(JSON.stringify(calls[2].messages)).toContain('KEINEN graph_mutate-Call');
    expect(stats.mutatesApplied).toBe(1);
  });

  it('stagnation: an unchanged generate prompt escalates the instruction (v10 finding)', async () => {
    // Runde 1 applied einen Batch OHNE SYS → der Seed-Prompt wiederholt sich in
    // Runde 2 wortgleich → Eskalations-Hinweis muss in der Instruktion stehen.
    const actorOnly = {
      commands: [
        {
          op: 'add-node',
          node: { uid: 'ACTOR-solo', type: 'ACTOR', name: 'Solo', description: 'Nur ein Actor.', attributes: {} },
        },
      ],
    };
    const { callModel, calls } = scriptedModel([
      toolCallResponse('c1', actorOnly),
      toolCallResponse('c2', VALID_SEED_BATCH),
    ]);
    await runExecutor({
      registry,
      workspaceDir: repoRoot,
      intent: 'Eine Test-App gegen Stagnation.',
      config: ExecutorConfigSchema.parse({ baseUrl: 'http://scripted.invalid', model: 'scripted', maxRounds: 2, maxStepTurns: 4 }),
      callModel,
    });
    expect(calls.length).toBe(2);
    expect(JSON.stringify(calls[0].messages)).not.toContain('ACHTUNG: Diese Instruktion');
    expect(JSON.stringify(calls[1].messages)).toContain('hat den Fund NICHT aufgelöst');
  });

  it('deterministic defer: after 3 stagnant rounds the next generate call defers the focusKey and the prompt switches (CR-GC-281)', async () => {
    // Seed direkt durchs Gate → graph_generate startet in der Expand-Phase mit
    // einem konkreten Fund-Fokus (focusKey).
    await registry['graph_mutate'].handler(VALID_SEED_BATCH);

    // generate-Inputs mitschneiden (der Executor ruft das Tool intern).
    const genInputs: Record<string, unknown>[] = [];
    const origGenerate = registry['graph_generate'];
    registry['graph_generate'] = {
      ...origGenerate,
      handler: (input: unknown) => {
        genInputs.push((input ?? {}) as Record<string, unknown>);
        return origGenerate.handler(input);
      },
    };

    // Modell, das den Fund NIE löst: nur Idle-Prosa — jede Runde konsumiert
    // 2 Antworten (Idle → Nudge → Idle → Step-Abbruch), der Graph bleibt
    // unverändert, der generate-Prompt wiederholt sich wortgleich.
    const idle: ModelResponse = {
      text: 'Ich denke weiter nach …',
      toolCalls: [],
      assistantMsg: { role: 'assistant', content: 'unused' },
      usage,
    };
    const { callModel, calls } = scriptedModel(Array.from({ length: 12 }, () => idle));
    const traces: string[] = [];

    await runExecutor({
      registry,
      workspaceDir: repoRoot,
      config: ExecutorConfigSchema.parse({
        baseUrl: 'http://scripted.invalid',
        model: 'scripted',
        maxRounds: 6,
        maxStepTurns: 4,
      }),
      callModel,
      trace: (l) => traces.push(l),
    });

    // Runden 1–4: identischer Prompt, noch kein defer im generate-Input.
    expect(genInputs.length).toBe(6);
    for (const input of genInputs.slice(0, 4)) expect(input.defer).toBeUndefined();
    // Nach Stagnation x3 (Runde 4) ist das Fund-Set zurückgestellt …
    expect(traces.some((l) => l.startsWith('  defer: '))).toBe(true);
    // … und ab Runde 5 trägt jeder generate-Call das defer.
    expect(Array.isArray(genInputs[4].defer)).toBe(true);
    expect((genInputs[4].defer as string[]).length).toBe(1);
    expect(genInputs[5].defer).toEqual(genInputs[4].defer);
    // Der Prompt WECHSELT deterministisch (2 Modell-Calls pro Runde → Runde 5
    // beginnt bei calls[8]): neue Instruktion, Stagnations-Eskalation weg.
    const instructionOf = (i: number): string => JSON.stringify(calls[i].messages[0]);
    expect(calls.length).toBe(12);
    expect(instructionOf(6)).toContain('ACHTUNG'); // Runde 4: noch stagnant
    expect(instructionOf(8)).not.toBe(instructionOf(0));
    expect(instructionOf(8)).not.toContain('ACHTUNG'); // Runde 5: Fokus gewechselt

    registry['graph_generate'] = origGenerate;
  });

  it('extractToolCallFromText parses name[ARGS]{json} and rejects garbage', () => {
    expect(extractToolCallFromText('graphcode_graph_elements[ARGS]{"type": "UC", "search": "login"}')).toEqual({
      name: 'graphcode_graph_elements',
      input: { type: 'UC', search: 'login' },
    });
    expect(extractToolCallFromText('nur Prosa ohne Call')).toBeNull();
    expect(extractToolCallFromText('kaputt[ARGS]{"unclosed": ')).toBeNull();
  });

  it('salvages complete commands from a truncated [ARGS] mega-batch (v8 finding)', () => {
    const cmd1 = { op: 'add-node', node: { uid: 'SYS-x', type: 'SYS', name: 'X', description: 'ok', attributes: {} } };
    const cmd2 = {
      op: 'add-node',
      node: { uid: 'UC-y', type: 'UC', name: 'Y', description: 'hat {geschweifte} Klammern', attributes: {} },
    };
    const truncated =
      'graphcode_graph_mutate[ARGS]{"commands": [' +
      JSON.stringify(cmd1) + ', ' + JSON.stringify(cmd2) +
      ', {"op":"add-node","node":{"uid":"UC-cut","descr'; // Budget-Schnitt mitten im 3. Command
    expect(extractMutateFromText(truncated)).toEqual({ commands: [cmd1, cmd2] });
    // Ohne ein einziges vollständiges Command bleibt es null (kein Phantom-Batch).
    expect(extractMutateFromText('{"commands": [{"op":"add-no')).toBeNull();
  });

  it('extractMutateFromText finds the commands object among surrounding prose/braces', () => {
    const batch = { commands: [{ op: 'add-node', node: { uid: 'SYS-x' } }] };
    const text = `Vorwort {nicht das} — hier: ${JSON.stringify(batch)} Nachwort.`;
    expect(extractMutateFromText(text)).toEqual(batch);
    expect(extractMutateFromText('kein batch hier')).toBeNull();
  });
});
