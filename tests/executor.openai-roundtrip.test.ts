/**
 * Abnahme zu CR-GC-554 (ITEM-2026-363) — die Assistenten-Nachricht des openai-Zweigs
 * muss den Umlauf ueberleben.
 *
 * Gefunden beim ersten Versuch, `graphcode run` gegen ein lokales Modell zu fahren:
 * `OpenAiWireAnswer` deklariert an `choices[].message` nur `content` und `tool_calls`,
 * Zod entfernt alles Uebrige — also `role` und `tool_calls[].type`. Der Zweig reichte
 * genau dieses beschnittene Objekt als `assistantMsg` zurueck in die Schleife, und die
 * naechste Runde schickte eine Nachricht OHNE ROLLE ans Modell. Ollamas Chat-Template
 * antwortete mit `Jinja Exception: Unexpected message role.`, Turn .2 jeder Runde
 * scheiterte, 0 Mutationen ueber 3 Runden.
 *
 * Der sigllm-Zweig baut seine Nachricht selbst. Der anthropic-Zweig galt als nie betroffen —
 * er war es doch, an den Thinking-Bloecken (CR-GC-572, executor.anthropic-roundtrip.test.ts).
 * Diese Abnahme haelt die dritte Bauform auf derselben Linie.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildCallModel } from '../src/loop/executor-backend.js';
import { ExecutorConfigSchema } from '../src/loop/executor.js';

const config = ExecutorConfigSchema.parse({
  backend: 'openai',
  baseUrl: 'http://127.0.0.1:11434',
  model: 'qwen3.8-27b-lms:latest',
  apiKey: 'egal',
});

/** Die Drahtform, die ollama und LM Studio liefern — `role` ist dabei, `type` auch. */
const wire = (message: Record<string, unknown>) => ({
  id: 'chatcmpl-1',
  choices: [{ index: 0, finish_reason: 'tool_calls', message }],
  usage: { prompt_tokens: 10, completion_tokens: 3 },
});

function fetchStub(body: unknown) {
  const spy = vi.fn(async () => ({ ok: true, status: 200, json: async () => body }));
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => vi.unstubAllGlobals());

describe('CR-GC-554: die echoed Assistenten-Nachricht traegt Rolle und Werkzeugtyp', () => {
  it('setzt role=assistant, auch wenn das Wire-Schema sie wegschneidet', async () => {
    fetchStub(wire({ role: 'assistant', content: '', tool_calls: [
      { id: 'c1', type: 'function', function: { name: 'graph_elements', arguments: '{}' } },
    ] }));
    const call = buildCallModel(config);
    const res = await call('SYS', [{ role: 'user', content: 'los' }], []);
    const msg = res.assistantMsg as Record<string, unknown>;
    expect(msg.role, 'ohne Rolle bricht jedes rollenpruefende Chat-Template').toBe('assistant');
  });

  it('jeder tool_call traegt type=function — die OpenAI-Form verlangt es auch beim Echo', async () => {
    fetchStub(wire({ role: 'assistant', content: '', tool_calls: [
      { id: 'c1', type: 'function', function: { name: 'graph_elements', arguments: '{}' } },
      { id: 'c2', type: 'function', function: { name: 'graph_get_node', arguments: '{"uid":"SYS-a"}' } },
    ] }));
    const call = buildCallModel(config);
    const res = await call('SYS', [{ role: 'user', content: 'los' }], []);
    const tc = (res.assistantMsg as { tool_calls?: { type?: string; id?: string }[] }).tool_calls ?? [];
    expect(tc).toHaveLength(2);
    for (const c of tc) expect(c.type).toBe('function');
    expect(tc.map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('ohne Werkzeugaufrufe bleibt die Nachricht eine schlichte Assistenten-Antwort', async () => {
    fetchStub({ id: 'x', choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'Fertig.' } }] });
    const call = buildCallModel(config);
    const res = await call('SYS', [{ role: 'user', content: 'los' }], []);
    const msg = res.assistantMsg as Record<string, unknown>;
    expect(msg.role).toBe('assistant');
    expect(msg.content).toBe('Fertig.');
    expect(msg.tool_calls).toBeUndefined();
  });
});
