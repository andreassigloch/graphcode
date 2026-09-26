/**
 * executor-gate.ts — der Gate-Zugang des eingebetteten Executors (CR-GC-506,
 * geschnitten aus executor.ts).
 *
 * Die Kette zwischen Modellantwort und Apply-Gate: derselbe Zod-Parse wie der
 * MCP-Layer (CR-GC-286), der Preflight (CR-GC-284) mit Duplikat-Hinweis
 * (CR-GC-287), der Aufruf von `graph_mutate` über die Registry und das kompakte
 * Feedback einer Rejection für den Repair-Loop. Hier legt der Executor fest, was
 * ans Gate geht (der Preflight-korrigierte Batch, bei der Probe mit `dryRun`), und
 * schickt es ab. Der Ein-Kandidaten-Pfad (executor.ts) und die Best-of-N-Runde
 * (executor-bestofn.ts) teilen diesen einen Zugang.
 *
 * @author andreas@siglochconsulting
 */
import type { MutateResult } from '@sigloch/contracts/harness';
import type { FitAdvisory } from '../kernel/measure/fit-advisory.js';
import type { SteeringDelta } from '../kernel/measure/steering-snapshot.js';
import type { MCPToolRegistry } from '../kernel/tool-contract.js';
import {
  duplicateHits,
  renderDuplicateHints,
  type DuplicateHit,
  type IndexedElement,
} from '../kernel/measure/nd-similarity.js';
import type { Graph } from '@sigloch/graph-api-core';
import { preflightBatch, type PreflightKnown } from './preflight.js';
import { formatEToCommands } from './format-e-commands.js';
import { takeQuestionsFromInput } from './executor-parse.js';

export type MutateOutcome = Partial<MutateResult> & {
  success: boolean;
  /** true = der Preflight hat den Batch lokal geblockt — es gab KEINEN Gate-Call (CR-GC-284). */
  preflightBlocked?: boolean;
  /** REQ/UC-Duplikat-Hinweise (CR-GC-287) — reines Feedback, NIE ein Blocker. */
  hints?: string[];
  /** Δm-Messung des Gates (CR-GC-274) — Tiebreaker im Best-of-N-Ranking (CR-GC-288). */
  fitAdvisory?: FitAdvisory;
  /** Readiness-Delta des dryRun-Verdicts (CR-GC-289) — das primäre Ranking-Kriterium nach tier. */
  steeringDelta?: SteeringDelta;
  /** CR-GC-667: der Batch bestand nur aus Fragezeilen — kein Gate-Call, keine Abweisung. */
  questionOnly?: boolean;
};

/** Kompakte Regel-ID-Liste einer Rejection für die run.log-Trace (CR-GC-286). */
export function ruleIdsOf(result: MutateOutcome | null): string {
  return [...new Set((result?.violations ?? []).map((v) => v.ruleId))].join(',');
}

