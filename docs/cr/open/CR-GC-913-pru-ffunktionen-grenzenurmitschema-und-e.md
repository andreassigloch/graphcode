# CR-GC-913: Prüffunktionen grenzeNurMitSchema und einAdapterJeAkteur in @sigloch/graphcode/constraints (abgetrennt aus CR-GC-864)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1303 (finding)
**Erstellt:** 2026-11-11
**Item:** bok/items/ITEM-2026-1303.json (Lane: code)

---

## Befund (aus CR-GC-864, Befund 4)

immo-infra hat zwei Prüffunktionen lokal geschrieben (`tests/lib/constraints.ts`), weil `@sigloch/graphcode/constraints`
nur `eingaengeNurAus` exportiert. Die Zeile „Erweiterbarkeit" in `se:constraints` nennt deshalb „fehlt".

## Zielbild

- `grenzeNurMitSchema(graph, elternMod, schemas)`: jeder Fluss über die Grenze eines Kind-Moduls trägt ein Schema aus der
  Liste, und zwischen Kind-Modulen gibt es keinen Fluss.
- `einAdapterJeAkteur(graph, elternMod, akteure)`: jeder Fluss zu einem Akteur endet in genau einem Kind-Modul, und jedes
  Kind-Modul bedient genau einen Akteur.
- Beide in `src/kernel/measure/constraints.ts` neben `eingaengeNurAus`, mit Befund-Schema (Zod) wie `SCHEMA-eingangs-befund`.
- `se:constraints`: Zeile Erweiterbarkeit nennt `constraints.grenzeNurMitSchema` und `constraints.einAdapterJeAkteur`.

## Akzeptanz

- Je Funktion ein Test mit Positivkontrolle je Bruch (rot gegen einen brechenden Snapshot, grün gegen einen guten).
- `tests/skill-constraints.test.ts` grün; er prüft, dass jede genannte Prüffunktion exportiert ist.
- immo-infra kann `tests/lib/constraints.ts` nach dem Rollout löschen.

## Dateien (4)

`src/kernel/measure/constraints.ts`, `tests/constraints.test.ts` (oder bestehende Datei), `.claude/commands/se/constraints.md`,
`tests/skill-constraints.test.ts`; dazu `docs/graph/graphcode.graph.json`.

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
