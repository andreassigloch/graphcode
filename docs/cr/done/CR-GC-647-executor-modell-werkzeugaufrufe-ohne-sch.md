# CR-GC-647: Executor: Modell-Werkzeugaufrufe laufen ohne Schema-Grenze, und gekappte Listen kommen leer an

**Status:** ✅ Done (2026-09-24)
**Typ:** aus Item ITEM-2026-541 (bug)
**Erstellt:** 2026-09-24
**Item:** bok/items/ITEM-2026-541.json (Lane: code)

---

## Befund

Gemessen 2026-09-24 an einer Kopie des eigenen Modells (900 Knoten), eine Executor-Runde.

`execReadOrGraphTool` (`src/loop/executor-tools.ts`) rief `tool.handler(input)` roh auf. Die
Schema-Grenze des MCP-Servers — Defaults setzen (CR-GC-539), unbekannte Argumente abweisen
(CR-GC-623) — gab es fuer das Executor-Modell nicht.

| Aufruf des Modells | vorher | nachher |
|---|---:|---:|
| `graph_elements({type:'REQ'})` | 28.572 Zeichen roh → `jsonCapped` → **346 Zeichen, kein Knoten** | 5.794 Zeichen, Listenanfang mit Knoten |
| `graph_elements({type:'REQ', id:'x'})` | still wie oben | `ERROR: invalid input …` mit dem Namen |

Zweite Ursache, beim Testen gefunden: auch MIT Default-`limit` (100 REQ, ~18k Zeichen ohne
Prosa, CR-GC-621) liegt die Antwort ueber `TOOL_RESULT_CHAR_BUDGET` (6.000), und `jsonCapped`
strich dann **alle** Arrays. Eine Listen-Antwort kam beim Modell grundsaetzlich leer an.

## Umsetzung

- `strengesSchema` wandert von `surface/mcp-server.ts` nach `kernel/tool-contract.ts` — eine
  Funktion, zwei Grenzen (MCP-Server, Executor). Kein zweiter Pfad.
- `execReadOrGraphTool` parst mit dem strengen Schema; ein Parse-Fehler geht als Text zurueck.
- `buildToolSpecs` veroeffentlicht das strenge Schema (`additionalProperties:false`) wie der MCP-Server.
- `jsonCapped` kappt Listen der obersten Ebene auf ihren **Anfang** statt sie zu streichen und
  nennt den Schnitt (`gekappt: {nodes: "37/100"}`).

## Umfang laut Graph

`CR-GC-647 -relation-> FUNC-run-executor, FUNC-serve-stdio, SCHEMA-mcp-tool`.
`execReadOrGraphTool` hat keinen eigenen FUNC-Knoten; es realisiert den Teil von
`FUNC-run-executor`, dessen Beschreibung nachgezogen ist.

## Dateien (8)

`src/kernel/tool-contract.ts`, `src/surface/mcp-server.ts`, `src/loop/executor-tools.ts`,
`src/loop/executor-backend.ts`, `src/loop/executor-prompt.ts` (nur `jsonCapped`),
`tests/executor-tools.test.ts`, `tests/executor.test.ts`, `tests/tool-description-params.test.ts`.

## Akzeptanzkriterien

- [x] `graph_elements({type})` vom Modell traegt Knoten und den Default-`limit` (`tests/executor-tools.test.ts`, realer Store, 130 REQ).
- [x] Unbekannter Argumentname → `ERROR: invalid input` statt stiller Leer-Eingabe (dito).
- [x] `jsonCapped` behaelt den Listenanfang und nennt den Schnitt (`tests/executor.test.ts`).
- [x] Beide neuen Tests rot auf dem alten Stand (vorher: `truncated`-Stummel ohne `nodes`; `graph_help`-Antwort statt Fehler).
- [x] `npm run build` gruen; Voll-Suite als Abschluss-Gate.

Split: Befunde 2–4 aus ITEM-2026-541 laufen als CR-GC-648 (Dateigrenze 10).
