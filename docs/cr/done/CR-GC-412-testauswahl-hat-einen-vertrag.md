# CR-GC-412 — Die Testauswahl bekommt ihren Datenvertrag

**Status:** done — 2026-08-25 (graphVersion 194)
**Herkunft:** CR-GC-409 §A, Paket „Test-Selektion".
**Ziel:** R-31 für `FUNC-deduce-tests` und `FUNC-resolve-tests-from-code` schließen —
mit echten FLOW+SCHEMA-Verträgen, nicht mit einer erfundenen Kante.

## Befund

Beide FUNCs hängen an keiner einzigen `io`-Kante (R-31: „missing: input + output"),
obwohl `graph_tests` einen der meistgenutzten Lesepfade bedient. Der Grund ist
historisch: CR-GC-204 hat die Deduktion von `graph_impact` auf `harness.testImpact`
umgestellt, aber die Verdrahtung nie nachgezogen.

Zwei Datenübergaben sind real und heute unmodelliert:

1. `harness.testImpact()` → `impactedTests()` liefert den gerichteten Teilgraphen
   (`nodes`, `edges`, `anchors`, `testIds`) — der geht an `graph_tests`.
2. `graph_tests` liefert das selektive Laufkommando + Coverage an den Agenten.

Beide Übergaben laufen heute als nackte TS-Interfaces über die Modulgrenze, ohne
`parse()`. Deshalb braucht dieser CR nicht nur Modellknoten, sondern zwei reale
Zod-Symbole (sonst wäre R-31 gegen SC-04/RC-04 getauscht, kein Fortschritt).

## Umfang

**Code**
- `src/test-selection.ts`: `TestImpactResultSchema` (Vertrag von `impactedTests`)
  und `TestSelectionSchema` (Vertrag der `graph_tests`-Antwort) als Zod; der
  bisherige `interface TestImpactResult` wird daraus abgeleitet — kein Parallelpfad.
- `src/harness.ts`: `testImpact()` parst das Resolver-Ergebnis am Modulrand.
- `src/tools/report.ts`: `graph_tests` parst seine Antwort am Werkzeugrand.

**Modell (gate-only, `graph_mutate`)**
- `FLOW-impacted-tests` + `SCHEMA-impacted-tests` (realRef `TestImpactResultSchema`)
- `FLOW-test-selection` + `SCHEMA-test-selection` (realRef `TestSelectionSchema`)
- io: `FLOW-query-request → FUNC-deduce-tests`, `FLOW-query-request →
  FUNC-resolve-tests-from-code`, `FUNC-resolve-tests-from-code → FLOW-impacted-tests
  → FUNC-deduce-tests → FLOW-test-selection → ACTOR-claude-code`

`FLOW-query-request` als Eingang ist die bestehende Konvention dieses Graphen: der
Flow bedient schon `graph_impact` UND `listElements(filter)` mit
unterschiedlichen Formen; sein SCHEMA ist deshalb `concept:true`. Der Anschluss
hält außerdem `FUNC-graph-impact` mit den beiden neuen Gliedern in EINER
io-Komponente der `FCHAIN-impact-testing` — ohne ihn entstünde ein IO-01.

## Regel-Delta (gemessen)

| Regel | vorher | nachher |
|---|---|---|
| R-31 | 13 | 11 |
| Summe | 52 | 50 |

Kein neues R-21: das entstehende Kettenpaar `resolve-tests-from-code →
deduce-tests` teilt `FCHAIN-impact-testing`, und die trägt einen Integrationstest
(`TEST-mvp-e2e`, `TEST-selective-test-audit`).

## Abnahme

`tests/test-selection.audit.test.ts` prüft beide Verträge gegen echte Daten
(Snapshot auf Platte, keine Mocks): der Resolver-Output passiert
`TestImpactResultSchema`, die Werkzeugantwort passiert `TestSelectionSchema`.
