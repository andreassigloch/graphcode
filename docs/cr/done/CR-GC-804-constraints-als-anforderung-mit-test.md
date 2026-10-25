# CR-GC-804: Constraints als Anforderung mit Test — die projektlokale Regelfläche (Konzept, Diskussion)

**Status:** ✅ Done (2026-10-25)
**Typ:** aus Item ITEM-2026-887 (idea; dort noch unter dem alten Titel „Zielprofil als Anforderungen im Modell")
**Erstellt:** 2026-10-12, umgeschrieben 2026-10-13
**Item:** bok/items/ITEM-2026-887.json (Lane: code)

**Art:** Konzept vor einer Entscheidung des Autors. Noch kein Bauauftrag.

---

## Anlass

Das Architekturkonzept plante, das Zielprofil (`.graphcode/target-profile.json`, sechs Gewichte) ins Modell zu
holen und die vier Realisierungsdimensionen durch Kettenkennzahlen zu ersetzen. Beides ist nicht gebaut, und
die Grundlage ist weg: die feste Rangfolge aus Kennzahlen ordnete an drei Fällen anders als das Blindurteil
(CR-GC-781), zwei der drei Ersatzgrößen sind zur Streichung vorgeschlagen (ITEM-2026-882), die dritte ist
nicht gebaut.

Am 2026-10-13 hat die Diskussion die Frage gedreht: nicht *welche Kennzahl steuert*, sondern *wo eine
Entscheidung des Autors im Modell steht, damit das Werkzeug sie halten kann*.

## Schluss

**Kennzahlen finden, Constraints steuern.** Eine Kennzahl ohne Adressat (das Zielprofil) kann das Gate nicht
prüfen und der Autor nicht beantworten. Ein Constraint ist eine Anforderung an ein Element mit einem Test —
und das Modell kann das heute, ohne Änderung an contracts. Das Zielprofil entfällt.

## Vier Ebenen, eine Mechanik

Die Regeldiskussion kannte vier Ebenen. Die Familien-Regeln (`@sigloch/contracts/se`) decken jede Ebene mit
festen Prädikaten, die für jedes Modell gelten. Constraints sind die Entscheidungen *dieses* Projekts auf
derselben Ebene:

| Ebene | Familien-Regel (Boden, für alle) | Constraint (Projekt, vom Autor) | Adressat |
|---|---|---|---|
| Knoten | R-19/R-20 Bindung, FM-01 Bewertung | „diese Funktion ist performance-kritisch: Antwort ≤ n ms" | `FUNC -satisfy-> REQ` (NFR) |
| Block | R-22 Allokation, MT-02 Zusammenhalt | „dieses Modul ist gesichert: Zugang nur über Fluss f mit Vertrag s" | `MOD -satisfy-> REQ` |
| Kette | FC-04/05 Verdrahtung, NFR-01 Budget | „diese Kette liegt in einem Modul", „diese Kette hat Budget b" | `FCHAIN -satisfy-> REQ` |
| Gesamtmodell | R-18 Grammatik, Readiness | „kein Fluss kreuzt die Vertrauensgrenze ohne Prüfung" | `SYS -satisfy-> REQ` |

Alle vier Kanten erlaubt die Grammatik (`satisfy` auf nicht-funktionale REQ). Die Mechanik ist auf jeder Ebene
dieselbe:

1. **Die Anforderung** (nicht-funktional) hängt am Adressaten. Sie sagt in Prosa, was gilt, und trägt, wo es
   eine Zahl gibt, das Budget-Attribut (`timingBudgetMs`, …).
2. **Der Test** verifiziert sie (`TEST -verify-> REQ`) und zeigt per `testRef` auf eine echte Testdatei, die
   den Graph-Snapshot liest und die Eigenschaft prüft: Kanten, Allokation, Fan-in, Vertrauensgrenze. **Der
   Test ist das Messinstrument** — kein `measured*`-Attribut, das jemand nachpflegen muss.
3. **Das Ergebnis** kommt über die Lane an den TEST-Knoten (CR-GC-800), wird bei Änderung zurückgenommen
   (CR-GC-799) und von FM-03, R-01 und Readiness gelesen wie jede andere Verifikation.

Das Muster ist im Repo vorhanden, nur ohne Modellelement: `tests/import-boundaries.test.ts` ist ein Constraint
des Autors (Schichtordnung) als Test und Ratsche.

## Wer Constraints setzt

Constraints sind der Ort, an dem die Sichten ihre Entscheidungen ablegen — jede Sicht fügt ihre hinzu, am
selben Elementtyp:

| Sicht | setzt | Beispiel |
|---|---|---|
| ConOps / Use-Case-Sicht | welche Anwendungsfälle wichtig, welche Ketten performance-kritisch sind | Budget an der Kette, Priorität am UC |
| FMEA | Risiko → Gegenmaßnahme (`role: mitigation`) — das ist bereits ein Constraint mit Test | 19 Risiken im Modell (`docs/views/fmea.md`) |
| Sicherheits-Audit (Bedrohungsanalyse, ITEM-2026-885) | Vertrauensgrenzen an Flüssen, gesicherte Module | „Modul gesichert" |
| Budgetanalyse | Zeit- und Mengenbudgets | NFR-01 am FCHAIN/MOD |
| Architekturentscheidung | Schnitte, die halten sollen | „Kette in einem Modul", Schichtordnung |

Damit ist der Zweck je Kette (Analysekonzept §2) kein Sonderfall mehr, sondern die Kettenzeile der Tabelle.

## Abgrenzung: Familien-Regel oder Constraint

| | Familien-Regel (R-*, FM-*, NFR-*) | Constraint (REQ + TEST) |
|---|---|---|
| gilt für | jedes Modell der Familie | dieses Projekt, dieses Element |
| setzt | der Hüter, mit Version-Bump | der Autor, per `graph_mutate` |
| prüft | das Gate, bei jeder Mutation; blockt neue Fehler | die Lane, nach der Änderung; Test rot |
| misst | festes Prädikat im Katalog | die Testdatei |

Die Constraints spannen die projektlokale Regelfläche über den Familien-Boden. Eine Constraint-Klasse wird
zur Familien-Regel befördert, wenn sie in mehreren Repos gebraucht wird **und** im Gate blocken soll statt
erst in der Lane. Nicht vorher.

Die Ebenen-Tabelle hat der Autor am 2026-10-13 bestätigt.

## Gemessene Lücke: die Testauswahl erreicht den Block nicht

`impactedTests` (`src/kernel/measure/test-selection.ts`, Zeile 161) folgt `allocate` nur einwärts (ein
geändertes MOD zieht seine FUNCs nach), nie auswärts. Ändert sich eine FUNC *in* einem Modul, erreicht die
Auswahl den Test am Modul (`MOD -satisfy-> REQ <-verify- TEST`) nicht; ebenso wenig den Test an der Kette.
Ein Block- oder Ketten-Constraint liefe im Code-Lauf nicht mit, der Zug bliebe grün.

Zwei Wege, entscheidet der Autor:

- **A** Constraint-Tests in den festen Satz der Modell-Lane (`scripts/model-test-set.mjs`). Begründung: was
  einen Struktur-Constraint verletzt, ist ein Modellzug (neue Kante, neue Allokation), und der läuft über die
  Modell-Lane. Kein Code-Umbau.
- **B** `impactedTests` um `allocate` auswärts und `FCHAIN -compose-> FUNC` rückwärts erweitern. Dann wächst
  jede Auswahl um die Block- und Kettentests — Reichweite statt Minimalität.

## Was entfällt

- `.graphcode/target-profile.json`, `TargetWeightsSchema` (`src/loop/target-profile-contract.ts`), der Skill
  `se:target-profile`.
- Die sechs Dimensionen als Gewichte. Sie leben weiter nur dort, wo ein Autor eine Schwelle an ein Element
  schreibt.
- `graph_suggest` ordnet nach verletzten Constraints und dem schwächsten Ort (CR-SM-292), nicht nach einem
  Vektor.

Die vier Fragen der ersten Fassung lösen sich damit auf: 1) nicht das Profil ins Modell, sondern Constraints an
Elemente; 2) die Realisierungsdimensionen entfallen ersatzlos als Gewichte; 3) keine Eichung — der Autor setzt
die Schwelle je Element, Betriebsdaten korrigieren sie; 4) „Information jenseits der sechs Dimensionen" ist
gegenstandslos.

