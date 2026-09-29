/**
 * CR-GC-714 — `graph_delegate`: der angedockte Client gibt Modellarbeit an den Executor im Host ab.
 *
 * Reale Persistenz (Disk-Kuzu im temp repoRoot), echter Host-Socket und echter Proxy — simuliert
 * ist nur der Modell-Endpunkt. Ein Schreiber: Client (über den Proxy) und Executor treffen denselben
 * Harness im Host-Prozess.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness, bindToolsToHarness } from '../src/index.js';
import { type CallModel, type ModelResponse } from '../src/loop/executor.js';
import { buildToolSpecs } from '../src/loop/executor-backend.js';
import { loadGraphcodeConfig, DEFAULT_CONFIG } from '../src/kernel/config.js';
import { delegateBindingOf, DelegateConfigSchema, DelegateInputSchema, executorConfigFor } from '../src/surface/delegate.js';
import { startHostSocket, buildProxyRegistry, type HostSocket } from '../src/surface/host-shim.js';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';

const usage = { in: 10, out: 10, reasoning: 0 };
const FRAGE = 'Innerhalb welcher Zeit muss die Anmeldung gelingen?';
const SEED = [
  '## Nodes',
  '### SYS',
  '+ SYS-app|Eine Test-App fuer die Delegation. [__name:Test App]',
  '### UC',
  '+ UC-login|Nutzer meldet sich an und erhaelt Zugriff auf die App. [__name:Anmelden]',
  '',
  '## Edges',
  '+ SYS-app -compose-> UC-login',
  '',
].join('\n');

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

/** Gescriptetes Backend; `tor` haelt einen Aufruf an, bis der Test ihn freigibt. */
function scriptedModel(responses: ModelResponse[], tor?: Promise<void>): { callModel: CallModel; calls: unknown[][] } {
  const calls: unknown[][] = [];
  const queue = [...responses];
  const callModel: CallModel = async (_system, messages) => {
    calls.push(JSON.parse(JSON.stringify(messages)) as unknown[]);
    if (tor) await tor;
    const next = queue.shift();
    if (!next) throw new Error('scripted model exhausted');
    return next;
  };
  return { callModel, calls };
}

const CONFIG = DelegateConfigSchema.parse({ baseUrl: 'http://scripted.invalid', model: 'scripted', maxRounds: 1, maxStepTurns: 4 });

