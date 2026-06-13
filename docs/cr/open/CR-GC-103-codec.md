# CR-GC-103 — GraphCode Format-E Codec

**Status:** Open · **Modul:** `src/codec.ts` · **Prio:** 1a · **Stand:** 2026-06-13
**Dependency:** CR-195a (SE-Descriptor ✓) · **Spec:** `docs/SPEC.md` §2.4 · bok `2yR-36-codec-spec.md` · R3

## Ziel

`GraphCodeCodec`: `encode` / `decode` zwischen `OntologyGraph` und Format-E-JSON, Validierung
gegen SE-Ontologie. Baseline = aimproves Codec + `merge_nodes` (bok 2yR-36).

## Tasks

- `encode(graph)` / `decode(json)` auf Basis der `FormatECodec`-Baseline aus `@sigloch/graph-api-core`
  + `@sigloch/contracts` (kein paralleler Codec — L1).
- **R3 — Deterministische Serialisierung** (stabile Sortierung von Nodes/Edges/Keys) → commit- und
  merge-arm (speist CR-GC-102 R2).
- Validierung gegen `SE_DESCRIPTOR` (ElementType/TraceType/TRACE_PATTERNS).

## Gate (Acceptance)

- [ ] Round-Trip `decode(encode(g)) == g` (modulo Whitespace) — rasentraktor-Fixture (L3/Conformance).
- [ ] Serialisierung deterministisch: zwei Encodes desselben Graphen == byte-identisch.
- [ ] Ungültige Typen → Validierungsfehler (kein silent pass).

## Drift-Locks

L1 (Format-E-Parity = contracts-Baseline, ein Codec) · L3 (Round-Trip-Conformance in CI).
