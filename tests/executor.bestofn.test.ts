/**
 * CR-GC-288 — Best-of-N-Auswahl im Treiber (deterministisch) +
 * CR-GC-289 — Ranking auf Ziel-Delta statt Volumen.
 *
 * Reale Persistenz (Disk-Kuzu in temp repoRoot), gescriptetes Modell-Backend —
 * der Modell-Endpoint ist die einzige simulierte Grenze; Gate, dryRun-Proben,
 * fitAdvisory, steeringDelta und Audit sind der echte Pfad.
 *
 * Kern-Invarianten: N Kandidaten werden als Gate-dryRun geprobt (auditiert als
 * validate, nie ein Step-Abschluss), NUR der Gewinner wird ohne dryRun
 * angewandt; die Auswahl ist deterministisch (tier → Fokus-Score-Delta →
 * Gesamt-Readiness-Delta mit blockingErrors-Anstieg strikt schlechter →
 * Δm arch → Ausbeute); judge:'model' loggt BEIDE Picks; N=1 bleibt der
 * unveränderte heutige Pfad.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness, bindToolsToHarness } from '../src/index.js';
import {
  runExecutor,
  rankCandidates,
  deltaSum,
  focusDelta,
  totalDelta,
  temperatureSpread,
  TEMPERATURE_ANCHORS,
  ExecutorConfigSchema,
  type ModelResponse,
  type CallModel,
} from '../src/executor.js';

const config = (over: Record<string, unknown> = {}) =>
  ExecutorConfigSchema.parse({
    baseUrl: 'http://scripted.invalid',
    model: 'scripted',
    maxRounds: 1,
    maxStepTurns: 4,
    ...over,
  });

/** Gescriptetes Backend: Antworten der Reihe nach, protokolliert Calls inkl. opts (Temperatur). */
function scriptedModel(responses: ModelResponse[]): {
  callModel: CallModel;
  calls: { system: string; messages: unknown[]; opts?: { temperature?: number } }[];
} {
  const calls: { system: string; messages: unknown[]; opts?: { temperature?: number } }[] = [];
  const queue = [...responses];
  const callModel: CallModel = (system, messages, _tools, opts) => {
    calls.push({ system, messages: JSON.parse(JSON.stringify(messages)) as unknown[], opts });
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

function textResponse(text: string): ModelResponse {
  return { text, toolCalls: [], assistantMsg: { role: 'assistant', content: text }, usage };
}

// --- Kandidaten-Batches mit empirisch verifizierten Gate-Verdicts (dryRun) ----
// GHOST → tier block (STRUCT) · UC_EXPORT → suggest, Δm=0, mutations=3 ·
// UPDATE_SYS → auto-apply, mutations=1 · FUNC_PAIR → suggest, Δm≈+4.58, mutations=5.

const BLOCK_BATCH = {
  commands: [
    { op: 'add-node', node: { uid: 'GHOST-x', type: 'GHOST', name: 'Ghost', description: 'Unbekannter Typ.', attributes: {} } },
  ],
};

const UC_EXPORT_BATCH = {
  commands: [
    { op: 'add-node', node: { uid: 'UC-export', type: 'UC', name: 'Export', description: 'User exportiert den Stand und erhält die Datei.', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: 'SYS-app', targetId: 'UC-export', edgeType: 'compose', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: 'ACTOR-user', targetId: 'UC-export', edgeType: 'io', attributes: {} } },
  ],
};

const UPDATE_SYS_BATCH = {
  commands: [
    { op: 'update-node', node: { uid: 'SYS-app', type: 'SYS', attributes: { note: 'aktualisiert' } } },
  ],
};

const FUNC_PAIR_BATCH = {
  commands: [
    { op: 'add-node', node: { uid: 'FUNC-auth', type: 'FUNC', name: 'Authentifizieren', description: 'Prüft Credentials.', attributes: {} } },
    { op: 'add-node', node: { uid: 'FUNC-session', type: 'FUNC', name: 'Session anlegen', description: 'Erzeugt die Session.', attributes: {} } },
    { op: 'add-node', node: { uid: 'FLOW-cred', type: 'FLOW', name: 'Credentials', description: 'Credential-Fluss.', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: 'FUNC-auth', targetId: 'FLOW-cred', edgeType: 'io', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: 'FLOW-cred', targetId: 'FUNC-session', edgeType: 'io', attributes: {} } },
  ],
};

// --- CR-GC-289: A-vs-B — Volumen gegen Fokus-Reparatur (Fokus nach Seed = 'uc') ---
// A: 6 neue UCs ohne REQ (18 Mutationen) — Steering: uc-Score SINKT (-0.17),
//    blockingErrors steigen 1→7. B: REQ+TEST auf UC-login (4 Mutationen) —
//    uc +0.18, req/ver werden anwendbar, blockingErrors 1→0. Beide tier=suggest.

const VOLUME_UC_BATCH = {
  commands: Array.from({ length: 6 }, (_, i) => i + 1).flatMap((i) => [
    { op: 'add-node', node: { uid: `UC-vol-${i}`, type: 'UC', name: `Volumen ${i}`, description: `User erledigt Aufgabe ${i} und erhält das Ergebnis ${i}.`, attributes: {} } },
    { op: 'add-edge', edge: { sourceId: 'SYS-app', targetId: `UC-vol-${i}`, edgeType: 'compose', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: 'ACTOR-user', targetId: `UC-vol-${i}`, edgeType: 'io', attributes: {} } },
  ]),
};

const FOCUS_REPAIR_BATCH = {
  commands: [
    { op: 'add-node', node: { uid: 'REQ-login', type: 'REQ', name: 'Login bestätigt', description: 'Der Login wird innerhalb von 2s bestätigt.', attributes: {} } },
    { op: 'add-node', node: { uid: 'TEST-login', type: 'TEST', name: 'Login-Test', description: 'Prüft die Login-Bestätigung.', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: 'UC-login', targetId: 'REQ-login', edgeType: 'compose', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: 'TEST-login', targetId: 'REQ-login', edgeType: 'verify', attributes: {} } },
  ],
};

const SEED_BATCH = {
  commands: [
    { op: 'add-node', node: { uid: 'SYS-app', type: 'SYS', name: 'Test App', description: 'Eine Test-App für Best-of-N.', attributes: {} } },
    { op: 'add-node', node: { uid: 'ACTOR-user', type: 'ACTOR', name: 'User', description: 'Nutzt die App.', attributes: {} } },
    { op: 'add-node', node: { uid: 'UC-login', type: 'UC', name: 'Login', description: 'User meldet sich an und erhält Zugriff.', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: 'ACTOR-user', targetId: 'UC-login', edgeType: 'io', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: 'SYS-app', targetId: 'UC-login', edgeType: 'compose', attributes: {} } },
  ],
};

describe('Best-of-N ranking (pur, deterministisch)', () => {
  const cand = (index: number, verdict: Record<string, unknown> | null) =>
    ({ index, verdict }) as Parameters<typeof rankCandidates>[0][number];

  it('ohne Ziel-Delta bleibt tier die Präferenz: auto-apply schlägt suggest trotz schlechterem Δm', () => {
    const a = cand(0, { success: true, tier: 'suggest', fitAdvisory: { delta: [0.9] }, mutations: 99 });
    const b = cand(1, { success: true, tier: 'auto-apply', fitAdvisory: { delta: [-0.5] }, mutations: 1 });
    expect(rankCandidates([a, b])[0]).toBe(b);
  });

  it('v17-Fix: Fortschritts-suggest schlägt Null-Fortschritt-auto-apply (tier ist keine Vorstufe mehr)', () => {
    // Der Runde-3-Fall aus v17: 20 Upsert-Mutationen als auto-apply mit total=0.00
    // gegen eine kleine Reparatur (+0.04 auf der Fokus-Dimension) als suggest.
    const noop = cand(0, {
      success: true, tier: 'auto-apply', mutations: 20,
      steeringDelta: steering(0, 0, {}),
    });
    const repair = cand(1, {
      success: true, tier: 'suggest', mutations: 2,
      steeringDelta: steering(0, 0, { uc: 0.04 }),
    });
    expect(rankCandidates([noop, repair], 'uc')[0]).toBe(repair);
    // Bei ECHTEM Gleichstand im Ziel-Delta bleibt auto-apply die Präferenz.
    const cleanEqual = cand(2, {
      success: true, tier: 'auto-apply', mutations: 2,
      steeringDelta: steering(0, 0, { uc: 0.04 }),
    });
    expect(rankCandidates([repair, cleanEqual], 'uc')[0]).toBe(cleanEqual);
  });

  it('Gleichstand im tier, kein steeringDelta → Δm (layer:arch) entscheidet — der Tiebreaker', () => {
    const a = cand(0, { success: true, tier: 'suggest', fitAdvisory: { delta: [-0.2, 0.1] }, mutations: 99 });
    const b = cand(1, { success: true, tier: 'suggest', fitAdvisory: { delta: [0.1, 0.05] }, mutations: 1 });
    expect(deltaSum(a.verdict)).toBeCloseTo(-0.1);
    expect(deltaSum(b.verdict)).toBeCloseTo(0.15);
    expect(rankCandidates([a, b])[0]).toBe(b);
  });

  const steering = (blockBefore: number, blockAfter: number, dims: Record<string, number>) => ({
    blockingErrors: { before: blockBefore, after: blockAfter },
    dimensions: Object.fromEntries(
      Object.entries(dims).map(([d, delta]) => [d, { before: 0.5, after: 0.5 + delta, delta }]),
    ),
  });

  it('CR-GC-289: Fokus-Score-Delta schlägt Gesamt-Delta, Δm UND Ausbeute', () => {
    // a: besserer Gesamt-Fortschritt + Δm + Volumen, aber NICHT auf der Fokus-Dimension.
    const a = cand(0, {
      success: true, tier: 'suggest', mutations: 40,
      fitAdvisory: { delta: [2.0] },
      steeringDelta: steering(0, 0, { arch: 0.3, alloc: 0.2 }),
    });
    const b = cand(1, {
      success: true, tier: 'suggest', mutations: 12,
      fitAdvisory: { delta: [0] },
      steeringDelta: steering(0, 0, { req: 0.04 }),
    });
    expect(focusDelta(b.verdict, 'req')).toBeCloseTo(0.04);
    expect(totalDelta(a.verdict)).toBeCloseTo(0.5);
    expect(rankCandidates([a, b], 'req')[0]).toBe(b);
    // Ohne Fokus-Dimension fällt die Stufe weg — dann gewinnt a über das Gesamt-Delta.
    expect(rankCandidates([a, b], null)[0]).toBe(a);
  });

  it('CR-GC-289: blockingErrors-Anstieg ist strikt schlechter als jedes Score-Plus', () => {
    // a: großes Gesamt-Delta, aber neue Steering-Blocker; b: kleines Plus, keine neuen Blocker.
    const a = cand(0, {
      success: true, tier: 'suggest', mutations: 26,
      steeringDelta: steering(1, 7, { uc: 0.5 }),
    });
    const b = cand(1, {
      success: true, tier: 'suggest', mutations: 3,
      steeringDelta: steering(1, 1, { uc: 0.01 }),
    });
    expect(rankCandidates([a, b], null)[0]).toBe(b);
    // Auf der Fokus-Stufe zählt weiterhin das reine Score-Delta (Reihenfolge lt. CR).
    expect(rankCandidates([a, b], 'uc')[0]).toBe(a);
  });

  it('Gleichstand in tier UND Δm → Element-Ausbeute (mutations), dann Index', () => {
    const a = cand(0, { success: true, tier: 'suggest', fitAdvisory: { delta: [0] }, mutations: 3 });
    const b = cand(1, { success: true, tier: 'suggest', fitAdvisory: { delta: [0] }, mutations: 7 });
    expect(rankCandidates([a, b])[0]).toBe(b);
    const c = cand(2, { success: true, tier: 'suggest', fitAdvisory: { delta: [0] }, mutations: 7 });
    expect(rankCandidates([c, b])[0]).toBe(b); // voller Gleichstand → kleinerer Index
  });

  it('block/fehlendes Verdict rankt immer hinter jedem viablen Kandidaten', () => {
    const blocked = cand(0, { success: false, tier: 'block', mutations: 50 });
    const none = cand(1, null);
    const ok = cand(2, { success: true, tier: 'suggest', mutations: 1 });
    expect(rankCandidates([blocked, none, ok])[0]).toBe(ok);
  });

  it('temperatureSpread: N=3 trifft die Anker exakt, N≠3 interpoliert deterministisch', () => {
    expect(temperatureSpread(3)).toEqual([...TEMPERATURE_ANCHORS]);
    expect(temperatureSpread(2)).toEqual([0.15, 0.7]);
    expect(temperatureSpread(1)).toEqual([0.15]);
    const four = temperatureSpread(4);
    expect(four[0]).toBeCloseTo(0.15);
    expect(four[1]).toBeCloseTo(0.15 + (2 / 3) * 0.25);
    expect(four[2]).toBeCloseTo(0.4 + (1 / 3) * 0.3);
    expect(four[3]).toBeCloseTo(0.7);
  });
});

describe('Best-of-N executor (CR-GC-288, echter Gate-/Store-Pfad)', () => {
  let repoRoot: string;
  let harness: Awaited<ReturnType<typeof createHarness>>;
  let registry: ReturnType<typeof bindToolsToHarness>;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-bestofn-'));
    harness = await createHarness({
      repoRoot,
      scope: { workspaceId: 'bestofn-test', systemId: 'bestofn-test' },
      consumerType: 'system',
      preCommitTimeout: 5000,
    });
    await harness.initialize();
    registry = bindToolsToHarness(harness);
    // Expand-Phase: Seed direkt durchs Gate, damit die Kandidaten-Batches auf
    // existierende uids referenzieren können.
    const res = (await registry['graph_mutate'].handler(SEED_BATCH)) as { success: boolean };
    expect(res.success).toBe(true);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  const uids = (): string[] => harness.getGraph().nodes.map((n) => n.uid);

  const auditEntries = (): { operation?: string; result: string }[] =>
    readFileSync(join(repoRoot, '.graphcode', 'audit.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { operation?: string; result: string });

  it('3 Kandidaten (block/suggest/auto-apply) → auto-apply gewinnt, nur er wird persistiert, Proben als validate auditiert', async () => {
    const { callModel, calls } = scriptedModel([
      toolCallResponse('c1', BLOCK_BATCH),
      toolCallResponse('c2', UC_EXPORT_BATCH),
      toolCallResponse('c3', UPDATE_SYS_BATCH),
    ]);
    const traces: string[] = [];
    const before = auditEntries().length;

    const stats = await runExecutor({
      registry,
      workspaceDir: repoRoot,
      config: config({ candidates: 3 }),
      callModel,
      trace: (l) => traces.push(l),
    });

    // Jeder Kandidat sah dieselbe Runden-Prompt-Basis in getrennter History.
    expect(calls.length).toBe(3);
    for (const c of calls) expect(c.messages.length).toBe(1);
    expect(calls[1].messages[0]).toEqual(calls[0].messages[0]);
    expect(calls[2].messages[0]).toEqual(calls[0].messages[0]);

    // Auswahl: auto-apply (UPDATE_SYS) gewinnt — nur er ist persistiert.
    expect(stats.candidatesSampled).toBe(3);
    expect(stats.dryRunProbes).toBe(3);
    expect(stats.mutatesApplied).toBe(1);
    expect(stats.algoPicks).toBe(1);
    expect(stats.modelPicks).toBe(0);
    const sys = harness.getGraph().nodes.find((n) => n.uid === 'SYS-app') as { attributes?: Record<string, unknown> };
    expect(sys.attributes?.note).toBe('aktualisiert');
    expect(uids()).not.toContain('UC-export'); // der Verlierer-Kandidat ist NICHT im Store
    expect(uids()).not.toContain('GHOST-x');

    // Trace-Zeilen (CR-GC-289): ALLE Ranking-Stufen sichtbar — tier, Fokus-Delta,
    // Gesamt-Delta, Δm, mutations — plus der Pick.
    const CAND = String.raw`tier=(\S+) focus\(uc\)=([+-]\d+\.\d{2}) total=([+-]\d+\.\d{2}) Δm=([+-]\d+\.\d{2}) mutations=(\d+)`;
    expect(traces.some((l) => new RegExp(String.raw`candidate 1/3: tier=block .*mutations=0`).test(l))).toBe(true);
    expect(traces.some((l) => new RegExp(String.raw`candidate 2/3: ${CAND}`).test(l))).toBe(true);
    expect(traces.some((l) => /candidate 3\/3: tier=auto-apply/.test(l))).toBe(true);
    expect(traces.some((l) => l.includes('pick: candidate 3 (judge=gate)'))).toBe(true);

    // Audit: 3 dryRun-Proben als operation:'validate' + genau 1 echter Apply.
    const entries = auditEntries().slice(before);
    expect(entries.filter((e) => e.operation === 'validate').length).toBe(3);
    expect(entries.filter((e) => e.operation !== 'validate' && e.result === 'applied').length).toBe(1);
  });

  it('CR-GC-289 Kern: Fokus-Reparatur (REQ+TEST, 4 Mutationen) schlägt UC-Volumen (18 Mutationen) — echte Verdicts', async () => {
    // Fokus der Runde nach dem Seed = 'uc' (UC-login ohne REQ/FCHAIN). A (Volumen):
    // 6 UCs ohne REQ — uc-Score SINKT, blockingErrors 1→7. B (Fokus-Reparatur):
    // REQ+TEST auf UC-login — uc +0.18. Beide tier=suggest; unter CR-288-Ranking
    // (Δm=0 beidseitig → mutations) hätte A gewonnen — Volumen-Bias der v16-Monokultur.
    const { callModel } = scriptedModel([
      toolCallResponse('c1', VOLUME_UC_BATCH), // suggest, Δm=0, mutations=18
      toolCallResponse('c2', FOCUS_REPAIR_BATCH), // suggest, Δm=0, mutations=4
    ]);
    const traces: string[] = [];

    const stats = await runExecutor({
      registry,
      workspaceDir: repoRoot,
      config: config({ candidates: 2 }),
      callModel,
      trace: (l) => traces.push(l),
    });

    expect(stats.mutatesApplied).toBe(1);
    // Der Trace macht den Pick nachvollziehbar: A mit negativem, B mit positivem Fokus-Delta.
    // (totals seit contracts 3.1.0 inkl. AF-01..05-Dimension — Fokus-Deltas unverändert)
    expect(traces.some((l) => /candidate 1\/2: tier=suggest focus\(uc\)=-0\.17 total=\+0\.05 Δm=\+0\.00 mutations=18/.test(l))).toBe(true);
    expect(traces.some((l) => /candidate 2\/2: tier=suggest focus\(uc\)=\+0\.18 total=\+1\.16 Δm=\+0\.00 mutations=4/.test(l))).toBe(true);
    expect(traces.some((l) => l.includes('pick: candidate 2 (judge=gate)'))).toBe(true);
    expect(uids()).toContain('REQ-login'); // der Ziel-Delta-Gewinner ist persistiert …
    expect(uids()).toContain('TEST-login');
    expect(uids()).not.toContain('UC-vol-1'); // … das Volumen nicht
  });

  it("judge:'model': beide Picks werden geloggt, angewandt wird der Modell-Pick (Disagreement messbar)", async () => {
    // Algo-Pick = FUNC_PAIR (Δm>0); das Modell wählt Nr. 2 der gerankten Liste (= UC_EXPORT).
    const { callModel, calls } = scriptedModel([
      toolCallResponse('c1', UC_EXPORT_BATCH),
      toolCallResponse('c2', FUNC_PAIR_BATCH),
      textResponse('Ich wähle 2.'),
    ]);
    const traces: string[] = [];

    const stats = await runExecutor({
      registry,
      workspaceDir: repoRoot,
      config: config({ candidates: 2, judge: 'model' }),
      callModel,
      trace: (l) => traces.push(l),
    });

    // Der Judge-Call zeigt die gerenderten Verdicts der viablen Kandidaten.
    expect(calls.length).toBe(3);
    const judgePrompt = JSON.stringify(calls[2].messages);
    expect(judgePrompt).toContain('tier=suggest');
    expect(judgePrompt).toContain('Antworte NUR mit der Nummer');

    // Beide Picks geloggt; angewandt ist der Modell-Pick (UC_EXPORT), nicht der Algo-Pick.
    expect(stats.modelPicks).toBe(1);
    expect(stats.judgeDisagreements).toBe(1);
    expect(stats.algoPicks).toBe(0);
    expect(traces.some((l) => /pick: algo=2 model=1 applied=1 \(judge=model\)/.test(l))).toBe(true);
    expect(uids()).toContain('UC-export');
    expect(uids()).not.toContain('FUNC-auth');
  });

  it('ALLE Kandidaten block → bestes Feedback ans Modell, der reparierte Kandidat wird angewandt (Repair-Loop)', async () => {
    const { callModel, calls } = scriptedModel([
      toolCallResponse('c1', BLOCK_BATCH),
      toolCallResponse('c2', BLOCK_BATCH),
      toolCallResponse('c3', UC_EXPORT_BATCH), // Repair-Nachlieferung des besten Kandidaten
    ]);
    const traces: string[] = [];

    const stats = await runExecutor({
      registry,
      workspaceDir: repoRoot,
      config: config({ candidates: 2 }),
      callModel,
      trace: (l) => traces.push(l),
    });

    // Das Gate-Feedback (violations) stand in der History des Repair-Calls.
    expect(calls.length).toBe(3);
    const repairHistory = JSON.stringify(calls[2].messages);
    expect(repairHistory).toContain('NICHT übernommen');
    expect(traces.some((l) => l.includes('all candidates block'))).toBe(true);

    expect(stats.candidatesSampled).toBe(3); // 2 Kandidaten + 1 Repair-Nachlieferung
    expect(stats.dryRunProbes).toBe(3);
    expect(stats.mutatesApplied).toBe(1);
    expect(stats.repairedAfterRejection).toBe(1);
    expect(uids()).toContain('UC-export');
    expect(uids()).not.toContain('GHOST-x');
  });

  it('driver-Prompt: mit candidates>1 verschwindet der dryRun-Vergleichs-Auftrag aus der Instruktion', async () => {
    const { callModel, calls } = scriptedModel([
      toolCallResponse('c1', UC_EXPORT_BATCH),
      toolCallResponse('c2', FUNC_PAIR_BATCH),
      toolCallResponse('c3', UPDATE_SYS_BATCH),
    ]);
    await runExecutor({
      registry,
      workspaceDir: repoRoot,
      config: config({ candidates: 3 }),
      callModel,
    });
    const instruction = JSON.stringify(calls[0].messages[0]);
    expect(instruction).not.toContain('dryRun');
    expect(instruction).toContain('Treiber');
    expect(instruction).toContain('graph_authoring_guide'); // Schritt 1 bleibt

    // openai-Backend: Temperatur-Spread [0.15, 0.4, 0.7] pro Kandidat.
    expect(calls.map((c) => c.opts?.temperature)).toEqual([0.15, 0.4, 0.7]);
  });

  it('anthropic-Backend: N Calls OHNE temperature (die Claude-5-API lehnt den Parameter ab)', async () => {
    const { callModel, calls } = scriptedModel([
      toolCallResponse('c1', UC_EXPORT_BATCH),
      toolCallResponse('c2', FUNC_PAIR_BATCH),
    ]);
    await runExecutor({
      registry,
      workspaceDir: repoRoot,
      config: config({ candidates: 2, backend: 'anthropic' }),
      callModel,
    });
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls[0].opts?.temperature).toBeUndefined();
    expect(calls[1].opts?.temperature).toBeUndefined();
  });

  it('Regression: candidates=1 (Default) fährt den heutigen Pfad — host-Protokoll, keine Best-of-N-Stats', async () => {
    const { callModel, calls } = scriptedModel([toolCallResponse('c1', UC_EXPORT_BATCH)]);
    const stats = await runExecutor({
      registry,
      workspaceDir: repoRoot,
      config: config(), // candidates default 1
      callModel,
    });
    // Host-Protokoll: der dryRun-Vergleichs-Auftrag steht WEITER im Prompt (MCP-Parität).
    const instruction = JSON.stringify(calls[0].messages[0]);
    expect(instruction).toContain('dryRun:true');
    expect(instruction).not.toContain('Treiber');
    // Ein Apply, keine Proben, keine Picks — heutiges Verhalten.
    expect(stats.mutatesApplied).toBe(1);
    expect(stats.dryRunProbes).toBe(0);
    expect(stats.candidatesSampled).toBe(0);
    expect(stats.algoPicks).toBe(0);
    expect(stats.modelPicks).toBe(0);
    expect(stats.judgeDisagreements).toBe(0);
    expect(uids()).toContain('UC-export');
  });
});
