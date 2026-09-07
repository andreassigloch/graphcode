# CR-GC-483 — der Chebyshev-Score am Gate und im Ranking

**Status:** erledigt 2026-09-07 · **Angelegt:** 2026-09-07
**Herkunft:** CR-SM-292 (se-engine `steer.ts`) — die graphcode-Hälfte.
**Locks:** L2 (Steuerungssemantik), vom Auftraggeber freigegeben.

## 1. Was

- `computeSteerAdvisory(before, after)` neben `computeFitAdvisory` — **im selben Durchlauf, aus
  demselben Vorher/Nachher-Paar**, damit es keinen zweiten Weg zum Steuersignal gibt. Am Gate,
  nicht im Executor: der Executor sieht vom dryRun nur die NEUEN Violations (Delta-Semantik), der
  Score ist aber eine Aussage über den **Zustand**.
- `harness.mutate()` hängt `steerAdvisory` ans Ergebnis. `fitAdvisory` bleibt daneben stehen.
- `rankCandidates`: der ℝ⁶-Tiebreak `deltaSum` weicht der **Chebyshev-Verbesserung**, davor die
  **Zerstörungs-Sperre**. Neue Kette:

      viable → effectiveFocusDelta → blockingRise → totalDelta → tier
             → ZERSTÖRUNGS-SPERRE → steerImprovement → mutations → index

- `graph_suggest`: das Eingabefeld `target` entfällt **ersatzlos**, `unitTarget` und
  `GraphSuggestResult.target` mit ihm. Gerankt wird nach `verdict.steer.improvement`.
- Die Executor-Trace-Zeile zeigt `steer=` **vor** `Δm=` — was rankt, steht vorn.

## 2. Was NICHT

`fitAdvisory` wird weiter berechnet und berichtet (`graph_metrics`, das Advisory am Verdict). Es
rankt nur nichts mehr. Am Gate-Urteil ändert dieser CR nichts: der Score ist eine Messung, kein
Tor — geblockt wird ausschliesslich über Regeln.

## 3. Akzeptanzkriterien

- [x] `steerAdvisory` liegt an jedem erfolgreichen `mutate()`-Ergebnis.
- [x] Rot gesehen: ein Kandidat mit besserem Δm verliert gegen einen mit besserer
      Chebyshev-Verbesserung — die Konstellation, die früher andersherum ausging.
- [x] Rot gesehen: ohne die Sperre gewinnt der löschende Kandidat.
- [x] Fehlendes Advisory rankt wie „keine Verbesserung", nie besser.
- [x] `grep -rn "targetFor" src/` findet nichts.
- [x] Keine Testdatei ist gegenüber dem Stand vor diesem CR neu rot.

## 4. Dateien (5)

`src/kernel/measure/fit-advisory.ts` · `src/kernel/harness.ts` · `src/loop/executor-rank.ts` ·
`src/loop/executor.ts` (Trace-Zeile) · `tests/executor.bestofn.test.ts` — plus
`src/loop/suggest.ts`, das ohne die Anpassung nicht mehr kompiliert (Peer-Signatur).

## 5. Ergebnis

Alle Kriterien erfüllt. `tests/executor.bestofn.test.ts` 21/22 (die eine Rote ist vorbestehend),
**keine Datei gegenüber dem Vorher-Stand neu rot**, eine wurde grün.

## 6. Der Befund, der dabei sichtbar wurde — und er ist ein eigener CR

`tests/steering.architecture-causality.test.ts` war **vor** diesem CR bereits **10 von 12 rot**.
Die Datei ist der Kausalitätsnachweis des ℝ⁶ (T-C1 „the target direction reaches the ranking",
T-C2 „an applied suggestion moves ℝ⁶ in the target direction", T-C4 Placebo). Sie hat also schon
länger nicht mehr gehalten, und **niemand hat es gesehen** — weil `npm test` an der Wurzel
dauerhaft rot war (CR-SM-290) und graphcodes Suite 18 rote Dateien trägt.

Nach diesem CR prüft sie zusätzlich einen **gelöschten** Vertrag: das Eingabefeld `target` gibt
es nicht mehr. Eine rote Datei ist schlecht; eine rote Datei, die einen nicht mehr existierenden
Vertrag prüft, ist irreführend.

**Sie muss durch den Kausalitätsnachweis des NEUEN Scores ersetzt werden** — das ist CR-GC-484
und genau das „richtige Messinstrument", ohne das dieser Einbau nicht belegt ist:

- **T-S1** — der Score erreicht das Ranking: ein Kandidat, der die schlimmste Stelle senkt, steht
  vor einem, der eine unkritische senkt.
- **T-S2** — ein angewandter Vorschlag senkt den Score am Gate wirklich (nicht nur in der Sonde).
- **T-S3** — das Budget ist ein Knopf: `policy.decompositionBreadth` bewegen bewegt das Urteil
  (das ist der einzige Teil der Altdatei, der heute noch grün ist).
- **T-S4** — Placebo: innerhalb aller Budgets ist der Score 0 für jeden Kandidaten, und die
  Rangfolge bleibt deterministisch. Die Blindheit ist dokumentiert (CR-SM-291 Satz H) und muss
  als solche geprüft sein, nicht als Bestehen durchgehen.
