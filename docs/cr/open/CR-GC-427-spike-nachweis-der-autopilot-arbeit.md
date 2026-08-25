# CR-GC-427 — Spike: Nachweis der Autopilot-Arbeit aus der echten History

**Status:** open · **Ergebnis: GO — eine Kennzahl, eine Darstellung (2026-08-25)** ·
**Angelegt:** 2026-08-25 · **Typ:** Spike (Timebox 1 Session)
**Frage:** Lässt sich aus dem vorhandenen Bestand ein **Nachweis** rechnen, den ein Dritter
akzeptiert — „der Autopilot hat gearbeitet, und die Arbeit hat gewirkt" — und in welcher
Darstellung ist er auf einen Blick lesbar?

## Herkunft — was die zwei Vorgänger-Spikes gelehrt haben

- **CR-GC-407 (No-Go):** der skalare Zeuge `w·m(G)` ist blind — Totzone 100 %, weil der
  ℝ⁶-Vektor nur layer `arch` misst und die reale Steering-Arbeit (verify/satisfy) ihn nicht
  bewegt. **Was funktionierte:** das Zustands-Archiv (Export-Hash) — Zyklus erkannt, null
  Fehlalarme.
- **CR-GC-408 (No-Go):** der Ebenen-Konformanz-Score trennt nicht, weil die Grundgesamtheit
  fehlt (5 von 6 Graphen ohne Blockebene) und die Rework-Korrelation zirkulär ist.
- **Gemeinsame Lehre:** beide sind an einer **erfundenen Kennzahl** gescheitert, nicht an der
  Idee. Dieser Spike dreht die Reihenfolge um: erst messen, was der Bestand hergibt, dann
  eine Aussage formulieren.

## Datenlage — erhoben 2026-08-25, nicht geschätzt

| Quelle | Inhalt | Eignung |
|---|---|---|
| `.graphcode/trajectory.jsonl` | 286 Zeilen, 206 applied mutates, Autor/opCounts/graphVersion | Aktivität ✓ |
| dieselbe, Feld `violations` | **Delta der Mutation, NICHT Gesamtstand** (v206 zeigt 1 W, Graph hat 29) | Burndown ✗ |
| `git log docs/graph/graphcode.graph.json` | **73 Stände**, 2026-07-26 … 2026-08-25, je mit `graphVersion` + Elementzahl | Zustandsverlauf ✓ |

Der Zustandsverlauf ist also **rekonstruierbar, aber nicht gestempelt** — er muss aus der
Git-History gerechnet werden.

## Die drei Fragen, die ein Betrachter stellt

1. **Hat er gearbeitet?** — beantwortet (Scoreboard, CR-GVE-257: 206 Mutationen, 2 418
   Einzelschritte, 100 % Agent-Autorschaft). Nicht Gegenstand dieses Spikes.
2. **Hat die Arbeit gewirkt?** — offen. Kandidat: der Graph **wächst und bleibt sauber**.
   Das ist der Nachweis, der sich nicht durch Löschen fälschen lässt.
3. **War es Fortschritt oder Kreisverkehr?** — Kandidat steht bereits: das Hash-Archiv aus
   CR-GC-407, der einzige bewährte Baustein.

## Messung (read-only, kein Produktionscode)

Ein Skript rechnet über die 73 historischen Stände:

1. **Zeitreihe je Stand:** Elementzahl, Trace-Zahl, `graphVersion`, Violations nach Severity.
   **Zwingend mit den HEUTIGEN Regeln** über alle Stände — die Regel-Population ist über
   ONTOLOGY/RULES_VERSION-Bumps gewachsen; mit den jeweils damaligen Regeln zu messen, hieße
   Regeländerungen als Fortschritt zu zählen (die Zirkularitätsfalle aus CR-GC-408).
2. **Kandidaten-Kennzahlen**, je mit Trennschärfe-Prüfung:
   - **Violations pro Element** über die Zeit (Qualität bei Wachstum)
   - **Error-Freiheit als Zeitreihe** (die Delta-Gate-Zusage: war `error` je > 0?)
   - **Halbwertszeit einer Violation** — wie lange lebt ein Verstoß vom ersten Auftreten bis
     zum Schließen? Aus der Zeitreihe je ruleId/elementId ableitbar.
   - **Wachstum ohne Fehlerwachstum**: Elemente vs. Violations als Pfad (Scatter mit
     Zeitrichtung — die Progress-Scatter-Idee, aber mit belastbaren Achsen).
