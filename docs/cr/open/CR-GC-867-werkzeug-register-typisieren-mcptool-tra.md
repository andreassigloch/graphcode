# CR-GC-867: MCPTool traegt sein Eingabe-Schema (Teil 2 von ITEM-2026-1094)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1097 (idea)
**Erstellt:** 2026-10-27
**Item:** bok/items/ITEM-2026-1097.json (Lane: code)

---

Teil 2 von ITEM-2026-1094 (Schnitt in CR-GC-866). MCPTool traegt sein Eingabe-Schema statt des Eingabetyps; die Fabriken bind*Tools geben ihren echten Typ zurueck; bindToolsToHarness liefert ein Register mit dem Typ jedes Werkzeugs, Aufrufer-Eingabe z.input des Schemas (das Register parst seit CR-GC-866). Erwartet: die 76 impliziten any in den Tests fallen weg.

---

## Befund

`MCPTool<TInput, TOutput>` trug den Eingabetyp, und jede Fabrik `bind*Tools` gab
`MCPToolRegistry = Record<string, MCPTool<any, any>>` zurück. Damit war der Typ jedes Werkzeugs
nach der Fabrik weg. Aus einem Eingabetyp lässt sich zudem nicht ablesen, was ein Aufrufer vor dem
Parsen liefern darf (Felder mit Default optional) — das braucht das Schema selbst.

## Änderung

1. `src/kernel/tool-contract.ts`: `MCPTool<TSchema extends ZodType, TOutput>`; der Handler sieht
   `z.output<TSchema>`.
2. Die 8 Fabriken (`read`, `write`, `audit`, `export`, `testreport`, `report`, `suggest`, `metrics`):
   `MCPTool<typeof XInputSchema, …>` statt `MCPTool<z.infer<typeof XInputSchema>, …>`, und die
   Rückgabe `{ … } satisfies MCPToolRegistry` statt des Rückgabetyps `MCPToolRegistry`.

Schnitt: 10 Dateien. Das Register in `mcp-tools.ts` (`bindToolsToHarness` liefert jedes Werkzeug mit
seinem Typ) folgt in einem eigenen CR, sonst wären es 11.

## Tests

- `tests/werkzeug-register-typ.test.ts` (neu, Typ-Test mit `expectTypeOf`, geprüft von `tsc -p tsconfig.tests.json`).

## Akzeptanzkriterien

- Der Typ-Test hat gegen den alten Stand 5 Fehler, danach 0.
- `npm run type-check` und `verify:code` grün.

## Nachweis (2026-10-27)

- Rot zuerst: `tsc -p tsconfig.tests.json` meldet gegen den alten Stand 5 Fehler im Typ-Test, danach 0.
- Grün: `npm run build`, `npm run type-check`, `verify:code` (Spur VOLL, 202 Dateien).
- Modell: `TEST-werkzeug-register-typ -verify-> SCHEMA-mcp-tool`, Kanten am CR-Knoten.
