/**
 * CR-GC-714 — `graph_delegate`: der angedockte Client gibt Modellarbeit an den Executor im Host ab.
 *
 * Reale Persistenz (Disk-Kuzu im temp repoRoot), echter Host-Socket und echter Proxy — simuliert
 * ist nur der Modell-Endpunkt. Ein Schreiber: Client (über den Proxy) und Executor treffen denselben
 * Harness im Host-Prozess.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness, bindToolsToHarness } from '../src/index.js';
import { type CallModel, type ModelResponse } from '../src/loop/executor.js';
import { buildToolSpecs } from '../src/loop/executor-backend.js';
import { loadGraphcodeConfig, DEFAULT_CONFIG } from '../src/kernel/config.js';
import {
  delegateBindingOf,
  DelegateConfigSchema,
  DelegateInputSchema,
  DELEGATION_LOG,
  executorConfigFor,
  schlussHinweis,
  WARTEN_MAX_SEK,
  WARTEN_VORGABE_SEK,
} from '../src/surface/delegate.js';
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

  it('CR-GC-726: die Spur steht in .graphcode/delegation.log — Start, Frage, Antwort, Ende', async () => {
    const { callModel } = scriptedModel([mutateCall('c1', `? ${FRAGE}\n`), mutateCall('c2', SEED)]);
    const client = await angedockt(callModel);
    await client.graph_delegate.handler({ auftrag: 'Eine Test-App mit Anmeldung.' });
    // Ein zweiter Auftrag nennt den Aufruf, der weiterführt — hier die offene Frage.
    await expect(client.graph_delegate.handler({ auftrag: 'Zweiter Auftrag.' })).rejects.toThrow(/graph_delegate\(\{antwort\}\)/);
    await client.graph_delegate.handler({ antwort: 'in 2 Sekunden' });

    const zeilen = readFileSync(join(repoRoot, '.graphcode', DELEGATION_LOG), 'utf8').trimEnd().split('\n');
    const text = zeilen.map((z) => z.split('\t')[1]);
    expect(text[0]).toBe('[delegation] start modell=scripted');
    expect(text).toContain(`[delegation] frage ${FRAGE}`);
    expect(text).toContain('[delegation] antwort in 2 Sekunden');
    expect(text.at(-1)).toMatch(/^\[delegation\] fertig stop=\w+ runden=\d+ angewandt=1 abgelehnt=0$/);
    // Jede Zeile trägt ihren Zeitpunkt.
    for (const z of zeilen) expect(z).toMatch(/^\d{4}-\d\d-\d\dT[\d:.]+Z\t/);
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

  it('Eingabevertrag: auftrag und antwort schliessen sich aus, fremde Felder sind abgewiesen; die Warte-Vorgabe liegt unter dem Client-Abbruch', async () => {
    const { callModel } = scriptedModel([]);
    const client = await angedockt(callModel);
    await expect(client.graph_delegate.handler({ auftrag: 'a', antwort: 'b' })).rejects.toThrow(/schließen sich aus/);
    expect(DelegateInputSchema.safeParse({ auftrag: 'a', fremd: 1 }).success).toBe(false);
    // CR-GC-726: ohne eigene Einstellung wartet kein Aufruf länger als der 60-s-Abbruch des MCP-Clients.
    const CLIENT_ABBRUCH_SEK = 60;
    expect(WARTEN_VORGABE_SEK).toBeLessThan(CLIENT_ABBRUCH_SEK);
    expect(DelegateInputSchema.parse({}).wartenSek).toBeUndefined();
    expect(DelegateInputSchema.safeParse({ wartenSek: WARTEN_MAX_SEK + 1 }).success).toBe(false);
    // CR-GC-727: ein längeres Budget ist eine Einstellung des Repos, kein Wert des Modells.
    expect(DelegateConfigSchema.parse({ baseUrl: 'http://x.invalid', model: 'm', wartenSek: 600 }).wartenSek).toBe(600);
    expect(DelegateConfigSchema.safeParse({ baseUrl: 'http://x.invalid', model: 'm', wartenSek: WARTEN_MAX_SEK + 1 }).success).toBe(false);
  });

  it('CR-GC-727: executor.wartenSek aus der Config bestimmt, wie lange ein Aufruf ohne eigenes Budget wartet', async () => {
    let freigeben!: () => void;
    const tor = new Promise<void>((r) => (freigeben = r));
    const { callModel } = scriptedModel([mutateCall('c1', SEED)], tor);
    const kurz = DelegateConfigSchema.parse({ ...CONFIG, wartenSek: 1 });
    const host = bindToolsToHarness(harness, undefined, { delegate: { config: kurz, callModel } });

    const t0 = Date.now();
    const erst = (await host.graph_delegate.handler({ auftrag: 'Eine Test-App.' })) as { status: string };
    const gewartet = Date.now() - t0;
    expect(erst.status).toBe('laeuft');
    // 1 s aus der Config, nicht die Vorgabe von 45 s.
    expect(gewartet).toBeGreaterThanOrEqual(900);
    expect(gewartet).toBeLessThan(5000);
    // Der Executor bekommt das Feld nicht — es gehört der Delegation.
    expect(executorConfigFor(kurz, repoRoot)).not.toHaveProperty('wartenSek');

    freigeben();
    expect(((await host.graph_delegate.handler({})) as { status: string }).status).toBe('fertig');
  });

  it('CR-GC-728: der Schluss nennt den Grund und den Aufruf, der weiterführt', async () => {
    // Ende am Rundenbudget (CONFIG: maxRounds 1), der Auftrag hat das leere Modell begonnen.
    const { callModel } = scriptedModel([mutateCall('c1', SEED)]);
    const client = await angedockt(callModel);
    const erst = (await client.graph_delegate.handler({ auftrag: 'Eine Test-App mit Anmeldung.' })) as {
      ergebnis: { stopReason: string; hinweis: string };
    };
    expect(erst.ergebnis.stopReason).toBe('maxRounds');
    expect(erst.ergebnis.hinweis).toContain('graph_delegate({auftrag:"weiter"})');
    expect(erst.ergebnis.hinweis).not.toContain('nicht gelesen');

  });

  it('CR-GC-728: festgefahren mit offenen Analysen nennt den Task-Aufruf, ohne Analysen das Ende', () => {
    const mitTasks = schlussHinweis(
      { stopReason: 'stalled', startPhase: 'expand', offeneTasks: ['conops', 'fmea'], offeneFunde: ['Anforderung:AF-01:SYS-x'] },
      { auftrag: 'weiter' },
    );
    expect(mitTasks).toContain('graph_delegate({task:"conops"})');
    expect(mitTasks).toContain('Analysen conops, fmea');
    expect(mitTasks).toContain('Der Auftragstext wurde nicht gelesen');
    const ohne = schlussHinweis({ stopReason: 'stalled', startPhase: 'expand', offeneTasks: [], offeneFunde: ['Anwendungsfall:UC-02:UC-a'] }, { task: undefined });
    expect(ohne).toContain('sitzt fest');
    expect(ohne).toContain('Anwendungsfall:UC-02:UC-a');
    expect(ohne).toContain('berichte dem Nutzer');
    expect(schlussHinweis({ stopReason: 'handoff', startPhase: 'seed' }, { auftrag: 'x' })).toBe('Fertig: kein offener Regelhinweis mehr.');
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
