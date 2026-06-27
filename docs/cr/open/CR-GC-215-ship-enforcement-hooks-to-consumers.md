# CR-GC-215: Enforcement-Hooks in Consumer-Repos shippen

**Status:** Open — **deferred** (implementieren nach Analyse/Benchmark; User-Entscheidung 2026-06-27) · **Milestone:** `MS-6-adoption` · **Max Files:** 5
**Graph (SSOT):** zu seeden (gate-only) `REQ-ship-enforcement-hooks`, `FUNC-scaffold-hooks` (→ `src/scaffold.ts`), `TEST-scaffold-hooks` (→ `tests/scaffold.test.ts`), `CR-GC-215`; unter `MS-6-adoption`.

## Problem (Why)

`src/scaffold.ts` hat das `.claude/hooks`-Shipping **retired** (Kommentar `src/scaffold.ts:7`). Folge: die drei Enforcement-Hooks — `deny-graph-write.sh` (CR-GC-201, gate-only-writes), `deny-binary-source.sh` (CR-GC-205), `deny-stale-prose-read.sh` (CR-GC-214, graph-first-read) — leben **nur** in graphcodes eigenem Repo. Ein gescaffoldeter Consumer (graphify) bekommt **keine** Erzwingung → genau in den Repos, die sie brauchen, ist „enforce, don't document" wirkungslos. Im Rig (`rig/dummy-slicer`) sind die Hooks nur manuell hineinkopiert.

## Decision

Die drei Deny-Hooks als Templates **bei `graphcode init`/`update` ins Ziel-Repo shippen** + in dessen `.claude/settings.json` registrieren (PreToolUse: `Edit|Write|MultiEdit` → write/binary-Hooks, `Read` → stale-prose-Hook). Settings-Merge statt Overwrite (bestehende User-Hooks erhalten). Entweder Re-Add in `src/scaffold.ts` oder ein dedizierter `graphcode init --hooks`-Pfad — Entscheidung bei Pick-up.

## Akzeptanz

- `graphcode init` in einem frischen Repo legt `.claude/hooks/{deny-graph-write,deny-binary-source,deny-stale-prose-read}.sh` (chmod +x) an und registriert sie in `.claude/settings.json`.
- Im gescaffoldeten Repo: Write auf `docs/graph/*.graph.json` → denied; Read eines `status: INPUT-ONLY`-Docs → denied + Redirect auf `graph_context`.
- Bestehende `.claude/settings.json`-Hooks bleiben erhalten (Merge, keine Parallelpfade).
- `npm run build` + `npm test` grün.

## Out of scope (Follow-up)

- Versionierung/Update der Hooks bei `graphcode update` (Drift zwischen geshippter und Repo-Version) — separater CR, falls nötig.

## Dependencies

`src/scaffold.ts` · die drei Hook-Quellen unter `.claude/hooks/`. Folgt auf SPIKE-GC-context-sufficiency (Benchmark zuerst, dann Roll-out).