3. **Gegenprobe Kreisverkehr:** Export-Hash je Stand — gab es Wiederbesuche in der realen
   History? (407 hat den Detektor validiert, nie am Bestand laufen lassen.)

## Kill-Kriterien — die ehrliche Hälfte

**No-Go** (= es gibt keinen Nachweis, den wir zeigen können), wenn:

- **Rauschen:** Violations pro Element schwankt ohne erkennbaren Trend, oder der Trend kippt
  bei kleiner Änderung des Messfensters.
- **Durch Löschen erklärbar:** der Rückgang der Violations fällt mit sinkender Elementzahl
  zusammen — dann ist es Aufräumen, nicht Verbesserung. Muss explizit geprüft und beziffert
  werden.
- **Regel-Artefakt:** der sichtbare Fortschritt entsteht überwiegend dort, wo Regeln
  hinzukamen oder wegfielen. Zu prüfen, indem die Zeitreihe auf die zum Startzeitpunkt
  vorhandene Regelmenge eingeschränkt wird.
- **Nicht rekonstruierbar:** die historischen Stände lassen sich mit den heutigen Regeln nicht
  auswerten (Schema-Drift der Exportform). Dann wird das als „nicht messbar" berichtet, und
  die Konsequenz ist ein Stempel-CR, kein geschätzter Verlauf.

## Ausdrücklich nicht

- Kein neuer Stempel, kein Produktionscode, keine Änderung an Regeln/Readiness/Steering.
- Keine 7. Metrik-Dimension, kein neuer Score, der „Reife" behauptet.
- Keine Aussage über eingesparte Zeit oder Kosten — dafür fehlt die Vergleichsgruppe
  (dieselbe Lehre wie CR-GC-408: ohne Kontrafaktisches kein Effizienz-Beweis).

## Akzeptanzkriterien

- [ ] Zeitreihe über alle auswertbaren der 73 Stände liegt vor; nicht auswertbare Stände sind
      **gezählt und benannt**, nicht stillschweigend übersprungen.
- [ ] Je Kandidaten-Kennzahl: Verlauf + ob sie die Kill-Kriterien besteht.
- [ ] Löschen-Gegenprobe beziffert (Elementzahl-Verlauf neben Violation-Verlauf).
- [ ] Regel-Artefakt-Gegenprobe gerechnet (eingeschränkte Regelmenge).
- [ ] Hash-Wiederbesuche in der realen History: Zahl genannt (auch wenn 0).
- [ ] **Empfehlung:** welche **eine** Kennzahl und welche **eine** Darstellung den Nachweis
      tragen — oder begründetes No-Go mit der Zahl.
- [ ] Diff berührt nur `scripts/` und diesen CR.

## Dateien (≤ 2)

1. `scripts/spike-nachweis-history.mjs`
2. dieser CR (Ergebnis-Nachtrag)

---

## Ergebnis (2026-08-25) — **GO**

**Die Zahl: 0,954 → 0,039 Violations pro Element bei +86 % Elementen** (369 → 688) und
+148 % Traces (751 → 1 862), über 73 Stände vom 2026-07-26 bis 2026-08-25, alle mit
**derselben** heutigen Regelmenge ausgewertet. Der Graph ist fast doppelt so groß geworden
und trägt dabei ein Fünfundzwanzigstel der relativen Regelverstöße. Kein Kill-Kriterium feuert.

### Messaufbau — was genau gerechnet wurde

`node scripts/spike-nachweis-history.mjs --core <pinned-install> --json <pfad>` liest jeden
Stand aus `git show <sha>:docs/graph/graphcode.graph.json`, hebt ihn über **denselben**
`elementToNode`-Mapper wie `scripts/export-graph.mjs` in einen Graph und wertet ihn mit
**demselben** `createSeDescriptor(metricPolicy)` + `DefaultRuleEngine` aus, den
`GraphCodeHarness.runRules()` fährt. Kein zweiter Messpfad, keine nachgebaute Regelauswertung.

**Regel-Build ist keine Nebensache.** Das Repo lief zur Messung auf verlinkten Arbeitskopien
(`link:siblings`): `@sigloch/contracts` **9.0.0** statt der in `package.json` gepinnten
`^6.0.0`. Die 9.0.0 entfernt `ACTOR -io-> UC` (CR-SM-266 D1, breaking) — der SSOT hat diese
Migration nicht, also meldet sie **111 R-18-Errors auf dem HEAD-Stand**, die das Produkt nicht
meldet. Gemessen wurde deshalb mit dem Build, den das Produkt fährt (**core 5.2.1 /
contracts 6.3.0**, separater Install); der verlinkte Baum ist die Sensitivitätsprobe.
Beide Läufe kommen zum selben Urteil (s. u.).

