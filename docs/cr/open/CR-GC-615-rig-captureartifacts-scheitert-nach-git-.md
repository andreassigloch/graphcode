# CR-GC-615: Rig captureArtifacts scheitert nach Git-Aktionen des Agenten an Export-Drift (opus5-16: graph_export refused, Ergebniszeile fehlt)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-473 (bug)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-473.json (Lane: code)

---

## Befund (Rewind-Lauf opus5-16, 2026-09-22)

Nach den Git-Aktionen des Agenten verweigert `graph_export` beim Erfassen der Ergebnisse den Export wegen Drift
(Schutz gegen das Überschreiben durch einen veralteten Prozess). `captureArtifacts` bricht ab, und die Ergebniszeile
des Laufs fehlt — der Lauf ist gefahren und bezahlt, aber nicht ausgewertet.

## Zielbild

Das Erfassen darf nicht an einem Schutzmechanismus scheitern, der für Schreibzüge gedacht ist. Entweder liest das Rig
den Stand, ohne zu exportieren, oder es erfasst den Exportfehler als Befund und schreibt die Ergebniszeile trotzdem.
Nicht akzeptabel: ein Lauf ohne Ergebnis.

## Akzeptanzkriterien

- [ ] Ein Lauf, in dem `graph_export` verweigert, liefert trotzdem eine vollständige Ergebniszeile; der Exportfehler
      steht als Feld darin.
- [ ] Test mit einem Arbeitsbereich, dessen Store gegenüber der committeten SSOT gedriftet ist.
- [ ] Testsuite grün.

**Achtung:** Am Rig arbeitet zeitweise eine parallele Sitzung — vor dem Start `git status` in `rig/` prüfen.

