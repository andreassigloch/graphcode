# CR-GC-522: Vertrags-Zahlen 30/65 → 31/66 nach contracts 5.1/26

**Status:** ✅ erledigt (2026-09-14)
**Typ:** aus Item ITEM-2026-128 (finding)
**Erstellt:** 2026-09-14
**Item:** bok/items/ITEM-2026-128.json (Lane: code)
**Vorlauf:** CR-GC-521 (ausgegliedert wegen 6-Dateien-Grenze)

---

## 1. Root Cause

contracts CR-SM-317 fuegt das Muster `TEST -verify-> SCHEMA` hinzu (`TRACE_PATTERNS` 30 → 31), CR-SM-319 die scorende Regel R-32 (engine rules 65 → 66). `tests/claims.conformance.test.ts` pinnt beide Zahlen (Kanarienvogel fuer einen contracts-Bump) und prueft die drei Artikel dagegen.

## 2. Impact

6 rote Stellen in `docs/articles/03`, `04`, `06` + 2 rote Faelle im claims-Test. Kein Laufzeitverhalten betroffen.

## 3. Fix

Zahlen in den drei Artikeln und im Pin des Tests nachgezogen, je mit Einzeiler-Grund (CR-SM-317 / CR-SM-319). Test nicht geschwaecht.

## 4. Dateien

- `tests/claims.conformance.test.ts`
- `docs/articles/03-graphcode-harness-goal-and-concept.md`
- `docs/articles/04-the-graphcode-story.md`
- `docs/articles/06-claims.md`
- `docs/cr/open/CR-GC-522-…md` (diese Datei)

## 5. Akzeptanzkriterien

- [x] `claims.conformance.test.ts` gruen gegen contracts 5.1.0/26.0.0 (link mode).
- [x] Jede Zahl im Text stimmt mit der lebenden Quelle ueberein (`TRACE_PATTERNS.length`, scorende `ALL_RULE_DEFS`).
