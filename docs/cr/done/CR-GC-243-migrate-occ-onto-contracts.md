# CR-GC-243: Migrate local OCC (`BaseVersionSchema`) onto `@sigloch/contracts` (CR-199/CR-200)

**Status:** Implemented (2026-07-08) · **Milestone:** `MS-7-concurrency` · **Max Files:** 4
**Renumber:** war doppelt als `CR-GC-241` vergeben (parallel zum host-shim-Export-CR) — auf `243`
umnummeriert; der host-shim-Export-CR behält `241` (bereits committet, nach `done/` verschoben).
**Kontext:** Family-Review-Ergebnis aus sigloch-modules (Smeagol-Dry-Run, Session 2026-07-07). Vorgänger:
`CR-GC-233` (dieses Repo, 2026-07-02 — die lokale OCC-Implementierung, die jetzt promoted wird).

## Problem (Why)

`CR-GC-233` hat OCC (`graphVersion`/`baseVersion`, Stale-Reject + Delta) bewusst **ohne Contracts-Bump**
gebaut — lokale `BaseVersionSchema`/Felder in `mcp-tools.ts`, mit der Notiz *„Promotion nach
@sigloch/contracts = späterer Family-Review."* Dieser Family-Review ist jetzt passiert: sigloch-modules
`CR-199`+`CR-200` haben graphcodes Form **übernommen** (nicht umgekehrt) und als `GraphVersionSchema` /
`MutateOptionsSchema` / `MutateResultSchema.{stale,staleDelta}` / `StaleDeltaEntrySchema` in
`@sigloch/contracts@0.7.0` gelandet — additiv, `changedUids` bleibt als Convenience-Feld neben den neuen
`entries` (ein Eintrag pro appliziertem Batch, statt nur der flachen UID-Projektion).

Ohne diese Migration existieren zwei Formen parallel: graphcodes lokale `BaseVersionSchema` (Quelle der
Wahrheit bis heute) und die jetzt promotete Contracts-Form — genau der Parallelpfad, den CR-GC-205
("enforce-don't-document") für Code verbietet, hier nur unentdeckt, weil er eine Repo-Grenze querte.

## Decision

1. **Dependency:** `@sigloch/contracts` in graphcode auf `^0.7.0` heben.
2. **`src/mcp-tools.ts`:** lokale `BaseVersionSchema` entfernen; `baseVersion`/`graphVersion`-Felder auf
   `GraphVersionSchema`/`MutateOptionsSchema` aus `@sigloch/contracts/harness` umstellen. Stale-Reject-Pfad
   liefert `MutateResultSchema`-konforme `stale`/`staleDelta` (statt des bisherigen Ad-hoc-Shapes).
3. **`src/audit-file.ts`:** `query()`/`latestVersion()` bleiben intern unverändert (Datei-Format ist
   graphcode-lokal, kein Contracts-Konzept) — nur die **Grenze** zum MCP-Tool-Result muss die Audit-Einträge
   in `StaleDeltaEntrySchema`-Form (`{ graphVersion, ts, changedUids }`) mappen statt im bisherigen Shape.
4. **Kein Verhaltens-Change:** `baseVersion` bleibt optional/soft-warn wie in CR-GC-233 entschieden (Pflicht
   bleibt CR-235-Scope) — diese CR ist reine Schema-Migration, keine Semantik-Änderung.

## Akzeptanz

- [x] `grep -rn "BaseVersionSchema" src/` → keine Treffer mehr (kein Parallelpfad; ersetzt durch
      `GraphVersionSchema.optional()` aus `@sigloch/contracts/harness`).
- [x] `graph_mutate`-Stale-Response parst gegen `@sigloch/contracts` `MutateResultSchema`
      (`mcp.occ.test.ts`: `MutateResultSchema.safeParse(stale).success === true` + `stale`/`staleDelta`-Asserts).
- [x] `graph_mutate`-Erfolgs-Response trägt `graphVersion` weiterhin wie bisher (Read-Seite unverändert).
- [x] `npm run build` + `npm test` grün (270/270).

## Umsetzung (Ist)

- **`@sigloch/contracts`** ist `file:`-Dep und bereits auf `0.7.0` — kein Version-Bump in `package.json` nötig.
- **`src/mcp-tools.ts`:** lokale `BaseVersionSchema` entfernt → `baseVersionField = GraphVersionSchema.optional()`.
  `occReject()` liefert jetzt `MutateResult` mit `stale: true` + `staleDelta` (`StaleDeltaSchema`-Form:
  `sinceVersion`/`currentVersion`/`entries`/`changedUids`); Ad-hoc-`occ`-Shape entfernt (aus `graph_mutate`
  + `graph_realize` Return-Typen). Neuer Boundary-Helper `batchUids()` projiziert die Audit-Command-Batches
  in `StaleDeltaEntry.changedUids`.
- **`src/audit-file.ts`:** unverändert — das Mapping in `StaleDeltaEntry`-Form passiert an der Grenze in
  `mcp-tools.ts`, nicht im Datei-Format.
- **Tests:** `mcp.occ.test.ts` + `host-shim.test.ts` auf `staleDelta.entries`/`.changedUids` umgestellt.

## Nicht in diesem CR

`baseVersion` als Pflichtfeld (CR-235), Per-Node-Versionen (aus CR-GC-233 bereits ausgeschlossen),
Actor-Identität pro Batch (aus sigloch-modules CR-199 bereits ausgeschlossen).

## Dependencies

**CR-GC-233** (die zu migrierende Implementierung) · sigloch-modules **CR-199**/**CR-200** (die promotete
Contracts-Form, `@sigloch/contracts@0.7.0`).
