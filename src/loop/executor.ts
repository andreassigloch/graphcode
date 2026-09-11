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
 * Schnitt entlang der Kette Modellantwort → Parser → Preflight → Gate → Rangfolge
 * (CR-GC-506): Werkzeug-Ausführung in executor-tools.ts, der Gate-Zugang in
 * executor-gate.ts, die Best-of-N-Runde in executor-bestofn.ts; der Modell-Draht
 * (Tool-Angebot, Backends) in executor-backend.ts (CR-GC-507). Hier bleiben
 * Konfiguration, der Antwortvertrag des Treibers und die Treiberschleife.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';
import type { MCPToolRegistry } from '../kernel/tool-contract.js';
import { GenerationStep } from './generate.js';
// Der Antwortvertrag des Backends (CR-GC-426, SCHEMA-model-answer): geprüft am
// Empfang, in der Draht-Form JEDES Backends — nicht erst im Prosa-Parser.
import type { ModelAnswer, ModelToolCall } from './model-answer-contract.js';
// Die drei zustandsfreien Executor-Achsen (CR-GC-320) — Prompt/Injektion,
// Best-of-N-Ranking, Prosa-Recovery. Kein Re-Export von hier: wer sie braucht,
// importiert das jeweilige Modul direkt (keine parallelen Pfade).
import { EMIT_SUFFIX, IDLE_NUDGE, SYSTEM, buildRoundInjection, jsonCapped } from './executor-prompt.js';
import { extractMutateFromText, extractToolCallFromText } from './executor-parse.js';
import { READ_TOOLS, execReadOrGraphTool, pushToolResults } from './executor-tools.js';
import { bindGateClient, formatGateFeedback, ruleIdsOf, type MutateOutcome } from './executor-gate.js';
import { runBestOfNStep } from './executor-bestofn.js';
import { buildCallModel, buildToolSpecs, toBackendTools } from './executor-backend.js';

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
  /** Denk-Budget von Reasoning-Modellen (Qwen3.8: xhigh|medium|low, OpenAI-kompatibel
   * als `reasoning_effort` im Request). Gemessen an qwen3.8-27b@4bit (M4 Pro, 14,8 tok/s):
   * ohne den Schalter denkt das Modell 815 Reasoning-Token pro Call (68 s), mit 'low'
   * noch 175 (25 s) — bei IDENTISCHEM Batch (5/5 Commands). Ohne ihn reißt jeder Call
   * mit gewachsenem Kontext den callTimeoutMs, weil dense-27B ~4× langsamer decodiert
   * als das 35B-A3B-MoE, für das die Defaults dimensioniert waren. Nur gesetzt gesendet:
   * Backends ohne das Feld dürfen den Request nicht mit unbekanntem Feld ablehnen. */
  reasoningEffort: z.enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']).optional(),
});
export type ExecutorConfig = z.infer<typeof ExecutorConfigSchema>;

/**
 * Der Name, unter dem die Treiberschleife den Antwortvertrag führt (CR-GC-426).
 * EIN Typ, zwei Namen — die Form ist `SCHEMA-model-answer` und wird in
 * `model-answer-contract.ts` definiert, nicht hier noch einmal.
 */
export type ModelResponse = ModelAnswer;
export type { ModelToolCall };

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

  // Der Gate-Zugang (executor-gate.ts): Parse → Preflight → graph_mutate → Feedback.
  // Ein-Kandidaten-Pfad und Best-of-N-Runde teilen ihn — es gibt EINE Sendestelle.
  const gate = bindGateClient(registry, stats, trace);
  // Best-of-N (CR-GC-288, executor-bestofn.ts): derselbe Lauf-Zustand wie unten.
  const bestOfNContext = { registry, workspaceDir, config, callModel, tools, stats, trace, gate };
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
    // Die Tool-Registry liefert `unknown` — bis hierher stand hier ein blanker
    // `as GenerationStep`. Damit lief eine kaputte oder gewanderte Tool-Antwort
    // still weiter: `gen.phase`/`gen.focusKey` wären `undefined`, die
    // Stagnations- und Defer-Logik hätte auf Nichts gesteuert. `parse` bricht
    // laut ab — der Vertrag SCHEMA-generation-step gilt an genau dieser Grenze.
    const gen = GenerationStep.parse(await registry['graph_generate'].handler(genInput));
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
      await runBestOfNStep(bestOfNContext, baseContent, gen.focusKey ? gen.focusKey.split(':')[0] : null);
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
          (resp.toolCalls.map((c) => c.name.replace('graphcode_', '')).join(',') ||
            // CR-GC-426: OHNE den Stop-Grund sieht eine am Token-Budget abgeschnittene
            // Antwort genauso aus wie eine geschwaetzige — beide "(no calls)". Der
            // Salvage-Pfad unten existiert nur fuer die erste; die Spur muss sie trennen.
            `(no calls, stop=${resp.stopReason ?? 'unbekannt'})`),
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
            const result = await execReadOrGraphTool(registry, workspaceDir, toolName, textCall.input);
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
        const outcome = await gate.runMutate(recovered);
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
            results.push(await execReadOrGraphTool(registry, workspaceDir, call.name, call.input));
            continue;
          }
          const outcome = await gate.runMutate(call.input);
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
          results.push(await execReadOrGraphTool(registry, workspaceDir, call.name, call.input));
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
      pushToolResults(config.backend, messages, resp.toolCalls, results, feedback);
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