# CR-GC-683: Konformanz-Extraktor sieht nur <repo>/src und relative Imports - im Monorepo sigloch-modules 0 Import-Endpunkte, RC-05 und RC-09 dort blind

**Status:** ✅ Done (2026-09-26)
**Typ:** aus Item ITEM-2026-598 (finding)
**Erstellt:** 2026-09-26
**Item:** bok/items/ITEM-2026-598.json (Lane: code)

---

GEMESSEN 2026-09-26 an sigloch-modules: graph_readiness meldet importCoverage endpoints 0, obwohl MOD-contracts/graph-api-core/se-steering jetzt ein path tragen (RC-10-Nachzug). Ursache graphcode src/kernel/conformance.ts: extractCodeFacts und extractImportEdges scannen nur <repo>/src, und Imports nur mit relativem Spezifizierer (bare = node_modules = skip). Ein Monorepo (packages/*/src) mit Paket-Importen ueber @sigloch/* liefert damit null Kanten und fileScope referenced. Folge: RC-05 (unmodellierte Modulgrenzen) und RC-09 (Parallel-Parse eines Vertrags) sind in SM per Konstruktion blind; importCoverage 0/0 sieht aus wie 'nichts zu tun' statt 'nicht geprueft'. Fix-Richtung: Scan-Wurzeln aus package.json workspaces ableiten, Workspace-Pakete als interne Endpunkte aufloesen (Paketname -> packages/<x>); 0 Endpunkte bei vorhandenem Code als skipped melden, nicht als leere Deckung. Betrifft Familie: SM sicher, bok (scripts/) pruefen.

---

## Ursache

`extractCodeFacts` und `extractImportEdges` kannten eine Wurzel (`<repo>/src`) und eine Importart
(relativ). Ein Monorepo hat keines von beiden: der Code liegt unter `packages/<x>/src`, die Pakete
erreichen sich ueber ihren Namen (`@sigloch/contracts/se`). Beides fiel still weg.

## Aenderung — 4 Dateien

| Datei | Aenderung |
|---|---|
| `src/kernel/source-roots.ts` (neu) | `sourceLayout`: `src/` plus `src/` jedes Workspace-Pakets (`package.json` `workspaces`); `resolveImport`: relativ wie bisher, ein nackter Spezifizierer nur, wenn er ein Workspace-Paket nennt — ueber dessen `exports`/`main`, Build-Ausgabe auf die Quelle abgebildet (`./dist/se/index.js` → `src/se/index.ts`). Alles andere bleibt node_modules. |
| `src/kernel/conformance.ts` | beide Scans laufen ueber `sourceLayout`; `resolveRelativeImport` entfaellt (in `resolveSourceFile` aufgegangen, kein zweiter Pfad) |
| `tests/conformance.test.ts` | Monorepo-Fixture: Kante ueber Exports-Subpfad und Paketwurzel, `fileScope: 'all'`, RC-05 feuert |
| `rig/sigllm-spezifikation/lauf-gcrun.env` | Nebenbei: veralteter Kommentar „qwen3.8 untauglich" (ITEM-2026-364 verworfen) korrigiert, Modellwert unveraendert |

Modell: `CR-GC-683 -relation-> FUNC-check-code-conformance` (der Helfer ist intern, kein eigener Knoten).

## Messung (echte Repos, alter gegen neuen Extraktor)

| Repo | Dateien | fileScope | Import-Kanten | importCoverage (Endpunkte/zugeordnet) | RC-05 |
|---|---:|---|---:|---|---:|
| sigloch-modules vorher | 9 | referenced | 0 | 0 / 0 | 0 |
| sigloch-modules nachher | 129 | all | 278 | 128 / 63 | **3** |
| graphcode, graphify, graph-view-edit, bok | unveraendert | | | | |

Die drei RC-05 sind echt: das SM-Modell dokumentiert nicht, dass `graph-api-core`, `se-optimizer`
und `se-steering` von `contracts` abhaengen. Das ist Modellarbeit in SM, nicht dieser CR.

## Nicht in diesem CR

- bok hat weder `src/` noch Workspaces (Skripte unter `scripts/`) und bleibt `referenced`.
- 0 Endpunkte bei vorhandenem Code als `skipped` statt als leere Deckung melden: die Aussage lebt
  in contracts (`importCoverage`); mit diesem Fix tritt der Fall in der Familie nur noch in bok auf.

## Akzeptanzkriterien

1. Monorepo-Fixture: Paketimport ueber Exports-Subpfad und Paketwurzel ergibt eine Kante auf die Quelldatei; `zod` bleibt draussen. ✅
2. `fileScope: 'all'` ohne Top-Level-`src/`. ✅
3. Undokumentierter Paketimport feuert RC-05. ✅
4. Die vier Familien-Repos mit `src/` liefern identische Zahlen wie vorher. ✅
5. VOLL-Spur: 1600 gruen, 1 rot — `rig-measured` (CR-GC-496) liest `.graphcode/kuzu`, den ein frischer Worktree nicht hat; ohne diese Aenderung identisch rot (gegengeprueft per stash).
