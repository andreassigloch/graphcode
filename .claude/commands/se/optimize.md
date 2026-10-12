---
name: se:optimize
version: 5
description: Einen Umbauvorschlag proben und seinen Gesamt-Impact als Vorlage zeigen — Vorschläge aus einer Analyse (feste Form) und Vorschläge von graph_suggest, getrennt. Trockenlauf durchs Gate, Vorlage davor und danach, Wahl durch den Autor. Nach CDR, vor den Kettentests. Kein Auto-Apply; Anwenden und Nachmessen gehören dem CR des Umbaus.
---

# se:optimize — proben, zeigen, wählen lassen

## Wofür dieser Skill da ist

Ein Umbau wird gegen einen benannten Zweck gewählt, nie gegen eine Kennzahl. Du nimmst einen
Vorschlag, probst ihn per Trockenlauf durchs Gate und legst dem Autor den Gesamt-Impact vor: was
der Vorschlag berührt, davor und danach. Die Vorlage ist die Unterlage für sein Urteil und kein Verfahren.
Du bildest keine Rangfolge, nennst keinen Sieger und sprichst keine Wahl aus, auch nicht nach einer Kennzahl.

Eigen je Analyse ist der Vorschlag; gleich für alle ist der Umgang mit ihm, und der steht hier.
Die Lage in der Regelmatrix: nach der Marke CDR, vor den Kettentests auf Stufe 9. Früher fehlt die
Analyse, die den Vorschlag trägt; nach der Bindung auf Stufe 11 bewegt jeder Umbau Code.

**Du probst und zeigst.** Du wendest nicht an: Anwenden und Nachmessen gehören dem CR des Umbaus (Schritt 6).
Du rechnest keine Kennzahl: die Vorlage liest du aus `graph_metrics`, aus den Befunden
(`rules_get_violations`) und aus dem Urteil des Trockenlaufs von `graph_mutate`.

---

## 1. Zwei Quellen, getrennt

| Quelle | Woher | Was ein Vorschlag trägt |
|---|---|---|
| **(a) Analyse** | der Abschnitt der Vorschläge im CR einer Analyse: „Architekturvorschläge" bei `se-fmea`, „Vorschläge" bei `se-laufzeit` | die feste Form `Zweck | Kette | Ort | Handlungsklasse | Prognose | Preis` |
| **(b) Baumgüte** | `graph_suggest`, zur Güte von Modulbaum und Funktionsbaum | `ruleId`, `elementId`, `edit`, `score`, `delta`, `applicable`, `verdict` |

Zeig sie in zwei Abschnitten. Es gibt keine gemeinsame Rangfolge und keinen Vergleich über die
Quellen hinweg: ein Vorschlag aus (a) dient einer Anforderung an einer Kette, einer aus (b) dem
Steuerwert des Modells. Ab Schritt 2 ist der Umgang für beide derselbe.

**Quelle (a).** Die Prognose nennt, was besser wird und was gleich bleibt; der Preis, was der Umbau kostet.
Fehlt eine der sechs Angaben, geht der Vorschlag an seine Analyse zurück. Du ergänzt keinen Zweck
und keine Prognose. Den Zug schreibst du aus Ort und Handlungsklasse als Format-E und zeigst ihn
dem Autor vor der Probe: er ist deine Übersetzung, nicht Teil des Vorschlags.

**Quelle (b).**

```
graph_suggest { "k": 5 }
```

- `applicable: true`: `score` und `delta` messen genau den beigelegten `edit`. `score` ist die Verbesserung des Steuerwerts, die der Trockenlauf dieses Zugs ergab (`verdict.steer.improvement`); `delta` ist das Δm je Dimension und wird nur berichtet.
- `applicable: false`: es gibt nichts anzuwenden, also auch nichts zu proben. Ein Fund ohne `edit`, oder das Gate hat den Zug abgelehnt (Grund in `verdict.violations`). `score` misst dann eine Sonde am Fund. Sag das dazu.
- `score` kleiner oder gleich 0: der Zug entschärft die schlimmste Stelle nicht. Sag das dazu.
- `edit.codeImpact`: nenn Datei und Zielmodul. Das Umhängen einer gebundenen Funktion zieht Code-Arbeit nach sich.
- Die Reihenfolge der Liste stammt vom Steuerwert des Werkzeugs. Sie gilt nur in dieser Quelle und ist kein Urteil über einen Entwurf.

