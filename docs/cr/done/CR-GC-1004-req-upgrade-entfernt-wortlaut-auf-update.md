# CR-GC-1004: REQ upgrade entfernt: Wortlaut auf update und skills sync verengen

**Typ:** aus Item ITEM-2026-1590 (finding)
**Erstellt:** 2026-11-22
**Item:** bok/items/ITEM-2026-1590.json (Lane: code)

---

Entscheidung des Autors: upgrade entfernt veraltete Skills nicht selbst (es laesst den neuen Build update fahren). Der Wortlaut von REQ-upgrade-entfernt-fremde-skills nennt upgrade noch als entfernenden Befehl; er wird auf update und skills sync verengt, upgrade --check zaehlt weiter als Drift. Andere Aussagen, upgrade entferne, werden nachgezogen.

---

## Entscheidungen

| Frage | Festlegung | Begründung |
|---|---|---|
| Nennt die Eltern-REQ `upgrade` als entfernenden Befehl? | Nein. Nur `update` und `skills sync` entfernen; `upgrade --check` zählt als Drift. Der Ernstfall-`upgrade` löscht nicht selbst, er lässt den neu installierten Build `update` fahren. | Entscheidung des Autors am 2026-11-22; Befund CR-GC-1002. |
| Heißt die uid um? | Nein, nur der Anzeigename. | FAQ `uid-schreibweise` Punkt 3: Bestands-uid werden nicht migriert. |

---|---|---|

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1508, Tiefe 1, Wurzeln: `FUNC-upgrade`._

Reichweite: 5 Elemente (FLOW 3, FUNC 2); Blackbox-Rand 4, nicht geoeffnet.

Dateien (realRef, 1):
- src/surface/upgrade.ts

Tests (`graph_tests`, 7):
- tests/cli.scaffold.test.ts
- tests/config-nachziehen.test.ts
- tests/knowledge-binding.test.ts
- tests/store-lock.test.ts
- tests/upgrade.test.ts
- tests/vertrag/SCHEMA-skill-sync-result.vertrag.test.ts
- tests/vertrag/SCHEMA-upgrade-report.vertrag.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.

## Änderung

**Modell (`update-node`, `dryRun` vorher ohne Befund).** `REQ-upgrade-entfernt-fremde-skills`: Beschreibung „Wenn update oder skills sync läuft, entfernt es se-Skills und deren OpenCode-Kopien, die das Paket nicht mehr kennt; upgrade --check zählt sie als Drift."; Anzeigename „Fremde Skills entfernen und als Drift zählen" (vorher „upgrade entfernt fremde Skills"); `kinds` unverändert. Kinder, Erfüller und Verifikationen unverändert.

**Geprüft, ob noch jemand behauptet, `upgrade` entferne.** Beschreibungen im Modell (REQ, FUNC, FLOW, SCHEMA, FCHAIN) per Suche nach „upgrade" zusammen mit Entfernen-Wörtern: `FUNC-upgrade` nennt kein Entfernen; `REQ-repo-update` („upgrade --check zählt beides als Drift") und `REQ-upgrade-check-zaehlt-fremde-skills` stimmen; `FCHAIN-repo-lifecycle` („frischt die Dateien auf") stimmt. README: keine Aussage. Nachgezogen: `docs/project/Learning Loop – Konzept.md` Zeile 68 („`init`/`upgrade` entfernen se\*-Skills" wird „`init`, `update` und `skills sync` entfernen ..."; `init` entfernt ebenfalls, über `installSkills`) und der Kommentar in `src/surface/upgrade.ts` („`upgrade` räumt ihn weg" wird „`--check` zählt ihn, das Entfernen macht `update`"). Der Kommentar ist die einzige Codeänderung.

## Messung

`rules_evaluate` unverändert, nur `MS-03` +1 (neuer CR-Knoten); das `dryRun`-Urteil zeigte keine Verletzung.
