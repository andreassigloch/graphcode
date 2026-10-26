/**
 * target-profile.ts — die Themen der Intention als Steuer-Config (CR-GC-295, CR-GC-307).
 * KEIN Graph-SSOT: die Datei steuert graph_generate wie ExecutorConfig/.mcp.json —
 * deshalb Datei statt mutate(), aber committet (`!.graphcode/target-profile.json`-Ausnahme
 * in .gitignore: Projekt-Config, nicht Maschinen-Config).
 *
 * CR-GC-861 (Teil 3 von CR-GC-853): Gewichte, Zielwerte und der Zielkonflikt-Check sind
 * zurückgebaut. Die Datei trägt nur noch die Themen; eine Entscheidung des Autors über die
 * Architektur steht als Constraint im Modell (CR-GC-804).
 *
 * @author andreas@siglochconsulting
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
// CR-GC-488: `tokens` kommt aus contracts, nicht aus dem lokalen ND-Modul — dort stand
// bis hierher eine zweite, zeichengleiche Kopie (die Naht aus CR-SM-286 fiel, die
// Bausteine blieben liegen).
import { tokens } from '@sigloch/contracts/se';
import { TargetProfileSchema, type TargetProfile } from './target-profile-contract.js';

// Seit CR-GC-419 steht der Vertrag in `./target-profile-contract.ts`; hier nur re-exportiert,
// damit bestehende Importe eine Definition sehen. Es gibt weiterhin genau eine.
export { TargetProfileSchema };
export type { TargetProfile };

/** Pfad relativ zum Repo-Root — committet (Ausnahme vom .graphcode/-gitignore). */
export const TARGET_PROFILE_REL = join('.graphcode', 'target-profile.json');

// ---------------------------------------------------------------------------
// Loader — der EINE Lesepfad
// ---------------------------------------------------------------------------

export interface LoadedTargetProfile {
  profile: TargetProfile;
}

/**
 * `.graphcode/target-profile.json` lesen und Zod-validieren.
 * Fehlende Datei ⇒ null (kein Profil ist gültig).
 * Ungültige Datei ⇒ Fehler mit Pfad (Config-Typo laut scheitern lassen,
 * nie stumm als "kein Profil" durchwinken) — seit CR-GC-861 auch eine Datei mit Gewichten.
 */
export function loadTargetProfile(repoRoot: string): LoadedTargetProfile | null {
  const path = join(repoRoot, TARGET_PROFILE_REL);
  if (!existsSync(path)) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`target-profile: ${path} ist kein gültiges JSON — ${(e as Error).message}`);
  }
  const parsed = TargetProfileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`target-profile: ${path} verletzt das Schema — ${parsed.error.message}`);
  }
  return { profile: parsed.data };
}

// ---------------------------------------------------------------------------
// Intentions-Anker — deterministische Extraktion + Coverage-Read-out (KPI)
// ---------------------------------------------------------------------------

/**
 * Funktionswörter (de/en), die als Anker nichts verankern. Getrennt nach Sprache, weil sie
 * zusätzlich die Sprache des Auftrags bestimmen (CR-GC-687, {@link isGermanText}).
 */
const STOPWORDS_DE = new Set([
  'und', 'oder', 'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einem', 'einen', 'einer', 'eines',
  'mit', 'für', 'von', 'aus', 'auf', 'bei', 'nach', 'über', 'unter', 'zum', 'zur', 'als', 'auch', 'dass',
  'sich', 'sie', 'wir', 'ihr', 'ihre', 'ihren', 'sein', 'seine', 'werden', 'wird', 'kann', 'können',
  'soll', 'sollen', 'muss', 'müssen', 'nicht', 'sowie', 'damit', 'dabei', 'dann', 'noch', 'sind', 'ist',
]);
const STOPWORDS_EN = new Set([
  'the', 'and', 'with', 'for', 'from', 'that', 'this', 'are', 'can', 'shall', 'must', 'will', 'its',
  'into', 'over', 'their', 'them', 'they', 'not', 'has', 'have', 'where', 'which', 'who', 'when',
]);
const STOPWORDS = new Set([...STOPWORDS_DE, ...STOPWORDS_EN]);

