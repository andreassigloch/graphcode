# CR-GC-431 — `graph_suggest` rankt eine Sonde, liefert aber einen anderen Edit aus

**Status:** done · **Angelegt:** 2026-08-26 · **Abgeschlossen:** 2026-08-26
**Priorität: hoch — trifft Kern-Claim B direkt**
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

- [x] Für jede Suggestion mit `edit` gilt: die publizierte Ranking-Zahl ist das Δm **dieses**
      Edits (Test am realen Fixture, vorher rot gesehen — heute weichen sie im Vorzeichen ab).
- [x] Das Ranking stellt keine nicht-anwendbare Suggestion über eine anwendbare mit positivem
      Edit-Δm.
- [x] Fund-only ist im Ergebnis erkennbar, ohne auf das Fehlen von `edit` schließen zu müssen.
- [x] Regressionstest mit dem CR-GC-430-Treiber: Ranking nach der publizierten Zahl erreicht
      dieselbe Schrittzahl wie nach `verdict.fitDelta` (heute 1/0 gegen 5/5).
- [x] `graph_suggest`s Beschreibung sagt, was die Zahl misst.
- [x] Keine zweite Messung: das Δm kommt aus demselben Pfad wie das Gate-Advisory (CR-GC-352,
      eine Währung — `layer` vs. `advisoryLayer` bleibt wie es ist).

## Umsetzung (2026-08-26)

**Variante 1** — der Score ist das Δm des ausgelieferten Edits. Variante 2 (`probeScore`/
`editScore`) wurde verworfen: sie hält die Falle offen und verlagert nur die Bringschuld auf
den Konsumenten. Ein LLM liest das prominente Feld.

**Ein Bit statt zweier Zahlen:** jede Suggestion trägt jetzt `applicable`.

- `applicable: true` — ein Template-Edit liegt bei UND das Gate hat ihn im dryRun durchgelassen.
  Dann sind `score` **und** `delta` das Δm genau dieses Edits, übernommen aus `verdict.fitDelta`
  (dem Gate-Advisory, das für den dryRun ohnehin anfällt). Kein zweiter Messpfad, `layer`/
  `advisoryLayer` unverändert; der `layerMismatch`-Satz benennt jetzt zusätzlich, dass
  anwendbare Scores auf `advisoryLayer` messen und Fund-Zeilen auf der Ranking-Ebene.
- `applicable: false` — es gibt nichts anzuwenden: Fund ohne Template-Edit **oder** ein vom Gate
  abgelehnter Edit (der hat kein `fitAdvisory`, also auch kein Edit-Δm). Dort bleibt die Sonde
  stehen, erkennbar markiert. Ein geblockter Edit war bisher als „Zug" ununterscheidbar.

**Reihenfolge:** anwendbar mit positivem Δm zuerst, dann der Rest; innerhalb beider Gruppen
Score absteigend, Tiebreak `ruleId` (deterministisch). Und: `suggestEdits` wird **ohne** `k`
gerufen — das k-Fenster schneidet erst nach dem Umranken, sonst fiele ein guter Edit heraus,
weil die Sonde ihn niedrig gerankt hatte.

**Zahlen am Repo-Graphen** (`target:{scalability:1}`, `layer:'arch'`, Snapshot
`docs/graph/graphcode.graph.json` in einen Temp-Kuzu importiert; die 24 `ACTOR -io-> UC`-Traces
der CR-GC-429-Drift lässt der Import aus): vorher stand R-31 mit `score` 0,0085 oben und trug
gar keinen Edit, R-23 trug den einzigen Edit mit `score` 0. Nachher tragen **alle zehn** Zeilen
`applicable:false` — R-23s Edit `FUNC-block-schaufenster -allocate-> MOD-dashboard` wird vom Gate
mit R-18 abgelehnt (die FUNC ist schon an `MOD-repo-root` alloziert). Am Repo-Graphen gibt es
derzeit also **keinen** anwendbaren Zug; vorher war das aus dem Ergebnis nicht ablesbar.

**Regressionstest** `tests/suggest.ranks-the-delivered-edit.test.ts` (CR-GC-430-Fixture, echtes
Disk-Kuzu, echtes Gate): der Treiber, einmal nach der publizierten Zahl und einmal nach
`verdict.fitDelta` gefahren. Vorher rot gesehen — COHESIVE 1 statt 5 Schritte, SCALABLE 0 statt
5, und keine einzige Suggestion mit `applicable`. Nachher 5/5 gegen 5/5, identische
Edit-Sequenzen. Der Spike-Test CR-GC-430 bleibt grün und meldet jetzt „sign conflicts: none";
seine Prosa ist entsprechend nachgeführt.

## Nicht Teil dieses CR

Der Handoff-Zeitpunkt (Architektur erst im Endzustand), die schmale Steuerfläche (nur R-22/R-23/
SC-04 liefern auf `arch` überhaupt einen Edit) und das fehlende Triggerkonzept — eigene Befunde,
eigene CRs.

## Dateien (5)

1. `src/tools/suggest.ts` — Umranken + `applicable`; se-engine bleibt unangetastet
   (die Sonde ist dort korrekt, falsch war nur, welche Zahl graphcode publiziert)
2. `tests/suggest.ranks-the-delivered-edit.test.ts` — neu, der Regressionstest
3. `tests/mcp.suggest.test.ts` — zwei Assertions kodierten die alte Divergenz
4. `tests/steering.divergence-two-profiles.test.ts` — nur Prosa/Kommentar nachgeführt
5. dieser CR