## Herunterdeklinieren: `se-vorbereitung` §2, für jede Anforderung oben

Ein Constraint wird oben gesetzt (System, Kette, Modul) und wandert in seine funktionalen Teile auf die
tiefste Ebene. Das ist der Schritt 2 der FMEA-Vorbereitung (`se-vorbereitung`), nur mit anderem Eingang: dort
die Gegenmaßnahme mit `by` = Modul oder System, hier jede nicht-funktionale Anforderung an Modul, Kette oder
System. Die vier Klassen tragen unverändert:

| Klasse | für einen Constraint | bleibt oben? |
|---|---|---|
| Tieferlegen | genau eine Funktion führt den Teil aus → funktionale REQ an der Blattfunktion, mit Test | nein |
| Zerlegen | „Modul gesichert" = *jeder Eingang passiert f mit Vertrag s* (funktional, an f) + *kein anderer Eingang existiert* (strukturell, am Modul, Snapshot-Test) | der strukturelle Teil |
| Funktion fehlt | kein Glied kann den Teil ausführen → Item; der Constraint bleibt oben, Readiness zeigt ihn unverifiziert | ja |
| Gilt quer | bindet jede Funktion (Vertrauensgrenze an allen Flüssen) → ein Snapshot-Test am System | ja |

Lesehilfe wie heute: `graph_metrics({ scope })` für Module, Ketten und Anforderungen des Umfangs. `riskCarriers`
liest nur Anforderungen mit `role: risk`; für einen Constraint ohne Rolle sammelt der Skill die Blattfunktionen
über Kette und Allokation selbst, oder die Ableitung in contracts wird auf alle nicht-funktionalen Anforderungen
verallgemeinert (klein; Hüter). **Budgets** sind der Sonderfall: ihr Herunterdeklinieren ist die Aufteilung
entlang des Antwortwegs — das ist die offene Budgetanalyse (ITEM-2026-885), nicht dieser CR.

