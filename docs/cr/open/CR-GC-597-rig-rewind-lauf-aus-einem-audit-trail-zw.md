# CR-GC-597: Rig-Rewind: Lauf aus einem Audit-Trail-Zwischenstand starten (erste n angewandte Zuege durchs Gate nachspielen) — gezielter Endspiel-Test fuer einen Bruchteil der Kosten eines Volllaufs

**Status:** ✅ Umgesetzt
**Typ:** aus Item ITEM-2026-448 (idea)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-448.json (Lane: graph)

---

## Umsetzung (2026-09-22)

`run.mjs`: `REWIND_AUDIT` + `REWIND_MOVES` (nur zusammen — ein halber Rewind waere ein stiller
Volllauf). Statt des SYS werden die ersten n angewandten Zuege eines frueheren Laufs durchs heutige
Gate nachgespielt (`ersteZuege`, dieselbe Lesart wie `trajektorie.spieleNach`); lehnt das heutige
Gate einen alten Zug ab, bricht der Rewind laut ab statt mit einem anderen Stand weiterzulaufen.
Test in `systemtest-rig.test.ts`. Erster Einsatz: Endspiel von Lauf 11 ab Zug 18 (CR-GC-596).
**Kongruenz:** benannte Ausnahme.
