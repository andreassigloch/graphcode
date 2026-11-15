/**
 * surface/audit-stats.ts — die Auswertung des Audit-Logs im Aggregat (CR-GC-347), aus `audit.ts`
 * herausgeloest mit CR-GC-943: `audit.ts` stand bei 503 Zeilen, und Skill und Feuerbild kamen dazu.
 *
 * `audit.ts` traegt die Werkzeuge und die Projektion je Satz, diese Datei die Zaehlung ueber Saetze:
 * je Regel, je Konsument, je Modell und je Skill.
 *
 * @author andreas@siglochconsulting
 */

import { z } from 'zod/v4';

/** One audit record as written to disk — only the fields projection and aggregation read. */
export type RawAuditEntry = Record<string, unknown> & {
  commands?: unknown[];
  violations?: Array<Record<string, unknown>>;
  rulesetVersion?: string;
  rulesPassed?: string[];
  sessionId?: string;
  model?: string;
  /** CR-GC-943: der Skill, den der Schreiber am Zug genannt hat. Fehlt = nicht erfasst. */
  skill?: string;
  intent?: string;
  intentTruncated?: boolean;
};

// -------------------------------------------------------------------------
// Aggregation (across records) — CR-GC-347
// -------------------------------------------------------------------------

// CR-GC-644: die Kennzahlen des Audit-Berichts sind ein Zod-Vertrag, kein Typ — `aggregateAuditEntries`
// prueft seine Ausgabe, bevor sie den Bericht verlaesst.
export const RuleStatSchema = z.object({
  ruleId: z.string(),
  /** Records with result 'rejected' that carried this rule as an ERROR — blockades, not findings. */
  blocked: z.number(),
  /** Occurrences in total, every severity — the finding count, which is a different number. */
  occurrences: z.number(),
  bySeverity: z.object({ error: z.number(), warning: z.number(), info: z.number() }),
  /** From `rulesPassed`. `null` means NOT RECORDED, never "passed zero times". */
  passed: z.number().nullable(),
  /** `null` whenever the population is incomplete — never optimistically computed. */
  passRate: z.number().nullable(),
  /**
   * CR-GC-943: Zahl der Saetze, in denen die Regel mindestens einen Fund hatte. `0` = sie lief und fand
   * nichts. `null` = sie steht im Katalog, und kein Satz zeigt, dass sie lief.
   */
  firedIn: z.number().nullable(),
  /** CR-GC-943: Zahl der Saetze, in denen die Regel lief (`firedIn + passed`). `null` wie `passRate`. */
  evaluatedIn: z.number().nullable(),
});
export type RuleStat = z.infer<typeof RuleStatSchema>;

export const ConsumerStatSchema = z.object({
  consumerId: z.string(),
  applied: z.number(),
  rejected: z.number(),
  /** `null` on a tie — an invented winner is worse than no winner. */
  topBlockingRule: z.string().nullable(),
});
export type ConsumerStat = z.infer<typeof ConsumerStatSchema>;

export const ModelStatSchema = z.object({
  model: z.string(),
  applied: z.number(),
  rejected: z.number(),
  topBlockingRule: z.string().nullable(),
});
export type ModelStat = z.infer<typeof ModelStatSchema>;

/** CR-GC-943: `skill: null` sammelt die Saetze ohne das Feld — nicht erfasst, nicht „kein Skill". */
export const SkillStatSchema = z.object({
  skill: z.string().nullable(),
  applied: z.number(),
  rejected: z.number(),
  topBlockingRule: z.string().nullable(),
});
export type SkillStat = z.infer<typeof SkillStatSchema>;

export const AuditStatsSchema = z.object({
  /**
   * What this answer actually covered (CR-GC-349).
   *
   * `archives` and `checkpointVersion` are the READ HORIZON: compaction archives by rename and
   * deletes nothing, so an aggregation that only saw the active log would report a near-empty
   * trail while the evidence sat untouched beside it — a wrong measurement shaped like a
   * result. Both are `0` on a never-compacted log; that zero is a measurement, not a gap, which
   * is why it is not `null` (contrast `passed`/`passRate` below).
   */
  window: z.object({
    since: z.string().nullable(),
    until: z.string().nullable(),
    entries: z.number(),
    archives: z.number(),
    checkpointVersion: z.number(),
  }),
  totals: z.object({ applied: z.number(), rejected: z.number(), partial: z.number() }),
  byRule: z.array(RuleStatSchema),
  byConsumer: z.array(ConsumerStatSchema),
  /** CR-GC-354/355: the dimension CR-GC-284 broke down by and could not read from a record. */
  byModel: z.array(ModelStatSchema),
  /** CR-GC-943: je Skill, den der Schreiber am Zug genannt hat. */
  bySkill: z.array(SkillStatSchema),
  graphVersion: z.number(),
});
export type AuditStats = z.infer<typeof AuditStatsSchema>;

