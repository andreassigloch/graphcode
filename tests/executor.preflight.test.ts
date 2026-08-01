/**
 * CR-GC-284 — Batch-Preflight + Autovervollständigung im Executor.
 *
 * Preflight = Batch-Hygiene VOR dem Gate, kein zweites Gate: R-01-Stub,
 * R-18-Auto-Flip, R-08-Fuzzy-Feedback — alles deterministisch, alles aus den
 * Contracts-Imports (TRACE_PATTERNS/isValidTrace), bei Unsicherheit
 * Durchreichen ans Gate. Pur über preflightBatch, integriert über runExecutor
 * mit realer Disk-Kuzu-Harness und gescriptetem Modell (Muster CR-GC-278).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness, bindToolsToHarness } from '../src/index.js';
import {
  runExecutor,
  ExecutorConfigSchema,
  type ModelResponse,
  type CallModel,
} from '../src/executor.js';
import { preflightBatch, fuzzyCandidates, type PreflightKnown } from '../src/preflight.js';

const CONFIG = ExecutorConfigSchema.parse({
  baseUrl: 'http://scripted.invalid',
  model: 'scripted',
  maxRounds: 1,
  maxStepTurns: 4,
});

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

const addNode = (uid: string, type: string, name: string, description = '') => ({
  op: 'add-node',
  node: { uid, type, name, description, attributes: {} },
});
const addEdge = (sourceId: string, targetId: string, edgeType: string) => ({
  op: 'add-edge',
  edge: { sourceId, targetId, edgeType, attributes: {} },
});

const SEED_BATCH = {
  commands: [
    addNode('SYS-app', 'SYS', 'Test App', 'Eine Test-App für den Batch-Preflight.'),
    addNode('ACTOR-user', 'ACTOR', 'User', 'Nutzt die App.'),
    addNode('UC-login', 'UC', 'Login', 'User meldet sich an und erhält Zugriff auf die App.'),
    addEdge('ACTOR-user', 'UC-login', 'io'),
    addEdge('SYS-app', 'UC-login', 'compose'),
  ],
};

// ---------------------------------------------------------------------------
// preflightBatch — pur (kein Store nötig)
// ---------------------------------------------------------------------------

describe('preflightBatch (CR-GC-284, pur)', () => {
  const known = (): PreflightKnown => ({
    types: new Map([
      ['SYS-app', 'SYS'],
      ['ACTOR-user', 'ACTOR'],
      ['UC-login', 'UC'],
    ]),
    verifiedReqs: new Set(),
  });

  it('formatE-Input, exotische Ops und unbekannte Command-Formen gehen UNVERÄNDERT durch', () => {
    const formatE = { formatE: '### SYS\n- SYS-app: App' };
    expect(preflightBatch(formatE, known())).toEqual({ action: 'pass', input: formatE, fixes: [], violations: [] });

    // update-edge = exotische Op → GANZER Batch pass, auch wenn andere Commands reparabel wären.
    const exotic = {
      commands: [
        addNode('REQ-x', 'REQ', 'X', 'Das System muss X in unter 5 s liefern.'),
        { op: 'update-edge', edge: { sourceId: 'ACTOR-user', targetId: 'UC-login', edgeType: 'io' }, set: { flip: true } },
      ],
    };
    expect(preflightBatch(exotic, known()).action).toBe('pass');

    // Unbekannte Command-Form → pass (das Gate urteilt).
    expect(preflightBatch({ commands: [{ op: 'add-node' }] }, known()).action).toBe('pass');
    expect(preflightBatch('kein Objekt', known()).action).toBe('pass');
  });

  it('R-18: nur die Gegenrichtung legal → Auto-Flip, kein zusätzlicher R-01-Stub', () => {
    const input = {
      commands: [
        addNode('REQ-login-2fa', 'REQ', 'Login mit 2FA', 'Das System muss den Login per Zwei-Faktor in unter 5 s bestätigen.'),
        addNode('TEST-2fa', 'TEST', '2FA-Test', 'Prüft den Zwei-Faktor-Login messbar.'),
        addEdge('REQ-login-2fa', 'TEST-2fa', 'verify'), // illegal — legal ist TEST verify REQ
      ],
    };
    const out = preflightBatch(input, known());
    expect(out.action).toBe('fixed');
    expect(out.fixes).toHaveLength(1);
    expect(out.fixes[0]).toContain('R-18 auto-flip');
    const commands = (out.input as { commands: { op: string; edge?: { sourceId: string; targetId: string } }[] }).commands;
    // Kante geflippt …
    const edge = commands.find((c) => c.op === 'add-edge')?.edge;
    expect(edge).toEqual(expect.objectContaining({ sourceId: 'TEST-2fa', targetId: 'REQ-login-2fa' }));
    // … und die geflippte Kante zählt als verify-Partner: KEIN Stub obendrauf.
    expect(commands).toHaveLength(3);
  });

  it('R-18: beide Richtungen illegal → blocked mit legalen Kanten im fixHint, kein Fix', () => {
    const out = preflightBatch({ commands: [addEdge('SYS-app', 'ACTOR-user', 'verify')] }, known());
    expect(out.action).toBe('blocked');
    expect(out.violations).toHaveLength(1);
    expect(out.violations[0].ruleId).toBe('R-18');
    expect(out.violations[0].fixHint).toContain('Legale Kanten von SYS');
  });

  it('R-08: unbekannte uid → blocked mit Fuzzy-Kandidaten', () => {
    const out = preflightBatch({ commands: [addEdge('ACTOR-user', 'UC-logn', 'io')] }, known());
    expect(out.action).toBe('blocked');
    expect(out.violations).toHaveLength(1);
    expect(out.violations[0].ruleId).toBe('R-08');
    expect(out.violations[0].message).toContain('UC-logn');
    expect(out.violations[0].fixHint).toContain('UC-login');
  });

  it('R-01: neue REQ ohne verify-Partner → deterministischer TEST-Stub + verify-Kante', () => {
    const input = {
      commands: [
        addNode('REQ-login-2fa', 'REQ', 'Login mit 2FA', 'Das System muss den Login per Zwei-Faktor in unter 5 s bestätigen.'),
        addEdge('UC-login', 'REQ-login-2fa', 'compose'),
      ],
    };
    const out = preflightBatch(input, known());
    expect(out.action).toBe('fixed');
    expect(out.fixes).toHaveLength(1);
    expect(out.fixes[0]).toContain('R-01 autocomplete');
    const commands = (out.input as { commands: { op: string; node?: { uid: string; type: string; description?: string }; edge?: { sourceId: string; targetId: string; edgeType: string } }[] }).commands;
    expect(commands).toHaveLength(4);
    const stub = commands.find((c) => c.node?.uid === 'TEST-verify-login-2fa');
    expect(stub?.node?.type).toBe('TEST');
    expect(stub?.node?.description).toContain('it.todo');
    expect(commands.at(-1)?.edge).toEqual(
      expect.objectContaining({ sourceId: 'TEST-verify-login-2fa', targetId: 'REQ-login-2fa', edgeType: 'verify' }),
    );
    // Deterministisch: gleicher Input + gleicher Zustand ⇒ identisches Ergebnis.
    expect(preflightBatch(input, known())).toEqual(out);
  });

  it('R-01: im Graph bereits verifizierte REQ bekommt KEINEN Stub', () => {
    const k = known();
    k.types.set('REQ-alt', 'REQ');
    k.verifiedReqs.add('REQ-alt');
    const out = preflightBatch(
      { commands: [addNode('REQ-alt', 'REQ', 'Alt', 'Das System muss Alt messbar liefern.')] },
      k,
    );
    expect(out.action).toBe('pass');
  });

  it('fuzzyCandidates: Substring und Tippfehler treffen, Fremdes nicht', () => {
    const uids = ['UC-login', 'UC-export', 'ACTOR-user'];
    expect(fuzzyCandidates('UC-logn', uids)).toContain('UC-login');
    expect(fuzzyCandidates('login', uids)).toContain('UC-login');
    expect(fuzzyCandidates('FCHAIN-zahlung', uids)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Preflight im Executor — reale Disk-Kuzu-Harness, gescriptetes Modell
// ---------------------------------------------------------------------------

describe('executor preflight (CR-GC-284, real harness)', () => {
  let repoRoot: string;
  let harness: Awaited<ReturnType<typeof createHarness>>;
  let registry: ReturnType<typeof bindToolsToHarness>;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-preflight-'));
    harness = await createHarness({
      repoRoot,
      scope: { workspaceId: 'preflight-test', systemId: 'preflight-test' },
      consumerType: 'system',
      preCommitTimeout: 5000,
    });
    await harness.initialize();
    registry = bindToolsToHarness(harness);
    const seeded = (await registry['graph_mutate'].handler(SEED_BATCH)) as { success: boolean };
    expect(seeded.success).toBe(true);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('REQ ohne TEST → Stub angehängt, Gate applied (AK 1)', async () => {
    const reqOnly = {
      commands: [
        addNode('REQ-login-2fa', 'REQ', 'Login mit 2FA', 'Das System muss den Login per Zwei-Faktor in unter 5 s bestätigen.'),
        addEdge('UC-login', 'REQ-login-2fa', 'compose'),
      ],
    };
    const { callModel, calls } = scriptedModel([toolCallResponse('c1', reqOnly)]);
    const traces: string[] = [];
    const stats = await runExecutor({
      registry,
      workspaceDir: repoRoot,
      config: CONFIG,
      callModel,
      trace: (l) => traces.push(l),
    });

    // Ein Modell-Call, ein Gate-Apply — der Stub kam vom Preflight, nicht vom Repair-Loop.
    expect(calls.length).toBe(1);
    expect(stats.mutatesApplied).toBe(1);
    expect(stats.mutatesRejected).toBe(0);
    expect(stats.preflightFixed).toBe(1);
    expect(stats.preflightBlocked).toBe(0);
    expect(traces.some((l) => l.includes('preflight: R-01 autocomplete'))).toBe(true);

    // Durable: REQ + deterministischer TEST-Stub + verify-Kante im Store.
    const g = harness.getGraph();
    expect(g.nodes.map((n) => n.uid)).toContain('REQ-login-2fa');
    const stub = g.nodes.find((n) => n.uid === 'TEST-verify-login-2fa');
    expect(stub?.type).toBe('TEST');
    expect(stub?.description).toContain('it.todo');
    expect(
      g.edges.some(
        (e) => e.sourceId === 'TEST-verify-login-2fa' && e.targetId === 'REQ-login-2fa' && e.edgeType === 'verify',
      ),
    ).toBe(true);
  });

  it('REQ -verify-> TEST wird zu TEST -verify-> REQ geflippt (AK 2)', async () => {
    const wrongDirection = {
      commands: [
        addNode('REQ-login-2fa', 'REQ', 'Login mit 2FA', 'Das System muss den Login per Zwei-Faktor in unter 5 s bestätigen.'),
        addNode('TEST-2fa', 'TEST', '2FA-Test', 'Prüft den Zwei-Faktor-Login messbar.'),
        addEdge('UC-login', 'REQ-login-2fa', 'compose'),
        addEdge('REQ-login-2fa', 'TEST-2fa', 'verify'),
      ],
    };
    const { callModel, calls } = scriptedModel([toolCallResponse('c1', wrongDirection)]);
    const stats = await runExecutor({ registry, workspaceDir: repoRoot, config: CONFIG, callModel });

    expect(calls.length).toBe(1);
    expect(stats.mutatesApplied).toBe(1);
    expect(stats.preflightFixed).toBe(1);
    const g = harness.getGraph();
    expect(
      g.edges.some((e) => e.sourceId === 'TEST-2fa' && e.targetId === 'REQ-login-2fa' && e.edgeType === 'verify'),
    ).toBe(true);
    expect(g.edges.some((e) => e.sourceId === 'REQ-login-2fa' && e.edgeType === 'verify')).toBe(false);
    // Kein Stub — die geflippte Kante IST der verify-Partner.
    expect(g.nodes.some((n) => n.uid.startsWith('TEST-verify-'))).toBe(false);
  });

  it('add-edge auf unbekannte uid → lokales Feedback mit Kandidaten, kein Gate-Call (AK 3)', async () => {
    const ghostEdge = { commands: [addEdge('ACTOR-user', 'UC-logn', 'io')] };
    const followUp = {
      commands: [
        addNode('UC-export', 'UC', 'Export', 'User exportiert den Stand und erhält die Datei.'),
        addEdge('SYS-app', 'UC-export', 'compose'),
        addEdge('ACTOR-user', 'UC-export', 'io'),
      ],
    };
    const { callModel, calls } = scriptedModel([
      toolCallResponse('c1', ghostEdge),
      toolCallResponse('c2', followUp),
    ]);
    const before = harness.getGraph().edges.length;
    const stats = await runExecutor({ registry, workspaceDir: repoRoot, config: CONFIG, callModel });

    // Lokales Feedback im selben Step: Preflight-Kopf + Fuzzy-Kandidat in der History.
    expect(calls.length).toBe(2);
    const secondCallText = JSON.stringify(calls[1].messages);
    expect(secondCallText).toContain('NICHT eingereicht');
    expect(secondCallText).toContain('Ähnlich vorhanden');
    expect(secondCallText).toContain('UC-login');

    // Kein Gate-Call für den geblockten Batch (AK 4: getrennte Zählung).
    expect(stats.preflightBlocked).toBe(1);
    expect(stats.preflightFixed).toBe(0);
    expect(stats.mutatesRejected).toBe(0);
    expect(stats.mutatesApplied).toBe(1);

    // Der Ghost-Batch hat nichts persistiert; der korrigierte Batch schon.
    const g = harness.getGraph();
    expect(g.edges.some((e) => e.targetId === 'UC-logn')).toBe(false);
    expect(g.nodes.map((n) => n.uid)).toContain('UC-export');
    expect(g.edges.length).toBe(before + 2);
  });
});
