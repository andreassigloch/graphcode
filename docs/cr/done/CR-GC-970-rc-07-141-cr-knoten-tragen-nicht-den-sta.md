# CR-GC-970: RC-07: 141 CR-Knoten tragen nicht den Status des Ordners done (CRs vor BOK-CR-080); Status und Pfad einmalig spiegeln

**Typ:** aus Item ITEM-2026-1507 (finding)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1507.json (Lane: graph)

---

## Befund

RC-07 meldete 141 CR-Knoten: Die Datei liegt in `docs/cr/done/`, der Knoten trägt `status: open` oder keinen Status. Betroffen sind CR-GC-667 bis CR-GC-900. `aise cr close` spiegelt den Status erst seit BOK-CR-080 (2026-11-09); die älteren Knoten zog niemand nach. CR-GC-930 hatte die Zahl 141 am 2026-11-14 genannt und offen gelassen.

## Änderung

Ein Zug durchs Gate (graphVersion 1356 → 1357): `status: done` an den 141 Knoten. Der Ordner entscheidet (FAQ `cr-knoten-status`); der Zug spiegelt ihn einmalig für den Altbestand.

## Messung (`graph_readiness`, vorher 1353, nachher 1358)

| Regel | vorher | nachher |
|---|---|---|
| RC-07 | 141 | 0 |
| CR-R01 | 25 | 4 |
| Warnungen gesamt | 310 | 148 |

CR-R01 sank mit, weil die Regel nur CRs zählt, die nicht `done` sind. Die 4 verbleibenden sind die offenen CR-GC-808, 810, 811 und 812.

## Offen (benannt)

79 CR-Knoten tragen in der Beschreibung noch den Pfad `docs/cr/open/…`, obwohl die Datei in `done/` liegt. Keine Regel liest den Pfad. Nicht Teil dieses CR.


---

## Entscheidungen

keine

---|---|---|

---

## Umfang laut `graph_impact`

Nur Attribute an 141 CR-Knoten. Relation-Kante: `FUNC-check-code-conformance` (wertet RC-07 aus). Kein Code, kein Test geändert.
