/**
 * tool-help.ts — was ein Werkzeug TUT, auf Abruf (CR-GC-612).
 *
 * Die Zuständigkeit war doppelt: die Werkzeugbeschreibung stand in jeder Runde im Kontext des
 * Executors (gemessen 25.232 Zeichen über 24 Werkzeuge, davon `graph_readiness` 3.556 und
 * `graph_metrics` 3.491) und trug dort Regelsemantik statt Auswahlhilfe. Eine Beschreibung
 * beantwortet **wann nehme ich es**; **was es im Einzelnen bedeutet** gehört hierher und wird
 * geholt, wenn jemand fragt.
 *
 * Kein zweiter Kanal: `graph_help` liest diese Einträge über dieselbe `helpEntry`-Zusammenführung
 * wie Regeln, Gates und Artefakte — eine Hilfe-Oberfläche, nicht zwei.
 *
 * @author andreas@siglochconsulting
 */

/** Die beiden Schichten, die ein Werkzeug-Eintrag trägt — wie bei Regeln: umgangssprachlich, dann SE. */
export interface ToolHelpEntry {
  /** Layer 0 — ohne Jargon: was kommt heraus und wozu. */
  plain: string;
  /** Layer 1 — die Genauigkeit: Felder, Katalog-Herkunft, Fallstricke. */
  se: string;
}

