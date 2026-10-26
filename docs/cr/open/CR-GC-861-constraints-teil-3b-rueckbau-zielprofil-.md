# CR-GC-861: Constraints Teil 3b: Rueckbau Zielprofil-Vertrag — weights/values aus TargetProfileSchema, Loader ohne Zielkonflikte, graph_metrics ohne fit.target, Profildateien, Skill-Abschnitte 1/2/4 (Folge von CR-GC-853)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1088 (idea)
**Erstellt:** 2026-10-26
**Item:** bok/items/ITEM-2026-1088.json (Lane: code)

---

Teil 3 des Rückbaus aus CR-GC-853 (Schnitt dort). Voraussetzung: CR-GC-853 und CR-GC-862 sind geschlossen;
danach liest kein Verbraucher mehr Gewichte außer den Stellen hier.

## Ziel

Gewichte und Zielwerte fallen aus dem Vertrag. `.graphcode/target-profile.json` trägt nur noch die Themen
(`intentAnchors`); `graph_generate` liest sie wie bisher.

## Umfang (Dateien)

1. `src/loop/target-profile-contract.ts` — `TargetWeightsSchema`, `TargetValuesSchema` und die Felder
   `weights`, `values` entfallen
2. `src/loop/target-profile.ts` — Loader ohne Zielkonflikte (`CONFLICT_PAIRS`, `conflictWarnings`,
   `conflicts`), keine Re-Exporte der Gewichte
3. `src/projections/metrics.ts` — `fit.target` entfällt, `fit.metrics` bleibt
4. `tests/metrics.test.ts` — die Tests zu Zielmarke und Zielwerten (CR-GC-451/457) entfallen
5. `tests/target-profile.test.ts` — Schema nur mit Themen; eine Datei mit `weights` scheitert laut
6. `.claude/commands/se/target-profile.md` — Abschnitte 1 (Gewichte), 2 (Zielwerte), 4 (Zielkonflikte) fallen
7. `.graphcode/target-profile.json` — `weights` heraus (ebenso in bok und gc_test-graphview, je eigener
   Commit mit Pfadangabe)
8. `scripts/known-answer-set.mjs` — liest die Gewichte nicht mehr aus der Profildatei; die Gewichte der
   Messung vom 2026-09-03 stehen fest im Skript, wie in `tests/arch.optimization-dry-run.spike.test.ts`
9. `tests/repository-style.spike.test.ts` — dasselbe
10. `tests/helpers/witness.ts` — eigener Typ statt `TargetWeights`

Modell: `SCHEMA-target-profile`, `FLOW-target-profile`, `FLOW-target-profile-file`, `FUNC-target-profile-load`
auf die Themen einschränken; `FLOW-target-profile -io-> FUNC-graph-metrics` löschen.

## Akzeptanzkriterien

- Kein Code, kein Skill und kein Test liest oder schreibt Gewichte oder Zielwerte der Profildatei.
- `.graphcode/target-profile.json` trägt nur noch Themen; `graph_generate` liest sie wie bisher.
- `graph_metrics` liefert kein `fit.target`.

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 926, Tiefe 1, Wurzeln: `SCHEMA-target-profile`, `FUNC-target-profile-load`, `FUNC-graph-metrics`._

Reichweite: 12 Elemente (FLOW 8, FUNC 4); Blackbox-Rand 8, nicht geoeffnet.

Dateien (realRef, 4):
- src/loop/target-profile-contract.ts
- src/loop/target-profile.ts
- src/projections/metrics.ts
- src/surface/host-shim.ts

Tests (`graph_tests`, 3):
- tests/mcp.suggest.test.ts
- tests/metrics.test.ts
- tests/target-profile.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