Ein Vorschlag aus (b) hat keinen Zweck an einer Kette und keine Prognose. Frag den Autor vor der
Probe, was gleich bleiben muss; das ist seine Prognose für Schritt 5.

## 2. Eingang prüfen

Die Vorlage ist so gut wie die Vorbereitung des Modells. Lies die Zeile der Kette des Vorschlags
in `chains` aus `graph_metrics()`. Bei (b) sind es die Ketten durch die Funktionen, die `edit` berührt.

`measurable: false`: keine Probe. Nenne die `reasons` und verweise auf `se-vorbereitung`.

`answerPath: null` an einem Vorschlag, dessen Prognose etwas über den Antwortweg sagt: keine Probe. Nenne die Flüsse aus `answerPathBlockedBy` und verweise auf `se-vorbereitung`.
Ohne Antwortweg davor ist die Prognose nicht prüfbar.

## 3. Vorlage davor

```
graph_metrics({ scope: ["<FCHAIN>", "<FUNC>", …] })
rules_get_violations({ detail: "grouped" })
```

In `scope` stehen die Kette des Vorschlags und jede bestehende Funktion, an der der Zug einen
Fluss, eine Anforderung oder die Zuordnung zum Modul ändert. Merk dir `graphVersion`.

| Teil | Quelle |
|---|---|
| Betrachtungsumfang | Block `scope`: `modules`, `chains`, `requirements`. Eine Zahl ist die Länge der Liste |
| Ketten | je Kette aus `chains` des Umfangs ihre Zeile: `length`, `memberCount`, `branching`, `fanIn`, `moduleBoundaries`, `loops`, `shared`, `boundaries`, `imports`, `handovers` |
| Träger je Risiko | `riskCarriers`: je Risiko des Umfangs `riskId`, `carriers`, `satisfiers`; aus `surface` die Risiken je berührter Funktion |
| Antwortweg | je Kette des Umfangs `answerPath`: die Glieder, auf die die Antwort an den Akteur wartet. `[]` heißt, auf diese Kette wartet keine Antwort; `null` heißt verhindert, dann stehen die hindernden Flüsse in `answerPathBlockedBy` |
| Funktionsbaum | `functions`: `chains` und `useCases` je berührter Funktion |
| Modulbaum | je Modul des Umfangs `fanIn`, `fanOut`, `instability`, `lcom4`, `cohesion`, `uphillDependencies`, jede neben ihrer Schwelle aus `policy` (Herkunft: `policySource`) |
| Befunde | je Regel die Zahl, ohne die aus dem Bau: `R-19`, `R-20`, `R-26`, `R-32` |

Ein Risiko gehört zum Umfang, wenn es selbst oder eine seiner Gegenmaßnahmen in `requirements`
steht. Legt der Zug eine Funktion in ein Modul, das nicht in `modules` steht, lies dessen Zeile
dazu und sag das: der Umfang kennt nur, was es schon gibt.

**Zu beurteilende Anforderungen.** Ergänzt der Zug einer bestehenden Funktion einen Ausgang oder eine Aufgabe, wird er gegen jede Anforderung dieser Funktion beurteilt.
`graph_metrics({ scope: ["<FUNC>"] })` nennt in `requirements`, was dafür zu lesen ist; welche
davon die Funktion selbst erfüllt, zeigt `graph_context`. Führ die Liste in der Vorlage; das Urteil
je Anforderung fällt der Autor. Eine Anforderung an einer Funktion, die der Zug umgeht, steht
nicht darin.

## 4. Probe

