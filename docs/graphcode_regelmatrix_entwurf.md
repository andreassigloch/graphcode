# Regelmatrix, vereinfacht — Entwurf

Stand 2026-10-06 · Entwurf zur Diskussion, kein Code · Zahlen aus dem Katalog `@sigloch/contracts` (Regelsatz 37.0.0,
77 Regeln) · umgesetzt wird in sigloch-modules (Smeagol), graphcode zieht nach.

## 1. Der eine Mechanismus

Es gibt keine Phase und keinen Gate-Zustand. Es gibt Regeln, und jede Regel hat eine **Menge**: die Elemente, die sie
prüft. Daraus folgt alles:

1. **Fällig** ist eine Regel, sobald ihre Menge nicht leer ist.
2. Für jede Pflichtmenge gibt es eine **Existenz-Regel**, die sie verlangt („kein Anwendungsfall → lege einen an").
   Eine leere Pflichtmenge ist deshalb immer ein Befund — der Existenz-Regel eine Stufe davor.
3. Die Mengen stehen in einer festen Reihenfolge, den **Stufen**. Der nächste Schritt ist der erste Befund in dieser
   Reihenfolge; die Reihenfolge priorisiert, sie verbietet nichts.
4. Ein Gate ist eine Marke zwischen zwei Stufen: „bis hierher kein fälliger Befund".

„0 von 0" kann damit nicht mehr als bestanden gelesen werden: Entweder ist die Menge freiwillig (dann gibt es nichts
zu bestehen), oder die Existenz-Regel davor ist offen. Für den Nutzer bleibt die Zahl, für den Agenten bleibt
„in Ordnung" oder „Aktion".

