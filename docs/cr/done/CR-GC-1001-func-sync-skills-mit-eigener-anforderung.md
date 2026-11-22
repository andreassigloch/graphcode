# CR-GC-1001: FUNC-sync-skills mit eigener Anforderung und Fluessen

**Typ:** aus Item ITEM-2026-1582 (finding)
**Erstellt:** 2026-11-22
**Item:** bok/items/ITEM-2026-1582.json (Lane: code)

---

syncSkills (graphcode skills sync) hat im Modell keine FUNC und keine eigene Anforderung. Auftrag des Autors: FUNC-sync-skills mit realRef, eigene funktionale REQ (schreibt fehlende se-Skills, ueberschreibt aeltere nach Version, laesst gleiche unveraendert, berichtet je Skill), Fluesse an FUNC-cli-dispatch und FUNC-upgrade mit SCHEMA-skill-sync-result. Ziel: RC-04 16 auf 15.

---

## Entscheidungen

| Frage | Festlegung | Begründung |
|---|---|---|
| Wer erfüllt das Abgleichen der Skills? | `FUNC-sync-skills` mit eigener funktionaler REQ `REQ-skills-sync-gleicht-ab`, nicht als zweiter Erfüller von `REQ-upgrade-entfernt-fremde-skills`. | FAQ `ein-erfueller-je-anforderung` Punkt 6; Entscheidung des Autors am 2026-11-22. |

---|---|---|

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1495, Tiefe 1, Wurzeln: `FUNC-harness-cli`, `FUNC-upgrade`._

Reichweite: 5 Elemente (FLOW 2, FUNC 3); Blackbox-Rand 3, nicht geoeffnet.

Dateien (realRef, 2):
- src/surface/scaffold.ts
- src/surface/upgrade.ts

Tests (`graph_tests`, 8):
- tests/cli.scaffold.test.ts
- tests/config-nachziehen.test.ts
- tests/knowledge-binding.test.ts
- tests/sitzung-kpi.test.ts
- tests/store-lock.test.ts
- tests/upgrade.test.ts
- tests/vertrag/SCHEMA-install-result.vertrag.test.ts
- tests/vertrag/SCHEMA-upgrade-report.vertrag.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.

## Befund am Code

`syncSkills` (`src/surface/scaffold.ts`) war keine FUNC, ihr Bericht trug `SCHEMA-skill-sync-result` ohne Erzeuger im Modell (RC-04 +1 seit CR-GC-999). `FUNC-harness-cli` trägt das Symbol `scaffold`, ruft `syncSkills` nicht (eigener Code `installSkills`); die zwei Aufrufer von `syncSkills` sind `src/cli.ts` (`skills sync`) und `src/surface/upgrade.ts` (`executeUpgrade`, Trockenlauf für `upgrade --check`, über `deps.syncSkillsImpl ?? syncSkills`).

## Änderung

**Modell (ein Batch, `dryRun` vorher).** `REQ-skills-sync-gleicht-ab` (funktional, Elternteil `REQ-repo-update` wie die Geschwister), Text vom Autor abgenommen; `TEST-cli-scaffold` `verify` auf sie (FAQ `test-verifiziert-mehrere-req`, `testdatei-ein-test`: eine Datei, ein TEST, n REQ). `FUNC-sync-skills` (`realRef` `syncSkills`, `allocate` `MOD-surface`, `satisfy` die neue REQ, Glied von `FCHAIN-repo-lifecycle`, Eingang `FLOW-cli-command`). Zwei Flüsse mit `SCHEMA-skill-sync-result`: `FLOW-skill-sync-result-sync-skills` an `FUNC-cli-dispatch` (Beleg `src/cli.ts`), `FLOW-skill-sync-result-upgrade` an `FUNC-upgrade` (Beleg `src/surface/upgrade.ts`; `realRef` `executeUpgrade`, weil der Aufruf über eine Einspeisung läuft und RC-12 sonst +1 meldet). `REQ-upgrade-entfernt-fremde-skills` und ihre Erfüller unverändert.

**Test (1 Datei).** `tests/cli.scaffold.test.ts`: neuer Fall „eine Kopie mit gleicher oder höherer Version bleibt Byte für Byte unberührt". Deckung der REQ-Aussagen: fehlende schreiben (bestehend: „a missing copy is added"), ältere nach Version überschreiben (bestehend), gleiche lassen und Bericht je Skill (bestehend prüft die Listen je Pfad; NEU prüft, dass eine gleiche und eine höhere Kopie unverändert bleiben). Rot zuerst durch gezielte Verletzung in `syncSkills`: `>` wird `>=`: 5 Fälle rot, davon der neue; `>` wird `!==` (Rückschritt auf niedrigere Version): nur der neue Fall rot.

## Messung

`rules_evaluate` vorher/nachher: RC-04 16 auf 15, RD-06 0, RC-12 0, alle anderen Regeln unverändert. Der Trockenlauf des Batches ohne `realRef` am Upgrade-Fluss zeigte RC-12 +1; mit dem `realRef` aus dem Quellcode weg.
