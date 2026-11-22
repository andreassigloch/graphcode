# CR-GC-1012: SCHEMA-import-access ohne Zod-Schema: ImportTargetSchema, Erzeuger parst

**Typ:** aus Item ITEM-2026-1599 (finding)
**Erstellt:** 2026-11-22
**Item:** bok/items/ITEM-2026-1599.json (Lane: code)

---

## Befund

`SCHEMA-import-access` (FLOW-import-target, von `FUNC-graph-store` an `FUNC-reseed`) hatte kein Zod-Schema.
R-26 und R-32 meldeten es. Im Code stand nur das Interface `ImportTarget` in `src/kernel/harness-import.ts`.
Der Text legt die Form fest: zwei Texte, zwei Funktionen, kein Store-Griff, kein Setter.

## Zug

- `ImportTargetSchema` neben dem Interface: `z.strictObject` mit `repoRoot` und `systemId` (Text, mindestens 1 Zeichen), `replace` und `clear` (`z.function()`). `satisfies Record<keyof ImportTarget, …>` hält die Liste am Interface.
- Der Erzeuger `importTarget()` in `src/kernel/graph-store.ts` parst den Zugang und gibt das Original zurück (FAQ `erzeuger-parst-vertrag`).
- Modell: `realRef` am SCHEMA, `TEST-vertrag-import-access` mit `verify` und `testRefs`.
- Erzeugter Vertragstest `tests/vertrag/SCHEMA-import-access.vertrag.test.ts`.

## Abnahme

- Vertragstest: 15 Fälle grün. Positivkontrolle: ohne `.min(1)` an `repoRoot` 1 von 15 rot.
- R-26 und R-32 nennen `SCHEMA-import-access` nicht mehr.
- `npm run verify:code` grün, Smoke: Host startet und antwortet.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| keine | — | — |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1542, Tiefe 1, Wurzeln: `SCHEMA-import-access`, `FUNC-graph-store`, `FUNC-reseed`._

Reichweite: 14 Elemente (FLOW 10, FUNC 4); Blackbox-Rand 9, nicht geoeffnet.

Dateien (realRef, 2):
- src/kernel/graph-store.ts
- src/kernel/harness.ts

Tests (`graph_tests`, 10):
- tests/contracts.kernel.test.ts
- tests/harness-handle.test.ts
- tests/snapshot-drift.test.ts
- tests/steering.measurement-path.test.ts
- tests/store-lock.test.ts
- tests/vertrag/SCHEMA-graph-delta.vertrag.test.ts
- tests/vertrag/SCHEMA-harness-handle.vertrag.test.ts
- tests/vertrag/SCHEMA-lock-owner.vertrag.test.ts
- tests/vertrag/SCHEMA-ontology-graph.vertrag.test.ts
- tests/vertrag/SCHEMA-ontology-json.vertrag.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
