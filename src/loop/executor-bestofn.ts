/**
 * executor-bestofn.ts — die Best-of-N-Runde des eingebetteten Executors
 * (CR-GC-288; geschnitten aus executor.ts in CR-GC-506).
 *
 * N unabhängige Kandidaten sammeln, jeden als Gate-dryRun proben, deterministisch
 * (oder per Modell-Judge) wählen, NUR den Gewinner anwenden. Aktiv ab candidates>1
 * — N=1 fährt den unveränderten Ein-Kandidaten-Pfad in executor.ts (Regression-
 * Kriterium: byte-identisches Verhalten). Die Rangfolge rechnet executor-rank.ts;
 * Probe und Apply laufen durch den Gate-Zugang (executor-gate.ts).
 *
 * @author andreas@siglochconsulting
 */
import type { DuplicateHit } from '../kernel/measure/nd-similarity.js';
import type { MCPToolRegistry } from '../kernel/tool-contract.js';
import { IDLE_NUDGE, SYSTEM } from './executor-prompt.js';
import {
  deltaSum,
  steerImprovement,
  focusDelta,
  rankCandidates,
  effectiveFocusDelta,
  temperatureSpread,
  totalDelta,
  type CandidateProbe,
} from './executor-rank.js';
import { extractMutateFromText, extractToolCallFromText } from './executor-parse.js';
import { READ_TOOLS, execReadOrGraphTool, pushToolResults } from './executor-tools.js';
import { formatGateFeedback, ruleIdsOf, type GateClient, type MutateOutcome } from './executor-gate.js';
import type { CallModel, ExecutorConfig, ExecutorStats, ModelResponse } from './executor.js';

/** Was eine Runde vom Treiber bekommt — derselbe Lauf-Zustand wie der Ein-Kandidaten-Pfad. */
export interface BestOfNContext {
  registry: MCPToolRegistry;
  workspaceDir: string;
  config: ExecutorConfig;
  callModel: CallModel;
  tools: unknown[];
  stats: ExecutorStats;
  trace: (line: string) => void;
  gate: GateClient;
}

interface RoundCandidate extends CandidateProbe {
  temperature?: number;
  /** Getrennte Message-History — die Kandidaten sind unabhängig (gleiche Runden-Prompt-Basis). */
  messages: unknown[];
  /** Der eingesammelte Batch (dryRun gestrippt); null = kein Batch geliefert. */
  batch: unknown;
  /** Preflight-Effektiv-Input (Auto-Fixes angewandt) — das, was Probe UND Apply nutzen. */
  effective: unknown;
  verdict: MutateOutcome | null;
  /** REQ/UC-Beinahe-Duplikate dieses Batches (CR-GC-361) — bereinigt den Fokus-Delta. */
  duplicates: DuplicateHit[];
}

const fmtDelta = (d: number): string => `${d >= 0 ? '+' : ''}${d.toFixed(2)}`;

/** dryRun-Flag defensiv entfernen — im driver-Modus probt der TREIBER, nicht das Modell. */
const stripDryRun = (input: unknown): unknown => {
  if (typeof input === 'object' && input !== null && 'dryRun' in (input as Record<string, unknown>)) {
    const { dryRun: _drop, ...rest } = input as Record<string, unknown>;
    return rest;
  }
  return input;
};

/**
 * Turn-Loop eines Kandidaten bis zum ERSTEN Mutate-Batch — Read-Tools,
 * Idle-Nudge und Prosa-/[ARGS]-Recovery wie im Ein-Kandidaten-Pfad, aber der
 * Batch geht NICHT ans Gate: einsammeln, der Treiber probt und wählt.
 */
async function collectCandidateBatch(
  ctx: BestOfNContext,
  messages: unknown[],
  label: string,
  temperature?: number,
): Promise<unknown> {
  const { registry, workspaceDir, config, callModel, tools, stats, trace } = ctx;
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
        (resp.toolCalls.map((c) => c.name.replace('graphcode_', '')).join(',') ||
          // CR-GC-426: OHNE den Stop-Grund sieht eine am Token-Budget abgeschnittene
          // Antwort genauso aus wie eine geschwaetzige — beide "(no calls)". Der
          // Salvage-Pfad unten existiert nur fuer die erste; die Spur muss sie trennen.
          `(no calls, stop=${resp.stopReason ?? 'unbekannt'})`),
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
        results.push(await execReadOrGraphTool(registry, workspaceDir, call.name, call.input));
      }
    }
    if (captured === null) readTurns += 1;
    const feedback = captured === null && readTurns >= 2 ? IDLE_NUDGE : undefined;
    pushToolResults(config.backend, messages, resp.toolCalls, results, feedback);
    if (captured !== null) return captured;
  }
  return null;
}

/**
 * Gate-dryRun-Probe eines Kandidaten: Preflight pro Kandidat VOR der Probe
 * (CR-GC-284), dann das volle Verdict (tier/violations/fitAdvisory) ohne
 * Persistenz. dryRun-Proben zählen in stats.dryRunProbes und werden als
 * validate auditiert — NIE als Step-Abschluss gewertet: nur der Gewinner
 * wird danach OHNE dryRun angewandt.
 */
