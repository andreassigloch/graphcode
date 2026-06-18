# CR-GC-125: Readiness-Modell definieren & realisieren (Phase/Impl/INCOSE)

**Status:** Done · **Milestone:** `MS-4-mvp2` · **Datum:** 2026-06-17 · **Abgeschlossen:** 2026-06-18 · **Max Files:** 5
**Graph (SSOT):** realisiert `REQ-readiness-model`, `MOD-dashboard`. Spec lebt im Graphen.

> **Done (2026-06-18):** Modell definiert + im Graphen verankert (REQ-readiness-model `done`,
> TEST-readiness-model, Scorer-Realisierung über MOD-mcp-tools/`graph_readiness`). INCOSE-Scope = **lean**;
> Phase-Gates SRR/PDR/CDR/TRR = disjunkte+vollständige Partition der 15 Element-V3_RULES; Impl-Gates
> SAR/FCA/SVR/FRR aus MS-1..4 + CR-Status (MS-01/MS-02). Realisiert in `src/readiness.ts`
> (`computeReadiness`/`scoreReadiness`), exponiert über `graph_readiness`; `tests/readiness.model.test.ts`
> (11 Tests) beweist Partition-Exhaustivität + Gate-Ableitung + „nie BQ". Keine BQ-Heuristik.

## Problem / Scope
Phase-Readiness (SRR/PDR/CDR/TRR), Implementation-Readiness-Gates (SAR/FCA/SVR/FRR) und INCOSE-Artifacts sind für graphcode **noch nicht klar definiert** — heute aus aimprove geerbt (BQ-Heuristik). Definieren gegen `@sigloch/contracts` V3_RULES + die MS-Meilensteine + Element-Status; dann als Scorer/Views realisieren. Subsumiert die offene Frage INCOSE-Scope (voll vs. lean). **Voraussetzung für CR-110/115/116.**

## Akzeptanz
Definition als Konzept + REQ/SCHEMA im Graphen; Scorer liefert die Gates aus V3_RULES/MS; keine BQ-Heuristik.

## Dependencies
CR-GC-107 (V3_RULES-Scorer). Gate für CR-110/115/116.
