# CR-GC-1011: Doppelte Flüsse ohne Vertrag: FLOW-measurement-vector und FLOW-action entfernen

**Typ:** aus Item ITEM-2026-1598 (finding)
**Erstellt:** 2026-11-22
**Item:** bok/items/ITEM-2026-1598.json (Lane: graph)

---

## Befund

Zwei SCHEMA ohne Zod-Schema (R-26, R-32) hängen an Flüssen, die einen echten Fluss doppeln.

- `FLOW-measurement-vector` (SCHEMA-measurement-vector) läuft von `FUNC-take-steering-snapshot` zu `FUNC-generation-step`.
  Denselben Weg nimmt `FLOW-steering-snapshot` mit dem gebundenen Vertrag `SteeringSnapshotSchema`.
  Ein zweiter Fluss für dieselbe Übergabe ist ein paralleler Pfad.
- `FLOW-action` (SCHEMA-action) geht vom Block `FUNC-goal-steerer` zu `FUNC-agent-loop`.
  Der Block wird durch seine Kinder realisiert; deren Ausgänge sind die Kanalflüsse `FLOW-channel-*`.
  Der Sammelfluss am Block hat keinen Code und keinen eigenen Inhalt.

## Zug

Die zwei Flüsse und die zwei SCHEMA löschen. Kein Code ändert sich.

## Abnahme

- Trockenlauf: Befunde Stufe Schema 9 → 7, Stufe Test 14 → 12, blockierende Fehler 0 → 0.
- R-26 und R-32 nennen `SCHEMA-measurement-vector` und `SCHEMA-action` nicht mehr.
- `npm run verify:model` grün.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| keine | — | — |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1539, Tiefe 1, Wurzeln: `SCHEMA-measurement-vector`, `SCHEMA-action`, `FLOW-measurement-vector`, `FLOW-action`._

Reichweite: 4 Elemente (FLOW 2, FUNC 2); Blackbox-Rand 5, nicht geoeffnet.

Dateien (realRef, 1):
- src/kernel/measure/steering-snapshot.ts

Tests (`graph_tests`, 0):
- (keine)

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
