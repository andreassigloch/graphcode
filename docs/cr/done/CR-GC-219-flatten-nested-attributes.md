# CR-GC-219 — Flatten the redundant nested `attributes` field

**Status:** open
**Created:** 2026-06-27
**Type:** refactor / model-hygiene
**Depends on:** —

## Root cause

`harness.importGraph` builds a node's attribute bag by spreading `...rest` of the element JSON
(`element = { id, type, name, description, ...rest }`). When a committed element *also* carries a
literal key named `attributes`, that key lands as `node.attributes.attributes` — a double-nesting
artifact. `exporter.nodeToElement` faithfully spreads it back, so the redundant field round-trips
through every `graph_export` and survives reseed.

It is **not** dead junk — it carries real, mis-placed metadata. Across the 305-element graph, 52
elements have a nested `attributes` field:

| nested keys | count | example element | likely intent |
|---|---|---|---|
| `{}` (empty) | 9 | `CR-GC-100` | drop — no data |
| `operatingMode` | 5 | `FUNC-export-markdown` | ConOps op-mode (declared ontology prop) → flatten |
| `zodDefinition` | 9 | `SCHEMA-cli-command` | schema body → flatten or drop if unused |
| `level` / `tool` | 29 / 29 | `TEST-docs-taxonomy` | verification method — **check vs `testRef.level`/`testRef.tool`** (likely redundant) |
| `constraint` | 27 | `TEST-bootstrap` | test constraint → flatten or drop if redundant |

Zero code in graphcode (or any `@sigloch/contracts` rule) reads `node.attributes.attributes.*` today.

## Impact

- **Cosmetic / confusing**, not functional: the SSOT JSON carries a redundant nesting level that no
  reader consumes. It inflates the committed graph and obscures whether `level`/`tool`/`constraint`
  are authoritative or stale duplicates of `testRef`.
- **Not a publish-blocker** — purely internal model hygiene.
- **Gate cannot fix it directly:** `update-node` merges attributes (shallow), so it can *overwrite*
  the `attributes` key but cannot *delete* it. A clean removal needs a code-level normalization, not
  a gate batch.

## Proposal

1. **Characterize first** (no deletion until classified): for each key class, decide redundant-vs-flat:
   - `level` / `tool`: compare to `testRef.level` / `testRef.tool` on the same TEST. If equal → drop
     (redundant restatement). If they ever differ → flatten to top-level and reconcile.
   - `operatingMode` / `zodDefinition` / `constraint`: flatten to a top-level attribute (keep the data,
     drop the nesting). `{}` → drop.
2. **Root-cause normalization** in `harness.importGraph`: when spreading `...rest`, if `rest.attributes`
   is a plain object, merge its contents up one level (flatten) instead of nesting, then discard the
   `attributes` key. One-time effect: next reseed + `graph_export` emits the flattened shape.
3. **Round-trip guard:** extend `tests/codec.roundtrip` / `graph-integrity` so the flattened export is
   byte-stable and no element re-grows a nested `attributes` key.
4. Reseed → `graph_export` → commit the normalized SSOT.

## Acceptance criteria

- [ ] No element in `docs/graph/graphcode.graph.json` has a nested `attributes` key after export.
- [ ] All meaningful metadata (operatingMode / zodDefinition / constraint, and any non-redundant
      level/tool) preserved as top-level attributes; `{}` and confirmed-redundant keys dropped.
- [ ] `graph-integrity` round-trip stays byte-identical post-migration; `rules_evaluate` shows no new
      violation; `npm test` green.
- [ ] Migration is one-time and idempotent (re-running import/export does not reintroduce nesting).

## Files (≤6)

- `src/harness.ts` — import normalization (flatten nested `attributes`)
- `src/exporter.ts` — assert no nested `attributes` re-emitted (if needed)
- `tests/codec.roundtrip.test.ts` / `tests/graph-integrity.test.ts` — round-trip guard
- `docs/graph/graphcode.graph.json` — regenerated SSOT (via `graph_export`, not hand-edited)

## Risk

`needs-care`. Touches the import/export round-trip, which the graph-integrity safety-net asserts
byte-for-byte. The `level`/`tool` redundancy check must be done per-TEST before dropping — do not
blanket-delete. Cosmetic payoff, so only land it with the round-trip guard green.
