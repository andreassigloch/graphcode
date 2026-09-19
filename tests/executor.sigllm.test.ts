/**
 * Abnahme zu CR-GC-552 — das dritte Backend `sigllm`.
 *
 * Gegenstand ist die Uebersetzung in beide Richtungen und das, was der Zweig ABLEHNT.
 * Der Werkzeugdialog gegen das echte Gateway ist die Validierung und steht im CR; hier
 * steht, was ohne laufende Anlage pruefbar ist.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildCallModel } from '../src/loop/executor-backend.js';
import { ExecutorConfigSchema } from '../src/loop/executor.js';
import { parseExecutorEnv } from '../src/surface/run-verb.js';

const basis = {
  backend: 'sigllm' as const,
  baseUrl: 'https://127.0.0.1:8080',
  model: 'reasoning',
  apiKey: 'geheim-token',
};

const config = (extra: Record<string, unknown> = {}) =>
  ExecutorConfigSchema.parse({ ...basis, ...extra });

/** Eine gueltige SCHEMA-inference-response, so wie das Gateway sie liefert. */
const antwort = (extra: Record<string, unknown> = {}) => ({
  requestId: '01JBZ0000000000000000000AA',
  state: 'done',
  provenance: {
    backend: 'ollama',
    endpoint: 'http://127.0.0.1:11434',
    model: 'qwen3.8-27b-lms',
    profile: 'reasoning',
    configFingerprint: 'a'.repeat(64),
  },
  content: 'Fertig.',
  reasoning: null,
  toolCalls: [],
  finishReason: 'stop',
  usage: { promptTokens: 120, completionTokens: 8 },
  ...extra,
});

function fetchStub(status: number, body: unknown) {
  const spy = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => vi.unstubAllGlobals());

describe('sigllm-Backend — was gesendet wird', () => {
  it('spricht /v1/inference und schickt Token und Profil, aber kein model', async () => {
    const spy = fetchStub(200, antwort());
    await buildCallModel(config())('SYSTEM', [{ role: 'user', content: 'Los' }], []);

    const [url, init] = spy.mock.calls[0] as [string, { body: string }];
    expect(url).toBe('https://127.0.0.1:8080/v1/inference');
    const gesendet = JSON.parse(init.body) as Record<string, unknown>;
    expect(gesendet.token).toBe('geheim-token');
    expect(gesendet.profile).toBe('reasoning');
    // Der Vertrag ist .strict() — diese vier wuerden die Anfrage abweisen.
    expect(gesendet).not.toHaveProperty('model');
    expect(gesendet).not.toHaveProperty('max_tokens');
    expect(gesendet).not.toHaveProperty('temperature');
    expect(gesendet).not.toHaveProperty('reasoning_effort');
  });

  it('erzeugt eine requestId in ULID-Form', async () => {
    const spy = fetchStub(200, antwort());
    await buildCallModel(config())('SYSTEM', [], []);
    const gesendet = JSON.parse((spy.mock.calls[0] as [string, { body: string }])[1].body);
    expect(gesendet.requestId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('stellt den System-Prompt als erste Nachricht voran', async () => {
    const spy = fetchStub(200, antwort());
    await buildCallModel(config())('DU BIST', [{ role: 'user', content: 'Los' }], []);
    const gesendet = JSON.parse((spy.mock.calls[0] as [string, { body: string }])[1].body);
    expect(gesendet.messages[0]).toEqual({ role: 'system', content: 'DU BIST' });
  });

  it('uebersetzt die Tool-Felder der Schleife nach camelCase', async () => {
    const spy = fetchStub(200, antwort());
    await buildCallModel(config())(
      'SYSTEM',
      [
        { role: 'user', content: 'Los' },
        {
          role: 'assistant',
          content: null,
          tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'graphcode_graph_context', arguments: '{"uid":"SYS-00"}' } }],
        },
        { role: 'tool', tool_call_id: 'call_1', content: '{"name":"SIG Local"}' },
      ],
      [],
    );
    const gesendet = JSON.parse((spy.mock.calls[0] as [string, { body: string }])[1].body);
    expect(gesendet.messages[2].toolCalls).toEqual([
      { id: 'call_1', name: 'graphcode_graph_context', arguments: '{"uid":"SYS-00"}' },
    ]);
    // content: null waere ein Vertragsfehler — der leere String ist es nicht.
    expect(gesendet.messages[2].content).toBe('');
    expect(gesendet.messages[2]).not.toHaveProperty('tool_calls');
    expect(gesendet.messages[3].toolCallId).toBe('call_1');
    expect(gesendet.messages[3]).not.toHaveProperty('tool_call_id');
  });

  it('laesst tools weg, wenn keine angeboten werden', async () => {
    const spy = fetchStub(200, antwort());
    await buildCallModel(config())('SYSTEM', [], []);
    const gesendet = JSON.parse((spy.mock.calls[0] as [string, { body: string }])[1].body);
    expect(gesendet).not.toHaveProperty('tools');
  });
});

