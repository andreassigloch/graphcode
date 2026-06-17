# CR-GC-100: Harness Core — Apply-Gate auf Kuzu

**Status:** Done (2026-06-17) · **Modul:** `src/harness.ts` (Graph: `MOD-harness`)
**Refs:** ADR-001 §3 (Bracket: one-gate/Kuzu), §6 · bok `graphcode-governance.md` §2–3, `2yR-35-store-spec.md`
**Graph:** `CR-GC-100 -relation→ MOD-harness` (+ REQs unten) · **Max Files:** 5

## Problem (Why)
Der Apply-Gate ist der Kern: jede Edit (Mensch *oder* KI) MUSS durch dasselbe `mutate()` (L1). Heute Stub —
graphcode läuft auf dem Vorgänger (`src/graph-server.js`, Express+JSON), der die verriegelten Constraints
(Kuzu, Disk-Persistenz, V3_RULES) **verletzt**. Ohne lauffähiges Gate auf Kuzu ist keine Realisierung real.

## Entscheidung
Gate-Ablauf = `FCHAIN-apply-gate` (pre-commit → apply → `evaluateRules(V3_RULES)` → saveGraph → post-apply → emit).
Single Kuzu-Owner (bok 2yR-35). Harness-Schemas nach `@sigloch/contracts` (D1). Kein lokaler Rule-Parser (L2).

## Scope (realisiert vorhandene Graph-Knoten — nicht hier neu auflisten)
FUNC: `FUNC-mutate`, `FUNC-evaluate-rules`, `FUNC-save-graph`, `FUNC-emit-trajectory` (→ `MOD-harness`).
REQ: `REQ-buildable-standalone` (D5-Blocker, **Task 0**), `REQ-harness-schema-in-contracts` (D1),
`REQ-one-gate-per-repo`, `REQ-rule-enforcement`, `REQ-confidence-tier`, `REQ-single-kuzu-owner`,
`REQ-disk-persistence`, `REQ-import-se-ontology`.

## Akzeptanzkriterien (Graph: TEST-Knoten)
`TEST-mutate-gate` grün (applied + Violations + block bei error-Severity) · `tsc`+`npm test` grün ·
Disk-Kuzu (kein `:memory:`) · D1 erledigt (grep: keine lokalen Schema-Defs in `harness.ts`).

## Dependencies
CR-195b (KuzuAdapter ✓). **Blocker:** `REQ-buildable-standalone` (D5) zuerst lösen.