/**
 * The most-blocking rule for one actor, or `null` on a tie.
 *
 * A tie is genuinely undecided, and picking the alphabetically first would read as a
 * finding. Same rule as everywhere else in this file: the absence of an answer is itself
 * the honest answer.
 */
function topBlocker(counts: Map<string, number>): string | null {
  let best: string | null = null;
  let bestCount = 0;
  let tied = false;
  for (const [ruleId, n] of counts) {
    if (n > bestCount) {
      best = ruleId;
      bestCount = n;
      tied = false;
    } else if (n === bestCount && n > 0) {
      tied = true;
    }
  }
  return tied ? null : best;
}

/**
 * Aggregate the trail per rule, per consumer and per model (CR-GC-347).
 *
 * This is the table four CRs were built on — CR-GC-284 ("R-01 dominated the rejections of
 * every model: Haiku 26/29, Opus 17/18, devstral 10/23"), CR-GC-286, CR-GC-290, CR-GC-292 —
 * and every one of them was produced by hand with a `jq` line, because no tool could answer
 * it. An agent that only has MCP tools could not ask the question at all.
 *
 * COUNTING RULES, spelled out because they are otherwise read wrong:
 *
 *  - A record can violate SEVERAL rules. `sum(byRule[].blocked) > totals.rejected` is the
 *    normal case, not an error. A percentage is formed against `totals.rejected`, never
 *    against that sum.
 *  - `blocked` counts RECORDS, `occurrences` counts VIOLATIONS. Twenty R-29 violations in
 *    one rejected batch are ONE blockade by that rule and twenty occurrences. Both numbers
 *    are here because both are needed and the confusion is otherwise silent.
 *  - `passed: null` means NOT RECORDED, never "passed zero times" — on this repo's trail
 *    that holds for the records older than CR-GC-314. `passRate` is therefore `null` as
 *    soon as the population is incomplete, rather than optimistically computed.
 */
