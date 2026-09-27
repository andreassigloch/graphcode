# CR-GC-699: CI rot: tests/rig-measured.test.ts (CR-GC-496) stat .graphcode/kuzu ENOENT auf dem Runner — Test setzt lokalen Store voraus (Clean-Machine-Klasse)

**Status:** ✅ Done (2026-09-27)
**Typ:** aus Item ITEM-2026-187 (bug)
**Erstellt:** 2026-09-27
**Item:** bok/items/ITEM-2026-187.json (Lane: code)

---

_(kein Body im Item — Befund/Zielbild hier ausarbeiten, BEVOR die Lane startet)_

---

## Befund

CI-Lauf 36318209067 (Release-Commit 0.26.0): 1 von 1687 Tests rot, genau dieser —
`statSync('.graphcode/kuzu')` ENOENT. Der Test prueft „der Live-Store des echten Repos wurde nicht
angefasst" per mtime und setzt damit einen Live-Store voraus; auf dem Runner gibt es keinen.

## Umfang

1 Datei: `tests/rig-measured.test.ts` (reine Testaenderung, kein Modellknoten betroffen).

## Ergebnis

Die Invariante gilt jetzt in beide Richtungen: der Stempel ist die mtime ODER `null`, wenn kein
Live-Store existiert — war keiner da, darf `openMeasured` auch keinen anlegen. Die Pruefung ist
damit nicht abgeschwaecht, sondern auf der frischen Maschine erstmals ueberhaupt wirksam.

## Akzeptanz

- [x] Rot reproduziert in einem frischen Worktree ohne `.graphcode/kuzu` (alter Stand: ENOENT wie im CI).
- [x] Derselbe Worktree mit der Aenderung: 12/12 gruen; lokal mit Live-Store 12/12.
- [ ] CI gruen — naechster Push.
