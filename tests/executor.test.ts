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
  ExecutorConfigSchema,
  type ModelResponse,
  type CallModel,
} from '../src/loop/executor.js';
import { buildToolSpecs } from '../src/loop/executor-backend.js';
import { RULE_CLAUSE } from '../src/loop/generate.js';
import { INDEX_CHAR_BUDGET } from '../src/loop/executor-inventory.js';
import {
  buildRoundInjection,

  TOOL_RESULT_CHAR_BUDGET,
  jsonCapped,
  SYSTEM,
  GUIDE_HINT,
  AUTHORING_PARAMS,
} from '../src/loop/executor-prompt.js';
import { extractMutateFromText, extractToolCallFromText } from '../src/loop/executor-parse.js';
import { ElementType } from '@sigloch/contracts/se';

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
    stopReason: 'tool_use',
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
      stopReason: 'end_turn',
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
      stopReason: 'end_turn',
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

  it('buildToolSpecs: valid object schemas for every tool, generate/suggest withheld', () => {
    const specs = buildToolSpecs(registry);
    const names = specs.map((s) => s.name);
    expect(names).not.toContain('graphcode_graph_generate');
    expect(names).not.toContain('graphcode_graph_suggest');
    expect(names).toContain('graphcode_graph_mutate');
    expect(names).toContain('read_file');
    for (const spec of specs) {
      expect(spec.schema.type).toBe('object');
      expect(typeof spec.schema.properties).toBe('object');
    }
  });

  it('SYSTEM prompt names every ElementType.options value — Contracts-Drift-Schutz gegen STRUCT-Halluzination (CR-GC-291)', () => {
    for (const type of ElementType.options) {
      expect(SYSTEM).toContain(type);
    }
    expect(SYSTEM).toContain(`NUR diese ${ElementType.options.length}`);
  });

  it('CR-GC-653: kein Kanal verlangt die Duplikat-Vorab-Suche — Ausloeser entfernt, kein Verbot ergaenzt', async () => {
    // Die Verbotssaetze waren gemessen wirkungslos und sind wieder draussen (gcrun-50..52).
    expect(SYSTEM).not.toContain('nicht vorab per Stichwort suchen');
    await registry['graph_mutate'].handler(VALID_SEED_BATCH);
    const out = await buildRoundInjection(registry, { focusTypes: ['UC'], skill: 'se:author-uc' });
    expect(out, 'die Liste widerspraeche sonst dem SYSTEM').not.toContain('keine Duplikate anlegen');
  });

  it('CR-GC-654: SYSTEM zeigt einen reinen Kanten-Batch, und das Gate nimmt genau diese Form an', async () => {
    const block = SYSTEM.slice(SYSTEM.indexOf('Kanten zwischen BESTEHENDEN Knoten'));
    const beispiel = block.slice(block.indexOf('## Edges'), block.indexOf('\n\n', block.indexOf('## Edges')) + 1);
    expect(beispiel).toMatch(/^## Edges\n\+ \S+ -satisfy-> \S+\n$/);
    // Die Form ist nicht nur behauptet: zwischen bestehenden Knoten geht sie ohne Knotenzeile durchs Gate.
    await registry['graph_mutate'].handler(VALID_SEED_BATCH);
    const res = (await registry['graph_mutate'].handler({
      formatE: '## Nodes\n### REQ\n+ REQ-a|Das System muss X. [__name:A]\n### TEST\n+ TEST-a|Prueft X. [__name:TA]\n\n## Edges\n+ TEST-a -verify-> REQ-a\n',
      consumerId: 'test',
    })) as { success: boolean };
    expect(res.success).toBe(true);
    const nurKante = (await registry['graph_mutate'].handler({
      formatE: '## Edges\n+ UC-login -compose-> REQ-a\n',
      consumerId: 'test',
    })) as { success: boolean };
    expect(nurKante.success).toBe(true);
  });

  it('CR-GC-657: das GANZE SYSTEM-Beispiel ist legal — Knoten-Batch und reiner Kanten-Batch gehen durchs Gate', async () => {
    await registry['graph_mutate'].handler(VALID_SEED_BATCH);
    // Der Erfueller aus dem Kanten-Beispiel muss existieren (FCHAIN des UC, darin die FUNC).
    const vorbau = (await registry['graph_mutate'].handler({
      formatE:
        '## Nodes\n### FCHAIN\n+ FCHAIN-login|Anmeldeablauf [__name:Anmeldeablauf]\n### FUNC\n' +
        '+ FUNC-login-pruefen|Prueft das Passwort. [__name:Passwort pruefen]\n\n## Edges\n' +
        '+ UC-login -compose-> FCHAIN-login\n+ FCHAIN-login -compose-> FUNC-login-pruefen\n',
      consumerId: 'test',
    })) as { success: boolean };
    expect(vorbau.success).toBe(true);
    const ab = SYSTEM.indexOf('\n## Nodes\n') + 1; // die Ueberschriftszeile, nicht die Erwaehnung im Satz davor
    const knotenBatch = SYSTEM.slice(ab, SYSTEM.indexOf('\n\nJede REQ traegt', ab)) + '\n';
    expect(knotenBatch).toContain('@kinds ["functional"]');
    const a = (await registry['graph_mutate'].handler({ formatE: knotenBatch, consumerId: 'test' })) as { success: boolean; violations?: unknown };
    expect(a.success, JSON.stringify(a.violations)).toBe(true);
    const kante = SYSTEM.slice(SYSTEM.indexOf('## Edges', SYSTEM.indexOf('Kanten zwischen BESTEHENDEN')));
    const kantenBatch = kante.slice(0, kante.indexOf('\n\n')) + '\n';
    const b = (await registry['graph_mutate'].handler({ formatE: kantenBatch, consumerId: 'test' })) as { success: boolean; violations?: unknown };
    expect(b.success, JSON.stringify(b.violations)).toBe(true);
  });

  it('CR-GC-657: der kinds-Patch aus der RD-01-Klausel macht eine REQ ohne kinds fuer FUNC erfuellbar', async () => {
    await registry['graph_mutate'].handler(VALID_SEED_BATCH);
    await registry['graph_mutate'].handler({
      formatE:
        '## Nodes\n### FCHAIN\n+ FCHAIN-login|Ablauf [__name:Ablauf]\n### FUNC\n+ FUNC-p|Prueft. [__name:Pruefen]\n' +
        '### REQ\n+ REQ-ohne|Das System muss anmelden. [__name:Anmelden]\n### TEST\n+ TEST-ohne|Prueft Anmelden. [__name:T]\n\n' +
        '## Edges\n+ UC-login -compose-> FCHAIN-login, REQ-ohne\n+ FCHAIN-login -compose-> FUNC-p\n+ TEST-ohne -verify-> REQ-ohne\n',
      consumerId: 'test',
    });
    const ohne = (await registry['graph_mutate'].handler({ formatE: '## Edges\n+ FUNC-p -satisfy-> REQ-ohne\n', consumerId: 'test' })) as { success: boolean };
    expect(ohne.success, 'ohne kinds ist FUNC satisfy REQ illegal (R-18)').toBe(false);
    const mit = (await registry['graph_mutate'].handler({
      formatE: '## Nodes\n### REQ\n~ REQ-ohne|Das System muss anmelden.\n@kinds ["functional"]\n\n## Edges\n+ FUNC-p -satisfy-> REQ-ohne\n',
      consumerId: 'test',
    })) as { success: boolean; violations?: unknown };
    expect(mit.success, JSON.stringify(mit.violations)).toBe(true);
  });

  it('CR-GC-661: das Vorbild der UC-01-Klausel (zwei UCs, je zwei REQs) geht so durchs Gate', async () => {
    const vorbau = (await registry['graph_mutate'].handler({
      formatE:
        '## Nodes\n### SYS\n+ SYS-app|Eine App. [__name:App]\n### UC\n+ UC-login|Nutzer meldet sich an. [__name:Login]\n' +
        '+ UC-export|Nutzer exportiert den Stand. [__name:Export]\n\n## Edges\n+ SYS-app -compose-> UC-login, UC-export\n',
      consumerId: 'test',
    })) as { success: boolean; violations?: unknown };
    expect(vorbau.success, JSON.stringify(vorbau.violations)).toBe(true);
    const text = RULE_CLAUSE['UC-01'].text(['UC-login', 'UC-export']);
    expect(text).toContain('Bediene ALLE 2 UCs in EINEM Batch');
    const vorbild = text.slice(text.indexOf('## Nodes')) + '\n';
    const res = (await registry['graph_mutate'].handler({ formatE: vorbild, consumerId: 'test' })) as { success: boolean; violations?: unknown };
    expect(res.success, JSON.stringify(res.violations)).toBe(true);
    const req = harness.getGraph().nodes.filter((n) => n.type === 'REQ');
    expect(req).toHaveLength(4);
  });

  it('CR-GC-658: das Vorbild der UC-02-Klausel geht so durchs Gate und loest den Fund auf', async () => {
    const vorbau = (await registry['graph_mutate'].handler({
      formatE:
        '## Nodes\n### SYS\n+ SYS-app|Eine App. [__name:App]\n### ACTOR\n+ ACTOR-nutzer|Nutzt die App. [__name:Nutzer]\n' +
        '### UC\n+ UC-sitzung|Nutzer fragt und erhaelt eine Antwort. [__name:Sitzung]\n### FCHAIN\n+ FCHAIN-sitzung|Ablauf [__name:Ablauf]\n\n' +
        '## Edges\n+ SYS-app -compose-> UC-sitzung\n+ UC-sitzung -compose-> FCHAIN-sitzung\n',
      consumerId: 'test',
    })) as { success: boolean; violations?: unknown };
    expect(vorbau.success, JSON.stringify(vorbau.violations)).toBe(true);
    // rules_get_violations hat keinen Regel-Filter — die UC-02-Befunde am UC selbst herausziehen.
    const uc02 = async (): Promise<string> => {
      const r = (await registry['rules_get_violations'].handler(registry['rules_get_violations'].inputSchema.parse({}))) as {
        violations: { ruleId: string }[];
      };
      return JSON.stringify(r.violations.filter((v) => v.ruleId === 'UC-02'));
    };
    expect(await uc02()).toContain('UC-sitzung');

    const text = RULE_CLAUSE['UC-02'].text(['UC-sitzung']);
    const vorbild = text.slice(text.indexOf('## Nodes')) + '\n';
    const res = (await registry['graph_mutate'].handler({ formatE: vorbild, consumerId: 'test' })) as { success: boolean; violations?: unknown };
    expect(res.success, JSON.stringify(res.violations)).toBe(true);
    expect(await uc02(), 'der Pfad ACTOR→FLOW→FUNC∈FCHAIN des UC loest UC-02').not.toContain('UC-sitzung');
  });

  it("toolset 'authoring' curates the minimal generative set (base-load lever)", () => {
    const names = buildToolSpecs(registry, 'authoring').map((s) => s.name);
    expect(names).toContain('graphcode_graph_mutate');
    expect(names).toContain('graphcode_graph_authoring_guide');
    expect(names).toContain('read_file');
    expect(names).not.toContain('graphcode_graph_export');
    expect(names.length).toBeLessThanOrEqual(8);
  });

  it('CR-GC-651: authoring bietet je Werkzeug nur die Parameter, die der Executor braucht', () => {
    const specs = buildToolSpecs(registry, 'authoring');
    const byName = Object.fromEntries(specs.map((s) => [s.name, s]));
    // graph_readiness beantwortet „was als Naechstes" — das entscheidet hier der Treiber.
    expect(byName['graphcode_graph_readiness']).toBeUndefined();
    // Genau die Tabelle, nicht mehr — die Schluessel SIND das Werkzeugset.
    expect(specs.filter((s) => s.name.startsWith('graphcode_')).map((s) => s.name.slice(10)).sort()).toEqual(
      Object.keys(AUTHORING_PARAMS).sort(),
    );
    const mutate = byName['graphcode_graph_mutate'].schema as { properties: Record<string, { description?: string }>; required?: string[] };
    expect(Object.keys(mutate.properties)).toEqual(['formatE']);
    expect(mutate.required, 'mit nur einem Feld waere ein leerer Aufruf sonst gueltig').toEqual(['formatE']);
    expect(mutate.properties.formatE.description, 'die Form steht einmal im SYSTEM').toBeUndefined();
    // Beschreibung = erster Satz; die Empfehlung „Prefer formatE over commands" ist damit weg.
    expect(byName['graphcode_graph_mutate'].description).toBe('The ONE write path: apply a batch through the Apply-Gate.');
    const katalog = JSON.stringify(specs).length;
    expect(katalog, 'vorher 7.835 Zeichen am eigenen Modell').toBeLessThan(2500);
  });

  it("toolset 'full' bleibt ungeschnitten — das Mess-Set vergleicht gegen den vollen Katalog", () => {
    const mutate = buildToolSpecs(registry, 'full').find((s) => s.name === 'graphcode_graph_mutate')!;
    expect(Object.keys((mutate.schema as { properties: object }).properties)).toContain('commands');
  });

  it('CR-GC-652: ein Lese-Aufruf steht MIT Argumenten, Antwortgroesse und Art in der Trace', async () => {
    const lesen: ModelResponse = {
      text: '',
      toolCalls: [
        { id: 'r1', name: 'graphcode_graph_elements', input: { type: 'UC' } },
        { id: 'r2', name: 'graphcode_graph_help', input: { id: 'x' } },
      ],
      stopReason: 'tool_use',
      assistantMsg: { role: 'assistant', content: null, tool_calls: [] },
      usage,
    };
    const { callModel } = scriptedModel([lesen, toolCallResponse('c2', VALID_SEED_BATCH)]);
    const traces: string[] = [];
    await runExecutor({
      registry,
      workspaceDir: repoRoot,
      intent: 'Eine Test-App fuer die Lese-Trace.',
      config: CONFIG,
      callModel,
      trace: (l) => traces.push(l),
    });
    const zeile = traces.find((l) => l.includes('read graph_elements'));
    expect(zeile, traces.join('\n')).toMatch(/read graph_elements \{"type":"UC"\} → \d+ Z\.$/);
    // Der Fehlgriff (unbekannter Parameter, CR-GC-647) ist in der Trace als solcher erkennbar.
    expect(traces.find((l) => l.includes('read graph_help'))).toMatch(/ERROR$/);
  });

  it('[ARGS] text tool-call is executed and its result carries the turn (CR-GC-280)', async () => {
    const textCall: ModelResponse = {
      text: 'Ich prüfe zunächst: graphcode_graph_readiness[ARGS]{}',
      toolCalls: [],
      stopReason: 'end_turn',
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
      stopReason: 'end_turn',
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
      stopReason: 'tool_use',
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
      stopReason: 'end_turn',
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

  it("candidates=1: der generate-Call traegt selection:'driver' — kein dryRun-Auftrag in einem Turn, der ihn nicht ausfuehren darf (CR-GC-568)", async () => {
    const genInputs: Record<string, unknown>[] = [];
    const origGenerate = registry['graph_generate'];
    registry['graph_generate'] = {
      ...origGenerate,
      handler: (input: unknown) => {
        genInputs.push((input ?? {}) as Record<string, unknown>);
        return origGenerate.handler(input);
      },
    };
    const { callModel, calls } = scriptedModel([toolCallResponse('c1', VALID_SEED_BATCH)]);
    await runExecutor({ registry, workspaceDir: repoRoot, config: CONFIG, callModel });
    registry['graph_generate'] = origGenerate;

    // Der Default des Schemas ist 'host' — der Executor darf ihn nie greifen lassen:
    // sein SYSTEM-Prompt verbietet genau die Analyse-Turns, die 'host' verlangt.
    expect(CONFIG.candidates).toBe(1);
    expect(genInputs.length).toBeGreaterThan(0);
    for (const input of genInputs) expect(input.selection).toBe('driver');
    // Und die Wirkung dort, wo sie zaehlt: im Turn, den das Modell sieht.
    expect(JSON.stringify(calls[0].messages)).not.toContain('dryRun');
  });

  it('round prompt injection (seed): guide slice of the seed focus types, no index on an empty graph (CR-GC-285)', async () => {
    const { callModel, calls } = scriptedModel([toolCallResponse('c1', VALID_SEED_BATCH)]);
    await runExecutor({
      registry,
      workspaceDir: repoRoot,
      intent: 'Eine Test-App für die Runden-Prompt-Injektion.',
      config: CONFIG,
      callModel,
    });
    const instruction = JSON.stringify(calls[0].messages[0]);
    // Guide-Slice der Stufe steht IM Prompt — inkl. der legalen Kanten.
    expect(instruction).toContain('Kanten-Grammatik');
    // CR-GC-559: Stufe 1 ist die SYS-Wurzel allein. ACTOR und UC sind eigene Stufen und
    // bringen ihre Grammatik dann mit — vorher standen alle drei in einer Runde, und
    // genau diese Vermischung hat das Modell zu ACTOR-Kanten verleitet, die es noch
    // nicht legal ziehen kann (vier R-18-Ablehnungen im Rig-Lauf).
    expect(instruction).toContain('- SYS:');
    for (const t of ['- ACTOR:', '- UC:']) expect(instruction).not.toContain(t);
    // Leerer Graph ⇒ kein Element-Index-Block.
    expect(instruction).not.toContain('Element-Index');
    // Die generate-Instruktion selbst bleibt ungekürzt (CR-282-Lektion).
    expect(instruction).toContain('Gate-Protokoll');
    // GENAU EIN Schreiber pro Tatsache (CR-GC-358): dass der Guide schon vorliegt,
    // sagt der Injektions-Block — der es als einziger WEISS, weil er ihn erzeugt hat.
    // CR-GC-651: und niemand sonst sagt das Gegenteil — der Auftrag nennt den Guide nicht mehr.
    expect(instruction).toContain('bereits eingebettet — graph_authoring_guide dafür nicht aufrufen');
    expect(instruction).not.toContain(GUIDE_HINT);
    expect(instruction.match(/graph_authoring_guide/g) ?? []).toHaveLength(1);
    // Der System-Prompt (Konstante) darf es NICHT behaupten: bei injection=false liefe
    // die Injektion nicht, die Behauptung wäre falsch und widerspräche dem Protokoll.
    expect(calls[0].system).not.toContain('BEREITS in der Instruktion');
  });

  it('round prompt injection (expand): element index with uid · type · name rides in the prompt (CR-GC-285)', async () => {
    await registry['graph_mutate'].handler(VALID_SEED_BATCH);
    const { callModel, calls } = scriptedModel([
      toolCallResponse('c1', {
        commands: [
          {
            op: 'add-node',
            node: {
              uid: 'FCHAIN-login',
              type: 'FCHAIN',
              name: 'Login-Ablauf',
              description: 'Ablauf des Logins.',
              attributes: {},
            },
          },
          { op: 'add-edge', edge: { sourceId: 'UC-login', targetId: 'FCHAIN-login', edgeType: 'compose', attributes: {} } },
        ],
      }),
    ]);
    await runExecutor({ registry, workspaceDir: repoRoot, config: CONFIG, callModel });
    const instruction = JSON.stringify(calls[0].messages[0]);
    expect(instruction).toContain('Kanten-Grammatik');
    // CR-GC-652: mit Fund kommt die Liste aus seinem Kontext, nicht aus dem Typfilter.
    expect(instruction).toContain('Element-Liste aus dem Kontext des Funds');
    expect(instruction).not.toContain('Element-Index');
    expect(instruction).toContain('UC-login · UC · Login');
    // CR-GC-539: was NICHT Fokus-Typ ist, steht nicht im Index. Vorher lief der Aufruf roh
    // am `inputSchema` vorbei und lieferte den ganzen Graphen — auf dem echten Modell 757
    // Knoten je Runde, das Gegenteil einer need-to-know-Whitebox. Der Typ selbst bleibt
    // sichtbar: die Kanten-Grammatik darüber nennt „SYS compose→".
    expect(instruction).not.toContain('SYS-app · SYS · Test App');
    // CR-GC-566: der Fokus kommt hier aus der UC-01-KLAUSEL (UC/REQ/TEST), nicht aus der
    // uc-Dimension — ACTOR steht deshalb weder in der Grammatik noch in der Liste.
    expect(instruction).not.toContain('ACTOR-user · ACTOR · User');
    // Der Fund ist selbst Besitzer — er hat einen, also kein Waisen-Hinweis.
    expect(instruction).not.toContain('Kein Besitzer im Modell');
  });

  it('CR-GC-652: Fund am SYS bekommt den Modulbaum, eine Waise den ausdruecklichen Hinweis — keine Ersatzliste', async () => {
    await registry['graph_mutate'].handler(VALID_SEED_BATCH);
    const res = (await registry['graph_mutate'].handler({
      formatE:
        '## Nodes\n### MOD\n+ MOD-kern|Kernmodul [__name:Kern]\n### REQ\n' +
        '+ REQ-sys-latenz|Das System muss in unter 2 s antworten. [__name:Latenz]\n' +
        '+ REQ-waise|Das System muss protokollieren. [__name:Protokoll]\n### TEST\n' +
        '+ TEST-sys-latenz|Lastlauf misst p95, Grenze 2 s. [__name:Latenzmessung]\n' +
        '+ TEST-waise|Prueft das Protokoll. [__name:Protokollpruefung]\n\n' +
        '## Edges\n+ SYS-app -compose-> MOD-kern, REQ-sys-latenz\n' +
        '+ TEST-sys-latenz -verify-> REQ-sys-latenz\n+ TEST-waise -verify-> REQ-waise\n',
      consumerId: 'test',
    })) as { success: boolean };
    expect(res.success).toBe(true);
    const out = await buildRoundInjection(registry, {
      focusTypes: ['REQ', 'FUNC', 'FCHAIN', 'MOD', 'SYS'],
      skill: 'se:author-req',
      focusElements: ['REQ-sys-latenz', 'REQ-waise'],
    });
    const liste = out.slice(out.indexOf('Element-Liste aus dem Kontext des Funds'));
    expect(liste).toContain('MOD-kern · MOD · Kern');
    expect(liste).toContain('SYS-app · SYS');
    // Kein Hub-Fan-out: der UC des Systems ist kein Erfueller-Kandidat und steht nicht drin.
    expect(liste).not.toContain('UC-login');
    expect(liste).toContain('Kein Besitzer im Modell für: REQ-waise');
  });

  it('injection:false (CR-GC-293 Mess-Schalter) suppresses the guide/index injection block entirely', async () => {
    await registry['graph_mutate'].handler(VALID_SEED_BATCH);
    const { callModel, calls } = scriptedModel([
      toolCallResponse('c1', {
        commands: [
          {
            op: 'add-node',
            node: {
              uid: 'FCHAIN-login',
              type: 'FCHAIN',
              name: 'Login-Ablauf',
              description: 'Ablauf des Logins.',
              attributes: {},
            },
          },
          { op: 'add-edge', edge: { sourceId: 'UC-login', targetId: 'FCHAIN-login', edgeType: 'compose', attributes: {} } },
        ],
      }),
    ]);
    const config = ExecutorConfigSchema.parse({ ...CONFIG, injection: false });
    await runExecutor({ registry, workspaceDir: repoRoot, config, callModel });
    const instruction = JSON.stringify(calls[0].messages[0]);
    expect(instruction).not.toContain('Kanten-Grammatik');
    expect(instruction).not.toContain('Element-Index');
    // Die generate-Instruktion selbst bleibt unverändert (nur die Injektion entfällt).
    expect(instruction).toContain('Gate-Protokoll');
    // CR-GC-651: ohne eingebettete Grammatik sagt der TREIBER, dass der Guide zu holen ist.
    expect(instruction).toContain(GUIDE_HINT);
  });

  it('index budget: an oversized index is deterministically filtered to the focus types (CR-GC-285)', async () => {
    await registry['graph_mutate'].handler(VALID_SEED_BATCH);
    // Bulk-UCs, bis der ungefilterte Index das Budget sicher reißt …
    const bulk: unknown[] = [];
    for (let i = 0; i < 300; i++) {
      const uid = `UC-bulk-${String(i).padStart(3, '0')}`;
      bulk.push({
        op: 'add-node',
        node: {
          uid,
          type: 'UC',
          name: `Bulk Use Case Nummer ${i}`,
          description: 'User erledigt die Massenaufgabe und erhält das Ergebnis.',
          attributes: {},
        },
      });
      bulk.push({ op: 'add-edge', edge: { sourceId: 'SYS-app', targetId: uid, edgeType: 'compose', attributes: {} } });
      
    }
    // … plus wenige Fokus-relevante Elemente (REQ mit TEST im selben Batch).
    bulk.push({
      op: 'add-node',
      node: { uid: 'REQ-kern', type: 'REQ', name: 'Kernanforderung', description: 'Login wird bestätigt.', attributes: {} },
    });
    bulk.push({
      op: 'add-node',
      node: { uid: 'TEST-kern', type: 'TEST', name: 'Kerntest', description: 'Prüft die Login-Bestätigung.', attributes: {} },
    });
    bulk.push({ op: 'add-edge', edge: { sourceId: 'UC-login', targetId: 'REQ-kern', edgeType: 'compose', attributes: {} } });
    bulk.push({ op: 'add-edge', edge: { sourceId: 'TEST-kern', targetId: 'REQ-kern', edgeType: 'verify', attributes: {} } });
    const res = (await registry['graph_mutate'].handler({ commands: bulk })) as { success: boolean };
    expect(res.success).toBe(true);

    // CR-GC-559: die ACTOR-Grammatik kommt jetzt in der Stufe `seed:actor` — contracts 9.x
    // fuehrt die Anbindung ueber FLOW (ACTOR io→FLOW), nicht mehr io→UC. Vorher hing diese
    // Zusicherung an der Seed-Runde, die es so nicht mehr gibt.
    const actorStufe = await buildRoundInjection(registry, {
      focusTypes: ['ACTOR', 'UC'],
      skill: 'se:author-actor',
    });
    expect(actorStufe).toContain('- ACTOR:');
    expect(actorStufe).toContain('io→FLOW');

    const injection = await buildRoundInjection(registry, { focusTypes: ['TEST', 'REQ'], skill: null });
    // CR-GC-539: auf die Fokus-Typen beschränkt — ab Runde 1, nicht erst bei Zeichenüberlauf.
    expect(injection).toContain('beschraenkt');
    expect(injection).toContain('REQ-kern · REQ · Kernanforderung');
    expect(injection).toContain('TEST-kern · TEST · Kerntest');
    expect(injection).not.toContain('UC-bulk-007');
    // … und der Index-Block bleibt unter dem Budget (+ Header/Guide-Overhead).
    expect(injection.length).toBeLessThan(INDEX_CHAR_BUDGET + 2000);
    // Deterministisch: gleicher Graph + gleiche Fokus-Typen ⇒ gleiche Injektion.
    expect(await buildRoundInjection(registry, { focusTypes: ['TEST', 'REQ'], skill: null })).toBe(injection);

    // CR-GC-622: der Rundenprompt entsteht JEDE Runde neu und holt die Kanten-Grammatik dabei
    // erneut aus `graph_authoring_guide` — dessen zweiter Aufruf je Typ ist seither gekuerzt.
    // Gekuerzt heisst NICHT leer: `outgoing`/`incoming`/`requiredAttrs` bleiben vollstaendig,
    // sonst waere ab Runde 2 genau der Block leer, dessen Vorhandensein dieser Prompt zusichert.
    const runde3 = await buildRoundInjection(registry, { focusTypes: ['TEST', 'REQ'], skill: null });
    expect(runde3).toContain('- REQ: ausgehend:');
    expect(runde3).toContain('- TEST: ausgehend:');
    expect(runde3).toBe(injection);

    // -----------------------------------------------------------------------
    // CR-GC-539 — DIE ZAHL. Derselbe 300+-Knoten-Graph, jetzt gemessen statt beschrieben.
    //
    // Der Befund: `registry['graph_elements'].handler({})` lief ROH, also am
    // `inputSchema.parse` vorbei, das der MCP-Server sonst davorschaltet. Damit war
    // `input.limit` undefined, `nodes.slice(0, undefined)` gab den GANZEN Graphen heraus,
    // und gebremst hat das nur der 8000-Zeichen-Deckel. Auf dem graphcode-Modell: 757
    // Knoten JE RUNDE in den Prompt — das Gegenteil der need-to-know-Whitebox.
    // -----------------------------------------------------------------------
    const zeilenDesIndex = (text: string): string[] => {
      const block = text.split('Element-Index des Graphen')[1] ?? '';
      // Nur echte Index-Zeilen `uid · TYPE · name`; die Kopfzeile traegt selbst ein
      // „(uid · type · name; …)" und zaehlte sonst mit.
      return block.split('\n').filter((l) => /^\S+ · [A-Z]+ · /.test(l));
    };
    const deklariertesLimit = (registry['graph_elements'].inputSchema.parse({}) as { limit: number }).limit;

    // (1) OHNE Fokus: hoechstens der deklarierte Default — nicht alle 300+.
    const ohneFokus = await buildRoundInjection(registry, { focusTypes: [], skill: null });
    const ohneZeilen = zeilenDesIndex(ohneFokus);
    expect(ohneZeilen.length).toBeGreaterThan(0);
    expect(ohneZeilen.length, 'der Zod-Default limit wird umgangen').toBeLessThanOrEqual(deklariertesLimit);

    // (2) MIT Fokus: der Filter wirkt ab Runde 1, nicht erst am Zeichendeckel — und der
    //     Index bleibt ebenfalls unter dem deklarierten Default.
    const mitZeilen = zeilenDesIndex(injection);
    expect(mitZeilen.length).toBeLessThanOrEqual(deklariertesLimit);
    for (const zeile of mitZeilen) {
      expect(zeile, `Fremdtyp im Fokus-Index: ${zeile}`).toMatch(/ · (TEST|REQ) · /);
    }

    // (3) Kein Typ hungert aus: beide Fokus-Typen sind vertreten, obwohl REQ und TEST
    //     alphabetisch weit auseinanderliegen.
    expect(mitZeilen.some((z) => z.includes(' · REQ · '))).toBe(true);
    expect(mitZeilen.some((z) => z.includes(' · TEST · '))).toBe(true);
  }, 60_000);

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

// ---------------------------------------------------------------------------
// CR-GC-650 — der Executor emittiert Format-E; ein Modell ohne Tool-Call schreibt den Block als Text.
describe('extractMutateFromText: Format-E (CR-GC-650)', () => {
  const block = '## Nodes\n### UC\n+ UC-a|Ein Nutzer tut etwas. [__name:A]\n\n## Edges\n+ SYS-s -compose-> UC-a\n';

  it('roher Block im Fliesstext', () => {
    expect(extractMutateFromText('Hier der Batch:\n\n' + block)).toEqual({ formatE: block });
  });

  it('Block im Code-Zaun — der Zaun gehoert nicht dazu', () => {
    expect(extractMutateFromText('```\n' + block + '```\nFertig.')).toEqual({ formatE: block });
  });

  it('JSON mit formatE-Feld', () => {
    expect(extractMutateFromText(JSON.stringify({ formatE: block }))).toEqual({ formatE: block });
  });

  it('eine Ueberschrift ohne Operationszeile ist kein Batch', () => {
    expect(extractMutateFromText('## Nodes\nnoch nichts')).toBeNull();
  });

  it('commands-JSON wird weiter geborgen — das Gate nimmt beide Formen', () => {
    expect(extractMutateFromText('{"commands":[{"op":"add-node"}]}')).toEqual({ commands: [{ op: 'add-node' }] });
  });
});

// CR-GC-309 — a truncated tool result must still be parseable JSON.
//
// Both truncation sites were `JSON.stringify(x).slice(0, 6000)`. A byte slice cuts
// mid-object: on a 70 KB answer the local model received an unparseable blob — so
// not just a shortened violation, but NO violation it could act on. The summary
// default makes the overflow rare; rare is not never, and "valid but terse" is the
// only useful behaviour when it happens.
// ---------------------------------------------------------------------------
describe('jsonCapped (CR-GC-309): truncation yields valid JSON, never a cut blob', () => {
  it('returns the value unchanged when it fits', () => {
    const small = { success: true, mutations: 3 };
    expect(jsonCapped(small)).toBe(JSON.stringify(small));
  });

  it('an oversized result is still parseable', () => {
    const huge = {
      success: false,
      tier: 'block',
      mutations: 0,
      violations: Array.from({ length: 400 }, (_, i) => ({
        ruleId: 'R-01',
        message: `finding ${i} `.repeat(20),
        context: { candidate_targets: Array.from({ length: 40 }, (_, j) => ({ id: `TEST-${j}` })) },
      })),
    };
    const out = jsonCapped(huge);
    expect(JSON.stringify(huge).length).toBeGreaterThan(TOOL_RESULT_CHAR_BUDGET);
    expect(out.length).toBeLessThanOrEqual(TOOL_RESULT_CHAR_BUDGET);
    // The whole point: it parses.
    expect(() => JSON.parse(out)).not.toThrow();
  });

  it('keeps the scalars the driver branches on, and says it truncated', () => {
    const huge = {
      success: false,
      tier: 'block',
      mutations: 0,
      appliedCommands: 0,
      violations: Array.from({ length: 400 }, () => ({ ruleId: 'R-01', message: 'x'.repeat(60) })),
    };
    const parsed = JSON.parse(jsonCapped(huge)) as Record<string, unknown>;
    // success/tier decide the driver's next move — losing them would make the
    // truncation worse than the overflow.
    expect(parsed.success).toBe(false);
    expect(parsed.tier).toBe('block');
    expect(parsed.mutations).toBe(0);
    expect(parsed.truncated).toBe(true);
    expect(parsed.originalChars).toBeGreaterThan(TOOL_RESULT_CHAR_BUDGET);
  });

  it('CR-GC-647: a list is capped to its head, not dropped — the head is an answer, its absence is not', () => {
    const liste = { total: 500, nodes: Array.from({ length: 500 }, (_, i) => ({ uid: `REQ-${i}`, type: 'REQ', name: 'n'.repeat(40) })) };
    const out = jsonCapped(liste);
    expect(out.length).toBeLessThanOrEqual(TOOL_RESULT_CHAR_BUDGET);
    const parsed = JSON.parse(out) as { nodes: { uid: string }[]; gekappt: Record<string, string>; total: number };
    expect(parsed.nodes.length).toBeGreaterThan(50);
    expect(parsed.nodes[0].uid).toBe('REQ-0');
    expect(parsed.gekappt.nodes).toBe(`${parsed.nodes.length}/500`);
    expect(parsed.total).toBe(500);
  });

  it('handles a non-object payload without throwing', () => {
    expect(() => JSON.parse(jsonCapped('x'.repeat(20_000)))).not.toThrow();
    expect(JSON.parse(jsonCapped(undefined))).toBeNull();
  });
});