**Eine Korrektur an meinem Vorschlag vom Vortag.** Ich hatte formuliert: „Alles hinter dem ersten offenen
Existenz-Befund ist nicht fällig." Das hält der ersten Checkfrage nicht stand (§5.1) und widerspricht der Leitlinie §3
(„Was nie blockt, ist die Reihenfolge"). Fällig richtet sich nach der eigenen Menge, nicht nach der Position.

## 2. Die Stufen

| Stufe | Menge | Existenz-Regel, die sie verlangt | Marke danach |
|---|---|---|---|
| 1 | System | **fehlt** — heute fest im Code von `graph_generate` (Kaltstart) | |
| 2 | Anwendungsfall, Akteur | R-17 (System hat Anwendungsfälle), UC-02 (Anwendungsfall hat Akteur) | |
| 3 | Anforderung | UC-01 (Anwendungsfall hat Anforderungen) | |
| 4 | Wirkkette | UC-03 (Anwendungsfall hat Wirkkette) | SRR |
| 5 | Funktion | R-15 (Wirkkette hat Funktionen) | |
| 6 | Datenfluss | R-31 (Funktion ist verdrahtet) | |
| 7 | Modul | R-22 (Funktion wohnt in einem Modul) | PDR |
| 8 | Schema | **keine eigene** — heute ein Ausschnitt der Grammatikregel R-18 | CDR |
| 9 | Test | R-01 (Anforderung hat einen Test) | |
| 10 | Bau | **fehlt als Regel** — heute dreimal verschieden gebaut (§4) | |
| 11 | Bindung | — (R-19, R-20, R-26 prüfen die Bindung von Test, Funktion, Schema) | TRR |
| 12 | Abgleich Modell gegen Code | — (RC-01 bis RC-10) | |

**Freiwillige Mengen** haben keine Existenz-Regel; ihre Regeln sind fällig, sobald es die Elemente gibt, und sonst
still: Änderungsaufträge und Meilensteine (Plan), Risiko-Anforderungen (Fehlerbetrachtung).

**Analysen** (Einsatzkonzept, Variantenvergleich, Annahmen-Review, Fehlerbetrachtung, Bauplan) sind Existenz-Regeln
für ein Artefakt statt für eine Menge. Sie dürfen als einzige mit Begründung abgenommen werden.

**Stufe 10 ist die Grenze zum Coding.** Erfüllt ist sie, wenn der Bauplan durchgeführt ist oder eine Bindung an Code
existiert. Nur die 16 Regeln der Stufen 11 und 12 hängen an ihr; sie sind die einzigen, deren Menge schon im Entwurf
existiert (Tests, Funktionen, Schemas), die aber erst mit dem Bau etwas zu prüfen haben. Das ist der eine Sonderfall,
der bleibt — als Spalte der Matrix, nicht als eigene Tabelle.

## 3. Die Matrix

Spalten je Regel: **Stufe** (daraus Rang und Gate), **Menge**, **Schwere**, **Rolle** (Existenz, Analyse oder leer).
Die Spalte „Gate heute" steht nur zum Vergleich da.

| Stufe | Regel | prüft | Menge | Schwere | Rolle | Gate heute | Gate aus Stufe |
|---|---|---|---|---|---|---|---|
| – immer | CR-R03 | No concurrent mutation | all | Warnung |  | SRR | – |
| – immer | R-08 | Trace consistency | all | **Fehler** |  | PDR | – |
| – immer | R-18 | Valid trace pattern | all | **Fehler** |  | PDR | – |
| 2 Anwendungsfall | R-17 | SYS must have compose | SYS | Warnung | Existenz | SRR | SRR |
| 2 Anwendungsfall | UC-02 | UC has actor | UC | Warnung | Existenz | SRR | SRR |
| 2 Anwendungsfall | AF-01 | ConOps freshness stamp present | graph | Warnung | Analyse | SRR | SRR |
| 2 Anwendungsfall | CL-01 | ConopsCompleteness | ACTOR | Warnung |  | SRR | SRR |
| 2 Anwendungsfall | FC-02 | Leaf UC has FCHAIN | UC | Warnung |  | SRR | SRR |
| 2 Anwendungsfall | R-16 | ACTOR must have io | ACTOR | Warnung |  | SRR | SRR |
| 2 Anwendungsfall | UC-04 | UC has goal | UC | Warnung |  | SRR | SRR |
| 3 Anforderung | UC-01 | UC has requirements | UC | Warnung | Existenz | SRR | SRR |
| 3 Anforderung | BQ-01 | Unambiguous | REQ | Warnung |  | SRR | SRR |
| 3 Anforderung | BQ-02 | Verifiable | REQ | Warnung |  | SRR | SRR |
| 3 Anforderung | BQ-04 | Necessary | REQ | Warnung |  | SRR | SRR |
| 3 Anforderung | BQ-06 | Conforming | REQ | Warnung |  | SRR | SRR |
| 3 Anforderung | BQ-07 | Complete | REQ | Warnung |  | SRR | SRR |
| 3 Anforderung | FM-01 | RiskReqFmeaAttributes | REQ | Warnung |  | SRR | SRR |
| 3 Anforderung | FM-02 | RiskReqMitigation | REQ | Warnung |  | SRR | SRR |
| 3 Anforderung | FM-03 | HighRiskVerification | REQ | Warnung |  | TRR | SRR ≠ |
| 3 Anforderung | RD-01 | Unresolved requirement | REQ | Warnung |  | SRR | SRR |
| 3 Anforderung | RD-02 | Decomposition consistency | REQ | Warnung |  | SRR | SRR |
| 4 Wirkkette | UC-03 | UC has scenario | UC | Warnung | Existenz | SRR | SRR |
| 4 Wirkkette | FC-04 | FCHAIN actor-bounded (trigger+consumer) | FCHAIN | Warnung |  | PDR | SRR ≠ |
| 4 Wirkkette | FC-05 | FCHAIN is connected (producer -> consumer) | FCHAIN | Warnung |  | PDR | SRR ≠ |
| 5 Funktion | R-15 | FCHAIN completeness | FCHAIN | Warnung | Existenz | PDR | PDR |
| 5 Funktion | BW-02 | Whitebox boundary width | FUNC | Warnung |  | PDR | PDR |
| 5 Funktion | FC-03 | FCHAIN is flat | FUNC | Warnung |  | PDR | PDR |
| 5 Funktion | IO-01 | FuncPairIOCompleteness | FUNC | Warnung |  | PDR | PDR |
| 5 Funktion | MT-04 | Whitebox cohesion (LCOM4) | FUNC | Hinweis |  | PDR | PDR |
| 5 Funktion | ND-01 | FuncNearDuplicate | FUNC | Warnung |  | PDR | PDR |
| 5 Funktion | R-02 | FUNC must satisfy REQ | FUNC | Warnung |  | PDR | PDR |
| 5 Funktion | R-12 | No circular dependencies | FUNC | Warnung |  | PDR | PDR |
| 5 Funktion | R-21 | FUNC↔FUNC handover needs a shared chain covered by member REQs or an integration test | FCHAIN, FUNC | Warnung |  | TRR | PDR ≠ |
| 5 Funktion | R-30 | FUNC leaf must belong to a function chain | FUNC | Warnung |  | PDR | PDR |
| 6 Datenfluss | R-31 | FUNC must be wired (io input + output) | FUNC | Warnung | Existenz | PDR | PDR |
| 6 Datenfluss | IO-02 | FLOW single producer | FLOW | **Fehler** |  | PDR | PDR |
| 6 Datenfluss | R-10 | FLOW completeness | FLOW | Warnung |  | PDR | PDR |
| 7 Modul | R-22 | FUNC must be allocated to MOD | FUNC | Warnung | Existenz | PDR | PDR |
| 7 Modul | AF-02 | Trade Study freshness stamp present | graph | Warnung | Analyse | PDR | PDR |
| 7 Modul | AF-03 | Assumption Review freshness stamp present | graph | Warnung | Analyse | PDR | PDR |
| 7 Modul | CR-01 | CrossingFlowCount | MOD | Warnung |  | PDR | PDR |
| 7 Modul | IR-01 | Assumption review promoted to CR | graph | Warnung | Analyse | PDR | PDR |
| 7 Modul | MT-01 | Module instability | MOD | Warnung |  | PDR | PDR |
| 7 Modul | MT-02 | Module cohesion (LCOM4) | MOD | Warnung |  | PDR | PDR |
| 7 Modul | NFR-01 | BudgetOvershoot | MOD, FUNC, FCHAIN | Warnung |  | CDR | PDR ≠ |
| 7 Modul | R-04 | Module boundary width | MOD | Warnung |  | PDR | PDR |
| 7 Modul | R-23 | MOD must have allocated FUNC | MOD | Warnung |  | PDR | PDR |
| 7 Modul | RD-04 | Decomposition breadth | FUNC, MOD, SYS | Warnung |  | PDR | PDR |
| 7 Modul | RD-05 | Decomposition too narrow | FUNC, MOD | Warnung |  | PDR | PDR |
| 7 Modul | TR-01 | Trade decision recorded as CR | graph | Warnung | Analyse | PDR | PDR |
| 8 Schema | AF-04 | FMEA freshness stamp present | graph | Warnung | Analyse | CDR | CDR |
| 8 Schema | ND-02 | SchemaNearDuplicate | SCHEMA | Warnung |  | CDR | CDR |
| 8 Schema | SC-02 | Schema referenced by FLOW | SCHEMA | Warnung |  | CDR | CDR |
| 9 Test | R-01 | REQ must have verification | REQ | **Fehler** | Existenz | TRR | TRR |
| 9 Test | R-05 | TEST must verify REQ | TEST | Warnung |  | TRR | TRR |
| 10 Bau | AF-05 | Implementation Plan freshness stamp present | graph | Warnung | Existenz | PDR | TRR ≠ |
| 11 Bindung | R-19 | Runnable TEST binding | TEST | Warnung |  | TRR | TRR |
| 11 Bindung | R-20 | FUNC realRef binding | FUNC | Warnung |  | TRR | TRR |
| 11 Bindung | R-26 | SCHEMA must have realRef | SCHEMA | Warnung |  | TRR | TRR |
| 11 Bindung | R-29 | Test file exclusivity | TEST | **Fehler** |  | TRR | TRR |
| 11 Bindung | R-32 | SCHEMA must have contract TEST | SCHEMA | Warnung |  | TRR | TRR |
| 11 Bindung | VR-01 | TestNoResult | TEST | Hinweis |  | TRR | TRR |
| 12 Abgleich | RC-01 | FUNC realRef resolves to a declared symbol | FUNC | Warnung |  | – | TRR |
| 12 Abgleich | RC-02 | testRefs entries resolve to runnable tests | TEST | Warnung |  | – | TRR |
| 12 Abgleich | RC-03 | SCHEMA realRef resolves to a declared export | SCHEMA | Warnung |  | – | TRR |
| 12 Abgleich | RC-04 | SCHEMA realRef is parsed at its interface | SCHEMA | Warnung |  | – | TRR |
| 12 Abgleich | RC-05 | cross-module import drift | MOD | Warnung |  | – | TRR |
| 12 Abgleich | RC-06 | external realRef names a declared dependency | FUNC, MOD, SCHEMA | Warnung |  | – | TRR |
| 12 Abgleich | RC-07 | CR node agrees with docs/cr | CR, SYS | Warnung |  | – | TRR |
| 12 Abgleich | RC-08 | SCHEMA realRef is a Zod schema | SCHEMA | Warnung |  | – | TRR |
| 12 Abgleich | RC-09 | SCHEMA is parsed only at its modelled interface | SCHEMA | Warnung |  | – | TRR |
| 12 Abgleich | RC-10 | MOD has resolvable files | MOD | Warnung |  | – | TRR |
| Plan  | CR-R01 | CR must track | CR | Warnung |  | SRR | – |
| Plan  | CR-R02 | Done requires commit | CR | Warnung |  | TRR | – |
| Plan  | MS-01 | Milestone empty scope | MS | Warnung |  | SRR | – |
| Plan  | MS-02 | Milestone dangling dependency | MS | Warnung |  | SRR | – |
| Plan  | MS-03 | CR without milestone | CR | Hinweis |  | SRR | – |

**Gelesen:**
- **Das Gate lässt sich aus der Stufe ableiten.** Bei 53 der 59 Regeln, die heute ein Gate und im Entwurf eine Stufe haben,
  stimmt die Ableitung mit der Handzuordnung überein. Die sechs Abweichungen (≠): FM-03, FC-04, FC-05, R-21, NFR-01, AF-05. Die zehn
  Abgleichregeln, die heute an keinem Gate hängen, bekommen über die Stufe eines.
- **Fünf Regeln sind Fehler** und blockieren am Gate der Schreiboperation: R-08, R-18, R-01, IO-02, R-29. Daran ändert
  der Entwurf nichts.
- **Drei Regeln gelten für alle Elemente** (R-08, R-18, CR-R03) und haben keine Stufe.

## 4. Was entfällt

| Heute | Wo | Ersatz |
|---|---|---|
| Zuordnung Regel → Gate (67 Einträge) | contracts | abgeleitet aus der Stufe |
| Pflichtliste je Gate mit eigenem Quelltyp (9 Einträge) | graphcode-client | Rolle „Existenz" in der Matrix |
| Vorbedingung „erst ab Baubeginn" (4 Regeln) | contracts, seit CR-SM-392 | Stufe 10 |
| „Code-Präsenz nur, wenn etwas gebunden ist" | graphcode, Fokusmenge | Stufe 10 |
| Kaltstart-Stufen (kein System, kein Anwendungsfall) | graphcode, `graph_generate` | Existenz-Regeln der Stufen 1 und 2 |
| Gate-Zustand mit drei Werten und Anzeigetext | graphcode-client, seit CR-SM-394 | „fälliger Befund ja oder nein" |
| Gate-Punktzahl (Regeln ohne Fehler durch Zahl der Regeln) | graphcode-client | entfällt |
| Vollständigkeit je Gate („x von y") | graphcode-client | Befunde der Existenz-Regeln |
| Phasenabdeckung („8 von 8 Regeln") | graphcode | entfällt |
| Kerntyp je Dimension (Mehrheitsrechnung) | se-engine | „0 geprüft" ist kein Urteil |

„Bau begonnen" ist heute dreimal gebaut: als Vorbedingung im Katalog, als Filter in der Fokusmenge von graphcode und
als Stempel-Regel des Bauplans. Daraus wird eine Regel.

**Die Prozentwerte je Dimension bleiben** als zweite Sicht auf dieselben Regeln, nach Thema statt nach Stufe. Sie
rechnen dann mit der Zahl, die die Regel wirklich geprüft hat, statt mit der Zahl der Elemente ihres Typs.

## 5. Checkfragen

### 5.1 Der Kunde ignoriert die Ausgabe und macht etwas anderes

| Was er tut | Was passiert | Hält das Gummiband? |
|---|---|---|
| Springt vor: legt Funktionen und Module an, bevor es Anwendungsfälle gibt | Die Schreiboperation geht durch. Die Regeln über Funktionen und Module sind fällig, weil ihre Menge existiert; er bekommt Rückmeldung zu dem, was er gerade baut. Der nächste Schritt zeigt weiter auf die früheste Lücke. | Ja, aber nur mit Fälligkeit nach Menge. Mit „alles hinter der ersten Lücke schweigt" bekäme er zu seiner Arbeit keine Rückmeldung mehr. |
| Schreibt Code, ohne den Bauplan zu machen | Die erste Bindung erfüllt Stufe 10, alle Bindungsregeln werden fällig. | Ja. Das ist die „Klippe" aus CR-SM-392, hier ist sie gewollt: Wer baut, bekommt die Bau-Regeln. |
| Schreibt Code am Modell vorbei, ohne zu binden | Das Modell sieht nichts. | **Nein.** Das fängt nur der Abgleich über den Git-Diff (ITEM-2026-751) oder ein Code-Import. |
| Bindet auf etwas, das es nicht gibt | Die Abgleichregel RC-01 meldet, dass die Bindung nicht auflöst. | Ja. |
| Nimmt Befunde ab, um Ruhe zu haben | Abnehmbar sind nur Analysen, mit Begründung, und sie werden gezählt. | Ja, solange die Liste so kurz bleibt. |
| Folgt nie dem nächsten Schritt | Der Schritt bleibt stehen, die Zahl der Befunde wächst. Nichts eskaliert. | **Offen.** Ein Band ohne Zeitachse zieht nicht (Befund aus dem sigllm-Fremdlauf). Siehe Frage 4. |

### 5.2 Import eines undefinierten Projekts

Ein Code-Import liefert Funktionen und Module, aber kein System mit Absicht, keine Anwendungsfälle, keine
Anforderungen.

- **Die früheste Lücke wird gefunden**, weil die Existenz-Regeln von der Wurzel aus fragen: kein System → Stufe 1,
  System ohne Anwendungsfälle → Stufe 2. Der nächste Schritt lautet dann „Anwendungsfälle nachtragen", also
  Rückwärts-Spezifikation.
- **Alle Regeln über die importierten Mengen sind sofort fällig.** Das ist richtig, erzeugt aber eine Flut: moneyflow
  allein trägt über tausend Befunde. Der Agent darf davon nur ein Fenster sehen, geordnet nach Stufe. Dieses Fenster
  gibt es heute schon; es muss nach Stufe statt nach Dimension ordnen.
- **Stufe 10 muss für einen Import erfüllt sein.** moneyflow zeigt, dass das heute nicht gilt: 306 importierte
  Funktionen ohne eine einzige Bindung lesen wie ein Entwurf. Der Import muss die Bindung mitschreiben, sonst weiß
  das Modell nicht, dass es Code gibt.

### 5.3 Weitere Fälle, die ich durchgespielt habe

- **Änderung an einem gebauten Projekt.** Eine neue Funktion ist ungebunden, Stufe 10 ist erfüllt, also meldet die
  Bindungsregel genau die neuen Elemente. Das ist die Arbeitsliste der Änderung, ohne eigenen Mechanismus.
- **Rückfall.** Wird der letzte Anwendungsfall gelöscht, öffnet sich die Existenz-Regel wieder. Die Regeln über die
  späteren Mengen bleiben fällig.
- **Teilmengen.** Einer von fünf Anwendungsfällen hat eine Wirkkette: vier normale Befunde, kein Sonderfall.
- **Abgenommene Analyse.** Wer die Fehlerbetrachtung abnimmt, hat keine Risiko-Anforderungen; deren Regeln bleiben
  still, weil die Menge leer und freiwillig ist.
- **Bauplan abgenommen.** Stufe 10 bleibt offen, die Bindungsregeln bleiben still. So liefen die Läufe der Stufe
  „warnungsfrei" vom 2026-10-05.

## 6. Meine Fragen

1. **Stufe 10:** Gilt „Bau begonnen" bei durchgeführtem Bauplan *oder* erster Bindung (so seit CR-SM-392), oder nur
   bei durchgeführtem Bauplan? Mit „oder" kann niemand unbemerkt am Bauplan vorbei bauen; dafür schaltet eine
   einzelne Bindung alle Bau-Regeln ein.
2. **Die sechs Abweichungen beim Gate:** Folgt das Gate künftig streng der Stufe, oder bleibt eine Spalte für
   Ausnahmen? Streng heißt zum Beispiel: Der Bauplan gehört zur Testbereitschaft statt zum Vorentwurf.
3. **Rückmelde-Fenster:** Wie viele Befunde sieht der Agent je Antwort, wenn Hunderte fällig sind? Heute ein Fenster
   je Dimension; mein Vorschlag ist ein Fenster je Stufe, früheste zuerst.
4. **Gummiband ohne Zeitachse:** Soll etwas eskalieren, wenn der nächste Schritt über viele Züge ignoriert wird, zum
   Beispiel die Zahl der übersprungenen Stufen in jeder Antwort? Blockieren schließt die Leitlinie aus.
5. **Schema-Pflicht:** Bekommt „jeder Datenfluss hat ein Schema" eine eigene Regel, statt an der Grammatikregel zu
   hängen? Das ist eine Regel mehr und der letzte doppelt gepflegte Quelltyp weniger.
6. **Genaue Zahl „geprüft":** Jede Regel meldet ihre Menge selbst. Das berührt alle 77 Regeln. Als eigener Schritt
   nach der Matrix, oder im selben Zug?

## 7. Was der Entwurf nicht ändert

Die Regeln selbst, ihre Schwere, die fünf blockierenden Fehler, die Zuordnung zu Analysen und die Hilfetexte. Es
ändert sich, **woraus** Rang, Gate und Fälligkeit kommen: aus einer Spalte statt aus sechs Tabellen in drei Paketen.
