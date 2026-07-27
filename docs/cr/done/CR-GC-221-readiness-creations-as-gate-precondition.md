# CR-GC-221 — Readiness: Creations als Gate-Vorbedingung (Phase + Impl)

**Status:** Open (2026-06-28) · **Milestone:** `MS-6-adoption` · **Max Files:** 3
**Graph (SSOT):** seedet (gate-only) `REQ-creation-gate-precondition`, `FUNC-score-creations` (→ `src/readiness.ts`),
`TEST-readiness-creations` (→ `tests/readiness.test.ts`), `CR-GC-221`; unter `MS-6-adoption`. Pointer, nicht autoritativ.
**Proposal:** [readiness-artifact-model.md §4–§5](../../proposals/readiness-artifact-model.md)

## Problem (Why)

`computeReadiness` bewertet Gates **nur** aus V3_RULES. Ein Phase-Gate ist grün, sobald die Struktur regel-sauber ist —
**blind** dafür, ob die Urteils-Arbeit (ConOps, FMEA, Assumption-Review, Trade, Impl-Plan) je gemacht wurde
(„rule-green ≠ analysis-done"). Zudem **vacuous-green** bei Impl-Gates: nie durchgeführte FMEA → kein FMEA-CR →
kein Blocker → fälschlich `ready`.

## Decision

- `ReadinessGate` erhält `creationArtifacts: string[]` (die für das Gate geforderten Creations).
- Phase→Creation-Map: **SRR**→{conops, assumption-review}, **PDR**→{fmea, trade}, **CDR**→{implplan}, **TRR**→{} (Tests inline).
  `passed = rule-clean AND alle geforderten Creations 🟢-current`. Regel-Partitionen unverändert.
- `scoreImplGate`: blockt zusätzlich, wenn eine vom Milestone-Phase geforderte Creation **🔴 absent** ist
  (Anti-vacuous-green) — auch ohne repräsentierenden CR.
- Creation-Currency-Quelle = Artefakt-Klassifikator aus CR-GC-222; hier nur die **Schnittstelle** (Provider-Funktion,
  Default 🔴) definieren — kein Doppel-Implementieren.

## Akzeptanz

- Regel-sauberer Graph **ohne** FMEA → PDR-Gate `passed=false`, `blocking` enthält „FMEA not performed (PDR creation)".
- Impl-Gate mit fehlender Pflicht-Creation → nicht `ready`, auch wenn alle CRs `done`.
- `TEST-readiness-model` erweitert; deterministische Unit-Fälle; `npm test` + `build` grün.

## Dependencies

Schnittstelle zu **CR-GC-222** (liefert die Creation-Currency). Reihenfolge: 221 definiert die Signatur, 222 den Provider.
