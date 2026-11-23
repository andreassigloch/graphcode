# CR-GC-1021: SCHEMA-query-params: Auftrag und Skill-Aufruf sind Prompt-Text, kein Code-Vertrag

**Typ:** aus Item ITEM-2026-1629 (finding)
**Erstellt:** 2026-11-23
**Item:** bok/items/ITEM-2026-1629.json (Lane: graph)

---

## Befund

`FLOW-auftrag` und `FLOW-skill-request` hängen am Sammelknoten `SCHEMA-query-params`. Beide tragen Prompt-Text an den Agent-Host: den Auftrag des Auftraggebers und den Aufruf eines Skills. Im Code gibt es dafür kein Wire-Format und kein Zod-Schema. Das ist dieselbe Lage wie bei `SCHEMA-steering-channel`. Dort hat der Autor am 2026-11-23 entschieden: R-26 und R-32 bleiben mit Grund stehen.

## Zug

1. Neues `SCHEMA-auftragstext`, ohne realRef und ohne Vertragstest. Die Beschreibung nennt den Grund für R-26 und R-32 (FAQ `befund-stehen-lassen`).
2. `FLOW-auftrag` und `FLOW-skill-request` hängen daran statt an `SCHEMA-query-params`.
3. `FLOW-auftrag` verliert in der Beschreibung die Leseanfrage (Element, Tiefe, Cursor, Zweig, View). Seit CR-GC-1014 bis 1016 hat jedes Lesewerkzeug einen eigenen Aufruffluss mit eigenem Vertrag.

An `SCHEMA-query-params` bleibt danach nur `FLOW-generation-request`. CR-GC-1022 bindet ihn um und löscht den Sammelknoten.

## Abnahme

- `SCHEMA-query-params` hat genau einen Fluss: `FLOW-generation-request`.
- R-26 und R-32 an `SCHEMA-auftragstext` stehen, der Grund steht in seiner Beschreibung.
- verify:model ist grün.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| keine | | |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1589, Tiefe 1, Wurzeln: `FLOW-auftrag`, `FLOW-skill-request`._

Reichweite: 3 Elemente (FLOW 2, FUNC 1); Blackbox-Rand 71, nicht geoeffnet.

Dateien (realRef, 0):
- (keine)

Tests (`graph_tests`, 0):
- (keine)

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