**Nicht ausgewertet und benannt statt still auf 0 gebucht:** die RC-Konformanzregeln
(`evaluation.ts`, Quelle `conformance`) — die brauchen den Quellbaum des jeweiligen Commits.
Gemessen ist die Graph-Regelfläche, nicht der Code-Abgleich.

**Auswertbare Stände: 73 von 73. Nicht auswertbar: 0.** Kill-Kriterium „nicht rekonstruierbar"
feuert nicht — Schema-Drift der Exportform gibt es über den ganzen Zeitraum nicht.

### Zeitreihe in Kurzform

| Stand | Datum | Elem | Traces | error | warn | info | ges | V/Elem |
|---|---|---|---|---|---|---|---|---|
| #0 | 2026-07-26 | 369 | 751 | 134 | 167 | 51 | 352 | 0,954 |
| #18 | 2026-08-08 | 453 | 956 | 174 | 117 | 109 | 400 | 0,883 |
| #46 | 2026-08-21 | 620 | 1 367 | 148 | 149 | 102 | 399 | 0,644 |
| #47 | 2026-08-21 | 622 | 1 383 | **24** | 138 | 102 | 264 | 0,424 |
| #49 | 2026-08-22 | 639 | 1 670 | **0** | 56 | 6 | 62 | 0,097 |
| #60 | 2026-08-25 | 667 | 1 810 | 0 | 37 | 4 | 41 | 0,061 |
| #72 | 2026-08-25 | 688 | 1 862 | 0 | 23 | 4 | 27 | 0,039 |

Drei Wendepunkte, alle inhaltlich benennbar:

- **#47 (CR-GC-389 „Modell-Löcher geschlossen")** — CR-R02 (`CR status=done braucht commitRef`,
  error) 123 → 0. −135 Violations in einem Stand.
- **#49 („Milestones geschlossen, CR-Liste als Rollup")** — MS-03 (`CR ohne Milestone`) 96 → 0
  über **+160 neue Traces**. Erster error-freier Stand.
- **#60 (CR-GC-409 Warnings-Abbau)** — R-02/R-30/R-31 zusammen −34, Warnings 77 → 37.

### Je Kandidaten-Kennzahl: Urteil

| Kennzahl | Verlauf | Urteil |
|---|---|---|
| **Violations / Element** | 0,954 → 0,039 (−95,9 %); Steigung in **allen acht** geprüften Messfenstern negativ (−6,2e-3 … −2,4e-2), kein Vorzeichenwechsel | **Trägt.** Einzige Kennzahl, die Wachstum und Qualität in einer Zahl hält und über die ganze Strecke Auflösung hat. |
| **Error-Freiheit** | 50/73 Stände mit error > 0; Kipppunkt #49 (2026-08-22); danach 23/24 error-frei, ein Ausreißer (#56, error=1) | **Trägt nur als Meilenstein.** Nach dem Kipppunkt konstant 0 — trennt Fortschritt danach nicht mehr von Stillstand. Gute Fußnote, schlechte Kurve. |
| **Lebensdauer einer Violation** | 678 geschlossene Episoden, Median 29 Stände / 14 Tage; Zensur 3,8 % | **Trägt nicht als Nachweis.** **50,7 % der Episoden sind links-trunkiert** (schon im ersten Stand da, wahres Alter unbekannt) — die Zahl ist für die Hälfte der Fälle eine Untergrenze. Untrunkiert (n=334): Median 15 Stände / 6 Tage. Zeitauflösung ist der Commit-**Tag**; 12 % der Episoden haben Lebensdauer „0 Tage". Als Nebenaussage brauchbar, als Hauptzahl nicht ehrlich. |
| **Wachstum vs. Violations als Pfad** | r(Elemente, Violations) = −0,696; r(Elemente, V/Elem) = **−0,884**; Schritte: 34 wächst&sauberer · 26 wächst&mehr · 2 schrumpft&weniger · 0 schrumpft&mehr | **Trägt als DARSTELLUNG, nicht als Kennzahl.** Ist keine Zahl, sondern die Form, in der die Kennzahl oben lesbar wird. |

### Die drei Gegenproben

