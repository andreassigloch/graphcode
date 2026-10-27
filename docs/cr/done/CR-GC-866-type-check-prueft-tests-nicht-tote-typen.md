# CR-GC-866: Werkzeug-Eingabe einmal im Register parsen (Teil 1 von ITEM-2026-1094)

**Status:** ✅ Done (2026-10-27)
**Typ:** aus Item ITEM-2026-1094 (bug)
**Erstellt:** 2026-10-27
**Item:** bok/items/ITEM-2026-1094.json (Lane: code)

---

tsconfig.json schliesst tests/ aus; tsc prueft die Testdateien nie. Probe 2026-10-27 mit include src+tests: 108 Fehler in 27 Dateien. 76 implizite any (TS7006), 10 fehlende Deklarationen fuer scripts/*.mjs (TS7016), dazu echte Befunde: harness.shutdown existiert nicht (skill-authoring-gate, skill-report-measured), falsche Argumentzahl (generate.test, nd-similarity), Feld stage fehlt an ViolationGroup (evaluation.reconciliation), fitAdvisory-Cast (gate.urteilt-und-speichert). Erwartet: type-check prueft tests/ mit, 0 Fehler, Test im Lauf der Suite.

---

## Schnitt von ITEM-2026-1094

Die Probe mit `tsc` über `src` und `tests` ergab 108 Fehler in 26 Dateien. 76 davon haben eine
Ursache im Quellcode: `MCPToolRegistry = Record<string, MCPTool<any, any>>` löscht den Typ jedes
Werkzeugs, also liefert jedes `tools.X.handler()` in den Tests `any`. Der Autor hat entschieden:
das Register typisieren. Das verteilt sich auf vier CRs mit je höchstens 10 Dateien:

| CR | Inhalt |
|---|---|
| dieser | Eingabe einmal im Register parsen |
| Teil 2 | `MCPTool` trägt sein Schema, das Register behält den Typ jedes Werkzeugs |
| Teil 3, 4 | die verbleibenden Fehler in den Tests |
| Teil 5 | `type-check` prüft `tests/` mit (`tsconfig.tests.json`) |

## Befund

Mit dem getypten Register wäre der Eingabetyp der Typ *nach* dem Parsen: Felder mit Default
gälten als Pflicht. Das stimmt für direkte Aufrufe auch: geparst wurde nur im MCP-Server und am
Host-Socket. Wer `handler()` direkt rief (`import-code`, Auto-Export, Tests), bekam die Eingabe
roh. Beispiel: `graph_elements({})` lieferte alle 1331 Knoten statt der Default-Grenze 100.

## Änderung (Entscheidung des Autors: ein Parse, Ausnahmen weg)

1. `src/surface/mcp-tools.ts`: `withInputParsing` parst jede Eingabe, bevor der Handler sie sieht.
2. `src/surface/mcp-server.ts`, `src/surface/host-shim.ts`: reichen nur noch durch.
3. `src/surface/write.ts`: der INPUT-SCHEMA-Zweig in `graph_mutate` (CR-GC-286) entfällt. Über MCP
   lehnte das SDK dieselbe Eingabe schon vorher ab; jetzt endet sie auf beiden Wegen im Register.
4. `src/projections/export.ts`: `assertInRepo` exportiert, damit der Test die Pfadsperre direkt prüft.
   Keine Werkzeug-Eingabe erreicht sie mehr, weil das Schema vorher ablehnt.

## Tests

- `tests/werkzeug-eingang-geparst.test.ts` (neu): Defaults beim direkten Aufruf, Abweisung ungültiger Eingabe.
- `tests/mcp.mutate-input.test.ts`: ohne `formatE` endet der Aufruf im Register, kein Audit-Eintrag.
- `tests/mutate.schema-guard.test.ts`: der abgewiesene Schreibzug ist eine Kante ins Leere, nicht
  ein leeres `formatE` (das lief bisher über den INPUT-SCHEMA-Zweig, nicht übers Gate).
- `tests/security.path-containment.test.ts`: Senke 2 prüft Schema und `assertInRepo` direkt.

## Akzeptanzkriterien

- Der neue Test ist rot gegen den alten Stand von `mcp-tools.ts`, grün danach.
- `verify:code` und die volle Suite grün.

## Nachweis (2026-10-27)

- Rot zuerst: `tests/werkzeug-eingang-geparst.test.ts` gegen den alten Stand von `mcp-tools.ts` (2 rot).
- Grün: volle Suite über `verify:full CR-GC-866` (201 Dateien, Schlupf 0).
- Smoke mit echtem Host und Proxy über den kopierten Graphen: `graph_elements {}` liefert 100 von 1333
  Knoten, `graph_mutate` ohne `formatE` endet mit einem Eingabefehler, auf beiden Wegen gleich.
- Modell: `REQ-tool-input-parsed-once`, `TEST-werkzeug-eingang-geparst`, Kanten am CR-Knoten.
