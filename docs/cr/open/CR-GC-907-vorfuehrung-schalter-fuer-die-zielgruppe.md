# CR-GC-907: Vorfuehrung: Schalter fuer die Zielgruppe im Artefakt Systemmodell in Bildern

**Status:** 🟠 Open
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
