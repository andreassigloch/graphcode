/**
 * preflight.ts — Batch-Hygiene VOR dem Apply-Gate (CR-GC-284).
 *
 * KEIN zweites Gate, KEIN Regel-Fork: der Preflight nutzt dieselben Imports wie
 * die Engine (`TRACE_PATTERNS`/`isValidTrace` aus @sigloch/contracts/se, das
 * `MutateCommandSchema` aus @sigloch/contracts/harness) und repariert nur, was
 * DETERMINISTISCH reparierbar ist. Bei jeder Unsicherheit (unbekannte
 * Command-Form, exotische Ops wie update-edge/merge-nodes, formatE-Input) geht
 * der Batch UNVERÄNDERT ans Gate — das Gate bleibt die einzige Wahrheit.
 *
 * Drei Eingriffe (Audit-Befund: R-01 dominiert die Rejections aller Modelle,
 * R-18/R-08 sind mechanisch vorab prüfbar; Repair-Quote lokal schwach):
 *   1. R-01-Autovervollständigung: neue REQ ohne TEST-verify-Partner in
 *      Batch ∪ Graph → deterministischer TEST-Stub + verify-Kante (it.todo-Stil).
 *   2. R-18 Auto-Flip: illegales Trace-Paar, dessen GEGENRICHTUNG legal ist →
 *      source/target tauschen (geloggt); beide Richtungen illegal → lokales
 *      Feedback statt Gate-Call.
 *   3. R-08: Kanten-Referenz existiert weder im Graph noch im Batch → lokales
 *      Feedback mit Fuzzy-Kandidaten, Batch nicht ans Gate.
 *
 * @author andreas@siglochconsulting
 */
import { MutateCommandSchema, type MutateCommand } from '@sigloch/contracts/harness';
import { TRACE_PATTERNS, isValidTrace } from '@sigloch/contracts/se';
import type { ElementType, TraceType } from '@sigloch/contracts/se';

/** Graph-Zustand, gegen den der Batch geprüft wird (aus den Registry-Tools). */
export interface PreflightKnown {
  /** uid → ElementType aller existierenden Graph-Knoten. */
  types: Map<string, string>;
  /** REQ-uids, die im Graphen bereits eine eingehende verify-Kante tragen. */
  verifiedReqs: Set<string>;
}

export interface PreflightViolation {
  ruleId: string;
  severity: 'error';
  message: string;
  fixHint?: string;
}

export interface PreflightOutcome {
  /** pass = unverändert durchreichen · fixed = reparierter Batch · blocked = lokales Feedback, kein Gate-Call. */
  action: 'pass' | 'fixed' | 'blocked';
  /** Bei 'fixed' der reparierte Batch (übrige Input-Felder erhalten), sonst der Original-Input. */
  input: unknown;
  /** Eine Zeile pro Eingriff (Auto-Flip / R-01-Stub) — geht als Trace ins run.log. */
  fixes: string[];
  /** Bei 'blocked' die lokalen Befunde im Gate-Violation-Format (formatGateFeedback-kompatibel). */
  violations: PreflightViolation[];
}

/** Nur diese Ops versteht der Preflight — alles andere reicht er unverändert durch. */
const SIMPLE_OPS = new Set(['add-node', 'add-edge']);

const legalPair = (source: string, target: string, edgeType: string): boolean =>
  isValidTrace({ source: source as ElementType, target: target as ElementType, type: edgeType as TraceType });

/** Legale ausgehende Kanten eines Typs — für das R-18-Feedback (aus TRACE_PATTERNS, nie lokal). */
function legalEdgesOf(type: string): string {
  return (
    TRACE_PATTERNS.filter((p) => p.source === type)
      .map((p) => `${p.type}→${p.target}`)
      .join(', ') || '(keine)'
  );
}

/**
 * Fuzzy-Kandidaten für eine unbekannte uid: Normalisierung (lowercase,
 * alphanumerisch) + Substring-Match bzw. Levenshtein ≤3 — bewusst leichtgewichtig.
 */
