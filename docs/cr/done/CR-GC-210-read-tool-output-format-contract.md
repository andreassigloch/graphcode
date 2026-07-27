# CR-GC-210: Read-Tool-Output-Format-Kontrakt (JSON vs Format-E)

**Status:** Open (2026-06-25) · **Milestone:** `MS-5-efficiency` · **Max Files:** 3
**Graph (SSOT):** seedet (gate-only) `REQ-read-format-contract`, `FUNC-read-format-param` (→ `src/mcp-tools.ts`), `TEST-read-format-param` (→ `tests/mcp-tools.test.ts`), `CR-GC-210`; unter `MS-5-efficiency`. Pointer, nicht autoritativ.

## Problem (Why)

Erste Realanwendung. Befund: *„warum liefert `graph_get_edges` JSON und nicht Format-E?"*

- Inkonsistenz **by design, aber undokumentiert**: CRUDL-Read-Tools (`graph_elements`, `graph_get_node`, `graph_get_edges`) → **JSON**; nur Slice-Tools (`graph_impact`, `graph_expand`) → **Format-E** (`codec.serialize`, `src/mcp-tools.ts:343/370`). `graph_export` → JSON-Meta.
- Der Agent erwartet nach `graph_impact` (Format-E) bei `graph_get_edges` dieselbe Form und stolpert. Es gibt keinen dokumentierten Kontrakt, der sagt *welches Tool welche Form liefert und warum*.

## Decision

Kein Format-Flip (JSON bleibt default für programmatische Konsumtion), sondern **expliziter Kontrakt + Opt-in**:

- `src/mcp-tools.ts`: optionaler Input `format: z.enum(['json','formatE']).default('json')` auf `graph_get_edges` und `graph_elements`. Bei `'formatE'` → `codec.serialize` des Slices (gleicher `uid.TYPE`-Dialekt wie `graph_impact`).
- Tool-`description` beider Read-Tools dokumentiert den Kontrakt explizit: *„default JSON für Agent-Logik; `format:'formatE'` für menschlich lesbaren/round-trip-fähigen Slice. Slice-Tools (`impact`/`expand`) sind immer Format-E."*

## Akzeptanz

- `graph_get_edges`/`graph_elements` mit `format:'formatE'` liefern gültiges Format-E (parsebar durch denselben Codec, round-trip-stabil).
- Default-Verhalten (ohne `format`) unverändert JSON — keine Breaking Change für bestehende Skills.
- Tool-Descriptions nennen den Kontrakt.
- Test: beide Tools, beide Formate; `formatE`-Output durch `codec.parse` re-importierbar.
- `npm run build` + `npm test` grün.

## Out of scope (Follow-up)

`graph_get_node` (Einzelknoten) bekommt kein `format` — ein Knoten ohne Kanten ist als Format-E-Fragment wenig nützlich; bei Bedarf separater CR.

## Dependencies

`src/codec.ts` (`serialize`/`parse`). Unabhängig von 207–209.
