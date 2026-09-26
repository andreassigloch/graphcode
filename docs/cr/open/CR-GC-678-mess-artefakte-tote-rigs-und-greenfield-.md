# CR-GC-678: Mess-Artefakte: tote Rigs und Greenfield-Altergebnisse löschen

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-591 (finding)
**Erstellt:** 2026-09-26
**Item:** bok/items/ITEM-2026-591.json (Lane: code)

---

## Befund

Rig-Verzeichnisse ohne Messung und Rohdaten zurückgezogener Serien:
- `rig/plan-step/` (Leitlinie: „keine Messung, Kandidat zum Entfernen"), `rig/flow-cardinality/` (kein README, von Randbreiten abgedeckt), `rig/import-doc-live/` (ungetrackt, ausgewertet in CR-GC-337).
- `rig/greenfield-systemtest/results/`: Graphen, Audit-Logs und run.logs des Executor-Programms v2–v20 — Rankings zurückgezogen (T-E3).
- `rig/greenfield-systemtest/results-*.json` der Runden 7–16 und Opus-Einzelläufe: von keiner Auswertung mehr zitiert.

## Umfang

- Erledigt: 69 Dateien unter `results/` gelöscht; bleiben 4 Graphen, die Tests/Rigs lesen (`nd-similarity.test.ts`: haiku45, devstral-v14; `minimal-whitebox`: devstral-v9, opus5) + neues `results/README.md`.
- Erledigt: 15 Rundenergebnisse gelöscht; bleiben Runde 17–21 (Leitlinie §9.2/T-V3/T-E3/T-E9) und die `results-sigllm*`-Referenzen.
- Erledigt: `rig/plan-step`, `rig/flow-cardinality`, `rig/import-doc-live` entfernt. Vorher Audit-/Trajektorie-Logs und Ontologie-Schema committet (die Kuzu-Stores sind abgeleitet und gitignored); `rig/README.md` und Leitlinie §9.5 nachgezogen.
- Nachgezogen: Leitlinie T-F1, §8, §9.5 (Executor-Programm, Greenfield).

## Umfang laut `graph_impact`

Keine Graph-Bindung; `rig/plan-step` nur in den Beschreibungen von CR-GC-283/330 (historisch).

## Verifikation

`tests/nd-similarity.test.ts` grün (liest die verbliebenen Fixtures).
