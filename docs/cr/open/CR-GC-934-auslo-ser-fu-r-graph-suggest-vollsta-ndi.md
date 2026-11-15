# CR-GC-934: Auslöser für graph_suggest vollständig festlegen

**Typ:** aus Item ITEM-2026-1359 (idea)
**Erstellt:** 2026-11-15
**Item:** bok/items/ITEM-2026-1359.json (Lane: code)

---

**Status:** Vorschlag, nicht umgesetzt. Die Lösung ist offen und entsteht in einer eigenen Sitzung mit dem Autor.

## Anlass

`graph_suggest` berechnet Umbauvorschläge für die Architektur. Der Auslöser ist die Bedingung, bei der
ein Agent das Werkzeug von selbst ruft. Im Dashboard startet ein Knopf die Berechnung (CR-GVE-401,
CR-GVE-402); ein Agent ohne Dashboard sieht ihn nie.

Der Autor hat am 2026-11-14 entschieden: Ein Agent ruft `graph_suggest` von selbst, wenn ein Befund
bestimmter Regeln offen ist. Die zwei bisherigen Auslöser bleiben: `graph_generate` meldet die Phase
`handoff`, und der Skill `se:optimize` läuft.

## Stand heute

- Die Werkzeuge nennen den Auslöser nur für R-04.
- Für RD-04 und BW-02 nennt ihn nur der FAQ-Eintrag `architektur-vor-hygiene` in aise-bok.
- Für MT-02 hat `graph_suggest` keinen Zug und meldet nichts Anwendbares. MT-02 ist seit 2026-11-15
  aus dem Auslöser genommen, bis dieser CR entschieden ist.
- CR-SM-441 (sigloch-modules, offen) schlägt den Verweis auf `se:optimize` in den Hilfetexten von
  RD-04 und BW-02 vor.

## Auftrag

Der CR legt den Auslöser vollständig fest, für alle vorgeschlagenen Regeln: R-04, RD-04, BW-02, MT-02.

## Offene Fragen an den Autor

1. Welche Regeln lösen aus? Vorgeschlagen sind R-04, RD-04, BW-02 und MT-02.
2. Braucht MT-02 einen eigenen Zug in `graph_suggest`, oder fällt MT-02 aus dem Auslöser?
3. Wo steht der Auslöser: in der Ausgabe von `graph_generate`, im Hilfetext der Regel oder an beiden Stellen?
4. Ein Aufruf von `graph_suggest` blockiert den Host 4,3 bis 4,6 s (CR-GVE-401). Wie oft darf ein
   Agent bei unverändertem Befund neu rufen?

## Abnahme

- [ ] Der Autor hat die vier Fragen entschieden; die Festlegungen stehen im Abschnitt „Entscheidungen".
- [ ] Ein Test zeigt je auslösender Regel: Bei offenem Befund nennt das Werkzeug `graph_suggest`.
- [ ] Der FAQ-Eintrag `architektur-vor-hygiene` nennt dieselbe Regelliste wie der Code.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
