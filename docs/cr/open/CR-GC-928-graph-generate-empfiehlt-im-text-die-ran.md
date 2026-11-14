# CR-GC-928: graph_generate empfiehlt im Text die Rangfolge verdictRank, die der Spike zu CR-GC-771 widerlegt hat (src/loop/generate.ts:137)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1047 (finding)
**Erstellt:** 2026-11-14
**Item:** bok/items/ITEM-2026-1047.json (Lane: code)

---

## Befund

`src/loop/generate.ts:137` setzt in das Protokoll des Schritts den Text der Entscheidung `verdictRank`
(Rangfolge der Kandidaten). CR-GC-771 hält fest: Der Spike hat diese Rangfolge widerlegt, bei Strukturfragen
wählt der Autor. Der Rest ist als ITEM-2026-1047 seit 2026-10-25 gemeldet.

Herkunft: einmaliger Scan der geschlossenen CRs in die FAQ (CR-AB-005, aise-bok), Abschnitt „Kandidaten für Vorschläge des Agenten". Vorschlag des Agenten, vom Auftraggeber nicht freigegeben. Den Spike und den Text der Entscheidung `verdictRank` im Register habe ich für diesen CR nicht
nachgelesen. Der Befund stützt sich auf CR-GC-771 und das Item.

## Vorschlag

Der Hinweis nennt keine Rangfolge mehr. Er sagt: Kandidaten proben, bei mehreren zulässigen dem Autor
vorlegen (FAQ `vorschlaege-nicht-automatisch`, CR-GC-781). Die Entscheidung `verdictRank` im Register entfällt,
wenn sie keinen anderen Leser hat.

## Abnahme

- [ ] Test zuerst rot: Der Protokolltext von `graph_generate` enthält keine Rangfolge.
- [ ] `graph_impact` auf die Funktion, die den Protokolltext baut; `graph_tests` für die Testspur.
- [ ] Kein zweiter Ort nennt die Rangfolge (Skills, `graph_help`).

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
