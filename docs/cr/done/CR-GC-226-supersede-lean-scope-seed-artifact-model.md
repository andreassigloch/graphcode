# CR-GC-226 — Doku/Graph: `lean=no-artifacts` ablösen + Artefakt-Modell seeden

**Status:** Open (2026-06-28) · **Milestone:** `MS-6-adoption` · **Max Files:** 4
**Graph (SSOT):** seedet (gate-only) `REQ-artifact-scope-refined`, Milestone `MS-6-adoption`,
die Artefakt-`FUNC`/`REQ`, `CR-GC-226`; Re-Export `docs/views/`. Pointer, nicht autoritativ.
**Proposal:** [readiness-artifact-model.md §3](../../proposals/readiness-artifact-model.md)

## Problem (Why)

`src/readiness.ts`-Header + CR-GC-125 erklären `INCOSE-Scope = lean → der Graph ist das EINZIGE Artefakt, kein FMEA,
keine separaten Docs`. Nach dem Create/Render-Modell ist das falsch: **Renders** sind Projektionen (keine separaten
Deliverables), aber **Creations** (ConOps/FMEA/Assumption/Trade/Impl-Plan) sind reale, leichte Artefakte und
**Gate-Vorbedingung**.

## Decision

- `lean` neu definieren (readiness.ts-Header + Proposal §3): Graph = SSOT; Renders = deterministische Projektionen;
  Creations = Urteils-Inputs, Gate-Vorbedingung, im Artefakt-Tab getrackt. FMEA/Assumption „in scope, lightweight"
  (kein ASIL-D-Evidence — bleibt `full`, nicht graphcode).
- Milestone **`MS-6-adoption`** seeden; CR-GC-220..226 via `relation` zuordnen.
- ADR-001 Scope-Referenz (AD-8) als **Pointer** aktualisieren — kein neuer ADR (AD-3).
- `docs/views/` re-rendern.

## Akzeptanz

- Kein „lean = no artifacts / no FMEA"-Wording mehr; Scope-Definition konsistent über readiness.ts-Header + Proposal + ADR-Pointer.
- `MS-6-adoption` enthält CR-GC-220..226; Readiness rechnet es als Tier.
- `npm test` + `build` grün; Views re-rendered (byte-stabil).

## Dependencies

Schließt die Kette **CR-GC-220 … 225**.
