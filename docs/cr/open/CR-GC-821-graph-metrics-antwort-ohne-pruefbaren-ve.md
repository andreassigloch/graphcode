# CR-GC-821: graph_metrics-Antwort ohne pruefbaren Vertrag

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-972 (finding)
**Erstellt:** 2026-10-20
**Item:** bok/items/ITEM-2026-972.json (Lane: code)

---

## Befund

`FLOW-metrics-answer` (die Antwort von `graph_metrics` an Ablaufsteuerung und Dashboard) trägt nur
`SCHEMA-chain-metrics`, obwohl die Antwort auch modules, functions, riskCarriers, scope, policy und fit
enthält. In CR-GC-817 scheiterte ein eigenes `SCHEMA-metrics-answer`: der Rückgabetyp steht nur inline als
TS-Typ am Werkzeug (`src/projections/metrics.ts:103`), RC-08 verlangt für einen lokal gebundenen Vertrag ein
Zod-Schema.

Die Item-Prämisse „contracts braucht Zod-Schemas" stimmt nicht: contracts exportiert `ModuleMetrics`,
`FunctionCriticality`, `ChainMetrics`, `RiskCarriers`, `RequirementScope` bereits als Zod-Werte (gleichnamig
mit dem Typ, ohne Suffix `Schema`); `MetricPolicySchema` (contracts), `MetricVector` (se-engine),
`TargetWeightsSchema`/`TargetValuesSchema` (lokal) ebenso. Kein contracts-Bump nötig.

## Änderung

- `src/projections/metrics.ts`: `GraphMetricsAnswerSchema` aus diesen Schemas zusammengesetzt (nicht
  nachgebaut); der Werkzeugtyp ist `z.infer` davon, der Handler parst seine Antwort vor der Rückgabe
  (Muster `AuditStatsSchema`).
- `src/kernel/config.ts`: `PolicySource` als `PolicySourceSchema` (Zod), Typ abgeleitet — sonst stünde das
  Literal zweimal.
- Modell: `SCHEMA-metrics-answer` gebunden an `GraphMetricsAnswerSchema`, `FLOW-metrics-answer` trägt es
  statt `SCHEMA-chain-metrics`; `TEST-graph-metrics -verify-> SCHEMA-metrics-answer`; offene Differenz
  „Vertrag nur chain-metrics" aus der Flussbeschreibung gestrichen.
- Test: die Antwort von `graph_metrics` besteht das Schema; eine Antwort ohne `modules` wird abgelehnt.
