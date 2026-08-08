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
import type { FitAdvisory } from './fit-advisory.js';
import type { MCPToolRegistry } from './mcp-tools.js';
import type { GenerationStep } from './generate.js';
import { preflightBatch, type PreflightKnown } from './preflight.js';
import { duplicateHints, type IndexedElement } from './nd-similarity.js';
import type { SteeringDelta } from './steering-snapshot.js';
// Die drei zustandsfreien Executor-Achsen (CR-GC-320) — Prompt/Injektion,
// Best-of-N-Ranking, Prosa-Recovery. Kein Re-Export von hier: wer sie braucht,
// importiert das jeweilige Modul direkt (keine parallelen Pfade).
import {
  AUTHORING_TOOLS,
  EMIT_SUFFIX,
  IDLE_NUDGE,
  SYSTEM,
  WITHHELD_TOOLS,
  buildRoundInjection,
  jsonCapped,
} from './executor-prompt.js';
import {
  deltaSum,
  focusDelta,
  rankCandidates,
  temperatureSpread,
  totalDelta,
  type CandidateProbe,
} from './executor-rank.js';
import { extractMutateFromText, extractToolCallFromText } from './executor-parse.js';

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
  /** Sampling-Temperatur. Mistrals Empfehlung für Devstral: 0.15; aise-Praxis
   * für Graph-/Strukturarbeit lokal: 0.1–0.3 — dämpft die UID-Halluzinations-
   * Klasse (v11: 31 Runden an einem verwechselten uid). */
  temperature: z.number().min(0).max(2).default(0.15),
  /** Best-of-N (CR-GC-288): Kandidaten-Batches pro generate-Runde. 1 = heutiges
   * Verhalten (keine Auswahl im Code, Regression-Kriterium). >1 sammelt N
   * unabhängige Kandidaten (openai via Temperatur-Spread, anthropic via N Calls
   * ohne temperature), probt jeden als Gate-dryRun und wendet nur den Gewinner an.
   * Kosten-Realität: lokal nur Wall-Zeit, bei Frontier ≈ N× Tokens. */
  candidates: z.number().int().min(1).max(8).default(1),
  /** Kandidaten-Richter (CR-GC-288): 'gate' = deterministisches Ranking im Code
   * (tier → Δm auf layer:arch → Element-Ausbeute) — Default, unser Algo zieht.
   * 'model' = die LLM wählt aus den gerenderten Verdicts; BEIDE Picks werden
   * geloggt (algoPicks/modelPicks/judgeDisagreements), angewandt wird der Modell-Pick. */
  judge: z.enum(['gate', 'model']).default('gate'),
  /** Mess-Schalter (CR-GC-293): buildRoundInjection (Guide-Slice + Element-Index,
   * CR-GC-285) für einen einzelnen Lauf abschalten, um ihren isolierten Effekt auf
   * Elementzahl/Turn-Profil zu messen (Nachtrag executor-abschlussbericht.md Punkt 3:
   * "Injektion nützt Frontier, hungert Local aus" war mit CR-284 konfundiert). */
  injection: z.boolean().default(true),
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
  /** Per-Call-Overrides (CR-GC-288): der Temperatur-Spread des Best-of-N-Samplings.
   * Nur das openai-Backend wertet temperature aus — anthropic ignoriert sie
   * (die Claude-5-API lehnt den Parameter ab, s. buildCallModel). */
  opts?: { temperature?: number },
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
  /** Preflight-Eingriffe (CR-GC-284): deterministisch reparierte Commands (Auto-Flip, R-01-Stub). */
  preflightFixed: number;
  /** Preflight-Blocks (CR-GC-284): Batches, die mit lokalem Feedback NICHT ans Gate gingen. */
  preflightBlocked: number;
  /** Best-of-N (CR-GC-288): eingesammelte Kandidaten-Batches (inkl. Repair-Nachlieferungen). */
  candidatesSampled: number;
  /** Runden, in denen der ANGEWANDTE Pick dem deterministischen Algo-Ranking entspricht
   * (judge 'gate' immer; judge 'model' nur bei Einigkeit) — der Vergleichszähler zu modelPicks. */
  algoPicks: number;
  /** judge:'model'-Runden mit Modell-Pick (angewandt wird der Modell-Pick). */
  modelPicks: number;
  /** judge:'model'-Runden, in denen Modell-Pick ≠ Algo-Pick — die Messgröße
   * "Algo- vs. LLM-Judgement" (Disagreement-Rate = judgeDisagreements/modelPicks). */
  judgeDisagreements: number;
  tokensIn: number;
  tokensOut: number;
  tokensReasoning: number;
}

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
// Gate-Feedback — der Kern des Repair-Loops.
// ---------------------------------------------------------------------------

