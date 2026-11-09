# CR-GC-894: se-irr: Annahmen über fremde Datenquellen mit Zählabfrage belegen

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1270 (finding)
**Erstellt:** 2026-11-09
**Item:** bok/items/ITEM-2026-1270.json (Lane: code)

---

Befund aus immo-infra, gemessen an den Sitzungsprotokollen 2026-10-23..11-09. se-irr lief zweimal in der Modellierung und fand die Lücken der fremden Datenquelle PropStack nicht. Sie kamen erst am 2026-11-07 mitten im Bau als vier Rückfragen: alle 89 laufenden Objekte gehören einem einzigen PropStack-Nutzer (ein Makler-Konto sähe 0 Objekte); 28 von 121 Objekten ohne Status, 32 abgeschlossen; das Gate lieferte 15 von 264 Feldern; der Leseschlüssel bekam bei /contacts 401. Folge: CR-INF-112, -113, -118..120 und ein Namensdienst auf dem VPS.

Root Cause: se-irr §1 sucht Annahmen nur in Texten, die schon im Modell stehen (REQ/FUNC-Beschreibung, Regelwarnungen). Die Form einer fremden Quelle steht dort nicht als Behauptung, also findet die Skill nichts.

## Änderung (Skill-Text `.claude/commands/se-irr.md`)
1. Neuer Schritt in §1: jede Schnittstelle zu einer fremden Quelle durchgehen (ACTOR oder externes System mit io-FLOW, deren SCHEMA). Je Quelle fragen: Wurde die echte Quelle schon abgefragt?
2. Beleg ist eine Abfrage, die nur Zahlen liefert: Anzahl je Status/Typ, Anzahl verschiedener Zuständiger, Felder mit Wert, Antwortcode je benötigtem Endpunkt mit dem vorgesehenen Schlüssel. Nie Namen, Adressen oder Freitext (Kundendaten erreichen kein Modell).
3. Jede Abweichung von der Annahme im Modell wird eine Zeile der Liste in §2 (Annahme, was bricht, Beleg, Empfehlung).
4. Ohne Zugang zur Quelle: die Annahme als offen führen, Beleg „none“, und den fehlenden Zugang an se-conops (Zugangsliste) melden.

## Akzeptanzkriterien
- se-irr.md nennt den Schritt „fremde Quellen“ mit der Liste der Zählgrößen und dem Verbot von Inhalten.
- Ein Test in `tests/` hält die Pflichtstellen der Skill fest (wie `tests/task-analysen.test.ts`).
- Gegenprobe am Befund: Mit der Skill hätte der Lauf in immo-infra die vier Abweichungen vor se-plan gelistet.

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** kein Host in /Users/andreas/Developer/dev/graphcode (keine host.sock).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
