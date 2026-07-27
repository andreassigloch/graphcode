# CR-GC-107: Dashboard/Readiness auf SE-Ontologie adoptieren (NEXT)

**Status:** Done (2026-06-17) · **Modul:** `src/harness.ts` (`MOD-harness`) + Host/Dashboard
**Refs:** ADR-001 §3 (SE-Ontologie + V3_RULES aus contracts), Readiness-Analyse 2026-06-17 · **Max Files:** 5

## Problem (Why)
Das Readiness/Scoring im Dashboard läuft auf dem **aimprove-Vorgänger** (rules **2.0.0**, INCOSE-style BQ-Regeln).
**155 BQ-Warnungen** (BQ-06 „System shall…", BQ-02 „measurable") flaggen unsere *beschreibenden* REQs gegen
eine **fremde Regelbasis** — nicht gegen `@sigloch/contracts` V3_RULES. Folge: Readiness ist teils
fremd-gemessen, die Compliance-Dimension verzerrt, Phase-Score irreführend.

## Entscheidung
Dashboard/Readiness-Scorer MUSS gegen **`@sigloch/contracts` Ontologie + V3_RULES** evaluieren (via
`harness.evaluateRules`, L2 — kein lokaler/fremder Rule-Parser). Vorgänger-BQ-Regeln entfallen oder werden
auf V3_RULES gemappt. Erst dann misst „Architektur-Readiness" echte Familie-Compliance.

## Scope (Graph)
- `+REQ-dashboard-ontology-sync` (UC-live-graph-view →compose) + `TEST-dashboard-ontology-sync` (verify).
- Realisierung (Host): Scorer → `harness.evaluateRules(V3_RULES)`; Readiness-Dimensionen gegen contracts.

## Akzeptanzkriterien
- Readiness/Violations stammen aus `@sigloch/contracts` V3_RULES (Rule-IDs == contracts), nicht BQ-2.0.0.
- Keine BQ-06/BQ-02-Warnungen mehr gegen valide Familie-REQs; Phase-Score spiegelt echte Compliance.

## Dependencies
CR-GC-100 (harness.evaluateRules lauffähig). Erklärt die heutigen 155 BQ-Warnungen.
