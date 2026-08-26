# CR-GC-430 — Spike: Divergenz-Nachweis — sieht ein Graph unter zwei Zielprofilen wirklich anders aus?

**Status:** open · **Angelegt:** 2026-08-26 · **Typ:** Spike (Timebox 1 Session)
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

- [ ] Beide Läufe laufen über das echte Gate, Disk-Persistenz, identischer Startgraph.
- [ ] Strukturelle Differenz der Endgraphen **benannt** (welche Allokation/Kette anders), nicht
      nur beziffert.
- [ ] Richtungstreue je Lauf ausgewiesen, inklusive Gegenrichtung.
- [ ] Schritt, ab dem die Läufe divergieren, genannt; Kettenlänge bis zur Erschöpfung gemessen.
- [ ] **Entscheidung:** Claim B über n Schritte belegt (mit den Zahlen) oder No-Go (mit der Zahl).
- [ ] Diff berührt nur `tests/` bzw. `scripts/` und diesen CR.

## Dateien (≤ 3)

1. Spike-Test bzw. -Skript
2. optional Fixture-Helfer
3. dieser CR (Ergebnis-Nachtrag)
