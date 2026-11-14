# CR-GC-929: CLAUDE.md nennt den CR-Knoten statuslos, seit BOK-CR-080 spiegelt aise cr close den Status an den Knoten

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1346 (finding)
**Erstellt:** 2026-11-14
**Item:** bok/items/ITEM-2026-1346.json (Lane: code)

---

## Befund

`CLAUDE.md`, Abschnitt „CR-Modus: graph", sagt: „status derives from `open/`/`done/`, the node stores none."
Seit BOK-CR-080 (2026-11-09) gilt: Der Ordner entscheidet, und `aise cr close` spiegelt `status` an den
Knoten. BOK-CR-080 hat die Gegenaussage in `bok/docs/governance/ITEM-UND-CR.md` gelöscht, die Zeile hier
blieb stehen. Nachgelesen in BOK-CR-080, Punkt 2.

Herkunft: einmaliger Scan der geschlossenen CRs in die FAQ (CR-AB-005, aise-bok), Abschnitt „Kandidaten für Vorschläge des Agenten". Vorschlag des Agenten, vom Auftraggeber nicht freigegeben.

## Vorschlag

Der Satz lautet: „status derives from `open/`/`done/`; `aise cr close` mirrors it onto the node."
Hängt an CR-SM-440 (sigloch-modules): Fällt dort `commitRef`, ändert sich an diesem Satz nichts.

## Abnahme

- [x] `CLAUDE.md` Zeilen 7-8 nennen den Spiegel; die Klammer „(id, title, scope edges)" nennt jetzt auch `status`. `tests/claude-md-cr-knoten.test.ts` (vorher 2 von 2 rot) belegt es. Premise geprüft an `bok/docs/governance/ITEM-UND-CR.md` Zeilen 13 und 24.
- [ ] FAQ `cr-knoten-status` (aise-bok) zitiert diesen CR. Offen: liegt in einem anderen Repo, nicht Teil dieses Auftrags.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|

keine.

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
