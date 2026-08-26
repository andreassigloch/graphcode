# CR-GC-438 — Spike: Archetyp-Zielprofile + 7. Dimension „Vertragskonzentration" (Eigenvektor-Test)

**Status:** OFFEN · **Angelegt:** 2026-08-26 · **Typ:** Spike (Timebox 1 Session, Trockenübung)
**Vorgänger:** [CR-GC-436](../done/CR-GC-436-spike-architektur-optimierung-graphcode.md) — No-Go
fürs Umhängen, GO für Vertragskonsolidierung; Nachtrag 2 + `scripts/spike-arch-regelkreis.mjs`
sind die Datenbasis dieses Spikes. Zielbild-Artefakt:
`claude.ai/code/artifact/cd55117c-0fcc-4859-be1a-615c86529760`.

> **Trockenübung.** Kein Gate-Write, kein contracts-/se-engine-Change, SSOT unangetastet.
> Ergebnis ist eine **Familie-Review-Vorlage** (R⁶ ist SSOT-verriegelt; Öffnen braucht Messung —
> die liefert dieser Spike), keine Umsetzung.

## Ausgangslage (gemessen, CR-GC-436 / Regelkreis-Trockenübung, graphVersion 208)

Die R⁶-Formeln kodieren implizit **ein** Archetyp-Ideal (verteiltes System ohne Zentrum):

| Dimension | Formel | Verhalten beim Kernel-Umbau (gemessen) |
|---|---|---|
| modifiability | 5·Q (Newman) | **blind**: −0,016 → −0,003 (Regelkreis); im Gate-Lauf sank sie sogar (2,813 → 2,760) bei gutem Zug |
| scalability | 5·(1−maxBetweenness) | **gegenläufig**: bestraft den gewollten Kernel-Hub |
| CR-01 crossingFlows (Policy warning ≥3) | rohe io-Querungen je MOD-Paar | **gegenläufig**: Konzentration auf 10 Paare treibt jedes Paar über die Schwelle |
| coherence / MT-02 | intra-Anteil / LCOM4 | dafür (0-intern-Module 5 → 0) |

Kandidat für die fehlende Achse — **Vertragskonzentration** — reagiert scharf, wo Q blind ist:
Modulrand-Vokabular **29 → 14** verschiedene FLOWs, Top-5-Konzentration **66,3 % → 93,8 %**
(`spike-arch-regelkreis.mjs`, letzte Zeile je Lauf).

**Eigenvektor-Evidenz, bisher 2 Punkte:** der Handschnitt (CR-436 Lauf B) bewegt Q ohne das
Vokabular; der Regelkreis-Schnitt bewegt Vokabular/Konzentration bei Q ≈ 0. Zwei Züge, je eine
Achse — das ist Indiz, kein Test. Der Test über den Bestand ist dieser Spike.

## Die Frage, in einem Satz

Ist „Vertragskonzentration" eine **eigenständige** 7. Dimension (über die Familie-Graphen nicht
als Linearkombination der R⁶ darstellbar), und welche **Zielvektoren je Architektur-Muster**
(Kernel · Pipeline · Layered · Föderiert · Broker · Plugin) sind messbar begründbar?

## Vorgehen — nur lesend

1. **D7-Prototyp als Messfunktion** (`scripts/spike-archetype-eigenvector.mjs`, nur lesend):
   (a) Modulrand-Vokabular — Zählbasis **SCHEMA**, nicht FLOW-Label (Anti-Gaming: SC-04 erzwingt
   SCHEMA am Grenz-FLOW; ein Label-Merge ohne Vertrags-Merge darf die Zahl nicht bewegen);
   (b) Top-k-Konzentration des Randverkehrs (k=5).
2. **Messmatrix 7×N:** die 6 R⁶ (`metrics(G, layer:'arch')`, se-engine) + D7 über die
   verfügbaren Familie-Graphen (graphcode, sigloch-modules-Selbstmodell, graphcodedemo, sirail,
   kadjar, moneyflow, siconizer, …) **plus** die drei Spike-Zustände aus CR-436
   (v208 · Handschnitt · Regelkreis). Nicht ladbare Graphen werden benannt, nicht ersetzt.
3. **Eigenvektor-Test:** lineare Regression D7 ~ R⁶ über die Matrix. Schwelle **vorab**:
   R² ≥ 0,8 ⇒ D7 ist abgeleitet, kein eigener Vektor (Kill 1). Paarweise |r| mitliefern.