describe('graph_delegate (CR-GC-714)', () => {
  let repoRoot: string;
  let harness: Awaited<ReturnType<typeof createHarness>>;
  let socket: HostSocket | null = null;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'gc-deleg-'));
    harness = await createHarness({
      repoRoot,
      scope: { workspaceId: 'deleg', systemId: 'deleg' },
      consumerType: 'system',
      preCommitTimeout: 5000,
    });
    await harness.initialize();
  });

  afterEach(async () => {
    await socket?.close();
    socket = null;
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  /** Host-Registry mit Delegation + Socket, davor ein Proxy wie eine zweite Client-Session. */
  async function angedockt(callModel: CallModel): Promise<MCPToolRegistry> {
    const host = bindToolsToHarness(harness, undefined, { delegate: { config: CONFIG, callModel } });
    const socketPath = join(repoRoot, '.graphcode', 'host.sock');
    socket = await startHostSocket(host, socketPath);
    return buildProxyRegistry({ socketPath, delegate: { config: CONFIG } });
  }

  it('Client delegiert ueber den Proxy, die Frage kommt zurueck, die Antwort setzt den Lauf fort', async () => {
    const { callModel, calls } = scriptedModel([mutateCall('c1', `? ${FRAGE}\n`), mutateCall('c2', SEED)]);
    const client = await angedockt(callModel);

    const erst = (await client.graph_delegate.handler({ auftrag: 'Eine Test-App mit Anmeldung.' })) as {
      status: string;
      fragen: string[];
    };
    expect(erst.status).toBe('frage');
    expect(erst.fragen).toEqual([FRAGE]);
    // Angehalten: nichts geschrieben, bis die Antwort kommt.
    expect(harness.getGraph().nodes).toHaveLength(0);

    const dann = (await client.graph_delegate.handler({ antwort: 'in 2 Sekunden' })) as {
      status: string;
      ergebnis: { angewandt: number; abgelehnt: number; fragen: string[] };
    };
    expect(dann.status).toBe('fertig');
    expect(dann.ergebnis.angewandt).toBe(1);
    expect(dann.ergebnis.abgelehnt).toBe(0);
    expect(dann.ergebnis.fragen).toEqual([FRAGE]);
    expect(JSON.stringify(calls[1])).toContain('in 2 Sekunden');
    // Ein Schreiber: was der Executor schrieb, liest der Client ueber denselben Host.
    expect(harness.getGraph().nodes.map((n) => n.uid)).toContain('UC-login');
    const gelesen = (await client.graph_elements.handler({ type: 'UC' })) as { nodes: { uid: string }[] };
    expect(gelesen.nodes.map((n) => n.uid)).toEqual(['UC-login']);
  });

  it('Warte-Budget: ein langer Lauf meldet laeuft, {} wartet weiter bis fertig', async () => {
    let freigeben!: () => void;
    const tor = new Promise<void>((r) => (freigeben = r));
    const { callModel } = scriptedModel([mutateCall('c1', SEED)], tor);
    const client = await angedockt(callModel);

    const erst = (await client.graph_delegate.handler({ auftrag: 'Eine Test-App.', wartenSek: 1 })) as { status: string };
    expect(erst.status).toBe('laeuft');
    await expect(client.graph_delegate.handler({ auftrag: 'Zweiter Auftrag.' })).rejects.toThrow(/läuft bereits/);

    freigeben();
    const dann = (await client.graph_delegate.handler({})) as { status: string };
    expect(dann.status).toBe('fertig');
    await expect(client.graph_delegate.handler({})).rejects.toThrow(/keine Delegation/);
  });

  it('eine Antwort ohne offene Frage wird abgewiesen', async () => {
    let freigeben!: () => void;
    const tor = new Promise<void>((r) => (freigeben = r));
    const { callModel } = scriptedModel([mutateCall('c1', SEED)], tor);
    const client = await angedockt(callModel);
    await client.graph_delegate.handler({ auftrag: 'Eine Test-App.', wartenSek: 1 });
    await expect(client.graph_delegate.handler({ antwort: 'x' })).rejects.toThrow(/keine offene Frage/);
    freigeben();
    expect(((await client.graph_delegate.handler({})) as { status: string }).status).toBe('fertig');
  });

  it('Eingabevertrag: auftrag und antwort schliessen sich aus, fremde Felder und Budget > 600 s sind abgewiesen', async () => {
    const { callModel } = scriptedModel([]);
    const client = await angedockt(callModel);
    await expect(client.graph_delegate.handler({ auftrag: 'a', antwort: 'b' })).rejects.toThrow(/schließen sich aus/);
    expect(DelegateInputSchema.safeParse({ auftrag: 'a', fremd: 1 }).success).toBe(false);
    expect(DelegateInputSchema.safeParse({ wartenSek: 601 }).success).toBe(false);
    expect(DelegateInputSchema.parse({}).wartenSek).toBe(120);
  });

  it('der Executor bekommt graph_delegate nicht angeboten', () => {
    const host = bindToolsToHarness(harness, undefined, { delegate: { config: CONFIG } });
    expect(Object.keys(host)).toContain('graph_delegate');
    const angebot = buildToolSpecs(host, 'full').map((t) => t.name);
    expect(angebot.some((n) => n.includes('graph_delegate'))).toBe(false);
  });
});

describe('Delegations-Config aus graphcode.config.jsonc (CR-GC-714)', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'gc-deleg-cfg-'));
  });
  afterEach(() => rmSync(repoRoot, { recursive: true, force: true }));

  function schreibeConfig(executor: unknown): void {
    writeFileSync(
      join(repoRoot, 'graphcode.config.jsonc'),
      JSON.stringify({ metricPolicy: DEFAULT_CONFIG.metricPolicy, focusThreshold: 0.8, executor }),
    );
  }

  it('ohne Abschnitt executor gibt es kein Werkzeug', () => {
    expect(delegateBindingOf(loadGraphcodeConfig(repoRoot))).toBeUndefined();
  });

  it('der Schluessel kommt aus apiKeyFile, frisch gelesen; interactive ist fest an', () => {
    writeFileSync(join(repoRoot, 'token.txt'), 'geheim\n');
    schreibeConfig({ baseUrl: 'https://127.0.0.1:8080', model: 'qwen', apiKeyFile: 'token.txt' });
    const binding = delegateBindingOf(loadGraphcodeConfig(repoRoot));
    expect(binding?.config.model).toBe('qwen');
    const lauf = executorConfigFor(binding!.config, repoRoot, 5);
    expect(lauf).toMatchObject({ apiKey: 'geheim', interactive: true, maxRounds: 5, candidates: 1 });
  });

  it('ein Schluessel in der eingecheckten Datei wird abgewiesen', () => {
    schreibeConfig({ baseUrl: 'https://127.0.0.1:8080', model: 'qwen', apiKey: 'geheim' });
    expect(() => delegateBindingOf(loadGraphcodeConfig(repoRoot))).toThrow(/executor\..*apiKey|Unrecognized/);
  });
});
