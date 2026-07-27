# CR-GC-103: Format-E Codec — deterministisch, commit-/merge-arm

**Status:** Done (2026-06-17) · **Modul:** `src/codec.ts` (Graph: `MOD-codec`)
**Refs:** ADR-001 §3 (Codec-Baseline) · bok `2yR-36-codec-spec.md` · `@sigloch/graph-api-core` (FormatECodec)
**Graph:** `CR-GC-103 -relation→ MOD-codec` (+ REQs unten) · **Dependency:** CR-195a (SE-Descriptor ✓) · **Max Files:** 5

## Problem (Why)
Der governte Graph muss als **commit-fähiges, merge-armes** Artefakt serialisierbar sein (`docs/graph/*.json`):
nur mit **deterministischer** Serialisierung sind git-Diffs/Merges conflict-free (`UC-graph-merge`), und nur mit
Validierung gegen `SE_DESCRIPTOR` bleibt der Graph ontologie-konform. Ein paralleler Codec bräche L1.

## Entscheidung
Baseline = aimprove-Codec + `merge_nodes` (bok 2yR-36); **genau EIN Codec** (Parity = contracts, L1).
Stabile Sortierung von Nodes/Edges/Keys → zwei Encodes byte-identisch. Diff-Dialekt (+/-/~/M) mit
`<operations><base_snapshot>ID@version`; implicit-add **verwerfen** (Gate muss laut scheitern).

## Scope (realisiert vorhandene Graph-Knoten)
FUNC: `FUNC-encode`, `FUNC-decode` (→ `MOD-codec`); Round-Trip = `FCHAIN-codec-roundtrip`.
REQ: `REQ-deterministic-serialization`, `REQ-roundtrip-conformance`, `REQ-formatE-diff-dialect`,
`REQ-codec-validation`, `REQ-formatE-parity`.

## Akzeptanzkriterien (Graph: TEST-Knoten)
`TEST-roundtrip` grün (`decode(encode(g))==g`, rasentraktor-Fixture, L3; zwei Encodes byte-identisch) ·
ungültige Typen → Validierungsfehler (kein silent pass).

## Dependencies
CR-195a (SE-Descriptor ✓). Speist CR-GC-102 (R2 Merge).
