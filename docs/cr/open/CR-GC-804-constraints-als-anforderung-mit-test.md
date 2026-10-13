# CR-GC-804: Constraints als Anforderung mit Test — die projektlokale Regelfläche (Konzept, Diskussion)

**Status:** 🟠 Open
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

## Erster Schritt, falls der Autor zustimmt

Zwei Klassen an je einem echten Fall im eigenen Modell, ohne neue Kennzahl, nur mit vorhandenen Kanten:

1. **Modul gesichert** — Kandidat aus der Bedrohungsanalyse (ITEM-2026-885) oder dem Kern (`MOD-kernel`).
2. **Kette in einem Modul** — Kandidat aus den Architekturvorschlägen der FMEA (ITEM-2026-879).

Je Fall: REQ am Adressaten, TEST mit Testdatei über den Snapshot, Lauf über die gewählte Lane, Nachweis, dass
ein verletzender Zug rot wird (Positivkontrolle). Danach erst der Rückbau des Zielprofils als eigener CR.

## Fragen an den Autor

1. Trägt die Ebenen-Tabelle, oder fehlt eine Ebene (Fluss? Anwendungsfall?)?
2. Welche zwei Fälle zuerst — die Kandidaten oben oder andere?
3. Lücke der Testauswahl: Weg A (Modell-Lane) oder B (Walk erweitern)?
4. Rückbau des Zielprofils: sofort nach den zwei Fällen, oder erst wenn eine dritte Sicht (Audit) Constraints
   gesetzt hat?

## Umfang, falls gebaut wird

Erster Schritt: zwei REQ, zwei TEST, zwei Testdateien, je nach Weg A ein Eintrag in `scripts/model-test-set.mjs`
oder ein Umbau in `test-selection.ts` mit Test. Rückbau Zielprofil: `src/loop/target-profile*.ts`,
`graph_suggest`, Skill `se:target-profile`, jedes Repo mit Profildatei — eigener CR.
