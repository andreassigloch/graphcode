# CR-GC-990: Verträge über Objekte mit Funktionen ohne z.custom

**Typ:** aus Item ITEM-2026-1558 (finding)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1558.json (Lane: code)

---

## Befund

Der Autor hat am 2026-11-21 entschieden: In einem Vertrag (Zod-Schema, das ein SCHEMA bindet) gibt es kein `z.custom`, kein `refine`, kein `superRefine`. Der Vertragstest-Generator liest sie nicht; ein Vertragstest von Hand ist eine Umgehung. Dieser CR ist Teil A: Generator und `MCPToolSchema`. Teil B (Harness-Griff und Werkzeug-Kontext) ist CR-GC-991, weil beide zusammen mehr als 10 Dateien ergeben. Stand graphVersion 1443: R-26 8, R-32 11, RC-04 15, R-19 21; RC-08 0.

Gemessen an zod 4.4.3: `z.function()` ist ein Schema (`def.type` `function`), nimmt eine Funktion an und weist 3 ab. `parse` liefert eine umhüllende Funktion, nicht dieselbe Referenz; ein `toEqual` auf die Funktion aus der Eingabe wäre rot. Eine Klasseninstanz mit Methoden am Prototyp erfüllt `z.looseObject({ m: z.function() })`.

## Änderung

**Code (2 Dateien).** `src/projections/vertragstest.ts`: neue Feldart Funktion (Beispiel `BEISPIEL_FUNKTION`, Fall „lehnt einen Wert ab, der keine Funktion ist"), ein offenes Objekt (`catchall` unknown) nimmt ein Zusatzfeld an. Die Datei schreibt die Funktion als `fn` und erwartet `expect.any(Function)` statt der Parse-Kopie. `src/kernel/tool-contract.ts`: `MCPToolSchema.inputSchema` ist `z.looseObject({ safeParse: z.function() })`, `handler` ist `z.function()`.

**Tests von Hand (2 Dateien).** `tests/vertragstest.test.ts` (8 neue Fälle, rot zuerst), `tests/tool-contract.test.ts` (zwei Gegenproben entfallen, der erzeugte Test deckt sie; der Test an der echten Registry bleibt).

**Erzeugt (Fan-out, 2 Dateien).** `tests/vertrag/SCHEMA-mcp-tool.vertrag.test.ts`, `SCHEMA-mcp-tool-registry.vertrag.test.ts`.

**Messung (1 Datei).** `docs/messung/vertragstest-mutanten-cr-gc-990.md`.

Gezählt: 2 Quell-, 2 Test- und 1 Messdatei, zusammen 5, dazu 2 erzeugte.

## Nachweis rot-zuerst

| Prüfung | Rot gesehen |
|---|---|
| Generator, `z.function()` als Feld | Suite lief nicht an: `Typ function nicht unterstuetzt`; nach Ergänzung 62 von 62 grün |
| Mutanten M1 bis M5 an `MCPToolSchema` | alle fünf rot im erzeugten Test (2 bis 12 rote Fälle); der alte Handtest erkannte drei (M3 und M5 blieben grün). Tabelle: `docs/messung/vertragstest-mutanten-cr-gc-990.md` |

Gelöschte Handfälle: `tests/tool-contract.test.ts` verlor zwei Gegenproben („Werkzeug ohne handler", „inputSchema ohne safeParse"); der erzeugte Test deckt beide („lehnt ab ohne handler", „inputSchema: lehnt ab ohne safeParse"). Aussagen ohne Ersatz: keine.

## Akzeptanz

- [x] `npm run build` grün. `verify:code`: 96 Dateien, 966 Tests grün, Rückmeldung 73 Ergebnisse. `verify:full CR-GC-990`: 273 Dateien, 3510 Tests grün, Schlupf 0.
- [x] Der Generator liefert für die 25 bisher erzeugten Verträge unveränderte Dateien (`git status` zeigt keine Änderung unter `tests/vertrag`).
- [x] `rules_evaluate` grouped vorher und nachher (graphVersion 1443 und 1448): R-26 8, dann 7 (`SCHEMA-harness-handle` trägt jetzt ein `realRef`, Vorarbeit für CR-GC-991); R-32 11/11; RC-04 15/15 (`SCHEMA-mcp-tool` steht weiter in der Liste: `MCPToolSchema.parse` ruft keine realisierte FUNC auf, nur `MCPToolRegistrySchema.parse`); RC-08 0/0; R-19 21/21.

## Beobachtungen

- Der Generator verwirft bei einem nicht strikten `z.object` den Fall „unbekanntes Zusatzfeld" (`{}: lehnt ab: unbekanntes Zusatzfeld` in `verworfen`, Registry-Vertrag), weil `z.object` Zusatzfelder abstreift. Das gab es vorher schon; ein Wertverlust entsteht nicht.
- `parse` von `z.function()` liefert eine umhüllende Funktion, nicht dieselbe Referenz (gemessen, zod 4.4.3). Die erzeugte Datei erwartet deshalb `expect.any(Function)`.

## Umfang laut `graph_impact`

`graph_impact(SCHEMA-mcp-tool)`: `TEST-tool-contract`, `TEST-werkzeug-register-typ`, `FLOW-mcp-tool`. `graph_impact(SCHEMA-mcp-tool-registry)`: acht FLOW, zwei TEST. Aufrufer von `MCPToolSchema.parse`: keiner außer `MCPToolRegistrySchema`; `MCPToolRegistrySchema.parse` steht in `bindToolsWithContext` (`mcp-tools.ts`), das Ergebnis wird nicht weiterverwendet.

## Entscheidungen

_Nachtrag 2026-11-26 (CR-AB-037, aise-bok): Der Abschnitt fehlte beim Schließen. Übertragen aus dem Text oben; der Text oben bleibt unverändert._

| Frage | Festlegung | Begründung |
|---|---|---|
| Darf ein Vertrag (Zod-Schema, das ein SCHEMA bindet) `z.custom`, `refine` oder `superRefine` enthalten? | Nein. In einem Vertrag gibt es kein `z.custom`, kein `refine`, kein `superRefine`; ein Vertragstest von Hand ist eine Umgehung. | Der Vertragstest-Generator liest sie nicht (Abschnitt „Befund", Entscheidung des Autors 2026-11-21) |
