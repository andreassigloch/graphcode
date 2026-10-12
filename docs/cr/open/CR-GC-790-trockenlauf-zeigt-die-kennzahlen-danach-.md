# CR-GC-790: Trockenlauf zeigt die Kennzahlen danach nicht: Gesamt-Impact vor der Wahl nur halb

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-836 (finding)
**Erstellt:** 2026-10-12
**Item:** bok/items/ITEM-2026-836.json (Lane: code)

---

## Befund

Der Skill `se:optimize` Version 3 (CR-GC-785) soll den Gesamt-Impact eines Entwurfs vor der Wahl zeigen, davor
und danach. Das Urteil eines Trockenlaufs von `graph_mutate` trägt aber keine Zeile einer Kette, keine Träger je
Risiko und keine Zeile von Modulbaum oder Funktionsbaum nach dem Zug, und `graph_metrics` misst danach den
geschriebenen, also alten Stand. Im Fall sigllm steht alles, was die Entwürfe A und B trennt, in dieser Spalte.

## Entscheidung

**Ein vierter Bericht in `zugBericht`, nur im Trockenlauf: `metricsAfter`.** Das Gate gibt neben seinem Urteil schon den Stand davor
und danach heraus (CR-GC-778). `zugBericht` (`src/kernel/measure/zug-bericht.ts`) rechnet auf beiden Ständen
dieselben vier Funktionen aus `@sigloch/contracts/se`, die `graph_metrics` aufruft (`chainMetrics`,
`moduleMetrics`, `functionCriticality`, `riskCarriers`), und gibt die Zeilen heraus, die sich unterscheiden, im
Stand danach.

| Schlüssel | Inhalt |
|---|---|
| `chains` | Zeilen von `chainMetrics().chains`, geändert oder neu; Schlüssel `chainId` |
| `modules` | Zeilen von `moduleMetrics()`; Schlüssel `moduleId` |
| `functions` | Zeilen von `functionCriticality()`; Schlüssel `funcId` |
| `riskCarriers.risks` | Zeilen von `riskCarriers().risks`; Schlüssel `riskId` |
| `riskCarriers.surface` | Zeilen von `riskCarriers().surface`; Schlüssel `funcId` |
| `removed` | je Liste (`chains`, `modules`, `functions`, `risks`, `surface`) die Kennungen der Zeilen, die es danach nicht mehr gibt |

Eine Zeile gilt als geändert, wenn ihr Inhalt davor und danach nicht gleich ist. Die Zeilen sind wortgleich die
von `graph_metrics` am Stand danach; es entsteht keine neue Kennzahl und keine Differenz je Feld.

**Geprüft und verworfen:**

- *`graph_metrics` mit einem Zug als Eingabe.* Ein zweiter Leser des Gates, und das Urteil reist nicht mit.
- *Eine gemeinsame Funktion für `graph_metrics` und den Bericht.* Die Rechnung liegt in contracts; beide Stellen
  sind vier Aufrufe ohne eigene Formel. Eine gemeinsame Hülle wäre eine neue Quelldatei mit eigenem Knoten für
  vier Zeilen. Dass beide dieselben Zeilen liefern, hält der Test fest (Bericht des Trockenlaufs gegen
  `graph_metrics` nach dem echten Anwenden).
- *Ein einfacherer Weg ohne zweite Rechnung* wurde gesucht und nicht gefunden: der Stand danach liegt nur im Paar
  des Gates vor; wer ihn messen will, muss die vier Funktionen darauf aufrufen. Gemessen am eigenen Modell
  (1050 Elemente, 2346 Kanten): rund 2 ms je Stand.

**Nur im Trockenlauf, nicht beim Anwenden.** Geprüft nach der Streichfrage, in zwei Schritten:

1. *Kommt ein `if` dazu?* Nein. `zugBericht` kennt den Trockenlauf schon: der Schalter `fit` (CR-GC-778) hängt das
   Architekturmass nur dort an, und beide Aufrufer setzen ihn genau im Trockenlauf (`graph_mutate` mit
   `input.dryRun`, `graph_suggest` immer). `metricsAfter` steht in derselben Verzweigung; es gibt keine zweite.