4. **Archetyp-Presets:** die 6-Muster-Tabelle (Memory `r6-targets-sind-archetyp-vektoren`)
   gegen die Messmatrix prüfen: unterscheiden sich die Ist-Vektoren der Repos so, wie die
   Muster-Hypothese es vorhersagt (z. B. Web-Vertical moneyflow: hohes Q; Kernel graphcode:
   Q≈0, hohe Konzentration)? Ausgabe: Preset-Katalog `{muster → weights + MetricPolicy}` als
   Entscheidungsvorlage für `se:target-profile`.
5. **Policy-Kopplung messen:** je Familie-Graph, wie viele CR-01-Befunde kippen mit
   `crossingFlows: null` (Kernel-Preset) bzw. distinct-Zählung statt roher Querungen.

## Kill-Kriterien (vorab festgelegt)

1. **Abgeleitet statt eigenständig:** R² ≥ 0,8 der Regression D7 ~ R⁶ ⇒ keine 7. Dimension;
   D7 bleibt Modul-Kennzahl (moduleMetrics-Familie), kein MetricVector-Eintrag.
2. **Gaming-anfällig:** bewegt ein FLOW-Label-Merge ohne SCHEMA-Merge die D7-Zahl, ist die
   Zählbasis falsch — auf SCHEMA-Ebene fixieren oder No-Go.
3. **Presets diskriminieren nicht:** lassen sich die Zielvektoren zweier Muster am Bestand
   nicht messbar unterscheiden, ist der Katalog Prosa und wird nicht vorgeschlagen.

## Ausdrücklich nicht

- Keine Änderung an contracts/se-engine/MetricVector — das ist der **Familie-CR danach**
  (CR-A: D7 + Policy-Presets · CR-B: se:target-profile-Presets · CR-C: Konsolidierungs-Operator
  in fix-templates), den dieser Spike nur **vorlegt**.
- Kein Gate-Write, kein `graph_export`, kein Commit an `docs/graph/*.graph.json`.
- Keine Regel-/Readiness-Änderung, kein LLM im Loop.

## Bereits eingerichtet (dieser Commit, Sofortmaßnahme)

`.graphcode/target-profile.json` steht auf dem **Kernel-Vektor** (vorher: coherence 1,
modifiability 0,7, faultTolerance 0,3, Rest 0):

| Dimension | alt | neu | Warum |
|---|---|---|---|
| coherence | 1 | **1** | reagiert richtig (0-intern 5 → 0) |
| modifiability | 0,7 | **0** | Q ist für Rollen-Schnitte gemessen blind — raus aus dem Ranking |
| faultTolerance | 0,3 | **0** | Single-Writer-Kernel sucht keine Redundanz |
| flowEfficiency | 0 | **0,4** | kurze Wege durch den Regelkreis |
| viability | 0 | **0,4** | eine zusammenhängende Masse um den Kernel ist gewollt |
| scalability | 0 | **−0,2** | der Hub ist Design; Dezentralisierungs-Züge sollen negativ ranken |

`metricPolicy.crossingFlows` bleibt **unverändert** (warning 3), bis Schritt 5 die Bilanz
liefert — das Urteil kippen ist Spike-Ergebnis, nicht Vorgriff.

## Akzeptanzkriterien

- [ ] Messmatrix 7×N tabellarisch im Ergebnis-Nachtrag; nicht ladbare Graphen benannt.
- [ ] Eigenvektor-Test mit vorab fixierter Schwelle (R² 0,8), Regression + paarweise |r|.
- [ ] Anti-Gaming-Probe: Label-Merge ohne SCHEMA-Merge bewegt D7 nicht (Kill 2 geprüft).
- [ ] Preset-Katalog je Muster mit Messbeleg oder benanntem Nicht-Beleg (Kill 3).
- [ ] CR-01-Kipp-Bilanz je Graph für `null` und distinct-Zählung.
- [ ] **Entscheidungsvorlage:** Familie-Review ja/nein mit der tragenden Zahl (R² und
      Konzentrations-Spanne über die Muster). Kein „teils/teils" ohne Zahl.
- [ ] Diff berührt nur `scripts/`, `.graphcode/target-profile.json` und diesen CR.

## Dateien (≤ 3)

1. `scripts/spike-archetype-eigenvector.mjs` — Messmatrix + Regression + Anti-Gaming-Probe
2. `.graphcode/target-profile.json` — Kernel-Vektor (bereits mit diesem CR eingerichtet)
3. dieser CR (Ergebnis-Nachtrag)
