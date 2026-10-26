# CR-GC-856: import-code verliert Handkanten nach graphify-uid-Wechsel (CR-GF-132), Duplikate ohne origin

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1079 (bug)
**Erstellt:** 2026-10-26
**Item:** bok/items/ITEM-2026-1079.json (Lane: code)

---

## Befund

Probe an einer Kopie von gc_test-sqlite (Auftraggeber): graphify CR-GF-132 vergibt lesbare uids
(`FUNC-adddays` statt `func_adddays_index_ts_adddays`). Der Reseed löscht jeden Knoten mit
`origin: import-code`, den der Import nicht wieder liefert, und mit ihm seine Handkanten:
35 von 35 `SYS -compose-> MOD` verloren. Ohne `origin`-Stempel (moneyflow, 1228 Code-Knoten)
bleiben die alten Knoten stehen und die neuen kommen als Duplikat dazu.

## Root Cause

Der Reseed kennt Identität nur als gleiche uid. Wechselt der Slicer die uid, ist der alte Knoten
für ihn stale (mit Stempel) oder fremd (ohne Stempel).

## Änderung

- graphify CR-GF-154 (0fdb641) liefert die alte uid als `attributes.candidateId` am add-node.
- `umbenennungen` (`src/surface/import-code-verb.ts`): alte uid → neue uid, wenn die uid oder die
  candidateId des alten Knotens gleich der candidateId des gelieferten ist; nie über den Namen
  (Ordner-MOD `mod_adddays` und Datei-MOD `mod_adddays_index_ts` heißen beide nach dem Pfad).
  Mehrdeutig = Abbruch mit Meldung.
- `reseedTransport` (aus `executeImportCode` herausgelöst, derselbe Weg): der neue Knoten übernimmt
  die Attribute des alten (gelieferte gewinnen bei gleichem Schlüssel, wie beim Reimport einer
  gleichen uid), `merge-nodes alt → neu` hängt die Kanten um. Ein umbenannter Knoten ist weder
  stale noch fremd; Stale-Kanten werden unter den neuen uids verglichen.
- Umbenennen über `merge-nodes`, nicht `update-node`: `update-node` ändert die uid nicht
  (`applyCommands` sucht per uid). `merge-nodes` ist die Gate-Operation „Ziel nimmt Quelle auf"
  (CR-GC-238). delete und add derselben uid kommen nicht vor — alte und neue uid sind verschieden.
- Modell: `REQ-import-code-renames-by-candidate`, `TEST-import-code-umbenennung`.

## Prüfung

- `tests/import-code-umbenennung.test.ts` (echter Disk-Kuzu): vor dem Fix rot (mit Stempel: Handkante
  weg; ohne Stempel: 7 statt 4 Knoten), danach 5/5.
- E2E-Smoke im Link-Modus mit graphify 0fdb641: `executeImportCode` auf `addDays/index.ts`, Bestand
  mit alten uids — mit und ohne Stempel: 4 Knoten, `SYS -compose-> MOD-adddays` erhalten,
  Handattribut erhalten, 0 Errors.

## Offen

- Im Link-Modus fällt `tests/import-code-verb.test.ts` („imports the fixture…") rot: der Test
  erwartet die alten uids `mod_src_*`. Gehört zum Upgrade auf die neue graphify-Version, nicht
  zu diesem CR.

---

## Umfang laut `graph_impact`

- `FUNC-import-code-verb`, `REQ-import-code-renames-by-candidate` (relation-Kanten gesetzt).
- `graph_tests([FUNC-import-code-verb])`: import-code-verb, contracts.kernel, contracts.surface,
  cli.scaffold, mutate.schema-guard — alle grün; dazu import-code-umbenennung.
