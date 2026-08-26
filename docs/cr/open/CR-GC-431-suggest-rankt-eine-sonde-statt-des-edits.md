# CR-GC-431 — `graph_suggest` rankt eine Sonde, liefert aber einen anderen Edit aus

**Status:** open · **Angelegt:** 2026-08-26 · **Priorität: hoch — trifft Kern-Claim B direkt**
**Herkunft:** Nebenbefund aus dem Divergenz-Spike CR-GC-430, unabhängig am Repo-Graphen
reproduziert.

## Befund

`graph_suggest` veröffentlicht je Suggestion ein `score`/`delta` — und, wo ein Fix-Template
existiert, zusätzlich einen `edit` mit `verdict.fitDelta`. **Die beiden Zahlen messen nicht
dieselbe Änderung:** `score` ist das Δm einer generischen Sonde (`applyRule`), `fitDelta` das
Δm des Edits, der tatsächlich ausgeliefert wird.

Am Repo-Graphen (`target: {scalability: 1}`, 2026-08-26) sieht das so aus:

| Suggestion | `score` | `edit` vorhanden | `verdict.fitDelta` (scalability) |
|---|---|---|---|
| R-31 / FUNC-bind-tools | **0,0085** (höchster) | **nein** | — |
| R-23 / MOD-dashboard | **0** | **ja** | **+0,0025** |
| FC-02, RD-01 | 0 | nein | — |

Die einzige anwendbare Suggestion trägt den Score **null**; ganz oben steht eine, die niemand
anwenden kann. Im Spike war das Vorzeichen sogar entgegengesetzt: R-22 unter einem
scalability-Ziel mit publiziertem Score **−0,2035**, während der echte Edit **+0,0329** liefert.

## Impact — gemessen, nicht geschätzt

Aus CR-GC-430: derselbe skriptierte Treiber, nur andere Zahlenquelle.

| Treiber rankt nach | erreichte Schritte (COHESIVE / SCALABLE) |
|---|---|
| publiziertem `score` | **1 / 0** |
| `verdict.fitDelta` | **5 / 5** |

**Ein Konsument, der der veröffentlichten Zahl glaubt, kommt praktisch nicht vom Fleck.** Und
genau das tut der reale Aktor: das Modell liest das Tool-Ergebnis, nicht unsere Absicht. Damit
ist die Architektur-Steuerung im Realbetrieb faktisch wirkungslos — obwohl der Regler
nachweislich richtig rechnet (CR-GC-340, CR-GC-430).

Das ist dieselbe Klasse wie CR-GC-428: zwei Zahlen für dieselbe Frage in einem Objekt, ohne dass
die Differenz benannt ist. Nur wiegt sie hier schwerer, weil die *falsche* der beiden die
prominente ist — sie steht im Ranking-Feld.

## Root Cause (zu verifizieren)

Das Ranking entsteht über eine generische Operator-Sonde, das Fix-Template kommt aus einem
zweiten Pfad (`fix-templates`, CR-SM-241) und wird nachträglich angehängt. Beide rechnen ihr
eigenes Δm; nichts erzwingt, dass die publizierte Zahl die des ausgelieferten Edits ist.

## Änderung

**Wo ein Template-Edit ausgeliefert wird, MUSS die publizierte Zahl dessen Δm sein.** Ein Score,
der eine andere Änderung bewertet als die beigelegte, ist kein Ranking, sondern eine Falle.

Zu entscheiden ist die Form — beide Varianten sind zulässig, aber nicht beide gleich gut:

1. **Score = Edit-Δm, wo ein Edit existiert** (bevorzugt): eine Zahl, die zum Objekt passt.
   Fund-only-Suggestions behalten die Sonde, sind aber als solche erkennbar.
2. **Zwei benannte Felder** (`probeScore` / `editScore`) und Ranking über den Edit-Score, wo
   vorhanden. Ehrlicher im Detail, aber der Konsument muss die Unterscheidung verstehen —
   und die LLM-Erfahrung sagt: was im prominenten Feld steht, wird gelesen.

In beiden Fällen: **Fund-only-Suggestions müssen als nicht anwendbar erkennbar sein**, sonst
rankt eine unanwendbare Zeile weiter über einer anwendbaren.

## Akzeptanzkriterien

- [ ] Für jede Suggestion mit `edit` gilt: die publizierte Ranking-Zahl ist das Δm **dieses**
      Edits (Test am realen Fixture, vorher rot gesehen — heute weichen sie im Vorzeichen ab).
- [ ] Das Ranking stellt keine nicht-anwendbare Suggestion über eine anwendbare mit positivem
      Edit-Δm.
- [ ] Fund-only ist im Ergebnis erkennbar, ohne auf das Fehlen von `edit` schließen zu müssen.
- [ ] Regressionstest mit dem CR-GC-430-Treiber: Ranking nach der publizierten Zahl erreicht
      dieselbe Schrittzahl wie nach `verdict.fitDelta` (heute 1/0 gegen 5/5).
- [ ] `graph_suggest`s Beschreibung sagt, was die Zahl misst.
- [ ] Keine zweite Messung: das Δm kommt aus demselben Pfad wie das Gate-Advisory (CR-GC-352,
      eine Währung — `layer` vs. `advisoryLayer` bleibt wie es ist).

## Nicht Teil dieses CR

Der Handoff-Zeitpunkt (Architektur erst im Endzustand), die schmale Steuerfläche (nur R-22/R-23/
SC-04 liefern auf `arch` überhaupt einen Edit) und das fehlende Triggerkonzept — eigene Befunde,
eigene CRs.

## Dateien (≤ 4)

1. `src/tools/suggest.ts`
2. ggf. die Ranking-/Template-Quelle
3. Test
4. dieser CR
