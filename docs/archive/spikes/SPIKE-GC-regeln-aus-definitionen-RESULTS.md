# Spike: Regelvorschläge aus den Begriffsdefinitionen am graphcode-Modell

**Datum:** 2026-11-11 · **Modell:** `docs/graph/graphcode.graph.json` (Stand 419a759b, 198 REQ,
120 funktional, 78 nicht-funktional) · **Regelkatalog:** `@sigloch/contracts/se` 11.1.0 ·
**Änderungen am Modell oder Katalog:** keine.

**Frage:** Welche Regeln folgen aus den Definitionen im Artefakt „Das Systemmodell in Bildern",
Abschnitt 6, und lohnen sie sich am realen Modell? Die Regeln für gute Anforderungen im Katalog
(BQ-01, -02, -04, -06, -07, angelehnt an die INCOSE-Merkmale eindeutig, prüfbar, notwendig,
konform, vollständig) sind mitgeprüft.

**Methode:** Offizieller Regellauf (`evaluateAllRules`) als Ausgangswert, dazu je Kandidat eine
Lesemessung (`SPIKE-GC-regeln-aus-definitionen.py <graph.json> <out.json>`). Die Textkandidaten
sind Wortmuster. Ihre Trefferquote ist an Stichproben geschätzt, nicht gezählt.

## Ergebnis

Fünf Kandidaten deckt der Katalog bereits, alle ohne Befund. Neu und lohnend sind zwei Regeln
und zwei Kalibrierungen bestehender Regeln. Die Textform des Satzmusters taugt nicht als Regel.

## Priorisierte Liste

| Rang | Vorschlag | Art | Treffer | Trefferquote | Bezug |
|---|---|---|---|---|---|
| 1 | Begründung getrennt vom Anforderungstext | neu, Grund in BQ-07 | 64 / 198 REQ | hoch | INCOSE: Rationale als eigenes Attribut |
| 2 | BQ-02 nur für Güte-Anforderungen | Kalibrierung | 94 Fehlalarme weg, 66 / 78 bleiben | hoch | Definition Anforderung: Verhalten oder Güte |
| 3 | Akteur ist eine Rolle, kein Bauteil | neu | 1 / 3 ACTOR | hoch | IREB, SysML, Arcadia: Akteur liegt außerhalb |
| 4 | BQ-06 Modalverb ersetzen oder streichen | Entscheidung | 165 / 198 REQ | Regel trennt nicht | INCOSE „shall", deutscher Stil indikativ |
| 5 | Eine Aussage je Anforderung | neu, Grund in BQ-07 | 6 / 198 REQ | hoch | INCOSE: singulär |
| 6 | Was, nicht Wie | neu, braucht Vorarbeit | 30 / 198 REQ | etwa 40 % | Regel „nur was an der Grenze sichtbar ist" |
| 7 | Format nennt keinen Träger | Prüfhinweis | 1 echter von 5 | niedrig | Format, Träger und Verfeinerung |
| 8 | Test nennt das erwartete Ergebnis | zurückgestellt | 103 / 177 TEST | niedrig | IEEE 1012: Eingabe, Bedingung, Erwartung |

### 1 · Begründung getrennt vom Anforderungstext

64 Anforderungen tragen CR-Nummern, Messdaten oder Vorgeschichte im Text, etwa „Gemessen
2026-09-02 … 243,8 ms bei 500 Knoten". Das Attribut `rationale` existiert und steht an 20
Elementen. Der Befund ist ein Wortmuster mit wenig Fehlalarm. Als dritter Grund in BQ-07 kostet er
keine neue Regel-ID. Der Text wird kürzer, die Prüfbarkeit klarer.

### 2 · BQ-02 nur für Güte-Anforderungen

BQ-02 verlangt eine Zahl mit Einheit an jeder Anforderung. An funktionalen Anforderungen schlägt
sie 94 von 120 Mal an. Deren Prüfgröße ist das Ergebnis, nicht eine Zahl. Bei Güte-Anforderungen
treffen die 66 von 78 Befunde genau den Fall „das Fach öffnet schnell". Die Einschränkung auf
`kinds: non-functional` macht aus Lärm ein Signal.

### 3 · Akteur ist eine Rolle, kein Bauteil

`ACTOR-dashboard` („Browser-Dashboard") und `MOD-dashboard` („Live-Viewer-App") stehen beide im
Modell. Der Viewer ist damit zugleich außen und innen. Das ist der Einwand aus dem
Expertengespräch, am eigenen Modell bestätigt. Prüfung: Ein Akteur darf keinem Modul unter dem
System gleichen, weder im Kennzeichen noch im Namen. Die Prüfung ist deterministisch und billig.
Der Modellbefund selbst ist vor der Regel zu klären.

