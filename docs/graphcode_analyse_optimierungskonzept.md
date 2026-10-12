# Analyse- und Optimierungskonzept

11. Okt. 2026 · @Andreas Sigloch · Fassung 3 (Entwurf; Abschnitt 10 und die Neufassung von 6b nach den Spikes vom 10. und 11. Oktober)

**Bezug:** Leitlinie §5 „Optimieren" (`docs/graphcode_leitlinie.md`) ist der Anker. Die Kennzahlen der
Wirkkette, die Handlungsklassen und das Gegengewicht Blast-Radius definiert
`docs/graphcode_architektur_konzept.md`; dieses Dokument wiederholt sie nicht, es sagt, **wofür sie
gelesen werden, von wem und in welcher Form das Ergebnis ins Modell geht**.

## Kernaussage

Jede Zieldimension einer Architektur (Sicherheit, Laufzeit, Informationssicherheit, …) hängt als
Anforderung an einer Wirkkette. Kennzahlen nennen die Orte der Kette, an denen sich diese Dimension
entscheidet. Ein Analyse-Skill je Dimension beurteilt die Orte und liefert Befunde, fehlende
Anforderungen, Umbauvorschläge und Konflikte. Die Kennzahlen zeigen dem Autor, wo ein Vorschlag eingreift
und was er dazu lesen muss; die Wahl trifft er.

Grundlage von allem ist die Güte des Modells: geschlossene Wirkketten und Anforderungen am richtigen Träger
auf der tiefsten möglichen Ebene. Wo sie fehlt, misst keine Analyse etwas (Abschnitt 10).

Das verbindet zwei Teile der Leitlinie §5, die bisher nebeneinander standen: die
Realisierungsarchitektur (Kennzahlen der Kette) und die inhaltliche Optimierung (FMEA, IRR).

## Begriffe

| Begriff | Bedeutung |
|---|---|
| Zweck | eine nicht-funktionale Anforderung an eine Wirkkette, aus einer Zieldimension |
| Ort | eine strukturell auffällige Stelle einer Kette, deterministisch aus dem Graphen gerechnet |
| Analyse | die Beurteilung der Orte einer Kette unter einem Zweck, durch einen Skill und den Autor |
| Kreuzungspunkt | eine Funktion, die in mehreren Ketten liegt (geteilte Funktion) |
| Vorschlag | ein Umbau der Kette in einer Handlungsklasse, mit benanntem Zweck und Prognose |
| Sicht | einer der vier Schnitte durch das Modell: Modul, Funktion, Anforderung, Wirkkette |
| Gesamt-Impact | die Wirkung eines Vorschlags auf die Kennzahlen aller vier Sichten |
| Reichweite einer Änderung | was eine Änderung nach sich zieht; hängt von ihrer Art ab |

## 1. Die Wirkkette steht für die Kundenfunktion

Die Wirkkette ist das Zusammenspiel ihrer Funktionen, nicht ihre Summe: sie kann ihr Ergebnis
verfehlen, ohne dass eine Einzelfunktion ausfällt — an einer Übergabe, in einem Kreislauf. Darum
arbeitet die Analyse an Orten, nicht an einer Liste von Funktionen.

## 2. Der Zweck hängt als Anforderung an der Kette

Eine nicht-funktionale Anforderung an einen Use Case, die eine Eigenschaft von Auslöser bis Ergebnis
beschreibt, erfüllt seine Wirkkette (`FCHAIN -satisfy-> REQ`, in der Grammatik vorhanden).
Funktionale Anforderungen erfüllt die Einzelfunktion, strukturelle Vorgaben das Modul oder das System.

Katalog der Zieldimensionen ist ISO/IEC 25010:2023 (neun Merkmale):

| Merkmal der Norm | Zweck an der Kette | Analyse |
|---|---|---|
| Sicherheit (Safety) | Was geschieht, wenn ein Glied versagt? | FMEA (`se-fmea`, vorhanden) |
| Zuverlässigkeit: Verfügbarkeit | Wie oft erreicht die Kette ihr Ergebnis? | FMEA, dieselben Orte |
| Informationssicherheit | Wo kreuzen Daten eine Vertrauensgrenze? | Bedrohungsanalyse über die Flüsse (offen) |
| Leistungseffizienz: Zeitverhalten, Kapazität, Ressourcennutzung | Laufzeit, Durchsatz, Kosten je Durchlauf | Budgetanalyse (offen) |
| Wartbarkeit: Modifizierbarkeit | — | keine Kettenanalyse; bleibt Modellseite und Gegengewicht (Blast-Radius) |
| Wartbarkeit: Testbarkeit | — | abgedeckt durch die Sicht Testkonzept |
| Funktionale Eignung, Kompatibilität, Interaktionsfähigkeit, Flexibilität | — | hängen nicht an der Kette |

