# CR-GC-913: Prüffunktionen grenzeNurMitSchema und einAdapterJeAkteur in @sigloch/graphcode/constraints (abgetrennt aus CR-GC-864)

> **Ersetzt (2026-11-19):** Die engere Lesart (2) unten gilt nicht mehr. Ein Fluss zwischen zwei Kind-Modulen ist ein Grenzfluss wie jeder andere; die Liste `zwischenKindern` ist gestrichen. Siehe CR-GC-956.

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

---

## Ergebnis (2026-11-18)

**Signaturen** (`src/kernel/measure/constraints.ts`, Export über `@sigloch/graphcode/constraints`):

- `grenzeNurMitSchema(graph, elternMod, schemas: readonly string[]): GrenzBefund`
- `einAdapterJeAkteur(graph, elternMod, akteure: readonly string[]): AdapterBefund`

**Zuordnung** wie bei `eingaengeNurAus` nur über Kanten: Kind-Modul = `elternMod compose MOD`; FUNC gehört zum
Kind-Modul über `FUNC allocate MOD` (auch an einem Enkel-Modul); Fluss-Endpunkte = `X io FLOW` und `FLOW io X`;
Schema = `FLOW relation SCHEMA`.

**Befund-Schemas (Zod, strict):**

- `GrenzBefund { ohneSchema: [{fluss, module, schemas}], zwischenKindern: [{fluss, von, nach}] }`
- `AdapterBefund { flussOhneEinModul: [{akteur, fluss, module}], moduleOhneEinenAkteur: [{modul, akteure}], akteurOhneAdapter: [id] }`

**Engere Lesart:** (1) Ein Grenzfluss trägt mindestens ein Schema und keines außerhalb von `schemas`. (2) Ein Fluss
zwischen zwei Kind-Modulen ist immer ein Befund (`zwischenKindern`), auch mit Schema aus der Liste.

_Ersetzt 2026-11-19 durch CR-GC-956: Lesart (2) entfällt, der Autor wählte die weitere Lesart._

**Tests** `tests/constraint-grenze-adapter.test.ts` (15): erst rot (Funktionen fehlten, 15/15 rot), dann grün. Je
Funktion ein guter Graph (kein Befund) und je Bruchart ein brechender (kein Schema, fremdes Schema, Fluss
zwischen Kindern, Fluss in 0 oder 2 Kind-Modulen, Modul mit 0 oder 2 Akteuren, Akteur ohne Adapter), dazu je ein
Vertragstest des Befund-Schemas. `tests/skill-constraints.test.ts` prüft, dass Erweiterbarkeit beide Funktionen nennt.

**Lauf:** `type-check` und `build` grün; `verify:code` 4 Dateien, 34 Tests grün; `verify:full CR-GC-913`: 1926 von
1929 grün. Rot: `skill-kinds-werte` (Pfad im Worktree enthält `/.claude/` zweimal, Scan findet 0 Skills) und
`live-feed` (relativer Pfad `../graph-view-edit` fehlt im Worktree), beide Worktree-Artefakte; ein dritter Timeout (60 s).
