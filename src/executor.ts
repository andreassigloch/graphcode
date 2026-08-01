/**
 * executor.ts — embedded model executor (CR-GC-278, Weg C Teil 1).
 *
 * Fährt ein Modell (LM Studio `/v1/chat/completions` oder Anthropic
 * `/v1/messages`) DIREKT gegen die in-process Tool-Registry — kein opencode,
 * kein Claude Code, ~2–3k Token Grundlast statt ~16k. graphcode liefert die
 * Methode selbst: der Executor ruft `graph_generate` deterministisch pro Runde
 * und injiziert dessen Instruktion (inkl. Kanten-Grammatik); das Modell
 * emittiert nur den geforderten Batch via `graph_mutate`.
 *
 * Kernkorrektur gegenüber dem Rig-Prototyp (rig/greenfield-systemtest/
 * driver.mjs): der REPAIR-LOOP. Der Prototyp brach den Step nach dem ersten
 * Mutate ab — auch bei Gate-Rejection; das Modell sah die violations nie
 * (die Fehldiagnose "lokal kann Expand nicht"). Hier läuft der Step weiter,
 * bis das Gate `success:true` sagt oder das Step-Budget endet, und jede
 * Rejection geht als kompaktes Feedback (violations + fixHint) zurück.
 *
 * @author andreas@siglochconsulting
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { z } from 'zod/v4';
import type { MutateResult } from '@sigloch/contracts/harness';
import type { MCPToolRegistry } from './mcp-tools.js';
import type { GenerationStep } from './generate.js';

// ---------------------------------------------------------------------------
// Config (lokal per CR-GC-278 — Promotion nach @sigloch/contracts erst mit der
// SSOT-Entscheidung zum Executor, siehe CR-Dokument / Governance-Flagge).
// ---------------------------------------------------------------------------

export const ExecutorConfigSchema = z.object({
  backend: z.enum(['openai', 'anthropic']).default('openai'),
  /** Basis-URL des Modell-Endpoints, z.B. http://192.168.78.89:1234 (LM Studio). */
  baseUrl: z.string().min(1),
  model: z.string().min(1),
  apiKey: z.string().optional(),
  /** Max. graph_generate-Runden, bevor der Lauf abgebrochen wird. */
  maxRounds: z.number().int().positive().default(40),
  /** Max. Modell-Turns pro generate-Schritt — das Repair-Budget. */
  maxStepTurns: z.number().int().positive().default(6),
  /** HTTP-Timeout pro Modell-Call (ms). */
  callTimeoutMs: z.number().int().positive().default(180_000),
  /** Antwort-Budget pro Call. Ein Batch braucht selten >2k Token; bei ~16 tok/s
   * lokaler Decode-Rate kostet jedes erlaubte Token Wall-Zeit (8000 ≈ 500s). */
  maxTokens: z.number().int().positive().default(2048),
  /** Tool-Angebot ans Modell: 'authoring' = kuratiertes Minimal-Set für den
   * generativen Loop (Grundlast-These: jede Schema-Zeile kostet Prompt-Eval bei
   * JEDEM Call — v5-Befund: 20 Schemas trieben die lokale Box über 300s TTFB);
   * 'full' = alle Registry-Tools außer den withheld. */
  toolset: z.enum(['authoring', 'full']).default('authoring'),
});
export type ExecutorConfig = z.infer<typeof ExecutorConfigSchema>;

export interface ModelToolCall {
  id: string;
  name: string;
  input: unknown;
}

/** Normalisierte Backend-Antwort — beide Backends liefern genau diese Form. */
export interface ModelResponse {
  text: string;
  toolCalls: ModelToolCall[];
  /** Backend-shaped assistant message, unverändert in die History gepusht. */
  assistantMsg: unknown;
  usage: { in: number; out: number; reasoning: number };
}

export type CallModel = (
  system: string,
  messages: unknown[],
  tools: unknown[],
) => Promise<ModelResponse>;

export interface ExecutorStats {
  /** true = graph_generate meldete Handoff (Struktur trägt); false = Rundenlimit. */
  done: boolean;
  genRounds: number;
  modelTurns: number;
  mutatesApplied: number;
  mutatesRejected: number;
  /** dryRun-Mutates (Gate-Protokoll-Proben) — nie ein Step-Abschluss. */
  dryRunProbes: number;
  /** Applies, denen im selben Step ≥1 Rejection vorausging — die Repair-Loop-Metrik. */
  repairedAfterRejection: number;
  tokensIn: number;
  tokensOut: number;
  tokensReasoning: number;
}