**1 — Löschen (der scharfe Test).** Über 72 Schritte: **340 Elemente hinzugefügt, 21 gelöscht**
(netto +319); nur **2 von 72** Schritten haben eine sinkende Elementzahl. Auf Violation-Ebene:
von 678 geschlossenen Befunden wurden **38 (5,6 %) durch Löschen des Elements** geschlossen.
Zusätzlich geprüft, weil Löschen nicht die einzige billige Schließung ist — **wie** wurde
geschlossen:

| Schließweg | Anzahl | Anteil |
|---|---|---|
| Kante gezogen/geändert | 354 | 52,2 % |
| Attribut geändert | 267 | 39,4 % |
| Element gelöscht | 38 | 5,6 % |
| Element unberührt (Kontext anderswo) | 12 | 1,8 % |
| Status umgestellt | 7 | 1,0 % |

**„Weich" geschlossen (gelöscht ODER Status so umgestellt, dass die Regel nicht mehr greift):
6,6 %.** Kill feuert nicht. Der Rückgang ist Verdrahtung und Bindung, nicht Aufräumen.

**2 — Regel-Artefakt.** Startregelmenge erhoben aus der contracts-Quelle zum Datum des ersten
Standes (`sigloch-modules @ 3107633`, 2026-07-26): 64 Regel-IDs. In der History feuern heute
36 Regeln, davon **15 nach dem Start entstanden** (AF-01…05, CR-R01…04, FC-04, R-29/30/31,
RD-04, SC-04). Auf die **Startregelmenge eingeschränkt**: 0,496 → 0,020, ebenfalls **−95,9 %**,
Steigung −7,4e-3, **gleiches Vorzeichen** wie die volle Reihe. 52 % des Gesamtrückgangs liegen
auf Regeln, die es zu Beginn schon gab. Zusätzlich **Leave-one-rule-out** über die sechs
massenstärksten Regeln (CR-R02, MS-03, R-31, R-30, CR-R01, R-19): Steigung bleibt in **allen
sechs Fällen** negativ (−1,06e-2 … −1,44e-2). Kill feuert nicht — der Trend hängt weder an den
neuen Regeln noch an einer einzelnen.

**3 — Hash-Wiederbesuche (der CR-GC-407-Detektor, erstmals am Bestand).** 72 distinkte Zustände
von 73. **Ein** Wiederbesuch — und der ist **benachbart** (#8 == #7, „re-canonicalize SSOT":
ein Commit, der die Datei umformatiert und den Graphen nicht anfasst). **Echte Kreise
(Abstand > 1 Stand): 0.** Kein Kreisverkehr in der realen History. Der Detektor, der auf der
konstruierten Sequenz rot gesehen wurde, meldet auf 73 realen Ständen null Fehlalarme.

### Was die Zahl NICHT sagt — die ehrliche Hälfte

