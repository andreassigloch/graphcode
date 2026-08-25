# CR-GC-427 — Spike: Nachweis der Autopilot-Arbeit aus der echten History

**Status:** open · **Angelegt:** 2026-08-25 · **Typ:** Spike (Timebox 1 Session)
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
