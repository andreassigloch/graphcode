# CR-GC-407 — Spike: Konvergenz-Zeuge über der Steering-Trajektorie

**Status:** open · **Angelegt:** 2026-08-24 · **Typ:** Spike (Timebox 1 Session)
**Frage:** Unterscheidet ein skalarer Zeuge + Zustands-Archiv zuverlässig Optimierung von
Kreisverkehr — oder ist das nur eine weitere Komplexitätsdimension?

## Herkunft — die Modellphilosophie-Diskussion (2026-08-24)

Dieser CR ist das Destillat einer Grundsatzdiskussion; die Messungen daraus sind die Baseline:

1. **Das Modell deckt Wirklichkeit nicht 1:1 ab, es macht sie managebar** (Stachowiak:
   Verkürzungs- + pragmatisches Merkmal). Die oberste Ebene ist nur dann eine treue
   Zusammenfassung, wenn sie neben dem Baum die Quervernetzung trägt (Simon, Near-Decomposability).
   Gemessen an uns selbst: **0,77** der FUNC-zu-FUNC-Links im Modell und **0,67** der Imports im
   Code (über die MOD-Grenzen des Graphen, 47 Files / 13 MODs) überqueren Block-Grenzen — aber
   konzentriert auf wenige Hubs (harness, mcp-tools, steering, cli tragen ~60 %). Summary-treu
   heißt bei uns also: Baum **plus** Hub-Flows (FCHAINs über dem FLOW-Netz — vorhanden).
2. **Detail darf das Konzept nicht *still* verletzen** — Anpassung ist ausdrücklich legitim
   (Suh: Zigzagging), aber Konflikt muss sichtbar werden und die Entscheidung geloggt.
3. **Regeln sind Ein-Parameter-Sichten** (LCOM4-Fall: Service-Funktionen bewusst im Bündel-MOD,
   weil das lokale Optimum Komplexität exportiert — Goodhart). Der Modellierer wägt global ab.
4. Daraus die Abbruchfrage: *Wann ist eine Optimierung fertig?* Das Spiderweb-Kriterium
   „jede Verbesserung eines Vektors verschlechtert einen anderen" ist **Pareto-Optimalität** —
   und hat zwei bekannte Löcher:
   - Die Pareto-Front ist eine **Menge**; *wo* man stehen bleibt, ist Werturteil. Das leistet
     bereits das Zielprofil (`target-profile.ts`, ℝ⁶-Gewichte, `conflictWarnings` kennt die
     Gegenpaare formelmäßig). Die „Blickrichtung von oben" = Gewichte der Ebene n+1.
   - **Schleife vs. Fortschritt ist mit Paar-Deltas unentscheidbar.** `computeFitAdvisory` und
     `computeSteeringDelta` sind strikt paarweise (before/after). Ein nicht-transitiver Zyklus
     (A→B hebt dim1, B→C hebt dim2, C→A hebt dim3) sieht in jedem Einzelschritt wie Fortschritt
     aus. Alles rechnet heute *quer* (Zustand vs. Zustand), nichts *längs* (Trajektorie).

## Hypothese

Zwei Zutaten über der Snapshot-Sequenz genügen, um die drei Endzustände zu trennen:

- **Skalarer monotoner Zeuge** (Lyapunov-Idee): `w·m(G)` — der ℝ⁶-Metrikvektor
  (`@sigloch/se-engine` `metrics`/`toArray`, layer `arch`), skalarisiert mit den
  target-profile-Gewichten (leer ⇒ Gleichgewichtung). Kein strikter Anstieg über k Schritte ⇒ Ende.
- **Zustands-Archiv**: Hash des kanonischen Exports (`exportGraphJson` ist deterministisch) je
  Zustand. Wiederbesuch eines Hashes = **Zyklus**; stationärer Zeuge ohne Wiederbesuch =
  **Pareto-Punkt erreicht**; sonst = läuft noch.
  (Den Graphen hashen, nicht den Vektor — 6 Dimensionen sind grob, verschiedene Graphen teilen
  sich einen Vektor ⇒ Fehlalarm.)

