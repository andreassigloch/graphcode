# CR-GC-991: Harness-Griff und Werkzeug-Kontext ohne z.custom und superRefine

**Typ:** aus Item ITEM-2026-1559 (finding)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1559.json (Lane: code)

---

## Befund

Teil B zu CR-GC-990. `HarnessHandle` (`harness-handle-contract.ts`) und `ToolContext` (`tool-context-contract.ts`) trugen 5 `z.custom` und 2 `superRefine` (die übrigen 2 `z.custom` des Auftrags stehen in `tool-contract.ts`, CR-GC-990), dazu die Hilfen `member()` und `forwardIssues`. Der Autor hat am 2026-11-21 entschieden: im Vertrag gibt es kein `z.custom`, `refine` und `superRefine` mehr. Stand graphVersion 1452: R-26 7, R-32 11, RC-04 15, RC-08 0, R-19 21. `SCHEMA-harness-handle` war `concept:true` ohne `realRef` (CR-GC-990 hat das `realRef` gesetzt); die Handtests `tests/contract.harness-handle.test.ts` und `tests/contract.tool-context.test.ts` hingen an keinem TEST-Knoten.

## Änderung

| Vertrag | z.custom / superRefine vorher | nachher | erzeugte Fälle | gelöschte Handfälle |
|---|---|---|---|---|
| `HarnessHandle` | 1 `z.custom` im Wert, 1 in `member()` (23 Mitglieder), 1 `superRefine` über 4 Getter | `z.looseObject` über 23 `z.function()`; `satisfies Record<keyof GraphCodeHarness, z.ZodType>` bleibt | 49 | 7 Fälle (Datei gelöscht) |
| `ToolContext` | 3 `z.custom` (`member<F>` für 12 Mitglieder, `harness`, `auditLog`), 1 `superRefine` über 3 Getter | `z.strictObject` über 12 `z.function()`, `harness` ist `z.looseObject({})`, `auditLog` ist `z.looseObject({ record, query })` | 37 | 7 Fälle (Datei gelöscht) |

Typen: `interface ToolContext extends ToolPort` trägt die genauen Signaturen; das Schema ist mit `satisfies Record<keyof ToolContext, z.ZodType>` an dessen Schlüssel gebunden. Der Typ des Harness ist `GraphCodeHarness` selbst. Kein Cast, kein `any`. Der Cast `null as unknown as ToolContext` in `_portCheck` entfällt, denn `ToolContext extends ToolPort` erzwingt dasselbe beim Kompilieren.

Original statt Kopie (FAQ `erzeuger-parst-vertrag`, Punkt 3): `createHarness` und `createToolContext` parsen und geben das Original zurück. Aufrufstellen von `HarnessHandle.parse` und `ToolContext.parse` geprüft: `create-harness.ts`, `tool-context.ts`, sonst nur Tests; kein Ergebnis wurde weiterverwendet außer in `createHarness` (dort umgestellt).

`harness` im Kontext ist ein loses Objekt, nicht `HarnessHandle`: `buildProxyRegistry` bindet die Vorlage an einen Stand-in, dessen Zugriff wirft; `HarnessHandle.safeParse` auf diesem Stand-in wirft (gemessen, `docs/messung/vertragstest-mutanten-cr-gc-991.md`).

**Code (5 Dateien).** `harness-handle-contract.ts`, `tool-context-contract.ts`, `create-harness.ts`, `tool-context.ts`, `tool-contract.ts` (Kommentar zu `_portCheck`). Gelöscht: `member`, `forwardIssues`, `HARNESS_HANDLE_MEMBERS`, der Typ `HarnessHandle` aus `z.infer`, `_portCheck`.

**Tests von Hand (3 Dateien).** `tests/harness-handle.test.ts` und `tests/tool-context.test.ts` ersetzen die beiden Handtestdateien (Verhalten der Getter, Original statt Kopie); `tests/tool-contract.test.ts` verliert die Gegenprobe zum Kontext. Erzeugt (Fan-out, 2 Dateien): `tests/vertrag/SCHEMA-harness-handle.vertrag.test.ts`, `SCHEMA-tool-context.vertrag.test.ts`.

**Messung (1 Datei).** `docs/messung/vertragstest-mutanten-cr-gc-991.md`.

Gezählt: 5 Quell-, 3 Test- und 1 Messdatei, zusammen 9, dazu 2 erzeugte.

**Modell.** `SCHEMA-harness-handle` und `SCHEMA-tool-context`: Beschreibung nachgezogen. Vier TEST-Knoten mit `verify` und `testRefs` (zwei erzeugte, zwei von Hand).

## Verlorene Laufzeitprüfungen

| Alte Abweisung | Beleg | Ersatz |
|---|---|---|
| `getRepoRoot()` leer, `getStoreDir()` keine Zeichenkette, `getScope()` ohne `systemId`, `getFocusThreshold()` außerhalb [0, 1] | alter Test `prueft die Datenanteile hinter den Zugriffen`; er speiste Attrappen, keine echte Klasse | Der Konstruktor parst `HarnessConfigSchema` (`harness.ts` 117), eine echte Klasse kann diese Werte nicht annehmen. Test der Funktion: `tests/harness-handle.test.ts`. Mutante `getRepoRoot()` liefert `''`: rot |
| `graphVersion()` negativ oder keine Zahl, `sessionId()` leer, `ownerPid()` Zahl | alter Test, gleiche Form | `tests/tool-context.test.ts` prüft Wert und Stabilität am echten Kontext. Mutante `sessionId()` liefert `''`: rot |

Ein echtes Fehlerbild (halb gebauter Kontext oder Griff) bleibt abgewiesen: die erzeugten Tests lehnen jedes fehlende Mitglied ab. Eine Attrappe, die Mitglieder mit falschem Rückgabewert trägt, weist der Vertrag nicht mehr ab. Das kommt im Code nicht vor: es gibt genau einen Erzeuger je Vertrag.

## Nachweis rot-zuerst

Mutanten H1 bis H5 und T1 bis T6: alle im erzeugten Test oder im Test der Funktion rot; der alte Handtest übersah T4. Tabelle: `docs/messung/vertragstest-mutanten-cr-gc-991.md`.

## Akzeptanz

- [x] `npm run build` und `tsc --noEmit` grün. `verify:code`: 106 Dateien, 1117 Tests grün, Rückmeldung 81 Ergebnisse. `verify:full CR-GC-991`: 275 Dateien grün, Schlupf 0, Rückmeldung 214 Ergebnisse, 0 zurückgenommen.
- [x] `rules_evaluate` vorher und nachher (graphVersion 1452 und 1453): R-26 7/7, R-32 11/10 (`SCHEMA-harness-handle` hat jetzt einen Vertrags-TEST), RC-04 15/15, RC-08 0/0, R-19 21/21.
- [x] `grep` nach `z.custom`, `.refine(`, `.superRefine(` in `src/`: nur zwei `.refine(` in `src/projections/testreport.ts` (`GraphTestIngestInputSchema`, nächster CR), sonst nur Kommentare.

---

## Entscheidungen

Keine: der CR wendet FAQ `erzeuger-parst-vertrag` und die Entscheidung vom 2026-11-21 an.

---

## Umfang laut `graph_impact`

`graph_impact(SCHEMA-harness-handle)`: 30 Knoten, 19 FLOW, 10 FUNC am Rand. `graph_impact(SCHEMA-tool-context)`: `FUNC-tool-context`, `FUNC-bind-tools`, `TEST-tool-contract`. Aufrufer `HarnessHandle.parse`: `createHarness`; `ToolContext.parse`: `createToolContext`.
