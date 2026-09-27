/**
 * tools/write.ts — the gated WRITE tools (MOD-mcp-tools, CR-GC-256).
 *
 * graph_mutate / graph_merge / graph_reseed. Every one of them
 * delegates to `harness.mutate()` (L2 gate symmetry — no bypass, no second write
 * path) and runs inside `ctx.serializeToolWrite()`, so the OCC check, the gate
 * apply and the audit record stay one atomic unit against other tool writes.
 *
 * @author andreas@siglochconsulting
 */

import { z } from 'zod/v4';
import { isAbsolute, join } from 'node:path';
import type { MutateCommand, MutateResult, RuleViolation } from '@sigloch/contracts/harness';
import { GraphVersionSchema } from '@sigloch/contracts/harness';
import { readBranchLog, replayBranchLog, type MergeReport } from '../kernel/merge.js';
import type { MCPTool, MCPToolRegistry } from '../kernel/tool-contract.js';
import { computeSteeringDelta, measureSteering, type SteeringDelta } from '../kernel/measure/steering-snapshot.js';
import { stripViolationContext, groupViolationsByRule, type GroupedViolation } from '../kernel/evaluation.js';
import { fitAdvisoryIsSilent, steerAdvisoryIsSilent, type FitAdvisory, type SteerAdvisory } from '../kernel/measure/fit-advisory.js';
import { workOrderIsSilent, type WorkOrder } from '../kernel/measure/work-order.js';
import { loadTargetProfile } from '../loop/target-profile.js';
import { nextStepAfterApply, type NextStep } from '../loop/next-step.js';
import { focusMemoryOf } from '../loop/stagnation.js';
import type { RespondsToViolation } from '../projections/trajectory.js';
import type { ToolContext } from './tool-context.js';
import { formatEToCommands } from '../loop/format-e-commands.js';

// -------------------------------------------------------------------------
// respondsTo (CR-GC-434) — which pre-existing violation a mutation ANSWERED.
// -------------------------------------------------------------------------

/** Identity a violation keeps across a mutation: rule + element. */
const violationIdentity = (v: RuleViolation): string => `${v.ruleId}|${v.elementId ?? ''}`;

/**
 * The gate violations (error/warning) present BEFORE a mutation and gone AFTER it —
 * a measured before/after delta over `harness.evaluateRules()`, never an inference
 * from hints or prompts. `info` findings are excluded: they are per-element
 * confirmations (VR-01), and "answered an info" is noise, not an episode. [] means
 * DETERMINED: this mutation closed nothing (the CR-GC-434 explicit empty).
 */
