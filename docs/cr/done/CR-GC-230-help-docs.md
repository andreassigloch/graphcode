# CR-GC-230 — Help-Docs: README + GRAPHCODE.md Pointer auf se:help

**Status:** Open (2026-06-28) · **Milestone:** `MS-6-adoption` · **Max Files:** 3
**Graph (SSOT):** seedet (gate-only) `REQ-help-discoverable`, `FUNC-help-doc-pointer`
(→ `README.md` / `GRAPHCODE.md`-Scaffold), `CR-GC-230`; unter `MS-6-adoption`. Pointer, nicht autoritativ.
**Proposal:** [help-system.md §9, §10](../../proposals/help-system.md)

## Problem (Why)

Erklärungen sind heute verstreut (MCP-Tool-Descriptions, Code-Kommentare, `bok/`) — keine vom Item aus
erreichbare, zentrale Help. Ohne Pointer findet niemand `se:help` / `graph_help`.

## Decision

- **README.md**: eine „Help"-Zeile → `se:help` (kontextuell) + `se:help <token>` (Lookup) + `graph_help`-Tool.
- **GRAPHCODE.md-Scaffold** (init): die statische „graph-first"-Onboarding-Zeile (CR-GC-207) zeigt auf
  `se:help` als **Live-Entry** — statischer Vertrag bewirbt den dynamischen.
- Verstreute Einzel-Erklärungen, die `se:help` jetzt zentral liefert, werden verlinkt/supersedet
  (keine Doppel-Prosa, kein Parallelpfad).

## Akzeptanz

- README + GRAPHCODE.md-Scaffold nennen `se:help`/`graph_help`; `npx … update` schreibt den Pointer mit.
- Kein toter Verweis; `build` grün (Scaffold-Snapshot-Test, falls vorhanden, grün).

## Dependencies

**CR-GC-229** (`se:help` / `graph_help` existieren), **CR-GC-207** (GRAPHCODE.md-Onboarding-Vertrag).