export const TOOL_HELP: Record<string, ToolHelpEntry> = {
  graph_readiness: {
    plain:
      'Wo steht das Projekt: wie viel ist erledigt (Abdeckung) und wie schlimm ist das Schlimmste, ' +
      'das offen ist (Ausprägung). Beides aus demselben Regellauf, damit die Zahl auf dem Dashboard ' +
      'genau die ist, aus der die Empfehlung entstand.',
    se:
      'ReadinessReport aus `harness.evaluateRules()` (L2-Gate) plus RC-Code-Konformanz. Blöcke:\n' +
      '• `compliance` — Anteil der Elemente ohne error-Verstoß.\n' +
      '• `phaseGates` SRR/PDR/CDR/TRR — INCOSE-Reviews als disjunkte Partition der Element-Regeln, ' +
      'Vollständigkeit der Ableitungskette.\n' +
      '• `implGates` SAR/FCA/SVR/FRR — Meilenstein-Stufen MS-1..4, fertig genau dann, wenn die ' +
      'zugeordneten CR done UND ihr Umfang error-frei sind.\n' +
      '• `phase_readiness` — DIESELBEN vier Gates von der anderen Achse: Regelabdeckung je Gate ' +
      '(abgedeckte/alle Regel-IDs aus RULE_TO_PHASE ohne offenen Verstoß, plus die fehlenden IDs). ' +
      'Orthogonal zur Element-Vollständigkeit von `phaseGates`.\n' +
      '• `dimension_readiness` — die 8 RULE_TO_DIMENSION-Themenscores (req/uc/arch/alloc/ver/schema/' +
      'cr/ms), gescored aus dem VOLLEN contracts-Katalog inkl. BQ-*/ND-*, also einer WEITEREN ' +
      'Grundgesamtheit als `violationsByRule`.\n' +
      '• `steer` — der Steuerungsraum aus demselben Snapshot: worst/worstAt/mean/score/measured plus ' +
      'ein Term je gemessener Blackbox. KLEINER IST BESSER, 0 heißt: jede Blackbox im Budget. ' +
      '`score` nur zusammen mit `measured` lesen — score 0 bei measured 0 heißt "nichts gemessen", ' +
      'nicht "alles gut". Nie nachrechnen: Normierung `(value − threshold)/threshold` und die ' +
      'geschlossene Liste STEER_RULES leben in se-engine, eine zweite Rechnung wäre eine zweite Wahrheit.\n' +
      '• `catalogs` — welcher Zahlenblock aus welchem Regelkatalog stammt.\n' +
      '• `skipped` — was NICHT ausgewertet wurde, als `rule:<id>`. Ohne dieses Feld ist ' +
      '`violationsByRule` nicht interpretierbar.\n' +
      '• `importCoverage` — die REICHWEITE neben dem Urteil: wie viel des Import-Graphen die ' +
      'RC-Auflösung ansehen konnte. Ohne sie sieht 0 % Bindung aus wie 0 Verstöße.\n' +
      '• `umfang` (CR-GC-613) — was diese Sitzung angefasst hat; die SCORES bleiben global.',
  },
  graph_metrics: {
    plain:
      'Welches Modul ist das Kopplungsproblem: Fan-in/Fan-out, Instabilität und Kohäsion je MOD, ' +
      'immer zusammen mit der Schwelle, gegen die geurteilt wurde. `graph_readiness` sagt "alloc ist ' +
      '87 %", das hier sagt WELCHES Modul.',
    se:
      'Je MOD: `fanIn`/`fanOut` (allocate- und io-Kanten), `instability` I = fanOut/(fanIn+fanOut), ' +
      '`lcom4` (Zusammenhangskomponenten der FUNC-Whitebox) und `cohesion`. Die Schwellen stammen aus ' +
      'der Metrik-Policy des Repos, nicht aus Konstanten im Werkzeug — dieselben, gegen die MT-01/MT-02/' +
      'MT-04 urteilen. Ein Wert ohne seine Schwelle ist keine Aussage: derselbe LCOM4 ist in einem ' +
      'Adapter normal und in einem Kern ein Befund.',
  },
  rules_evaluate: {
    plain:
      'Das ganze Bild: welche Regeln feuern, welche nicht ausgewertet werden konnten und welche der ' +
      'Regelkatalog gar nicht am Gate führt. Die Diagnose, nicht der Arbeitsvorrat.',
    se:
      'Drei Schichten, die sich nicht überschneiden:\n' +
      '• `violations` — die Befunde der AUSGEWERTETEN Regeln.\n' +
      '• `skipped` — Regel-IDs, die in DIESER Antwort nicht ausgewertet wurden (BQ-*, und RC-*, wenn ' +
      'der Quellbaum nicht messbar war). Eine feuernde Regel steht NIE in `skipped`.\n' +
      '• `notInGate` — Regeln, die der Gate-Katalog nicht führt (ND-*, RC-*). Sie können hier feuern, ' +
      'blockieren aber nie eine Mutation.\n' +
      '`importCoverage` nennt die Reichweite der RC-Auflösung. Ein Ergebnis ohne `skipped` zu lesen ' +
      'heißt, eine Zahl für vollständig zu halten, die es nicht ist.',
  },
  graph_suggest: {
    plain:
      'Welcher Umbau zahlt sich aus: Kandidaten-Edits, gerankt danach, wie weit jeder das Modell in ' +
      'Richtung Zielprofil bewegt. Er schlägt vor; angewandt wird über `graph_mutate`, nie automatisch.',
    se:
      'Je Vorschlag: `ruleId`/`elementId` (woher er kommt), `delta` (Δm in ℝ⁶), `score` (Verbesserung ' +
      'des Steuerwerts), `steer` und — wenn eine Fix-Vorlage einen Edit HERLEITEN konnte — `edit` mit ' +
      'seiner `rationale`. Der generische `applyRule`-Trace ist eine Δm-RICHTUNGSSONDE und wird nie ' +
      'als Edit ausgeliefert: ausgeliefert wird nur, was ein regel-spezifisches Template deterministisch ' +
      'aus dem Elementtext ableiten konnte (Spike-2-Befund: kein einziger generisch synthetisierter ' +
      'Edit war unverändert anwendbar). `FIX_ROUNDTRIP` in se-engine sagt je Regel, ob ihre Vorlage den ' +
      'Fund auch schließt. Der Merge-Operator (OP-MERGE) hängt an keiner Regel — ein Merge repariert ' +
      'keinen Fund, er bewegt die Vertragskonzentration.',
  },
};
