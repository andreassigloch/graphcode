# CR-GC-868: Register beim Binden typisieren (Teil 2b von ITEM-2026-1094)

**Status:** ✅ Done (2026-10-27)
**Typ:** aus Item ITEM-2026-1103 (idea)
**Erstellt:** 2026-10-27
**Item:** bok/items/ITEM-2026-1103.json (Lane: code)

---

Teil 2b von ITEM-2026-1094 (Schnitt in CR-GC-867): bindToolsToHarness liefert ein Register mit dem Typ jedes Werkzeugs (CallableRegistry: Eingabe z.input des Schemas, Ergebnis wie gebaut). MCPToolRegistry bleibt die Sicht fuer Aufzaehlen und Weiterreichen.

---

## Änderung

1. `src/kernel/tool-contract.ts`: `CallableTool<T>` (Eingabe `z.input` des Schemas, Ergebnis wie
   gebaut) und `CallableRegistry<R>`.
2. `src/surface/mcp-tools.ts`: `ToolRegistry` = die Vereinigung der 8 Fabriken in der Sicht des
   Aufrufers. `bindToolsWithContext` und `bindToolsToHarness` liefern sie; `withInputParsing` und
   `withConsultationTracking` reichen den Typ durch. `MCPToolRegistrySchema.parse` prüft das
   Register weiter, das Ergebnis des Parse wird nicht mehr statt des Registers verwendet.
   `MCPToolRegistry` bleibt die Sicht für Aufzählen und Weiterreichen (MCP-Server, Socket, Proxy).

## Tests

- `tests/werkzeug-register-typ.test.ts`: drei Typ-Aussagen über `ToolRegistry`.

## Akzeptanzkriterien

- Der Typ-Test hat gegen den alten Stand 5 Fehler, danach 0.
- `npm run type-check` und `verify:code` grün.

## Nachweis (2026-10-27)

- Rot zuerst: `tsc -p tsconfig.tests.json` meldet gegen den alten Stand 5 Fehler im Typ-Test, danach 0.
- Grün: `npm run build`, `npm run type-check`, `verify:code`.
- Modell: `TEST-werkzeug-register-typ -verify-> SCHEMA-mcp-tool-registry`, Kanten am CR-Knoten.
