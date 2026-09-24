/**
 * CR-GC-662 — die Anthropic-Antwort gestreamt lesen (dieselbe 300-s-Grenze wie CR-GC-656).
 * Echte Response-Objekte mit SSE-Koerper, in Stuecke zerschnitten, die Zeilengrenzen nicht achten.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { leseAnthropicAntwort } from '../src/loop/anthropic-stream.js';
import { buildCallModel } from '../src/loop/executor-backend.js';
import { ExecutorConfigSchema } from '../src/loop/executor.js';

function sse(ereignisse: Record<string, unknown>[], schnitt = 11): Response {
  const text = ereignisse.map((e) => `event: ${String(e.type)}\ndata: ${JSON.stringify(e)}\n\n`).join('');
  const bytes = new TextEncoder().encode(text);
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < bytes.length; i += schnitt) c.enqueue(bytes.slice(i, i + schnitt));
      c.close();
    },
  });
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
}

const START = { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', content: [], usage: { input_tokens: 120, output_tokens: 1 } } };

describe('leseAnthropicAntwort (CR-GC-662)', () => {
  it('Denken samt Signatur, Text und stueckweises Werkzeug-JSON zur Nicht-Streaming-Form', async () => {
    const raw = (await leseAnthropicAntwort(
      sse([
        START,
        { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'Erst ' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'pruefen.' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'sig-abc' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'Ich baue.' } },
        { type: 'content_block_stop', index: 1 },
        { type: 'content_block_start', index: 2, content_block: { type: 'tool_use', id: 'tu_1', name: 'graphcode_graph_mutate', input: {} } },
        { type: 'content_block_delta', index: 2, delta: { type: 'input_json_delta', partial_json: '{"formatE":"## Ed' } },
        { type: 'content_block_delta', index: 2, delta: { type: 'input_json_delta', partial_json: 'ges\\n+ A -verify-> B\\n"}' } },
        { type: 'content_block_stop', index: 2 },
        { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 57 } },
        { type: 'message_stop' },
      ]),
    )) as { content: Record<string, unknown>[]; stop_reason: string; usage: Record<string, number> };
    expect(raw.content).toEqual([
      { type: 'thinking', thinking: 'Erst pruefen.', signature: 'sig-abc' },
      { type: 'text', text: 'Ich baue.' },
      { type: 'tool_use', id: 'tu_1', name: 'graphcode_graph_mutate', input: { formatE: '## Edges\n+ A -verify-> B\n' } },
    ]);
    expect(raw.stop_reason).toBe('tool_use');
    expect(raw.usage).toMatchObject({ input_tokens: 120, output_tokens: 57 });
  });

  it('am Budget abgeschnittenes Werkzeug-JSON: input {} und stop_reason max_tokens — wie ungestreamt', async () => {
    const raw = (await leseAnthropicAntwort(
      sse([
        START,
        { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'tu_1', name: 'graphcode_graph_mutate', input: {} } },
        { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"formatE":"## No' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'max_tokens' }, usage: { output_tokens: 4096 } },
      ]),
    )) as { content: { input: unknown }[]; stop_reason: string };
    expect(raw.content[0].input).toEqual({});
    expect(raw.stop_reason).toBe('max_tokens');
  });

  it('ein error-Ereignis im Strom wird zum Fehler', async () => {
    await expect(leseAnthropicAntwort(sse([START, { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }]))).rejects.toThrow(/overloaded_error/);
  });

  it('eine JSON-Antwort (etwa ein Fehler vor dem Strom) wird am Stueck gelesen', async () => {
    const json = { type: 'error', error: { type: 'invalid_request_error', message: 'x' } };
    expect(await leseAnthropicAntwort(new Response(JSON.stringify(json), { headers: { 'content-type': 'application/json' } }))).toEqual(json);
  });
});

describe('der anthropic-Zweig fragt gestreamt an (CR-GC-662)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('stream:true im Request; Werkzeugaufruf, Stop-Grund und Zaehlung kommen an; Denken bleibt fuer das Echo', async () => {
    const gesendet: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: { body: string }) => {
      gesendet.push(JSON.parse(init.body));
      return sse([
        START,
        { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 's1' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'tu_1', name: 'graphcode_graph_mutate', input: {} } },
        { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"formatE":"x"}' } },
        { type: 'content_block_stop', index: 1 },
        { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 9 } },
      ]);
    }));
    const call = buildCallModel(ExecutorConfigSchema.parse({ backend: 'anthropic', baseUrl: 'http://x', model: 'claude-opus-5', apiKey: 'k' }));
    const res = await call('SYS', [{ role: 'user', content: 'los' }], []);
    expect(gesendet[0]).toMatchObject({ stream: true });
    expect(res.toolCalls[0]).toMatchObject({ id: 'tu_1', name: 'graphcode_graph_mutate', input: { formatE: 'x' } });
    expect(res.stopReason).toBe('tool_use');
    expect(res.usage).toMatchObject({ in: 120, out: 9 });
    const echo = res.assistantMsg as { content: { type: string; signature?: string }[] };
    expect(echo.content[0]).toMatchObject({ type: 'thinking', signature: 's1' });
  });
});
