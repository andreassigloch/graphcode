/**
 * TEST-executor-saturation (CR-GC-694) — der Lauf stoppt, wenn der Ertrag versiegt, nicht erst an maxRounds.
 *
 * gcrun-180 (200 Runden): `done` kommt in expand nie, weil jeder Zuwachs neue Funde erzeugt. Ohne
 * Ertragsstopp laeuft ein Modell, das nur noch bestehende Knoten anfasst, bis zur Rundengrenze.
 *
 * Reale Persistenz (Disk-Kuzu im temp repoRoot), gescriptetes Modell — der Modell-Endpoint ist die
 * einzige simulierte Grenze; die Knotenzahl kommt aus dem echten Store.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness, bindToolsToHarness } from '../src/index.js';
import { runExecutor, ExecutorConfigSchema, type ModelResponse, type CallModel } from '../src/loop/executor.js';
import { parseExecutorEnv } from '../src/surface/run-verb.js';
import { alsEingabe } from './helpers/format-e.js';

const usage = { in: 10, out: 10, reasoning: 0 };

const SEED = {
  commands: [
    { op: 'add-node', node: { uid: 'SYS-app', type: 'SYS', name: 'Test App', description: 'Eine Test-App.', attributes: {} } },
    { op: 'add-node', node: { uid: 'ACTOR-user', type: 'ACTOR', name: 'User', description: 'Nutzt die App.', attributes: {} } },
    { op: 'add-node', node: { uid: 'UC-login', type: 'UC', name: 'Login', description: 'User meldet sich an und erhält Zugriff.', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: 'SYS-app', targetId: 'UC-login', edgeType: 'compose', attributes: {} } },
  ],
};

function mutateCall(id: string, input: unknown): ModelResponse {
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

/** Jede Runde ein angewandter Batch — `batch(n)` liefert den Inhalt des n-ten Aufrufs. */
function modell(batch: (n: number) => unknown): CallModel {
  let n = 0;
  return () => {
    n += 1;
    return Promise.resolve(mutateCall(`c${n}`, batch(n)));
  };
}

/** Nur eine Attribut-Aenderung am bestehenden SYS — angewandt, aber kein neuer Knoten. */
const nurBestand = (n: number): unknown => ({
  commands: [{ op: 'update-node', node: { uid: 'SYS-app', type: 'SYS', attributes: { runde: n } } }],
});

/** Je Runde ein neuer ACTOR — Ertrag in jeder Runde. */
const neuerActor = (n: number): unknown => ({
  commands: [
    { op: 'add-node', node: { uid: `ACTOR-r${n}`, type: 'ACTOR', name: `Rolle ${n}`, description: `Rolle ${n} am System.`, attributes: {} } },
  ],
});

describe('CR-GC-694: Saettigungsstopp aus dem Ertrag', () => {
  let repoRoot: string;
  let harness: Awaited<ReturnType<typeof createHarness>>;
  let registry: ReturnType<typeof bindToolsToHarness>;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-saturation-'));
    harness = await createHarness({
      repoRoot,
      scope: { workspaceId: 'saturation-test', systemId: 'saturation-test' },
      consumerType: 'system',
      preCommitTimeout: 5000,
    });
    await harness.initialize();
    registry = bindToolsToHarness(harness);
    expect(((await registry['graph_mutate'].handler(alsEingabe(SEED))) as { success: boolean }).success).toBe(true);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  const config = (extra: Record<string, unknown>) =>
    ExecutorConfigSchema.parse({ baseUrl: 'http://scripted.invalid', model: 'scripted', maxRounds: 10, maxStepTurns: 2, ...extra });

  it('kein neuer Knoten ueber das Fenster → Stopp mit Grund saettigung, nicht erst an maxRounds', async () => {
    const traces: string[] = [];
    const stats = await runExecutor({
      registry,
      workspaceDir: repoRoot,
      config: config({ saturationWindow: 3, saturationMinNodes: 1 }),
      callModel: modell(nurBestand),
      trace: (l) => traces.push(l),
    });
    expect(stats.mutatesApplied).toBe(3);
    expect(stats.genRounds).toBe(3);
    expect(stats.stopReason).toBe('saettigung');
    expect(stats.done).toBe(false);
    expect(traces.some((l) => l.includes('saettigung'))).toBe(true);
  });

  it('Ertrag in jeder Runde → keine Wirkung, der Lauf endet an maxRounds', async () => {
    const stats = await runExecutor({
      registry,
      workspaceDir: repoRoot,
      config: config({ saturationWindow: 3, saturationMinNodes: 1 }),
      callModel: modell(neuerActor),
    });
    expect(stats.genRounds).toBe(10);
    expect(stats.stopReason).toBe('maxRounds');
    // CR-GC-728: der Lauf begann auf einem bestehenden Modell — die erste Runde war keine Seed-Runde.
    expect(stats.startPhase).toBe('expand');
    expect(harness.getGraph().nodes.filter((n) => n.uid.startsWith('ACTOR-r'))).toHaveLength(10);
  });

  it('der Default ist aus gcrun-180 hergeleitet: 20 Runden, weniger als 10 neue Knoten', () => {
    const cfg = config({});
    expect(cfg.saturationWindow).toBe(20);
    expect(cfg.saturationMinNodes).toBe(10);
    const env = parseExecutorEnv({
      GRAPHCODE_LLM_BASE_URL: 'http://x',
      GRAPHCODE_LLM_MODEL: 'm',
      GRAPHCODE_LLM_SATURATION_WINDOW: '5',
      GRAPHCODE_LLM_SATURATION_MIN_NODES: '2',
    });
    expect(env).toMatchObject({ saturationWindow: 5, saturationMinNodes: 2 });
  });
});
