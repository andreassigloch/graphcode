# CR-GC-907: Vorfuehrung: Schalter fuer die Zielgruppe im Artefakt Systemmodell in Bildern

**Status:** ✅ Done (2026-11-12)
**Typ:** aus Item ITEM-2026-1292 (idea)
**Erstellt:** 2026-11-11
**Item:** bok/items/ITEM-2026-1292.json (Lane: graph)

---

## Ziel

Ein Schalter oben im Artefakt `docs/project/systemmodell-in-bildern.html` wählt die Zielgruppe:
Theorie · Spezifikation · Code · Alle. Er blendet die Bausteine ein, die `docs/project/vorfuehrung-bausteinkonzept.md` der Zielgruppe
zuordnet (● zeigen, ○ eingeklappt, – ausgeblendet).

## Abnahmekriterien

1. Je Zielgruppe sichtbar: genau die Bausteine der Tabelle im Konzept, in der Reihenfolge der
   Zielgruppe.
2. „Alle" zeigt den Stand vor diesem CR.
3. Die Wahl übersteht ein Neuladen (Browser-Speicher, mit try/catch; ohne Speicher Start auf „Alle").
4. Je Zielgruppe ein Screenshot als Beleg.

## Umfang

1 Datei: `docs/project/systemmodell-in-bildern.html`. Kein Modell, kein Code.

## Kette

Hängt an CR-GC-906: Die Bausteine I1 und E2 müssen stehen, bevor der Schalter sie zuordnet.

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.

---

## Ergebnis (2026-11-12)

Schalter „Für wen: Theorie · Spezifikation · Code · Alle“ oben im Artefakt. Jeder Baustein ist ein
eigener Abschnitt (`section.bs`). Der Schalter ordnet die Abschnitte um, blendet aus und klappt
○-Bausteine ein („Bei Nachfrage · Aufklappen“). Kapitelnummern und Inhaltsverzeichnis folgen der
sichtbaren Reihenfolge. D1, D2 und D4 sind kurze Abschnitte, je mit dem Test der Leitlinie und
seinem Stand.

Reihenfolge je Zielgruppe (● gezeigt, ○ eingeklappt), im Browser ausgelesen:

| Zielgruppe | Abschnitte |
|---|---|
| Theorie | I1● E1● E2● E4● D1● E3● E6● D2● E5○ |
| Spezifikation | I1● E2● E5● D1● D3● E1○ E3○ E7○ D2○ |
| Code | I1● E7● E5● D2● D4● E2○ E3○ E4○ E6○ D1○ |
| Alle | I1 E3 E2 E4 E5 E6 E7 E1 D1 D2 D3 D4, alle gezeigt |

Abnahme:
1. ✓ Je Zielgruppe genau die Bausteine der Tabelle im Konzept. Zuerst kommt der Pfad der
   Zielgruppe, danach die übrigen ●-Bausteine, zuletzt die ○-Bausteine. Das Konzept widerspricht
   sich bei Theorie: Der Pfad nennt 5 Bausteine, die Tabelle markiert zusätzlich E3, E6 und D2 mit ●.
   Gezeigt wird nach der Tabelle, also 8 Bausteine. Damit verfehlt Theorie das Kriterium
   „höchstens 5 Bausteine“ aus dem Konzept. Ob E3, E6 und D2 auf ○ gehen, entscheidet der Autor.
2. ✓ „Alle“ zeigt jeden Baustein, in der Reihenfolge des Artefakts.
3. ✓ Die Wahl steht in `localStorage` (try/catch). Spezifikation gewählt, neu geladen, Spezifikation
   aktiv. Ohne Speicher startet die Seite auf „Alle“.
4. ✓ Screenshots je Zielgruppe im Lauf geprüft (nicht eingecheckt): Theorie und Code Kopf mit
   Inhaltsverzeichnis, Spezifikation Kopf, E2 und D3 hell und dunkel, ein eingeklappter Baustein (E5
   bei Theorie).
