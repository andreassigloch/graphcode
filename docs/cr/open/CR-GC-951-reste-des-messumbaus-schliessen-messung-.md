# CR-GC-951: Reste des Messumbaus schliessen: messung ohne lokales Protokoll, Codebeleg an FLOW-graph-state, Verbraucher von FLOW-verlauf-report, Leitlinie Abschnitt 9

**Typ:** aus Item ITEM-2026-1380 (finding)
**Erstellt:** 2026-11-15
**Item:** bok/items/ITEM-2026-1380.json (Lane: code)

---

## Befund

Nach dem Umbau der Messung (CR-GC-943 bis CR-GC-950) blieben vier Reste:

1. `npm run messung` bricht ab, wenn `.graphcode/cr-messung.jsonl` fehlt. Die Datei ist lokal und nicht
   versioniert. Das Skript `version` ruft `npm run messung`; auf einem frischen Klon bricht damit der Release.
2. `FLOW-graph-state` trägt seit CR-GC-946 den Verweis `harness.ts#evaluateRules`. Das ist die Übergabe der
   Regelbefunde, nicht die des Graphen. Den Graphen übergibt `harness.ts#getGraph`.
3. `FLOW-verlauf-report` hat keinen Verbraucher (R-10). Im Code nimmt `graph_readiness` den Verlauf entgegen
   (`src/projections/report.ts` ruft `verlaufFuerRepo`).
4. Die Leitlinie trägt den Diff aus CR-GC-948 noch nicht, und §9.4 nennt T-V1, T-O4 und T-O6 als S1-Tests,
   obwohl `npm run messung` sie nicht führt.

## Zielbild

1. Fehlt das Protokoll oder ist es leer, schreibt die Zeile T-E1 „nicht gemessen" mit Grund (FAQ
   `nicht-gemessen-sichtbar`). Der Lauf bricht nicht ab.
2. `FLOW-graph-state` verweist auf `harness.ts#getGraph`. `FLOW-rule-findings` behält `evaluateRules`.
3. `FLOW-verlauf-report` führt per io zu `FUNC-graph-readiness`.
4. Leitlinie, vom Autor am 2026-11-15 freigegeben: Spalte „Stand" in §9.3 und §9.5 entfallen, T-M3 trägt das
   neue Kriterium, die S1-Zeile nennt genau die acht Tests, die `npm run messung` führt. Die Liste
   `ENTFALLEN` in `scripts/messung.mjs` entfällt damit.

## Abnahme

- [ ] Test „Nr 12: ohne das lokale Protokoll …" in `tests/messung.test.ts` rot gesehen, dann grün.
- [ ] `tests/messung.test.ts` vergleicht S1 ohne Ausnahmeliste mit der Leitlinie §9.4.
- [ ] `rules_get_violations` meldet R-10 nicht mehr.
- [ ] `npm run verify:full CR-GC-951` grün.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

keine — der CR wendet die FAQ `nicht-gemessen-sichtbar` und `fluss-nur-mit-codebeleg` an.

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1229, Tiefe 1, Wurzeln: `FUNC-stand-verlauf`, `MOD-dev-scripts`._

Reichweite: 6 Elemente (FLOW 1, FUNC 5); Blackbox-Rand 8, nicht geoeffnet.

Dateien (realRef, 5):
- scripts/commit-pruefung.mjs
- scripts/verify-code.mjs
- scripts/verify-full.mjs
- scripts/verify-model.mjs
- src/projections/verlauf.ts

Tests (`graph_tests`, 9):
- tests/aenderungsmeldung.test.ts
- tests/cli.scaffold.test.ts
- tests/commit-pruefung.test.ts
- tests/constraint-ein-schreibweg.test.ts
- tests/knowledge-binding.test.ts
- tests/test-schlupf.test.ts
- tests/test-selection.audit.test.ts
- tests/verify-model.completeness.test.ts
- tests/verlauf.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
