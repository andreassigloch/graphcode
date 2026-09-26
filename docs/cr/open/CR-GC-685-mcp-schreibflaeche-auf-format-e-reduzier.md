# CR-GC-685: graph_realize entfernen, Bindungsreport ins mutate-Ergebnis

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-571 (idea)
**Erstellt:** 2026-09-26
**Item:** bok/items/ITEM-2026-571.json (Lane: code)

---

Gemessen 2026-09-25: tools/list des MCP-Servers = 24 Werkzeuge, 34.947 Zeichen (~9-10k Token); der Executor bekommt 7 Werkzeuge/1.842 Zeichen (CR-GC-651). Frage: was ueber graph_mutate + Format-E ohne Klimmzug geht, gehoert nicht auf die Flaeche. (1) graph_realize (3,4k Zeichen) baut nur update-node mit realRef/testRefs — Format-E kann das: ~ FUNC-x + @realRef {json} (hydrateAttrValue). Verlust: testRefs-Anhaengen (Patch ersetzt die Liste) und der resolved/openRefs-Report — der gehoert ins mutate-Ergebnis (missingRefIds liegt schon in write.ts). (2) commands-Parameter: zweiter Eingabeweg; Format-E fehlt nur update-edge — pruefen, ob delete-edge + add-edge im selben Batch das Gate passiert. (3) BUG: graph_merge ist Branch-Replay (log, sinceVersion; kernel/merge.ts), die Beschreibung erklaert aber den Knoten-Merge, den Format-E per M quelle + ziel kann — ein Agent mit Duplikaten greift zum falschen Werkzeug. Bleibt: alle Leser, graph_test_ingest (Report-Abgleich waere Klimmzug), export/reseed (Operationen). Groesserer Hebel danach: formatE-Beschreibung (1,9k) auf graph_authoring_guide verweisen, Leser-Beschreibungen straffen. Wirkung nur am opus5-Arm (Claude Code) messbar — kostet API-Geld. NACHTRAG (Folgefrage, gleicher Tag) — Format der Prompt-Inhalte: Beispiele in Executor-SYSTEM, Regel-Klauseln (generate.ts), se:author-req/author-uc und graph_authoring_guide sind Format-E. JSON-Reste: Skills se:close-violations (Z.11-12) und se:optimize (Z.71-81) zeigen JSON-commands als Vorbild; der SCHEMA-01-fixHint (kernel/gate.ts) nennt nur JSON-Formen. Graph-Daten: graph_impact/expand/context immer Format-E; Inventar-Kanal eigenes Zeilenformat uid · TYPE · name (ohne Kanten); graph_elements und graph_get_edges JSON als Default (get_edges formatE gemessen 40 % kleiner), und die Executor-Projektion (AUTHORING_PARAMS) laesst den format-Parameter weg — der Executor bekommt dort IMMER JSON; graph_get_node nur JSON. VOLLSTAENDIGE commands/JSON-Liste (Suche 2026-09-25): Vorbilder mit JSON-commands in se-fmea.md:128, se/close-violations.md:11-12, se/optimize.md:70-81; se/import-doc.md:99-106 ruft graph_mutate im Code mit commands (Transport, kein Vorbild — pruefen, ob import-doc Format-E erzeugen kann); SCHEMA-01-fixHint kernel/gate.ts:73-77; Werkzeugtexte write.ts:85/95/349-350 (commands als Alternative), write.ts:137 (exactly one of commands or formatE). Executor: executor-parse.ts:45-79 rettet commands-JSON aus Prosa — ein zweiter Eingabeweg, der mit dem Parameter faellt. Graph-Daten als JSON: graph_get_node, graph_elements/get_edges (Default), audit_trail includeCommands, graph_realize-Eingabe. Kein Befund: Regel-fixHints in contracts, GRAPHCODE.md-Scaffold, se/target-profile.md (JSON dort = Inhalt einer Konfigurationsdatei, richtig).

---

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.

## Schnitt (2026-09-26, Release-Zug)

ITEM-2026-571 ist dreigeteilt: CR-GVE-299 (Konsument umstellen, ZUERST), CR-SM-368 (fix_hints),
dieser CR (Werkzeug weg). Die JSON-Vorbilder in Skills/Hinweisen stehen in CR-GC-686.
**Nicht in diesem Zug:** den `commands`-Parameter entfernen — 67 Dateien in drei Repos
(GVE-Editorbruecke, aise dispatch, Rigs, ~50 Tests); eigene Entscheidung.

## Zielbild

`graph_realize` verschwindet von der MCP-Oberflaeche. Binden geht ueber Format-E
`~ FUNC-x @realRef {…}`. Was nur graph_realize lieferte — der Report `resolved`/`openRefs` —
kommt ins `graph_mutate`-Ergebnis (`missingRefIds` liegt in `write.ts` schon vor).

## Umfang (10 Dateien)

`src/surface/write.ts`, `src/surface/mcp-tools.ts`, `tests/mcp.realize.test.ts` (auf Format-E
umschreiben), Werkzeuglisten/-aufrufe in `tests/mcp.agent-agnostic`, `skill-report-measured`,
`skill-authoring-gate`, `host-shim`, `mcp.occ`, `mcp.silent-advisories`,
`operations-log.integration` (.test.ts).

## Akzeptanz

- [ ] Rot zuerst: `graph_mutate` mit `@realRef` liefert heute keinen `resolved`/`openRefs`-Report.
- [ ] `tools/list` enthaelt `graph_realize` nicht mehr; Zeichen der Oberflaeche vorher/nachher.
- [ ] Modell: FUNC des Werkzeugs per `graph_impact` + Loeschzug (se-umbau), RC-* kongruent.
- [ ] VOLL-Lane gruen.
