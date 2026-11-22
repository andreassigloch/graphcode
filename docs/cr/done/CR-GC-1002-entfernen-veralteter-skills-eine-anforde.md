# CR-GC-1002: Entfernen veralteter Skills: eine Anforderung je Erfueller

**Typ:** aus Item ITEM-2026-1583 (finding)
**Erstellt:** 2026-11-22
**Item:** bok/items/ITEM-2026-1583.json (Lane: code)

---

REQ-upgrade-entfernt-fremde-skills nennt drei Ausloeser, im Modell erfuellt sie nur FUNC-upgrade. Am Code entfernen update (scaffold, FUNC-harness-cli) und skills sync (syncSkills, FUNC-sync-skills) ueber removeStaleSkills; upgrade --check zaehlt nur Drift; upgrade selbst delegiert das Entfernen an den frisch installierten Build (update). Auftrag des Autors: Kind-Anforderungen mit je einem Erfueller.

---

## Entscheidungen

| Frage | Festlegung | Begründung |
|---|---|---|
| Wie wird `REQ-upgrade-entfernt-fremde-skills` geschnitten? | Drei Kind-REQ mit je einem Erfüller: `update` entfernt (`FUNC-harness-cli`), `skills sync` entfernt (`FUNC-sync-skills`), `upgrade --check` zählt als Drift (`FUNC-upgrade`). Die Eltern-REQ bleibt mit ihrem Wortlaut, ohne eigenen Erfüller. | FAQ `ein-erfueller-je-anforderung` Punkte 1, 2, 6; Schnitt nach dem Befund am Code, Freigabe des Autors. |

---|---|---|

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1500, Tiefe 1, Wurzeln: `FUNC-harness-cli`, `FUNC-sync-skills`, `FUNC-upgrade`._

Reichweite: 7 Elemente (FLOW 3, FUNC 4); Blackbox-Rand 3, nicht geoeffnet.

Dateien (realRef, 2):
- src/surface/scaffold.ts
- src/surface/upgrade.ts

Tests (`graph_tests`, 9):
- tests/cli.scaffold.test.ts
- tests/config-nachziehen.test.ts
- tests/knowledge-binding.test.ts
- tests/sitzung-kpi.test.ts
- tests/store-lock.test.ts
- tests/upgrade.test.ts
- tests/vertrag/SCHEMA-install-result.vertrag.test.ts
- tests/vertrag/SCHEMA-skill-sync-result.vertrag.test.ts
- tests/vertrag/SCHEMA-upgrade-report.vertrag.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.

## Befund am Code (je Befehl)

| Befehl | Was er tut | Beleg |
|---|---|---|
| `update` | `scaffold('update')` schreibt die Skills und entfernt Reste über `removeStaleSkills`. | `src/surface/scaffold.ts` `installSkills` |
| `skills sync` | `syncSkills` entfernt Reste über `removeStaleSkills`. | `src/surface/scaffold.ts` `syncSkills`, `src/cli.ts` |
| `upgrade --check` | Trockenlauf von `syncSkills`; `removed` wird `staleSkills` und Drift; nichts wird gelöscht. | `src/surface/upgrade.ts` `executeUpgrade`, `opts.check` |
| `upgrade` (Ernstfall) | Löscht nicht selbst. Es installiert und ruft den frisch installierten Build mit `upgrade --refresh-only`, der `scaffold('update')` fährt (älteres Ziel: `update`). Nur im Paket-Repo `upstream` ruft es `syncSkills` unmittelbar. | `src/surface/upgrade.ts` `refreshArgs`, Zweig `packageRepo === 'upstream'`; `src/cli.ts` `--refresh-only` |

Das Entfernen beim Ernstfall-`upgrade` hat damit keinen eigenen Erfüller und keinen eigenen Test: es geschieht über `update` und im Paket-Repo über `skills sync`. Es steht nur im Wortlaut der Eltern-REQ. Vorgelegt (siehe Bericht).

## Änderung

**Modell (ein Batch, `dryRun` vorher ohne Befund).** `REQ-update-entfernt-fremde-skills`, `REQ-skills-sync-entfernt-fremde-skills`, `REQ-upgrade-check-zaehlt-fremde-skills` (funktional, Wortlaut aus der Eltern-REQ abgeleitet, nichts hinzugefügt), `compose` unter die Eltern-REQ, je `satisfy` vom genannten Erfüller, `FUNC-upgrade -satisfy->` Eltern-REQ gelöscht. `verify`: `TEST-cli-scaffold` auf die ersten zwei, `TEST-upgrade` auf die dritte.

**Nachweise.** `update`: `update raeumt die Reste ebenfalls weg` (`tests/cli.scaffold.test.ts`, prüft `res.removed`, gelöschte Command- und OpenCode-Reste, eigenen Befehl erhalten). `skills sync`: `sync entfernt se-Kopien, die das Paket nicht mehr kennt` und der Trockenlauf-Fall (derselbe Testdatei). `upgrade --check`: der vorhandene Fall prüft nur mit eingespeistem `syncSkillsImpl`; ergänzt in `tests/upgrade.test.ts`: `--check zählt einen echten Rest als Drift und lässt ihn liegen` (echte Bestandsquelle, Temp-Repo mit einem se-Befehl, den das Paket nicht kennt). Rot zuerst durch gezielte Verletzung: `staleSkills` leer gesetzt: 2 Fälle rot (alter und neuer); `staleSkills` aus `drift` genommen: 1 Fall rot (alter); Trockenlauf löscht (`if (dry) return stale` entfernt): nur der neue Fall rot. Danach zurückgenommen, `git diff src` leer.

## Messung

`rules_evaluate` vorher/nachher: jede Regel gleich; nur `MS-03` (info) +1 durch den neuen CR-Knoten. Das `dryRun`-Urteil zeigte keine Verletzung (`RD-06`, `RD-07`, `R-01`, `R-02` nicht betroffen).
