# CR-GC-501: Modell verdrahtet Gate-Urteil, Live-Events und Messwerk anders als der Code

**Status:** ✅ Done (2026-09-11)
**Typ:** aus Item ITEM-2026-033 (finding)
**Erstellt:** 2026-09-11
**Item:** bok/items/ITEM-2026-033.json (Lane: graph)

---

BEFUND (am Code geprueft 2026-09-11, Spike Bus-Problem ITEM-2026-028):
- FLOW-gate-verdict hat 7 Produzenten, MutateResult erzeugt nur harness.mutate. bootstrap und import-code-verb bauen einen MutateCommand und reichen das Ergebnis weiter. import (importGraph) schreibt in den Store und liefert Zaehler. evaluate-rules liefert RuleViolation[] (Gate-Katalog). check-code-conformance liefert RuleViolation[] an evaluateAll (report.ts), nicht ans Gate. take-steering-snapshot hat keinen Bezug zum Urteil, liest den Graphen.
- FLOW-live-event hat 3 Produzenten: emit-update-event erzeugt das Event, broadcast schreibt versionierte SSE-Frames (id), serveHost verdrahtet nur die Weiterleitung.
- Messwerk -> Fuehrung: takeSteeringSnapshot ruft computeReadiness selbst (Modell zeigt die Richtung umgekehrt). nextStep und generationStep lesen report aus dem Snapshot. computePhaseReadiness bekommt die Snapshot-Befunde, kein Gate-Urteil. rankCandidates liest fitAdvisory, steeringDelta und steerAdvisory aus dem Gate-Urteil. computeFitAdvisory ruft metrics() (arch-fitness).
AENDERUNG: nur Modell, jede Kante an eine Code-Stelle gebunden. Neue FLOWs fuer Regelbefunde, Konformanzbefunde und SSE-Frames.
NICHT: skill-report, install-result, formatE-artifact (Schreibseite), mutate-cmd, query-request, steering-trigger sind Kanaele mit mehreren Absendern und bleiben. graph-state (9 Produzenten) ist ein Code-Thema, eigenes Item.

---

## Umsetzung (2026-09-11, Graph-Version 246 → 249)

Nur Modell. Drei Batches durch das Gate, 0 Fehler, jede geänderte Kante an eine Code-Stelle gebunden.

| Fluss | vorher | nachher | Beleg im Code |
|---|---|---|---|
| `FLOW-gate-verdict` | 7 Produzenten | nur `mutate` | `bootstrap.ts` und `import-code-verb.ts` senden einen MutateCommand und lesen das Ergebnis; `importGraph` schreibt in den Store; `evaluateRules()` liefert `RuleViolation[]`; `conformanceEvaluation` geht in `evaluateAll` (report.ts); `takeSteeringSnapshot(graph, policy, threshold)` |
| `FLOW-live-event` | 3 Produzenten | nur `emit-update-event` | `host.ts` `broadcast()` schreibt die versionierten Frames → neuer `FLOW-sse-frame` zum Dashboard |
| Messwerk → Führung | 8 Flüsse | 5 | `takeSteeringSnapshot` ruft `computeReadiness` selbst (Richtung gedreht); `nextStep`/`generationStep` lesen `report` aus dem Snapshot; `rankCandidates` liest das Gate-Urteil; `computeFitAdvisory` ruft `metrics()` |

Neu: `SCHEMA-rule-violation` (contracts `RuleViolationSchema`), `FLOW-rule-findings` (evaluate-rules → mutate, health-endpoint), `FLOW-conformance-findings` (check-code-conformance → compute-readiness), `FLOW-sse-frame`.
`FCHAIN-model-import`: `mutate` statt `import` — Skill- und CLI-Import laufen über `graph_mutate`. `import` gehört zu `FCHAIN-recall` (`openMeasured`, `seedFromJson`/`reseed` teilen `importOntologyGraph`).
Beschreibung von `FLOW-gate-verdict` an den Code angepasst.

Ein Zwischenstand war falsch und ist korrigiert: `fit-advisory` und `steering-delta` zu `rank-candidates` hatte ich entfernt, RC-04 stieg auf 5. `executor-rank.ts` parst `FitAdvisory` und `SteeringDelta` selbst, die beiden Kanten bleiben.

## Messung

- IO-02 (Rig am SSOT): 9 → 7. Weg: `gate-verdict`, `live-event`. Größer geworden, weil jetzt code-treu: `mutate-cmd` 19 → 21 (bootstrap, import-code-verb), `graph-state` 9 → 10 (import) — `graph-state` ist CR-GC-503.
- Regelbefunde (Host, Katalog ohne IO-02): 73 → 72, 0 Fehler.
- fitAdvisory über die drei Batches: coherence +0,05, scalability −0,25. Chebyshev-Distanz unverändert 4,00.
- GVE, Grounding offen, FLOW sichtbar: 22 Knoten · 97 Kanten → 21 · 94.
- Kongruenz (`graph_readiness`): RC-04 3 wie vorher, keine RC-01/02/03/05/06-Befunde, Importabdeckung 80/81 (`src/index.ts` ohne Modul).

## Bewusst offen

- R-31 `FUNC-serve-sse` ohne Ausgang: der Verbindungsaufbau (`openSse`) ist kein Datenfluss.
- `FUNC-import` liest laut Modell `formatE-artifact`, `importGraph` nimmt aber `OntologyJson` — nicht angefasst.
- `skill-report`, `install-result`, `formatE-artifact` (Schreibseite), `mutate-cmd`, `query-request`, `steering-trigger`: Kanäle mit mehreren Absendern, bleiben.