## Spike-Experiment (kein Produktionscode)

Ein Spike-Test (`tests/steering.convergence-witness.spike.test.ts`, ggf. + 1 Helper) konsumiert
Zustandssequenzen und rechnet je Zustand: `m(G)`, `w·m(G)`, Export-Hash. Drei Sequenzen:

1. **Konvergent** (skriptet): SSOT-Kopie, Sequenz von Violation-schließenden Mutationen
   (verify/satisfy-Kanten wie in `se:close-violations`). Erwartung: Zeuge steigt, kein Revisit.
2. **Zyklisch** (konstruiert): drei Mutationen, die nachweislich je eine Dimension heben und den
   Ausgangszustand wiederherstellen (A→B→C→A). Erwartung: jeder Paar-Delta-Schritt sieht positiv
   aus, Zeuge steigt **nicht** monoton, Hash-Revisit feuert.
3. **Stationär**: wiederholte No-Op-nahe Mutationen am Pareto-Punkt. Erwartung: Zeuge flach,
   kein Revisit ⇒ „fertig", nicht „Schleife".

Stretch (nur wenn 1–3 in der Timebox durch sind): Replay eines realen Audit-Trail-Abschnitts
statt der skripteten Sequenz 1.

## Kill-Kriterien — die ehrliche Hälfte

Der Spike ist ein **No-Go** (= weitere Komplexitätsdimension, nicht bauen), wenn eines eintritt:

- **Totzone zu groß:** Anteil der Mutationen mit `Δ(w·m) == 0` in Sequenz 1 über ~50 % — dann hat
  der Zeuge auf realen Schritten keine Trennschärfe (der ℝ⁶-Vektor misst nur `arch`; UC/REQ/TEST-
  Arbeit bewegt ihn evtl. gar nicht). Anteil wird gemessen und berichtet, nicht geschätzt.
- **Fehlalarm:** Zyklus-Detektor feuert auf der konvergenten Sequenz.
- **Blind:** konstruierter Zyklus wird nicht erkannt (Detektor nie rot gesehen ⇒ wertlos).
- **Rauschen:** Zeuge oszilliert auf Sequenz 1 so, dass jede k-Schwelle entweder zu früh stoppt
  oder Zyklen durchwinkt — dann trägt die Skalarisierung die Entscheidung nicht.

## Ausdrücklich nicht

- Keine Integration in `fit-advisory.ts` / `steering.ts` / Dashboard — das ist der Folge-CR,
  **nur bei Go**.
- Keine neue Regel, kein neues Panel, keine 7. Metrik-Dimension.
- Kein zweiter Messpfad: Metriken ausschließlich über `toOntologyGraph` + se-engine `metrics`
  (derselbe Mapper wie Snapshot/Advisory, CR-GC-303/324-Lehre).

## Akzeptanzkriterien

- [ ] Konstruierter Zyklus: Paar-Deltas je Schritt positiv **und** Detektor (Zeuge + Hash-Revisit)
      erkennt den Kreis — rot gesehen.
- [ ] Konvergente Sequenz: kein Fehlalarm; Monotonie-Verlauf des Zeugen protokolliert.
- [ ] Stationäre Sequenz: als „fertig" klassifiziert, nicht als Schleife.
- [ ] Totzonen-Anteil (Δ==0) der konvergenten Sequenz gemessen und im Ergebnis genannt.
- [ ] **Entscheidung im CR dokumentiert:** Go (mit Schnitt des Folge-CR) oder No-Go (mit der
      Zahl, die es begründet). Beides ist ein gültiges Spike-Ergebnis.
- [ ] Kein Produktionscode geändert (Diff berührt nur `tests/` + diesen CR).

## Dateien (≤ 3)

1. `tests/steering.convergence-witness.spike.test.ts`
2. optional `tests/helpers/witness.ts` (Zeuge + Hash + Sequenz-Klassifikator, nur test-seitig)
3. dieser CR (Ergebnis-Nachtrag wie bei CR-GC-400)