## 3. Vier Sichten

Das Modell hat vier Sichten (dieselben, die der Viewer als Ansichten führt). Jede trägt ihre Kennzahlen;
die Kennzahlen der Sichten hängen zusammen, und alle ziehen an denselben Vorschlägen.

| Sicht | Gegenstand | Kennzahlen heute | Rolle |
|---|---|---|---|
| Modul | der Modulbaum: Abhängigkeiten und Schnitte | Zusammenhalt (MT-02), Ein- und Ausgangsgrad, Instabilität, Schnittstellenbreite und Kreuzungen (BW-02, R-04, CR-01), Breite je Ebene (RD-04, RD-05) | Modellgüte, zweckneutral, mit Schwelle |
| Funktion | der Funktionsbaum: Zerlegung bis zur gebundenen Funktion | Breite je Ebene (RD-04, RD-05), Zusammenhalt der Whitebox (MT-04), Reichweite je Funktion (Ketten, Anwendungsfälle), Bindung an Code | Modellgüte und Träger der Bewertung |
| Anforderung | Anforderungen mit Erfüller und Test | erfüllt und geprüft je Anforderung, Bindung an Tests, Bewertungen der Analysen (bei der FMEA Schwere, Auftreten, Entdeckung) | Zweck und Nachweis |
| Wirkkette | Kundenfunktion von Auslöser bis Ergebnis | Kettenkennzahlen und ihre Orte | Zweck je Kette, beurteilt durch die Analysen |

- **Ein Element steht in mehreren Sichten.** Eine geteilte Funktion ist in der Kettensicht ein
  Kreuzungspunkt, in der Funktionssicht eine Funktion mit großer Reichweite, in der Modulsicht ein Beitrag
  zum Eingangsgrad ihres Moduls und in der Anforderungssicht der Erfüller mehrerer Anforderungen.
- **Das Gesamtprojekt ist keine fünfte Sicht**, sondern die vier zusammen. Was nur über alle gilt, sind die
  Vorbedingungen: Bewertbarkeitsquote, Bindungsquote, Marken.
- Der Steuerwert von `graph_suggest` liest heute nur Regeln der Modul- und Funktionssicht. Ein Vorschlag
  ohne die Kettensicht kennt keinen Zweck (Beleg: Spike zu CR-GC-771, 2026-10-10 — ein bewusst unsinniger
  Modulschnitt gewann, weil er das Größenband traf).

## 4. Orte

Die Kennzahlen nennen die Orte, sie bewerten nicht. **Gerechnet wird an einer Stelle**: `chainMetrics`
in `@sigloch/contracts/se`, angezeigt über `graph_metrics`. Kein Skill rechnet ein eigenes Profil.

| Ort | Warum er für die Kette zählt | FMEA | Bedrohung | Budget |
|---|---|---|---|---|
| Eingang, Ausgang | hier beginnt und endet die Wirkung am Akteur | Fehlerfolge | Vertrauensgrenze | Messpunkte der Zeit |
| Import | eine fremde Kette liefert zu, an einer Funktion, die nur dieser Kette gehört | fremde Ursache | fremde Daten | fremde Wartezeit |
| Übergabe | die Folge tritt in einer anderen Kette auf | Folge anderswo | Daten verlassen die Kette | — |
| Verzweiger, Zulauf | mehrere Folgen oder mehrere Ursachen an einer Stelle | ja | — | parallel oder nacheinander |
| Kreislauf | Ursache und Folge sind nicht mehr gerichtet | ja | — | Zahl der Umläufe |
| Geteilte Funktion | Kreuzungspunkt mehrerer Ketten; ihre Zuflüsse stehen an ihr | gemeinsame Ursache | gemeinsamer Angriffspunkt | Engstelle |
| Modulgrenze | die Verantwortung wechselt; je Vertrag eine Schnittstelle | Schnittstellenfehler | Vertrauensgrenze | Kosten des Übertritts |

Nicht aus der Struktur findbar: das Innere einer Blatt-Funktion und die Betriebserfahrung.

## 5. Vier Ergebnisse je Analyse

Für die Kette und für einzelne Funktionen:

| | Ergebnis | Wohin |
|---|---|---|
| a | Analyseergebnis | Text eines geschlossenen CR (`docs/cr/done/`) |
| b | Anforderungsdefizit | neue Anforderung mit Test, durchs Gate |
| c | Vorschlag zur Architektur der Kette (Länge, Abhängigkeiten, Verortung), mit seiner Wirkung auf die Kennzahlen des Modul- und des Funktionsbaums | Vorschlag in einer Handlungsklasse; angewandt wird er erst in der Optimierung |
| d | Konflikt an einem Kreuzungspunkt | an der geteilten Funktion, nicht in einer der Ketten |

