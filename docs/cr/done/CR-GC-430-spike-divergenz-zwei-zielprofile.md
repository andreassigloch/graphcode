# CR-GC-430 — Spike: Divergenz-Nachweis — sieht ein Graph unter zwei Zielprofilen wirklich anders aus?

**Status:** done — 2026-08-26 (Spike-Ergebnis dokumentiert, Kill-Kriterien und Placebo belegt) ·
**Ergebnis: GO mit einer benannten Einschränkung — Claim B über n Schritte belegt (2026-08-26)**
**Angelegt:** 2026-08-26 · **Typ:** Spike (Timebox 1 Session)
**Folgearbeit (nicht hier):** der Rank-Fix ist als CR-GC-431 gebaut und geschlossen; der
Spike mit einem realen Modell statt des skriptierten Aktors bleibt ein eigener Spike.
**Beweist Kern-Claim B:** *„Zieldimensionen steuern die Architektur des Graphen."*

## Warum dieser Spike, obwohl CR-GC-340 schon existiert

CR-GC-340 hat den **Regler** bewiesen, deterministisch und bis heute grün
(`tests/steering.architecture-causality.test.ts`): invertiert man das Ziel, kehrt sich das
Vorzeichen **jedes** gemeinsamen Kandidaten um, ein anderer Vorschlag steht oben, und eine
angewandte Top-Suggestion hebt die ℝ⁶-Komponente in Zielrichtung.

Was fehlt, ist der Beweis über **mehr als einen Schritt**. CR-GC-340 §2.1 trennt die Kette
bewusst am Aktor auf (Stellgrößen → Regler → **Aktor** → Graph) und prüft nur den Regler.
Damit steht bis heute nicht fest, ob aus „jeder Einzelschritt zeigt in Zielrichtung" auch
**„nach n Schritten steht ein anderes System da"** folgt. Genau das ist der Claim.

## Die Frage, in einem Satz

Zwei gegensätzliche Zielprofile, **derselbe** Startgraph, je n Schritte greedy entlang
`graph_suggest` — divergieren die beiden Graphen **strukturell**, und laufen ihre
ℝ⁶-Metriken in die jeweils gewählte Richtung?

## Warum greedy statt LLM

