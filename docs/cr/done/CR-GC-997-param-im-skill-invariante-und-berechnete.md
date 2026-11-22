# CR-GC-997: PARAM im Skill: Invariante und berechneter Wert bekommen ein Zod-Schema im Vertragspaket, der Test prueft das Ergebnis dagegen; Einheit als UCUM-Code (Festlegung CR-SM-419, 2026-11-22)

**Typ:** aus Item ITEM-2026-1565 (idea)
**Erstellt:** 2026-11-22
**Item:** bok/items/ITEM-2026-1565.json (Lane: code)

---

## Befund

Die Skills nennen die Einschränkung eines Parameters nur im Satz der Anforderung. Sie sagen nicht, welche
Stelle die Quelle ist. Für Invariante und berechneten Wert nennen sie keinen Ort, von dem der Test die Grenze
liest. Die Einheit ist freier Text.

## Zielbild

Festlegung des Autors vom 2026-11-22 (sigloch-modules, CR-SM-419):

- Das Zod-Schema ist die Quelle der Einschränkung. Die Klammer in der Anforderung wiederholt sie lesbar.
- Invariante und berechneter Wert bekommen ein eigenes Zod-Schema im Vertragspaket. Der Test prüft das
  gemessene Ergebnis dagegen und trägt keine eigene Zahl.
- Die Einheit ist ein UCUM-Code.

## Änderungen

| Datei | Änderung |
|---|---|
| `.claude/commands/se/author-req.md` | Version 9: Absatz zu Quelle, Zod-Schema und UCUM |
| `.claude/commands/se-conops.md` | Version 13: Einheit als UCUM-Code in der Prüfliste |
| `.claude/commands/se-bau.md` | Version 7: Absatz unter der Tabelle „Geprüft im" |
| `tests/skill-wortlaut-angleich.test.ts` | 6 Tests, alle vorher rot |
| `tests/skill-bau.test.ts` | Version 7 |

## Akzeptanzkriterien

- [x] Die 6 neuen Tests waren vor der Änderung rot und sind danach grün.
- [x] Die 32 Testdateien zu den Skills sind grün.

Nicht in diesem CR: Elementtyp, Regel und FAQ. Die Auslieferung der Skills folgt mit dem nächsten Zug.

---

## Entscheidungen

Keine. Der CR wendet die Festlegung aus CR-SM-419 an.

---

## Umfang laut `graph_impact`

Kein Schnitt aus dem Modell: Der CR ändert drei Skill-Texte und zwei Testdateien, keinen Knoten.