type MutateOutcome = Partial<MutateResult> & {
  success: boolean;
  /** true = der Preflight hat den Batch lokal geblockt — es gab KEINEN Gate-Call (CR-GC-284). */
  preflightBlocked?: boolean;
  /** REQ/UC-Duplikat-Hinweise (CR-GC-287) — reines Feedback, NIE ein Blocker. */
  hints?: string[];
  /** Δm-Messung des Gates (CR-GC-274) — Tiebreaker im Best-of-N-Ranking (CR-GC-288). */
  fitAdvisory?: FitAdvisory;
  /** Readiness-Delta des dryRun-Verdicts (CR-GC-289) — das primäre Ranking-Kriterium nach tier. */
  steeringDelta?: SteeringDelta;
};

/** Kompakte Regel-ID-Liste einer Rejection für die run.log-Trace (CR-GC-286). */
function ruleIdsOf(result: MutateOutcome | null): string {
  return [...new Set((result?.violations ?? []).map((v) => v.ruleId))].join(',');
}

function formatGateFeedback(result: MutateOutcome): string {
  const violations = (result.violations ?? [])
    .slice(0, 8)
    .map(
      (v) =>
        `- ${v.ruleId} [${v.severity}] ${v.message}${v.fixHint ? ' — Fix: ' + v.fixHint : ''}`,
    )
    .join('\n');
  const head = result.preflightBlocked
    ? `Der Batch wurde VOR dem Gate lokal geprüft und NICHT eingereicht (Preflight)` +
      ` — NICHTS wurde persistiert.\n`
    : `Das Gate hat den Batch NICHT übernommen (success:false` +
      `${result.tier ? ', tier=' + result.tier : ''}) — NICHTS wurde persistiert.\n`;
  // CR-GC-287: Duplikat-Hinweise (kein Blocker) fahren im Feedback mit.
  const hints = (result.hints ?? []).map((h) => `- ${h}`).join('\n');
  return (
    head +
    (violations || '- (keine Einzel-Violations — prüfe die Command-Form)') +
    (hints ? '\n' + hints : '') +
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
    preflightFixed: 0,
    preflightBlocked: 0,
    candidatesSampled: 0,
    algoPicks: 0,
    modelPicks: 0,
    judgeDisagreements: 0,
    tokensIn: 0,
    tokensOut: 0,
    tokensReasoning: 0,
  };

  // Graph-Zustand für den Preflight — in-process über die Registry-Tools,
  // deterministisch, pro Mutate frisch (der Graph ändert sich zwischen Runden).
  // CR-GC-287: derselbe Snapshot trägt den Element-Index (uid/type/name/descr)
  // für den REQ/UC-Duplikat-Hinweis — kein zweiter Tool-Call.
  const loadGraphSnapshot = async (): Promise<{ known: PreflightKnown; index: IndexedElement[] }> => {
    const els = (await registry['graph_elements'].handler({ limit: 100_000 })) as {
      nodes?: { uid: string; type: string; name: string; description?: string }[];
    };
    const ver = (await registry['graph_get_edges'].handler({ edgeType: 'verify' })) as {
      edges?: { targetId: string }[];
    };
    const nodes = els.nodes ?? [];
    return {
      known: {
        types: new Map(nodes.map((n) => [n.uid, n.type])),
        verifiedReqs: new Set((ver.edges ?? []).map((e) => e.targetId)),
      },
      index: nodes.map((n) => ({ uid: n.uid, type: n.type, name: n.name, description: n.description })),
    };
  };

  // Input-Parität (CR-GC-286): denselben Zod-Parse wie der MCP-Layer VOR dem
  // Handler-Call. Bei Parse-Fehler geht der Roh-Input an den Handler, dessen
  // identischer Schema-Check das AUDITIERTE INPUT-SCHEMA-Block-Verdict liefert
  // (Zod-Meldung als Violation → formatGateFeedback) — statt eines unauditierten
  // Handler-Throws als generisches 'executor-call'. Der Preflight (CR-GC-284)
  // läuft nur auf schema-validem Input — Batch-Hygiene VOR dem Gate, kein
  // zweites Gate-Urteil; bei jedem Preflight-Fehler geht der Batch unverändert durch.
  const runPreflight = async (
    input: unknown,
  ): Promise<{ effective: unknown; blocked: MutateOutcome | null; hints: string[] }> => {
    const parsed = registry['graph_mutate'].inputSchema.safeParse(input);
    if (!parsed.success) return { effective: input, blocked: null, hints: [] };
    let effective: unknown = parsed.data;
    let hints: string[] = [];
    try {
      const snap = await loadGraphSnapshot();
      const pf = preflightBatch(parsed.data, snap.known);
      if (pf.action === 'blocked') {
        stats.preflightBlocked += 1;
        for (const v of pf.violations) trace(`    preflight blocked: ${v.ruleId} ${v.message}`);
        return {
          effective: parsed.data,
          blocked: { success: false, preflightBlocked: true, violations: pf.violations },
          hints: [],
        };
      }
      if (pf.action === 'fixed') {
        stats.preflightFixed += pf.fixes.length;
        for (const line of pf.fixes) trace(`    preflight: ${line}`);
        effective = pf.input;
      }
      // CR-GC-287: REQ/UC-Duplikat-HINWEIS (kein Block!) — neue add-nodes gegen
      // den Element-Index; der Batch geht trotzdem ans Gate, das Gate entscheidet.
      hints = duplicateHints(effective, snap.index);
      for (const h of hints) trace(`    preflight hint: ${h}`);
    } catch (err) {
      trace(`    preflight error (pass-through): ${err instanceof Error ? err.message : String(err)}`);
    }
    return { effective, blocked: null, hints };
  };

  const callGate = async (input: unknown, hints: string[] = []): Promise<MutateOutcome> => {
    try {
      const result = (await registry['graph_mutate'].handler(input)) as MutateOutcome;
      const out: MutateOutcome = { ...result, success: result.success === true };
      return hints.length > 0 ? { ...out, hints } : out;
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

  const runMutate = async (input: unknown): Promise<MutateOutcome> => {
    const pre = await runPreflight(input);
    if (pre.blocked) return pre.blocked;
    const outcome = await callGate(pre.effective, pre.hints);
    // CR-GC-286-Beobachtbarkeit: bei INPUT-SCHEMA die Top-Level-Form loggen —
    // das Audit speichert bei Schema-Fehlern den Roh-Input nicht (commands:[]),
    // ohne diese Zeile ist "supply exactly one of commands or formatE" nicht
    // diagnostizierbar (beide gesetzt? keins?).
    if (!outcome.success && (outcome.violations ?? []).some((v) => v.ruleId === 'INPUT-SCHEMA')) {
      const keys =
        typeof input === 'object' && input !== null ? Object.keys(input).join(',') : typeof input;
      trace(`    input-schema keys: [${keys}]`);
    }
    return outcome;
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
        return jsonCapped(await tool.handler(input ?? {}));
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

  // -------------------------------------------------------------------------
  // Best-of-N (CR-GC-288): N unabhängige Kandidaten sammeln, jeden als Gate-
  // dryRun proben, deterministisch (oder per Modell-Judge) wählen, NUR den
  // Gewinner anwenden. Aktiv ab candidates>1 — N=1 fährt den unveränderten
  // Ein-Kandidaten-Pfad (Regression-Kriterium: byte-identisches Verhalten).
  // -------------------------------------------------------------------------

  const fmtDelta = (d: number): string => `${d >= 0 ? '+' : ''}${d.toFixed(2)}`;

  /** dryRun-Flag defensiv entfernen — im driver-Modus probt der TREIBER, nicht das Modell. */
  const stripDryRun = (input: unknown): unknown => {
    if (typeof input === 'object' && input !== null && 'dryRun' in (input as Record<string, unknown>)) {
      const { dryRun: _drop, ...rest } = input as Record<string, unknown>;
      return rest;
    }
    return input;
  };

  interface RoundCandidate extends CandidateProbe {
    temperature?: number;
    /** Getrennte Message-History — die Kandidaten sind unabhängig (gleiche Runden-Prompt-Basis). */
    messages: unknown[];
    /** Der eingesammelte Batch (dryRun gestrippt); null = kein Batch geliefert. */
    batch: unknown;
    /** Preflight-Effektiv-Input (Auto-Fixes angewandt) — das, was Probe UND Apply nutzen. */
    effective: unknown;
    verdict: MutateOutcome | null;
  }

  /**
   * Turn-Loop eines Kandidaten bis zum ERSTEN Mutate-Batch — Read-Tools,
   * Idle-Nudge und Prosa-/[ARGS]-Recovery wie im Ein-Kandidaten-Pfad, aber der
   * Batch geht NICHT ans Gate: einsammeln, der Treiber probt und wählt.
   */
  const collectCandidateBatch = async (
    messages: unknown[],
    label: string,
    temperature?: number,
  ): Promise<unknown> => {
    let nudged = false;
    let readTurns = 0;
    for (let turn = 0; turn < config.maxStepTurns; turn++) {
      stats.modelTurns += 1;
      let resp: ModelResponse;
      try {
        resp = await callModel(
          SYSTEM,
          messages,
          tools,
          temperature !== undefined ? { temperature } : undefined,
        );
      } catch (err) {
        trace(`  ${label}: call failed (${(err as Error).message.slice(0, 80)}) — skip`);
        return null;
      }
      stats.tokensIn += resp.usage.in;
      stats.tokensOut += resp.usage.out;
      stats.tokensReasoning += resp.usage.reasoning;
      trace(
        `  ${label}.${turn + 1}: ` +
          (resp.toolCalls.map((c) => c.name.replace('graphcode_', '')).join(',') || '(no calls)'),
      );

      if (resp.toolCalls.length === 0) {
        let recovered: unknown = extractMutateFromText(resp.text);
        if (!recovered) {
          const textCall = extractToolCallFromText(resp.text);
          const canonical = textCall?.name.replace(/^graphcode_/, '');
          if (textCall && canonical === 'graph_mutate') {
            recovered = textCall.input ?? {};
          } else if (textCall && canonical && (READ_TOOLS[textCall.name] || registry[canonical])) {
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
        if (recovered) {
          // Assistant-Text in die History — ein späteres Repair-Feedback (User-
          // Message) braucht die Rollen-Alternierung (Mistral-Jinja, s. pushToolResults).
          messages.push({ role: 'assistant', content: resp.text });
          return stripDryRun(recovered);
        }
        trace(`    idle: ${resp.text.slice(0, 160).replace(/\n/g, ' ')}`);
        if (nudged) return null;
        nudged = true;
        messages.push({ role: 'assistant', content: resp.text || '(leer)' });
        messages.push({ role: 'user', content: IDLE_NUDGE });
        continue;
      }

      messages.push(resp.assistantMsg);
      const results: string[] = [];
      let captured: unknown = null;
      for (const call of resp.toolCalls) {
        if (call.name === 'graphcode_graph_mutate' && captured === null) {
          captured = stripDryRun(call.input);
          results.push(
            JSON.stringify({
              collected: true,
              note: 'Kandidat eingesammelt — der Treiber probt am Gate und wählt (CR-GC-288).',
            }),
          );
        } else {
          results.push(await execReadOrGraphTool(call.name, call.input));
        }
      }
      if (captured === null) readTurns += 1;
      const feedback = captured === null && readTurns >= 2 ? IDLE_NUDGE : undefined;
      pushToolResults(messages, resp.toolCalls, results, feedback);
      if (captured !== null) return captured;
    }
    return null;
  };

  /**
   * Gate-dryRun-Probe eines Kandidaten: Preflight pro Kandidat VOR der Probe
   * (CR-GC-284), dann das volle Verdict (tier/violations/fitAdvisory) ohne
   * Persistenz. dryRun-Proben zählen in stats.dryRunProbes und werden als
   * validate auditiert — NIE als Step-Abschluss gewertet: nur der Gewinner
   * wird danach OHNE dryRun angewandt.
   */
  const probeCandidate = async (c: RoundCandidate): Promise<void> => {
    if (c.batch === null) return;
    const pre = await runPreflight(c.batch);
    if (pre.blocked) {
      c.effective = null;
      c.verdict = pre.blocked;
      return;
    }
    c.effective = pre.effective;
    stats.dryRunProbes += 1;
    const probeInput =
      typeof pre.effective === 'object' && pre.effective !== null
        ? { ...(pre.effective as Record<string, unknown>), dryRun: true }
        : pre.effective;
    c.verdict = await callGate(probeInput);
  };

  /** Ranking-Stufen als Trace (CR-GC-289) — der Pick wird nachvollziehbar. */
  const traceCandidate = (c: RoundCandidate, n: number, focusDimension: string | null): void => {
    if (!c.verdict) {
      trace(`  candidate ${c.index + 1}/${n}: no batch`);
      return;
    }
    const v = c.verdict;
    const tier = v.preflightBlocked ? 'preflight-block' : (v.tier ?? (v.success ? 'suggest' : 'block'));
    trace(
      `  candidate ${c.index + 1}/${n}: tier=${tier} focus(${focusDimension ?? '-'})=${fmtDelta(
        focusDelta(v, focusDimension),
      )} total=${fmtDelta(totalDelta(v))} Δm=${fmtDelta(deltaSum(v))} mutations=${v.mutations ?? 0}`,
    );
  };

  /** judge:'model' — die LLM wählt aus den gerenderten Verdicts; unparsebare Antwort ⇒ null (Algo-Pick). */
  const modelJudgePick = async (
    viable: RoundCandidate[],
    focusDimension: string | null,
  ): Promise<RoundCandidate | null> => {
    const lines = viable.map((c, i) => {
      const v = c.verdict!;
      const viols =
        (v.violations ?? [])
          .slice(0, 3)
          .map((x) => `${x.ruleId}[${x.severity}]`)
          .join(',') || '-';
      return (
        `${i + 1}. tier=${v.tier ?? '?'} focus(${focusDimension ?? '-'})=${fmtDelta(focusDelta(v, focusDimension))} ` +
        `total=${fmtDelta(totalDelta(v))} Δm=${fmtDelta(deltaSum(v))} mutations=${v.mutations ?? 0} violations=${viols}`
      );
    });
    const prompt =
      'Wähle den besten Kandidaten-Batch anhand der Gate-Verdicts (dryRun-Proben):\n' +
      lines.join('\n') +
      `\nAntworte NUR mit der Nummer (1-${viable.length}).`;
    try {
      const resp = await callModel(SYSTEM, [{ role: 'user', content: prompt }], tools);
      stats.modelTurns += 1;
      stats.tokensIn += resp.usage.in;
      stats.tokensOut += resp.usage.out;
      stats.tokensReasoning += resp.usage.reasoning;
      const m = /\d+/.exec(resp.text);
      if (!m) return null;
      const idx = Number(m[0]) - 1;
      return idx >= 0 && idx < viable.length ? viable[idx] : null;
    } catch {
      return null;
    }
  };

  /**
   * Eine Best-of-N-Runde: N Kandidaten sammeln + proben, wählen, Gewinner
   * anwenden. Sind ALLE Kandidaten block, geht das beste Feedback zurück ans
   * Modell (Repair-Loop wie im Ein-Kandidaten-Pfad) — der reparierte Kandidat
   * wird erneut geprobt und neu gerankt.
   */
  const runBestOfNStep = async (baseContent: string, focusDimension: string | null): Promise<void> => {
    const n = config.candidates;
    const temps: (number | undefined)[] =
      config.backend === 'openai' ? temperatureSpread(n) : new Array<undefined>(n).fill(undefined);
    const candidates: RoundCandidate[] = [];
    for (let k = 0; k < n; k++) {
      const c: RoundCandidate = {
        index: k,
        temperature: temps[k],
        messages: [{ role: 'user', content: baseContent }],
        batch: null,
        effective: null,
        verdict: null,
      };
      c.batch = await collectCandidateBatch(c.messages, `cand ${k + 1}/${n}`, c.temperature);
      if (c.batch !== null) stats.candidatesSampled += 1;
      await probeCandidate(c);
      traceCandidate(c, n, focusDimension);
      candidates.push(c);
    }

    let repairs = 0;
    let repairedInStep = false;
    for (;;) {
      const withVerdict = candidates.filter((c) => c.verdict !== null);
      if (withVerdict.length === 0) return; // kein Kandidat lieferte einen Batch — nächste Runde
      const ranked = rankCandidates(withVerdict, focusDimension);
      const viable = ranked.filter((c) => c.verdict!.success === true);

      if (viable.length === 0) {
        // ALLE block (Gate-dryRun oder Preflight): bestes Feedback zurück ans
        // Modell — Repair im Rahmen des Step-Budgets, sonst nächste generate-Runde.
        if (repairs >= config.maxStepTurns) return;
        repairs += 1;
        repairedInStep = true;
        const best = ranked[0];
        trace(
          `    all candidates block [${ruleIdsOf(best.verdict)}] — feeding best feedback back (repair ${repairs}/${config.maxStepTurns})`,
        );
        best.messages.push({ role: 'user', content: formatGateFeedback(best.verdict!) });
        best.batch = await collectCandidateBatch(best.messages, `repair cand ${best.index + 1}`, best.temperature);
        best.effective = null;
        best.verdict = null;
        if (best.batch === null) return;
        stats.candidatesSampled += 1;
        await probeCandidate(best);
        traceCandidate(best, n, focusDimension);
        continue;
      }

      // Auswahl: Algo-Pick = deterministisches Ranking; judge:'model' lässt die
      // LLM wählen, aber BEIDE Picks werden geloggt (messbarer Vergleich).
      const algoPick = viable[0];
      let winner = algoPick;
      if (config.judge === 'model' && viable.length > 1) {
        const modelPick = await modelJudgePick(viable, focusDimension);
        stats.modelPicks += 1;
        if (modelPick !== null && modelPick.index !== algoPick.index) {
          stats.judgeDisagreements += 1;
          winner = modelPick;
        } else {
          stats.algoPicks += 1;
        }
        trace(
          `    pick: algo=${algoPick.index + 1} model=${(modelPick ?? algoPick).index + 1} applied=${winner.index + 1} (judge=model)`,
        );
      } else {
        stats.algoPicks += 1;
        trace(`    pick: candidate ${winner.index + 1} (judge=gate)`);
      }

      // Nur der Gewinner OHNE dryRun — auf dem Preflight-Effektiv-Input, der
      // Preflight lief bereits pro Kandidat (kein Doppel-Zählen der Fixes).
      const outcome = await callGate(winner.effective);
      if (outcome.success) {
        stats.mutatesApplied += 1;
        if (repairedInStep) stats.repairedAfterRejection += 1;
        trace(`    winner applied (${outcome.mutations ?? '?'} mutations)`);
        return;
      }
      // Realer Apply abgelehnt (Verdict-Drift zwischen Probe und Apply — selten):
      // wie eine Gate-Rejection behandeln, Feedback an den Gewinner, Repair.
      stats.mutatesRejected += 1;
      trace(`    winner apply REJECTED [${ruleIdsOf(outcome)}] — feeding violations back`);
      if (repairs >= config.maxStepTurns) return;
      repairs += 1;
      repairedInStep = true;
      winner.messages.push({ role: 'user', content: formatGateFeedback(outcome) });
      winner.batch = await collectCandidateBatch(winner.messages, `repair cand ${winner.index + 1}`, winner.temperature);
      winner.effective = null;
      winner.verdict = null;
      if (winner.batch === null) return;
      stats.candidatesSampled += 1;
      await probeCandidate(winner);
      traceCandidate(winner, n, focusDimension);
    }
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
  // Best-of-N aktiv ⇒ der Treiber macht die Auswahl: graph_generate rendert das
  // driver-Protokoll (kein dryRun-Vergleichs-Auftrag im Prompt, CR-GC-288).
  const bestOfN = config.candidates > 1;
  for (let round = 0; round < config.maxRounds; round++) {
    // Volles Frontier-Rendering auch lokal (CR-GC-282 negativ validiert: das
    // Minimal-Rendering halbierte den Durchsatz — v13b 22 vs. v12 82 Elemente;
    // die Multi-Kandidaten-Instruktion erzeugt die großen verbundenen Batches).
    const genInput: Record<string, unknown> = {};
    if (opts.intent) genInput.intent = opts.intent;
    if (deferred.size > 0) genInput.defer = [...deferred];
    if (bestOfN) genInput.selection = 'driver';
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
    // CR-GC-285: Guide-Slice + Element-Index deterministisch vorab injizieren —
    // ersetzt die redundanten Lese-Turns am Rundenstart, nicht die Lese-Tools.
    const injection = config.injection ? await buildRoundInjection(registry, gen) : '';
    const baseContent = gen.prompt + (injection ? '\n\n' + injection : '') + EMIT_SUFFIX + stagnationHint;
    if (bestOfN) {
      // Best-of-N (CR-GC-288): Sammeln → Proben → Wählen → Gewinner anwenden.
      // Fokus-Dimension aus dem GenerationStep (CR-GC-289): focusKey hat die
      // Form `dimension:ids` — das Ranking bevorzugt Reparatur GENAU dort.
      // Der Turn-Loop darunter bleibt der unveränderte N=1-Pfad.
      await runBestOfNStep(baseContent, gen.focusKey ? gen.focusKey.split(':')[0] : null);
      continue;
    }
    const messages: unknown[] = [{ role: 'user', content: baseContent }];
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
        // Preflight-Blocks zählen NICHT als Gate-Rejection (es gab keinen Gate-Call).
        if (!outcome.preflightBlocked) stats.mutatesRejected += 1;
        rejectedInStep = true;
        messages.push({ role: 'assistant', content: resp.text });
        messages.push({ role: 'user', content: formatGateFeedback(outcome) });
        trace(`    recovered mutate REJECTED [${ruleIdsOf(outcome)}] — feeding gate violations back`);
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
          results.push(jsonCapped(outcome));
          if (outcome.success) {
            stats.mutatesApplied += 1;
            appliedThisTurn = true;
          } else {
            // Preflight-Blocks zählen NICHT als Gate-Rejection (es gab keinen Gate-Call).
            if (!outcome.preflightBlocked) stats.mutatesRejected += 1;
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
        trace(`    gate rejected [${ruleIdsOf(lastRejection)}] — feeding violations back (turn ${turn + 1}/${config.maxStepTurns})`);
      }
      // reine Read-/Explorations-Turns laufen einfach weiter
    }
  }
  return stats;
}