Der Aktor ist die einzige stochastische Stelle. Ein LLM-Lauf würde die Frage vermischen
(„hat der Regler falsch gerechnet oder das Modell schlecht geschrieben?" — CR-GC-340 §2.1).
Deshalb hier ein **perfekter Aktor**: nimm die Top-Suggestion mit Edit, wende sie über
`graph_mutate` an, wiederhole. Das misst die **Obergrenze** der Steuerbarkeit — divergiert es
hier nicht, kann kein LLM es retten. Divergiert es, ist der nächste (getrennte) Schritt die
Frage, wie viel davon ein reales Modell abruft.

## Aufbau

- **Startgraph:** eigener Fixture, **nicht** der Repo-SSOT (der ist derzeit grammatik-inkompatibel,
  siehe CR-GC-429; und der Spike soll nicht an fremder Drift scheitern). Klein, aber mit echtem
  Spielraum: mehrere FUNC/MOD/FLOW, Allokationen, die verschiebbar sind. Muss zur **geladenen**
  Grammatik passen — vor dem Bauen prüfen, welche contracts-Version aufgelöst wird.
- **Zwei Profile:** gegensätzliche Richtungen im ℝ⁶ (z. B. `scalability` vs. `coherence` —
  die Wahl im CR begründen, sie muss ein echtes Gegensatzpaar sein; `conflictWarnings` in
  `target-profile.ts` kennt die Paare formelmäßig).
- **n Schritte je Lauf**, identischer Start, alles über das Gate (`graph_mutate`), Ergebnis je
  Schritt protokolliert: angewandte Regel/Edit, ℝ⁶ vorher/nachher, Export-Hash.

## Zu messen

1. **Strukturelle Divergenz:** Wie unterscheiden sich die Endgraphen? Symmetrische Differenz
   der Kanten/Allokationen — und zwar **benannt**, nicht nur gezählt: welche FUNC hängt am Ende
   an welchem MOD, welche Kette sieht anders aus. Das ist die Antwort, die ein Mensch sehen will.
2. **Richtungstreue:** Läuft `m(G)` je Lauf in die jeweils gewählte Richtung — und in der
   Gegenrichtung des anderen Laufs?
3. **Wann divergiert es?** Ab welchem Schritt trennen sich die Läufe? Wenn erst spät oder nie,
   ist das Fenster im Realbetrieb noch kleiner als gedacht.
4. **Erschöpfung:** Wie viele Schritte liefert `graph_suggest` überhaupt, bevor keine
   Edit-tragende Suggestion mehr kommt? Das ist die reale Reichweite der Architektur-Schleife.

## Kill-Kriterien — die ehrliche Hälfte

**No-Go** (= Claim B ist über mehr als einen Schritt nicht belegt), wenn:

- **Keine Divergenz:** beide Läufe enden bei (nahezu) demselben Graphen — der Zielvektor
  entscheidet dann nur die *Reihenfolge*, nicht das *Ergebnis*.
- **Zu kurz:** die Kette bricht nach 1–2 Schritten ab, weil keine Edit-tragende Suggestion mehr
  kommt. Dann ist die Steuerung real wirkungslos, egal wie sauber der Regler rechnet.
- **Gate-blockiert:** die Top-Suggestions lassen sich nicht anwenden (dryRun-Verdict rot) —
  dann steuert das Regelwerk gegen das Zielprofil, und das ist ein Befund für sich.
- **Richtungslos:** `m(G)` bewegt sich nicht in Zielrichtung, obwohl jeder Einzelschritt es
  behauptet (die 407-Falle: Paar-Deltas positiv, Trajektorie nicht).

## Ausdrücklich nicht

- Kein LLM im Loop, kein Produktionscode, keine Regel-/Readiness-Änderung.
- Keine Aussage darüber, ob ein *reales* Modell diese Steuerung abruft — das ist der Folge-Spike.
- Keine Änderung am Handoff-Zeitpunkt (dass Architektur erst im Endzustand drankommt, ist ein
  eigener, bereits benannter Befund).

## Akzeptanzkriterien

- [x] Beide Läufe laufen über das echte Gate, Disk-Persistenz, identischer Startgraph.
- [x] Strukturelle Differenz der Endgraphen **benannt** (welche Allokation/Kette anders), nicht
      nur beziffert.
- [x] Richtungstreue je Lauf ausgewiesen, inklusive Gegenrichtung.
- [x] Schritt, ab dem die Läufe divergieren, genannt; Kettenlänge bis zur Erschöpfung gemessen.
- [x] **Entscheidung:** Claim B über n Schritte belegt (mit den Zahlen) oder No-Go (mit der Zahl).
- [x] Diff berührt nur `tests/` bzw. `scripts/` und diesen CR.

## Dateien (≤ 3)

1. `tests/steering.divergence-two-profiles.test.ts` — der Spike-Treiber (6 Läufe)
2. `tests/fixtures/divergence-graph.ts` — der Startgraph
3. dieser CR (Ergebnis-Nachtrag)

---

# Ergebnis (2026-08-26) — **GO**, mit einer benannten Einschränkung

**Entscheidung: Claim B ist über n Schritte belegt.** Zwei gegensätzliche Zielprofile erzeugen aus
DEMSELBEN Startgraphen zwei strukturell verschiedene Architekturen, jede läuft in ihre eigene
Richtung, und die Kette ist lang genug, um das zu tragen. Die tragende Zahl steht im Abschnitt
„Die eine Zahl" weiter unten.

**Die Einschränkung, gleich vorweg:** die Divergenz entsteht heute fast ausschließlich daraus, dass
die Profile eine ANDERE TEILMENGE derselben Reparaturen anwenden — nicht daraus, dass dieselbe
Reparatur anders ausfällt. *Wohin* eine FUNC alloziert wird, leitet das Fix-Template deterministisch
aus dem Elementtext her; das Ziel wählt nur, *ob* und *wann*. Es gibt genau eine Ausnahme, und die
musste in den Fixture hineinkonstruiert werden (siehe „FUNC-notify" unten).

## Aufbau (wie gemessen)

- **Grammatik:** `@sigloch/contracts` 9.1.0 (ONTOLOGY 8.0.0 / RULES 9.1.0) — die geladene, gegen die
  der Fixture gebaut ist. Der Repo-SSOT wurde nicht angefasst (CR-GC-429 bleibt offen).
- **Startgraph:** `tests/fixtures/divergence-graph.ts` — eine Dokument-Triage-Pipeline, 34 Elemente,
  Architektur-Teilgraph mit 4 MOD / 10 FUNC / 5 FLOW / 4 SCHEMA / 2 ACTOR. Spielraum: 7 FUNC ohne
  Allokation, 1 leeres MOD, 4 FLOW ohne Datenvertrag (3 davon aus dem Text herleitbar).
- **Profile** (dokumentiertes Gegenpaar aus `CONFLICT_PAIRS`, `src/target-profile.ts`; bewusst
  **keine** exakten Antipoden, sonst wäre die Disjunktheit der Positiv-Mengen reine Arithmetik):
  - `COHESIVE` = `{coherence: 1, modifiability: 0.5}`
  - `SCALABLE` = `{scalability: 1, flowEfficiency: 0.5}`
- **Aktor:** perfekt und skriptiert (kein LLM) — nimm die bestbewertete Edit-tragende Suggestion, die
  dem Ziel noch hilft, wende sie über `harness.mutate()` an, wiederhole. Gemisst wird damit die
  **Obergrenze** der Steuerbarkeit.
- **Ebene:** ranken, messen und urteilen alles auf `layer:'arch'` — der Default von `graph_suggest`
  und die Ebene des Gate-`fitAdvisory` (CR-GC-352), also eine Währung statt zwei.
- **Store:** je Lauf ein eigener Kuzu auf Disk (temp), nie `:memory:`. Alle berichteten Endwerte sind
  nach `loadGraph()` **aus dem Store zurückgelesen**, nicht aus der Arbeitskopie.

Startvektor (arch, ℝ⁶ in kanonischer Ordnung
`modifiability faultTolerance flowEfficiency coherence viability scalability`):

```
2.4957  0.8000  0.8537  4.1667  4.2000  3.0163
```

## 1. Strukturelle Divergenz — benannt

| | COHESIVE | SCALABLE |
|---|---|---|
| **FUNC-notify** | **MOD-retention** | **MOD-delivery** |
| FUNC-explain | (nicht alloziert) | MOD-analysis |
| FUNC-extract | (nicht alloziert) | MOD-analysis |
| FUNC-normalize | (nicht alloziert) | MOD-intake |
| FLOW-clean | SCHEMA-clean | (kein Vertrag) |
| FLOW-features | SCHEMA-features | (kein Vertrag) |
| FLOW-verdict | SCHEMA-verdict | (kein Vertrag) |
| FUNC-archive / FUNC-classify / FUNC-receive / FUNC-report | identisch | identisch |

Symmetrische Kantendifferenz im Architektur-Teilgraphen: **8 Kanten** (4 je Seite).

In einem Satz: **COHESIVE baut die Datenverträge, SCALABLE baut die Modulzuordnung.** COHESIVE endet
mit einer vollständig verdrahteten Schnittstellen-Schicht (alle vier FLOWs tragen ihren SCHEMA) und
vier heimatlosen Funktionen; SCALABLE endet mit einer durchmodularisierten Funktionslandschaft und
drei FLOWs ohne Datenvertrag. Ein SDD und ein ICD über diese beiden Graphen zeigen zwei verschiedene
Systeme, nicht dasselbe System in anderer Reihenfolge.

**Die Ausnahme, die die Einschränkung trägt: `FUNC-notify`.** Diese Funktion wird von zwei
Architektur-Operatoren umkämpft — ihr eigener Text weist sie `MOD-delivery` zu (R-22s Herleitung),
`MOD-retention`s Text beansprucht sie (R-23s Herleitung). R-22 arbeitet die Funktionen alphabetisch
ab und erreicht `notify` erst bei seinem fünften Feuern, R-23 steht ab Schritt 1 bereit. Wie hoch das
Profil R-23 gegen R-22 rankt, entscheidet also, **wo die Funktion landet**: COHESIVE legt sie nach
`MOD-retention`, SCALABLE nach `MOD-delivery`. Das ist die einzige Stelle im heutigen
Template-Katalog, an der das Ziel den ORT bestimmt und nicht nur die Auswahl — und sie musste in den
Fixture konstruiert werden, damit sie überhaupt existiert.

## 2. Richtungstreue

Projektion der GESAMTEN Trajektorie (Ende − Start) auf die jeweilige Einheitsrichtung:

| Lauf | entlang eigenem Ziel | entlang dem Ziel des anderen |
|---|---|---|
| COHESIVE | **+0.1677** | **−0.8872** |
| SCALABLE | **+0.3226** | +0.0853 |

Beide Läufe laufen in ihre eigene Richtung, und jeder bedient sein eigenes Ziel besser als der andere
es tut (0.1677 > 0.0853 bzw. 0.3226 > −0.8872).

**Ehrlich dazu:** die Gegenrichtung ist *asymmetrisch*. COHESIVEs Trajektorie schadet SCALABLEs Ziel
deutlich (−0.8872, im Wesentlichen der Einbruch von `scalability` 3.0163 → 2.0048). SCALABLEs
Trajektorie schadet COHESIVEs Ziel **nicht** — sie hilft ihm sogar leicht (+0.0853). Die zwei Profile
sind also keine Spiegelbilder; „gegensätzlich" gilt in einer Richtung stärker als in der anderen.
Zweite Ehrlichkeit: `coherence` endet in **beiden** Läufen bei exakt 4.3103. COHESIVEs Vorsprung
kommt aus `modifiability` (2.5832 vs. 2.3989), nicht aus der Dimension, die dem Profil den Namen gibt.

Endvektoren:

```
COHESIVE  2.5832  1.0000  0.8929  4.3103  5.0000  2.0048
SCALABLE  2.3989  1.8000  0.9259  4.3103  4.2000  3.3409
```

**Die 407-Falle ist geprüft und schnappt nicht zu:** die Summe der versprochenen Schritt-Scores und
die realisierte Trajektorie stimmen in beiden Läufen exakt überein (COHESIVE 0.1677 = 0.1677,
SCALABLE 0.3226 = 0.3226). Das ist allerdings kein Zufall, sondern eine Folge des Rankings — siehe
Befund 5; die Falle wird dort an der anderen Zahl doch noch fündig.

## 3. Divergenz-Schritt

**Schritt 1.** Die Läufe trennen sich sofort: COHESIVE greift zu
`FLOW-clean -relation-> SCHEMA-clean` (SC-04), SCALABLE zu
`FUNC-archive -allocate-> MOD-delivery` (R-22). Es gibt keine gemeinsame Vorlaufphase.

## 4. Erschöpfung / Reichweite

- COHESIVE: **5 Schritte** bis zum Greedy-Optimum (danach hilft keine Edit-tragende Suggestion mehr).
- SCALABLE: **5 Schritte** bis zum Greedy-Optimum.
- Vorzeichen-ignorierender Lauf („EXHAUST", nimm alles bis nichts mehr da ist): **9 Schritte**, bis
  `graph_suggest` überhaupt keine Edit-tragende Suggestion mehr liefert.

Die Kette bricht also nicht nach 1–2 Schritten ab — das Kill-Kriterium „zu kurz" greift nicht. Der
Boden ist erklärbar und liegt im Katalog, nicht im Zufall: nur **drei** Regeln liefern auf `arch`
überhaupt einen Edit (R-22, R-23, SC-04), und `suggestEdits` behält je Regel nur die **erste**
Violation. Ein Element, aus dessen Text das Template nichts herleiten kann, blockiert damit seine
Regel für den Rest des Laufs (im Fixture bewusst als `FUNC-watchdog` / `FLOW-webhook` modelliert).

## 5. Gate — und der Befund, der den Spike beinahe gekippt hätte

**Gate-blockiert: nein.** Keine einzige angewandte Suggestion wurde vom Gate abgewiesen; alle Edits
kamen mit `tier: auto-apply` durch. Das Regelwerk steuert nicht gegen die Zielprofile.

**Aber:** `graph_suggest` veröffentlicht als `score` das Δm einer **generischen Sonde**
(`applyRule` in se-engine), nicht das des Template-Edits, den es im selben Objekt ausliefert. Auf
diesem Fixture haben die beiden **entgegengesetzte Vorzeichen** — unter `COHESIVE` bei allen drei
Edit-tragenden Regeln, unter `SCALABLE` bei der einen, die den Lauf überhaupt in Gang bringt
(beide Zahlen sind die Projektion auf die jeweils eigene Zielrichtung, also nur spaltenweise
vergleichbar):

| Profil | Regel | veröffentlichter `score` | Gate-Advisory für den echten Edit |
|---|---|---|---|
| COHESIVE | R-22 | −0.1307 | **+0.0119** |
| COHESIVE | R-23 | −0.1307 | **+0.0119** |
| COHESIVE | SC-04 | −0.1982 | **+0.0065** |
| SCALABLE | R-22 | −0.2035 | **+0.0329** |

Konsequenz, gemessen: ein Treiber, der die veröffentlichte Zahl glaubt, kommt unter `SCALABLE` auf
**0 Schritte** (jede Suggestion sieht schädlich aus) und unter `COHESIVE` auf **1 Schritt**. Derselbe
Treiber, der stattdessen `verdict.fitDelta` liest — die Gate-eigene dryRun-Auskunft über genau den
Edit, der angewandt würde, im selben Response, auf derselben Ebene —, kommt auf 5 und 5.

Das ist die 407-Falle in ihrer schärferen Form: nicht „jeder Einzelschritt behauptet Richtung, die
Trajektorie hält sie nicht", sondern „die veröffentlichte Zahl beschreibt eine andere Kante als die
ausgelieferte". Der Spike wertet deshalb auf `verdict.fitDelta` aus (ein perfekter Aktor nimmt die
beste Information, die das Werkzeug hergibt) und weist den Probe-Lauf als Kontrolle mit aus. **Der
Fix gehört in einen eigenen CR** (Vorschlag: `graph_suggest` rankt nach dem Advisory des
Template-Edits, wenn einer vorhanden ist, und behält die Sonde nur für die Fund-Ebene ohne Edit) —
hier wurde bewusst kein Produktionscode angefasst.

Nebenbefund: ist eine FUNC bereits alloziert, schlägt R-23 sie trotzdem noch einem leeren Modul zu;
der Gate-dryRun weist diesen Edit dann selbst ab (Kardinalität `FUNC -allocate-> MOD` = 0..1). Der
Treiber hier erkennt das am fehlenden `fitDelta` und wählt ihn nie — ein LLM-Treiber würde es
vermutlich versuchen.

## Die eine Zahl

**8 Kanten symmetrische Differenz im Architektur-Teilgraphen, ab Schritt 1, bei identischem
Startgraphen und reproduzierbarem Lauf** — darunter eine Funktion (`FUNC-notify`), die in beiden
Läufen alloziert wurde, in **verschiedene Module**.

## Gegenproben (die ehrliche Hälfte)

| Kill-Kriterium | Ergebnis |
|---|---|
| Keine Divergenz | **hält nicht** — 8 Kanten Differenz, davon eine echte Ortsdifferenz |
| Zu kurz (1–2 Schritte) | **hält nicht** — 5 / 5 Schritte gesteuert, 9 Schritte bis zur Erschöpfung |
| Gate-blockiert | **hält nicht** — 0 abgewiesene angewandte Edits, alle `auto-apply` |
| Richtungslos (407) | **hält nicht** für die Trajektorie (versprochen = realisiert), **trifft aber** die veröffentlichte `score`-Zahl — siehe Befund 5 |

**Placebo:** derselbe Zielvektor zweimal, in getrennten Stores, ergibt Schritt für Schritt dieselbe
Trajektorie und denselben Endgraphen. Die Divergenz oben ist also die Wirkung des Ziels, nicht
Lauf-zu-Lauf-Rauschen.

## Was dieser Spike NICHT zeigt

- Nicht, ob ein **reales Modell** diese Steuerung abruft — hier lief ein perfekter, skriptierter
  Aktor. Das bleibt der Folge-Spike.
- Nicht, dass das Ziel die **Platzierung** steuert. Es steuert die **Auswahl**; die Platzierung kommt
  aus dem Elementtext. Die eine Ausnahme (`FUNC-notify`) existiert nur, weil zwei Operatoren
  dieselbe Funktion beanspruchen — ein Muster, das in einem realen Graphen zufällig auftritt, nicht
  systematisch.
- Nichts über die Reichweite außerhalb von `layer:'arch'`: nur drei Regeln (R-22, R-23, SC-04)
  liefern dort überhaupt einen anwendbaren Edit. Die Steuerfläche ist schmal.
