# CR-GC-904: EARS als Vorbild im Skill se:author-req statt Modalverb-Form (CR-SM-431)

**Status:** ✅ Done (2026-11-11)
**Typ:** aus Item ITEM-2026-1288 (idea)
**Erstellt:** 2026-11-11
**Item:** bok/items/ITEM-2026-1288.json (Lane: code)

---

**Bezug:** Entscheidung des Auftraggebers in sigloch-modules CR-SM-431 (2026-11-11), Punkt 4.
Begleitend: sigloch-modules CR-SM-433 streicht die Regel BQ-06 (Modalverb-Pflicht).

## Befund

Der Skill `se:author-req` schreibt als Satzform „The system shall …" / „Das System muss …" vor. Diese
Form stützt nur BQ-06, die gestrichen wird. Sie sagt nicht, wer handelt, worauf er reagiert und was
er liefert. Der Auftraggeber hat entschieden: EARS als Vorbild im Skill, keine Regel.

## Zielbild

1. Der Skill zeigt die fünf EARS-Muster (immer, bei Ereignis, im Zustand, bei Störung, optional) je
   mit einem Beispiel aus graphcode.
2. Das Subjekt ist der Träger der satisfy-Kante. Auslöser und Ergebnis einer funktionalen REQ sind
   die Flüsse der erfüllenden FUNC.
3. Die Zahl steht in der Anforderung. Der Test prüft sie, er liefert sie nicht (CR-SM-431, Punkt 1).
4. Die Modalverb-Vorgabe entfällt, auch in den Platzhaltern der Format-E-Beispiele.

## Akzeptanz

- [x] Der Skilltext enthält die fünf Muster mit je einem Beispiel und keine Modalverb-Vorgabe.
- [x] Die Tests, die den Skill lesen, sind grün: `verify:code` wählt für eine Skilldatei nichts aus, deshalb direkt gefahren (skill-constraints, skill-rule-ids, generate, cli.scaffold: 4 Dateien grün).

## Nicht Ziel

- Keine Regel. Die Kopien in sigloch-modules kommen beim nächsten Upgrade.

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

- `FUNC-author-req` (realRef `.claude/commands/se/author-req.md`): die einzige geänderte Datei neben diesem CR.

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
