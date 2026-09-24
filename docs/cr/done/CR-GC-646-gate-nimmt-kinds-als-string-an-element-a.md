# CR-GC-646: Gate nimmt kinds als String an - Element-Attribute werden am Schreibweg nicht gegen den Vertrag geprueft

**Status:** ✅ Done (2026-09-24)
**Typ:** aus Item ITEM-2026-537 (bug)
**Erstellt:** 2026-09-24
**Item:** bok/items/ITEM-2026-537.json (Lane: code)

---

Das Gate nimmt kinds als String an: graph_mutate dryRun mit [kinds:functional] scheitert nur an R-01, der Typ wird nirgends geprueft. OntologyElement.kinds ist eine Liste; toOntologyGraph behauptet den Typ per as. In den Rig-Korpora (opus5-5..9) stehen 294 kinds-Strings; Regeln, die e.kinds?.includes(x) lesen, machen daraus still eine Teilstring-Suche. Gefunden von der SteeringSnapshot-Pruefung (CR-GC-644). Fix am Schreibweg: Attribute mit Element-Vertrag (kinds, status) beim Eintritt pruefen - Gate-Block statt Speichern.

---

## Umfang

`FUNC-mutate` (Gate.apply), `FUNC-take-steering-snapshot`, `SCHEMA-steering-snapshot`.

## Umsetzung (2026-09-24)

**Ursache, zweiteilig.** (1) Das Gate prueft Attribute nicht gegen den Element-Vertrag: `status`,
`kinds`, `method` reisen im freien Sack, die Regeln lesen sie aber als getypte
`OntologyElement`-Felder. (2) graphcodes `toOntologyGraph` ist ein zweiter Mapper neben der
Familienprojektion (`projectToOntologyGraph`, graph-api-core): die Familie normalisiert `kinds`
seit CR-SM-332, graphcode castete — daher die Teilstring-Suche.

- **Gate Schritt 0b** (`gate.ts`): jedes `add-node`/`update-node` prueft die Felder, die es
  SCHREIBT, gegen `OntologyElement.shape` → Block als `SCHEMA-02` mit Feld, Wert und Fix-Hinweis
  (`@kinds ["functional"]`). `null` (Grabstein) und nicht genannte Felder passieren — ein
  Altwert an einem unberuehrten Feld friert den Knoten nicht ein.
- **`toOntologyGraph`** normalisiert `kinds` mit `normalizeReqKinds` (contracts), wie die Familie.
- **SteeringSnapshot-Pruefung eingeschaltet** (`SteeringSnapshotSchema.parse`).
- **Migration graphcode-Modell** ueber das Gate: CR-GC-248/261 `dropped` → `done`
  (+`architectureOnly`, kein Commit), REQ-store-owner-lifecycle `approved` → `reviewed`.
- Smoke-Test schrieb selbst `status: in-progress` — auf `reviewed` korrigiert.

**Nachweis.** 5 neue Faelle in `tests/mutate.schema-guard.test.ts`; Positivkontrolle: ohne
Schritt 0b werden 3 davon rot. VOLL 1543/1545, rot nur `distribution`/`lockfile-sync` (Link-Modus).
Die Korpus-Graphen opus5-5..9 (294 `kinds`-Strings) laufen nach der Normalisierung durch.

## Benannt offen

Die eingeschaltete Pruefung wirft an **7 von 18** Familien-SSOTs (gve + 2 Sandbox-Kopien,
gc_test-graphview, graphify, sigloch-modules, test_karp) — Altbestand, der ueber den Import-Port
kam. `graph_generate` und die dryRun-Steuerung brechen dort, bis migriert ist. **Vor dem naechsten
graphcode-Release migrieren** (Tabelle in CR-SM-362).