```
graph_mutate({ formatE: "<der Zug>", dryRun: true, baseVersion: <graphVersion>, violations: "full" })
```

Ein Zug ist **EIN** Batch: das Gate beurteilt nur den Endzustand. Ein Umhängen aus (b)
(`edit.retire` ist gesetzt) löscht und legt an im selben Block, nie in zwei Aufrufen:

```
## Edges
- <retire.source> -<retire.type>-> <retire.target>
+ <edit.source> -<edit.type>-> <edit.target>
```

Der Trockenlauf schreibt nichts. Was sein Urteil trägt:

| Feld | Was es sagt |
|---|---|
| `success`, `tier` | ob das Gate den Zug durchlässt. Lehnt es ab, ist das das Ergebnis der Probe und kein Anlass, den Zug zurechtzubiegen |
| `violations` | die Befunde, die der Zug neu einführt, je mit Regel und Element. Für den Vergleich ohne die aus dem Bau. Was der Zug schließt, steht hier nicht |
| `steeringDelta` | `blockingErrors` und je Stufe in `stages` die Zahl der Befunde: `before`, `after`, `delta`. Die `stages` zählen die Befunde aus dem Bau mit |
| `steerAdvisory` | der Steuerwert `before` und `after`, `improvement`, die schlimmste Stelle danach in `worstAt`, und `removesElements` |
| `fitAdvisory` | das Δm je Dimension und `regressions`. Nur mit einem Zielprofil mit Gewichten; erhoben wird es in `se:target-profile`, nicht hier |
| `workOrder` | `moves`: Dateien, die mit einer umgehängten Funktion wandern; `blind`: Funktionen ohne Bindung |
| `metricsAfter` | die Zeilen von `graph_metrics`, die der Zug ändert oder neu anlegt, im Stand danach: `chains`, `modules`, `functions` und `riskCarriers` mit `risks` und `surface`. `removed` nennt je Liste die Kennungen der Zeilen, die entfallen. Leere Listen heißen: der Zug ändert keine Kennzahl |

`steerAdvisory`, `fitAdvisory` und `workOrder` fehlen in der Antwort, wenn sie nichts melden.
`metricsAfter` steht bei jedem Trockenlauf da, den das Gate durchlässt, auch leer. Fehlt es dort, nennt
`berichtFehlt` den Grund, und die Spalte „danach" bleibt für diesen Vorschlag offen.

**Die Spalte „danach".** `graph_metrics` misst das geschriebene Modell, und geschrieben ist nichts; den Stand nach dem Zug trägt nur `metricsAfter`.
Eine Zeile, die dort steht, ist die Zeile danach, wortgleich die, die `graph_metrics` nach dem
Anwenden liefert. Eine Zeile aus Schritt 3, die dort nicht steht und nicht unter `removed`, ist
unverändert. Legt der Zug eine Kette, ein Modul oder eine Funktion neu an, steht ihre Zeile nur hier.

**Was das Urteil nicht trägt.** Den Betrachtungsumfang nach dem Zug (`scope`) und die Befunde, die der Zug schließt.
Sie bleiben offen bis zum Nachmessen im CR. Rechne nichts davon von Hand aus dem Zug nach: das
wäre eine zweite Rechnung neben der einen in `graph_metrics`.

## 5. Vorlage zeigen

Je Vorschlag eine Vorlage, in der Reihenfolge, in der die Quelle sie lieferte.

**Zuerst die Prüfung gegen die Prognose.** Was gleich bleiben muss und es nicht bleibt, steht oben. Je Aussage „bleibt gleich" eine von drei Antworten:

- **verletzt:** die Probe belegt es (neuer Befund, `blockingErrors`, `worstAt`, `regressions`, oder eine Zeile in `metricsAfter`, die gleich bleiben sollte). Eine Verbesserung, die das Gleichbleiben verletzt, zählt nicht.
- **hält laut Probe:** die Probe prüft die Aussage und meldet nichts. Für eine Zeile oder einen Träger heißt das: sie steht nicht in `metricsAfter`.
- **offen bis zum Nachmessen:** die Aussage betrifft den Betrachtungsumfang oder einen Befund, den der Zug schließen soll. Das trägt die Probe nicht.

