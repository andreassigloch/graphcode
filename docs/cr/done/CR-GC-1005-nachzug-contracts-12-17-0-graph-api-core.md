# CR-GC-1005: Nachzug contracts 12.17.0, graph-api-core 6.0.0, graphcode-client 3.3.1: Bereiche und Format-E-Tuer

**Typ:** aus Item ITEM-2026-1591 (finding)
**Erstellt:** 2026-11-22
**Item:** bok/items/ITEM-2026-1591.json (Lane: graph)

---

Nachzug auf drei lokal gebaute, noch nicht veröffentlichte Familienpakete: `@sigloch/contracts` 12.17.0, `@sigloch/graph-api-core` 6.0.0, `@sigloch/graphcode-client` 3.3.1. Herkunft: CR-SM-448 bis CR-SM-452 in sigloch-modules, FAQ `peer-floor-wann` (der Floor folgt dem Import im selben Commit).

## Änderung

- Link-Modus: `npm run link:siblings`; `dist` der drei Pakete neu gebaut (keine versionierte Datei dort geändert). Erwartet rot bis zum Publish: `lockfile-sync`, `distribution`.
- `package.json`: contracts `^12.17.0`, graph-api-core `^6.0.0`, graphcode-client `^3.3.1` (3.3.1, weil erst diese Version graph-api-core 6 als Peer zulässt). `package-lock.json`: nur die drei Bereiche im Wurzeleintrag; `resolved` und `integrity` folgen der Registry nach dem Publish (Muster: ein Lockfile-Commit nach dem Zug).
- `src/kernel/format-e-commands.ts`: `FormatEInputSchema.safeParse({ text, bestand })` an der Grenze, dann `leseFormatE(eingabe)`. Strukturfehler und Codec-Meldungen enden im selben Fehlertext `Format-E parse errors: …` wie bisher; `safeParse` statt `parse`, weil Aufrufer und `tests/mutate.formate-ops.test.ts` diesen Fehlertext erwarten.
- Tests: zwei Fälle für Strukturfehler des Bestands (ohne `edges`, Knoten `null`); `tests/engpass-ein-leser.test.ts` zählt `leseFormatE(` als zweiten Eintritt der einen Stelle.
- Modell: Beschreibung von `SCHEMA-format-e` nachgezogen; CR-Knoten mit Kante auf `SCHEMA-format-e`.

## Messung am laufenden Store

`graph_mutate` mit `dryRun` gegen den Store des neu gestarteten Hosts (contracts 12.17.0 im Lock) läuft durch `formatEToCommands` mit dem echten Bestand (graphVersion 1513): `GraphSchema` nimmt ihn an, kein Knoten wird abgelehnt.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| `parse` oder `safeParse` an der Grenze? | `safeParse`, Fehler als `Format-E parse errors: …` geworfen. | Keine Verhaltensänderung nach außen; RC-04 erkennt beide Formen. |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1512, Tiefe 1, Wurzeln: `SCHEMA-format-e`._

Reichweite: 3 Elemente (FLOW 3); Blackbox-Rand 3, nicht geoeffnet.

Dateien (realRef, 1):
- packages/graph-api-core/src/format-e-door.ts

Tests (`graph_tests`, 1):
- tests/mcp.mutate-input.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
