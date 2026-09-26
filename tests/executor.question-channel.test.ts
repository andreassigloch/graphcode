/**
 * CR-GC-667 — der Fragekanal des Executors.
 *
 * Ein offener Punkt des Auftrags wird zur Fragezeile `? <Frage>` statt zu einer erfundenen Zahl.
 * Headless antwortet der Registertext `openQuestions` (Annahme anlegen), in der manuellen Session
 * der Auftraggeber. Reale Persistenz (Disk-Kuzu im temp repoRoot); simuliert ist nur der
 * Modell-Endpunkt und, im manuellen Fall, der Mensch am Terminal.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness, bindToolsToHarness } from '../src/index.js';
import { runExecutor, ExecutorConfigSchema, type ModelResponse, type CallModel } from '../src/loop/executor.js';
import { extractQuestions, takeQuestionsFromInput } from '../src/loop/executor-parse.js';
import { SYSTEM } from '../src/loop/executor-prompt.js';
import { decision } from '../src/loop/decisions.js';

const CONFIG = ExecutorConfigSchema.parse({
  baseUrl: 'http://scripted.invalid',
  model: 'scripted',
  maxRounds: 2,
  maxStepTurns: 4,
});

const usage = { in: 10, out: 10, reasoning: 0 };

/** Gescriptetes Backend; ist die Liste leer, wirft es — der Executor gibt den Schritt dann auf. */
function scriptedModel(responses: ModelResponse[]): { callModel: CallModel; calls: unknown[][] } {
  const calls: unknown[][] = [];
  const queue = [...responses];
  const callModel: CallModel = (_system, messages) => {
    calls.push(JSON.parse(JSON.stringify(messages)) as unknown[]);
    const next = queue.shift();
    if (!next) throw new Error('scripted model exhausted');
    return Promise.resolve(next);
  };
  return { callModel, calls };
}

function mutateCall(id: string, formatE: string): ModelResponse {
  const input = { formatE };
  return {
    text: '',
    toolCalls: [{ id, name: 'graphcode_graph_mutate', input }],
    stopReason: 'tool_use',
    assistantMsg: {
      role: 'assistant',
      content: null,
      tool_calls: [{ id, type: 'function', function: { name: 'graphcode_graph_mutate', arguments: JSON.stringify(input) } }],
    },
    usage,
  };
}

function prose(text: string): ModelResponse {
  return { text, toolCalls: [], stopReason: 'end_turn', assistantMsg: { role: 'assistant', content: text }, usage };
}

const FRAGE = 'Innerhalb welcher Zeit muss die Anmeldung gelingen?';
const SEED = [
  '## Nodes',
  '### SYS',
  '+ SYS-app|Eine Test-App fuer den Fragekanal. [__name:Test App]',
  '### UC',
  '+ UC-login|Nutzer meldet sich an und erhaelt Zugriff auf die App. [__name:Anmelden]',
  '',
  '## Edges',
  '+ SYS-app -compose-> UC-login',
  '',
].join('\n');

describe('Fragezeile parsen (CR-GC-667)', () => {
  it('nimmt Fragezeilen heraus und laesst Format-E stehen', () => {
    const { rest, questions } = extractQuestions(`? ${FRAGE}\n${SEED}`);
    expect(questions).toEqual([FRAGE]);
    expect(rest).not.toContain('?');
    expect(rest).toContain('+ SYS-app -compose-> UC-login');
  });

  it('greift nur das formatE-Feld eines Mutate-Aufrufs an', () => {
    expect(takeQuestionsFromInput({ commands: [] }).questions).toEqual([]);
    const { input, questions } = takeQuestionsFromInput({ formatE: `? ${FRAGE}\n${SEED}`, dryRun: false });
    expect(questions).toEqual([FRAGE]);
    expect(input).toEqual({ formatE: expect.not.stringContaining('?') as unknown, dryRun: false });
  });

  it('der SYSTEM-Prompt zeigt die Fragezeile als Vorbild', () => {
    expect(SYSTEM).toMatch(/^\? .+/m);
  });
});