// ---------------------------------------------------------------------------
// System-Prompt — bewusst ~1 Seite; die Methode kommt aus graph_generate.
// ---------------------------------------------------------------------------

const SYSTEM = `Du autorierst Elemente in einen graphcode-Graphen. Der Graph ist die einzige Wahrheit — kein Code, keine Prosa.

Jede Nachricht gibt dir EINE präzise Generierungs-Instruktion (inkl. der legalen Kanten). Führe genau sie aus:
emittiere den geforderten Batch als EINEN graphcode_graph_mutate-Aufruf im commands-Format, dann STOPP.

graph_mutate-Form (exakt):
{"commands":[
  {"op":"add-node","node":{"uid":"UC-login","type":"UC","name":"Login","description":"...","attributes":{}}},
  {"op":"add-edge","edge":{"sourceId":"ACTOR-user","targetId":"UC-login","edgeType":"io","attributes":{}}}
]}
uid = "<TYP>-<kebab-name>". Nutze GENAU die Kanten aus der Instruktion (z.B. "ACTOR io→UC, SYS compose→UC").
Lehnt das Gate deinen Batch ab (success:false), korrigiere NUR die beanstandeten Commands anhand der
violations/fixHints und reiche den VOLLSTÄNDIGEN korrigierten Batch erneut ein.
list_dir/read_file/grep über ./material nur sparsam, um echte Modul-Namen zu finden — nicht statt Bauen.
Handeln vor Analysieren: rufe graph_mutate, rate die Instruktion nicht tot.`;

const EMIT_SUFFIX =
  '\n\nEmittiere GENAU diesen Schritt als EINEN graph_mutate-Aufruf im commands-Format ' +
  '({"commands":[{"op":"add-node","node":{"uid","type","name","description","attributes":{}}},' +
  '{"op":"add-edge","edge":{"sourceId","targetId","edgeType","attributes":{}}}]}).';

/** Expand-Fokus (CR-GC-280): große Batches scheiterten an der Grammatik (v6);
 * pro Step nur der erste Fund — die frische Runde holt den Rest deterministisch. */
const EXPAND_FOCUS =
  '\nBearbeite in diesem Schritt NUR den ERSTEN Fund aus der Instruktion — ' +
  'ein kleiner Batch (höchstens ~6 Commands). Die weiteren Funde kommen in den nächsten Schritten.';

/** Handlungs-Zwang bei Idle-Turns: Coder-Modelle dithern gern in Prosa (Rig-Befund
 * "6× guide/Runde") — EIN Nachfassen pro Step statt den Schritt still aufzugeben. */
const IDLE_NUDGE =
  'Du hast KEINEN graph_mutate-Call emittiert. Emittiere JETZT den geforderten Batch als EINEN ' +
  'graphcode_graph_mutate-Tool-Call im commands-Format — keine Prosa, keine weitere Analyse.';

/** Diese Tools ruft der EXECUTOR deterministisch — dem Modell werden sie vorenthalten. */
const WITHHELD_TOOLS = new Set(['graph_generate', 'graph_next_step']);

/** Das kuratierte Minimal-Set für den generativen Loop (toolset 'authoring'). */
const AUTHORING_TOOLS = new Set([
  'graph_mutate',
  'graph_authoring_guide',
  'graph_get_node',
  'graph_elements',
  'graph_readiness',
]);

// ---------------------------------------------------------------------------
// Read-Tools — auf den Workspace gescoped (Containment-Guard, kein ..-Ausbruch).
// ---------------------------------------------------------------------------

function contained(workspaceDir: string, p: string): string {
  const abs = resolve(workspaceDir, p);
  if (abs !== workspaceDir && !abs.startsWith(workspaceDir + '/')) {
    throw new Error(`path escapes workspace: ${p}`);
  }
  return abs;
}

interface ReadTool {
  desc: string;
  params: Record<string, unknown>;
  run: (workspaceDir: string, input: Record<string, unknown>) => string;
}