2. *Wäre ganz ohne Schalter besser?* Zuerst so gebaut und am eigenen Modell gemessen, dann verworfen. Der Trockenlauf
   eines Zugs mit sieben neuen Kanten (unten zitiert) trug drei Kettenzeilen und fünf Modulzeilen; eine Kettenzeile
   führt inzwischen auch die Liste `answerPathBlockedBy` mit bis zu 29 Kennungen. Diese Zeilen hingen dann an jeder
   Schreibantwort, die eine Kette berührt, und dort stehen sie schon: nach dem Schreiben misst `graph_metrics` den
   Stand danach. Dieselben Zeilen in zwei Antworten wären ein zweiter Kanal, und die Schreibantwort ist die, die
   beim Modellieren in Serie anfällt. Im Trockenlauf gibt es diesen anderen Ort nicht.

Folge: der CR eines Umbaus misst nach wie bisher mit `graph_metrics` am geschriebenen Modell.

**Nichts geändert ist eine Aussage.** `metricsAfter` steht bei jedem Trockenlauf in der Antwort, den das Gate
durchlässt, auch mit lauter leeren Listen; die Werkzeugschicht streicht es nicht, anders als die drei stillen
Berichte. Es fehlt nur, wenn das Gate den Zug ablehnt (kein Paar) oder die Rechnung scheitert (`berichtFehlt`).

## Umfang laut `graph_impact`

`graph_impact(FUNC-zug-bericht)`: Glied von `FCHAIN-apply-gate` und `FCHAIN-steering-loop`, Eingänge
`FLOW-zug-staende` und `FLOW-fit-advisory`, Ausgang `FLOW-zug-bericht` an `ACTOR-agent` und `FUNC-graph-suggest`.
`graph_suggest` liest aus dem Bericht nur `fitAdvisory` und `steerAdvisory`; der neue Bericht ändert dort nichts.

`graph_tests({changeSet: [FUNC-zug-bericht, FUNC-se-optimize, FUNC-graph-mutate]})`: sechs Testdateien, keine ohne
Bindung.

## Dateien (9)

| Datei | Änderung |
|---|---|
| `src/kernel/measure/zug-bericht.ts` | Vertrag `MetricsAfter`, Rechnung aus dem Paar, Feld im `ZugBericht` |
| `src/surface/write.ts` | Typ der Antwort, Verweis auf die Hilfe in der Werkzeugbeschreibung |
| `src/projections/tool-help.ts` | Eintrag `graph_mutate`: die Felder des Urteils |
| `.claude/commands/se/optimize.md` | Spalte „danach" aus `metricsAfter`; offen bleibt der Betrachtungsumfang |
| `tests/zug-kennzahlen-danach.test.ts` | neu: Abnahme am Modell auf Platte |
| `tests/skill-optimize-vorlage.test.ts` | der Fall „Lücke" wird zum Fall „geschlossen" |
| `tests/gate.urteilt-und-speichert.test.ts` | das Gate trägt den Bericht nicht; er entsteht mit dem Architekturmass |
| `docs/graph/graphcode.graph.json` und Sichten | Anforderung, Test, Bindung über `graph_mutate` und `graph_export` |
| `docs/messung/testauswahl.jsonl` | die zwei Läufe von `verify:full` |

Eine Fassung des Skills für OpenCode gibt es nicht (`.opencode/` führt keinen Skill `optimize`).

## Nicht im Umfang

- **Der Betrachtungsumfang danach.** `requirementScope` braucht die Kennungen, für die gefragt wird; der Zug nennt
  keine. Bleibt bis zum Nachmessen offen.
- `measurability` (die Quote der bewertbaren Ketten). Sie folgt aus den Zeilen; ob eine Kette bewertbar wird oder
  es nicht mehr ist, steht an ihrer Zeile.
- Eine Änderung am Gate, an `graph_metrics` oder an `graph_suggest`.

## Abnahme

