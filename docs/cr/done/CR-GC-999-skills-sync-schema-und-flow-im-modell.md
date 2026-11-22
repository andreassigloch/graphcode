# CR-GC-999: skills sync: SCHEMA und FLOW im Modell

**Typ:** aus Item ITEM-2026-1578 (finding)
**Erstellt:** 2026-11-22
**Item:** bok/items/ITEM-2026-1578.json (Lane: code)

---

Die CLI-Ausgabe von graphcode skills sync traegt SkillSyncResultSchema (src/surface/scaffold.ts), im Modell fehlen SCHEMA und FLOW. Nach CR-GC-989 gibt es je Verb einen Ausgabefluss; skills sync fehlt. Auftrag des Autors: SCHEMA mit realRef, FLOW je Verb an FUNC-cli-dispatch und ACTOR-auftraggeber, Vertragstest erzeugt, TEST gebunden, Erzeuger parst an der Grenze.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|

---

## Änderung

**Modell.** `SCHEMA-skill-sync-result` mit `realRef` auf `SkillSyncResultSchema` (`src/surface/scaffold.ts`), `FLOW-cli-output-skills-sync` (`FUNC-cli-dispatch -io->` Fluss `-io-> ACTOR-auftraggeber`, `relation` auf das SCHEMA), wie die Geschwister `FLOW-cli-output-upgrade` und `-remove`. `TEST-vertrag-skill-sync-result` mit `verify` auf das SCHEMA und `testRefs` auf `tests/vertrag/SCHEMA-skill-sync-result.vertrag.test.ts`. CR-Kanten auf `FUNC-cli-dispatch`, `FUNC-harness-cli`, `SCHEMA-skill-sync-result`.

**Code (1 Datei).** `syncSkills` parst sein Ergebnis an beiden Ausgängen (früher Rückgabe ohne Skills, Ende) mit `SkillSyncResultSchema.parse` und gibt das Original zurück (FAQ `erzeuger-parst-vertrag`). Der Vertrag trägt kein `refine`, `superRefine`, `z.custom`.

**Beleg am Code.** `src/cli.ts`, Zweig `skills`: `syncSkills(process.cwd())`, Ausgabe `JSON.stringify(result, null, 2)` auf stderr.

**Test.** Erzeugt, nicht von Hand: `tests/vertrag/SCHEMA-skill-sync-result.vertrag.test.ts` (25 Fälle, `verworfen` leer, `begrenzt` leer). Bestehende Tests in `tests/cli.scaffold.test.ts` parsen das Ergebnis von `syncSkills` schon. Ein roter Fall für den Parse im Erzeuger ist nicht möglich: kein Eingang von `syncSkills` macht das Ergebnis ungültig (`repoRoot` ist `z.string()`, die Listen sind immer Listen). Der Parse ist eine Absicherung gegen künftige Änderung des Typs, ohne eigenen roten Test.

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1484, Tiefe 1, Wurzeln: `FUNC-cli-dispatch`, `FUNC-harness-cli`._

Reichweite: 13 Elemente (FLOW 10, FUNC 3); Blackbox-Rand 7, nicht geoeffnet.

Dateien (realRef, 2):
- src/cli.ts
- src/surface/scaffold.ts

Tests (`graph_tests`, 13):
- tests/cli-args.test.ts
- tests/cli.scaffold.test.ts
- tests/harness-handle.test.ts
- tests/host.bridge.test.ts
- tests/knowledge-binding.test.ts
- tests/sitzung-kpi.test.ts
- tests/vertrag/SCHEMA-harness-handle.vertrag.test.ts
- tests/vertrag/SCHEMA-import-summary.vertrag.test.ts
- tests/vertrag/SCHEMA-install-result.vertrag.test.ts
- tests/vertrag/SCHEMA-repo-status.vertrag.test.ts
- tests/vertrag/SCHEMA-rewind-summary.vertrag.test.ts
- tests/vertrag/SCHEMA-upgrade-report.vertrag.test.ts
- tests/vertrag/SCHEMA-vertragstest-bericht.vertrag.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