const READ_TOOLS: Record<string, ReadTool> = {
  list_dir: {
    desc: 'List entries under a workspace-relative directory (e.g. "material").',
    params: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    run: (dir, input) => {
      const p = contained(dir, String(input.path ?? '.'));
      return readdirSync(p)
        .map((n) => {
          try {
            return statSync(join(p, n)).isDirectory() ? n + '/' : n;
          } catch {
            return n;
          }
        })
        .join('\n');
    },
  },
  read_file: {
    desc: 'Read a workspace-relative file (capped at 8000 chars).',
    params: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    run: (dir, input) => readFileSync(contained(dir, String(input.path)), 'utf8').slice(0, 8000),
  },
  grep: {
    desc: 'Case-insensitive substring search across ./material; up to 40 "relpath:line" hits.',
    params: { type: 'object', properties: { pattern: { type: 'string' } }, required: ['pattern'] },
    run: (dir, input) => {
      const hits: string[] = [];
      const root = join(dir, 'material');
      const needle = String(input.pattern ?? '').toLowerCase();
      const walk = (d: string): void => {
        for (const n of readdirSync(d)) {
          const p = join(d, n);
          let st;
          try {
            st = statSync(p);
          } catch {
            continue;
          }
          if (st.isDirectory()) {
            if (n !== 'node_modules' && n !== '.git') walk(p);
          } else if (/\.(ts|js|md|json|tsx)$/.test(n) && st.size < 200_000) {
            readFileSync(p, 'utf8')
              .split('\n')
              .forEach((ln, i) => {
                if (hits.length < 40 && ln.toLowerCase().includes(needle)) {
                  hits.push(`${relative(dir, p)}:${i + 1}`);
                }
              });
          }
          if (hits.length >= 40) return;
        }
      };
      try {
        walk(root);
      } catch {
        // ./material darf fehlen — dann gibt es schlicht keine Treffer.
      }
      return hits.join('\n') || '(no hits)';
    },
  },
};

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

function toBackendTools(specs: ToolSpec[], backend: ExecutorConfig['backend']): unknown[] {
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
        body: JSON.stringify({ model: config.model, max_tokens: config.maxTokens, system, tools, messages }),
        signal: AbortSignal.timeout(config.callTimeoutMs),
      });
      const j = (await r.json()) as {
        type?: string;
        error?: unknown;
        content?: { type: string; id?: string; name?: string; input?: unknown; text?: string }[];
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      if (j.type === 'error' || j.error) {
        throw new Error('backend: ' + JSON.stringify(j.error ?? j).slice(0, 300));
      }
      const content = j.content ?? [];
      return {
        text: content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join(''),
        toolCalls: content
          .filter((b) => b.type === 'tool_use')
          .map((b) => ({ id: b.id ?? '', name: b.name ?? '', input: b.input })),
        assistantMsg: { role: 'assistant', content },
        usage: { in: j.usage?.input_tokens ?? 0, out: j.usage?.output_tokens ?? 0, reasoning: 0 },
      };
    };
  }
  return async (system, messages, tools) => {
    const r = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: 'Bearer ' + config.apiKey } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        messages: [{ role: 'system', content: system }, ...messages],
        tools,
      }),
      signal: AbortSignal.timeout(config.callTimeoutMs),
    });
    const j = (await r.json()) as {
      error?: unknown;
      choices?: {
        message?: {
          content?: string;
          tool_calls?: { id: string; function: { name: string; arguments: string } }[];
        };
      }[];
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        completion_tokens_details?: { reasoning_tokens?: number };
      };
    };
    if (j.error) throw new Error('backend: ' + JSON.stringify(j.error).slice(0, 300));
    const msg = j.choices?.[0]?.message ?? {};
    return {
      text: msg.content ?? '',
      toolCalls: (msg.tool_calls ?? []).map((c) => ({
        id: c.id,
        name: c.function.name,
        input: safeParse(c.function.arguments),
      })),
      assistantMsg: msg,
      usage: {
        in: j.usage?.prompt_tokens ?? 0,
        out: j.usage?.completion_tokens ?? 0,
        reasoning: j.usage?.completion_tokens_details?.reasoning_tokens ?? 0,
      },
    };
  };
}

// ---------------------------------------------------------------------------
// Prosa-Recovery: Coder-Modelle (devstral) schreiben den Mutate gern als Text.
// ---------------------------------------------------------------------------