export function resolvedViolations(before: RuleViolation[], after: RuleViolation[]): RespondsToViolation[] {
  const remaining = new Set(after.map(violationIdentity));
  const seen = new Set<string>();
  const out: RespondsToViolation[] = [];
  for (const v of before) {
    if (v.severity !== 'error' && v.severity !== 'warning') continue;
    const key = violationIdentity(v);
    if (remaining.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({ ruleId: v.ruleId, ...(v.elementId ? { elementId: v.elementId } : {}) });
  }
  return out;
}

// -------------------------------------------------------------------------
// Input schemas
// -------------------------------------------------------------------------

/**
 * OCC base version: the graphVersion the writer READ before composing this write.
 * Uses the promoted contracts schema (CR-GC-243): `GraphVersionSchema` from
 * `@sigloch/contracts/harness` (sigloch-modules CR-199/CR-200 adopted CR-GC-233's
 * shape) — no local parallel schema.
 */
const baseVersionField = GraphVersionSchema.optional().describe(
  'Optimistic concurrency (CR-GC-233): the graphVersion your last read returned. ' +
    'If the graph moved since (baseVersion < current graphVersion) the write is REJECTED ' +
    'with the staleDelta (applied batches since baseVersion) — re-read, adapt, retry. ' +
    'Omitting it skips the check (warning only; lost-update window).',
);

const GraphMutateInputSchema = z
  .object({
    // commands is validated by harness.mutate() via MutateCommandSchema internally.
    // We accept any array here to avoid cross-Zod-version schema composition issues (D1).
    commands: z.array(z.unknown()).min(1).optional(),
    formatE: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Token-leane Alternative zu commands (CR-GC-276): ein Format-E-v2-Block (dasselbe Dialekt wie ' +
          'die Read-Slices) wird zu Mutations-Kommandos decodiert und läuft durch DASSELBE Gate. ' +
          'Bevorzugt für LLM-Autoring (~2–3× weniger Tokens); upsert-Semantik. ' +
          'OPERATIONEN (CR-GC-627): Format-E ist eine Operationssprache, nicht nur ein Graph-Format — ' +
          'das Präfix entscheidet. `+` legt an (add-node/add-edge), `-` löscht (delete-node/delete-edge), ' +
          '`~` ändert einen Knoten als PATCH (update-node: nur was die Zeile nennt), und `M` ist ' +
          'die Merge-Zeile unter "## Merges": `M quelle + ziel` lässt das ZIEL die QUELLE aufnehmen ' +
          '(merge-nodes, genau zwei uids). Ein Löschzug nennt einen Knoten, den es gibt. ' +
          'Dieselbe uid in EINEM Block zu löschen und zu schreiben ' +
          'wird abgelehnt — die Persistenz schreibt Deletes zuletzt. EINZIGE Ausnahme: `update-edge` ' +
          '(Typwechsel/Flip einer bestehenden Kante) hat kein Präfix und braucht weiterhin commands. ' +
          'Kanten zwischen BESTEHENDEN Knoten brauchen keine ' +
          '`### <TYPE>`-Sektion (CR-GC-310) — der Typ kommt aus dem Store; ein reiner Kanten-Batch ist ' +
          '"## Edges" + Zeilen der Form "+ A -verify-> B". Eine unbekannte uid bleibt ein Fehler. '
          + 'FAN-OUT (CR-GC-625): die Zielseite ist eine LISTE — "+ A -verify-> B, C, D" schreibt drei '
          + 'Kanten. Ein Inline-Attributblock der Zeile gilt fuer ALLE ihre Ziele; Kanten mit eigenem '
          + 'cardinality/constraint/notes bleiben deshalb einzeln. ' +
          'NAME (CR-GC-321): `+ uid|text` hat nur ZWEI positionale Felder — uid und BESCHREIBUNG. ' +
          'Der Name reist als Attribut `__name`: inline `+ REQ-x|Beschreibung [__name:Lesbarer Name]`, ' +
          'oder als Folgezeile `@__name Lesbarer Name` wenn der Name Komma oder eckige Klammer enthält. ' +
          'OHNE `__name` wird die uid zum Namen (kein Fehler, aber jede Sicht zeigt dann "REQ-x" ' +
          'statt des Namens) — das Ergebnis meldet die betroffenen uids als `nameWarning`.',
      ),
    dryRun: z
      .boolean()
      .default(false)
      .describe(
        'true = volles Gate-Verdict (tier/violations/fitAdvisory), NICHTS persistiert (CR-GC-234); ' +
          'der Preview wird als validate-Eintrag auditiert (Vorschlag→Verdict, F2-Evidenz), die ' +
          'graphVersion bewegt sich nicht.',
      ),
    consumerId: z.string().default('mcp-client'),
    baseVersion: baseVersionField,
    violations: z
      .enum(['summary', 'full'])
      .default('summary')
      .describe(
        'Detailtiefe der zurückgegebenen Violations (CR-GC-309). summary (Default) trägt ruleId, ' +
          'severity, message, fixHint und die betroffenen Elemente — alles, was zum Reparieren des ' +
          'Batches nötig ist; es entfällt `context` (und damit candidate_targets), das den Löwenanteil ' +
          'der Bytes ausmacht. ' +
          'FORM (CR-GC-570): summary liefert EINEN Eintrag je (Regel, Meldungsmuster) mit ' +
          '`elements: [uid, …]` statt einen je Element, und `{el}` steht in message/fixHint an der ' +
          'Stelle der uid — je Element einmal einzusetzen. Das ist eine Faktorisierung, keine Kürzung: ' +
          'kein Befund fällt weg, auch kein blockierender, und die Originalmeldung ist wieder ' +
          'herstellbar. Gemessen −64 % Antwortbytes, weil sich der Befundkörper sonst je Element ' +
          'wortgleich wiederholt. ' +
          'full liefert das ungekürzte Ergebnis mit einem Eintrag je Element. Wer candidate_targets ' +
          'braucht, fragt gezielt rules_get_violations / rules_evaluate — die bleiben auf voller Tiefe.',
      ),
  })
  .refine((i) => (i.commands === undefined) !== (i.formatE === undefined), {
    message: 'graph_mutate: supply exactly one of commands or formatE.',
  });

/**
 * Violations ohne `context` (CR-GC-309).
 *
 * `context` trägt `candidate_targets`/`existing_traces` — die Fix-Automations-Daten,
 * die den Löwenanteil der Antwortbytes ausmachen (im Feldtest 39 Kandidaten in EINER
 * Antwort, zwei Antworten über 60 KB, zusammen 20 % aller Tool-Ergebnisse). Für das
 * Reparieren eines Batches braucht der Autor sie nicht — `fixHint` sagt, WAS zu tun
 * ist, `elementId` sagt WO. Wer die Kandidatenliste wirklich braucht, fragt
 * `rules_get_violations`; das ist Query-Precision, nicht Result-Kompression.
 *
 * `fixHint` bleibt zwingend erhalten: der eingebettete Executor rendert ihn in
 * `formatGateFeedback` — ihn wegzukürzen machte aus einer reparierbaren Violation
 * eine undurchsichtige.
 */
function summarizeViolations<T extends { violations: MutateResult['violations'] }>(
  result: T,
): Omit<T, 'violations'> & { violations: GroupedViolation[] } {
  // CR-GC-398: EINE Implementierung der Projektion, geteilt mit rules_evaluate /
  // rules_get_violations — sonst entsteht sie dreimal leicht verschieden.
  // CR-GC-570: danach je Regel und Meldungsmuster falten statt je Element —
  // gemessen −64 % auf demselben Befundinhalt, weil in allen 487 Befunden des
  // Referenzlaufs die elementId IM Meldungstext stand und der Rest sich wortgleich
  // wiederholte. Eine Faktorisierung, keine Kürzung: kein Befund faellt weg, auch
  // kein blockierender.
  return {
    ...result,
    violations: groupViolationsByRule(stripViolationContext(result.violations)),
  };
}

/**
 * Advisory-Bloecke, die nichts melden, weglassen (CR-GC-576).
 *
 * Gemessen an `runs/opus5-5`, 23 Gate-Antworten: `fitAdvisory` war 12-mal von 21 leer,
 * `workOrder` 18-mal von 21, und `steerAdvisory` **21-mal von 21** — durchgehend. Zusammen
 * 11.990 Zeichen, die sagen, dass nichts passiert ist.
 *
 * WEGLASSEN, nicht kuerzen: „kein Feld" und „Feld mit lauter Nullen" sagen dasselbe, und wer
 * doch das Null-Delta braucht, liest es aus `graph_metrics` oder `graph_readiness`. Der
 * Unterschied ist, dass die Aussage „hier hat sich nichts geruehrt" dann null Zeichen kostet.
 *
 * Nur auf der LEITUNG, nie im Audit: `recordAudit`/`recordPreview` bekommen die volle
 * Fassung, denn der Trail ist Evidenz und kein Antwort-Budget — dieselbe Trennung, die
 * CR-GC-309 fuer die Violations gezogen hat.
 *
 * Was „nichts melden" heisst, steht je Block bei seinem ERZEUGER (`fitAdvisoryIsSilent`,
 * `steerAdvisoryIsSilent`, `workOrderIsSilent`) und nicht hier — hier wird nur angewandt.
 */
/**
 * Zielprofil heisst GEWICHTE, nicht Datei (CR-GC-590, Befund aus dem Phase-1-Lauf): graph_generate
 * legt die Intent-Anker in dieselbe Datei — danach "gab es ein Profil", und der R6 kam 9-mal
 * ohne eine einzige Richtung. Dieselbe Frage wie `hasWeights` im Handoff-Prompt.
 */
function hatZielrichtung(repoRoot: string): boolean {
  const weights = loadTargetProfile(repoRoot)?.profile.weights ?? {};
  return Object.values(weights).some((w) => typeof w === 'number' && w !== 0);
}

function dropSilentAdvisories<T extends object>(result: T, hatZielprofil: boolean): T {
  const r = result as T & {
    fitAdvisory?: FitAdvisory;
    steerAdvisory?: SteerAdvisory;
    workOrder?: WorkOrder;
    confidence?: number;
  };
  const out = { ...r };
  // CR-GC-590: `confidence` ist eine Konstante (0 oder 1) ohne einen einzigen Leser — weg.
  delete out.confidence;
  // CR-GC-590: ohne Zielprofil ist der ℝ⁶ Richtung ohne Ziel. Er rankt seit CR-GC-483 nicht
  // mehr, und seine `regressions`-Liste widersprach dem Satz "nur Bericht" (Runde 7: 8–15 Bloecke
  // je Lauf, fast alle mit Regression, Modulschnitte danach entschieden). Mit Zielprofil bleibt
  // er — dort ist Δm die Richtung (se:optimize, se:top-level).
  if (out.fitAdvisory && (!hatZielprofil || fitAdvisoryIsSilent(out.fitAdvisory))) delete out.fitAdvisory;
  if (out.steerAdvisory && steerAdvisoryIsSilent(out.steerAdvisory)) delete out.steerAdvisory;
  if (out.workOrder && workOrderIsSilent(out.workOrder)) delete out.workOrder;
  return out as T;
}

/** Replay-based branch reintegration (CR-GC-234) — the semantic rebase. */
const GraphMergeInputSchema = z.object({
  log: z
    .string()
    .describe(
      "Path to the BRANCH's durable command log (the worktree's .graphcode/audit.jsonl, CR-GC-232) — " +
        'absolute, or relative to this repoRoot.',
    ),
  sinceVersion: z
    .number()
    .int()
    .nonnegative()
    .describe(
      'The fork point: the shared base graphVersion (CR-GC-233). Branch entries with graphVersion > ' +
        'sinceVersion are replayed; everything at or before it is shared history.',
    ),
  dryRun: z
    .boolean()
    .default(false)
    .describe('true = merge preview: full report, but graph + log stay byte-identical.'),
  consumerId: z.string().default('graph-merge'),
});

const GraphReseedInputSchema = z.object({
  path: z
    .string()
    .optional()
    .describe('Committed graph JSON path relative to repoRoot (default docs/graph/<systemId>.graph.json).'),
});

/** Was ein Batch an den Code-Verweisen (R-19/R-20/R-26) bewegt hat — CR-GC-685. */
export interface BindingReport {
  /** Welche fehlenden Code-Verweise dieser Batch geschlossen hat. */
  resolved: string[];
  /** Welche er aufgerissen hat — normalerweise leer. */
  introduced: string[];
  /** Wie viele Verweise im Modell noch offen sind — die Zahl, nicht die Liste. */
  openRefs: number;
}

// -------------------------------------------------------------------------
// Binding
// -------------------------------------------------------------------------

export function bindWriteTools(ctx: ToolContext): MCPToolRegistry {
  const { harness, graphVersion, recordAudit, recordPreview, serializeToolWrite, occReject } = ctx;


  /** CR-GC-321: der Hinweis, der den stillen `name = uid`-Fallback laut macht. */
  const nameWarningFor = (unnamed: string[]): string | undefined =>
    unnamed.length === 0
      ? undefined
      : `${unnamed.length} node(s) carry no __name — their uid became the name: ${unnamed.join(', ')}. ` +
        'Format-E has two positional fields (uid|description); the name travels as ' +
        '[__name:…] inline or as an @__name line. Repair through the gate (update-node).';

  const OCC_WARNING =
    'no baseVersion supplied — OCC check skipped (lost-update window). Pass the graphVersion ' +
    'your last read returned as baseVersion (CR-GC-233).';

  // Takes the ALREADY-evaluated violation list (CR-GC-434): the same evaluateRules
  // run now feeds both the missingRefs delta and the respondsTo stamp — one
  // measurement, not two.
  const missingRefIds = (violations: RuleViolation[]): Set<string> =>
    new Set(
      violations
        // R-19 testRefs, R-20 FUNC realRef, R-26 SCHEMA realRef (CR-211/228) — the presence rules
        // a binding (`~ uid` + `@realRef`/`@testRefs`) resolves; the delta confirms the realization.
        .filter((v) => v.ruleId === 'R-19' || v.ruleId === 'R-20' || v.ruleId === 'R-26')
        .map((v) => v.elementId)
        .filter((id): id is string => !!id),
    );

  /**
   * Der Bindungsreport (CR-GC-611, seit CR-GC-685 am graph_mutate-Ergebnis; graph_realize ist mit CR-GC-685B entfallen): welche fehlenden
   * Code-Verweise der Batch geschlossen und welche er aufgerissen hat, und wie viele offen bleiben
   * — die Zahl, nicht die Liste. Nur wenn sich an den Verweisen etwas bewegt hat: ein Batch ohne
   * Bindung traegt kein Feld (dieselbe Regel wie CR-GC-576 — Schweigen kostet null Zeichen).
   */
  const refsReport = (
    before: RuleViolation[],
    after: RuleViolation[],
  ): { refs: BindingReport } | Record<string, never> => {
    const vorher = missingRefIds(before);
    const nachher = missingRefIds(after);
    const resolved = [...vorher].filter((id) => !nachher.has(id));
    const introduced = [...nachher].filter((id) => !vorher.has(id));
    return resolved.length === 0 && introduced.length === 0
      ? {}
      : { refs: { resolved, introduced, openRefs: nachher.size } };
  };

  // -------------------------------------------------------------------------
  // WRITE tools — gate symmetry (L2): delegate to harness.mutate(), no bypass
  // -------------------------------------------------------------------------

  const graph_mutate: MCPTool<
    z.infer<typeof GraphMutateInputSchema>,
    MutateResult & { graphVersion: number; occWarning?: string; nameWarning?: string; steeringDelta?: SteeringDelta; steeringUnmeasurable?: string; next?: NextStep; refs?: BindingReport }
  > = {
    name: 'graph_mutate',
    description:
      'The ONE write path: apply a batch through the Apply-Gate. Prefer a `formatE` block over ' +
      '`commands` — it carries adds, deletes, updates and merges alike (CR-GC-627), at ~2–3× fewer ' +
      'tokens; only `update-edge` still needs `commands`. `dryRun:true` returns the full verdict ' +
      'without applying. Pass the `graphVersion` of your last read as `baseVersion` — a stale base is ' +
      'rejected with the delta since. The full command signatures come back in the SCHEMA-01 error ' +
      'text, so they need not be carried here.',
    inputSchema: GraphMutateInputSchema,
    async handler(raw) {
      return serializeToolWrite(async () => {
        // Input-Parität (CR-GC-286): derselbe Zod-Parse wie am MCP-Transport, auch
        // für In-Process-Caller (Executor, Tests). Ein Schema-Fehler ist ein
        // AUDITIERTES Block-Verdict mit der Zod-Meldung — kein unauditierter
        // Handler-Throw (die 63/81-Lücke der Opus-Nachanalyse).
        const parsedInput = GraphMutateInputSchema.safeParse(raw);
        if (!parsedInput.success) {
          const consumerId =
            typeof raw === 'object' && raw !== null && typeof (raw as { consumerId?: unknown }).consumerId === 'string'
              ? (raw as { consumerId: string }).consumerId
              : 'mcp-client';
          const result: MutateResult = {
            success: false,
            appliedCommands: 0,
            mutations: 0,
            violations: [
              {
                ruleId: 'INPUT-SCHEMA',
                severity: 'error',
                message: parsedInput.error.issues
                  .map((i) => (i.path.length > 0 ? i.path.join('.') + ': ' : '') + i.message)
                  .join('; '),
              },
            ],
            confidence: 0,
            tier: 'block',
          };
          await recordAudit(consumerId, result, []);
          return { ...result, graphVersion: graphVersion() };
        }
        const input = parsedInput.data;
        // Format-E-Decode VOR dem Gate: ein Parse-Fehler ist ein Block-Verdict,
        // kein Transport-Crash — der Autor bekommt die Codec-Meldung als Violation.
        let commands: MutateCommand[];
        // CR-GC-321: nur der formatE-Pfad kennt den stillen `name = uid`-Fallback;
        // auf dem commands-Pfad ist `name` explizite Autorenabsicht.
        let nameWarning: string | undefined;
        try {
          if (input.formatE !== undefined) {
            const decoded = formatEToCommands(harness.getGraph(), input.formatE);
            commands = decoded.commands;
            nameWarning = nameWarningFor(decoded.unnamed);
          } else {
            commands = input.commands as MutateCommand[];
          }
        } catch (err) {
          const result: MutateResult = {
            success: false,
            appliedCommands: 0,
            mutations: 0,
            violations: [
              { ruleId: 'STRUCT', severity: 'error', message: err instanceof Error ? err.message : String(err) },
            ],
            confidence: 0,
            tier: 'block',
          };
          // CR-GC-286: der Decode-Fehler ist eine Rejection wie jede andere —
          // ohne Audit reißt die F2-Kette (early return war der unauditierte Pfad).
          await recordAudit(input.consumerId, result, []);
          return { ...result, graphVersion: graphVersion() };
        }
        const stale = await occReject(input.consumerId, input.baseVersion, commands);
        if (stale) return stale;
        // steeringDelta (CR-GC-289): Vorher-Snapshot des STEERING-Katalogs
        // (evaluateAllRules inkl. ND + computeReadiness — der Raum, in dem
        // graph_generate den Fokus wählt) — NUR im dryRun-Zweig: der Apply-Pfad
        // bewegt die graphVersion, der Nachher-Zustand ist dort per
        // graph_readiness lesbar; die Doppel-Evaluierung pro echtem Write wäre
        // reine Kostenstelle ohne Konsument (Entscheidung dokumentiert im CR).
        // ITEM-2026-570: gemessen, nicht geprueft — Altbestand macht den Steuerraum unmessbar, die Probe
        // einer Migration muss trotzdem ein Gate-Verdict liefern.
        const steeringBefore = input.dryRun ? measureSteering(harness.getGraph(), harness.getMetricPolicy()) : null;
        // respondsTo-Baseline (CR-GC-434) — NUR auf dem Apply-Pfad: der Preview
        // trägt keine Stempel. Eine evaluateRules-Messung vor dem Gate; die
        // Nachher-Seite fällt nur bei success an (bei Rejection ist der Zustand
        // unverändert, das Delta wäre leer).
        const respondsBaseline = input.dryRun ? null : harness.evaluateRules();
        // L2: identical semantics — delegate straight to the gate, no bypass.
        // Cast: MCP transports deserialize commands as plain objects; harness.mutate()
        // validates internally via MutateCommandSchema.
        const result = await harness.mutate(commands, { dryRun: input.dryRun });
        if (input.dryRun) {
          // Der Gate-dryRun lässt den Applied-Zustand in-memory (CR-GC-234) —
          // GENAU JETZT messen (bei block hat das Gate schon zurückgerollt ⇒
          // Delta 0), dann die Working Copy restaurieren. Pure Messung, kein
          // Einfluss auf tier/success (Muster fitAdvisory/CR-274).
          const steeringAfter = measureSteering(harness.getGraph(), harness.getMetricPolicy());
          await harness.loadGraph();
          const preview =
            'snapshot' in steeringBefore! && 'snapshot' in steeringAfter
              ? { ...result, steeringDelta: computeSteeringDelta(steeringBefore.snapshot, steeringAfter.snapshot) }
              : { ...result, steeringUnmeasurable: 'unmeasurable' in steeringAfter ? steeringAfter.unmeasurable : (steeringBefore as { unmeasurable: string }).unmeasurable };
          // Vorschlag→Verdict auditieren (F2) — der Preview trägt das steeringDelta.
          // Auditiert wird die VOLLE Fassung: der Audit-Trail ist Evidenz, nicht
          // Antwort-Budget. Gekürzt wird erst, was über die Leitung geht.
          await recordPreview(input.consumerId, preview, commands);
          const previewOut = dropSilentAdvisories(
            input.violations === 'full' ? preview : summarizeViolations(preview),
            hatZielrichtung(harness.getRepoRoot()),
          );
          // CR-GC-321/REQ-N07: auch im Preview — sonst meldet der dryRun sauber
          // und der Apply verliert die Namen.
          return { ...previewOut, graphVersion: graphVersion(), ...(nameWarning ? { nameWarning } : {}) };
        }
        // CR-GC-434: die Gate-Pfad-Stempel — welche Alt-Violations der Batch
        // schloss (gemessenes Vorher/Nachher-Delta) und ob er ein von
        // graph_suggest gelieferter Template-Edit war.
        // Nachher-Messung einmal, nur bei Anwendung: sie speist respondsTo UND den Bindungsreport.
        const afterAll = result.success ? harness.evaluateRules() : null;
        await recordAudit(input.consumerId, result, commands, {
          respondsTo: afterAll ? resolvedViolations(respondsBaseline!, afterAll) : [],
          editSource: ctx.classifyEditSource(commands),
        });
        const out = dropSilentAdvisories(
          input.violations === 'full' ? result : summarizeViolations(result),
          hatZielrichtung(harness.getRepoRoot()),
        );
        // CR-GC-588: der naechste Schritt faehrt mit — derselbe, den graph_generate liefern
        // wuerde, ohne den Roundtrip. Nur nach Anwendung; bei Ablehnung ist das Urteil der Kanal.
        const next = result.success
          ? { next: nextStepAfterApply(harness.getGraph(), harness.getMetricPolicy(), harness.getFocusThreshold(), harness.getRepoRoot(), focusMemoryOf(harness), graphVersion()) }
          : {};
        return {
          ...out,
          graphVersion: graphVersion(),
          ...(input.baseVersion === undefined ? { occWarning: OCC_WARNING } : {}),
          ...(nameWarning ? { nameWarning } : {}),
          ...(afterAll ? refsReport(respondsBaseline!, afterAll) : {}),
          ...next,
        };
      });
    },
  };

  const graph_merge: MCPTool<
    z.infer<typeof GraphMergeInputSchema>,
    MergeReport & { graphVersion: number }
  > = {
    name: 'graph_merge',
    description:
      'Fold one node into another: the target ABSORBS the source, the source disappears, and every ' +
      'edge is re-pointed. Take it to consolidate duplicates — a merge is the one move that REMOVES ' +
      'structure, so it runs through the same Apply-Gate and the same OCC check as any write. Coupled ' +
      'merges that the cardinality bounds require must ride in ONE batch.',
    inputSchema: GraphMergeInputSchema,
    async handler(input) {
      const logPath = isAbsolute(input.log) ? input.log : join(harness.getRepoRoot(), input.log);
      const entries = readBranchLog(logPath, input.sinceVersion);
      return serializeToolWrite(async () => {
        // CR-GC-434: respondsTo per replayed batch — the batches are sequential, so
        // each batch's before-state is the previous batch's after-state. editSource
        // stays ABSENT: the batch was authored on the branch, this session cannot
        // know whether a template produced it (absence = not recorded, never a guess).
        let mergeBaseline = input.dryRun ? null : harness.evaluateRules();
        const report = await replayBranchLog(harness, entries, {
          dryRun: input.dryRun,
          // Real merge: every replayed batch lands in the TARGET's durable log like
          // any gated write (applied → version++, conflicted → logged rejected).
          // A dry run records NOTHING (byte-identical log guarantee).
          onBatchResult: input.dryRun
            ? undefined
            : async (result, commands) => {
                const after = harness.evaluateRules();
                await recordAudit(input.consumerId, result, commands, {
                  respondsTo: result.success ? resolvedViolations(mergeBaseline!, after) : [],
                });
                mergeBaseline = after;
              },
        });
        report.sinceVersion = input.sinceVersion;
        // Dry run: the gate's dryRun mode accumulated the preview in the in-memory
        // working copy — restore it from the (untouched) disk store.
        if (input.dryRun) await harness.loadGraph();
        return { ...report, graphVersion: graphVersion() };
      });
    },
  };

  // RESEED tool — re-sync the live store to the committed SSOT (CR-GC-203 item 4).
  // In-process clear+reimport behind the single writer; replaces the corrupting
  // stop-server → rm .graphcode/kuzu → restart dance.

  const graph_reseed: MCPTool<z.infer<typeof GraphReseedInputSchema>, { reseeded: true; nodes: number; edges: number }> = {
    name: 'graph_reseed',
    description:
      'Re-sync the live store to the committed SSOT JSON (CR-GC-203 item 4). The single-writer owner ' +
      'clears the store IN-PROCESS (DETACH DELETE through the open handle) then re-imports the committed ' +
      'graph — replacing the stop-server → rm .graphcode/kuzu → restart dance, which corrupts the store ' +
      'when the file is removed under a live handle. DISCARDS un-exported gate mutations; pairs with the ' +
      'export drift guard. Single-writer; no direct Kuzu access.',
    inputSchema: GraphReseedInputSchema,
    async handler(input) {
      const { nodes, edges } = await harness.reseed(input.path);
      return { reseeded: true as const, nodes, edges };
    },
  };

  return { graph_mutate, graph_merge, graph_reseed };
}
