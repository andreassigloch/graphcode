# CR-GC-125: Readiness-Modell definieren & realisieren (Phase/Impl/INCOSE)

**Status:** Open · **Milestone:** `MS-4-mvp2` · **Datum:** 2026-06-17 · **Max Files:** 5
**Graph (SSOT):** realisiert `REQ-readiness-model`, `MOD-dashboard`. Spec lebt im Graphen.

## Problem / Scope
Phase-Readiness (SRR/PDR/CDR/TRR), Implementation-Readiness-Gates (SAR/FCA/SVR/FRR) und INCOSE-Artifacts sind für graphcode **noch nicht klar definiert** — heute aus aimprove geerbt (BQ-Heuristik). Definieren gegen `@sigloch/contracts` V3_RULES + die MS-Meilensteine + Element-Status; dann als Scorer/Views realisieren. Subsumiert die offene Frage INCOSE-Scope (voll vs. lean). **Voraussetzung für CR-110/115/116.**

## Akzeptanz
Definition als Konzept + REQ/SCHEMA im Graphen; Scorer liefert die Gates aus V3_RULES/MS; keine BQ-Heuristik.

## Dependencies
CR-GC-107 (V3_RULES-Scorer). Gate für CR-110/115/116.
