/**
 * executor-backend.ts — der Modell-Draht des eingebetteten Executors (CR-GC-507,
 * geschnitten aus executor.ts).
 *
 * Was das Modell zu sehen bekommt und wie seine Antwort zurückkommt: das
 * Tool-Angebot (Registry-Schemas als JSON Schema plus die Lese-Werkzeuge), dessen
 * backend-spezifische Form, und die zwei Backends (OpenAI-kompatibel, Anthropic).
 * Beide prüfen die Antwort in der Draht-Form am Empfang und liefern die
 * normalisierte ModelAnswer (SCHEMA-model-answer, CR-GC-426).
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';
import type { MCPToolRegistry } from '../kernel/tool-contract.js';
import {
  ModelAnswer,
  BackendFailure,
  AnthropicWireAnswer,
  OpenAiWireAnswer,
  describeWireIssues,
} from './model-answer-contract.js';
import { AUTHORING_TOOLS, WITHHELD_TOOLS } from './executor-prompt.js';
import { READ_TOOLS } from './executor-tools.js';
import type { CallModel, ExecutorConfig } from './executor.js';

// ---------------------------------------------------------------------------
// Tool-Schemas: Registry (Zod) → JSON Schema, LM-Studio-tauglich normalisiert.
// ---------------------------------------------------------------------------

interface ToolSpec {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  let out: Record<string, unknown>;
  try {
    out = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
  } catch {
    out = {};
  }
  delete out.$schema;
  // LM Studios strikter OpenAI-Validator verlangt type=object + properties.
  if (out.type !== 'object') out = { type: 'object', properties: {} };
  if (!out.properties || typeof out.properties !== 'object') out.properties = {};
  return out;
}

/** Alle Modell-Tools (graphcode_* + Read-Tools) als backend-neutrale Specs. */
export function buildToolSpecs(
  registry: MCPToolRegistry,
  toolset: ExecutorConfig['toolset'] = 'full',
): ToolSpec[] {
  const gc = Object.keys(registry)
    .filter((n) => !WITHHELD_TOOLS.has(n) && (toolset === 'full' || AUTHORING_TOOLS.has(n)))
    .map((n) => ({
      name: 'graphcode_' + n,
      description: (registry[n].description || '').slice(0, 400),
      schema: toJsonSchema(registry[n].inputSchema as z.ZodType),
    }));
  const rd = Object.entries(READ_TOOLS).map(([n, t]) => ({
    name: n,
    description: t.desc,
    schema: t.params,
  }));
  return [...gc, ...rd];
}

export function toBackendTools(specs: ToolSpec[], backend: ExecutorConfig['backend']): unknown[] {
  return backend === 'anthropic'
    ? specs.map((t) => ({ name: t.name, description: t.description, input_schema: t.schema }))
    : specs.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.schema },
      }));
}

// ---------------------------------------------------------------------------
// Backends — beide liefern die normalisierte ModelResponse.
// ---------------------------------------------------------------------------

const safeParse = (s: string): unknown => {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
};

/**
 * ULID für `requestId` — der sigllm-Vertrag verlangt genau 26 Zeichen Crockford-Base32,
 * Zeitanteil zuerst. Keine Abhängigkeit dafür: die Anforderung ist die Form, nicht die
 * Monotonie-Garantie einer Bibliothek (jeder Call ist eine eigene Anfrage).
 */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function ulid(now = Date.now()): string {
  let zeit = '';
  for (let i = 9; i >= 0; i--) {
    zeit = CROCKFORD[now % 32] + zeit;
    now = Math.floor(now / 32);
  }
  let zufall = '';
  for (let i = 0; i < 16; i++) {
    zufall += CROCKFORD[Math.floor(Math.random() * 32)];
  }
  return zeit + zufall;
}

/** Die Nachrichtenform der Schleife (OpenAI-nah), so weit sie hier gelesen wird. */
interface LoopMessage {
  role?: string;
  content?: unknown;
  tool_call_id?: string;
  tool_calls?: { id: string; function: { name: string; arguments: string } }[];
}