export function extractMutateFromText(text: string): { commands: unknown[] } | null {
  if (!text || !text.includes('"commands"')) return null;
  const at = text.indexOf('"commands"');
  let start = text.lastIndexOf('{', at);
  while (start >= 0) {
    let depth = 0;
    let end = -1;
    for (let k = start; k < text.length; k++) {
      if (text[k] === '{') depth++;
      else if (text[k] === '}' && --depth === 0) {
        end = k;
        break;
      }
    }
    if (end > start) {
      try {
        const o = JSON.parse(text.slice(start, end + 1)) as { commands?: unknown };
        if (Array.isArray(o.commands)) return o as { commands: unknown[] };
      } catch {
        // kein valides JSON an dieser Klammer — weiter außen suchen
      }
    }
    // lastIndexOf clampt fromIndex<0 auf 0 — bei start=0 liefe die Suche endlos.
    start = start > 0 ? text.lastIndexOf('{', start - 1) : -1;
  }
  // Kein balanciertes Objekt — SALVAGE (v8-Befund): devstrals [ARGS]-Mega-Batches
  // werden vom maxTokens-Budget mitten im JSON abgeschnitten. Alle VOLLSTÄNDIGEN
  // Command-Objekte aus dem Array bergen; das Gate urteilt über den Teil-Batch.
  const salvaged = salvageCommands(text);
  return salvaged.length > 0 ? { commands: salvaged } : null;
}

/** String-bewusster Brace-Scan: birgt vollständige {…}-Objekte aus einem
 * (potenziell abgeschnittenen) `"commands": [ … `-Array. */
function salvageCommands(text: string): unknown[] {
  const at = text.indexOf('"commands"');
  if (at < 0) return [];
  const arr = text.indexOf('[', at);
  if (arr < 0) return [];
  const out: unknown[] = [];
  let i = arr + 1;
  while (i < text.length) {
    while (i < text.length && text[i] !== '{' && text[i] !== ']') i++;
    if (i >= text.length || text[i] === ']') break;
    const start = i;
    let depth = 0;
    let inString = false;
    let end = -1;
    for (; i < text.length; i++) {
      const c = text[i];
      if (inString) {
        if (c === '\\') i++; // Escape überspringen
        else if (c === '"') inString = false;
      } else if (c === '"') inString = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) {
        end = i;
        break;
      }
    }
    if (end < 0) break; // abgeschnittenes letztes Objekt — verwerfen
    try {
      const o = JSON.parse(text.slice(start, end + 1)) as { op?: unknown };
      if (typeof o.op === 'string') out.push(o);
    } catch {
      break; // ab hier ist der Stream nicht mehr vertrauenswürdig
    }
    i = end + 1;
  }
  return out;
}

/**
 * `[ARGS]`-Text-Recovery (CR-GC-280): devstral schreibt Tool-Calls wiederholt
 * als Text — `graphcode_graph_elements[ARGS]{"type":"UC"}`. Den Call parsen
 * statt den Turn an die Nudge zu verlieren.
 */
