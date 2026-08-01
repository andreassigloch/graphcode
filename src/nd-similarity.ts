/**
 * nd-similarity.ts — ND-Matrix-Injektion + REQ/UC-Duplikat-Hinweis (CR-GC-287).
 *
 * KEIN Regel-Fork: Urteil, Threshold (0.85) und Severity von ND-01/ND-02 leben
 * in @sigloch/contracts/se. Die Regeln erwarten eine per
 * `setND01SimilarityMatrix` / `setND02SimilarityMatrix` INJIZIERTE
 * Similarity-Matrix (Muster BQ-04) — ohne Injektion liefern sie []. Dieses
 * Modul BERECHNET die Matrizen deterministisch nach den Formeln aus den
 * contracts-Kommentaren:
 *
 *   ND-01 (FUNC):   0.35·descr_jaccard + 0.25·verb_match + 0.25·io_topology + 0.15·req_overlap
 *   ND-02 (SCHEMA): 0.50·field_jaccard + 0.30·descr_jaccard + 0.20·usage_overlap
 *
 * Injektionspunkt: `injectNDMatrices(og)` läuft NUR vor Full-Katalog-Evals
 * (generationStep / nextStep → evaluateAllRules + se-steering computeReadiness).
 * Das Gate (V3_RULES + MT via SE_DESCRIPTOR) enthält ND nicht — der
 * Modul-State ist für Gate-Läufe wirkungslos; ND bleibt Steering, nie
 * Gate-Blocker (Delta-Semantik unberührt).
 *
 * Zusätzlich der graphcode-LOKALE Executor-HINWEIS (keine Regel, kein Block):
 * `duplicateHints` vergleicht neue REQ/UC-add-nodes per Name/Beschreibung
 * gegen den Element-Index — echte ND-Regeln für REQ/UC gehören nach contracts
 * (Familie-Review + Version-Bump, siehe CR-Abgrenzung).
 *
 * @author andreas@siglochconsulting
 */
import type { OntologyGraph } from '@sigloch/contracts/se';
import { setND01SimilarityMatrix, setND02SimilarityMatrix } from '@sigloch/contracts/se';

// ---------------------------------------------------------------------------
// Text-Grundbausteine (deterministisch, sprachneutral)
// ---------------------------------------------------------------------------

/** Wort-Token ≥3 Zeichen, lowercase, Unicode-Buchstaben/Ziffern. */
export function tokens(s: string | undefined): Set<string> {
  return new Set(
    (s ?? '')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 3),
  );
}

/** Jaccard-Ähnlichkeit; ∅/∅ = 1 (identisch leer). */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 1 : inter / union;
}

/** Name/Beschreibungs-Ähnlichkeit für den REQ/UC-Hinweis: 0.5·name + 0.5·descr. */
export function nameDescrSimilarity(
  a: { name: string; description?: string },
  b: { name: string; description?: string },
): number {
  return 0.5 * jaccard(tokens(a.name), tokens(b.name)) + 0.5 * jaccard(tokens(a.description), tokens(b.description));
}

// ---------------------------------------------------------------------------
// ND-01 / ND-02 — Matrix-Berechnung (Formeln = contracts-Kommentar)
// ---------------------------------------------------------------------------

type El = OntologyGraph['elements'][number];

/** Partner-uids aller Traces eines Elements, gefiltert auf Trace-Typen. */
function partners(og: OntologyGraph, id: string, traceTypes: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const t of og.traces) {
    if (!traceTypes.includes(t.type)) continue;
    if (t.source === id) out.add(t.target);
    else if (t.target === id) out.add(t.source);
  }
  return out;
}

/** Erstes Wort des Namens als Verb-Näherung (FUNC-Namen: Verb–Objekt). */
function firstWord(name: string): string {
  return (
    name
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .find((w) => w.length > 0) ?? ''
  );
}

const byId = (a: El, b: El): number => a.id.localeCompare(b.id);

/** ND-01: 0.35·descr_jaccard + 0.25·verb_match + 0.25·io_topology + 0.15·req_overlap. */
export function computeND01Matrix(og: OntologyGraph): { funcIds: string[]; matrix: number[][] } {
  const funcs = og.elements.filter((e) => e.type === 'FUNC').sort(byId);
  const descr = funcs.map((f) => tokens(f.description));
  const verb = funcs.map((f) => firstWord(f.name));
  const io = funcs.map((f) => partners(og, f.id, ['io']));
  const reqs = funcs.map((f) =>
    new Set(og.traces.filter((t) => t.type === 'satisfy' && t.source === f.id).map((t) => t.target)),
  );
  const matrix = funcs.map((_, i) =>
    funcs.map((_, j) =>
      i === j
        ? 1
        : 0.35 * jaccard(descr[i], descr[j]) +
          0.25 * (verb[i] !== '' && verb[i] === verb[j] ? 1 : 0) +
          0.25 * jaccard(io[i], io[j]) +
          0.15 * jaccard(reqs[i], reqs[j]),
    ),
  );
  return { funcIds: funcs.map((f) => f.id), matrix };
}

