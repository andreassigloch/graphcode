/**
 * nd-similarity.ts — REQ/UC-Duplikat-Hinweis fuer den Executor (CR-GC-287).
 *
 * CR-SM-286: **die ND-Matrix-Rechnung und die Injektion sind entfallen.** Sie liegen jetzt in
 * `@sigloch/contracts/se` (`similarity.ts`), wo auch die Regeln stehen — ND-01/ND-02 rechnen
 * ihre Aehnlichkeit selbst. Damit faellt hier alles weg, was die Naht getragen hat:
 *
 *   - `computeND01Matrix`/`computeND02Matrix` — zeichengleich nach contracts uebernommen
 *   - `injectNDMatrices` und die Klammer `withNDMatrices(og, run)` samt `finally`-Reset
 *
 * Die Klammer existierte, weil der contracts-Modulzustand NICHT gate-neutral war: AO-D01 las die
 * ND-02-Matrix ueber `getND02SimilarityMatrix()` und uebersprang seine Overlap-Pruefung, wenn
 * keine da war. Eine liegengebliebene Matrix aus einer aelteren Graph-Version haette das
 * Gate-Ergebnis verschoben. Es gibt keinen Modulzustand mehr, also auch nichts mehr zu klammern.
 *
 * Was BLEIBT ist die graphcode-LOKALE Executor-Messung (keine Regel, kein Block): `duplicateHits`
 * vergleicht neue REQ/UC-add-nodes per Name/Beschreibung gegen den Element-Index. Echte
 * ND-Regeln fuer REQ/UC gehoeren nach contracts (Familie-Review + Version-Bump).
 *
 * CR-GC-361: die Treffer sind strukturiert. Sie speisen ZWEI Konsumenten aus EINER Berechnung —
 * `renderDuplicateHints` das Modell-Feedback, das Best-of-N-Ranking den bereinigten Fokus-Delta
 * (`effectiveFocusDelta`). Vorher endete die Messung als Textzeile, und das Ranking belohnte
 * Scheinfortschritt.
 *
 * @author andreas@siglochconsulting
 */import type { OntologyGraph } from '@sigloch/contracts/se';

// ---------------------------------------------------------------------------
// Text-Grundbausteine (deterministisch, sprachneutral)
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

/**
 * `run` mit frisch injizierten ND-Matrizen dieses `og` ausführen und den
 * Modul-State danach IMMER zurücksetzen (CR-GC-442).
 *
 * Die Klammer, nicht das blanke `inject`, ist die eigentliche Zusicherung: der
 * contracts-Zustand ist global, und AO-D01 (Gate-Katalog) liest ihn mit. Ohne
 * `finally` hinge das Ergebnis eines Gate-/Report-Laufs davon ab, ob vorher in
 * DIESEM Prozess ein Steering-Lauf stattgefunden hat — und mit welchem Graphen.
 */

// ---------------------------------------------------------------------------
// REQ/UC-Duplikat-HINWEIS für den Executor-Preflight (kein Block, keine Regel)
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