describe('sigllm-Backend — was zurueckkommt', () => {
  it('normalisiert die Antwort auf SCHEMA-model-answer', async () => {
    fetchStub(200, antwort());
    const resp = await buildCallModel(config())('SYSTEM', [], []);
    expect(resp.text).toBe('Fertig.');
    expect(resp.stopReason).toBe('stop');
    expect(resp.usage).toEqual({ in: 120, out: 8, reasoning: 0 });
  });

  it('parst die Tool-Argumente und baut eine OpenAI-foermige assistantMsg fuer die naechste Runde', async () => {
    fetchStub(
      200,
      antwort({
        content: '',
        finishReason: 'tool_calls',
        toolCalls: [{ id: 'call_9', name: 'graphcode_graph_context', arguments: '{"uid":"SYS-00"}' }],
      }),
    );
    const resp = await buildCallModel(config())('SYSTEM', [], []);
    expect(resp.toolCalls).toEqual([
      { id: 'call_9', name: 'graphcode_graph_context', input: { uid: 'SYS-00' } },
    ]);
    // Die Schleife haengt diese Nachricht unveraendert an — sie muss die Schleifenform tragen.
    const msg = resp.assistantMsg as Record<string, unknown>;
    expect(msg.tool_calls).toEqual([
      { id: 'call_9', type: 'function', function: { name: 'graphcode_graph_context', arguments: '{"uid":"SYS-00"}' } },
    ]);
  });

  it('reicht den Grund einer Abweisung durch, nicht nur den Status', async () => {
    fetchStub(403, { reason: 'Der Zugang von graphcode umfasst das Profil reasoning nicht' });
    await expect(buildCallModel(config())('SYSTEM', [], [])).rejects.toThrow(
      /sigllm 403: Der Zugang von graphcode umfasst das Profil reasoning nicht/,
    );
  });

  it('meldet eine vertragswidrige Antwort als solche', async () => {
    fetchStub(200, { content: 'da', finishReason: 'stop' });
    await expect(buildCallModel(config())('SYSTEM', [], [])).rejects.toThrow(
      /breaks SCHEMA-inference-response/,
    );
  });
});

describe('sigllm-Backend — was abgelehnt wird', () => {
  it('verweigert den Start ohne Token', () => {
    expect(() => buildCallModel(config({ apiKey: undefined }))).toThrow(/GRAPHCODE_LLM_TOKEN/);
  });

  it('verweigert Best-of-N, statt still auf einen Kandidaten zu fallen', () => {
    expect(() => buildCallModel(config({ candidates: 3 }))).toThrow(/Best-of-N/);
  });

  it('nennt das fehlende Token schon beim Lesen der Env', () => {
    expect(() =>
      parseExecutorEnv({
        GRAPHCODE_LLM_BACKEND: 'sigllm',
        GRAPHCODE_LLM_BASE_URL: 'https://127.0.0.1:8080',
        GRAPHCODE_LLM_MODEL: 'reasoning',
      } as NodeJS.ProcessEnv),
    ).toThrow(/GRAPHCODE_LLM_TOKEN/);
  });

  it('haelt openai ohne Token weiterhin fuer gueltig — die Pflicht gilt nur fuer sigllm', () => {
    const cfg = parseExecutorEnv({
      GRAPHCODE_LLM_BASE_URL: 'http://127.0.0.1:11434/v1',
      GRAPHCODE_LLM_MODEL: 'qwen3.8-27b-lms',
    } as NodeJS.ProcessEnv);
    expect(cfg.backend).toBe('openai');
    expect(cfg.apiKey).toBeUndefined();
  });

  it('nimmt GRAPHCODE_LLM_TOKEN als Zugang entgegen', () => {
    const cfg = parseExecutorEnv({
      GRAPHCODE_LLM_BACKEND: 'sigllm',
      GRAPHCODE_LLM_BASE_URL: 'https://127.0.0.1:8080',
      GRAPHCODE_LLM_MODEL: 'fast',
      GRAPHCODE_LLM_TOKEN: 'geheim',
    } as NodeJS.ProcessEnv);
    expect(cfg.backend).toBe('sigllm');
    expect(cfg.apiKey).toBe('geheim');
    expect(cfg.model).toBe('fast');
  });
});
