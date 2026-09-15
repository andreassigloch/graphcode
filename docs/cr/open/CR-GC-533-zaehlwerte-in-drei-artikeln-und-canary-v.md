# CR-GC-533: Artikel und Canary auf 67 Engine-Regeln (MT-04)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-153 (finding)
**Erstellt:** 2026-09-15
**Item:** bok/items/ITEM-2026-153.json (Lane: code)
**Auslöser:** sigloch-modules PR #2 (gemergt 2026-09-15, `6a6fef0`) — CR-SM-327 bringt die Regel MT-04

---

## 1. Root Cause

`tests/claims.conformance.test.ts` (CR-GC-340) prüft jede veröffentlichte Zahl gegen die lebende Quelle.
CR-SM-327 fügt die Regel MT-04 (LCOM4 an der FUNC-Whitebox) hinzu: contracts zählt 67 Engine-Regeln,
drei Artikel und die Canary-Liste nennen 66. Der Test ist rot — genau so gedacht: er singt beim
contracts-Bump, damit jemand die Artikel liest.

## 2. Impact

graphcode-Suite rot (2 Tests), sobald graphcode das contracts mit MT-04 liest (Lokal-Modus heute, nach
dem Release überall). Die Artikel behaupten eine falsche Zahl.

## 3. Fix

`66 engine rules` → `67` in docs/articles/03 (Z. 34), 04 (Z. 146), 06 (Z. 103); Canary-Liste im Test mit
Herkunftszeile nachgezogen. Keine andere der sechs Zahlen bewegt sich.

## 4. Akzeptanzkriterien

- [x] Test rot gegen heute: 3 Artikelstellen + Canary nennen 66, live 67.
- [x] `claims.conformance` grün; Suite grün. (Zwischendurch rot: der Herkunftskommentar nannte den
      Konstantennamen des Regelkatalogs und machte die Datei damit „modellrelevant“ für CR-GC-399 —
      umformuliert, der Test liest die Konstante nicht.)

## 5. Dateien

`docs/articles/03-graphcode-harness-goal-and-concept.md` · `docs/articles/04-the-graphcode-story.md` · `docs/articles/06-claims.md` · `tests/claims.conformance.test.ts` · dieser CR
