# CR-GC-106: Interface-Schemas — `FLOW → SCHEMA` (Code-Readiness)

**Status:** Done · **Closed:** 2026-06-18 · **Datum:** 2026-06-17 · **Modul:** Modell (graph) · **Refs:** ADR-001, `@sigloch/contracts`
**Graph:** 9 `SCHEMA` + 28 `FLOW -relation→ SCHEMA` · **Max Files:** 5

## Problem (Why)
PDR-Readiness `schema = 0`: 28 FLOWs trugen nur Layer-1 (Semantik), kein Layer-2 (Datenformat). **Definition
of Ready fürs Coden:** ein Interface ist erst realisierbar, wenn sein **Datenvertrag (SCHEMA)** existiert —
sonst rät der Agent das Format. „Schema shall exist before code."

## Entscheidung
9 `SCHEMA`-Knoten, gemappt auf die realen **`@sigloch/contracts` Zod-Typen** (echte Referenten):
`mutate-command`, `mutate-result`, `ontology-graph`, `format-e`, `trajectory`, `update-event`,
`query-params`, `cli-command`, `markdown-view`. Jeder FLOW `-relation→` genau ein SCHEMA (3-Schichten-
Interface-Modell, Layer 2). Neue Constraint `REQ-interface-schema` (system-weit).

## Scope (Graph)
- `+SCHEMA-*` (9), `FLOW -relation→ SCHEMA` (28, alle Interfaces abgedeckt).
- `+REQ-interface-schema` (SYS→compose) + `TEST-interface-schema` (verify).
- Schließt Readiness-Dimension `schema`; Datenverträge = Code-Precondition (DoR, → CR-GC-107).

## Akzeptanzkriterien
- Jeder FLOW hat `relation→ SCHEMA`; Readiness `schema`-Dimension > 0.
- Ontologie-konform (`FLOW→relation→SCHEMA` ∈ TRACE_PATTERNS); keine dangling/invalid; `seed-graph.mjs` HTTP 200.

## Dependencies
Speist CR-GC-107 (Test-Konzept / Verification-Readiness). Verträge final wenn D1 (Harness-Schemas → contracts) erledigt.
