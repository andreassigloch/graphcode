# Analyse- und Optimierungskonzept

10. Okt. 2026 · @Andreas Sigloch · Fassung 1 (Entwurf zum Review)

**Bezug:** Leitlinie §5 „Optimieren" (`docs/graphcode_leitlinie.md`) ist der Anker. Die Kennzahlen der
Wirkkette, die Handlungsklassen und das Gegengewicht Blast-Radius definiert
`docs/graphcode_architektur_konzept.md`; dieses Dokument wiederholt sie nicht, es sagt, **wofür sie
gelesen werden, von wem und in welcher Form das Ergebnis ins Modell geht**.

## Kernaussage

Jede Zieldimension einer Architektur (Sicherheit, Laufzeit, Informationssicherheit, …) hängt als
Anforderung an einer Wirkkette. Kennzahlen nennen die Orte der Kette, an denen sich diese Dimension
entscheidet. Ein Analyse-Skill je Dimension beurteilt die Orte und liefert Befunde, fehlende
Anforderungen, Umbauvorschläge und Konflikte. Die Optimierung wählt unter den Vorschlägen nach ihrer
Wirkung auf alle Ebenen.

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
| Gesamt-Impact | die Wirkung eines Vorschlags auf alle Ebenen, Ketten und Zwecke |

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

## 3. Vier Ebenen

Die Zieldimensionen wirken auf verschiedenen Ebenen. Jede Ebene hat ihre Kennzahlen, und alle ziehen an
denselben Vorschlägen.

| Ebene | Gegenstand | Kennzahlen heute | Rolle |
|---|---|---|---|
| Knoten | einzelne Funktion, Anforderung | Reichweite (Ketten, Anwendungsfälle), Zusammenhalt der Whitebox (MT-04), Bindung an Code und Test | Ort und Träger der Bewertung |
| Abstraktion | Ebenen und Schnitte beider Bäume (Modul, Funktion) | Breite je Ebene (RD-04, RD-05), Zusammenhalt (MT-02), Schnittstellenbreite und Kreuzungen (BW-02, R-04, CR-01), Instabilität | Modellgüte, zweckneutral, mit Schwelle |
| Wirkkette | Kundenfunktion von Auslöser bis Ergebnis | Kettenkennzahlen und ihre Orte | Zweck je Kette, beurteilt durch die Analysen |
| Gesamtprojekt | alle Ketten und Module zusammen | Bewertbarkeitsquote, Bindungsquote, Marken, Blast-Radius, Kreuzungspunkte | Vorbedingung und Gegengewicht |

Der Steuerwert von `graph_suggest` liest heute nur Regeln der Abstraktionsebene. Ein Vorschlag ohne
die Ebene der Wirkkette kennt keinen Zweck (Beleg: Spike zu CR-GC-771, 2026-10-10 — an zwölf
unverbundenen Funktionen gewann ein bewusst unsinniger Modulschnitt, weil er das Größenband traf).

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
| c | Vorschlag zur Architektur der Kette (Länge, Abhängigkeiten, Verortung) | Vorschlag in einer Handlungsklasse; angewandt wird er erst in der Optimierung |
| d | Konflikt an einem Kreuzungspunkt | an der geteilten Funktion, nicht in einer der Ketten |

Zu d: an einer geteilten Funktion treffen sich Ketten mit verschiedenen Zwecken. Dieselbe Änderung
hilft der einen und schadet der anderen; dieselbe Kennzahl hat je Zweck ein anderes Vorzeichen.
Optimiert wird deshalb gegen einen benannten Zweck je Kette, nie gegen die Kennzahl.

## 6. Optimierung

Zwei Teile, in dieser Reihenfolge:

**(a) Vorschläge in einer Analysedimension.** Ein Vorschlag stammt aus Ergebnis c einer Analyse und
nennt Zweck, Kette, Ort und Handlungsklasse (Entkoppeln, Zusammenlegen, Verschieben, Aufteilen,
Vorverlagern — Architekturkonzept, „Handlungsklassen").

**(b) Gesamt-Impact.** Der Vorschlag wird per Trockenlauf geprobt und auf allen Ebenen nachgemessen:

1. Knoten: bleibt jede Anforderung erfüllt und geprüft?
2. Wirkkette: wie ändern sich die Orte **aller** Ketten, die durch die berührten Funktionen laufen — und
   was sagen deren Zwecke dazu?
3. Abstraktion: halten die Schwellen der Modellgüte?
4. Gesamtprojekt: wie ändert sich der Blast-Radius?

Die Reihenfolge der Abwägung ist die feste Rangfolge des Architekturkonzepts („Gegengewicht
Blast-Radius"): Invarianten, Zwecke der Ketten, Modellgüte in ihren Schwellen, Blast-Radius. Keine
Gewichte zwischen den Stufen.

## 7. Konventionen

### Analyse-Skills

1. **Einheit ist eine Wirkkette.** Ohne benannte Kette fragt der Skill; ein Modul oder das System als
   Umfang wird auf seine Ketten aufgelöst.
2. **Vorbedingung:** die Kette ist bewertbar (`measurable: true`). Sonst nennt der Skill den Grund und
   analysiert nicht.
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
3. **Probe per Trockenlauf, Gesamt-Impact auf allen vier Ebenen** (Abschnitt 6b), bevor gewählt wird.
4. **Gewählt wird nach der festen Rangfolge**, nicht nach einer Summe.
5. **Kein Auto-Apply.** Der Autor wählt; angewandt wird durchs Gate.
6. **Nachmessung nach dem Zug** gegen die Prognose; das Ergebnis steht im CR.

### CRs und Spikes

1. **Ein CR nennt Ebene, Dimension und welches der Ergebnisse a bis d er betrifft.**
2. **Der Schnitt zwischen den Repos:** Rechnung in contracts, Anzeige in graphcode, Beurteilung im Skill.
3. **Ein Spike legt vor der Messung fest:** Regelkandidat, Positivkontrolle, Gegenprobe.
4. **Der Fall muss die Frage tragen.** Vor dem Spike prüfen, ob der Stand die Ebene enthält, die gemessen
   wird (Lehre aus CR-GC-771: unverbundene Funktionen tragen keine Frage an einen Modulschnitt).
5. **Vergleich ist das Blindurteil**, nicht die Plausibilität des Ergebnisses.
6. **Läufe und Gutachten liegen in graphanalyze**, das Ergebnis steht im CR.

## 8. Stand

| Baustein | Stand 2026-10-10 |
|---|---|
| Kennzahlen Knoten und Abstraktion | vorhanden, ziehen an `graph_suggest` |
| Kettenkennzahlen als Zahlen | gebaut (CR-SM-404), nicht veröffentlicht; graphcode 24 von 25 Ketten bewertbar |
| Orte je Kette | offen (CR-SM-406) |
| FMEA liest die Orte | offen (CR-GC-774); heute rechnet der Skill ein eigenes Profil |
| Bedrohungsanalyse, Budgetanalyse | nicht vorhanden; Budget braucht Zeit- und Mengenangaben im Modell |
| Vorschlag aus einer Analyse (6a) | nicht vorhanden |
| Gesamt-Impact (6b) | nicht vorhanden; Blast-Radius nur vorwärts |
| Nachweis, dass Vorschläge aus diesem Rahmen besser sind als ein Blindurteil | nicht gemessen |

**Offen im Konzept:** wo ein Konflikt (Ergebnis d) im Modell steht — als Anforderung an der geteilten
Funktion oder nur im Text des CR.

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
