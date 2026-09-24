/**
 * CR-GC-656 — die openai-Antwort gestreamt lesen.
 *
 * Nachgewiesen: Nodes fetch (undici) bricht nach 300 s ohne Antwortkopf ab (UND_ERR_HEADERS_TIMEOUT
 * nach 301,4 s trotz AbortSignal 600 s). Ohne Streaming kommt der Kopf erst mit der fertigen
 * Antwort — ein Thinking-Modell braucht laenger. Diese Datei prueft das Zusammensetzen der
 * SSE-Stuecke zur selben Drahtform, die der Server ungestreamt geschickt haette. Echte Response-
 * Objekte, kein Stub.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { leseOpenAiAntwort } from '../src/loop/openai-stream.js';
import { buildCallModel } from '../src/loop/executor-backend.js';
import { ExecutorConfigSchema } from '../src/loop/executor.js';

/** Eine SSE-Antwort, bewusst in Stuecke zerschnitten, die Zeilengrenzen nicht respektieren. */
function sse(stuecke: unknown[], schnitt = 7): Response {
  const text = stuecke.map((s) => `data: ${typeof s === 'string' ? s : JSON.stringify(s)}\n\n`).join('');
  const bytes = new TextEncoder().encode(text);
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < bytes.length; i += schnitt) c.enqueue(bytes.slice(i, i + schnitt));
      c.close();
    },
  });
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
}

const delta = (d: Record<string, unknown>, finish: string | null = null) => ({ choices: [{ index: 0, delta: d, finish_reason: finish }] });

describe('leseOpenAiAntwort (CR-GC-656)', () => {
  it('setzt Text, Denken und stueckweise Werkzeug-Argumente zur Drahtform zusammen', async () => {
    const raw = (await leseOpenAiAntwort(
      sse([
        delta({ role: 'assistant', reasoning: 'Ich pruefe ' }),
        delta({ reasoning: 'erst den Typ.' }),
        delta({ tool_calls: [{ index: 0, id: 'c1', type: 'function', function: { name: 'graph_elements', arguments: '{"ty' } }] }),
        delta({ tool_calls: [{ index: 0, function: { arguments: 'pe":"UC"}' } }] }),
        delta({ tool_calls: [{ index: 1, id: 'c2', function: { name: 'graph_get_node', arguments: '{"uid":"SYS-a"}' } }] }),
        delta({}, 'tool_calls'),
        { choices: [], usage: { prompt_tokens: 120, completion_tokens: 40 } },
        '[DONE]',
      ]),
    )) as { choices: { finish_reason: string; message: Record<string, unknown> }[]; usage: unknown };
    const m = raw.choices[0].message as { reasoning: string; tool_calls: { id: string; function: { name: string; arguments: string } }[] };
    expect(raw.choices[0].finish_reason).toBe('tool_calls');
    expect(m.reasoning).toBe('Ich pruefe erst den Typ.');
    expect(m.tool_calls.map((t) => [t.id, t.function.name, JSON.parse(t.function.arguments)])).toEqual([
      ['c1', 'graph_elements', { type: 'UC' }],
      ['c2', 'graph_get_node', { uid: 'SYS-a' }],
    ]);
    expect(raw.usage).toEqual({ prompt_tokens: 120, completion_tokens: 40 });
  });

  it('LM Studio nennt das Denken reasoning_content — dieselbe Stelle', async () => {
    const raw = (await leseOpenAiAntwort(sse([delta({ reasoning_content: 'hm' }), delta({ content: 'fertig' }, 'stop')]))) as {
      choices: { message: { content: string; reasoning: string } }[];
    };
    expect(raw.choices[0].message).toMatchObject({ content: 'fertig', reasoning: 'hm' });
  });

  it('ein Fehler-Stueck im Strom wird zum Fehler, nicht zu einer leeren Antwort', async () => {
    await expect(leseOpenAiAntwort(sse([delta({ content: 'a' }), { error: { message: 'model crashed' } }]))).rejects.toThrow(/model crashed/);
  });

  it('antwortet der Server am Stueck (stream ignoriert), wird JSON gelesen', async () => {
    const json = { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'x' } }] };
    const r = new Response(JSON.stringify(json), { headers: { 'content-type': 'application/json' } });
    expect(await leseOpenAiAntwort(r)).toEqual(json);
  });
});

describe('der openai-Zweig fragt gestreamt an und liest den Strom (CR-GC-656)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('stream:true mit include_usage im Request; Werkzeugaufruf und Zaehlung kommen an', async () => {
    const gesendet: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
      gesendet.push(JSON.parse(init.body));
      return sse([
        delta({ tool_calls: [{ index: 0, id: 'c1', function: { name: 'graphcode_graph_mutate', arguments: '{"formatE":"## Edges\\n+ A -verify-> B\\n"}' } }] }),
        delta({}, 'tool_calls'),
        { choices: [], usage: { prompt_tokens: 50, completion_tokens: 9 } },
        '[DONE]',
      ]);
    }));
    const call = buildCallModel(ExecutorConfigSchema.parse({ backend: 'openai', baseUrl: 'http://x', model: 'm' }));
    const res = await call('SYS', [{ role: 'user', content: 'los' }], []);
    expect(gesendet[0]).toMatchObject({ stream: true, stream_options: { include_usage: true } });
    expect(res.toolCalls[0]).toMatchObject({ name: 'graphcode_graph_mutate', input: { formatE: '## Edges\n+ A -verify-> B\n' } });
    expect(res.usage).toMatchObject({ in: 50, out: 9 });
    expect(res.stopReason).toBe('tool_calls');
  });
});
