# CR-GC-720: Schlupf in CR-GC-719: CODE-Spur ignoriert eine Modell-Aenderung im selben Diff (docs/graph) — 3 Tests des Modell-Satzes lagen ausserhalb der Auswahl; und schlupfFreieFolge zaehlt je CR nur die juengste Zeile, ein Nachlauf verdeckt den Schlupf

**Status:** ✅ Done (2026-09-30)
**Typ:** aus Item ITEM-2026-669 (bug)
**Erstellt:** 2026-09-30
**Item:** bok/items/ITEM-2026-669.json (Lane: code)

---

## Befund

`verify:full CR-GC-719`, erster Lauf: 3 rote Testdateien, alle außerhalb der CODE-Auswahl (4/199) —
`tests/mcp.tests-operational`, `tests/test-selection.audit`, `tests/verify-model.completeness`. Der
Nachlauf nach dem Fix war grün, und `schlupfFreieFolge` zählte je CR nur die jüngste Zeile: die
Messung meldete 1/10, als hätte es keinen Schlupf gegeben.

## Ursache

1. CR-GC-719 änderte Quelle **und** Modell (`docs/graph/graphcode.graph.json`). `planCodeLane`
   wertet nur Quelldateien aus; der Snapshot trägt dort keinen Test. Alle drei roten Tests stehen im
   Modell-Satz (`scripts/model-test-set.mjs`) — die MODELL-Spur hätte sie gefahren, die CODE-Spur
   kannte sie nicht.
2. Die Folgen-Regel aus CR-GC-718 ließ den Nachlauf den ersten Lauf überschreiben.

## Umsetzung

- `planCodeLane(…, { modelTests })`: liegt der Snapshot im Diff, nimmt die CODE-Spur den Modell-Satz
  dazu und sagt es an („N aus dem Modell-Satz“). `verify:code` und `verify:full` übergeben
  `INCLUDED` aus `model-test-set.mjs`; `verify:full` misst gegen genau diese Plan-Auswahl.
- `schlupfFreieFolge`: ein Schlupf in irgendeinem Lauf eines CR bricht die Folge.
- Tests red-first: `tests/test-selection.audit.test.ts` (Code + Modell im Diff),
  `tests/test-schlupf.test.ts` (Nachlauf verdeckt den Schlupf nicht).

## Stand der Folge

Mit der korrigierten Regel steht die Folge nach CR-GC-719 bei 0/10 — CR-GC-719 hatte Schlupf.
