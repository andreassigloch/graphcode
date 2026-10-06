# Regelmatrix, vereinfacht — Entwurf

Stand 2026-10-06, dritte Fassung nach den Entscheidungen des Autors (§8) · Entwurf, kein Code · Zahlen aus dem Katalog
`@sigloch/contracts` (Regelsatz 37.0.0, 77 Regeln) · umgesetzt wird in sigloch-modules (Smeagol), graphcode zieht nach.

## 1. Der eine Mechanismus

Es gibt keine Phase und keinen Gate-Zustand. Es gibt Regeln, und jede Regel hat eine **Menge**: die Elemente, die sie
prüft.

1. **Fällig** ist eine Regel, sobald ihre Menge nicht leer ist.
2. Für jede Pflichtmenge gibt es eine **Existenz-Regel**, die sie verlangt („kein Anwendungsfall → lege einen an").
   Eine leere Pflichtmenge ist deshalb immer ein Befund — der Existenz-Regel eine Stufe davor.
3. Die Mengen stehen in einer festen Reihenfolge, den **Stufen**. Der nächste Schritt ist der erste Befund in dieser
   Reihenfolge. Die Reihenfolge priorisiert, sie verbietet nichts (Leitlinie §3).
4. Ein Gate ist eine **Marke** zwischen zwei Stufen: „bis hierher kein fälliger Befund".

„0 von 0" kann damit nicht als bestanden gelesen werden: Entweder ist die Menge freiwillig, oder die Existenz-Regel
davor ist offen. Der Nutzer sieht Zahlen, der Agent bekommt „in Ordnung" oder „Aktion".

## 2. Die Stufen

| Stufe | Menge | Existenz-Regel, die sie verlangt | Marke danach |
|---|---|---|---|
| 1 | System | **neu** — heute fest im Code von `graph_generate` (Kaltstart) | |
| 2 | Anwendungsfall, Akteur | R-17 (System hat Anwendungsfälle), UC-02 (Anwendungsfall hat Akteur) | |
| 3 | Anforderung | UC-01 (Anwendungsfall hat Anforderungen) | |
| 4 | Wirkkette | UC-03 (Anwendungsfall hat Wirkkette) | SRR |
| 5 | Funktion | R-15 (Wirkkette hat Funktionen) | |
| 6 | Datenfluss | R-31 (Funktion ist verdrahtet) | |
| 7 | Modul | R-22 (Funktion wohnt in einem Modul) | PDR |
| 8 | Schema | **neu** — „Datenfluss hat ein Schema", heute ein Ausschnitt der Grammatikregel R-18 | CDR |
| 9 | Test | R-01 (Anforderung hat einen Test), R-32 (Schema hat einen Test) | TRR |
| 10 | Plan (Aufträge, Meilensteine) | AF-05, neu gefasst: „Ungebautes hat einen Auftrag" — eine Analyse, abnehmbar | |
| 11 | Bindung | — (R-19, R-20, R-26, R-29, VR-01) | |
| 12 | Abgleich Modell gegen Code | — (RC-01 bis RC-10) | Bau |

**Die Spezifikation endet mit der Testbereitschaft** (Stufe 9): Jede Anforderung und jedes Schema hat einen Test.

**Ab Stufe 10 ist es ein Vorgang, derselbe für den ersten Bau und für jede Änderung:**

1. **Ungebautes** sind Funktionen, Tests und Schemas ohne Bindung an Code. Beim ersten Bau ist das alles, bei einer
   Änderung sind es die neuen Elemente.
2. **Planen:** Gibt es Ungebautes ohne offenen Auftrag, lautet der Befund „Bauplan fällig". Das Ergebnis des Bauplans
   sind Aufträge (und Meilensteine), keine Marke am System.
3. **Bauen:** Sobald es einen offenen Auftrag oder eine Bindung gibt, sind die Bindungsregeln fällig. Ihre Befunde
   sind die Arbeitsliste: Sie starten das Coding und enden, wenn alles gebunden ist. Eine Bindung von Hand, ohne
   Bauplan, zählt genauso.
4. **Abgleichen:** Die Regeln Modell gegen Code prüfen, was gebunden ist.

Die Marke „Bau" heißt: kein fälliger Befund in den Stufen 10 bis 12. Sie ist nach dem ersten Bau erreicht und geht
mit jeder Änderung wieder auf, bis die neuen Elemente geplant, gebunden und abgeglichen sind.

Eine eigene Regel „Bauplan durchgeführt, aber nichts gebunden" braucht es damit nicht: Nach dem Planen stehen die
Bindungsregeln selbst als Befunde da.

**Analysen** (Einsatzkonzept, Variantenvergleich, Annahmen-Review, Fehlerbetrachtung, Bauplan, neu: Konsolidierung)
sind Existenz-Regeln für ein Artefakt. Nur sie dürfen mit Begründung abgenommen werden. Wer den Bauplan abnimmt
(„Bau nicht beauftragt"), hat eine warnungsfreie Spezifikation.

**Freiwillige Menge** bleibt nur die der Risiko-Anforderungen (Fehlerbetrachtung): Ihre Regeln sind fällig, sobald
es die Elemente gibt.

## 3. Die Matrix

Spalten je Regel: **Stufe** (daraus Rang und Marke), **Menge**, **Schwere**, **Rolle** (Existenz, Analyse oder leer).
„Gate heute" steht nur zum Vergleich da; ≠ markiert, wo die Marke aus der Stufe von der heutigen Handzuordnung abweicht.

| Stufe | Regel | prüft | Menge | Schwere | Rolle | Gate heute | Marke aus Stufe |
|---|---|---|---|---|---|---|---|
| immer | CR-R03 | No concurrent mutation | all | Warnung |  | SRR | – |
| immer | **neu** | Regel mit mehr als drei fälligen Befunden → Konsolidierung | Befunde | Warnung | Analyse | – | – |
| immer | R-08 | Trace consistency | all | **Fehler** |  | PDR | – |
| immer | R-18 | Valid trace pattern | all | **Fehler** |  | PDR | – |
| 1 System | **neu** | Graph hat ein System | graph | Warnung | Existenz | (Code) | SRR |
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
| 8 Schema | **neu** | Datenfluss hat ein Schema | FLOW | Warnung | Existenz | (R-18) | CDR |
| 8 Schema | AF-04 | FMEA freshness stamp present | graph | Warnung | Analyse | CDR | CDR |
| 8 Schema | ND-02 | SchemaNearDuplicate | SCHEMA | Warnung |  | CDR | CDR |
| 8 Schema | SC-02 | Schema referenced by FLOW | SCHEMA | Warnung |  | CDR | CDR |
| 9 Test | R-01 | REQ must have verification | REQ | **Fehler** | Existenz | TRR | TRR |
| 9 Test | R-32 | SCHEMA must have contract TEST | SCHEMA | Warnung | Existenz | TRR | TRR |
| 9 Test | R-05 | TEST must verify REQ | TEST | Warnung |  | TRR | TRR |
| 10 Plan | AF-05 | Ungebautes hat einen Auftrag (heute: Bauplan-Stempel vorhanden) | Ungebautes | Warnung | Existenz | PDR | Bau ≠ |
| 10 Plan | CR-R01 | CR must track | CR | Warnung |  | SRR | Bau ≠ |
| 10 Plan | CR-R02 | Done requires commit | CR | Warnung |  | TRR | Bau ≠ |
| 10 Plan | MS-01 | Milestone empty scope | MS | Warnung |  | SRR | Bau ≠ |
| 10 Plan | MS-02 | Milestone dangling dependency | MS | Warnung |  | SRR | Bau ≠ |
| 10 Plan | MS-03 | CR without milestone | CR | Hinweis |  | SRR | Bau ≠ |
| 11 Bindung | R-19 | Runnable TEST binding | TEST | Warnung |  | TRR | Bau ≠ |
| 11 Bindung | R-20 | FUNC realRef binding | FUNC | Warnung |  | TRR | Bau ≠ |
| 11 Bindung | R-26 | SCHEMA must have realRef | SCHEMA | Warnung |  | TRR | Bau ≠ |
| 11 Bindung | R-29 | Test file exclusivity | TEST | **Fehler** |  | TRR | Bau ≠ |
| 11 Bindung | VR-01 | TestNoResult | TEST | Hinweis |  | TRR | Bau ≠ |
| 12 Abgleich | RC-01 | FUNC realRef resolves to a declared symbol | FUNC | Warnung |  | – | Bau |
| 12 Abgleich | RC-02 | testRefs entries resolve to runnable tests | TEST | Warnung |  | – | Bau |
| 12 Abgleich | RC-03 | SCHEMA realRef resolves to a declared export | SCHEMA | Warnung |  | – | Bau |
| 12 Abgleich | RC-04 | SCHEMA realRef is parsed at its interface | SCHEMA | Warnung |  | – | Bau |
| 12 Abgleich | RC-05 | cross-module import drift | MOD | Warnung |  | – | Bau |
| 12 Abgleich | RC-06 | external realRef names a declared dependency | FUNC, MOD, SCHEMA | Warnung |  | – | Bau |
| 12 Abgleich | RC-07 | CR node agrees with docs/cr | CR, SYS | Warnung |  | – | Bau |
| 12 Abgleich | RC-08 | SCHEMA realRef is a Zod schema | SCHEMA | Warnung |  | – | Bau |
| 12 Abgleich | RC-09 | SCHEMA is parsed only at its modelled interface | SCHEMA | Warnung |  | – | Bau |
| 12 Abgleich | RC-10 | MOD has resolvable files | MOD | Warnung |  | – | Bau |

**Gelesen:**
- **Die Marke folgt streng der Stufe.** Bei 48 der 64 vergleichbaren Regeln ist das die heutige Zuordnung. 16
  wandern: elf zur Marke „Bau" (die fünf Bindungsregeln, der Bauplan und die fünf Regeln über Aufträge und
  Meilensteine), fünf innerhalb der Spezifikation (FM-03, FC-04, FC-05, R-21, NFR-01). Die zehn Abgleichregeln, die
  heute an keinem Gate hängen, bekommen die Marke „Bau".
- **Drei Regeln sind neu:** zwei Existenz-Regeln (System, Schema) und der Wächter für die Konsolidierung (§6). Die
  beiden Existenz-Regeln ersetzen Sonderlogik, die es heute an anderer Stelle gibt. **Eine Regel wird neu gefasst:**
  AF-05 fragt nicht mehr nach einem Stempel, sondern ob Ungebautes einen Auftrag hat.
- **Fünf Regeln sind Fehler** und blockieren die Schreiboperation: R-08, R-18, R-01, IO-02, R-29. Unverändert.

## 4. Was entfällt

### Tabellen und Rechnungen

| Heute | Wo | Ersatz |
|---|---|---|
| Zuordnung Regel → Gate (67 Einträge) | contracts | abgeleitet aus der Stufe |
| Pflichtliste je Gate mit eigenem Quelltyp (9 Einträge) | graphcode-client | Rolle „Existenz" in der Matrix |
| Vorbedingung „erst ab Baubeginn" (4 Regeln) | contracts, seit CR-SM-392 | Menge der Stufen 11 und 12 |
| „Code-Präsenz nur, wenn etwas gebunden ist" | graphcode, Fokusmenge | dieselbe Menge |
| Kaltstart-Stufen (kein System, kein Anwendungsfall) | graphcode, `graph_generate` | Existenz-Regeln der Stufen 1 und 2 |
| Gate-Zustand mit drei Werten und Anzeigetext | graphcode-client, seit CR-SM-394 | „fälliger Befund ja oder nein" |
| Gate-Punktzahl (Regeln ohne Fehler durch Zahl der Regeln) | graphcode-client | entfällt |
| Vollständigkeit je Gate („x von y") | graphcode-client | Befunde der Existenz-Regeln |
| Phasenabdeckung („8 von 8 Regeln") | graphcode | entfällt |
| Kerntyp je Dimension (Mehrheitsrechnung) | se-engine | „0 geprüft" ist kein Urteil |

### Attribute, Stempel und Schalter für die Phasensteuerung

| Was | Wozu es eingeführt wurde | Vorschlag |
|---|---|---|
| `concept` an fünf Elementtypen | Zwischenstand im Bau | entfallen (CR-SM-393) |
| Aktualität der Analyse-Artefakte (aktuell, veraltet, fehlt) samt Schalter „Durchsetzung an/aus" | Gate nur mit frischen Analysen bestanden | **auflösen** — im Produktpfad steht der Schalter seit CR-GC-259 auf „aus", die Rechnung läuft also ohne Wirkung |
| Pflicht-Analysen je Gate (eigene Tabelle) | welche Analyse an welches Gate gehört | **auflösen** — die Analyse-Regel trägt ihre Stufe selbst |
| Vier Bau-Gates (SAR, FCA, SVR, FRR), fest an vier Meilenstein-Kennungen gebunden | Abnahme des Baus je Meilenstein | **auflösen** zugunsten der einen Marke „Bau" (§2). Heute sind das vier zusätzliche Gates, die prüfen, ob alle Aufträge eines bestimmten Meilensteins erledigt sind; die vier Kennungen sind die des graphcode-Projekts selbst und passen auf kein anderes |
| Zuordnung Regel → Arbeitsschritt (Kern, Einsatzkonzept, Fehlerbetrachtung, Plan, Realisierung …) | der Kern soll Detailregeln fremder Artefakte nicht sehen | **weitgehend auflösen** — Regeln über freiwillige Mengen schweigen von selbst, bis es die Elemente gibt. Es bleibt die Zuordnung Analyse → Skill. Ausnahme zu prüfen: CL-01 |
| Liste „abnehmbar je Arbeitsschritt" | was mit Begründung abgelehnt werden darf | **kürzen** auf die Analysen. Die vier Bindungsregeln stehen dort nur, weil sie im Entwurf feuerten |
| Umfangsschalter „schlank/voll" und Profilliste „se/coding" | zwei Lesarten der Readiness | **prüfen** — ob beide noch einen Leser haben, habe ich nicht nachverfolgt |
| Bauplan-Stempel am System | „Bauplan durchgeführt", einmal für immer | **auflösen** — der Plan ist die Menge der offenen Aufträge, und er wird bei jeder Änderung wieder fällig. Ein einmaliger Stempel kann das nicht ausdrücken |

**Bleiben:**
- Analyse-Stempel am System (vier, ohne den Bauplan), als einziger Nachweis „durchgeführt". Aus dem Ergebnis ableiten ginge nur, wenn
  eine Analyse nie ohne Ergebnis enden kann; eine Fehlerbetrachtung ohne Risiko ist aber möglich.
- Abgenommene Befunde mit Begründung, `external`, die Rolle einer Anforderung in der Fehlerbetrachtung,
  `architectureOnly` und `status` am Änderungsauftrag: Das sind Tatsachen über das Projekt, keine Steuerung.
- Das Steuergedächtnis (zurückgestellte Fenster, Stillstand): Es ist die Zeitachse des Gummibands.

**Prozentwerte je Dimension bleiben** als zweite Sicht auf dieselben Regeln, nach Thema statt nach Stufe (§6).

## 5. Rückmeldung an den Agenten — was wir heute tun

Die Zahl der Rückmeldungen ändert der Entwurf nicht. Was heute gilt, ist gemessen entstanden:

| Kanal | Umfang heute | Herkunft |
|---|---|---|
| Schritt von `graph_generate` | ein Fenster: höchstens drei Befunde **einer** Regel | CR-GC-290. Gemischte Fenster ergaben widersprüchliche Anweisungen; qwen verbrauchte daran 4347 Denk-Token ohne Werkzeugaufruf |
| Wiederholung | dasselbe Fenster zweimal ohne Fortschritt → zurückgestellt; drei Steuerzüge ohne Verbesserung → Stillstand, Übergabe an den Menschen | CR-GC-281, CR-GC-596 |
| Antwort einer Schreiboperation | ein Eintrag je Regel mit allen betroffenen Elementen; dazu ein Satz Vorschlag an den Nutzer | CR-GC-570, 64 % weniger Antwortbytes |
| Ganze Liste (`rules_evaluate`) | alles, auf Anfrage | |

Erfahrung aus den Läufen vom 2026-10-05:
- Der eine Satz Vorschlag wird von beiden Armen befolgt.
- Die ganze Liste verträgt Opus ohne Mühe (8 bis 16 Warnungen in ein bis zwei Zügen). qwen kommt ebenfalls ans Ziel,
  braucht aber je Zug 9 bis 34 Minuten; der längste Zug war der mit 16 Warnungen.
- Aus der Executor-Zeit: Ein Vorbild im Hinweis wirkt, ein Verbot nicht. Ein Zug darf nicht zu groß werden.

**Was sich ändert:** nur die Ordnung. Das Fenster wird nach Stufe gewählt statt nach Dimension, früheste zuerst. Es
bleibt bei einer Regel und drei Elementen je Schritt. **Kein zusätzlicher Zug, keine zusätzliche Zahl für den Agenten.**

Die genaue Zahl „geprüft" je Regel braucht der Agent nicht. Sie wäre nur für die Prozentanzeige des Nutzers
genauer als die heutige Zählung nach Elementtyp. Sie ist **nicht Teil dieses Umbaus**.

## 6. Eskalation und Wächter

**Eskalation ist die Readiness im Viewer.** Sie gibt es schon: Prozent je Dimension und die Marken. Wer den nächsten
Schritt ignoriert, sieht die Werte fallen. Es kommt kein neuer Mechanismus dazu, und es blockiert nichts.

**Wächter „Konsolidierung"** (neu, als Analyse):
- Eine Regel ohne Stufe: Übersteigt die Zahl der fälligen Warnungen ein Maß, lautet der Befund „Konsolidierung
  fällig".
- Sie verhält sich wie jede Analyse: ein Befund am System, ein Skill dahinter, mit Begründung abnehmbar. Der Kunde
  kann sie ignorieren; im Viewer bleibt sie sichtbar.
- Wiederverwendbar sind `se:close-violations` (arbeitet Befunde nach Rang ab), `graph_suggest` (Architekturzüge nach
  Wirkung) und die Doppelgänger-Regeln ND-01/ND-02.
- **Das Maß ist das Fenster aus §5:** Hat eine einzelne Regel mehr als drei fällige Befunde, also mehr, als ein
  Schritt abarbeitet, ist die Konsolidierung fällig. Es gibt keine zweite Schwelle und keine Eichung.

## 7. Checkfragen

### 7.1 Der Kunde ignoriert die Ausgabe und macht etwas anderes

| Was er tut | Was passiert | Hält das Gummiband? |
|---|---|---|
| Springt vor: legt Funktionen und Module an, bevor es Anwendungsfälle gibt | Die Schreiboperation geht durch. Die Regeln über Funktionen und Module sind fällig, weil ihre Menge existiert. Der nächste Schritt zeigt weiter auf die früheste Lücke. | Ja |
| Bindet Code, ohne den Bauplan zu machen | Die erste Bindung macht die Regeln der Stufen 11 und 12 fällig. Für das übrige Ungebaute bleibt „Bauplan fällig" stehen. | Ja |
| Schreibt Code am Modell vorbei, ohne zu binden | Das Modell sieht nichts. | **Nein.** Das fängt nur der Abgleich über den Git-Diff (ITEM-2026-751) oder ein Code-Import. |
| Bindet auf etwas, das es nicht gibt | RC-01 meldet, dass die Bindung nicht auflöst. | Ja |
| Nimmt Befunde ab, um Ruhe zu haben | Abnehmbar sind nur Analysen, mit Begründung, gezählt. | Ja |
| Folgt nie dem nächsten Schritt | Die Befunde wachsen, die Readiness im Viewer fällt, der Wächter meldet „Konsolidierung fällig". | Ja, als Anzeige. Es zwingt nichts. |

### 7.2 Import eines undefinierten Projekts

- **Die früheste Lücke wird gefunden**, weil die Existenz-Regeln von der Wurzel aus fragen: kein System → Stufe 1,
  System ohne Anwendungsfälle → Stufe 2. Der nächste Schritt ist Rückwärts-Spezifikation.
- **Alle Regeln über die importierten Mengen sind sofort fällig.** Der Agent sieht davon weiter nur ein Fenster; der
  Wächter schlägt sofort an. Das ist für einen Import die richtige erste Meldung.
- **Der Import muss die Bindung an Code mitschreiben**, sonst hat das Projekt für das Modell keinen Code. moneyflow
  ist so ein Fall (306 Funktionen ohne Bindung) und bleibt laut Entscheidung unberücksichtigt; für künftige Importe
  ist es eine Anforderung an den Importweg.

### 7.3 Weitere Fälle

- **Änderung an einem gebauten Projekt.** Eine neue Funktion ist ungebunden: „Bauplan fällig" für sie, und die
  Bindungsregel meldet genau die neuen Elemente. Das ist die Arbeitsliste der Änderung, mit demselben Vorgang wie
  beim ersten Bau.
- **Rückfall.** Wird der letzte Anwendungsfall gelöscht, öffnet sich die Existenz-Regel wieder.
- **Bauplan abgenommen, nichts gebunden.** Die Stufen 11 und 12 bleiben still; die Spezifikation kann warnungsfrei sein.
- **Auftrag erledigt, Element noch ungebunden.** Der Befund „Bauplan fällig" kommt für dieses Element wieder.
- **Letzte Bindung entfernt, kein offener Auftrag.** Die Stufen 11 und 12 verstummen wieder. Das ist richtig, wenn
  der Code wirklich weg ist, und eine Lücke, wenn nur die Bindung gelöscht wurde; siehe „Code am Modell vorbei".

## 8. Entschieden (Autor, 2026-10-06)

1. Der Bau beginnt mit der ersten Bindung, ob per Bauplan oder von Hand.
2. Der Bauplan kommt nach der Testbereitschaft.
3. Rückmeldung an den Agenten: wie heute gemessen (§5), nur nach Stufe geordnet.
4. Eskalation ist die Readiness im Viewer; vorhandenes wiederverwenden.
5. Jeder Datenfluss hat ein Schema, jedes Schema einen Test (R-32 bleibt für alle Schemas).
6. Die genaue Zahl „geprüft" braucht der Agent nicht; keine zusätzlichen Züge.
7. Ein Wächter schlägt eine Konsolidierung vor, als Analyse, ignorierbar. Sein Maß ist das Fenster: mehr als drei
   Befunde einer Regel.
8. Weitere Attribute und Stempel der Phasensteuerung auflösen (§4).
9. Planen und Bauen sind ein Vorgang, derselbe für den ersten Bau und für jede Änderung. Nach dem Plan muss etwas
   das Coding starten.

## 9. Offen

1. **Fünf Regeln wandern innerhalb der Spezifikation**, wenn die Marke streng der Stufe folgt (FM-03, FC-04, FC-05,
   R-21, NFR-01). Die Ursache ist jeweils, dass die Regel einen früheren Elementtyp prüft, als ihr Thema nahelegt.
   Annahme bis auf Widerspruch: Sie folgen der Stufe.
2. **Der Wächter in großen Modellen.** Mit dem Maß „mehr als drei Befunde einer Regel" steht er in jedem Import und
   in jedem größeren Bestandsmodell dauerhaft an. Ob das als Hinweis trägt oder zu laut ist, zeigt sich am Bestand.
3. **„Ungebautes hat einen Auftrag"** ist die Frage der gestrichenen Regel CR-R05, jetzt einmal je Zustand statt je
   Anforderung. Zu klären bei der Umsetzung: Reicht „es gibt einen offenen Auftrag", oder muss der Auftrag auf die
   ungebauten Elemente zeigen? Das Erste ist einfacher; das Zweite hatten wir verworfen, weil Plan und Ist fast
   immer abweichen und der Git-Diff die Wahrheit ist.
