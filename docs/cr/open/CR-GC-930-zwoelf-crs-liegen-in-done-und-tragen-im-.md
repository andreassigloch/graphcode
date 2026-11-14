# CR-GC-930: Zwoelf CRs liegen in done und tragen im Kopf Status Open

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1347 (finding)
**Erstellt:** 2026-11-14
**Item:** bok/items/ITEM-2026-1347.json (Lane: code)

---

## Befund

28 CRs liegen in `docs/cr/done/` und tragen in den ersten 8 Zeilen einen Status mit „Open", ohne „Done",
„Closed", „Erledigt" oder „Verworfen" (Skript, 2026-11-14):

CR-GC-207, 208, 209, 210, 211, 212, 214, 215, 216, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229,
230, 231, 232, 233, 234, 235, 241, 299.

Der Ordner entscheidet über den Status (BOK-CR-080), die Kopfzeile widerspricht ihm. Beim Scan der CRs in
die FAQ haben neun Prüfer den Widerspruch je einzeln gemeldet und nicht gewusst, ob der CR gilt.

Herkunft: einmaliger Scan der geschlossenen CRs in die FAQ (CR-AB-005, aise-bok), Abschnitt „Kandidaten für Vorschläge des Agenten". Vorschlag des Agenten, vom Auftraggeber nicht freigegeben. Der Titel nennt zwölf; das Skript fand 28.

## Vorschlag

Zwei Wege, der Auftraggeber wählt:

1. **Kopfzeile nachziehen.** Je Datei „Status: Done" mit dem Datum des Commits, der sie nach `done/` brachte.
   Ein mechanischer Zug über 28 Dateien, ein CR.
2. **Kopfzeile abschaffen.** `aise` schreibt keinen Status mehr in die Datei, und ein Test verbietet die
   Zeile. Dann gibt es eine Wahrheit, den Ordner. Das ändert `aise` (bok) und ist ein eigener CR dort.

Vor dem Zug je CR prüfen, ob er wirklich umgesetzt ist: CR-GC-209 gilt in der FAQ `cr-dateigrenze-zahl` als
noch offen.

## Abnahme

- [ ] Kein CR in `done/` trägt „Open" im Kopf (Skript als Test in der Modell-Spur).
- [ ] Jeder CR, der nicht umgesetzt ist, liegt wieder in `open/` oder ist als verworfen markiert.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|

keine, bis der Auftraggeber über den Vorschlag entschieden hat.

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