export function aggregateAuditEntries(
  entries: readonly RawAuditEntry[],
  graphVersion: number,
  horizon: { archives?: number; checkpointVersion?: number; catalog?: readonly string[] } = {},
): AuditStats {
  const rules = new Map<string, RuleStat & { seenPassRecords: number }>();
  const consumers = new Map<string, { applied: number; rejected: number; blockers: Map<string, number> }>();
  const models = new Map<string, { applied: number; rejected: number; blockers: Map<string, number> }>();
  // Schluessel '' = Satz ohne das Feld `skill`; er wird als `skill: null` geliefert.
  const skills = new Map<string, { applied: number; rejected: number; blockers: Map<string, number> }>();
  let applied = 0;
  let rejected = 0;
  let partial = 0;
  let since: string | null = null;
  let until: string | null = null;

  function ruleStat(ruleId: string): RuleStat & { seenPassRecords: number } {
    let s = rules.get(ruleId);
    if (!s) {
      s = {
        ruleId,
        blocked: 0,
        occurrences: 0,
        bySeverity: { error: 0, warning: 0, info: 0 },
        passed: null,
        passRate: null,
        firedIn: 0,
        evaluatedIn: null,
        seenPassRecords: 0,
      };
      rules.set(ruleId, s);
    }
    return s;
  }

  for (const e of entries) {
    const ts = typeof e.timestamp === 'string' ? e.timestamp : null;
    if (ts) {
      if (since === null || ts < since) since = ts;
      if (until === null || ts > until) until = ts;
    }
    if (e.result === 'applied') applied += 1;
    else if (e.result === 'rejected') rejected += 1;
    else if (e.result === 'partial') partial += 1;

    // A rule blocks a RECORD at most once, however many elements it fired on.
    const blockingHere = new Set<string>();
    const firedHere = new Set<string>();
    for (const v of e.violations ?? []) {
      const ruleId = String(v.ruleId ?? '');
      if (!ruleId) continue;
      const s = ruleStat(ruleId);
      s.occurrences += 1;
      firedHere.add(ruleId);
      const sev = String(v.severity ?? '');
      if (sev === 'error' || sev === 'warning' || sev === 'info') s.bySeverity[sev] += 1;
      if (sev === 'error' && e.result === 'rejected') blockingHere.add(ruleId);
    }
    for (const ruleId of blockingHere) ruleStat(ruleId).blocked += 1;
    for (const ruleId of firedHere) {
      const s = ruleStat(ruleId);
      s.firedIn = (s.firedIn ?? 0) + 1;
    }

    for (const ruleId of e.rulesPassed ?? []) {
      const s = ruleStat(String(ruleId));
      s.passed = (s.passed ?? 0) + 1;
      s.seenPassRecords += 1;
    }

    const consumerId = typeof e.consumerId === 'string' ? e.consumerId : 'unknown';
    let c = consumers.get(consumerId);
    if (!c) {
      c = { applied: 0, rejected: 0, blockers: new Map() };
      consumers.set(consumerId, c);
    }
    if (e.result === 'applied') c.applied += 1;
    else if (e.result === 'rejected') c.rejected += 1;
    for (const ruleId of blockingHere) c.blockers.set(ruleId, (c.blockers.get(ruleId) ?? 0) + 1);

    // `model` is absent on every record written before CR-GC-354 and on every client that
    // cannot supply it — those records simply do not appear in byModel, which is the honest
    // reading of an absent field (they are NOT lumped into an "unknown" model that would
    // then look like a real actor with a real block rate).
    if (typeof e.model === 'string' && e.model) {
      let m = models.get(e.model);
      if (!m) {
        m = { applied: 0, rejected: 0, blockers: new Map() };
        models.set(e.model, m);
      }
      if (e.result === 'applied') m.applied += 1;
      else if (e.result === 'rejected') m.rejected += 1;
      for (const ruleId of blockingHere) m.blockers.set(ruleId, (m.blockers.get(ruleId) ?? 0) + 1);
    }

    const skillKey = typeof e.skill === 'string' ? e.skill : '';
    let k = skills.get(skillKey);
    if (!k) {
      k = { applied: 0, rejected: 0, blockers: new Map() };
      skills.set(skillKey, k);
    }
    if (e.result === 'applied') k.applied += 1;
    else if (e.result === 'rejected') k.rejected += 1;
    for (const ruleId of blockingHere) k.blockers.set(ruleId, (k.blockers.get(ruleId) ?? 0) + 1);
  }

  // CR-GC-943: eine Regel des Katalogs, die in keinem Satz steht — weder mit Fund noch als bestanden.
  // Ob sie lief, zeigt das Log nicht: `firedIn: null`, nie 0.
  // Nur bei einem Fenster mit Saetzen: ein leeres Fenster bleibt leer.
  for (const ruleId of entries.length > 0 ? (horizon.catalog ?? []) : []) {
    if (!rules.has(ruleId)) ruleStat(ruleId).firedIn = null;
  }

  // A pass RATE needs a complete population. `rulesPassed` only exists since CR-GC-314, so
  // over a window that reaches further back the denominator is unknown — and a rate computed
  // on a partial denominator would read as fact. Hence: recorded on EVERY entry, or null.
  const total = entries.length;
  const recordedPass = entries.filter((e) => Array.isArray(e.rulesPassed)).length;
  const byRule: RuleStat[] = [...rules.values()]
    .map(({ seenPassRecords, ...s }) => ({
      ...s,
      passRate:
        s.passed !== null && seenPassRecords === total && total > 0 ? s.passed / total : null,
      // Dieselbe Bedingung wie `passRate`: `rulesPassed` steht an jedem Satz des Fensters, sonst null.
      evaluatedIn: s.firedIn !== null && recordedPass === total && total > 0 ? s.firedIn + (s.passed ?? 0) : null,
    }))
    .sort((a, b) => b.blocked - a.blocked || b.occurrences - a.occurrences || a.ruleId.localeCompare(b.ruleId));

  const byConsumer: ConsumerStat[] = [...consumers.entries()]
    .map(([consumerId, c]) => ({
      consumerId,
      applied: c.applied,
      rejected: c.rejected,
      topBlockingRule: topBlocker(c.blockers),
    }))
    .sort((a, b) => b.rejected - a.rejected || b.applied - a.applied || a.consumerId.localeCompare(b.consumerId));

  const byModel: ModelStat[] = [...models.entries()]
    .map(([model, m]) => ({
      model,
      applied: m.applied,
      rejected: m.rejected,
      topBlockingRule: topBlocker(m.blockers),
    }))
    .sort((a, b) => b.rejected - a.rejected || b.applied - a.applied || a.model.localeCompare(b.model));

  const bySkill: SkillStat[] = [...skills.entries()]
    .map(([skill, k]) => ({
      skill: skill === '' ? null : skill,
      applied: k.applied,
      rejected: k.rejected,
      topBlockingRule: topBlocker(k.blockers),
    }))
    .sort((a, b) => b.rejected - a.rejected || b.applied - a.applied || (a.skill ?? '').localeCompare(b.skill ?? ''));

  return AuditStatsSchema.parse({
    window: {
      since,
      until,
      entries: total,
      archives: horizon.archives ?? 0,
      checkpointVersion: horizon.checkpointVersion ?? 0,
    },
    totals: { applied, rejected, partial },
    byRule,
    byConsumer,
    byModel,
    bySkill,
    graphVersion,
  });
}
