# GraphCode — Internal Readiness Review (IRR)

**Gate:** M1 Spezifikation → M2 Coding & V&V · **Datum:** 2026-06-17 · **Reviewer:** andreas@siglochconsulting + Claude
**Verdict: GO für M2** — Einstieg CR-GC-100 (Opus), mit F2/F3 als Task 0/1.

> IRR = Abschluss-Gate von **MS-1-specification**. Quelle: `docs/graph/graphcode.graph.json` (196 Elemente / 352 Traces).

## 1. Spezifikations-Readiness (MS-1)

| Check | Status |
|---|---|
| CRs folgen der Architektur (100-103 → MOD + REQ + FUNC, in den Graph zeigend) | ✅ |
| Interfaces als Datenverträge (28 FLOW→SCHEMA, zodDefinition; `schema`-Dim 0.75) | ✅ |
| High-Level UC-Acceptance-Tests definiert (CVE, 4/4) | ✅ |
| Definition of Ready im Modell (schema-before-code, UC-test-before-test) | ✅ |
| Architektur-Dimension / Overall | arch **0.99** · overall **~0.82** |
| Jeder UC ≥1 FCHAIN; Eskalationsprozess für Interface-Änderungen | ✅ |

**Fazit M1:** Spezifikation vollständig und agent-tauglich — bis auf die Build-Voraussetzungen (siehe F2/F3).

## 2. Build-De-Risk (D5)

- **D5 entschieden + verdrahtet:** graphcode = **Standalone-App**, konsumiert `@sigloch/*` als Dependency
  (`file:../sigloch-modules/packages/*` für Dev, versioniert beim Publish). **Kein** workspace:*-Member.
  Publish von graphcode ⇒ nur die *konsumierten* Pakete publishen, nicht ganz sigloch-modules.
- **`npm install` ✅** (132 Pakete) — `@sigloch/contracts` (v0.2.0, dist gebaut, `/se`) + `@sigloch/graph-api-core` (dist gebaut) auflösbar.
- **`tsc` ⚠️** — Fehler sind **gescoptes CR-100, keine Blocker.**

## 3. Findings

| # | Finding | Schwere | Owner |
|---|---|---|---|
| **F1** | D5 Dep-Strategie | RESOLVED | wired (package.json file:) |
| **F2** | tsconfig zieht Dep-*Source* (TS6059 rootDir) → `skipLibCheck`/Resolution; Harness-Stub ruft nicht-existente `StorageAdapter`-APIs (`saveGraph`/`close`) | CR-GC-100 Task 0 | M2 |
| **F3** | D1: `/harness`-Export (`MutateCommand`/`MutateResult`/`HarnessConfig`) fehlt in `@sigloch/contracts` (cross-repo) | CR-GC-100 Task 1 | M2 |
| **F4** | Host/Dashboard: aimprove-Vorgänger — Import-Body-Limit zu klein (HTTP 500 @ 132K) **und** Readiness misst mit Fremd-Regeln (155 BQ, rules 2.0.0) | host | CR-GC-107 |
| **F5** | Keine Realisierungs-CR für `MOD-cli` (npx) + Exporter (`FUNC-export-markdown`) | gap | M2 (später) |
| **F6** | Granulare REQ-Verifikation (`ver` 0.6, 25/86) | TRR | M2 |

## 4. Milestones

- **MS-1-specification** — durch dieses IRR **abgeschlossen**.
- **MS-2-coding-vv** — **offen**; hängt von MS-1 ab. Scope: CR-GC-100..103 (Realisierung) + 107 (Host) + V&V (Tests, Benchmark).

## 5. Go/No-Go → **GO**

Einstieg **CR-GC-100** (Opus): Task 0 = F2 (tsconfig + Stub↔graph-api-core-API), Task 1 = F3 (D1 in contracts).
Danach CR-GC-101..103 (Sonnet). `reduced-llm` per `REQ-benchmark-harness` messen, sobald Harness läuft.

---
**Artefakte:** `package.json` (file:-Deps), `package-lock.json`, MS-1/MS-2 im Graph · **Renderer:** `.claude/skills/se-review.md` (irr-View).