/**
 * Generische Substantive, die grammatisch tragen, fachlich aber nichts verankern
 * (CR-GC-307). Sie sind KEINE Funktionswörter — sie stehen an Substantivstellen und
 * überleben den STOPWORDS-Filter. Als Anker sind sie trotzdem wertlos: „System",
 * „Daten", „App" matchen fast jedes Element, die Coverage meldet dann 100 % und sagt
 * damit nichts. Getrennt gehalten von STOPWORDS, weil die zwei Listen aus
 * unterschiedlichen Gründen existieren und nicht gemeinsam gepflegt werden sollten.
 */
const GENERIC_NOUNS = new Set([
  'system', 'systeme', 'app', 'anwendung', 'anwendungen', 'tool', 'tools', 'software',
  'daten', 'datei', 'dateien', 'verwalten', 'verwaltung', 'management', 'plattform',
  'loesung', 'lösung', 'programm', 'projekt', 'service', 'dienst',
  'application', 'applications', 'data', 'manage', 'managing', 'platform', 'solution',
  'program', 'project', 'thing', 'things', 'stuff',
]);

/**
 * Deutscher Auftrag? Mehr deutsche als englische Funktionswörter (CR-GC-687). Nur dann trägt
 * die Großschreibung eine Wortart; bei Gleichstand (auch 0:0) gilt sie nicht.
 */
function isGermanText(intent: string): boolean {
  let de = 0;
  let en = 0;
  for (const m of intent.toLowerCase().matchAll(/[\p{L}\p{N}]+/gu)) {
    if (STOPWORDS_DE.has(m[0])) de += 1;
    else if (STOPWORDS_EN.has(m[0])) en += 1;
  }
  return de > en;
}

/**
 * Die Substantive und Eigennamen eines deutschen Textes, kleingeschrieben (CR-GC-687): jedes
 * Wort, das groß beginnt und NICHT am Satzanfang steht. Am Satzanfang ist Großschreibung kein
 * Wortart-Signal („Spezifiziere …", „Die …") — ein Wort von dort zählt nur, wenn es an anderer
 * Stelle im Satzinneren wieder groß steht. Satzgrenze: Textanfang oder `.`/`!`/`?`/`:`/`;`/
 * Zeilenumbruch seit dem letzten Wort.
 */
function germanNounForms(intent: string): Set<string> {
  const nomen = new Set<string>();
  let letztesEnde = -1;
  for (const m of intent.matchAll(/[\p{L}\p{N}]+/gu)) {
    const start = m.index ?? 0;
    const satzanfang = letztesEnde < 0 || /[.!?:;\n]/.test(intent.slice(letztesEnde, start));
    if (!satzanfang && /^\p{Lu}/u.test(m[0])) nomen.add(m[0].toLowerCase());
    letztesEnde = start + m[0].length;
  }
  return nomen;
}

/**
 * Anker aus der Prosa-Intention: Wort-Token (dieselbe Normalisierung wie der
 * ND-Preflight-Hint, CR-GC-287: `tokens()`) minus Funktionswörter und minus
 * generischer Substantive, in Erstauftritts-Reihenfolge, max 7.
 *
 * CR-GC-687: Anker sind BEGRIFFE — der Rundenprompt fragt je unadressiertem Anker nach einem
 * Use Case. Ein deutscher Auftrag liefert deshalb nur Substantive und Eigennamen
 * ({@link germanNounForms}); die Wortart steht dort in der Großschreibung, die `tokens()`
 * wegwirft. Ohne diesen Filter wurden aus „Spezifiziere … bis zur Implementierungsreife. Die
 * Projektdefinition liegt …" die Anker `spezifiziere`, `bis`, `liegt`. Englisch trägt dieses
 * Signal nicht — dort bleibt es beim Funktionswort-Filter.
 *
 * CR-GC-307: das Ergebnis wird dem Menschen NICHT mehr zur Bestätigung vorgelegt —
 * die Anker sind ein internes Steuerungsmittel, kein Kundenbegriff. Sie werden still
 * gesetzt (`persistIntentAnchors`); reicht die Intention dafür nicht
 * (`isIntentTooThin`), stellt der Loop stattdessen fachliche Rückfragen.
 */
export function extractIntentAnchors(intent: string): string[] {
  const nomen = isGermanText(intent) ? germanNounForms(intent) : null;
  const out: string[] = [];
  for (const t of tokens(intent)) {
    if (STOPWORDS.has(t) || GENERIC_NOUNS.has(t)) continue;
    if (nomen && !nomen.has(t)) continue;
    out.push(t);
    if (out.length === 7) break;
  }
  return out;
}