/** Das Rejection-Feedback ans Modell — der Kern des Repair-Loops. */
export function formatGateFeedback(result: MutateOutcome): string {
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

/** Die Zähler, die der Gate-Zugang fortschreibt (ein Ausschnitt der ExecutorStats). */
export interface GateCounters {
  preflightFixed: number;
  preflightBlocked: number;
  /** CR-GC-667: die Fragen des Laufs an den Auftraggeber, je Wortlaut einmal. */
  questions: string[];
}

/** Fragen in die Laufliste; zurueck kommen nur die neuen — eine wiederholte Frage ist keine zweite. */
export function recordQuestions(stats: Pick<GateCounters, 'questions'>, questions: readonly string[]): string[] {
  const neu = [...new Set(questions)].filter((q) => !stats.questions.includes(q));
  stats.questions.push(...neu);
  return neu;
}

/** Ergebnis des Preflights: der Batch, der weitergeht, oder das lokale Block-Verdict. */
export interface PreflightResult {
  effective: unknown;
  blocked: MutateOutcome | null;
  hints: string[];
  duplicates: DuplicateHit[];
}

export interface GateClient {
  /** Parse + Preflight + Duplikat-Hinweis; kein Gate-Call. */
  runPreflight(input: unknown): Promise<PreflightResult>;
  /** Der eine Aufruf von graph_mutate; ein Handler-Throw wird zum Verdict 'executor-call'. */
  callGate(input: unknown, hints?: string[]): Promise<MutateOutcome>;
  /** Preflight, dann Gate — der Ein-Kandidaten-Pfad. */
  runMutate(input: unknown): Promise<MutateOutcome>;
}

export function bindGateClient(
  registry: MCPToolRegistry,
  stats: GateCounters,
  trace: (line: string) => void,
): GateClient {
  // Graph-Zustand für den Preflight — in-process über die Registry-Tools,
  // deterministisch, pro Mutate frisch (der Graph ändert sich zwischen Runden).
  // CR-GC-287: derselbe Snapshot trägt den Element-Index (uid/type/name/descr)
  // für den REQ/UC-Duplikat-Hinweis — kein zweiter Tool-Call.
  const loadGraphSnapshot = async (): Promise<{ known: PreflightKnown; index: IndexedElement[]; bestand: Graph }> => {
    // CR-GC-621: `prosa: true` ist hier PFLICHT, nicht Bequemlichkeit — `duplicateHits` vergleicht
    // Beschreibungen. Mit der gekuerzten Liste saehen alle Knoten gleich aus und die Duplikat-
    // Erkennung waere still blind; der Default der Liste ist Identitaet, dieser Verbraucher ist
    // der eine, der den Text selbst auswertet.
    const els = (await registry['graph_elements'].handler({ limit: 100_000, prosa: true })) as {
      nodes?: { uid: string; type: string; name: string; description?: string; attributes?: Record<string, unknown> }[];
    };
    const ver = (await registry['graph_get_edges'].handler({ edgeType: 'verify' })) as {
      edges?: { targetId: string }[];
    };
    const nodes = els.nodes ?? [];
    return {
      known: {
        types: new Map(nodes.map((n) => [n.uid, n.type])),
        verifiedReqs: new Set((ver.edges ?? []).map((e) => e.targetId)),
        // satisfy-`where` (contracts 9.x): der Preflight braucht die deklarierten kinds.
        kinds: new Map(nodes.map((n) => [n.uid, n.attributes?.kinds])),
      },
      index: nodes.map((n) => ({ uid: n.uid, type: n.type, name: n.name, description: n.description })),
      // CR-GC-650: der Format-E-Leser braucht vom Bestand nur uid und Typ (Typauflösung,
      // Implicit-Add-Ablehnung) — derselbe Snapshot, kein zweiter Aufruf.
      bestand: { nodes: nodes.map((n) => ({ uid: n.uid, type: n.type })), edges: [] } as unknown as Graph,
    };
  };

  // Input-Parität (CR-GC-286): denselben Zod-Parse wie der MCP-Layer VOR dem
  // Handler-Call. Bei Parse-Fehler geht der Roh-Input an den Handler, dessen
  // identischer Schema-Check das AUDITIERTE INPUT-SCHEMA-Block-Verdict liefert
  // (Zod-Meldung als Violation → formatGateFeedback) — statt eines unauditierten
  // Handler-Throws als generisches 'executor-call'. Der Preflight (CR-GC-284)
  // läuft nur auf schema-validem Input — Batch-Hygiene VOR dem Gate, kein
  // zweites Gate-Urteil; bei jedem Preflight-Fehler geht der Batch unverändert durch.
  const runPreflight = async (roh: unknown): Promise<PreflightResult> => {
    // CR-GC-667: Fragezeilen verlassen den Batch hier, an der einen Stelle, die beide Pfade
    // (Ein-Kandidat und Best-of-N) passieren. Der Codec sieht sie nie.
    const { input, questions } = takeQuestionsFromInput(roh);
    for (const q of recordQuestions(stats, questions)) trace(`    frage: ${q}`);
    const nurFragen =
      questions.length > 0 &&
      !(input as { commands?: unknown }).commands &&
      !String((input as { formatE?: unknown }).formatE ?? '').trim();
    if (nurFragen) return { effective: input, blocked: { success: false, questionOnly: true }, hints: [], duplicates: [] };
    const parsed = registry['graph_mutate'].inputSchema.safeParse(input);
    if (!parsed.success) return { effective: input, blocked: null, hints: [], duplicates: [] };
    let effective: unknown = parsed.data;
    let hints: string[] = [];
    let duplicates: DuplicateHit[] = [];
    try {
      const snap = await loadGraphSnapshot();
      // CR-GC-650: der Executor emittiert Format-E. Der Preflight prüft Commands — also erst mit
      // der EINEN Abbildung übersetzen (dieselbe, die graph_mutate fährt). Ein Parse-Fehler ist
      // kein Preflight-Urteil: der Text geht unverändert ans Gate, dessen Meldung auditiert ist.
      const data = parsed.data as { formatE?: string; commands?: unknown[] };
      let alsCommands: { commands: unknown[] } = data as { commands: unknown[] };
      if (typeof data.formatE === 'string') {
        try {
          alsCommands = { commands: formatEToCommands(snap.bestand, data.formatE).commands };
        } catch {
          return { effective: parsed.data, blocked: null, hints: [], duplicates: [] };
        }
      }
      const pf = preflightBatch(alsCommands, snap.known);
      if (pf.action === 'blocked') {
        stats.preflightBlocked += 1;
        for (const v of pf.violations) trace(`    preflight blocked: ${v.ruleId} ${v.message}`);
        return {
          effective: parsed.data,
          blocked: { success: false, preflightBlocked: true, violations: pf.violations },
          hints: [],
          duplicates: [],
        };
      }
      if (pf.action === 'fixed') {
        stats.preflightFixed += pf.fixes.length;
        for (const line of pf.fixes) trace(`    preflight: ${line}`);
        // Repariert heisst: die reparierten Commands gehen, nicht der Originaltext. Ohne
        // Reparatur bleibt der Text (unten) — er traegt die Namenswarnung des Gates mit.
        const rest: Record<string, unknown> = { ...(parsed.data as Record<string, unknown>) };
        delete rest.formatE;
        effective = { ...rest, commands: (pf.input as { commands: unknown[] }).commands };
      }
      // CR-GC-287: REQ/UC-Duplikat-HINWEIS (kein Block!) — neue add-nodes gegen
      // den Element-Index; der Batch geht trotzdem ans Gate, das Gate entscheidet.
      // CR-GC-361: EINE Messung, zwei Konsumenten — die Zeilen gehen als Feedback
      // ans Modell, die Treffer als bereinigter Fokus-Delta ins Best-of-N-Ranking.
      duplicates = duplicateHits(pf.action === 'fixed' ? effective : alsCommands, snap.index);
      hints = renderDuplicateHints(duplicates);
      for (const h of hints) trace(`    preflight hint: ${h}`);
    } catch (err) {
      trace(`    preflight error (pass-through): ${err instanceof Error ? err.message : String(err)}`);
    }
    return { effective, blocked: null, hints, duplicates };
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

  return { runPreflight, callGate, runMutate };
}
