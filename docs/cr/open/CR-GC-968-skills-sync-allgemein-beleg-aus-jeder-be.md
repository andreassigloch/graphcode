# CR-GC-968: Skills: sync allgemein, Beleg aus jeder Beschreibung der Realisierung, Rückfrage

**Typ:** aus Item ITEM-2026-1498 (idea)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1498.json (Lane: code)

---

## Anlass

Die FAQ-Pflege fand am 2026-11-20 (Kandidat 1 in `aise-bok/docs/pflege/konflikte-2026-11-20.md`): se-vorbereitung verlangt für `sync` einen Beleg mit Datei und Zeile, sagt aber nicht, was der Beleg in einem Modell ohne Code ist. In sirail (CR-SR-040) setzte der Skill drei Flüsse aus Spezifikation und Protokoll.
Vorgabe des Autors: Ob der Abnehmer auf ein logisches oder ein physisches Ereignis wartet, ist dasselbe Prinzip. Code ist eine Beschreibung der Realisierung unter mehreren (Schaltplan für Elektrik, Zeichnung für Mechanik …).

Zwei Sätze widersprachen dem Prinzip: se:top-level Regel 7 („A callback, an event or a file that someone reads later is `async`“) und se-vorbereitung Schritt 3 („Ein Rückruf, ein Ereignis oder eine Datei … heißt Nein“). Beide ließen den Übertragungsweg entscheiden statt das Warten.

## Umsetzung

- `.claude/commands/se-vorbereitung.md` (Version 13), Schritt 3: Der Übertragungsweg entscheidet nicht. Beispieltabelle für Software, Ereignis, Elektrik, Mechanik, Hydraulik und Organisation. Beleg aus der Beschreibung der Realisierung: Code, Schaltplan, Protokoll oder Datenblatt, Zeichnung oder eine REQ, die das Verhalten fordert. Fehlt jeder Beleg, fragt der Skill den Autor; ohne Autor (headless) bleibt das Merkmal leer. Dazu die Folge eines falschen Werts (`async` statt `sync` meldet keine Regel).
- `.claude/commands/se/top-level.md` (Version 14), Regel 7: dieselbe Aussage auf Englisch, Verweis auf die Tabelle.
- Tests: `tests/skill-top-level-ausloeser.test.ts` (vier neue Fälle), `tests/skill-faq-ergaenzung.test.ts` Nr. 10 und `tests/skill-faq-angleich.test.ts` (Version). Die vier neuen Fälle und Nr. 10 waren vor der Änderung rot (Text fehlte), danach grün. `npm run verify:code`: 59 Dateien, 553 Tests grün.

Kein Default `sync`: `sync-async-pflicht` Punkt 4 und `kein-stiller-default` bleiben. Keine REQ je async-Fluss: eine REQ belegt den Wert nur, wo die Entkopplung gefordert ist. RC-12 und FC-06 bleiben unverändert; RC-12 prüft nur den Fall Code. Die FAQ (`sync-async-bedeutung`, `sync-async-ablage`, `fluss-nur-mit-codebeleg`) gleicht der Nachtlauf über `VORGABEN.md` an.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| Wonach richtet sich `sync`, und was belegt den Wert? | Allein danach, ob der Abnehmer auf die Lieferung wartet, gleich über welchen Weg (Rückgabewert, Rückruf, Nachricht, Signal, Druck, Kraft). Beleg ist die Stelle in der Beschreibung der Realisierung (Code, Schaltplan, Protokoll, Datenblatt, Zeichnung, REQ); fehlt sie, antwortet der Autor. | Vorgabe des Autors 2026-11-21: logisches und physisches Ereignis folgen demselben Prinzip; Code ist ein Fall. |

---

## Umfang

`CR-GC-968 -relation-> FUNC-se-vorbereitung, FUNC-se-top-level` (graphVersion 1349). Nur Skill-Text und seine Konformanztests; kein Quellcode.
