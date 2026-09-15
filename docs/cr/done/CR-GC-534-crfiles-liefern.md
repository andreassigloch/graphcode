# CR-GC-534: crFiles liefern — RC-07 prüft CR-Knoten gegen docs/cr

**Status:** ✅ Done (2026-09-15)
**Typ:** aus Item ITEM-2026-157 (finding)
**Erstellt:** 2026-09-15
**Item:** bok/items/ITEM-2026-157.json (Lane: code)

---

## 1. Root Cause

RC-07 (CR-SM-329) urteilt über `CodeFacts.crFiles`; ohne das Feld schweigt die Regel. graphcode ist der
Extractor und lieferte es nicht.

## 2. Fix

- `src/kernel/conformance.ts`: `extractCrFiles(repoRoot)` — CR-ID = Dateiname bis zur ersten Nummer, Wert =
  `open`/`done`; kein `docs/cr/` → `undefined` (nicht nachgesehen). `extractCodeFacts` liefert es mit.
- `tests/conformance.test.ts`: Extractor liest `CR-GC-533` als `done`, ohne `docs/cr` `undefined`.
- `tests/evaluation.rule-catalog.test.ts`: `NOT_IN_GATE` um RC-07.

Gegenstück in sigloch-modules: CR-SM-330.

## 3. Akzeptanzkriterien

- [x] Typecheck + Suite grün (1128).
- [x] Validiert an echten Repos: bok 9, graphcode 18, sigloch-modules 2, graph-view-edit 1 RC-07-Befunde. In
      graphcode: CR-GC-261 (Knoten `open`, Datei `done/`), 16 CR-DRAFT-Dateien in `open/` ohne Knoten, CR-GC-534
      selbst — bewusst offen, Nachtragen der offenen CRs ist eigene Modellarbeit.

## 4. Dateien

`src/kernel/conformance.ts` · `tests/conformance.test.ts` · `tests/evaluation.rule-catalog.test.ts`