Dann die Tabelle, jede Zahl mit ihrem Feld:

| Teil | davor | Prognose | Probe | danach |
|---|---|---|---|---|
| Betrachtungsumfang | Schritt 3 | – | – | Nachmessen im CR |
| Ketten des Umfangs | ihre Zeilen | welche Zeile sich ändert, und wie | – | `metricsAfter.chains`, sonst unverändert |
| Antwortweg | `answerPath` je Kette | welche Glieder nicht mehr darin stehen | – | `answerPath` an der Zeile der Kette in `metricsAfter.chains`, sonst unverändert |
| Träger je Risiko | `carriers` | aus dem Vorschlag | – | `metricsAfter.riskCarriers`, sonst unverändert |
| Modulbaum und Funktionsbaum | Zeilen mit Schwelle | aus dem Preis | `steerAdvisory`, `fitAdvisory` | `metricsAfter.modules` und `metricsAfter.functions`, sonst unverändert |
| Befunde ohne Bau | je Regel | – | neu aus `violations` | Nachmessen im CR |

Jede Zahl der Spalte „danach" steht neben ihrer Zahl von davor, mit demselben Feldnamen. Eine Zeile
unter `removed` zeigst du als entfallen. Den Antwortweg zeigst du als Liste der Glieder davor und
danach; ein `null` danach ist ein Ergebnis der Probe: nenne `answerPathBlockedBy` der Zeile.

Darunter die zu beurteilenden Anforderungen (Schritt 3), der Preis, und aus `workOrder`, was an Code mitwandert.

Dann fragst du, je Vorschlag einzeln und ohne eigenes Votum: **„wählen?"**

## 6. Wahl und Übergabe

**Kein Auto-Apply.** Der Autor wählt. Ohne Wahl entsteht kein CR, und am Modell ändert sich nichts.

Ein gewählter Vorschlag ist ein gewöhnlicher CR. Er bekommt von dir: den Vorschlag, den Zug als
Format-E, die Vorlage aus Schritt 5 und die Prüfung gegen die Prognose; dazu jeden nicht gewählten
Vorschlag mit dem Grund des Autors. Der CR des Umbaus

1. wendet den Zug an, über `graph_mutate` und als denselben Batch, den die Probe beurteilt hat,
2. misst nach: dieselben Aufrufe wie in Schritt 3 am geschriebenen Modell bestätigen die Spalte „danach" und füllen, was offen blieb,
3. prüft das Gemessene gegen die Prognose und hält das Ergebnis fest.

Erledigt liegt sein Text unter `docs/cr/done/`, sein Knoten trägt `status: "done"` und je eine
`relation`-Kante auf jedes Element, das der Zug geändert hat. Zieht der Zug Code-Arbeit nach sich,
schneidet `se-plan` den Bauauftrag.

Nach einem angewandten Umbau ist das Modell ein anderes: jeder weitere Vorschlag wird neu geprobt.

---

## Abschluss-Prüfliste

- [ ] zwei Abschnitte, je Quelle einer; kein Vergleich über die Quellen
- [ ] jeder Vorschlag aus (a) mit allen sechs Angaben, sonst zurück an die Analyse
- [ ] die Kette bewertbar, sonst Verweis auf `se-vorbereitung` statt Probe
- [ ] je Vorschlag die Prüfung gegen die Prognose oben, dann die Vorlage
- [ ] die Spalte „danach" aus `metricsAfter`, jede Zeile unverändert übernommen
- [ ] der Antwortweg je Kette davor und danach aus `answerPath`, nicht nachgegangen
- [ ] was die Probe nicht trägt, steht als offen bis zum Nachmessen und ist nicht von Hand gerechnet
- [ ] kein Zug angewandt; je Vorschlag die Wahl des Autors oder sein Grund dagegen
