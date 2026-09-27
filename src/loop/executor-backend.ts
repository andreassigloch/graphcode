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
import { strengesSchema, type MCPToolRegistry } from '../kernel/tool-contract.js';
import {
  ModelAnswer,
  BackendFailure,
  AnthropicWireAnswer,
  OpenAiWireAnswer,
  describeWireIssues,
} from './model-answer-contract.js';
import { AUTHORING_PARAMS, WITHHELD_TOOLS } from './executor-prompt.js';
import { READ_TOOLS } from './executor-tools.js';
import { leseOpenAiAntwort } from './openai-stream.js';
import { leseAnthropicAntwort } from './anthropic-stream.js';
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
    .filter((n) => !WITHHELD_TOOLS.has(n) && (toolset === 'full' || n in AUTHORING_PARAMS))
    .map((n) => {
      // Streng wie am MCP-Server (CR-GC-647): die Zusage traegt additionalProperties:false.
      const schema = toJsonSchema(strengesSchema(registry[n]) as z.ZodType);
      const description = registry[n].description || '';
      if (toolset === 'full') return { name: 'graphcode_' + n, description: description.slice(0, 400), schema };
      return { name: 'graphcode_' + n, description: ersterSatz(description), schema: projiziert(schema, AUTHORING_PARAMS[n]) };
    });
  const rd = Object.entries(READ_TOOLS).map(([n, t]) => ({
    name: n,
    description: t.desc,
    schema: t.params,
  }));
  return [...gc, ...rd];
}

/** Der erste Satz einer Werkzeugbeschreibung — im Executor waehlt der Treiber, nicht das Modell (CR-GC-651). */
function ersterSatz(text: string): string {
  const ende = text.search(/\.(\s|$)/);
  return ende >= 0 ? text.slice(0, ende + 1) : text;
}

/** Nur die erlaubten Parameter, ohne ihre Beschreibungen (CR-GC-651). */
function projiziert(
  schema: Record<string, unknown>,
  auswahl: { params: readonly string[]; required?: readonly string[] },
): Record<string, unknown> {
  const props = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
  const properties: Record<string, unknown> = {};
  for (const k of auswahl.params) {
    if (!props[k]) continue;
    const ohneText = { ...props[k] };
    delete ohneText.description;
    properties[k] = ohneText;
  }
  const bisher = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  const required = [...new Set([...bisher.filter((k) => auswahl.params.includes(k)), ...(auswahl.required ?? [])])];
  const out: Record<string, unknown> = { ...schema, properties };
  if (required.length > 0) out.required = required;
  else delete out.required;
  return out;
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

export function buildCallModel(config: ExecutorConfig): CallModel {
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
          // CR-GC-662: gestreamt — dieselbe 300-s-Grenze von fetch wie im openai-Zweig (CR-GC-656).
          stream: true,
        }),
        signal: AbortSignal.timeout(config.callTimeoutMs),
      });
      const raw: unknown = await leseAnthropicAntwort(r);
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
        // CR-GC-656: gestreamt, damit der Antwortkopf sofort kommt — undici bricht nach 300 s ohne
        // Kopf ab, egal was `callTimeoutMs` sagt. `include_usage` liefert die Zaehlung im letzten Stueck.
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: AbortSignal.timeout(config.callTimeoutMs),
    });
    const raw: unknown = await leseOpenAiAntwort(r);
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
    const rufe = msg.tool_calls ?? [];
    return ModelAnswer.parse({
      text: msg.content ?? '',
      toolCalls: rufe.map((c) => ({
        id: c.id,
        name: c.function.name,
        input: safeParse(c.function.arguments),
      })),
      stopReason: choice?.finish_reason ?? null,
      // GEBAUT, nicht durchgereicht (CR-GC-554): `OpenAiWireAnswer` deklariert an
      // `message` nur `content` und `tool_calls`, Zod entfernt alles Uebrige — also
      // `role` und `tool_calls[].type`. Die Schleife haengt diese Nachricht an die
      // Historie und schickt sie zurueck; ohne Rolle bricht ollamas Chat-Template mit
      // `Unexpected message role.`, und ein nachlaessiges Template rendert sie still
      // falsch. Der anthropic-Zweig baut seine Nachricht ebenso selbst: zwei Zweige, eine
      // Bauform. Das Wire-Schema bleibt Leser, nicht Echo-Puffer.
      assistantMsg: {
        role: 'assistant',
        content: msg.content ?? '',
        ...(rufe.length
          ? {
              tool_calls: rufe.map((c) => ({
                id: c.id,
                type: 'function',
                function: { name: c.function.name, arguments: c.function.arguments },
              })),
            }
          : {}),
      },
      usage: {
        in: wire.data.usage?.prompt_tokens ?? 0,
        out: wire.data.usage?.completion_tokens ?? 0,
        reasoning: wire.data.usage?.completion_tokens_details?.reasoning_tokens ?? 0,
      },
    });
  };
}
