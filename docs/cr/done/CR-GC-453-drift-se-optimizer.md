# CR-GC-453 — Drift: se-optimizer existiert nicht mehr

**Status:** done
**Abgeschlossen:** 2026-09-02
**Angelegt:** 2026-09-02

## Root Cause

`@sigloch/se-optimizer` ist seit dem Substrat-Umbau keine Dependency mehr; der Code importiert
`@sigloch/se-engine` (`src/projections/fit-advisory.ts`, `src/loop/suggest.ts`,
`src/projections/steering-snapshot.ts`, `src/projections/metrics.ts`). Die `realRef`-Bindungen wurden
mitgezogen (`packages/se-engine/src/metrics.ts`), die **Prosa nicht**. Fünf lebende Modellknoten
nennen weiter das tote Paket.

Schwerer wiegt: `REQ-advisory-roundtrip-latency` und `TEST-advisory-roundtrip-latency` führen einen
**Blocker, den es nicht gibt** — „Publish von se-optimizer 0.3.2 blockiert durch CR-SM-227". Damit
steht eine offene NFR auf einer Begründung, die niemand mehr auflösen kann.

## Messung statt Behauptung

`npx vitest run tests/perf.advisory-roundtrip.spike.test.ts` (2026-09-02):

| Graphgröße | Median gesamt | ms/Knoten |
|---|---|---|
| 500 Knoten (Kalibrierung) | 243,8 ms | 0,49 |
| **658 Knoten (live SSOT)** | **332,8 ms** | 0,51 |
| 2000 Knoten (fest) | 1937,7 ms | 0,97 |

Das 200-ms-Ziel wird verfehlt — aber **weil der Graph von 382 auf 658 Knoten gewachsen ist**, nicht
weil ein Publish aussteht. Bei der Größe, für die die NFR geschrieben wurde (382 Knoten), liegt die
Runde bei ~190 ms. Die NFR ist damit keine Regression, sondern eine Zielgröße ohne Größenbezug.

## Impact

Blockiert nichts im Betrieb. Bricht: jede Aussage über Herkunft und Blocker der Steering-Schleife,
und die Möglichkeit, die NFR jemals zu schließen.

## Umfang

5 Modellknoten (Prosa + ein `constraint`-Attribut). CR-GC-273/274 bleiben unverändert — eine
`done`-CR ist Historie, keine Zustandsaussage.

- `FUNC-arch-fitness` — Herkunft se-optimizer → se-engine
- `FUNC-graph-suggest` — Herkunft se-optimizer → se-engine
- `SCHEMA-metric-vector` — Herkunft se-optimizer → se-engine
- `REQ-advisory-roundtrip-latency` — toten Blocker durch die gemessene Größenabhängigkeit ersetzen
- `TEST-advisory-roundtrip-latency` — `constraint` + Prosa auf den gemessenen Stand

## Acceptance

- [x] `se-optimizer` nur noch in CR-GC-273/274 (Historie) und in der NFR, die das tote Paket
      ausdrücklich als gegenstandslos benennt
- [x] NFR nennt eine Größe, gegen die sie prüfbar ist
- [x] `npm run build` grün
- [x] Suite ohne neue Rote gegenüber der HEAD-Baseline (4c91b69: 10 Dateien / 16 Tests rot)