### 4 · BQ-06 Modalverb ersetzen oder streichen

165 von 198 Anforderungen haben kein „muss", „soll" oder „shall". Die deutschen Texte sind
indikativ geschrieben („Das Gate urteilt und speichert"). Eine Regel, die an 83 % anschlägt,
trennt nichts. Zwei Wege: Modalverb im Modell nachziehen, oder BQ-06 streichen. Das Satzmuster ist
kein Ersatz, siehe unten.

### 5 · Eine Aussage je Anforderung

6 Anforderungen tragen mehr als ein Modalverb, etwa `REQ-chain-metrics` mit zwei „MUSS" für zwei
Zusagen. Die alte Kopfzeile von `quality-rules.ts` nennt Atomarität noch, eine Regel dafür gibt es
nicht mehr. Wenig Treffer, alle echt.

### 6 · Was, nicht Wie

30 Anforderungen nennen Dateien, Code-Bezeichner oder Techniken. Etwa 12 davon sind ein echtes Wie
(`src/readiness.ts`, `pruneToFit(`, `registerHook(`). Rund 10 nennen etwas, das an der Grenze
sichtbar ist (`GRAPHCODE.md`, `mcp.json`, der npx-Befehl). 7 sind gewollte Festlegungen wie „ein
Store = Kuzu". Nach ISO/IEC/IEEE 29148 darf ein Constraint die Lösung nennen. Das Modell
unterscheidet Constraint und Anforderung aber nicht, das Attribut `constraint` gibt es nur am TEST.
Vorarbeit: eine Constraint-Kennung am REQ. Die Kennung ist eine Ontologie-Änderung mit
Versionssprung. Ohne sie ist die Regel zu 60 % Lärm.

### 7 · Format nennt keinen Träger

Nur `SCHEMA-update-event` mischt Inhalt und Träger („SSE invalidate Event"). Die anderen vier
Treffer sind das Wort „über" in anderer Bedeutung. Als Hinweis in einer Prüfanleitung genug,
keine Regel.

### 8 · Test nennt das erwartete Ergebnis

Das Wortmuster findet die Erwartung in Prosa schlecht. Die bindenden Tests tragen ihre Erwartung
im Code (`testRefs`). Zurückgestellt, bis ein Fall ohne Code-Bindung auffällt.

## Bereits im Katalog, ohne Befund

| Vorschlag aus den Definitionen | Abgedeckt durch | Befunde |
|---|---|---|
| Güte nie an einer Funktion | R-18, `kinds` am satisfy-Muster | 0 |
| Ein Fluss hat genau ein Format | Kardinalität FLOW→SCHEMA | 0 (237 / 237) |
| Wirkkette läuft vom Auslöser zum Ergebnis | FC-04 | 0 |
| Funktion wandelt Eingang in Ausgang | R-31 | 0 |
| Anwendungsfall hat einen Akteur | UC-02, Messung über die Ketten | 0 |
| Satzmuster, strukturell: Auslöser und Ergebnis sind Flüsse an der erfüllenden Funktion | RD-01 mit R-31 | 5, alle schon als RD-01 gemeldet |

## Satzmuster als Textregel: verworfen

60 von 120 funktionalen Anforderungen nennen keinen Auslöser („wenn", „sobald", „bei"). Viele davon
sind Invarianten ohne Auslöser, etwa „Das Gate urteilt und speichert". Nur 3 Anforderungen nennen
eine Bedingung. Die strukturelle Hälfte des Musters prüft der Katalog bereits. Das Satzmuster
bleibt Empfehlung im Artefakt.

## Nebenbefund am Artefakt

Das Bild „Blackbox und Whitebox" im Artefakt hängt die Güte-Anforderung „Antwort ≤ 200 ms" an die
Funktion „Code prüfen". Das verbietet R-18: Eine Funktion erfüllt nur funktionale Anforderungen.
Die offene Frage aus der Einschätzung des Expertengesprächs ist damit entschieden, das Beispiel
ist falsch. Träger der Güte ist die Wirkkette oder das Modul.

## Nächste Schritte

Rang 1, 2, 4 und 5 sind Katalogänderungen in contracts: Review und Versionssprung. Rang 3 braucht
zuerst die Modellklärung des Dashboards. Rang 6 braucht die Constraint-Kennung als
Ontologie-Änderung.