- **Der Rückgang ist stufig, nicht stetig.** Summe aller Abwärtsschritte 613; die **drei
  größten Schritte tragen 337 = 55 %** (#49 −140, #47 −135, #48 −62). Die Kurve zeigt drei
  Aufräum-Kampagnen plus stetigen Abbau, nicht gleichmäßigen Fortschritt. Wer sie als
  „kontinuierliche Verbesserung" verkauft, überzeichnet.
- **Gegenläufer-Anteil 31,9 %** (23 von 72 Schritten steigen). Das ist normal — neue Elemente
  bringen erst Verstöße mit — aber es heißt: die Kennzahl ist pro Einzelschritt nicht
  interpretierbar, nur über die Strecke.
- **Keine Kontrollgruppe.** Es gibt keinen Beleg, dass ein Mensch dieselbe Kurve nicht
  produziert hätte. Die Aussage ist „die Arbeit hat gewirkt", **nicht** „der Autopilot war
  besser/billiger" (dieselbe Grenze wie CR-GC-408).
- **Der Regel-Build ist Teil der Zahl.** Mit contracts 9.0.0 (verlinkter Baum) lautet dieselbe
  Reihe 1,122 → 0,202 (−82,0 %), alle Kill-Kriterien unverändert nicht feuernd. Die Aussage
  überlebt den Build-Wechsel, die absoluten Zahlen nicht. Bei jeder Veröffentlichung gehört
  die contracts-Version an die Kurve.
- **Die RC-Konformanzfläche ist nicht gemessen.** Was der Graph über den Code behauptet, ist
  in dieser Kurve nicht geprüft.

### Empfehlung

**Die eine Kennzahl: Violations pro Element, ausgewertet mit EINER (der heutigen) Regelmenge
über alle Stände.** Sie ist die einzige der vier, die (a) über die ganze Strecke Auflösung
hat, (b) sich nicht durch Löschen fälschen lässt (Nenner sinkt mit) und (c) alle drei
Gegenproben übersteht.

**Die eine Darstellung: der Pfad Elemente × Violations mit Zeitrichtung** — ein
Scatter/Linienzug, kein Balken.

- **x-Achse: Elementzahl** (369 → 688), links nach rechts = das Modell wächst.
- **y-Achse: absolute Violations** (352 → 27), unten = sauber.
- **Verbindungslinie in Commit-Reihenfolge**, Punkte nach Datum eingefärbt (hell = Juli,
  dunkel = 25. August), Punktgröße oder Randfarbe = Severity-Anteil `error` (134 → 0).
- **Eine gestrichelte Referenzlinie durch den Ursprung mit der Startquote** (y = 0,954·x):
  alles darunter heißt „gewachsen und dabei relativ sauberer geworden". Der Endpunkt liegt bei
  27 statt bei 656 — das ist die ganze Aussage in einem Bild.
- **Was ein Betrachter ablesen soll:** die Kurve läuft **nach rechts und unten**. Nach rechts
  = es wurde gebaut (kein Aufräum-Artefakt, das wäre nach links). Nach unten = das Gebaute ist
  gebunden statt lose.
- **Fortschritt vs. Stillstand:** Stillstand ist ein **Punktcluster** (mehrere Stände am selben
  Ort, wie #69–#71); Wachstum ohne Wirkung ist eine **waagerechte oder steigende** Bewegung
  nach rechts; Aufräumen statt Verbessern wäre eine Bewegung nach **links** unten. In dieser
  History: 34 Schritte rechts-runter, 26 rechts-hoch, 2 links-runter, **0 links-hoch**,
  10 Stillstand.
- **Beschriftet gehören genau drei Punkte** (#47, #49, #60) — sonst liest niemand die Stufen
  als das, was sie sind.

Die Error-Freiheit gehört **nicht** als zweite Kurve daneben, sondern als **eine Textzeile
unter das Bild**: „seit 2026-08-22 error-frei (23 von 24 Ständen)". Als Kurve ist sie nach dem
Kipppunkt eine Nulllinie und stiehlt der tragenden Kennzahl die Aufmerksamkeit.

### Akzeptanzkriterien

| AK | Beleg |
|---|---|
| Zeitreihe über alle auswertbaren Stände; nicht auswertbare gezählt und benannt | **73/73 auswertbar, 0 nicht auswertbar.** Tabelle im Skript-Output, JSON-Export je Stand mit `byRule`. |
| Je Kennzahl Verlauf + Kill-Prüfung | Vier Kennzahlen, Tabelle oben. Trendstabilität über 8 Messfenster geprüft, kein Vorzeichenwechsel. |
| Löschen-Gegenprobe beziffert | 340 add / 21 delete; 5,6 % der Schließungen durch Löschen; 6,6 % „weich" inkl. Status-Umstellung. |
| Regel-Artefakt-Gegenprobe gerechnet | Startregelmenge 64 IDs @ 3107633; eingeschränkte Reihe −95,9 %, gleiches Vorzeichen. Plus Leave-one-rule-out über 6 Regeln. |
| Hash-Wiederbesuche genannt | **1 Wiederbesuch, davon 0 echte Kreise** (der eine ist ein benachbarter Reformat-Commit). |
| Empfehlung: eine Kennzahl, eine Darstellung | s. o. — V/Elem + Pfad Elemente × Violations. |
| Diff berührt nur `scripts/` und diesen CR | `scripts/spike-nachweis-history.mjs` + diese Datei. Kein Produktionscode, kein Modell-Schreibvorgang, keine Regel-/Readiness-Änderung. |

### Reproduktion

```bash
# Regel-Build des PRODUKTS (gepinnte Range), separat installiert:
mkdir -p /tmp/pinned && cd /tmp/pinned
echo '{"type":"module","dependencies":{"@sigloch/graph-api-core":"^5.1.0","@sigloch/contracts":"^6.0.0"}}' > package.json
npm install

# Messung:
node scripts/spike-nachweis-history.mjs --core /tmp/pinned --json /tmp/nachweis.json

# Sensitivitätsprobe mit dem verlinkten Arbeitsbaum (contracts 9.0.0):
node scripts/spike-nachweis-history.mjs --json /tmp/nachweis-workingcopy.json
```
