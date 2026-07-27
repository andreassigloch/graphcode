# CR-GC-207: Graph-first-Onboarding-Kontrakt (GRAPHCODE.md + Materialisierung)

**Status:** Open (2026-06-25) · **Milestone:** `MS-6-adoption` (neu) · **Max Files:** 5
**Graph (SSOT):** seedet (gate-only) `REQ-graph-first-onboarding`, `FUNC-scaffold-graphcode-md` (→ `src/scaffold.ts`), `TEST-scaffold-graphcode-md` (→ `tests/scaffold.test.ts`), `CR-GC-207`; unter `MS-6-adoption`. Pointer, nicht autoritativ.

## Problem (Why)

Erste Realanwendung (graphify). Befund: **jede neue Claude-Code-Session liest alle Docs statt den Graph.** Root Cause, gemessen:

- `graphify/.mcp.json` hat den `graphcode`-Eintrag (MCP **war** da) — aber `.graphcode/kuzu` = 4 KB, `kuzu.wal` = 231 KB **uncommitted**, **kein** `*.graph.json` committed. Der Graph wurde beschrieben, aber **nie via `graph_export` materialisiert** → es gibt kein lesbares SSOT-Artefakt → der Agent fällt auf 107 Markdown-Dateien (636 KB) zurück.
- Nichts sagt einer frischen Session: *der Graph ist SSOT, query diese MCP-Tools zuerst, lies nicht alle Docs.* Subset-Queries existieren (`graph_elements` gefiltert, `graph_impact`, `graph_expand`) — der Agent kennt sie nicht und liest stattdessen `SPEC.md`.
- `SPEC.md` ist `INPUT-ONLY/obsolet`, dokumentiert aber den alten `Name.SY.001`-Dialekt — der reale Codec emittiert `uid.TYPE` (`MOD-harness.MOD|…`, `src/codec.ts:59`). Der Agent verwirrt sich am stale Dialekt.

## Decision

Ein **agent-facing Vertrag** als Datei im Ziel-Repo + Materialisierungs-Zwang:

- `templates/GRAPHCODE.md` (neu, ge­shippt): Ein-Screen-Kontrakt — (1) **Der Graph ist SSOT, nicht die Docs**; (2) Einstieg = MCP-Query, **kein** Doc-Ingest: `graph_readiness` → Status, `graph_elements {type}` → Slice, `graph_impact`/`graph_expand` → Blast-Radius (nie der ganze Graph); (3) **Format-E-Dialekt = `uid.TYPE`** (`SYS-x.SYS`), die `Name.SY.001`-Schreibweise in `SPEC.md` ist tot; (4) `SPEC.md` ist Bootstrap-Input, nicht lesen.
- `src/scaffold.ts`: `GRAPHCODE.md` beim `init` ins Ziel-Repo schreiben; nach erstem Seed `graph_export` ausführen/instruieren, damit `docs/graph/*.graph.json` als lesbares SSOT existiert (sonst hat eine 2. Session nichts zu lesen außer dem single-writer-Kuzu).
- `docs/SPEC.md` (graphcode-eigene + Template): Header-Zeile „**Dialekt hier (`Name.SY.001`) ist obsolet — kanonisch ist `uid.TYPE` (`src/codec.ts`)**", damit niemand die alte Syntax als Vertrag liest.

## Akzeptanz

- `init` legt `GRAPHCODE.md` im Ziel-Repo an; Test prüft Existenz + Pflicht­inhalte (Graph=SSOT, Query-first, `uid.TYPE`).
- `GRAPHCODE.md` nennt mind. `graph_readiness`, `graph_elements`, `graph_impact`, `graph_expand` als Einstiegs-Query-Pfad.
- `SPEC.md`-Header markiert den `Name.SY.001`-Dialekt explizit als obsolet.
- `npm run build` + `npm test` grün.

## Out of scope (Follow-up)

- Skill-Liste in `GRAPHCODE.md` + Sync gegen Drift → **CR-GC-208**.
- Erzwingen, dass `graph_export` vor Session-Ende lief (Hook) → optionaler Follow-up.

## Dependencies

`@sigloch/contracts/se` (Dialekt-Vokabular `ElementType`). Block für CR-GC-208 (erweitert `GRAPHCODE.md`).
