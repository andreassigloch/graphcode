# CR-GC-785: se:optimize Version 3: ein Optimierer fuer Vorschlaege aus jeder Analyse

**Status:** ✅ Done (2026-10-12, veröffentlicht mit graphcode 0.31.0, contracts 12.6.0)
**Typ:** aus Item ITEM-2026-825 (idea)
**Erstellt:** 2026-10-11
**Item:** bok/items/ITEM-2026-825.json (Lane: code)

---

**Bezug:** `docs/graphcode_analyse_optimierungskonzept.md`, Abschnitt 10 und Abschnitt 6. **Wartet auf CR-SM-407; nimmt Vorschläge aus CR-GC-782 und CR-GC-783.**
**Frage des Autors (2026-10-11):** ist der Optimierer je Analyse eigen oder allgemein?

## Antwort und Anlass

Allgemein. Eigen je Analyse ist der **Vorschlag**: nur die Analyse einer Dimension kennt den Zweck und den Ort.
Gleich für alle ist der **Umgang** mit einem Vorschlag: proben, zeigen, was er berührt, wählen lassen, anwenden,
nachmessen. Zwei Optimierer würden denselben Umbau zweimal verschieden behandeln.

`se:optimize` Version 2 kennt nur eine Quelle, `graph_suggest`. Dessen Steuerwert liest Befunde, Kreuzungen und
Zusammenhalt, also die Größen, die in den Spikes am häufigsten gegen das Urteil liefen.

## Umfang

`.claude/commands/se/optimize.md`, Version 3:

1. **Zwei Quellen, nicht gemischt.** (a) Vorschläge aus einer Analyse in fester Form (Zweck, Kette, Ort,
   Handlungsklasse, Prognose, Preis). (b) Vorschläge von `graph_suggest` zur Güte des Modulbaums und des
   Funktionsbaums. Der Skill zeigt sie getrennt und bildet keine gemeinsame Rangfolge.
2. **Probe** per Trockenlauf durchs Gate.
3. **Gesamt-Impact als Vorlage** (Konzept 6b), davor und danach: Betrachtungsumfang; jede Kette, deren Zeile
   sich ändert; Träger je Risiko und, sobald vorhanden, der Antwortweg (CR-SM-408); Kennzahlen von Modulbaum und
   Funktionsbaum mit Schwellen. Der Skill ordnet nicht und empfiehlt nicht nach einer Summe.
4. **Prüfung gegen die Prognose:** was gleich bleiben muss und nicht gleich bleibt, steht oben.
5. **Wahl durch den Autor.** Anwenden und Nachmessen gegen die Prognose gehören dem CR des Umbaus; der Skill
   liefert dafür die Vorlage davor und danach. Lage: nach CDR, vor den Kettentests auf Stufe 9.

Dazu ein Test, der den Skilltext an die Felder aus CR-SM-407 bindet und festhält, dass er keine Rangfolge
bildet; Anforderung und Test am Knoten des Skills; Hilfetext.

## Nicht im Umfang

Eine Änderung an `graph_suggest` oder am Steuerwert. Ob der Steuerwert die Kettensicht lesen soll, ist eine
eigene Frage (CR-GC-771 steht dazu noch offen).

## Abnahme

- An den drei Entwürfen des Falls sigllm (graphanalyze `docs/messung/gesamt-impact-fall3-2026-10-10/`) zeigt der
  Skill je Entwurf die Vorlage mit den Zahlen der Notiz und nennt keinen Sieger.
- Der Skilltext enthält keine Summe über Kennzahlen.

## Grenzen

Die Vorlage ist so gut wie die Vorbereitung des Modells; ohne geschlossene Kette verweist der Skill dorthin.

## Ergebnis

**Stand 2026-10-11.** Gebaut, nicht geschlossen.

| Teil | Ort |
|---|---|
| Skill, Version 3 | `.claude/commands/se/optimize.md` |
| Test | `tests/skill-optimize-vorlage.test.ts` (21 Fälle; gegen Version 2 alle 21 rot, danach mit fünf verfälschten Textstellen gegengeprüft) |
| Modell | `REQ-optimize-probes-and-presents` an `FUNC-se-optimize`, geprüft von `TEST-optimize-presents-impact`; Kante von `CR-GC-785`; `FUNC-se-optimize` ist Abnehmer von `FLOW-chain-metrics`; Beschreibung nachgezogen |
| Hilfetext | die Beschreibung im Kopf des Skills (daraus entsteht die Skill-Liste). Kein Hilfetext eines Werkzeugs geändert |

