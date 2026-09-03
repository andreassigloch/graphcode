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
 * Injektionspunkt: `withNDMatrices(og, run)` klammert JEDEN Lauf, der ND sehen
 * soll — den Steering-Pfad (generationStep / nextStep → evaluateAllRules +
 * computeReadiness) und seit CR-GC-442 auch den Report-Pfad (`evaluateAll` →
 * `rules_evaluate` / `graph_readiness` / Dashboard). Vorher injizierte nur der
 * Steering-Pfad, und Near-Duplicates blieben in Verstoßliste, Report und
 * Dashboard unsichtbar.
 *
 * ND bleibt trotzdem NIE Gate-Blocker: `SE_DESCRIPTOR.rules` (der Katalog, den
 * `harness.evaluateRules()` und damit `mutate()` fährt) enthält ND-01/ND-02
 * nicht — BQ/ND sind das CODING-Profil und absichtlich draußen. Die
 * Delta-Semantik des Gates bleibt unberührt.
 *
 * ABER der Modul-State in contracts ist NICHT gate-neutral, und deshalb ist
 * `withNDMatrices` eine Klammer und kein blankes `inject`: `AO-D01`
 * (`ao-rules.ts`, im Gate-Katalog, severity info) liest die ND-02-Matrix über
 * `getND02SimilarityMatrix()` und überspringt seine Overlap-Prüfung, wenn keine
 * da ist ("no matrix → assume pass"). Eine liegengebliebene Matrix — womöglich
 * aus einer ÄLTEREN Graph-Version — ändert also, was AO-D01 im nächsten
 * Gate-/Report-Lauf meldet. Die Klammer setzt den Zustand im `finally` wieder
 * auf null zurück, damit jeder Lauf denselben Ausgangszustand sieht.
 *
 * Zusätzlich die graphcode-LOKALE Executor-MESSUNG (keine Regel, kein Block):
 * `duplicateHits` vergleicht neue REQ/UC-add-nodes per Name/Beschreibung
 * gegen den Element-Index — echte ND-Regeln für REQ/UC gehören nach contracts
 * (Familie-Review + Version-Bump, siehe CR-Abgrenzung).
 *
 * CR-GC-361: die Treffer sind strukturiert. Sie speisen ZWEI Konsumenten aus
 * EINER Berechnung — `renderDuplicateHints` das Modell-Feedback, das Best-of-N-
 * Ranking den bereinigten Fokus-Delta (`effectiveFocusDelta`). Vorher endete
 * die Messung als Textzeile, und das Ranking belohnte Scheinfortschritt.
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
  const usage = schemas.map((s) => partners(og, s.id, ['relation', 'io', 'compose']));
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
 *
 * Für Produktionspfade `withNDMatrices` benutzen: das blanke `inject` lässt den
 * Modul-State stehen, und der ist nicht gate-neutral (s. Modulkopf, AO-D01).
 */
export function injectNDMatrices(og: OntologyGraph): void {
  const nd01 = computeND01Matrix(og);
  const nd02 = computeND02Matrix(og);
  setND01SimilarityMatrix(nd01.funcIds.length >= 2 ? nd01 : null);
  setND02SimilarityMatrix(nd02.schemaIds.length >= 2 ? nd02 : null);
}

/**
 * Den contracts-Modul-State auf den Ausgangszustand zurücksetzen (CR-GC-442).
 * "Keine Matrix" ist der definierte Zustand, in dem ND schweigt und AO-D01 seine
 * Overlap-Prüfung überspringt — nicht ein zufälliger Rest eines fremden Laufs.
 */
export function clearNDMatrices(): void {
  setND01SimilarityMatrix(null);
  setND02SimilarityMatrix(null);
}

/**
 * `run` mit frisch injizierten ND-Matrizen dieses `og` ausführen und den
 * Modul-State danach IMMER zurücksetzen (CR-GC-442).
 *
 * Die Klammer, nicht das blanke `inject`, ist die eigentliche Zusicherung: der
 * contracts-Zustand ist global, und AO-D01 (Gate-Katalog) liest ihn mit. Ohne
 * `finally` hinge das Ergebnis eines Gate-/Report-Laufs davon ab, ob vorher in
 * DIESEM Prozess ein Steering-Lauf stattgefunden hat — und mit welchem Graphen.
 */
export function withNDMatrices<T>(og: OntologyGraph, run: () => T): T {
  injectNDMatrices(og);
  try {
    return run();
  } finally {
    clearNDMatrices();
  }
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
 * Ein Beinahe-Duplikat: ein neues REQ/UC aus dem Batch (`uid`) gleicht einem
 * EXISTIERENDEN Element gleichen Typs (`matchedUid`) mit `score` ≥ Threshold.
 *
 * CR-GC-361: strukturiert statt nur als Textzeile, damit das Ranking dieselbe
 * Messung sehen kann, die bisher nur ins Modell-Feedback lief.
 */
export interface DuplicateHit {
  /** uid des NEUEN Knotens aus dem Batch. */
  uid: string;
  /** uid des vorhandenen Elements, dem er gleicht. */
  matchedUid: string;
  /** Name des vorhandenen Elements — für die Hinweis-Zeile, kein zweiter Lookup. */
  matchedName: string;
  /** Name/Descr-Ähnlichkeit, ≥ HINT_SIMILARITY_THRESHOLD. */
  score: number;
}

/**
 * Beinahe-Duplikate unter den neuen REQ/UC-add-nodes eines Batches, gemessen
 * gegen den Element-Index. Duck-typed und wurffrei — jeder unerwartete Input ⇒ [].
 * Der Batch geht IMMER unverändert ans Gate; das hier ist eine MESSUNG, kein Urteil.
 *
 * Absteigend nach Ähnlichkeit, bei Gleichstand nach `uid` — deterministisch.
 * VOLLSTÄNDIG: nicht auf MAX_HINTS gekürzt, denn das Ranking zählt die Treffer
 * (die Kürzung ist eine Frage der Lesbarkeit und gehört in `renderDuplicateHints`).
 */
export function duplicateHits(input: unknown, existing: IndexedElement[]): DuplicateHit[] {
  if (typeof input !== 'object' || input === null) return [];
  const commands = (input as { commands?: unknown }).commands;
  if (!Array.isArray(commands)) return [];

  const hits: DuplicateHit[] = [];
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
      hits.push({ uid: n.uid, matchedUid: best.el.uid, matchedName: best.el.name, score: best.sim });
    }
  }
  return hits.sort((a, b) => b.score - a.score || a.uid.localeCompare(b.uid));
}

/**
 * Die Hinweis-Zeilen fürs Modell-Feedback — dieselbe Messung, nur gerendert und
 * auf MAX_HINTS gekürzt. Kein zweiter Berechnungspfad (CR-GC-361).
 */
export function renderDuplicateHints(hits: DuplicateHit[]): string[] {
  return hits
    .slice(0, MAX_HINTS)
    .map(
      (h) =>
        `Hinweis (kein Blocker): ${h.uid} ähnlich vorhanden: ${h.matchedUid} „${h.matchedName}" ` +
        `(Ähnlichkeit ${Math.round(h.score * 100)}%) — mergen oder differenzieren.`,
    );
}