describe('Fragekanal im Executor (CR-GC-667)', () => {
  let repoRoot: string;
  let harness: Awaited<ReturnType<typeof createHarness>>;
  let registry: ReturnType<typeof bindToolsToHarness>;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-frage-'));
    harness = await createHarness({
      repoRoot,
      scope: { workspaceId: 'frage-test', systemId: 'frage-test' },
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

  it('headless: Frage im Batch geht nicht ans Gate, der Batch landet, die Annahme-Regel kommt mit der naechsten Runde', async () => {
    const { callModel, calls } = scriptedModel([mutateCall('c1', `? ${FRAGE}\n${SEED}`)]);
    const stats = await runExecutor({ registry, workspaceDir: repoRoot, intent: 'Test-App.', config: CONFIG, callModel });

    expect(stats.mutatesRejected).toBe(0);
    expect(stats.mutatesApplied).toBe(1);
    expect(stats.questions).toEqual([FRAGE]);
    expect(harness.getGraph().nodes.map((n) => n.uid)).toContain('UC-login');
    // Runde 2 traegt die Antwort: niemand antwortet, und der Registertext aus CR-GC-592.
    const runde2 = JSON.stringify(calls[1]);
    expect(runde2).toContain('Niemand antwortet');
    expect(runde2).toContain(JSON.stringify(decision('openQuestions')).slice(1, 60));
  });

  it('headless: eine reine Frage in Prosa ist kein Leerlauf — das Modell bekommt die Antwort und baut weiter', async () => {
    const { callModel, calls } = scriptedModel([prose(`Vorher eine Frage.\n? ${FRAGE}`), mutateCall('c2', SEED)]);
    const stats = await runExecutor({ registry, workspaceDir: repoRoot, intent: 'Test-App.', config: CONFIG, callModel });

    expect(JSON.stringify(calls[1])).toContain('Niemand antwortet');
    expect(JSON.stringify(calls[1])).not.toContain('KEINEN graph_mutate-Call');
    expect(stats.questions).toEqual([FRAGE]);
    expect(stats.mutatesApplied).toBe(1);
  });

  it('manuell: die Frage haelt den Lauf an, die Antwort des Auftraggebers erreicht das Modell', async () => {
    const gefragt: (readonly string[])[] = [];
    const ask = (qs: readonly string[]): Promise<string> => {
      gefragt.push(qs);
      return Promise.resolve('in 2 Sekunden');
    };
    const { callModel, calls } = scriptedModel([mutateCall('c1', `? ${FRAGE}\n`), mutateCall('c2', SEED)]);
    const stats = await runExecutor({
      registry,
      workspaceDir: repoRoot,
      intent: 'Test-App.',
      config: { ...CONFIG, interactive: true },
      callModel,
      ask,
    });

    expect(gefragt).toEqual([[FRAGE]]);
    const zweiterCall = JSON.stringify(calls[1]);
    expect(zweiterCall).toContain('Antwort des Auftraggebers');
    expect(zweiterCall).toContain('in 2 Sekunden');
    expect(zweiterCall).not.toContain('Niemand antwortet');
    // Die reine Frage ist keine Abweisung, der naechste Batch landet.
    expect(stats.mutatesRejected).toBe(0);
    expect(stats.mutatesApplied).toBe(1);
  });

  it('manuell: eine Antwort ausserhalb des Vertrags (SCHEMA-ask-owner) wird abgewiesen', async () => {
    const kaputt = (() => Promise.resolve(undefined)) as unknown as (qs: readonly string[]) => Promise<string>;
    const { callModel } = scriptedModel([mutateCall('c1', `? ${FRAGE}\n`)]);
    await expect(
      runExecutor({
        registry,
        workspaceDir: repoRoot,
        intent: 'Test-App.',
        config: { ...CONFIG, interactive: true },
        callModel,
        ask: kaputt,
      }),
    ).rejects.toThrow(/answer/);
  });

  it('manuell ohne Rueckkanal bricht ab, statt still headless zu laufen', async () => {
    const { callModel } = scriptedModel([]);
    await expect(
      runExecutor({ registry, workspaceDir: repoRoot, config: { ...CONFIG, interactive: true }, callModel }),
    ).rejects.toThrow(/interactive ohne Rueckkanal/);
  });
});