export function fuzzyCandidates(unknownUid: string, knownUids: Iterable<string>): string[] {
  const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const n = norm(unknownUid);
  const scored: { uid: string; score: number }[] = [];
  for (const uid of knownUids) {
    const k = norm(uid);
    const score = k === n ? 0 : k.includes(n) || n.includes(k) ? 1 : levenshteinCapped(n, k, 3);
    if (score <= 3) scored.push({ uid, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.uid.localeCompare(b.uid))
    .slice(0, 3)
    .map((x) => x.uid);
}

function levenshteinCapped(a: string, b: string, cap: number): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Der Preflight. Deterministisch: gleicher Input + gleicher Graph-Zustand ⇒
 * gleiches Ergebnis. Wirft nie — jeder unerwartete Input ist ein 'pass'.
 */
export function preflightBatch(raw: unknown, known: PreflightKnown): PreflightOutcome {
  const pass: PreflightOutcome = { action: 'pass', input: raw, fixes: [], violations: [] };
  if (typeof raw !== 'object' || raw === null) return pass;
  const obj = raw as Record<string, unknown>;
  // formatE-Batches unverändert durchreichen — deren Decode macht das Tool (CR-GC-276).
  if (typeof obj.formatE === 'string') return pass;
  if (!Array.isArray(obj.commands) || obj.commands.length === 0) return pass;

  const parsed: MutateCommand[] = [];
  for (const c of obj.commands) {
    const r = MutateCommandSchema.safeParse(c);
    // Unbekannte Command-Form oder exotische Op → GANZEN Batch unverändert durchreichen.
    if (!r.success || !SIMPLE_OPS.has(r.data.op)) return pass;
    parsed.push(r.data);
  }

  // uid → Typ über Graph ∪ Batch (add-nodes zählen als vorhanden).
  const typeOf = new Map(known.types);
  for (const c of parsed) if (c.op === 'add-node') typeOf.set(c.node.uid, c.node.type);

  const fixes: string[] = [];
  const violations: PreflightViolation[] = [];

  // --- R-18: Trace-Paar-Legalität; nur die Gegenrichtung legal → Auto-Flip ---
  const out: MutateCommand[] = parsed.map((c) => {
    if (c.op !== 'add-edge') return c;
    const { sourceId, targetId, edgeType } = c.edge;
    const sT = typeOf.get(sourceId);
    const tT = typeOf.get(targetId);
    if (!sT || !tT) return c; // unbekannte Referenz → R-08 unten übernimmt
    if (legalPair(sT, tT, edgeType)) return c;
    if (legalPair(tT, sT, edgeType)) {
      fixes.push(
        `R-18 auto-flip: ${sourceId} ${edgeType} ${targetId} → ${targetId} ${edgeType} ${sourceId} ` +
          `(legal ist ${tT} ${edgeType} ${sT})`,
      );
      return { ...c, edge: { ...c.edge, sourceId: targetId, targetId: sourceId } };
    }
    violations.push({
      ruleId: 'R-18',
      severity: 'error',
      message:
        `Illegales Trace-Paar: ${sT} ${edgeType} ${tT} (${sourceId} → ${targetId}) — ` +
        'auch die Gegenrichtung ist nicht legal.',
      fixHint: `Legale Kanten von ${sT}: ${legalEdgesOf(sT)}. Legale Kanten von ${tT}: ${legalEdgesOf(tT)}.`,
    });
    return c;
  });

  // --- R-08: jede Kanten-Referenz muss in Graph ∪ Batch existieren -----------
  for (const c of out) {
    if (c.op !== 'add-edge') continue;
    for (const [role, uid] of [
      ['sourceId', c.edge.sourceId],
      ['targetId', c.edge.targetId],
    ] as const) {
      if (typeOf.has(uid)) continue;
      const candidates = fuzzyCandidates(uid, typeOf.keys());
      violations.push({
        ruleId: 'R-08',
        severity: 'error',
        message: `add-edge ${role}: uid "${uid}" existiert weder im Graph noch im Batch.`,
        fixHint: candidates.length
          ? `Ähnlich vorhanden: ${candidates.join(', ')} — meintest du eine davon?`
          : 'Lege den Knoten im selben Batch per add-node an oder korrigiere die uid.',
      });
    }
  }
  // Blocker gefunden → lokales Feedback, der Batch geht NICHT ans Gate.
  if (violations.length > 0) return { action: 'blocked', input: raw, fixes: [], violations };

  // --- R-01-Autovervollständigung: neue REQ ohne TEST-verify-Partner ---------
  const verified = new Set(known.verifiedReqs);
  for (const c of out) if (c.op === 'add-edge' && c.edge.edgeType === 'verify') verified.add(c.edge.targetId);
  const appended: MutateCommand[] = [];
  for (const c of out) {
    if (c.op !== 'add-node' || c.node.type !== 'REQ' || verified.has(c.node.uid)) continue;
    const suffix = c.node.uid.replace(/^REQ-?/, '') || c.node.uid.toLowerCase();
    const stubUid = `TEST-verify-${suffix}`;
    // uid-Kollision = Unsicherheit → keinen Stub erfinden, das Gate urteilt.
    if (typeOf.has(stubUid)) continue;
    typeOf.set(stubUid, 'TEST');
    verified.add(c.node.uid);
    appended.push({
      op: 'add-node',
      node: {
        uid: stubUid,
        type: 'TEST',
        name: `Verify: ${c.node.name}`,
        // it.todo-Stil: konkreter Prüfschritt-Platzhalter, KEINE ASCII-Pfeile (Codec).
        description:
          `it.todo: Prüfe "${c.node.name}" — Vorbedingung herstellen, Aktion ausführen, ` +
          'Ergebnis messbar gegen die REQ-Aussage prüfen.',
        attributes: {},
      },
    });
    appended.push({
      op: 'add-edge',
      edge: { sourceId: stubUid, targetId: c.node.uid, edgeType: 'verify', attributes: {} },
    });
    fixes.push(`R-01 autocomplete: TEST-Stub ${stubUid} + verify-Kante für ${c.node.uid} angehängt`);
  }

  if (fixes.length === 0) return pass;
  // Reparierter Batch — übrige Input-Felder (z.B. author) bleiben erhalten.
  return { action: 'fixed', input: { ...obj, commands: [...out, ...appended] }, fixes, violations: [] };
}
