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
import { Mark } from '@sigloch/contracts/se';

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
      `• \`marks\` ${Mark.options.join('/')} — die Marken zwischen den Stufen der Regelmatrix, in Reihenfolge. Je ` +
      'Marke `reached` und `holding`: die Befunde, die sie halten (leer ⇔ erreicht). Eine Marke halten ' +
      'Fehler und offene Existenz-Befunde bis zu ihrer Stufe; die letzte zusätzlich alle Befunde von Plan, ' +
      'Bindung und Abgleich — ihre Arbeitsliste. Andere Warnungen halten keine Marke: „warnungsfrei" ist ' +
      'die getrennte Aussage von `rules_evaluate`. Ohne `detail` ist `holding` leer und nur `reached` zählt. ' +
      'Welche Regel zu welcher Marke gehört: `graph_help({token:"<ruleId>"})` → `stage`, `mark`.\n' +
      '• `stages` — die Zahl der Befunde je Stufe (System bis Abgleich, dann `immer`), gezählt aus dem ' +
      'VOLLEN contracts-Katalog inkl. BQ-*/ND-*, also einer WEITEREN Grundgesamtheit als ' +
      '`violationsByRule`. Keine Prozentzahl: 0 heißt, in dieser Stufe meldet nichts.\n' +
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
      '• `callCoverage` — dasselbe für RC-12: wie viele Fluss-Paare gegen die Aufrufe im Code ' +
      'beurteilt wurden (`checked`) und warum der Rest nicht.\n' +
      '• `umfang` (CR-GC-613) — was diese Sitzung angefasst hat; die SCORES bleiben global.',
  },
  graph_metrics: {
    plain:
      'Welches Modul ist das Kopplungsproblem: Fan-in/Fan-out, Instabilität und Kohäsion je MOD, ' +
      'immer zusammen mit der Schwelle, gegen die geurteilt wurde. `graph_readiness` sagt "alloc ist ' +
      '87 %", das hier sagt WELCHES Modul. Dazu je Wirkkette, wie sie läuft — oder warum sie sich ' +
      'nicht bewerten lässt, je Risiko, welche Funktionen es tragen, und auf Anfrage, was eine Analyse ' +
      'einer Kette oder Funktion lesen muss.',
    se:
      'Je MOD: `fanIn`/`fanOut` (allocate- und io-Kanten), `instability` I = fanOut/(fanIn+fanOut), ' +
      '`lcom4` (Zusammenhangskomponenten der FUNC-Whitebox) und `cohesion`. Die Schwellen stammen aus ' +
      'der Metrik-Policy des Repos, nicht aus Konstanten im Werkzeug — dieselben, gegen die MT-01/MT-02/' +
      'MT-04 urteilen. Ein Wert ohne seine Schwelle ist keine Aussage: derselbe LCOM4 ist in einem ' +
      'Adapter normal und in einem Kern ein Befund.\n' +
      'Je FUNC (`functions`): `chains` (Wirkketten, die die Funktion direkt als Glied führen) und ' +
      '`useCases` (Anwendungsfälle über diesen Ketten), die meistgeteilte zuerst. `0` ist eine Aussage: ' +
      'ein Blatt ohne Kette meldet R-30, ein Block ist nie Glied. Die Zahl urteilt nicht.\n' +
      'Je FCHAIN (`chains`, CR-GC-767): `length` (längster Pfad in FUNC-Schritten, eine Schleife ist ' +
      'ein Schritt), `branching` (größter Ausgangsgrad in der Kette), `moduleBoundaries` (Kettenkanten ' +
      'über eine MOD-Grenze; `null`, wenn ein Glied kein Modul hat), `feedbackLoops`, `sharedFuncs` ' +
      '(Glieder in mehr als einer Kette) und `bottlenecks` (obere Schranke). `syncDepth` und ' +
      '`errorPathDepth` sind immer `null`: beide werden nicht gerechnet. Eine Kette mit ' +
      '`measurable: false` trägt KEINE Zahl, sondern `reasons` — `FC-05` (zerfallen), `loose-member` ' +
      '(ein Glied ohne io-Eingang oder -Ausgang), `no-entry`, `no-exit`, `empty`. Ohne Schwelle: hier ' +
      'wird gemessen, nicht geurteilt.\n' +
      'Die Orte dazu (CR-GC-774): `memberCount`, `fanIn` (größter Eingangsgrad, Gegenstück zu ' +
      '`branching`), `loops` (je Rückkopplung Kennung und Mitglieder; dieselbe Kennung in mehreren ' +
      'Ketten ist dieselbe Rückkopplung), `shared` (die geteilten Funktionen), `boundaries` (je ' +
      'gerichtetem Modulpaar Kanten und verschiedene Verträge), `imports` und `handovers` (Fluss und ' +
      'Funktion; gezählt nur an Gliedern, die allein dieser Kette gehören — die Zuflüsse einer ' +
      'geteilten Funktion stehen an ihr). Die Zahlen bleiben die Längen dieser Listen.\n' +
      'Der Antwortweg (CR-GC-783) liest das Merkmal `sync` an den Flüssen: `sync` heißt, der Abnehmer ' +
      'wartet beim Aufruf auf diese Lieferung, `async` heißt vorab geliefert. `answerPath` nennt die ' +
      'Glieder, auf die die Antwort an einen Akteur wartet, vom Akteur rückwärts über die Flüsse mit ' +
      '`sync`; er verlässt die Kette nicht. `[]` heißt, kein Glied liefert einem Akteur synchron; ' +
      '`null` heißt, die Aussage ist verhindert. `answerPathBlockedBy` nennt dann die hindernden ' +
      'Flüsse und ist sonst leer: ein Fluss hindert, wenn er das Merkmal nicht lesbar trägt oder ' +
      '`sync` trägt und von einer Funktion außerhalb der Kette kommt. Gelesen wird nur entlang des ' +
      'Wegs: die Liste nennt die Hindernisse, auf die er trifft, nicht jeden Fluss ohne Merkmal.\n' +
      '`measurability` ist die Reichweite daneben: bewertbare / alle Ketten. Kennzahlen bei niedriger ' +
      'Quote beschreiben nur die Ketten, die schon Ketten sind; `ratio` ist `null`, wenn es keine gibt.\n' +
      '`riskCarriers` (CR-GC-787) steht immer da, zwei Listen über dieselben Paare: `risks` je Risiko ' +
      '(REQ mit Rolle `risk`) mit `carriers` und `satisfiers`, `surface` je Träger mit seinen Risiken; ' +
      'ohne Risiken sind beide leer. Ein Träger ist eine Blattfunktion: erfüllt ein Block, ein Modul ' +
      'oder eine Kette die Gegenmaßnahme, stehen deren Blattfunktionen da. Eine Gegenmaßnahme am System ' +
      'gilt quer und zählt nicht in die Träger; ihr Erfüller steht in `satisfiers`. Ein Risiko mit ' +
      'leeren `carriers` ist deshalb nicht ohne Erfüller, erst leere `satisfiers` heißen das. Die ' +
      'Fläche ist die Länge von `surface`.\n' +
      '`scope` gibt es nur auf Anfrage: die Eingabe `scope` nimmt Kennungen von Funktionen oder Ketten ' +
      '(eine Kette steht für ihre Glieder), der Antwortblock nennt `modules` (die Module der ' +
      'Funktionen), `chains` (alle Ketten durch sie) und `requirements` (jede Anforderung, die eine ' +
      'der Funktionen, eines der Module, eine der Ketten oder das System erfüllt). Die Zahl ist die ' +
      'Länge der Liste. Eine Kennung, die keine Funktion oder Kette des Modells ist, lehnt das ' +
      'Werkzeug mit ihrem Namen ab, statt einen Umfang zu liefern, der nur das System nennt.\n' +
      '`constraintCarriers` gibt es nur auf Anfrage (`constraintCarriers: true`, CR-GC-857): eine ' +
      'Zeile je Constraint, also je nicht-funktionaler Anforderung ohne Rolle mit Erfüller. `reqId` ' +
      'ist die Anforderung, `by` ihre Erfüller wie modelliert (Modul, Kette oder System), `carriers` ' +
      'die Blattfunktionen nach derselben Tabelle wie bei `riskCarriers`; ein Erfüller am System ' +
      'zählt nicht in die Träger. Eine Anforderung mit Rolle steht in `riskCarriers`, nicht hier.',
  },
  graph_mutate: {
    plain:
      'Der eine Schreibweg, und mit `dryRun: true` die Probe: was das Gate zu einem Zug sagt, welche ' +
      'Befunde er neu einführt und welche Kennzahlen er ändert. Die Probe schreibt nichts.',
    se:
      'Das Urteil: `success`, `tier`, `violations` (nur die Befunde, die der Zug NEU einführt). Dazu ' +
      'die Berichte, gerechnet aus dem Stand davor und danach, den das Gate herausgibt; ein ' +
      'abgelehnter Zug hat kein Paar und trägt keinen.\n' +
      '• `metricsAfter` (CR-GC-790) — die Zeilen von `graph_metrics`, die der Zug ändert oder neu ' +
      'anlegt, im Stand DANACH: `chains` (Schlüssel `chainId`), `modules` (`moduleId`), `functions` ' +
      '(`funcId`), `riskCarriers.risks` (`riskId`) und `riskCarriers.surface` (`funcId`). `removed` ' +
      'nennt je Liste (`chains`, `modules`, `functions`, `risks`, `surface`) die Kennungen der Zeilen, ' +
      'die es danach nicht mehr gibt. Dieselben contracts-Funktionen wie `graph_metrics`, also ' +
      'dieselben Zeilen, die `graph_metrics` nach dem Anwenden liefert; die Zeile davor steht in ' +
      '`graph_metrics` vor dem Zug. Nur im Probelauf, dort bei jedem Zug, den das Gate durchlässt: ' +
      'lauter leere Listen heißen, der Zug ändert keine Kennzahl. Der Probelauf ist der einzige Ort ' +
      'für den Stand danach, denn `graph_metrics` misst das geschriebene Modell; nach dem Schreiben ' +
      'liefert `graph_metrics` die Zeilen selbst. Nicht darin: der Betrachtungsumfang (`scope`) und ' +
      '`measurability`.\n' +
      '• `steerAdvisory` — der Steuerwert `before`/`after`, `improvement`, die schlimmste Stelle ' +
      'danach in `worstAt`. `workOrder` — `moves` (Dateien, die mit einer umgehängten Funktion ' +
      'wandern) und `blind` (Funktionen ohne Bindung). Beide fehlen, wenn sie nichts melden. Das Δm je ' +
      'Dimension (ℝ⁶) steht nie im Ergebnis (CR-GC-853); `graph_suggest` nennt es als `delta`.\n' +
      '• Nur im Probelauf: `steeringDelta` (`blockingErrors` und je Stufe in `stages` die Zahl der ' +
      'Befunde davor und danach). Nur beim Schreiben: `refs` (Bindungen, die der Zug schließt oder ' +
      'öffnet) und `vorschlag` (ein Satz für den Nutzer).\n' +
      '• `berichtFehlt` — die Berichte ließen sich nicht rechnen; der Zug bleibt, was das Gate aus ' +
      'ihm gemacht hat.',
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
      "Mit `detail:'grouped'` eine Gruppe je Regel, mit ihrer `stage` (1–12 oder `immer`) und in " +
      'Arbeitsreihenfolge: Fehler zuerst, dann die früheste Stufe, in einer Stufe die häufigste Regel.\n' +
      '`importCoverage` nennt die Reichweite der RC-Auflösung, `callCoverage` die von RC-12 ' +
      '(Fluss-Paare je Grund). Ein Ergebnis ohne `skipped` zu lesen ' +
      'heißt, eine Zahl für vollständig zu halten, die es nicht ist.',
  },
  graph_suggest: {
    plain:
      'Welcher Umbau zahlt sich aus: Kandidaten-Edits, gerankt danach, wie weit jeder den Abstand zu ' +
      'den Regelschwellen verringert. Er schlägt vor; angewandt wird über `graph_mutate`, nie automatisch.',
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