**Neu im Skill:** zwei Quellen in zwei Abschnitten (Analyse in fester Form, `graph_suggest`); die Eingangsprüfung
mit Verweis auf `se-vorbereitung`; die Vorlage davor aus `graph_metrics` mit `scope` (Umfang, Zeilen der Ketten,
Träger je Risiko, Funktionsbaum, Modulbaum neben `policy`, Befunde ohne Bau); die Probe als Trockenlauf mit der
Lesart jedes Felds des Urteils; die Prüfung gegen die Prognose oben, in drei Antworten (verletzt, hält laut Probe,
offen bis zum Nachmessen); die Übergabe an den CR des Umbaus.

**Gestrichen:** das Anwenden durch den Skill; „Top-Vorschläge"; der Satz, der Skill laufe jederzeit (die Lage ist
jetzt nach CDR); die Behauptung, ohne Zielprofil sei jeder `score` 0.

**Geändert an Quelle (b):** Version 2 las `score` als Projektion auf die Zielrichtung. Das stimmt seit CR-GC-483
nicht mehr: `graph_suggest` reiht nach dem Steuerwert, `score` ist `verdict.steer.improvement`, `delta` wird nur
berichtet. Der Skill sagt das jetzt so, und der Test bindet es an eine echte Antwort. Das Zielprofil bleibt
erwähnt, wo es noch wirkt: `fitAdvisory` im Urteil des Trockenlaufs gibt es nur mit Gewichten.

### Offener Punkt: der Trockenlauf trägt die Vorlage „danach" nicht

**Erledigt mit CR-GC-790** (nachgetragen 2026-10-12, CR-GC-791): das Urteil des Trockenlaufs trägt `metricsAfter`; der Antwortweg ist seit CR-GC-783 eine Kennzahl (`answerPath`). Der Text darunter ist der Stand vom Tag des CR.

Der CR verlangt die Vorlage „davor und danach". Mit den heutigen Werkzeugen gibt es „danach" vor dem Anwenden
nur zum Teil.

| Teil der Vorlage | davor | nach dem Trockenlauf |
|---|---|---|
| Betrachtungsumfang | `graph_metrics` mit `scope` | nein |
| Zeilen der Ketten | `chains` | nein |
| Träger je Risiko | `riskCarriers` | nein |
| Antwortweg | keine Kennzahl (CR-SM-408) | nein |
| Modulbaum, Funktionsbaum | `modules`, `functions`, `policy` | nur verdichtet: `steerAdvisory` (Steuerwert, schlimmste Stelle), `fitAdvisory` (mit Zielprofil) |
| Befunde ohne Bau | `rules_get_violations` | die neu eingeführten, je Regel und Element (`violations`); was der Zug schließt, nur als Zahl je Stufe in `steeringDelta.stages`, und dort samt Bau |

Grund: `graph_mutate` mit `dryRun: true` stellt die Arbeitskopie nach dem Urteil zurück, `graph_metrics` misst
das geschriebene Modell. Der Test hält das fest (Urteil ohne `chains`, `riskCarriers`, `modules`, `functions`,
`scope`; `graph_metrics` nach der Probe gleich).

Der Skill verspricht deshalb nur das: für diese Teile steht vor der Wahl die Prognose des Vorschlags, die Spalte
„danach" füllt das Nachmessen im CR des Umbaus. Er rechnet nichts nach.

**Vorschlag, wo die Lücke zu schließen wäre** (eigener CR, ändert ein Werkzeug): im Trockenlauf von `graph_mutate`.
Das Gate gibt dort schon das Paar davor und danach heraus, und `zugBericht` (`src/kernel/measure/zug-bericht.ts`)
rechnet daraus die Berichte. Ein weiterer Bericht aus demselben Paar, nur im Trockenlauf: die Zeilen von
`chainMetrics`, `moduleMetrics` und `functionCriticality`, die sich ändern, und `riskCarriers` danach. Die Rechnung
bleibt in contracts, es entsteht kein zweiter Weg durchs Gate. Die Alternative, `graph_metrics` mit einem Zug als
Eingabe, wäre ein zweiter Leser des Gates und trüge das Urteil nicht mit. Die Spikes haben die Zahlen „danach" in
einem Wegwerf-Store durch echtes Anwenden gewonnen; das ist kein Weg für einen Skill.

### Trockenprobe: die drei Entwürfe des Falls sigllm (nur gelesen)