- Ein Test fährt an einem kleinen Modell auf Platte einen Trockenlauf, findet im Urteil die geänderten Zeilen und
  prüft sie gegen `graph_metrics` nach dem echten Anwenden desselben Zugs: gleiche Zeilen.
- Ein Trockenlauf, der keine Kennzahl berührt, trägt `metricsAfter` mit leeren Listen.
- Ein abgelehnter Zug trägt das Feld nicht.
- Ein Trockenlauf am eigenen Modell, Ergebnis unten zitiert.
- `npm run verify:full CR-GC-790`.

## Ergebnis

**Stand 2026-10-12.** Gebaut und abgenommen.

| Teil | Ort |
|---|---|
| Bericht | `computeMetricsAfter` und Vertrag `MetricsAfter` in `src/kernel/measure/zug-bericht.ts`; Feld `metricsAfter` im `ZugBericht`, im Zweig des Trockenlaufs |
| Werkzeug | `graph_mutate`: die Beschreibung verweist auf die Hilfe; am Ablauf des Werkzeugs ist nichts geändert |
| Hilfe | neuer Eintrag `graph_mutate` in `src/projections/tool-help.ts` (`graph_help({token:"graph_mutate"})`): alle Felder des Urteils |
| Skill | `se:optimize` Version 4: die Spalte „danach" für Ketten, Träger, Modulbaum und Funktionsbaum aus `metricsAfter` |
| Test | `tests/zug-kennzahlen-danach.test.ts`, 6 Fälle |
| Modell | `REQ-zug-zeigt-kennzahlen-danach` an `FUNC-zug-bericht`, geprüft von `TEST-zug-kennzahlen-danach`; Beschreibungen von `FUNC-zug-bericht`, `SCHEMA-zug-bericht`, `FUNC-se-optimize`; Kanten von `CR-GC-790` |

### Abnahme

- **Test am Modell auf Platte.** Vier Züge, je Trockenlauf, dann echt angewandt, dann `graph_metrics`: eine
  Zuordnung wandert (Modulgrenzen der Kette x 0 auf 1, der Kette y 1 auf 0, beide Modulzeilen), ein Träger kommt
  dazu (Zeile des Risikos, Fläche), ein Fluss wird getrennt (Kette y nicht mehr bewertbar, mit `reasons`), eine
  Kette entfällt (`removed.chains`). Je Zug: jede genannte Zeile gleich der von `graph_metrics` danach, jede nicht
  genannte gleich der von davor. Dazu der Zug ohne Wirkung (leere Listen, Feld vorhanden), der abgelehnte Zug (kein
  Feld) und die Schreibantwort (kein Feld).
- **Gegenprobe des Tests.** Mit zwei absichtlichen Fehlern in der Rechnung gefahren (Kettenzeilen von davor statt
  danach: 3 von 6 rot; jede Zeile als geändert gemeldet: 5 von 6 rot), dann zurückgenommen.
- **Trockenlauf am eigenen Modell** (graphVersion 699, Host neu gestartet). Zuerst ein Entwurf des Modellzugs zu
  diesem CR mit vier Flusskanten mehr (`FLOW-chain-metrics`, `FLOW-module-metrics`, `FLOW-function-criticality` an
  `FUNC-zug-bericht`, `FLOW-zug-bericht` an `FUNC-se-optimize`). Aus `metricsAfter`:

  | Liste | Zeilen danach |
  |---|---|
  | `chains` | `FCHAIN-apply-gate` (`moduleBoundaries` 9, `boundaries` mit `MOD-kernel` nach `MOD-projections`), `FCHAIN-skill-authoring` (`imports`: `FLOW-zug-bericht` an `FUNC-se-optimize`), `FCHAIN-steering-loop` (`moduleBoundaries` 14) |
  | `modules` | `MOD-agent-surface`, `MOD-projections`, `MOD-kernel-measure` (`fanIn` 3, `fanOut` 7, `cohesion.ratio` 0,14), `MOD-kernel`, `MOD-surface` |
  | `functions`, `riskCarriers.risks`, `riskCarriers.surface` | leer |
  | `removed` | fünf leere Listen |

  Daneben im selben Urteil: R-21 an vier Übergaben, R-04 an vier Modulen, Steuerwert 4,00 auf 4,50. Der Entwurf
  ist deshalb verworfen; die vier Kanten stehen nicht im Modell. Der angewandte Zug (Anforderung, Test, Kanten des
  CR) trug im Trockenlauf `metricsAfter` mit lauter leeren Listen und in der Schreibantwort kein `metricsAfter`.