export function extractToolCallFromText(text: string): { name: string; input: unknown } | null {
  if (!text) return null;
  const m = /([A-Za-z0-9_]+)\s*\[ARGS\]\s*(\{[\s\S]*)/.exec(text);
  if (!m) return null;
  const s = m[2];
  let depth = 0;
  let end = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}' && --depth === 0) {
      end = i;
      break;
    }
  }
  if (end < 0) return null;
  try {
    return { name: m[1], input: JSON.parse(s.slice(0, end + 1)) };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Gate-Feedback — der Kern des Repair-Loops.
// ---------------------------------------------------------------------------

type MutateOutcome = Partial<MutateResult> & { success: boolean };

function formatGateFeedback(result: MutateOutcome): string {
  const violations = (result.violations ?? [])
    .slice(0, 8)
    .map(
      (v) =>
        `- ${v.ruleId} [${v.severity}] ${v.message}${v.fixHint ? ' — Fix: ' + v.fixHint : ''}`,
    )
    .join('\n');
  return (
    `Das Gate hat den Batch NICHT übernommen (success:false` +
    `${result.tier ? ', tier=' + result.tier : ''}) — NICHTS wurde persistiert.\n` +
    (violations || '- (keine Einzel-Violations — prüfe die Command-Form)') +
    `\nKorrigiere die beanstandeten Commands und reiche den VOLLSTÄNDIGEN korrigierten Batch ` +
    `erneut als graph_mutate ein.`
  ).slice(0, 2500);
}

// ---------------------------------------------------------------------------
// Der Loop.
// ---------------------------------------------------------------------------

export interface RunExecutorOptions {
  registry: MCPToolRegistry;
  /** Workspace-Root für die Read-Tools (./material etc.). */
  workspaceDir: string;
  /** Prosa-Intention — nur der erste graph_generate-Call trägt sie. */
  intent?: string;
  config: ExecutorConfig;
  /** Test-Injektion: ersetzt den HTTP-Backend-Call. */
  callModel?: CallModel;
  trace?: (line: string) => void;
}

export async function runExecutor(opts: RunExecutorOptions): Promise<ExecutorStats> {
  const { registry, workspaceDir, config } = opts;
  const trace = opts.trace ?? ((): void => undefined);
  const callModel = opts.callModel ?? buildCallModel(config);
  const tools = toBackendTools(buildToolSpecs(registry, config.toolset), config.backend);

  const stats: ExecutorStats = {
    done: false,
    genRounds: 0,
    modelTurns: 0,
    mutatesApplied: 0,
    mutatesRejected: 0,
    dryRunProbes: 0,
    repairedAfterRejection: 0,
    tokensIn: 0,
    tokensOut: 0,
    tokensReasoning: 0,
  };

  const runMutate = async (input: unknown): Promise<MutateOutcome> => {
    try {
      const result = (await registry['graph_mutate'].handler(input)) as MutateOutcome;
      return { ...result, success: result.success === true };
    } catch (err) {
      return {
        success: false,
        violations: [
          {
            ruleId: 'executor-call',
            severity: 'error',
            message: err instanceof Error ? err.message : String(err),
          },
        ],
      };
    }
  };

  const execReadOrGraphTool = async (name: string, input: unknown): Promise<string> => {
    const rt = READ_TOOLS[name];
    if (rt) {
      try {
        return rt.run(workspaceDir, (input ?? {}) as Record<string, unknown>);
      } catch (err) {
        return 'ERROR: ' + (err instanceof Error ? err.message : String(err));
      }
    }
    if (name.startsWith('graphcode_')) {
      const tool = registry[name.slice('graphcode_'.length)];
      if (!tool) return 'ERROR: unknown tool ' + name;
      try {
        return JSON.stringify(await tool.handler(input ?? {})).slice(0, 6000);
      } catch (err) {
        return 'ERROR: ' + (err instanceof Error ? err.message : String(err));
      }
    }
    return 'ERROR: unknown tool ' + name;
  };

  // Backend-korrektes Anhängen der Tool-Results (+ optionales Gate-Feedback):
  // anthropic verlangt tool_result-Blöcke in der NÄCHSTEN User-Message — das
  // Feedback wandert dort als zusätzlicher Text-Block in dieselbe Message.
  const pushToolResults = (
    messages: unknown[],
    calls: ModelToolCall[],
    results: string[],
    feedback?: string,
  ): void => {
    if (config.backend === 'anthropic') {
      const content: unknown[] = calls.map((c, i) => ({
        type: 'tool_result',
        tool_use_id: c.id,
        content: results[i],
      }));
      if (feedback) content.push({ type: 'text', text: feedback });
      messages.push({ role: 'user', content });
      return;
    }
    // openai/LM Studio: KEINE separate User-Message nach Tool-Results — Mistrals
    // Jinja-Template verlangt strikte Rollen-Alternierung und bricht sonst das
    // Rendering ("conversation roles must alternate", v3-Lauf-Befund). Das
    // Feedback wandert in den Content des letzten Tool-Results.
    calls.forEach((c, i) => {
      const content =
        feedback && i === calls.length - 1 ? results[i] + '\n\n' + feedback : results[i];
      messages.push({ role: 'tool', tool_call_id: c.id, content });
    });
  };

  // Intent bei JEDEM generate-Call mitgeben (nicht nur beim ersten, wie im Rig):
  // scheitert der Seed-Step (Timeout, Idle), liefe die Folgerunde sonst ohne
  // Intent UND ohne SYS in die "Erfrage die Systemintention"-Sackgasse — und
  // headless kann niemand antworten. Nach dem Seed ist er redundant, nie falsch.
  let lastGenPrompt = '';
  let stagnation = 0;
  // Fund-Rotation (CR-GC-281): focusKeys, an denen sich das Modell festgefahren
  // hat — ab Stagnations-Schwelle 3 deterministisch zurückgestellt; jeder
  // weitere generate-Call trägt sie als defer, graph_generate rotiert weiter.
  const deferred = new Set<string>();
  const STAGNATION_DEFER_THRESHOLD = 3;
  for (let round = 0; round < config.maxRounds; round++) {
    const genInput: Record<string, unknown> = {};
    if (opts.intent) genInput.intent = opts.intent;
    if (deferred.size > 0) genInput.defer = [...deferred];
    const gen = (await registry['graph_generate'].handler(genInput)) as GenerationStep;
    stats.genRounds = round + 1;
    trace(`[generate ${round + 1}] phase=${gen.phase} done=${gen.done}`);
    if (gen.done) {
      stats.done = true;
      break;
    }

    // Stagnations-Detektor (v10-Befund: "applied ≠ Fortschritt" — devstral fügte
    // rundenlang denselben TEST-Knoten OHNE die verify-Kante hinzu; die Violation
    // blieb, graph_generate fokussierte denselben Fund endlos). Identische
    // Instruktion wie letzte Runde ⇒ der letzte Batch hat den Fund nicht gelöst.
    if (gen.prompt === lastGenPrompt) {
      stagnation += 1;
      trace(`  stagnation x${stagnation}: same generate prompt as last round`);
      // Deterministisches Defer statt Prompt-Druck (v11-Befund: ein Fund fraß
      // 31 Runden): das festgefahrene Fund-Set zurückstellen — die nächste
      // Runde fokussiert einen anderen Fund, der Prompt-Wechsel resettet
      // stagnation/lastGenPrompt über den bestehenden Vergleich.
      if (stagnation >= STAGNATION_DEFER_THRESHOLD && gen.focusKey && !deferred.has(gen.focusKey)) {
        deferred.add(gen.focusKey);
        trace(`  defer: ${gen.focusKey}`);
      }
    } else {
      stagnation = 0;
      lastGenPrompt = gen.prompt;
    }
    const stagnationHint =
      stagnation > 0
        ? `\nACHTUNG: Diese Instruktion kommt zum ${stagnation + 1}. Mal — dein letzter Batch hat den ` +
          `Fund NICHT aufgelöst. Häufigste Ursache: die geforderte KANTE fehlt (z.B. TEST verify→REQ). ` +
          `Emittiere Knoten UND Kante zusammen in EINEM Batch; existierende Knoten nicht erneut anlegen.`
        : '';
    const focus = gen.phase === 'expand' ? EXPAND_FOCUS : '';
    const messages: unknown[] = [{ role: 'user', content: gen.prompt + EMIT_SUFFIX + focus + stagnationHint }];
    let rejectedInStep = false;
    let nudgedInStep = false;
    let readTurns = 0; // Lese-Turns ohne Mutate-Versuch in diesem Step (CR-GC-280)

    for (let turn = 0; turn < config.maxStepTurns; turn++) {
      stats.modelTurns += 1;
      let resp: ModelResponse;
      try {
        resp = await callModel(SYSTEM, messages, tools);
      } catch (err) {
        // Hängender/transienter Modell-Call: Step aufgeben, nächste generate-Runde.
        trace(`  ${round + 1}.${turn + 1}: call failed (${(err as Error).message.slice(0, 80)}) — skip`);
        break;
      }
      stats.tokensIn += resp.usage.in;
      stats.tokensOut += resp.usage.out;
      stats.tokensReasoning += resp.usage.reasoning;
      trace(
        `  ${round + 1}.${turn + 1}: ` +
          (resp.toolCalls.map((c) => c.name.replace('graphcode_', '')).join(',') || '(no calls)'),
      );

      if (resp.toolCalls.length === 0) {
        // Kein Tool-Call: Prosa-Mutate recovern, [ARGS]-Text-Call recovern, sonst idle.
        let recovered = extractMutateFromText(resp.text);
        if (!recovered) {
          const textCall = extractToolCallFromText(resp.text);
          const canonical = textCall?.name.replace(/^graphcode_/, '');
          if (textCall && canonical === 'graph_mutate') {
            // Mutate als [ARGS]-Text → dieselbe Applied/Rejected-Logik wie unten.
            recovered = (textCall.input ?? {}) as { commands: unknown[] };
          } else if (textCall && canonical && (READ_TOOLS[textCall.name] || registry[canonical])) {
            // Sonstiger Tool-Call als Text: ausführen, Ergebnis in die History —
            // der Turn trägt, statt an die Nudge zu fallen (CR-GC-280).
            const toolName = READ_TOOLS[textCall.name] ? textCall.name : 'graphcode_' + canonical;
            const result = await execReadOrGraphTool(toolName, textCall.input);
            trace(`    recovered text tool-call ${canonical}`);
            messages.push({ role: 'assistant', content: resp.text });
            messages.push({
              role: 'user',
              content:
                `Ergebnis von ${canonical}:\n${result.slice(0, 4000)}\n` +
                'Fahre fort: emittiere jetzt den geforderten graph_mutate-Batch.',
            });
            continue;
          }
        }
        if (!recovered) {
          trace(`    idle: ${resp.text.slice(0, 160).replace(/\n/g, ' ')}`);
          if (nudgedInStep) break; // schon nachgefasst — Step aufgeben
          nudgedInStep = true;
          messages.push({ role: 'assistant', content: resp.text || '(leer)' });
          messages.push({ role: 'user', content: IDLE_NUDGE });
          continue;
        }
        const outcome = await runMutate(recovered);
        if (outcome.success) {
          stats.mutatesApplied += 1;
          if (rejectedInStep) stats.repairedAfterRejection += 1;
          trace(`    recovered mutate applied (${outcome.mutations ?? '?'} mutations)`);
          break;
        }
        // Rejected recovery: Feedback in die History — NICHT stiller Drop (der
        // Rig-Fehler). Assistant-Text zuerst, damit die Konversation konsistent bleibt.
        stats.mutatesRejected += 1;
        rejectedInStep = true;
        messages.push({ role: 'assistant', content: resp.text });
        messages.push({ role: 'user', content: formatGateFeedback(outcome) });
        trace(`    recovered mutate REJECTED — feeding gate violations back`);
        continue;
      }

      messages.push(resp.assistantMsg);
      const results: string[] = [];
      let appliedThisTurn = false;
      let rejectedThisTurn = false;
      let lastRejection: MutateOutcome | null = null;
      for (const call of resp.toolCalls) {
        if (call.name === 'graphcode_graph_mutate') {
          // dryRun = Gate-Protokoll-Probe (graph_generate instruiert Verdict-Vergleich):
          // Verdict zurückgeben, aber NIE als Step-Abschluss werten — der echte
          // Apply folgt im selben Step (die Baseline-Falle: dryRun als applied
          // gezählt → Step beendet, nichts persistiert).
          const isDryRun =
            typeof call.input === 'object' &&
            call.input !== null &&
            (call.input as Record<string, unknown>).dryRun === true;
          if (isDryRun) {
            stats.dryRunProbes += 1;
            results.push(await execReadOrGraphTool(call.name, call.input));
            continue;
          }
          const outcome = await runMutate(call.input);
          results.push(JSON.stringify(outcome).slice(0, 6000));
          if (outcome.success) {
            stats.mutatesApplied += 1;
            appliedThisTurn = true;
          } else {
            stats.mutatesRejected += 1;
            rejectedThisTurn = true;
            lastRejection = outcome;
          }
        } else {
          results.push(await execReadOrGraphTool(call.name, call.input));
        }
      }
      const attemptedMutate = appliedThisTurn || rejectedThisTurn;
      if (!attemptedMutate) readTurns += 1;
      // Lese-Budget (CR-GC-280): devstral exploriert sonst alle 6 Turns (guide/
      // elements) und emittiert nie — ab dem 2. Lese-Turn wandert der Handlungs-
      // Zwang in den Tool-Result-Content (Jinja-sicher, s. Rollen-Alternierung).
      const feedback =
        rejectedThisTurn && !appliedThisTurn && lastRejection
          ? formatGateFeedback(lastRejection)
          : !attemptedMutate && readTurns >= 2
            ? IDLE_NUDGE
            : undefined;
      pushToolResults(messages, resp.toolCalls, results, feedback);
      if (appliedThisTurn) {
        if (rejectedInStep || rejectedThisTurn) stats.repairedAfterRejection += 1;
        break; // Step autoriert → nächste generate-Runde
      }
      if (rejectedThisTurn) {
        rejectedInStep = true;
        trace(`    gate rejected — feeding violations back (turn ${turn + 1}/${config.maxStepTurns})`);
      }
      // reine Read-/Explorations-Turns laufen einfach weiter
    }
  }
  return stats;
}