/**
 * Schleifenform → `Message[]` des sigllm-Vertrags.
 *
 * Zwei Dinge, die der Vertrag anders will als OpenAI: die Tool-Felder heißen camelCase, und
 * `content` ist ein String, kein `null`. Ein Assistent, der nur Werkzeuge aufruft, liefert
 * bei OpenAI `content: null` — daraus wird hier der leere String, sonst scheitert die
 * nächste Runde am Vertrag statt am Inhalt.
 */
function toSigllmMessages(system: string, messages: unknown[]): unknown[] {
  const abbilden = (m: LoopMessage): unknown => ({
    role: m.role,
    content: typeof m.content === 'string' ? m.content : m.content == null ? '' : JSON.stringify(m.content),
    ...(m.tool_calls?.length
      ? {
          toolCalls: m.tool_calls.map((c) => ({
            id: c.id,
            name: c.function.name,
            arguments: c.function.arguments,
          })),
        }
      : {}),
    ...(m.tool_call_id ? { toolCallId: m.tool_call_id } : {}),
  });
  return [{ role: 'system', content: system }, ...messages.map((m) => abbilden(m as LoopMessage))];
}

/** Was `/v1/inference` zurückgibt — nur die Felder, die der Executor liest (SCHEMA-inference-response). */
const SigllmAnswer = z.object({
  content: z.string(),
  reasoning: z.string().nullable(),
  toolCalls: z.array(z.object({ id: z.string(), name: z.string(), arguments: z.string() })),
  finishReason: z.string(),
  usage: z.object({ promptTokens: z.number(), completionTokens: z.number() }),
});