- `npm run build`: ohne Befund.
- `npm run verify:full CR-GC-790`: Spur CODE, Auswahl 104 von 185 Dateien; 1554 Tests, 3 Dateien rot.
  `distribution` und `lockfile-sync`: Link-Modus auf die Arbeitskopie von contracts, erwartet. `metrics`
  (`graph_metrics auf dem eigenen Modell`, CR-GC-767): die Kettenzeile aus der SSOT-Datei und die über den Store
  unterscheiden sich in `answerPath` und `answerPathBlockedBy`, den Feldern, die die Arbeitskopie von contracts
  (12.4.0, unveröffentlicht) gerade dazubekommt. Am Stand vor diesem CR gegengeprüft (SSOT aus `HEAD`): 18 von 25
  Ketten verschieden, nur in diesen zwei Feldern. Nicht aus diesem CR; nicht behoben.
  Ein erster Lauf hatte zusätzlich `mcp.agent-agnostic` rot (Budget der Werkzeugliste um 38 Zeichen überschritten,
  durch den Satz in der Beschreibung); der Satz ist gekürzt, der Test grün. Beide Läufe stehen in
  `docs/messung/testauswahl.jsonl`. Schlupf: `lockfile-sync`; die Folge bleibt bei 0 von 10.

### Abweichungen und Urteile

1. **Nur im Trockenlauf.** Der Auftrag ließ es offen; begründet oben. Der Wert „mehrere Kettenzeilen je
   Schreibantwort" ist an einem Zug abgelesen, nicht über eine Sitzung gemessen.
2. **Der Schalter heißt weiter `fit`**, schaltet jetzt aber zwei Berichte. Ein Umbenennen träfe drei weitere
   Dateien (`src/loop/suggest.ts`, zwei Tests) und hätte den CR über zehn Dateien gehoben. Ein Item wert.
3. **`graph_suggest` rechnet den Bericht mit** und liest ihn nicht (rund 4 ms je Vorschlag am eigenen Modell).
4. **Keine gemeinsame Hülle** um die vier Aufrufe für `graph_metrics` und den Bericht. Kommt in `graph_metrics`
   eine fünfte Kennzahl dazu, folgt der Bericht nicht von selbst.
5. **Gleichheit einer Zeile** ist die Gleichheit ihres JSON-Texts. Das trägt, weil beide Zeilen aus derselben
   Funktion kommen.
6. **Skill Version 4.** Die Datei wird nach `version:` verteilt; ohne neue Nummer bliebe eine Kopie auf Version 3
   stehen.
7. **Modell schlank.** Dass der Skill das Urteil des Trockenlaufs liest und dass `zugBericht` die Funktionen aus
   contracts aufruft, steht in den Beschreibungen, nicht als Fluss (siehe Trockenlauf oben).
8. **`REQ-optimize-probes-and-presents`** ist unverändert; sein Satz „was der Trockenlauf nicht trägt, nennt er
   offen" gilt weiter, jetzt für den Betrachtungsumfang und die geschlossenen Befunde.

**Offen:** der Betrachtungsumfang nach dem Zug; welche Befunde ein Zug schließt (heute nur als Zahl je Stufe);
der rote Fall in `tests/metrics.test.ts` gegen contracts 12.4.0.

**Kongruenz:** `FUNC-zug-bericht` und `SCHEMA-zug-bericht` sind an `src/kernel/measure/zug-bericht.ts` gebunden,
der Test an seine Datei. RC-* läuft nicht im Gate (`notInGate`), also nicht prüfbar; Bindungsquote nicht erhoben.
