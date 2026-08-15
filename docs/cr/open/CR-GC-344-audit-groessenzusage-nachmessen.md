# CR-GC-344 — Die Audit-Größenzusage stimmt nicht mehr: nachmessen oder verbessern

**Status:** open · **Angelegt:** 2026-08-15 · **Max Files:** 6 (dieser CR: 1–2)
**Herkunft:** CR-GC-338 §3 „Nicht-Ziele" — dort bewusst herausgeschnitten, weil es eine
Entscheidung ist und keine Reparatur.

## Problem

`tests/audit.trail-projection.test.ts` fordert, dass eine Default-Antwort über den Repo-Trail
**~89 % kleiner** ist als die Rohdaten. Gemessen auf dem aktuellen Trail:

| | |
|---|---|
| Rohdaten | 331,1 KB |
| projiziert | **38,7 KB** |
| Reduktion | **88,3 %** |
| gefordert | ≥ 89 % (≤ 37,3 KB) |

Die Zusage reißt um **1,4 KB** bzw. 0,7 Prozentpunkte.

**Das ist Drift auf echten Daten, kein Defekt.** Der Trail wächst mit jeder Mutation; die
Projektion wurde einmal gegen einen kleineren Trail kalibriert. Nichts an der Projektion ist
kaputt gegangen — sie hält ihre Zusage nur nicht mehr.

Belegt unabhängig von contracts 4.x: der Fall war schon rot, **bevor** die Familie umgestellt
wurde (Messung 2026-08-14 und 2026-08-15, identisches Ergebnis).

## Warum das eine Entscheidung ist

Zwei ehrliche Wege, und die Wahl gehört nicht in einen Migrations-CR:

1. **Zusage nachmessen.** Die 89 % waren eine Momentaufnahme. Wenn 88 % die Realität eines
   gewachsenen Trails sind, gehört die Zahl korrigiert — mit dem Datum der Messung daneben,
   damit die nächste Drift wieder auffällt.
2. **Projektion verbessern.** Wenn 89 % die Zusage bleiben soll, muss die Projektion mehr
   weglassen. Das ist echte Arbeit an `audit_trail` und ändert, was ein Konsument zu sehen
   bekommt.

**Was ausscheidet:** die Schwelle stillschweigend absenken, bis der Test grün ist. Dann prüft er
nichts mehr — er nickt ab, was gerade herauskommt.

## Vorschlag

Weg 1, mit einer Ergänzung: die Zusage relativ zur Trail-Größe formulieren statt absolut. Eine
Reduktionszusage, die mit dem Trail wächst, driftet nicht — heute ist sie eine Zahl, die ab dem
Tag ihrer Messung veraltet.

## Akzeptanzkriterien

- [ ] Die Zusage steht mit **Messdatum und Trail-Größe** daneben, gegen die sie kalibriert wurde.
- [ ] Der Test schlägt weiterhin fehl, wenn die Projektion *schlechter* wird — die Gegenprobe,
      dass die neue Schwelle nicht bloß den Ist-Zustand abnickt.
- [ ] Falls Weg 2: der Nachweis, was zusätzlich weggelassen wird und warum ein Konsument es
      nicht braucht.

## Betroffene Dateien

| Datei | Änderung |
|---|---|
| `tests/audit.trail-projection.test.ts` | Zusage + Herkunft |
| `src/audit-projection.ts` (nur bei Weg 2) | mehr weglassen |