export function buildCallModel(config: ExecutorConfig): CallModel {
  if (config.backend === 'sigllm') {
    if (!config.apiKey) {
      throw new Error(
        'graphcode run: backend sigllm braucht GRAPHCODE_LLM_TOKEN — das Gateway ist die Zugangskontrolle, ' +
          'ein Lauf ohne Token endet an HTTP 401 statt hier.',
      );
    }
    if (config.candidates > 1) {
      throw new Error(
        `graphcode run: backend sigllm und GRAPHCODE_LLM_CANDIDATES=${config.candidates} passen nicht zusammen. ` +
          'Best-of-N sampelt über einen Temperatur-Spread; der sigllm-Vertrag nimmt keine temperature an ' +
          '(sie gehört zum Profil). N Kandidaten wären N identische Calls.',
      );
    }
    return async (system, messages, tools) => {
      const r = await fetch(`${config.baseUrl}/v1/inference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Der Vertrag ist .strict(): model, max_tokens, temperature und reasoning_effort
        // würden die Anfrage abweisen, nicht bloß ignoriert. Sie kommen aus dem Profil.
        body: JSON.stringify({
          requestId: ulid(),
          token: config.apiKey,
          profile: config.model,
          messages: toSigllmMessages(system, messages),
          ...(tools.length ? { tools } : {}),
          stream: false,
        }),
        signal: AbortSignal.timeout(config.callTimeoutMs),
      });
      const raw: unknown = await r.json();
      if (!r.ok) {
        // Das Gateway antwortet mit { reason, … } — den Grund durchreichen, nicht den Status.
        const grund =
          typeof raw === 'object' && raw !== null && 'reason' in raw
            ? String((raw as { reason: unknown }).reason)
            : JSON.stringify(raw).slice(0, 300);
        throw new Error(`sigllm ${r.status}: ${grund}`);
      }
      const wire = SigllmAnswer.safeParse(raw);
      if (!wire.success) {
        throw new Error(
          'backend answer breaks SCHEMA-inference-response: ' + JSON.stringify(wire.error.issues).slice(0, 300),
        );
      }
      const antwort = wire.data;
      return ModelAnswer.parse({
        text: antwort.content,
        toolCalls: antwort.toolCalls.map((c) => ({
          id: c.id,
          name: c.name,
          input: safeParse(c.arguments),
        })),
        stopReason: antwort.finishReason,
        // Die Schleife hängt diese Nachricht unverändert an und schickt sie in der nächsten
        // Runde zurück. Sie muss deshalb die OpenAI-Form tragen — toSigllmMessages übersetzt
        // sie beim Absenden, und es bleibt bei EINER Form in der Schleife.
        assistantMsg: {
          role: 'assistant',
          content: antwort.content,
          ...(antwort.toolCalls.length
            ? {
                tool_calls: antwort.toolCalls.map((c) => ({
                  id: c.id,
                  type: 'function',
                  function: { name: c.name, arguments: c.arguments },
                })),
              }
            : {}),
        },
        usage: {
          in: antwort.usage.promptTokens,
          out: antwort.usage.completionTokens,
          reasoning: 0,
        },
      });
    };
  }
  if (config.backend === 'anthropic') {
    return async (system, messages, tools) => {
      const r = await fetch(`${config.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          ...(config.apiKey ? { 'x-api-key': config.apiKey } : {}),
        },
        // KEINE temperature: die Claude-5-API lehnt den Parameter ab
        // ("deprecated", invalid_request_error) — die Temperatur-Disziplin ist
        // ein Lokal-Hebel (devstral), Frontier braucht sie nicht.
        body: JSON.stringify({
          model: config.model,
          max_tokens: config.maxTokens,
          system,
          tools,
          messages,
        }),
        signal: AbortSignal.timeout(config.callTimeoutMs),
      });
      const raw: unknown = await r.json();
      if (BackendFailure.safeParse(raw).success) {
        throw new Error('backend: ' + JSON.stringify(raw).slice(0, 300));
      }
      const wire = AnthropicWireAnswer.safeParse(raw);
      if (!wire.success) {
        throw new Error(
          'backend answer breaks SCHEMA-model-answer (anthropic wire): ' +
            describeWireIssues(wire.error),
        );
      }
      const content = wire.data.content;
      return ModelAnswer.parse({
        text: content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join(''),
        toolCalls: content
          .filter((b) => b.type === 'tool_use')
          .map((b) => ({ id: b.id ?? '', name: b.name ?? '', input: b.input })),
        stopReason: wire.data.stop_reason ?? null,
        assistantMsg: { role: 'assistant', content },
        usage: {
          in: wire.data.usage?.input_tokens ?? 0,
          out: wire.data.usage?.output_tokens ?? 0,
          reasoning: 0,
        },
      });
    };
  }
  return async (system, messages, tools, opts) => {
    const r = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: 'Bearer ' + config.apiKey } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        // Best-of-N (CR-GC-288): der Kandidaten-Spread überschreibt die Basis-Temperatur.
        temperature: opts?.temperature ?? config.temperature,
        ...(config.reasoningEffort ? { reasoning_effort: config.reasoningEffort } : {}),
        messages: [{ role: 'system', content: system }, ...messages],
        tools,
      }),
      signal: AbortSignal.timeout(config.callTimeoutMs),
    });
    const raw: unknown = await r.json();
    if (BackendFailure.safeParse(raw).success) {
      throw new Error('backend: ' + JSON.stringify(raw).slice(0, 300));
    }
    const wire = OpenAiWireAnswer.safeParse(raw);
    if (!wire.success) {
      throw new Error(
        'backend answer breaks SCHEMA-model-answer (openai wire): ' + describeWireIssues(wire.error),
      );
    }
    const choice = wire.data.choices[0];
    const msg = choice?.message ?? {};
    return ModelAnswer.parse({
      text: msg.content ?? '',
      toolCalls: (msg.tool_calls ?? []).map((c) => ({
        id: c.id,
        name: c.function.name,
        input: safeParse(c.function.arguments),
      })),
      stopReason: choice?.finish_reason ?? null,
      assistantMsg: msg,
      usage: {
        in: wire.data.usage?.prompt_tokens ?? 0,
        out: wire.data.usage?.completion_tokens ?? 0,
        reasoning: wire.data.usage?.completion_tokens_details?.reasoning_tokens ?? 0,
      },
    });
  };
}
