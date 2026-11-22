# CR-GC-1010: Untergrenzen graph-view-edit 0.22.1 und graphify 0.6.1

**Typ:** aus Item ITEM-2026-1596 (finding)
**Erstellt:** 2026-11-22
**Item:** bok/items/ITEM-2026-1596.json (Lane: code)

---

Der Release-Zug brach an `tests/distribution.test.ts` („installs each @sigloch package exactly once") ab: `graph-api-core` 6.0.0 an der Wurzel, 5.11.2 unter `graph-view-edit`, weil die Sperrdatei graph-view-edit 0.22.0 hielt und 0.22.0 nur `<6` zulässt. `@sigloch/graph-view-edit` 0.22.1 und `@sigloch/graphify` 0.6.1 liegen in der Registry und lassen graph-api-core 6 zu (0.22.1 behebt außerdem den Start des Viewers in einem Fremd-Repo).

## Änderung

- `package.json`: `@sigloch/graph-view-edit` `>=0.22.1 <1`, `@sigloch/graphify` `>=0.6.1 <1` (Schreibweise der Datei; FAQ `peer-floor-wann`: der Floor folgt der Mindestversion, die gebraucht wird).
- `package-lock.json`, von Hand nach `npm view <pkg>@<version>`: Wurzelbereiche, beide Einträge auf 0.22.1 bzw. 0.6.1 mit `resolved` und `integrity` der Registry, deren graph-api-core-Bereich `<7`. Kein `npm install`, keine `file:`- oder Tarball-Pfade. Der Eintrag `graph-api-core` 5.11.2 an der Wurzel bleibt: 6.0.0, contracts 12.17.0 und graphcode-client 3.3.1 liegen noch nicht in der Registry, ihre Sperreinträge folgen dem Publish.
- Kein Quelltext, kein Modell.

## Entscheidungen

keine.

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
