# CR-GC-523: Zod-Vertraege fuer HarnessHandle und ToolContext (ITEM-064, graphcode)

**Status:** ✅ erledigt (2026-09-14)
**Typ:** aus Item ITEM-2026-129 (idea) — Teilschnitt von ITEM-2026-064 / CR-GC-521
**Erstellt:** 2026-09-14
**Item:** bok/items/ITEM-2026-129.json (Lane: code)

---

## 1. Root Cause

`SCHEMA-harness-handle` und `SCHEMA-tool-context` stehen im Modell als `concept` ohne
`realRef`; im Code ist der Harness-Griff eine Klasse und der Werkzeug-Kontext ein
TS-Interface — beide Uebergaben (`createHarness` → 6 Konsumenten, `createToolContext` →
`bindToolsToHarness`) laufen ohne Laufzeitpruefung. Ein Stand-in oder ein halb gebauter
Kontext faellt erst beim ersten fehlenden Mitglied irgendwo im Werkzeugaufruf um, nicht an
der Uebergabe. ITEM-064 verlangt jede Uebergabe als Zod-Vertrag mit Vertragstest
(contracts 10.3: `TEST -verify-> SCHEMA`, R-32).

## 2. Impact

Kein Nutzer-sichtbarer Fehler heute; die zwei meistgenutzten Objekt-Uebergaben des Hosts
sind fuer RC-04 und R-32 unsichtbar (`concept`), also nicht Teil des Kongruenz-Urteils.

## 3. Fix

- `src/kernel/harness-handle-contract.ts`: `HarnessHandle` = `z.custom<GraphCodeHarness>()`
  + Refine ueber die oeffentliche Oberflaeche (22 Mitglieder, `satisfies
  Record<keyof GraphCodeHarness, ZodType>` haelt die Liste an der Klasse) und die Daten
  hinter den Zugriffen (`getRepoRoot`, `getStoreDir`, `getScope` gegen
  `HarnessConfigSchema.shape.scope`, `getFocusThreshold` in [0,1]). `parse` liefert die
  Instanz, nie eine Kopie. Unbekannte Mitglieder sind keine Abweichung (Klasse mit privaten
  Feldern; ein erweiterter Griff bleibt ein Griff).
- `src/surface/tool-context-contract.ts`: `ToolContext` = `z.strictObject` (4 Traeger +
  13 Funktionen mit Signatur via `z.custom<F>`) + Refine ueber `graphVersion()`,
  `sessionId()`, `ownerPid()`. Typ `ToolContext = z.infer`; `ToolPort`-Erfuellung als
  Kompilierzeit-Zuweisung erzwungen.
- `src/surface/tool-context.ts`: Interface geloescht, Typ re-exportiert vom Vertrag;
  `ToolContext.parse({...})` am Ausgang.
- Entscheidung (Konflikt im ersten Lauf): `host-shim.ts` bindet seine Werkzeug-Vorlage an
  einen zugriffsgesperrten Stand-in-Harness („the template must stay unbound", CR-GC-235).
  Eine strukturelle Handle-Pruefung in `createToolContext` bzw. im `harness`-Feld von
  `ToolContext` loest genau diesen Zugriff aus (4 host-shim-Tests rot). Der Griff wird
  daher an SEINER Grenze geprueft (`createHarness`, Produzent von FLOW-harness-handle);
  `ToolContext.harness` prueft nur „Objekt, nicht null". Alternative — Vorlage ohne
  Harness bauen — ist ein eigener Umbau der Tool-Fabriken (eigenes Item).
- `src/surface/create-harness.ts`: `return HarnessHandle.parse(new GraphCodeHarness(...))`.
- Zwei Vertragstests (echter disk-Kuzu-Harness als Fixture; Abweisung je fehlendem,
  falsch typisiertem, unbekanntem Feld mit Pfad; Datenanteile). Red-first: beide Dateien
  rot (`Failed to load url …-contract.js`) vor der Implementierung.

Nicht in diesem CR: `SCHEMA-tool-registry` (`MCPToolRegistry` ist ein TS-Typ, kein Zod —
entgegen der Annahme im Auftrag) und die Modell-Mutationen (siehe §5).

### Dateien (6)

| # | Datei |
|---|---|
| 1 | `src/kernel/harness-handle-contract.ts` (neu) |
| 2 | `src/surface/tool-context-contract.ts` (neu) |
| 3 | `src/surface/tool-context.ts` |
| 4 | `src/surface/create-harness.ts` |
| 5 | `tests/contract.harness-handle.test.ts` (neu) |
| 6 | `tests/contract.tool-context.test.ts` (neu) |

## 4. Akzeptanzkriterien

- [x] `grep -n "interface ToolContext" src/` leer; alle Importe von `ToolContext` laufen ueber den Vertrag (Re-Export in `tool-context.ts`).
- [x] `HarnessHandle.parse(h) === h` (Instanz, keine Kopie) — Test.
- [x] Jede Abweichung (fehlend, falscher Typ, unbekannt bei ToolContext, Datenanteil) wird mit Pfad abgewiesen — 14 Tests gruen.
- [x] `tests/host-shim.test.ts` gruen (Vorlage bleibt ungebunden).
- [x] `npm run type-check`, `npm run lint`, `npm run build` gruen.
- [ ] Modell (§5) nachgezogen — offen, MCP-Host dieser Sitzung ist an bok gebunden.

## 5. Offen: Modell-Mutationen (SSOT `docs/graph/graphcode.graph.json`, nur durchs Gate)

```
update-node SCHEMA-harness-handle: concept -> weg, realRef {file:'src/kernel/harness-handle-contract.ts', symbol:'HarnessHandle', lang:'ts'}
update-node SCHEMA-tool-context:   concept -> weg, realRef {file:'src/surface/tool-context-contract.ts', symbol:'ToolContext', lang:'ts'}
add-node TEST-harness-handle-contract  (testRefs: tests/contract.harness-handle.test.ts, vitest, integration)
add-node TEST-tool-context-contract    (testRefs: tests/contract.tool-context.test.ts, vitest, integration)
add-edge TEST-harness-handle-contract -verify-> SCHEMA-harness-handle
add-edge TEST-tool-context-contract   -verify-> SCHEMA-tool-context
```
