# CR-GC-934: Auslöser für graph_suggest vollständig festlegen

**Typ:** aus Item ITEM-2026-1359 (idea)
**Erstellt:** 2026-11-15
**Item:** bok/items/ITEM-2026-1359.json (Lane: code)

---

**Status:** umgesetzt 2026-11-19.

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
- CR-SM-441 (sigloch-modules, offen) hat den Verweis auf `se:optimize` in den Hilfetexten an diesen CR abgegeben.

## Auftrag

Der CR legt den Auslöser vollständig fest, für alle vorgeschlagenen Regeln: R-04, RD-04, BW-02, MT-02.

## Offene Fragen an den Autor

1. Welche Regeln lösen aus? Vorgeschlagen sind R-04, RD-04, BW-02 und MT-02.
2. Braucht MT-02 einen eigenen Zug in `graph_suggest`, oder fällt MT-02 aus dem Auslöser?
3. Wo steht der Auslöser: in der Ausgabe von `graph_generate`, im Hilfetext der Regel oder an beiden Stellen?
4. Ein Aufruf von `graph_suggest` blockiert den Host 4,3 bis 4,6 s (CR-GVE-401). Wie oft darf ein
   Agent bei unverändertem Befund neu rufen?

5. CR-01 hat einen Zug in `graph_suggest` und steht nicht in der Liste. Absicht oder Lücke?
6. Der Skill `se:optimize` liegt auf Stufe 9; BW-02 meldet auf Stufe 5, RD-04 und MT-02 auf Stufe 7. Ruft der Agent vor dem Platz des Skills?

CR-SM-441 hat den Verweis `prompt: "se:optimize"` für RD-04, BW-02 und MT-02 am 2026-11-15 an diesen CR abgegeben; dort stehen die Einwände im Abschnitt „Zusatz".

## Abnahme

- [x] Der Autor hat die sechs Fragen entschieden; die Festlegungen stehen im Abschnitt „Entscheidungen".
- [x] Ein Test zeigt je auslösender Regel: Bei offenem Befund nennt das Werkzeug `graph_suggest` (`tests/umbau-ausloeser.test.ts`, je Regel aus `AUSLOESER_REGELN`; an einer Kuzu-Arbeitskopie mit RD-04-Befund für beide Werkzeuge).
- [x] Der FAQ-Eintrag `architektur-vor-hygiene` nennt dieselbe Regelliste wie der Code; der Test hält die Liste fest und zeigt jede Änderung der Zug-Tabelle an.

## Umsetzung

- `src/loop/umbau-ausloeser.ts`: `AUSLOESER_REGELN` = Schlüssel von `STEER_OPERATORS` (se-engine); `hinweisAus` setzt den Hinweis, `merkeSuggestAufruf` und `gedaempft` halten ihn nach einem Aufruf zurück, bis sich `graphVersion` und Befundmenge geändert haben.
- `graph_generate` (`GenerationStep.umbau`) und `rules_get_violations` (`umbau`, über das ganze Modell, nicht die Arbeitsmenge) nennen `graph_suggest`; `graph_suggest` merkt sich den Aufruf. Beide Werkzeugbeschreibungen sagen, was das Feld heißt.
- Modell: REQ-generate-nennt-suggest (FUNC-graph-generate-tool), REQ-violations-nennt-suggest (FUNC-rules-tool), TEST-umbau-ausloeser.
- Kosten: `graph_suggest` fährt einen Regellauf mehr, um die Befundmenge zu merken.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| 1, 2, 5: Welche Regeln lösen aus? | Die Regeln, für die `graph_suggest` einen Zug hat. Der Code liest sie aus der Zug-Tabelle von se-engine (`operators.ts`), keine zweite Liste. Stand 2026-11-19: R-04, CR-01, BW-02, RD-04. MT-02 löst aus, sobald es einen Zug bekommt. | Für MT-02 hat `graph_suggest` keinen Zug; CR-01 hat denselben Zug wie R-04. Eine abgeleitete Liste kann nicht von der Tabelle abweichen. |
| 3: Wo steht der Auslöser? | Im graphcode-Schritt: `graph_generate` und `rules_get_violations` nennen bei offenem Befund einer auslösenden Regel `graph_suggest`. Der Hilfetext in contracts bleibt beim Regelwissen. | Nur graphcode ändert sich; kein Version-Bump in contracts, keine zweite Stelle, die gleich bleiben muss. |
| 4: Wie oft neu rufen? | Erst nach einer Modelländerung: neuer Aufruf nur, wenn sich `graphVersion` und die Befundmenge der auslösenden Regeln seit dem letzten Aufruf geändert haben. | Ein Aufruf blockiert den Host 4,3 bis 4,6 s (CR-GVE-401). Das Beschleunigen von `graph_suggest` ist ITEM-2026-1451. |
| 6: Ab welcher Stufe? | Ab dem Befund: Der Agent ruft `graph_suggest`, sobald der Befund offen ist, und legt dem Autor die Züge vor. Proben per `se:optimize` erst an seinem Platz (Stufe 9). | Architektur wartet nicht auf die Hygiene (CR-GC-433); ein Vorschlag ist nur Lesen, die Probe braucht die Analyse nach CDR. |

Entschieden vom Autor am 2026-11-19.

---

## Umfang laut `graph_impact`

FUNC-graph-generate-tool, FUNC-rules-tool, FUNC-graph-suggest (Kanten `CR-GC-934 relation`). Testspur: `npm run verify:code`, 87 Dateien.