/** Untergrenze aus dem Schema (`intentAnchors` ist 3..7) — darunter gäbe es keine gültige Config. */
const MIN_ANCHORS = 3;

/**
 * Trägt die Intention zu wenig, um die Steuerung daraus abzuleiten? (CR-GC-307)
 *
 * Deterministisch, nicht nach Modell-Gefühl: es gibt genau einen Auslöser — weniger
 * als {@link MIN_ANCHORS} trennscharfe Inhaltswörter nach Stopword- und
 * Generika-Filter. Beides zusammen deckt die zwei realen Fälle ab: eine zu kurze
 * Intention („Ein Shop") und eine, die nur aus Floskeln besteht („ein System zum
 * Verwalten von Daten"). Ist das der Fall, fragt der Loop FACHLICH nach — nie nach
 * den Ankern selbst.
 */
export function isIntentTooThin(intent: string): boolean {
  return extractIntentAnchors(intent).length < MIN_ANCHORS;
}

/**
 * Anker im Hintergrund nach `.graphcode/target-profile.json` schreiben (CR-GC-307).
 *
 * Drei Verweigerungsgründe, jeweils `false` und Datei unverändert:
 *  - die Config trägt schon `intentAnchors` (ein bestätigter Mensch-Wert wird nie
 *    von einer Ableitung überschrieben),
 *  - die Anker-Anzahl liegt außerhalb 3..7 (eine schema-ungültige Datei würde jeden
 *    späteren `loadTargetProfile` werfen lassen — ein Hintergrund-Schritt darf die
 *    Config nicht vergiften),
 *  - die vorhandene Datei ist unlesbar/ungültig (dann gehört sie dem Menschen; das
 *    laute Scheitern beim nächsten Read ist die richtige Reaktion, nicht ein
 *    stiller Überschreiber).
 *
 * MERGE, kein Überschreiben: was sonst in der Datei steht, bleibt.
 */
export function persistIntentAnchors(repoRoot: string, anchors: string[]): boolean {
  if (anchors.length < MIN_ANCHORS || anchors.length > 7) return false;
  const path = join(repoRoot, TARGET_PROFILE_REL);
  let existing: Record<string, unknown> = {};
  if (existsSync(path)) {
    try {
      const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return false;
      existing = raw as Record<string, unknown>;
    } catch {
      return false;
    }
    if (Array.isArray(existing['intentAnchors']) && existing['intentAnchors'].length > 0) return false;
  }
  const merged = { ...existing, intentAnchors: anchors };
  if (!TargetProfileSchema.safeParse(merged).success) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  return true;
}

/** Minimaler Element-Blick für die Coverage — og-Elemente (id) und Graph-Nodes (uid→id gemappt). */
export interface CoverageElement {
  id: string;
  type: string;
  name: string;
  description?: string;
}

export interface AnchorCoverage {
  anchor: string;
  addressed: boolean;
  /** Bis zu 3 adressierende Element-ids (sortiert) — "wo", nicht "wie gut". */
  elements: string[];
}

const COVERAGE_TYPES = new Set(['UC', 'REQ', 'FUNC']);

/**
 * Intent-Coverage: je Anker, ob (und wo) er in UC/REQ/FUNC adressiert ist —
 * alle Anker-Token müssen im Namens-/Beschreibungs-Tokenset des Elements
 * vorkommen. KPI/Read-out, NIE ein Gate-Blocker: Abdeckung sagt "adressiert",
 * nicht "gut gelöst".
 */
export function intentCoverage(anchors: string[], elements: CoverageElement[]): AnchorCoverage[] {
  const indexed = elements
    .filter((e) => COVERAGE_TYPES.has(e.type))
    .map((e) => ({ id: e.id, toks: tokens(`${e.name} ${e.description ?? ''}`) }));
  return anchors.map((anchor) => {
    const anchorTokens = [...tokens(anchor)];
    const hits =
      anchorTokens.length === 0
        ? []
        : indexed
            .filter((e) => anchorTokens.every((t) => e.toks.has(t)))
            .map((e) => e.id)
            .sort()
            .slice(0, 3);
    return { anchor, addressed: hits.length > 0, elements: hits };
  });
}