/** Feld-Menge eines SCHEMA: attributes.fields (Array), sonst Beschreibungs-Token. */
function schemaFields(el: El): Set<string> {
  const fields = (el.attributes as Record<string, unknown> | undefined)?.fields;
  if (Array.isArray(fields) && fields.length > 0) {
    return new Set(
      fields.map((f) =>
        String(typeof f === 'object' && f !== null ? ((f as { name?: unknown }).name ?? JSON.stringify(f)) : f).toLowerCase(),
      ),
    );
  }
  return tokens(el.description);
}

/** ND-02: 0.50·field_jaccard + 0.30·descr_jaccard + 0.20·usage_overlap. */
export function computeND02Matrix(og: OntologyGraph): { schemaIds: string[]; matrix: number[][] } {
  const schemas = og.elements.filter((e) => e.type === 'SCHEMA').sort(byId);
  const fields = schemas.map(schemaFields);
  const descr = schemas.map((s) => tokens(s.description));
  const usage = schemas.map((s) => partners(og, s.id, ['relation', 'produces', 'io', 'compose']));
  const matrix = schemas.map((_, i) =>
    schemas.map((_, j) =>
      i === j
        ? 1
        : 0.5 * jaccard(fields[i], fields[j]) + 0.3 * jaccard(descr[i], descr[j]) + 0.2 * jaccard(usage[i], usage[j]),
    ),
  );
  return { schemaIds: schemas.map((s) => s.id), matrix };
}

/**
 * Beide Matrizen frisch berechnen und in die contracts-ND-Regeln injizieren —
 * unmittelbar VOR jedem Full-Katalog-Eval aufrufen (gleicher og!). <2 Kandidaten
 * ⇒ null (Regel bleibt still, nichts zu vergleichen).
 */
export function injectNDMatrices(og: OntologyGraph): void {
  const nd01 = computeND01Matrix(og);
  const nd02 = computeND02Matrix(og);
  setND01SimilarityMatrix(nd01.funcIds.length >= 2 ? nd01 : null);
  setND02SimilarityMatrix(nd02.schemaIds.length >= 2 ? nd02 : null);
}

// ---------------------------------------------------------------------------
// REQ/UC-Duplikat-HINWEIS für den Executor-Preflight (kein Block, keine Regel)
// ---------------------------------------------------------------------------

/** Ab dieser Name/Descr-Ähnlichkeit gilt ein neues REQ/UC als „ähnlich vorhanden". */
export const HINT_SIMILARITY_THRESHOLD = 0.55;

const HINT_TYPES = new Set(['REQ', 'UC']);
const MAX_HINTS = 3;

export interface IndexedElement {
  uid: string;
  type: string;
  name: string;
  description?: string;
}

/**
 * Hinweis-Zeilen für neue REQ/UC-add-nodes, deren Name/Beschreibung stark einem
 * EXISTIERENDEN Element gleichen Typs ähnelt. Duck-typed und wurffrei — jeder
 * unerwartete Input ⇒ []. Der Batch geht IMMER unverändert ans Gate; die Zeilen
 * sind reines Modell-Feedback („mergen oder differenzieren").
 */
export function duplicateHints(input: unknown, existing: IndexedElement[]): string[] {
  if (typeof input !== 'object' || input === null) return [];
  const commands = (input as { commands?: unknown }).commands;
  if (!Array.isArray(commands)) return [];

  const hints: { sim: number; line: string }[] = [];
  for (const c of commands) {
    const node = (c as { op?: unknown; node?: unknown })?.op === 'add-node' ? (c as { node?: unknown }).node : undefined;
    if (typeof node !== 'object' || node === null) continue;
    const n = node as { uid?: unknown; type?: unknown; name?: unknown; description?: unknown };
    if (typeof n.uid !== 'string' || typeof n.type !== 'string' || typeof n.name !== 'string') continue;
    if (!HINT_TYPES.has(n.type)) continue;
    const candidate = { name: n.name, description: typeof n.description === 'string' ? n.description : undefined };

    let best: { el: IndexedElement; sim: number } | null = null;
    for (const el of existing) {
      if (el.type !== n.type || el.uid === n.uid) continue;
      const sim = nameDescrSimilarity(candidate, el);
      if (sim >= HINT_SIMILARITY_THRESHOLD && (!best || sim > best.sim)) best = { el, sim };
    }
    if (best) {
      hints.push({
        sim: best.sim,
        line:
          `Hinweis (kein Blocker): ${n.uid} ähnlich vorhanden: ${best.el.uid} „${best.el.name}" ` +
          `(Ähnlichkeit ${Math.round(best.sim * 100)}%) — mergen oder differenzieren.`,
      });
    }
  }
  return hints
    .sort((a, b) => b.sim - a.sim || a.line.localeCompare(b.line))
    .slice(0, MAX_HINTS)
    .map((h) => h.line);
}
