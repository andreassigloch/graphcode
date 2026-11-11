# CR-GC-879: scaffold update/remove entfernen se-Dateien, die das Paket nicht mehr ausliefert (se-view, trade aus CR-GC-756)

**Status:** ✅ Done
**Abgeschlossen:** 2026-11-11
**Typ:** aus Item ITEM-2026-1116 (finding)
**Erstellt:** 2026-10-28
**Item:** bok/items/ITEM-2026-1116.json (Lane: code)

---

## Befund (2026-11-11)

`init`, `update` und `skills sync` schreiben nur die Skills, die das Paket ausliefert
(`installSkills`, `syncSkills` in `src/surface/scaffold.ts`). Was ein früheres Paket ausgeliefert hat und
das heutige nicht mehr, bleibt liegen. Gemessen in `~/Developer`: 25 Repos tragen die 12 Dateien
`se-view/*.md` (entfernt in CR-GC-876, seit 0.36.0) und 23 davon `se/target-profile.md`. Der Agent sieht
dort Befehle, die auf entfernte Skills zeigen. `upgrade --check` meldet „vollständig", weil es nur
fehlende Dateien zählt.

## Zielbild

1. `init`, `update` und `skills sync` entfernen jede `se*`-Datei unter `.claude/commands/` und jeden
   `se*`-Ordner unter `.opencode/skills/`, den das Paket nicht kennt. `se*` gehört dem Paket, das
   gilt schon für `remove` und für die Auslieferung.
2. Bekannt sind alle `se*`-Dateien im Paket, auch Entwürfe mit `version: 0`. So verliert das Quell-Repo
   seine Entwürfe nie.
3. `upgrade --check` zählt veraltete Dateien als Drift und nennt sie unter „Artefakte".
4. Der Bericht nennt jede entfernte Datei (`removed`).

## Akzeptanz

- Test: ein Repo mit `se-view/arch.md`, `se/target-profile.md` und deren OpenCode-Kopien verliert sie
  bei `update` und bei `skills sync`; ein eigener Befehl ohne `se`-Präfix bleibt.
- Test: `skills sync` im Trockenlauf meldet sie unter `removed` und löscht nichts; `upgrade --check`
  meldet Drift.
- Smoke: `skills sync` gegen eine Kopie von sirail entfernt die 13 Dateien.

## Ergebnis (2026-11-11)

- `removeStaleSkills` in `src/surface/scaffold.ts`; `ownedSkillFiles` (mit Entwürfen) neben `shippedSkillFiles`
  in `scaffold-templates.ts`. `init`, `update`, `remove`, `skills sync` nutzen sie; `SkillSyncResult.removed` neu.
- `upgrade`: `staleSkills` im Bericht, zählt als Drift, Zeile „Artefakte" nennt sie.
- Tests: 4 neue in `cli.scaffold.test.ts` und `upgrade.test.ts`, rot gegen den alten Code, grün danach.
- Smoke: gebauter CLI `skills sync` auf einer Kopie von sirail: 13 Befehle und 13 OpenCode-Ordner entfernt,
  14 Skills aktualisiert, eigene Befehle unberührt.
- Modell: `REQ-repo-update` nennt das Entfernen; `CR-GC-879 -relation->` REQ-repo-update, FUNC-harness-cli, FUNC-upgrade.
- `verify:code` grün (128 Dateien, 1173 Tests). `verify:full`: 2 Dateien rot außerhalb der Auswahl (Schlupf):
  `skill-fmea-orte` und `skill-top-level-ausloeser` prüfen die genaue `version:` der Skills, die CR-GC-878 erhöht
  hat. Die Testauswahl führt von den Skill-FUNCs nicht zu diesen Dateien. Erwartete Version nachgezogen, 30/30 grün.

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
