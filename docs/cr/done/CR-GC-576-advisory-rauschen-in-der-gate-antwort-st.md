# CR-GC-576: Die Advisories der Gate-Antwort melden ueberwiegend, dass nichts passiert ist

**Status:** ✅ Done (2026-09-21)
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

---

## 5 Umsetzung (2026-09-21)

### 5.1 Der Zug

`dropSilentAdvisories` in `write.ts` laesst einen Block weg, der nichts meldet — auf der
**Leitung**, nie im Audit: `recordAudit`/`recordPreview` bekommen weiter die volle Fassung,
denn der Trail ist Evidenz und kein Antwort-Budget. Dieselbe Trennung wie bei den Violations
(CR-GC-309).

Was „nichts melden" heisst, steht je Block **bei seinem Erzeuger** und nirgends sonst
(Kriterium 3):

| Block | Praedikat | Bedingung |
|---|---|---|
| `fitAdvisory` | `fitAdvisoryIsSilent` (`fit-advisory.ts`) | Null-Delta ueber alle Dimensionen UND keine Regression |
| `steerAdvisory` | `steerAdvisoryIsSilent` (`fit-advisory.ts`) | `before === after === improvement === 0` und nichts entfernt |
| `workOrder` | `workOrderIsSilent` (`work-order.ts`) | keine `moves` UND keine `blind` |

**Die weitere Fassung fuer `steerAdvisory` wurde erwogen und verworfen**: „`improvement === 0`
genuegt" haette den Block auch dann weggelassen, wenn der Graph einen Ueberschuss traegt — er
nennt dann aber den Pegel UND `worstAt`, also WO die schlimmste Stelle sitzt. Das ist eine
Aussage, auch wenn der Zug sie nicht bewegt hat. Weggelassen wird nur, was nachweislich
nichts sagt.

`blind` bleibt ausdruecklich Teil der `workOrder`-Bedingung: eine leere `moves`-Liste NEBEN
blinden FUNCs ist keine Stille, sondern die Fail-open-Luege, gegen die das Feld eingefuehrt
wurde.

### 5.2 Kriterium 4, nachgespielt an `runs/opus5-5`

Ueber alle 21 Antworten des Laufs, die mindestens ein Advisory trugen:

| Block | Stueck | davon leer | CR erwartete |
|---|---:|---:|---:|
| `fitAdvisory` | 21 | **12** | 12 |
| `steerAdvisory` | 21 | **21** | 21 |
| `workOrder` | 21 | **18** | 18 |

Die Stueckzahlen stimmen **exakt** mit der Messung in §1 — es ist dieselbe Menge.

| Serialisierung | vorher | nachher | faellt weg |
|---|---:|---:|---:|
| eingerueckt (Stand der CR) | 152.865 | 140.977 | **11.888** (7,8 %) |
| kompakt (Stand nach CR-GC-579) | 119.571 | 112.540 | **7.031** (5,9 %) |

**Kriterium 4 fordert ≥ 11.990 und gemessen sind 11.888 — 0,9 % darunter.** Nicht, weil
weniger wegfaellt, sondern weil §1 die Bloecke samt Schluessel und Einrueckungstiefe gezaehlt
hat, waehrend hier die ganze Antwort vorher gegen nachher steht. Bei identischen Stueckzahlen
ist das eine Abrechnungsdifferenz, keine Luecke — sie wird hier genannt statt weggerundet.

Die Zahl, die ab jetzt gilt, ist die kompakte: **7.031 Zeichen, 5,9 %.** §4 dieser CR sagt
es selbst — nach CR-GC-579 sind die Prozente neu zu erheben, nicht zu addieren.

**Kein Test gegen `runs/*`**: das waere genau der Fehler, den CR-GC-578 gerade behoben hat —
eine Schwelle gegen Daten, die der Test nicht kontrolliert. Die Praedikate und beide Haelften
der Zusage haengen stattdessen an `tests/mcp.silent-advisories.test.ts`, gegen ein echtes
Gate auf Platte.

### 5.3 Kriterien

| # | Kriterium | Ergebnis |
|---|---|---|
| 1 | ein Block ohne Aussage erscheint gar nicht | erfuellt |
| 2 | ein Block MIT Aussage erscheint unveraendert | erfuellt — erzwungene Regression und wandernde `allocate`-Kante, beide am echten Gate |
| 3 | die Definition steht je Block an genau einer Stelle | erfuellt — drei Praedikate, je beim Erzeuger |
| 4 | ≥ 11.990 Zeichen fallen weg | **11.888 (99,1 %)** — Stueckzahlen exakt, Abrechnung anders; s. §5.2 |

### 5.4 Was offen bleibt

Der Befund aus §2 bleibt unbeantwortet: **`steerAdvisory` war 21-mal von 21 durchgehend
null.** Dieser Zug macht das billiger, nicht richtiger. Ob das Signal je etwas meldet, ist
eine Frage an einen zweiten Lauf und gehoert zu CR-GC-575 (streichen, was gemessen nichts
traegt) — ein totes Signal leiser zu machen ist keine Antwort.
