# CR-GC-818: MergeReport (src/kernel/merge.ts:48) als Zod-Schema, damit SCHEMA-branch-merge-report gebunden werden kann (RC-08)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-973 (idea)
**Erstellt:** 2026-10-16
**Item:** bok/items/ITEM-2026-973.json (Lane: graph)

---

**Art:** Code + Modellbindung

---

## Befund

`MergeReport` (`src/kernel/merge.ts:48`) war ein TypeScript-Interface. Der Vertrag des Flusses `FLOW-merge-report`
(graph_merge → Ablaufsteuerung, CR-GC-814) ließ sich deshalb nicht binden: RC-08 verlangt ein Zod-Schema, damit
der Vertrag zur Laufzeit prüfbar ist.

## Umsetzung

- `src/kernel/merge.ts`: `MergeBatchSchema`, `MergeConflictSchema`, `MergeReportSchema` als Zod; die Typen
  `MergeBatch`, `MergeConflict`, `MergeReport` werden daraus abgeleitet (keine parallelen Interfaces). Kommandos und
  Gate-Urteile über `MutateCommandSchema`/`RuleViolationSchema` aus `@sigloch/contracts/harness`.
  `replayBranchLog` prüft den Bericht vor der Rückgabe (`MergeReportSchema.parse`).
- `tests/mcp.merge.test.ts` (TEST-merge): echter Bericht erfüllt das Schema, die Kommandos bleiben erhalten;
  Ablehnung: Konflikt ohne Gate-Urteil.
- Modell: `SCHEMA-branch-merge-report` → `realRef MergeReportSchema` (v779 → v780).

## Abnahme

Typprüfung grün; `tests/mcp.merge.test.ts` grün; Konformitätstest (RC-08) sauber; Volllauf vor dem Schließen.
