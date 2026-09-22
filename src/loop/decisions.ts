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

// CR-GC-598: die abnehmbare Klasse lebt im Kernel (focus-set.ts), weil Schritt, Probe und Bericht
// sie teilen; hier nur der Text dazu.
import { ABNEHMBAR_JE_TASK } from '../kernel/measure/focus-set.js';
export { ABNEHMBAR_JE_TASK };

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
      'done ist true genau dann, wenn die Maschine keinen Fokus mehr hat: kein offener Fund einer Gate-Regel ' +
      '(ohne info, abgenommene Funde ausgenommen). Schwelle und Phasen-Gates sind Bericht, keine Waechter.',
    forbidden: [/alle Phase-Gates[^.]{0,40}regel-vollständig/, /Dimensionen ≥ \$\{threshold\}[^.]{0,80}Phase-Gate/],
    source: 'CR-GC-593',
  },
  /** CR-GC-592: offene Punkte des Auftrags sind Annahmen im Modell, keine Rueckfragen ins Leere. */
  openQuestions: {
    text:
      'Eine offene Entscheidung des Auftraggebers (unbekannter Kanal, offener Zielwert, ungeklaerte Reihenfolge) ' +
      'wird als Annahme ins Modell gelegt — Assumption Review (se-irr), REQ mit offenem Zielwert oder ACTOR mit ' +
      'offenem Kanal — und in der Schlussmeldung genannt. Gefragt wird nur, wenn ein Mensch antworten kann.',
    forbidden: [/AskUserQuestion[^.]{0,60}(immer|always)/i],
    source: 'CR-GC-592',
  },
  /** CR-GC-596/606: dreimal dasselbe Feedback → weiter; nur noch Zurueckgestelltes → stalled, nicht done. */
  stalled: {
    text:
      'Steht derselbe Fokus nach zwei Zuegen noch, stellt die Maschine ihn zurueck und nennt den naechsten ' +
      '(Eintrittspunkte nie — die loest nur ihr Task oder eine Abnahme). ' +
      'Meldet sie phase stalled, sind nur noch zurueckgestellte Funde offen: nicht weiter mutieren, sondern ' +
      'der Ansage folgen — im Task zurueck in den Kern, bei offenem Eintrittspunkt den Task starten, sonst ' +
      'die Funde und deine Versuche in der Schlussmeldung nennen. stalled ist nicht fertig.',
    forbidden: [/stalled[^.]{0,40}(ist|gilt als) (fertig|done)/i],
    source: 'CR-GC-596/604/606',
  },
  /** CR-GC-594: die benannte Abweichung — nur fuer die Klasse, die im Modell nicht erfuellbar ist. */
  acceptance: {
    text:
      'Einen Fund, der im Modell nicht erfuellbar ist, legst du als benannte Abweichung ab: ' +
      '`acceptedFindings: [{ruleId, reason}]` am betroffenen Element (graphweite Regeln am SYS), der Grund ist Pflicht. ' +
      'Im Kern abnehmbar sind nur die Eintrittspunkte ' + ABNEHMBAR_JE_TASK.kern.join(', ') +
      ' (das Artefakt ist im schlanken Umfang nicht noetig); in einem Task: ' +
      (Object.entries(ABNEHMBAR_JE_TASK) as [string, readonly string[]][])
        .filter(([t, ids]) => t !== 'kern' && ids.length > 0)
        .map(([t, ids]) => `${t} ${ids.join('/')}`)
        .join(', ') +
      '. Architekturregeln sind nicht abnehmbar — eine Abnahme daran zaehlt nicht, der Fund bleibt: bauen.',
    forbidden: [/acceptedFindings[^.]{0,80}(jede|alle|beliebige) Regel/i],
    source: 'CR-GC-594, CR-GC-600',
  },
} as const satisfies Record<string, Decision>;

/** Der Satz zu einer Entscheidung — die einzige Art, ihn in einen Prompt zu bekommen. */
export function decision(key: keyof typeof DECISIONS): string {
  return DECISIONS[key].text;
}