Zu d: an einer geteilten Funktion treffen sich Ketten mit verschiedenen Zwecken. Dieselbe Änderung
hilft der einen und schadet der anderen; dieselbe Kennzahl hat je Zweck ein anderes Vorzeichen.
Optimiert wird deshalb gegen einen benannten Zweck je Kette, nie gegen die Kennzahl.

## 6. Optimierung

Zwei Teile, in dieser Reihenfolge:

**(a) Vorschläge in einer Analysedimension.** Ein Vorschlag stammt aus Ergebnis c einer Analyse und
nennt Zweck, Kette, Ort und Handlungsklasse (Entkoppeln, Zusammenlegen, Verschieben, Aufteilen,
Vorverlagern — Architekturkonzept, „Handlungsklassen").

**(b) Gesamt-Impact.** Der Vorschlag wird per Trockenlauf geprobt. Der Gesamt-Impact ist die Vorlage für
das Urteil des Autors, kein Verfahren, das Vorschläge ordnet. Er zeigt davor und danach:

1. den Betrachtungsumfang: die Anforderungen an den berührten Funktionen, ihren Modulen, den Ketten durch
   sie und am System;
2. die Orte: jede Kette, deren Zeile sich ändert, mit der Zeile;
3. die Flächen: sicherheitsrelevante und laufzeitrelevante Fläche (Abschnitt 10);
4. die Kennzahlen der Modul- und der Funktionssicht mit ihren Schwellen.

Die frühere Fassung ordnete nach einer festen Rangfolge (Invarianten, Zwecke der Ketten, Modellgüte,
Reichweite). Sie ist gestrichen: an drei Fällen mit neun Entwürfen widersprach jede Rangfolge aus den
Kennzahlen mindestens einmal dem Blindurteil (Abschnitt 10, Belege).

**Die Reichweite einer Änderung ist keine Kennzahl einer Sicht**, sie gehört zur Änderung und hängt von
ihrer Art ab:

| Art der Änderung | Was sie nach sich zieht | Heute gerechnet durch |
|---|---|---|
| Code einer Funktion | abhängige Elemente und die Tests, die neu laufen müssen | `graph_impact`, `graph_tests` |
| Bewertung einer Funktion in einer Analyse | die Ketten durch die Funktion und deren Anforderungen | Reichweite je Funktion in `graph_metrics` |
| Umbau der Kette (Vorschlag) | beides, dazu die Kennzahlen der vier Sichten | nicht vorhanden |

## 7. Konventionen

### Analyse-Skills

1. **Einheit ist eine Wirkkette.** Ohne benannte Kette fragt der Skill; ein Modul oder das System als
   Umfang wird auf seine Ketten aufgelöst.
2. **Erster Schritt jeder Analyse ist die Verdrahtung der Kette.** Die Regeln dazu (R-30, R-31, R-21,
   IO-01, FC-04, FC-05) sind Warnungen, kein Fehler; das Gate hält eine unverbundene Kette nicht auf. Eine
   davon hält eine Marke: ein Befund von FC-05 (Kette hängt nicht zusammen) hält PDR, die übrigen halten
   keine. Der Skill liest ihre Befunde und `measurable` für die Kette; solange dort etwas offen ist, ist das
   Schließen dieser Befunde das Ergebnis, nicht die Analyse.
   **Zweiter Schritt ist der Betrachtungsumfang:** die Glieder der Kette, ihre Module, alle Ketten durch
   diese Glieder und das System, dazu jede Anforderung, die eines davon erfüllt. Er nennt, was die Analyse
   lesen muss. Gemessen an drei Ketten (graphanalyze `docs/messung/flaechen-2026-10-11/`): 39 bis 48 Prozent
   der Anforderungen, darin 22 von 24, die ein Gutachter als verletzt oder gefährdet nannte. Ein
   Flussschritt mehr fasst alle 24, wächst an einer Drehscheibe aber auf rund 80 Prozent. Gerechnet wird er
   als Ableitung in contracts (`requirementScope`, CR-SM-407), nicht als Feld der Kettenzeile.
3. **Der Skill liest die Orte aus `graph_metrics` und rechnet keine Kennzahl.** Was ihm fehlt, wird in
   `chainMetrics` ergänzt, nicht im Skill-Text.
4. **Pflichtquellen vor freier Ableitung.** Der Skill geht die Ortsarten seiner Dimension ab (Tabelle
   in Abschnitt 4); freie Befunde kommen danach und nur für das, was die Orte nicht deckten.
5. **Jeder Befund nennt seinen Ort** mit den Kennungen der Elemente und der Quelle (Ortsart oder „frei
   abgeleitet").
6. **Geteilte Funktionen gehören zur Analyse der Kette.** Eine schon analysierte wird zitiert, nicht
   wiederholt.
7. **Die Bewertung gehört dem Autor.** Der Skill legt vor und empfiehlt; ohne Bestätigung wird nichts
   geschrieben. Eine Vorbelegung ist als solche gekennzeichnet. Im Lauf ohne Nutzer gilt die Regel der
   FMEA: schreiben, was die Methode als Pflicht einstuft, und das im Bericht sagen.
8. **Die vier Ergebnisse haben feste Form** (Abschnitt 5). Ein Vorschlag (c) nennt Zweck, Kette, Ort,
   Handlungsklasse und Prognose; der Skill wendet ihn nicht an.
9. **Attribute:** an Knoten erlaubt, solange nur der Skill und sein Dokument sie lesen. Liest eine
   Regel, eine Kennzahl oder eine Sicht das Attribut, gehört sein Name in `@sigloch/contracts/se`.
   Kanten tragen keine Attribute; was an einer Kante hinge, steht am FLOW.
10. **Erzeugen und Anzeigen sind getrennt.** Der Analyse-Skill schreibt; die zugehörige Sicht
    (`se-view:…`) rendert deterministisch und autoriert nichts.

### Optimierungs-Skills und Vorschläge

1. **Kein Vorschlag ohne Zweck.** Er nennt die Anforderung, der er dient.
2. **Prognose vor dem Zug:** was besser werden soll und was gleich bleiben muss. Eine Verbesserung, die
   das Gleichbleiben verletzt, zählt nicht.
3. **Probe per Trockenlauf, Gesamt-Impact in allen vier Sichten** (Abschnitt 6b), bevor gewählt wird.
4. **Gewählt wird vom Autor am Gesamt-Impact.** Keine Summe und keine Rangfolge aus Kennzahlen entscheidet.
5. **Kein Auto-Apply.** Der Autor wählt; angewandt wird durchs Gate.
6. **Nachmessung nach dem Zug** gegen die Prognose; das Ergebnis steht im CR.
7. **Eine Entwurfsregel an einer geteilten Funktion steht als Anforderung an ihr im Modell.** Ein Vorschlag,
   der einer bestehenden Funktion einen Ausgang oder eine Aufgabe ergänzt, wird auf der Stufe Invarianten
   gegen jede Anforderung dieser Funktion beurteilt. Das ist zugleich der Ort des Konflikts (Ergebnis d).
   Grenze (Fall 2): eine Regel, die am System oder an einer umgangenen Funktion hängt, findet das nicht.
8. **Der Vergleich zählt keine Befunde aus dem Bau** (fehlende Bindung an Code, Schema ohne Bindung und
   ohne Test, Test ohne Bindung: R-20, R-26, R-32, R-19). Sie wachsen mit der Zahl neuer Elemente und sagen nichts über den Entwurf.

### CRs und Spikes

1. **Ein CR nennt Sicht, Dimension und welches der Ergebnisse a bis d er betrifft.**
2. **Der Schnitt zwischen den Repos:** Rechnung in contracts, Anzeige in graphcode, Beurteilung im Skill.
3. **Ein Spike legt vor der Messung fest:** Regelkandidat, Positivkontrolle, Gegenprobe.
4. **Der Fall muss die Frage tragen.** Vor dem Spike dieselbe Prüfung wie vor jeder Analyse (Verdrahtung
   der Ketten) — und zusätzlich, ob der Stand die Sicht enthält, die gemessen wird (Lehre aus CR-GC-771,
   siehe „Offen im Konzept").
5. **Vergleich ist das Blindurteil**, nicht die Plausibilität des Ergebnisses.
6. **Läufe und Gutachten liegen in graphanalyze**, das Ergebnis steht im CR.

## 8. Stand

| Baustein | Stand 2026-10-12 |
|---|---|
| Kennzahlen der Modul- und der Funktionssicht | vorhanden, ziehen an `graph_suggest` |
| Kennzahlen der Anforderungssicht | erfüllt, geprüft und gebunden vorhanden; Bewertungen aus der FMEA, im graphcode-Modell 19 Risiken (`docs/views/fmea.md`) |
| Kettenkennzahlen als Zahlen | gebaut (CR-SM-404); graphcode 24 von 25 Ketten bewertbar |
| Orte je Kette | gebaut (CR-SM-406, contracts 11.2.0) |
| FMEA liest die Orte | gebaut (CR-GC-774; Skill Version 9 mit Eingangsprüfung, Umfang und Trägern, CR-GC-782) |
| FMEA-Läufe auf den Orten | alle 24 bewertbaren Ketten analysiert (CR-GC-779, CR-GC-795, CR-GC-798, Nachtrag CR-GC-802): 19 Risiken im Modell, zwei Architekturvorschläge (ITEM-2026-879) |
| Bedrohungsanalyse, Budgetanalyse | nicht vorhanden; Budget braucht Zeit- und Mengenangaben im Modell (ITEM-2026-885) |
| Vorschlag aus einer Analyse (6a) | `se-fmea` und `se-laufzeit` liefern ihn in fester Form (CR-GC-782, CR-GC-783) |
| Gesamt-Impact (6b) | der Probelauf von `graph_mutate` liefert die Kennzahlen danach (CR-GC-790); `se:optimize` zeigt sie als Vorlage (CR-GC-785) |
| Nachweis, dass eine Rangfolge aus Kennzahlen Vorschläge richtig ordnet | widerlegt an drei Fällen; die Rangfolge ist gestrichen |
| Betrachtungsumfang, Träger je Risiko | gebaut als Ableitungen in contracts (CR-SM-407, `requirementScope`, `riskCarriers`), veröffentlicht mit contracts 12.6.0; `graph_metrics` reicht sie durch (CR-GC-787) |
| Antwortweg | gebaut (CR-SM-408, contracts 12.6.0); im graphcode-Modell an 7 von 24 Ketten lesbar, Hindernis sind alternative Auslöser am Gate (ITEM-2026-843) |
| Laufzeitanalyse | Skill `se-laufzeit` vorhanden (CR-GC-783), noch an keiner Kette gefahren; das Merkmal ist im graphcode-Modell gesetzt |

**Offen im Konzept:**

- **Entschieden in Abschnitt 10:** die feste Rangfolge ist gestrichen, der Gesamt-Impact ist Vorlage für das
  Urteil; Umfang und Flächen stehen im Leitfaden.
- **Der Umfang mit einem Flussschritt mehr** fasst alle genannten Anforderungen, wächst an einer Drehscheibe
  aber auf rund 80 Prozent. Ob und wann der Schritt dazugehört, ist nicht entschieden.
- **Menge und Takt** fehlen dem Modell. Ohne sie bleibt die Laufzeitanalyse bei der Frage stehen, auf wen die
  Antwort wartet.
- **Entschieden im Review des Hüters (CR-SM-407):** keine Regel für eine Gegenmaßnahme am Modul oder am
  System; das wird ein Hinweis im Skill. Gezählt am Stand vom 2026-10-11 wären es 15 und 2 Befunde über drei
  Modelle gewesen, 14 und 2 davon in sigllm.
- **Eine Lücke der Verdrahtungsregeln.** Am Stand des Spikes zu CR-GC-771 (energymanager, 12 Ketten) meldet
  keine Regel etwas zur Verdrahtung, und alle 12 Ketten sind bewertbar — jede hat die Länge 1. Erfassen und
  Anzeigen hängen dort nur über den gespeicherten Datenbestand zusammen, und der steht nicht im Modell. Der
  Fall „der Speicher fehlt als Glied" (Architekturkonzept, „Voraussetzung") wird so nicht erkannt. Ob eine
  Kette der Länge 1 ein Befund ist, ist nicht entschieden.

- **Zusätzliche Merkmale aus dem Architekturkonzept** (dort Abschnitte „Skalierungsklasse und Volatilität" und
  „Verhältnis zu R⁶"). Der Abgleich mit den Architekturregeln (`docs/project/architekturregeln-abgleich.md`,
  2026-10-12) stuft ihren Mehrwert als gering ein:
  - *Fehlerflüsse und Fehlerpfad-Tiefe:* die Kennzahl ist zur Streichung vorgeschlagen (ITEM-2026-882); die
    Entscheidung, die sie stützen sollte, trifft die FMEA mit den Trägern je Risiko. Verloren ginge die
    Bewertung von Kompensationsketten.
  - *Volatilität und der damit gewichtete Blast-Radius:* Änderungskosten sind die getroffenen Ketten und
    Anforderungen, die `graph_impact` vor jeder Änderung nennt; ein Vorhalt ist eine Anforderung, keine
    Kennzahl.
  - *Iteration:* Kreisläufe findet die Rechnung der Orte aus der Struktur; ein Merkmal am Fluss braucht es
    dafür nicht.
  - *Skalierungsklasse:* im Abgleich nicht beurteilt. Sie ist nicht gebaut, und kein Leser wartet auf sie.
- **Prognose gegen Messung.** Ein Vorschlag trägt eine Prognose, der Probelauf zeigt die Kennzahlen danach;
  niemand vergleicht beides nach dem Umbau (ITEM-2026-886).

## 9. Was daraus folgt

Bewegt werden die Tests der Leitlinie §9: T-O1 (Kettenkennzahlen), T-O2 (Profil auf der Kette mit
treibendem Knoten), T-O3 (Degradationsschutz), T-O7 (inhaltliche Analysen).

| Schritt | Was | Art | Bewegt |
|---|---|---|---|
| 1 | CR-SM-404 schließen (Entscheidungen A bis C) | CR, sigloch-modules | T-O1 |
| 2 | CR-SM-406 Orte je Kette | CR, sigloch-modules | T-O1, T-O2 |
| 3 | CR-GC-774 FMEA liest die Orte, Konventionen im Skill | CR, graphcode | T-O7 |
| 4 | FMEA an einer Kette des graphcode-Modells, Ergebnisse a bis d | Analyse (geschlossener CR) | T-O7 |
| 5 | Spike: ein Vorschlag aus Schritt 4 mit Prognose und Trockenlauf | Spike | T-O3 |
| 6 | Spike: Gesamt-Impact desselben Vorschlags; zugleich Frage 4 aus CR-GC-771 an verbundenen Funktionen | Spike | T-O2, T-O3 |
| 7 | Optimierung bauen (6a, 6b) | CR nach den Spikes | T-O2, T-O3 |
| 8 | Bedrohungsanalyse; Budgetanalyse mit synchroner Tiefe und Zeitangabe | je ein Item | T-O2 |
| 9 | Schluss und Leitfaden im Konzept (Abschnitt 10) | CR-GC-781, geschlossen | T-O2, T-O3 |

**Stand der Schritte (2026-10-12).** Schritte 1 bis 7 und 9 sind erledigt: CR-SM-404, CR-SM-406, CR-GC-774,
die FMEA-Läufe (CR-GC-779, CR-GC-795, CR-GC-798), die Spikes mit ihrem Schluss (CR-GC-781) und die
Optimierung (CR-GC-785, CR-GC-790). Schritt 8 ist offen (ITEM-2026-885).

**Der Plan ab 2026-10-11 ist gefahren** und steht nicht mehr als Tabelle hier; der Stand je CR ergibt sich aus
`docs/cr/done/`. Geschlossen: CR-SM-407, CR-SM-408, CR-GC-782 bis CR-GC-787; veröffentlicht mit contracts 12.6.0
und graphcode 0.31.0. Offen: CR-SM-409 (Verdrahtungsregeln als Fehler statt Warnung, sigloch-modules) und die
sigllm-CRs CR-SL-096 bis CR-SL-098 in ihrer eigenen Sitzung.

## 10. Schluss aus den Spikes und Leitfaden der Optimierung

### Schluss

1. **Die Güte des Modells entscheidet vor jeder Analyse.** Zwei Dinge: die Wirkketten sind geschlossen
   (jedes Glied hat Eingang und Ausgang, die Kette ist bewertbar), und jede Anforderung hängt am richtigen
   Träger auf der tiefsten möglichen Ebene. Von acht geprüften Modellen der Familie waren zwei ohne Fehler
   und voll bewertbar. Ein Modell hing alle Gegenmaßnahmen an Modul oder System; dort war jede Funktion
   sicherheitsrelevant.
2. **Kennzahlen finden Orte und spannen den Umfang.** In allen drei Fällen nannten die Gutachter von sich
   aus Größen, die in den gemessenen Zeilen standen. Der Betrachtungsumfang einer Kette fasste 39 bis 48
   Prozent der Anforderungen und darin 22 von 24, die ein Gutachter als verletzt oder gefährdet nannte.
3. **Kennzahlen ordnen keine Entwürfe.** Gegen das Urteil liefen die Länge der Kette (in jedem Paar, das
   sich unterschied), die Länge des Anfragepfads und die Zahl der Befunde. Die besser beurteilten Entwürfe
   machen einen Schritt ausdrücklich und schneiden sauber; beides zählen diese Größen als Verschlechterung.
4. **Was nie widersprach,** ist die Reichweite (Ketten durch die berührten Funktionen). In der Probe lief eine
   nachgetragene Summe mit (je Träger die Ketten durch ihn); der Hüter des Regelkatalogs hat sie als Feld
   verworfen, weil sie ableitbar ist und einen versteckten Boden hatte. Die Aussage bleibt lesbar: welche
   Risiken an einer Funktion hängen und wie viele Ketten durch sie laufen.
5. **Jede Dimension hat ihr eigenes Maß an der Kette.** Entdeckung über Runden: Glieder im Kreislauf.
   Ladezeit: die Funktionen, auf die die Antwort wartet. Genau ein Endzustand: Schreiber auf denselben
   Zustand. Ein gemeinsames Maß über die Dimensionen gibt es nicht.

### Leitfaden

Drei Schritte, in dieser Reihenfolge. Ein späterer beginnt erst, wenn der frühere nichts mehr meldet oder das
Offene benannt ist.

**Lage in der Regelmatrix** (Stufen 1 bis 12, Marken SRR nach 4, PDR nach 7, CDR nach 8, TRR nach 9):

| Schritt | Lage | Begründung |
|---|---|---|
| Basis optimieren | Abschluss von Stufe 7 (Modul), an der Marke PDR | braucht Funktionen, Flüsse und Module; die Wahl „Funktion oder Modul als Träger" gibt es erst mit dem Modul |
| Kettenanalysen (FMEA, Laufzeit) | Stufe 8 | dort liegt die FMEA heute |
| Umbau der Kette | nach CDR, vor den Kettentests auf Stufe 9 | nach der Bindung auf Stufe 11 bewegt jeder Umbau Code |

Die Matrix bleibt dafür unverändert. Die Regeln zur Verdrahtung liegen schon auf den Stufen 5 und 6; neu ist
nur, dass sie am Ende von Stufe 7 zusammen als Eingang für Stufe 8 gelesen werden. Heute halten zwei der fünf
die Marke PDR. Ob alle sie halten und ob eine unvollständige Kette später ein Fehler wird, entscheidet
CR-SM-409 an einer Zählung über die Familie.

**Eine Analyse ist eine Schleife.** Sie erzeugt Anforderungen, Funktionen und Flüsse, und ihr Ergebnis ist ein
gewöhnlicher CR. Die neuen Elemente durchlaufen die Stufen wie jede Änderung; eine Regel wird fällig, sobald
ihre Menge nicht leer ist. Deshalb braucht es keine Sonderregel dafür, dass Gegenmaßnahmen erst in der FMEA
entstehen: der CR der Analyse ordnet sie zu, die Matrix meldet, was fehlt. Dasselbe gilt für einen Umbau.

**Basis optimieren (Skill `se-vorbereitung`, Version 2, CR-GC-784).** Das ist Hygiene, keine Analyse.

| Prüfpunkt | Maß | Handlung |
|---|---|---|
| Ketten geschlossen | Bewertbarkeitsquote, Befunde der Verdrahtung | Flüsse und Glieder schließen; vorher keine Analyse |
| Funktionale Anforderung an der Funktion, nicht-funktionale an Kette, Modul oder System | Grammatik (am Gate ein Fehler) | – |
| Gegenmaßnahme am tiefsten Träger | Träger je Risiko, Ziel 1 | Tieferlegen: als funktionale Anforderung fassen und der einen Funktion zuordnen |
| Gegenmaßnahme mit zwei Aussagen | – | Zerlegen |
| Gegenmaßnahme ohne passende Funktion | – | fehlende Funktion anlegen; das ist ein Befund am Funktionsbaum |
| Gegenmaßnahme, die quer gilt | Sockel: Gegenmaßnahmen am System | am System lassen; der Ort dort ist die Kennzeichnung, ein Attribut gibt es nicht |
| Risiko ohne Träger | meldet die Matrix schon (FM-02, RD-01) | Gegenmaßnahme und Träger anlegen |

**Sicherheit und Verfügbarkeit (Skill `se-fmea`).**

| Maß | Bedeutung | Besser ist |
|---|---|---|
| Sicherheitsrelevante Fläche ohne Sockel | Funktionen, die mindestens ein Risiko tragen | kleiner |
| Träger je Risiko | wie scharf ein Risiko zugeordnet ist | 1 |
| Risiken an einer Funktion, mit den Ketten durch sie | wie viel an einer Funktion hängt, der man etwas auflädt | zu beurteilen, kein Zielwert |
| Glieder im Kreislauf, geteilte Glieder | Orte aus `chainMetrics` | zu beurteilen, kein Zielwert |

Handlungen: Tieferlegen; einer geteilten Funktion kein weiteres Risiko aufladen; Entdeckung außerhalb des
Kreislaufs; ein Besitzer je Zustand.

**Laufzeit (Skill `se-laufzeit`, CR-GC-783).** Voraussetzung: an jedem Fluss der Kette
steht, ob die Antwort auf ihn wartet (synchron) oder ob er vorab geliefert ist (asynchron).

| Maß | Bedeutung | Besser ist |
|---|---|---|
| Antwortweg | Glieder der Kette, auf die die Antwort an den Akteur wartet; er verlässt die Kette nicht. Wartet ein Glied synchron auf eine Funktion außerhalb, ist die Kette nicht vollständig | weniger, und mit weniger Ketten durch sie |
| Zulieferer außerhalb des Antwortwegs | Seite Datenalter | zu beurteilen gegen die Anforderung an das Alter |
| Zulauf und Verzweigung | wo auf mehrere gewartet wird | zu beurteilen |

Handlungen: vorhalten statt beim Aufruf rechnen, mit eigenem Fluss für die Speisung (derselbe Inhalt einmal
abgerufen und einmal vorab geliefert sind zwei Flüsse); eine geteilte Funktion vom Antwortweg nehmen. Jeder
Vorschlag nennt seinen Preis: Datenalter und die Schnittstelle der Funktion, die speist. Nicht messbar bleibt,
ob der Aufwand einer Funktion mit dem Bestand wächst, und der Takt der Zulieferer.

### Skills

Die Vorbereitung des Modells ist ein eigener Skill und nicht Teil einer Analyse (Entscheidung des Autors,
2026-10-11). Eigen je Analyse ist der Vorschlag, allgemein ist der Umgang mit ihm.

| Skill | Schritt | Tut | Tut nicht |
|---|---|---|---|
| `se-vorbereitung` (neu, CR-GC-784) | Basis optimieren | führt durch den Schritt: prüft Ketten, Zuordnung und Merkmal der Flüsse und schlägt je Lücke den Zug vor | baut nicht selbst um; die Züge sind ein gewöhnlicher CR. Beurteilt kein Risiko und keine Laufzeit |
| `se-fmea` Version 9 (CR-GC-782) | Kettenanalyse | prüft den Eingang, bewertet Risiken an den Orten, nennt Umfang und Träger; endet mit einem CR, der neue Gegenmaßnahmen der tragenden Funktion zuordnet | räumt keinen Altbestand auf, wendet keinen Umbau an |
| `se-laufzeit` (neu, CR-GC-783) | Kettenanalyse | prüft den Eingang, liest den Antwortweg, liefert Vorschläge mit Preis; endet mit einem CR | setzt kein Merkmal, schätzt keine Zeit |
| `se:optimize` (seit CR-GC-785, heute Version 5) | Umbau | probt einen Vorschlag und zeigt den Gesamt-Impact als Vorlage | bildet keine Rangfolge, mischt die Quellen nicht; Anwenden und Nachmessen gehören dem CR |

Ein Vorschlag hat immer dieselbe Form: Zweck, Kette, Ort, Handlungsklasse, Prognose (was besser wird, was gleich
bleibt), Preis.

### Belege

| Spike | Ablage in graphanalyze `docs/messung/` | Ergebnis |
|---|---|---|
| Gesamt-Impact, Fall 1 (graphcode) | `gesamt-impact-2026-10-10/` | Rangfolge gegen Analyse und Blindurteil; nach Ergänzung in Kenntnis des Ergebnisses gleich |
| Gesamt-Impact, Fall 2 (energymanager) | `gesamt-impact-fall2-2026-10-10/` | Rangfolge gegen das Blindurteil |
| Gesamt-Impact, Fall 3 (sigllm) | `gesamt-impact-fall3-2026-10-10/` | fremd verfasste Entwürfe, Gutachter mit allen Anforderungen |
| Kennzahlen der drei Fälle | `gesamt-impact-gegenueberstellung-2026-10-10.md` | Paare: stimmt, widerspricht, gleich |
| Umfang und Flächen | `flaechen-2026-10-11/` | Umfang trägt; Fläche trennt Modelle, kaum Entwürfe |
| Tieferlegen in sigllm | `flaechen-2026-10-11/`, Teil Tieferlegen | 11 von 18 Gegenmaßnahmen; Risiken mit einem Träger 2 auf 11 von 16 |
| Fluss trennen im energymanager | `flaechen-2026-10-11/`, Teil Fluss trennen | fünf Ketten besser, keine schlechter; die heutigen Kennzahlen sehen es nicht |

**Grenzen.** Neun Entwürfe, neun Paare, je ein Gutachter. In zwei Fällen stammen die Entwürfe vom Verfasser
der Messung. Die Zuordnung beim Tieferlegen ist am Modelltext getroffen, nicht
am Code. Alle Flächenmaße sind im Skript gerechnet und nicht in der gemeinsamen Rechnung.

