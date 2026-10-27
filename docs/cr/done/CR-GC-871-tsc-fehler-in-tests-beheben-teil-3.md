# CR-GC-871: tsc-Fehler in tests/ beheben, Teil 3 (Teil 4b von ITEM-2026-1094)

**Status:** ✅ Done (2026-10-27)
**Typ:** aus Item ITEM-2026-1104 (idea)
**Erstellt:** 2026-10-27
**Item:** bok/items/ITEM-2026-1104.json (Lane: code)

---

Teil 4b von ITEM-2026-1094: die letzten 11 tsc-Fehler in tests/ (9 Dateien: mcp.help, kongruenz, hooks.inject-graph-slice, generate, gate.urteilt-und-speichert, gate.modelfree, auto-export.shutdown-flush, mcp.impact, mcp.symmetry).

---

## Befund

Zwei Ursachen lagen im Erzeuger, nicht im Test:

- `graph_mutate` deklarierte `violations` als `RuleViolation[]`. Im Default `violations: 'summary'`
  liefert es seit CR-GC-570 Einträge je Regel und Meldungsmuster mit `elements`. Der Typ nennt jetzt
  beide Formen (`src/surface/write.ts`).
- `strengesSchema` verlangte ein ganzes `MCPTool`, liest aber nur `inputSchema`. Ein Werkzeug aus dem
  getypten Register passte deshalb nicht hinein. Jetzt `Pick<MCPTool, 'inputSchema'>`
  (`src/kernel/tool-contract.ts`).

Zwei weitere waren tote Argumente: `hooks.inject-graph-slice` übergab `'test'` an `mutate`, dessen
zweiter Parameter die Optionen sind; `generate.test` rief `generationStep` ohne `threshold`.

Übrige: `attributes: {}` (auto-export.shutdown-flush), Casts entfallen (gate.modelfree,
gate.urteilt-und-speichert), Eingrenzen mit `mitFeld` (mcp.impact, mcp.symmetry).

`kongruenz` (nur ein `@ts-expect-error`, der mit `allowJs` wegfällt) zieht in den letzten Teil.

## Akzeptanzkriterien

- `tsc -p tsconfig.tests.json` meldet in den 8 Testdateien 0 Fehler (gesamt 11 → 1).
- Die 8 Testdateien laufen grün; `npm run type-check` und `verify:code` grün.

## Nachweis (2026-10-27)

- Rot zuerst: `tsc -p tsconfig.tests.json` meldete in den 8 Testdateien 10 Fehler, danach 0 (gesamt 11 → 1).
- Grün: die 8 Testdateien (105 Tests), `npm run type-check`, `verify:code` (Spur VOLL, 202 Dateien).