Stand sigllm `f8c01c5` (363 Elemente, 827 Kanten), in einem Wegwerf-Store mit den echten Werkzeugen:
`graph_metrics` mit `scope`, `rules_evaluate`, `graph_mutate` mit `dryRun: true`. Züge wie in `spike.mjs`. Im
Wegwerf-Store gilt die Startpolicy und kein Zielprofil, also kein `fitAdvisory`. An sigllm ist nichts geändert.

**Schritt 1.** Die Entwürfe der Notiz tragen Zweck (`REQ-post-local-agent-run-ends-in-one-of-three`), Kette und
Inhalt, aber weder Handlungsklasse noch Prognose noch Preis. Nach dem Skill gehen sie an die Analyse zurück. Für
die Probe weitergegangen; die Prüfung gegen die Prognose hat deshalb nur, was die Probe selbst meldet.

**Schritt 2.** `FCHAIN-local-agent-execution`: `measurable: true`.

**Schritt 3, davor** (für alle drei gleich, die Zahlen der Notiz):

| Teil | Wert |
|---|---|
| Umfang | 4 Module, 2 Ketten, 33 Anforderungen (von 85) |
| `FCHAIN-local-agent-execution` | `length` 8, `memberCount` 10, `branching` 2, `fanIn` 1, `moduleBoundaries` 4, kein Kreislauf, 1 geteilte Funktion, keine Importe, keine Übergaben |
| `FCHAIN-agent-and-platform-management` | `length` 7, `memberCount` 7, `fanIn` 1, `moduleBoundaries` 4, dieselbe geteilte Funktion |
| Träger je Risiko | 9 Risiken im Umfang, keines mit einem Träger: 7 über Module (3 bis 8 Träger), 2 am System (Sockel) |
| Risiken an den berührten Funktionen | Laufleiter, Prüfung, Auslieferung je 5; Ledger keine |
| Ketten durch die berührten Funktionen | Ledger 2, die übrigen 1 |
| Modulbaum | scheduler `cohesion` 0,25 und `lcom4` 1 (Schwelle 4/6); ledger `fanIn` 0, `fanOut` 2; `instability` gemessen, ohne Schwelle |
| Befunde ohne Bau | R-30 3, R-10 1, R-31 1, RD-05 2, CR-R01 5, AF-05 1, RC-01 21, RC-02 112, RC-03 24, CR-01 8, MT-02 1, MS-03 13 |
| Zu beurteilen je Funktion | Laufleiter 15 Anforderungen (2 eigene), Prüfung 14 (1), Auslieferung 14 (1), Ledger 10 (1) |

**Schritt 4, Probe:**

| | A Verteiltes Melden | B Ein Schreiber | C Unabhängiger Wächter |
|---|---|---|---|
| `success`, `tier` | ja, `auto-apply` | ja, `auto-apply` | ja, `suggest` |
| neue Befunde ohne Bau | keine | keine | R-04 an `MOD-platform-operations`, R-30 an der neuen Funktion, CR-01 zweimal (Hinweis), AF-05 |
| aus dem Bau, nicht gezählt | keine | keine | R-19 1, R-20 2 |
| `blockingErrors` | 0, 0 | 0, 0 | 0, 0 |
| `stages` | unverändert | unverändert | Funktion 3 auf 4, Modul 11 auf 13, Bindung 1 auf 4 |
| `steerAdvisory` | fehlt | fehlt | 0 auf 0,25, schlimmste Stelle R-04 an `MOD-platform-operations` |
| `workOrder` | fehlt | fehlt | `blind`: die neue Funktion |

**Was die Vorlage nicht zeigen kann** (in der Notiz gemessen durch Anwenden im Wegwerf-Store):

| Größe der Notiz | A | B | C |
|---|---|---|---|
| Länge der Kette | 8 auf 9 | 8 auf 10 | 8 |
| Kanten über Modulgrenzen | 4 auf 6 | 4 | 4 |
| Zulauf | 1 auf 3 | 1 auf 3 | 1 |
| Übergaben | 0 | 0 | 0 auf 2 |
| Kohäsion scheduler | 0,25 auf 0,20 | 0,25 auf 0,36 | 0,25 auf 0,20 |
| platform-operations, ledger | unverändert | unverändert | Zeilen geändert, gegen die Richtung 0 auf 1 |
| RC-05 | – | – | zwei Befunde weniger (läuft nicht im Gate) |

