/**
 * target-profile.ts — das ℝ⁶-Zielprofil + Intentions-Anker als Steuer-Config
 * (CR-GC-295). KEIN Graph-SSOT: das Profil steuert graph_suggest/graph_generate
 * wie ExecutorConfig/.mcp.json — deshalb Datei statt mutate(), aber committet
 * (`!.graphcode/target-profile.json`-Ausnahme in .gitignore: Projekt-Config,
 * nicht Maschinen-Config).
 *
 * EIN Check-Pfad: der Konflikt-Check läuft bei JEDEM Load — ein manueller
 * Datei-Edit durchläuft damit denselben Check wie die Skill-Route
 * (se:target-profile schreibt die Datei, der nächste Read prüft). Konflikte
 * sind WARNUNG, nie Block (Analogie R-19/R-20): ein Zielkonflikt kann eine
 * bewusste Operator-Entscheidung sein — nur unsichtbar darf er nicht bleiben.
 *
 * Die Konfliktpaare sind aus den Metrik-Formeln hergeleitet
 * (@sigloch/se-engine), kein Anspruch auf Vollständigkeit —
 * Erweiterung ist ein kleiner Nachtrag, kein eigener CR.
 *
 * @author andreas@siglochconsulting
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod/v4';
import { tokens } from './nd-similarity.js';

// ---------------------------------------------------------------------------
// Schema — die 6 MetricVector-Dimensionen, Gewicht je Dimension in [-1,1]
// ---------------------------------------------------------------------------

const weight = z.number().min(-1).max(1);

/** Die Gewichts-Form ist identisch zum graph_suggest-`target`-Input — suggest.ts importiert sie (kein Parallelpfad). */
export const TargetWeightsSchema = z.strictObject({
  modifiability: weight.optional(),
  faultTolerance: weight.optional(),
  flowEfficiency: weight.optional(),
  coherence: weight.optional(),
  viability: weight.optional(),
  scalability: weight.optional(),
});
export type TargetWeights = z.infer<typeof TargetWeightsSchema>;

export const TargetProfileSchema = z.strictObject({
  /** ℝ⁶-Zielrichtung; leer = unentschieden (Gleichgewichtung, CR-289-Verhalten). */
  weights: TargetWeightsSchema.default({}),
  /** Die 3–7 inhaltlichen Kernthemen der Intention, vom Menschen bestätigt. */
  intentAnchors: z.array(z.string().min(1)).min(3).max(7).optional(),
});
export type TargetProfile = z.infer<typeof TargetProfileSchema>;

/** Pfad relativ zum Repo-Root — committet (Ausnahme vom .graphcode/-gitignore). */
export const TARGET_PROFILE_REL = join('.graphcode', 'target-profile.json');

// ---------------------------------------------------------------------------
// Konflikt-Check — formelmäßig hergeleitete Gegenpaare (Warning, kein Block)
// ---------------------------------------------------------------------------

interface ConflictPair {
  a: (keyof TargetWeights)[];
  b: (keyof TargetWeights)[];
  why: string;
}

const CONFLICT_PAIRS: ConflictPair[] = [
  {
    a: ['modifiability', 'coherence'],
    b: ['flowEfficiency'],
    why: 'hohe Modularität/Kohäsion lebt von wenigen community-übergreifenden Kanten, kurze mittlere I/O-Pfadlänge von mehr Querverbindungen',
  },
  {
    a: ['coherence', 'modifiability'],
    b: ['scalability'],
    why: 'straffe Kohärenz braucht meist einen Gateway-Knoten, dessen Betweenness steigt genau dann, wenn scalability (1 − maxBetweenness) sinken soll',
  },
];

/** Beide Seiten eines bekannten Gegenpaars positiv gewichtet ⇒ eine Warnzeile je Paar. */
export function conflictWarnings(weights: TargetWeights): string[] {
  const positive = (dims: (keyof TargetWeights)[]): (keyof TargetWeights)[] =>
    dims.filter((d) => (weights[d] ?? 0) > 0);
  return CONFLICT_PAIRS.flatMap((pair) => {
    const a = positive(pair.a);
    const b = positive(pair.b);
    if (a.length === 0 || b.length === 0) return [];
    return [
      `Zielkonflikt (Warnung, kein Block): ${a.join('/')} und ${b.join('/')} gleichzeitig heben zieht in Gegenrichtungen — ${pair.why}.`,
    ];
  });
}

// ---------------------------------------------------------------------------
// Loader — der EINE Pfad; Check bei jedem Read
// ---------------------------------------------------------------------------

export interface LoadedTargetProfile {
  profile: TargetProfile;
  /** Konflikt-Warnungen des aktuellen Gewichtsstands — bei jedem Load frisch. */
  conflicts: string[];
}

/**
 * `.graphcode/target-profile.json` lesen, Zod-validieren, Konflikte prüfen.
 * Fehlende Datei ⇒ null (kein Profil ist gültig — Verhalten wie vor CR-295).
 * Ungültige Datei ⇒ Fehler mit Pfad (Config-Typo laut scheitern lassen,
 * nie stumm als "kein Profil" durchwinken).
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
  return { profile: parsed.data, conflicts: conflictWarnings(parsed.data.weights) };
}

// ---------------------------------------------------------------------------
// Intentions-Anker — deterministische Extraktion + Coverage-Read-out (KPI)
// ---------------------------------------------------------------------------

/** Funktionswörter (de/en), die als Anker nichts verankern. */
const STOPWORDS = new Set([
  'und', 'oder', 'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einem', 'einen', 'einer', 'eines',
  'mit', 'für', 'von', 'aus', 'auf', 'bei', 'nach', 'über', 'unter', 'zum', 'zur', 'als', 'auch', 'dass',
  'sich', 'sie', 'wir', 'ihr', 'ihre', 'ihren', 'sein', 'seine', 'werden', 'wird', 'kann', 'können',
  'soll', 'sollen', 'muss', 'müssen', 'nicht', 'sowie', 'damit', 'dabei', 'dann', 'noch', 'sind', 'ist',
  'the', 'and', 'with', 'for', 'from', 'that', 'this', 'are', 'can', 'shall', 'must', 'will', 'its',
  'into', 'over', 'their', 'them', 'they', 'not', 'has', 'have',
]);

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
 * Anker aus der Prosa-Intention: Wort-Token (dieselbe Normalisierung wie der
 * ND-Preflight-Hint, CR-GC-287: `tokens()`) minus Funktionswörter und minus
 * generischer Substantive, in Erstauftritts-Reihenfolge, max 7.
 *
 * CR-GC-307: das Ergebnis wird dem Menschen NICHT mehr zur Bestätigung vorgelegt —
 * die Anker sind ein internes Steuerungsmittel, kein Kundenbegriff. Sie werden still
 * gesetzt (`persistIntentAnchors`); reicht die Intention dafür nicht
 * (`isIntentTooThin`), stellt der Loop stattdessen fachliche Rückfragen.
 */
export function extractIntentAnchors(intent: string): string[] {
  const out: string[] = [];
  for (const t of tokens(intent)) {
    if (STOPWORDS.has(t) || GENERIC_NOUNS.has(t)) continue;
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
 * MERGE, kein Überschreiben: ein hand-gepflegter `weights`-Block überlebt.
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
