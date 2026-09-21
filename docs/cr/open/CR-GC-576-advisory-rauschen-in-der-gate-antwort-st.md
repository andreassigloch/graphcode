# CR-GC-576: Die Advisories der Gate-Antwort melden ueberwiegend, dass nichts passiert ist

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-418 (finding)
**Erstellt:** 2026-09-21
**Item:** bok/items/ITEM-2026-418.json (Lane: graph)

---

## 1 Befund (gemessen, `runs/opus5-5`, 23 Gate-Antworten)

| Block | Stueck | davon leer | Zeichen | davon leer | Anteil der Antwort |
|---|---:|---:|---:|---:|---:|
| `fitAdvisory` | 21 | **12** | 11.921 | 6.176 | 6,5 % |
| `steerAdvisory` | 21 | **21** | 4.788 | 4.788 | 2,6 % |
| `workOrder` | 21 | 18 | 6.486 | 1.026 | 3,5 % |
| `steeringDelta` | 12 | 0 | 6.903 | — | 3,8 % |
| **Summe** | | | **30.098** | **11.990** | **16,4 %** |

„Leer" heisst hier belegbar nichts-gesagt: `fitAdvisory` mit Null-Delta ueber alle sechs
Dimensionen und ohne Regression; `steerAdvisory` mit `before === after === improvement === 0`;
`workOrder` ohne `moves` und ohne `blind`.

**`steerAdvisory` war in 21 von 21 Faellen durchgehend null.** Nicht „meistens" — immer. Das
Steuersignal aus CR-GC-483 hat in diesem Lauf kein einziges Mal etwas gemeldet und trotzdem
4.788 Zeichen belegt.

Dass die leeren so teuer sind, liegt an der Form: `fitAdvisory` traegt drei Arrays zu sechs
Dimensionen, und mit Einrueckung 2 wird jede Null eine eigene Zeile — 515 Zeichen dafuer,
dass sich nichts geaendert hat. Ein leerer `workOrder` kostet dagegen nur 57.

## 2 Zug

Einen Advisory-Block **weglassen, wenn er nichts meldet**. Nicht kuerzen, nicht auf null
setzen — das Feld faellt weg.

Das ist keine Information, die verloren geht: „kein Feld" und „Feld mit lauter Nullen" sagen
dasselbe, und der Aufrufer, der doch das Null-Delta braucht, liest es aus `graph_metrics` oder
`graph_readiness`. Der Unterschied ist, dass die Aussage „hier hat sich nichts geruehrt" dann
null Zeichen kostet statt 515.

**Offen und vor dem Bau zu entscheiden:** `steerAdvisory` 21-mal leer ist kein Formatproblem,
sondern ein Befund ueber die Sache selbst. Entweder misst es das Falsche, oder es misst im
falschen Moment. Bevor es nur noch bedingt gesendet wird, sollte an einem zweiten Lauf geklaert
sein, ob es ueberhaupt je etwas meldet — sonst wird ein totes Signal bloss leiser gemacht.
Das gehoert zu CR-GC-575 (streichen, was gemessen nichts traegt), nicht hierher.

## 3 Akzeptanzkriterien

1. Ein Advisory-Block ohne Aussage erscheint gar nicht in der Antwort.
2. Ein Advisory MIT Aussage erscheint unveraendert — Test mit erzwungener Regression und mit
   einer wandernden `allocate`-Kante (`workOrder.moves`).
3. Die Definition von „ohne Aussage" steht an genau einer Stelle je Block, nicht verstreut.
4. Gegen `runs/opus5-5` nachgespielt fallen mindestens 11.990 Zeichen weg.

## 4 Reihenfolge

**Nach CR-GC-579** (kompakt serialisieren). Die 6,5 % oben sind gegen die eingerueckte Antwort
gemessen; kompakt serialisiert schrumpft der Block ohnehin um etwa ein Fuenftel, und die
Zahlen dieser CR sind dann neu zu erheben statt zu addieren.