**Befund der Probe.** Vor der Wahl sind A und B in der Vorlage gleich: dasselbe Urteil, kein neuer Befund. Alles,
was sie in der Notiz unterscheidet, steht in der Spalte „danach". C hebt sich ab, aber nur an Befunden und
Steuerwert, nicht an der Zeile der Kette. Der Skill nennt keinen Sieger; mit diesem Stand der Werkzeuge hätte er
für A gegen B auch keine Zahl, an der ein Leser einen ablesen könnte. Zwei Dinge fielen auf und stehen im Skill:
der Umfang „davor" kennt das Modul nicht, in das C die neue Funktion legt (der Skill liest dessen Zeile dazu),
und `stages` zählt die Befunde aus dem Bau mit.

### Abnahme

- `npm run build`, Typprüfung: ohne Befund.
- `verify:code`: Spur CODE, 51 von 184 Dateien, 458 Tests grün.
- `verify:full CR-GC-785`: Spur CODE, Auswahl 51 von 184 Dateien; 1547 Tests, 2 rot: `distribution` und
  `lockfile-sync`, beide wegen des Link-Modus auf contracts 12.3.0. Die Messung zählt sie als Schlupf; die Folge
  bleibt bei 0 von 10.
- `rules_evaluate` am eigenen Modell, je Regel vor (graphVersion 693) und nach (694) verglichen: kein Fehler, jede
  der 24 Regeln mit Befund zählt gleich, keine neue Warnung.
- Der Skilltext enthält keine Summe über Kennzahlen und keine Rangfolge (Test).

### Abweichungen und Urteile

1. **„Davor und danach".** Der Skill liefert „danach" vor dem Anwenden nur, soweit der Trockenlauf es trägt
   (offener Punkt oben). Der Rest ist Prognose und wird im CR des Umbaus nachgemessen.
2. **Der Skill wendet gar nicht mehr an.** Version 2 wandte den gewählten Zug an. Jetzt endet der Skill mit der
   Wahl; auch ein kleiner Zug aus `graph_suggest` läuft über einen CR. Der Umgang ist für beide Quellen gleich.
3. **Erledigter Auftrag.** `tests/task-analysen.test.ts` verlangt vom Skill `docs/cr/done/`, `status: "done"` und
   `relation`. Der Text nennt das jetzt als Endzustand des CR des Umbaus, nicht mehr als Schritt des Skills. Der
   Test blieb unverändert.
4. **Vorschlag aus (b) ohne Prognose.** `graph_suggest` liefert keine. Der Skill fragt den Autor vor der Probe,
   was gleich bleiben muss. Der CR sagt dazu nichts.
5. **Der Zug zu einem Vorschlag aus (a)** steht nicht in der festen Form. Der Skill schreibt ihn aus Ort und
   Handlungsklasse und zeigt ihn vor der Probe als seine Übersetzung.
6. **Befunde aus dem Bau** sind wörtlich die vier Regeln. `AF-05` (Bauplan fällig, weil neue Elemente ungebaut
   sind) wächst ebenfalls mit neuen Elementen und wird gezählt; an C kam er so hinzu.
7. **Zu beurteilende Anforderungen.** Der Umfang einer Funktion nennt 10 bis 15 Anforderungen, davon 1 bis 2
   eigene. Der Skill führt die ganze Liste und verweist für die eigenen auf `graph_context`.
8. **Reihenfolge in Quelle (b).** `graph_suggest` liefert seine Liste gereiht. Der Skill zeigt sie so und sagt,
   dass die Reihenfolge vom Steuerwert stammt und kein Urteil über einen Entwurf ist.
9. **Nur zwei Formen des Zugs aus (b)** stehen im Skill, wie in Version 2: Anhängen und Umhängen. `edit` kann
   auch ein Zusammenlegen oder einen neuen Knoten tragen; dafür nennt der Skill kein Vorbild.
10. **Hilfe von `graph_suggest`.** Der Kurztext in `src/projections/tool-help.ts` sagt noch „in Richtung
    Zielprofil". Nicht geändert (Grenze des CR); ein Item wert.
11. **Modell.** Der Fluss von `graph_suggest` zum Skill und das Urteil des Trockenlaufs als Eingang stehen nicht
    im Modell; ergänzt ist nur der Abnehmer der Kennzahlen. Die Kante `CR-GC-785` auf `FUNC-graph-suggest`
    stammt aus der Anlage des CR und blieb, obwohl der CR das Werkzeug nicht ändert.
12. **Der Test** sieht ein Feld, das der Skill nennt und das es nicht gibt, nur für die im Test geführten Felder.
    Ein neu erfundenes Feld im Text fängt er nicht.

**Kongruenz:** kein Laufzeitcode. Die Bindung des Knotens ist die Skilldatei, die des Tests die Testdatei. RC-*
läuft nicht im Gate (`notInGate`), also nicht prüfbar.
