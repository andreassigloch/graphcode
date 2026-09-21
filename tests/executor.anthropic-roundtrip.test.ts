/**
 * CR-GC-572 — die Assistenten-Nachricht des anthropic-Zweigs muss den Umlauf ueberleben.
 *
 * Gefunden am ersten Lauf von `gcrun-frontier`: Opus 5 antwortet mit Thinking-Bloecken.
 * `AnthropicWireAnswer` deklarierte an `content[]` nur type/id/name/input/text, Zod
 * entfernte alles Uebrige — also `thinking` und `signature`. Die Schleife schickte den
 * beschnittenen Block zurueck, und die API antwortete in JEDEM Schritt auf Turn .2 mit
 * `messages.1.content.0.thinking.thinking: Field required`. Folge: keine einzige
 * Reparatur nach einer Gate-Ablehnung, 11 von 12 Schritten ohne zweiten Turn.
 *
 * Dieselbe Klasse wie CR-GC-554 im openai-Zweig: was der Anbieter zuruecknimmt, ist
 * SEINE Form, nicht unser Auszug davon.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildCallModel } from '../src/loop/executor-backend.js';
import { ExecutorConfigSchema } from '../src/loop/executor.js';

const config = ExecutorConfigSchema.parse({
  backend: 'anthropic',
  baseUrl: 'https://api.anthropic.com',
  model: 'claude-opus-5',
  apiKey: 'egal',
});

const thinking = { type: 'thinking', thinking: 'erst lesen, dann bauen', signature: 'sig-abc' };
const redacted = { type: 'redacted_thinking', data: 'verschluesselt' };
const toolUse = { type: 'tool_use', id: 'tu1', name: 'graph_elements', input: {}, caller: { type: 'direct' } };

function fetchStub(content: unknown[]) {
  const spy = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ content, stop_reason: 'tool_use', usage: { input_tokens: 10, output_tokens: 3 } }),
  }));
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => vi.unstubAllGlobals());

describe('CR-GC-572: das Echo traegt die Bloecke des Anbieters unbeschnitten', () => {
  it('thinking behaelt thinking und signature — sonst lehnt die API Turn .2 ab', async () => {
    fetchStub([thinking, toolUse]);
    const res = await buildCallModel(config)('SYS', [{ role: 'user', content: 'los' }], []);
    const msg = res.assistantMsg as { role: string; content: unknown[] };
    expect(msg.role).toBe('assistant');
    expect(msg.content[0]).toEqual(thinking);
  });

  it('auch Bloecke, die wir nicht lesen, gehen vollstaendig zurueck', async () => {
    fetchStub([redacted, toolUse]);
    const res = await buildCallModel(config)('SYS', [{ role: 'user', content: 'los' }], []);
    const msg = res.assistantMsg as { content: unknown[] };
    expect(msg.content).toEqual([redacted, toolUse]);
  });

  it('der zweite Request sendet den Block so, wie er kam', async () => {
    const spy = fetchStub([thinking, toolUse]);
    const call = buildCallModel(config);
    const first = await call('SYS', [{ role: 'user', content: 'los' }], []);
    await call('SYS', [
      { role: 'user', content: 'los' },
      first.assistantMsg,
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu1', content: '[]' }] },
    ], []);
    const body = JSON.parse((spy.mock.calls[1] as unknown as [string, { body: string }])[1].body);
    expect(body.messages[1].content[0]).toEqual(thinking);
  });

  it('gelesen wird weiter nur Text und Werkzeugaufruf — Thinking ist kein Text', async () => {
    fetchStub([thinking, { type: 'text', text: 'ok' }, toolUse]);
    const res = await buildCallModel(config)('SYS', [{ role: 'user', content: 'los' }], []);
    expect(res.text).toBe('ok');
    expect(res.toolCalls).toEqual([{ id: 'tu1', name: 'graph_elements', input: {} }]);
  });
});