## Konflikte und Vorschläge: nichts läuft online

Drei Momente, keiner pro Mutation:

1. **Beim Setzen** — der Skill fragt, verortet, schlägt das Herunterdeklinieren vor; der Autor wählt.
2. **An der Marke PDR** — `se-vorbereitung`, vor den Analysen, wie heute.
3. **In der Lane** — der Constraint-Test wird rot. Das einzige laufende Signal; es kostet den Testlauf, der
   ohnehin läuft.

Das Gate prüft weiter nur die Familien-Regeln. FMEA, ConOps und Constraints-Walk laufen auf Anforderung, mit
Stempel (AF-01…04). **Ein Konflikt** zwischen zwei Constraints heißt: kein Zug macht beide Tests grün. Das ist
nicht vorab berechenbar — der Probelauf von `graph_mutate` liefert Kennzahlen, keine Testergebnisse. Der Konflikt
zeigt sich nach dem Zug in der Lane (wie `import-boundaries` heute); die Analyse dazu ist `se:optimize` auf
Anforderung: rote Constraint-Tests sind die schwächsten Orte, der Gesamt-Impact ist die Vorlage (CR-GC-785,
CR-GC-790). `graph_suggest` liest rote Constraint-Tests statt des Gewichtsvektors. Eine Rangfolge unter
Constraints gibt es nicht — rot ist rot, die Reihenfolge entscheidet der Autor; nur Risiken tragen S/O/D.

## Der Skill: `se:target-profile` wird `se-constraints`

