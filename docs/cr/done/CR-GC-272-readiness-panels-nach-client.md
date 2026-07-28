# CR-GC-272: `readiness` + `panels` nach `@sigloch/graphcode-client`

**Status:** ✅ Done (2026-07-27) — Commits `84ecc39` (client), `7cb159e` (graphcode), `2185930` (GVE)
**Nachträglich dokumentiert (2026-07-28).** Die Umsetzung lief direkt nach der Freigabe, ohne dass
vorher ein CR-Dokument angelegt wurde; die Commits tragen deshalb die Nummer **265**, die zu dem
Zeitpunkt bereits an [`CR-GC-265-npm-metadata-and-dep-range`](CR-GC-265-npm-metadata-and-dep-range.md)
vergeben und geschlossen war. Ursache: bei der Nummernvergabe wurde nur der höchste Stand in
`docs/cr/open/` geprüft, nicht `done/`. Dieser CR hält den Vorgang unter einer freien Nummer fest;
die Commit-Referenzen bleiben falsch und werden **nicht** umgeschrieben (History-Rewrite auf
publizierten Commits wäre die teurere Korrektur).

**Vorgänger:** [`CR-GC-267`](CR-GC-267-graphcode-client-extraktion.md) (Host-Socket + View-Katalog
extrahiert — selbst von 264 umnummeriert).

## Problem (Why)

Nach CR-GC-267 hing `@sigloch/graph-view-edit` weiterhin an `@sigloch/graphcode`, weil die
Dashboard-Panels und die Readiness-Projektion dort lagen. Gemessen im Clean-Room-Install:

| Brocken | Größe | Von GVE benutzt? |
|---|---|---|
| `kuzu-wasm` | 70 MB | **Nein** — GVE öffnet per Governance §8 nie ein Kuzu-Handle |
| `typescript` | 23 MB | **Nein** (Runtime-Dep seit dem Bundler-Wegfall, CR-GC-262) |
| `@modelcontextprotocol/sdk` | 5,8 MB | **Nein** |

**Impact:** 157 MB Install für einen Viewer, der eine Graph-Datenbank und einen Compiler mitbringt,
die er strukturell nicht anfassen darf.

## Design

Verschoben nach `graphcode-client` **0.2.0**: `readiness.ts`, `readiness-completeness.ts`,
`viewer/panels.ts`.

Das Kriterium für den Schnitt: **rein Daten rein, Daten raus.** `computeReadiness(violations, graph)`
berührt weder Store noch Gate noch Prozess; `scoreReadiness` nimmt sein Argument nur strukturell
(`evaluateRules()` + `getGraph()`). Alles, was Store, Gate oder Prozess braucht, bleibt im Substrat.

**Ein verdeckter Strang:** `panels.ts` importierte `LiveUpdateEvent`/`UpdateDomain` scheinbar aus
graphcodes `emit.ts` — sie stammen aber aus `@sigloch/contracts/harness`, `emit.ts` reichte sie nur
durch. Der Client zeigt jetzt direkt auf den Vertrag.

**Keine parallelen Pfade:** graphcode behält an den drei Stellen **Re-Export-Shims**. Eine
Implementierung, kein Duplikat, und alle 11 Importer in `src/` und `tests/` bleiben unangetastet.

## Dateien (10)

**client:** `readiness.ts`, `readiness-completeness.ts`, `panels.ts` (verschoben), `index.ts`,
`package.json` (0.2.0 + contracts/graph-api-core als Deps), `tests/unit/readiness-panels.test.ts`
**graphcode:** die drei Shims + `package.json`
**GVE:** `package.json`, `vite.config.js`

Über dem 6-Datei-Limit — der Schnitt war nicht kleiner zu bekommen, ohne einen Zwischenstand mit
zwei Implementierungen zu hinterlassen.

## Akzeptanzkriterien

- [x] `type-check` grün, graphcode-Suite grün
- [x] Client-Suite 18/18; neuer Test baut jeden Graphen als Literal — zieht jemand wieder eine
      Substrat-Abhängigkeit ein, kompiliert die Datei nicht mehr
- [x] GVE-Suite **510/510** grün nach dem Dep-Swap
- [x] Clean-Room-Install **157 MB → 43 MB**, 166 → 63 Pakete
- [x] Schreibweg unverändert belegt: `POST /api/mutate` → `callHost` → `host.sock` → das EINE Gate;
      der Write taucht im Audit des Stores mit der Viewer-Consumer-ID auf
- [x] `@sigloch/graphcode-client@0.2.0` und `@sigloch/graph-view-edit@0.1.0` publiziert
- [x] Gesamtkette ausschließlich aus der Registry verifiziert: `npx @sigloch/graphcode init` (7/7)
      + `npx @sigloch/graph-view-edit --repo .` (Viewer + Dashboard 200)
