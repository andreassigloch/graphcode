# CR-GC-595: Systemtest-Bericht zaehlt Abnahmen (acceptedFindings) je Lauf und Regel — sonst faellt eine erschlichene Freigabe nicht auf

**Status:** ✅ Done (2026-09-22)
**Typ:** aus Item ITEM-2026-446 (idea)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-446.json (Lane: graph)

---

## Umsetzung (2026-09-22)

`trajektorie.profil()` zaehlt `acceptedFindings` je Regel am Endgraphen; der Abschnitt "Endgraph
gegen Golden" hat die Spalte "Abnahmen" und erklaert, dass eine Abnahme an einer Architekturregel
fuer die Freigabe nicht zaehlt — steht sie dort, hat der Agent es versucht. Test in
`systemtest-rig.test.ts`. **Kongruenz:** benannte Ausnahme.
