/**
 * decisions.ts — das Register der Entscheidungen, die dem Agenten als TEXT begegnen (CR-GC-587).
 *
 * Serie CR-GC-564..583: sieben Widersprueche, die erst ein Lauf fand — vier davon Text gegen
 * Code. Die Rangfolge der Verdicts stand an vier Stellen (`rankCandidates`, Host-Protokoll,
 * `se:generate` zweimal, alloc-Vorlage), drei waren falsch. Und das Host-Protokoll aus
 * CR-GC-583 nannte den Steuerwert VOR dem tier — `rankCandidates` sortiert tier vor Steuerwert.
 * Tests pruefen den Code; die Texte prueft dieser Baustein: jede Entscheidung hat hier EINE
 * Fassung, Protokoll und Skills setzen sie ein, `tests/decision-texts.test.ts` verbietet die
 * widersprechenden Formulierungen in allem, was ausgeliefert wird.
 *
 * @author andreas@siglochconsulting
 */

/**
 * Die Reihenfolge, in der `rankCandidates` (executor-rank.ts) Verdicts vergleicht — als Daten,
 * damit der Prosa-Satz daraus abgeleitet wird und nicht daneben gepflegt.
 * `tests/decision-texts.test.ts` pinnt die Ordnung gegen den Komparator.
 */
export const VERDICT_ORDER = [
  { key: 'viable', text: 'block verwerfen' },
  { key: 'focusDelta', text: 'steeringDelta der Fokus-Dimension' },
  { key: 'blockingRise', text: 'kein Anstieg blockierender Fehler' },
  { key: 'totalDelta', text: 'Gesamt-Readiness-Delta' },
  { key: 'tier', text: 'tier (auto-apply > suggest)' },
  { key: 'removesElements', text: 'ein Zug, der nichts entfernt' },
  { key: 'steerImprovement', text: 'steerAdvisory.improvement (entschaerft der Zug die schlimmste Stelle?)' },
  { key: 'mutations', text: 'Element-Ausbeute' },
] as const;

export interface Decision {
  /** Der eine Satz, den jeder Text einsetzt. */
  readonly text: string;
  /** Formulierungen, die dieser Entscheidung widersprechen — in KEINEM ausgelieferten Text erlaubt. */
  readonly forbidden: readonly RegExp[];
  /** Woher die Entscheidung kommt. */
  readonly source: string;
}

export const DECISIONS = {
  /** CR-GC-577: die Probe gilt Alternativen, nie einem einzelnen Batch. */
  probe: {
    text:
      'Hast du MEHRERE Alternativen, reiche sie zuerst mit dryRun:true ein und vergleiche die Verdicts. ' +
      'Hast du nur EINEN Batch, reiche ihn direkt OHNE dryRun ein: eine Ablehnung persistiert nichts, ' +
      'die Probe wuerde dir dieselbe Antwort nur ein zweites Mal liefern.',
    forbidden: [/jeden Batch[^.]{0,60}dryRun/i, /every batch[^.]{0,60}dryRun/i, /dryRun:?\s*true\W+first/i, /immer (zuerst )?dryRun/i],
    source: 'CR-GC-577',
  },
  /** CR-GC-483/583: der Steuerwert rankt, der ℝ⁶ (fitAdvisory) berichtet — abgeleitet aus VERDICT_ORDER. */
  verdictRank: {
    text:
      'Rangfolge: ' +
      VERDICT_ORDER.map((v) => v.text).join('; dann ') +
      '. fitAdvisory ist nur Bericht und entscheidet ohne Zielprofil nicht — es nennt echte Umstrukturierungen ' +
      '(eine eingezogene Ebene) Regression.',
    forbidden: [
      /tier[^.]{0,60}\bund\b[^.]{0,20}fitAdvisory/, // "tier ... und fitAdvisory (Δm ...)" — die abgesetzte Ordnung
      /Δm-Vergleich entscheidet/,
      /fitAdvisory \(Δm/,
      /steerAdvisory[^.]{0,80}dann tier/, // Steuerwert vor tier — CR-GC-583s eigener Fehler
    ],
    source: 'CR-GC-483, CR-GC-583, rankCandidates',
  },
  /** CR-GC-296/582: wann `done` — die Freigabe auf graph_suggest. */
  handoff: {
    text:
      'done ist true genau in phase handoff: alle Readiness-Dimensionen ≥ Schwelle, keine error-Violations, ' +
      'kein Phase-Gate mit offenen Regeln (Steuerregeln ausgenommen).',
    forbidden: [/done[^.]{0,40}wenn keine Warnungen/i],
    source: 'CR-GC-296, CR-GC-582',
  },
} as const satisfies Record<string, Decision>;

/** Der Satz zu einer Entscheidung — die einzige Art, ihn in einen Prompt zu bekommen. */
export function decision(key: keyof typeof DECISIONS): string {
  return DECISIONS[key].text;
}