Ein CREATE-Skill nach dem Muster von `se-conops`: eine Prüfliste je Ebene — welche Ketten sind
performance-kritisch, welches Modul ist gesichert, welche Kette bleibt in einem Modul, welche Flüsse kreuzen
eine Vertrauensgrenze —, liest den Umfang (`graph_metrics`, `graph_elements`), schreibt REQ + TEST durch das
Gate (`se:author-req`), schlägt das Herunterdeklinieren vor, hält den Walk als geschlossenen CR fest und
stempelt. Die sechs Gewichte und ihre Fragen entfallen. Ein eigener Constraint entsteht jederzeit ohne den Skill
über `se:author-req`. Die zwei Klassen „Modul gesichert" und „Kette in einem Modul" sind Beispiele der
Prüfliste, keine Festlegung.

## Entschieden (Autor, 2026-10-13)

1. Die vier Ebenen tragen.
2. Skill-Umbau wie oben; die zwei Klassen sind Beispiele.
3. Herunterdeklinieren über `se-vorbereitung` §2; Konflikte in der Lane, Vorschläge auf Anforderung — nichts
   online. (Vorschlag dieses CR, vom Autor als offen benannt; die Fassung oben ist die Antwort.)
4. Rückbau des Zielprofils als eigener CR, wenn dieser abgeschlossen ist.
5. Lücke der Testauswahl: Weg A. Ein Constraint-Test liest den committeten Snapshot und fällt damit unter das
   Muster `graph.json` in `scripts/model-test-set.mjs`; der Vollständigkeits-Test zwingt ihn in den Satz.
6. Trägerableitung in contracts: `riskCarriers` wird auf alle nicht-funktionalen Anforderungen an Modul, Kette
   oder System verallgemeinert (Hüter, Version-Bump).

Sprachregelung: die drei Prüfläufe (`verify:model`, `verify:code`, `verify:full`) heißen **Test-Lanes**, zur
Unterscheidung von der Lane eines Arbeitszugs (`aise dispatch prepare --lane graph|code`).

## Umfang, falls gebaut wird

Skill `se-constraints` (ersetzt `.claude/commands/se/target-profile.md`), `se-vorbereitung` §2 mit dem weiteren
Eingang, erster Walk am eigenen Modell mit Positivkontrolle (ein verletzender Zug wird rot), je nach Weg A ein
Eintrag in `scripts/model-test-set.mjs` oder ein Umbau in `test-selection.ts` mit Test. Rückbau Zielprofil
(`src/loop/target-profile*.ts`, `graph_suggest`, jedes Repo mit Profildatei): eigener CR.

## Schnitt (2026-10-25)

Der Umfang oben braucht mehr als 10 Dateien: Skill neu, Skill alt löschen samt sieben Verweisen in Code,
Skills und Tests, `se-vorbereitung` §2, zwei Text-Tests, Constraint-Test, `model-test-set.mjs`. Dieser CR
schließt als Konzept; gebaut wird in drei Teil-CRs, Reihenfolge nach Abhängigkeit:

| Teil | CR | Inhalt | wartet auf |
|---|---|---|---|
| 1 | CR-GC-851 | erster Constraint am eigenen Modell: REQ + Snapshot-Test + Positivkontrolle, Eintrag in `model-test-set.mjs` (Weg A) | Wahl des Constraints durch den Autor |
| 2 | CR-GC-852 | Skill `se-constraints`, `se-vorbereitung` §2 mit dem zweiten Eingang, Text-Tests | Entscheidung 6 in contracts (ITEM-2026-1057, sigloch-modules) |
| 3 | CR-GC-853 | Rückbau Zielprofil samt Skill `se:target-profile` und seinen Verweisen (Entscheidung 4) | CR-GC-851 und CR-GC-852 |

Abweichung vom Umfang oben: das Löschen von `.claude/commands/se/target-profile.md` wandert in Teil 3. Der
Skill setzt Gewichte, die `graph_suggest` bis zum Rückbau liest; ohne ihn bliebe die Profildatei ohne Pflege.