async function probeCandidate(ctx: BestOfNContext, c: RoundCandidate): Promise<void> {
  if (c.batch === null) return;
  const pre = await ctx.gate.runPreflight(c.batch);
  c.duplicates = pre.duplicates;
  if (pre.blocked) {
    c.effective = null;
    c.verdict = pre.blocked;
    return;
  }
  c.effective = pre.effective;
  ctx.stats.dryRunProbes += 1;
  const probeInput =
    typeof pre.effective === 'object' && pre.effective !== null
      ? { ...(pre.effective as Record<string, unknown>), dryRun: true }
      : pre.effective;
  c.verdict = await ctx.gate.callGate(probeInput);
}

/** Ranking-Stufen als Trace (CR-GC-289) — der Pick wird nachvollziehbar. */
function traceCandidate(
  trace: (line: string) => void,
  c: RoundCandidate,
  n: number,
  focusDimension: string | null,
): void {
  if (!c.verdict) {
    trace(`  candidate ${c.index + 1}/${n}: no batch`);
    return;
  }
  const v = c.verdict;
  const tier = v.preflightBlocked ? 'preflight-block' : (v.tier ?? (v.success ? 'suggest' : 'block'));
  // CR-GC-361: bei Duplikaten BEIDE Zahlen — der rohe Fokus-Delta und der
  // bereinigte, nach dem wirklich gerankt wird. Sonst ist ein Pick, der am
  // bereinigten Wert kippt, aus der Trace nicht nachvollziehbar.
  const dupes = c.duplicates.length;
  const eff = effectiveFocusDelta(c, focusDimension);
  trace(
    `  candidate ${c.index + 1}/${n}: tier=${tier} focus(${focusDimension ?? '-'})=${fmtDelta(
      focusDelta(v, focusDimension),
    )}${dupes > 0 ? ` dupes=${dupes} eff=${fmtDelta(eff)}` : ''}` +
      ` total=${fmtDelta(totalDelta(v))} steer=${fmtDelta(steerImprovement(v))} Δm=${fmtDelta(deltaSum(v))} mutations=${v.mutations ?? 0}`,
  );
}

/** judge:'model' — die LLM wählt aus den gerenderten Verdicts; unparsebare Antwort ⇒ null (Algo-Pick). */
async function modelJudgePick(
  ctx: BestOfNContext,
  viable: RoundCandidate[],
  focusDimension: string | null,
): Promise<RoundCandidate | null> {
  const { callModel, tools, stats } = ctx;
  const lines = viable.map((c, i) => {
    const v = c.verdict!;
    const viols =
      (v.violations ?? [])
        .slice(0, 3)
        .map((x) => `${x.ruleId}[${x.severity}]`)
        .join(',') || '-';
    return (
      `${i + 1}. tier=${v.tier ?? '?'} focus(${focusDimension ?? '-'})=${fmtDelta(focusDelta(v, focusDimension))} ` +
      `total=${fmtDelta(totalDelta(v))} steer=${fmtDelta(steerImprovement(v))} Δm=${fmtDelta(deltaSum(v))} mutations=${v.mutations ?? 0} violations=${viols}`
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
}

/**
 * Eine Best-of-N-Runde: N Kandidaten sammeln + proben, wählen, Gewinner
 * anwenden. Sind ALLE Kandidaten block, geht das beste Feedback zurück ans
 * Modell (Repair-Loop wie im Ein-Kandidaten-Pfad) — der reparierte Kandidat
 * wird erneut geprobt und neu gerankt.
 */
export async function runBestOfNStep(
  ctx: BestOfNContext,
  baseContent: string,
  focusDimension: string | null,
): Promise<void> {
  const { config, stats, trace, gate } = ctx;
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
      duplicates: [],
    };
    c.batch = await collectCandidateBatch(ctx, c.messages, `cand ${k + 1}/${n}`, c.temperature);
    if (c.batch !== null) stats.candidatesSampled += 1;
    await probeCandidate(ctx, c);
    traceCandidate(trace, c, n, focusDimension);
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
      best.batch = await collectCandidateBatch(ctx, best.messages, `repair cand ${best.index + 1}`, best.temperature);
      best.effective = null;
      best.verdict = null;
      if (best.batch === null) return;
      stats.candidatesSampled += 1;
      await probeCandidate(ctx, best);
      traceCandidate(trace, best, n, focusDimension);
      continue;
    }

    // Auswahl: Algo-Pick = deterministisches Ranking; judge:'model' lässt die
    // LLM wählen, aber BEIDE Picks werden geloggt (messbarer Vergleich).
    const algoPick = viable[0];
    let winner = algoPick;
    if (config.judge === 'model' && viable.length > 1) {
      const modelPick = await modelJudgePick(ctx, viable, focusDimension);
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
    const outcome = await gate.callGate(winner.effective);
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
    winner.batch = await collectCandidateBatch(ctx, winner.messages, `repair cand ${winner.index + 1}`, winner.temperature);
    winner.effective = null;
    winner.verdict = null;
    if (winner.batch === null) return;
    stats.candidatesSampled += 1;
    await probeCandidate(ctx, winner);
    traceCandidate(trace, winner, n, focusDimension);
  }
}
