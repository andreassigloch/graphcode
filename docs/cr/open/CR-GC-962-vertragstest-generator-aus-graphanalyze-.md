# CR-GC-962: Vertragstest-Generator nach graphcode (Verb `graphcode vertragstest`)

**Typ:** aus Item ITEM-2026-1477 (idea)
**Erstellt:** 2026-11-19
**Item:** bok/items/ITEM-2026-1477.json (Lane: graph)
**Status:** Open
**Herkunft:** CR-GC-961 F1 (Entscheidung des Autors 2026-11-19), CR-GC-958 (Spike, G1 Go)

---

## Befund

Der Vertragstest-Generator liegt in `graphanalyze/werkzeuge/vertragstest/` (vier `.mjs`, ein Unit-Test). Er erzeugt je SCHEMA mit Zod-`realRef` eine vitest-Datei aus dem Schema selbst. Im Spike fand er 44 von 48 eingebauten Schema-Fehlern, die Handtests 27 (CR-GC-958). CR-GC-961 F1 entschied: Generator und Skill-Schritt werden fester Teil von graphcode.

`CLAUDE.md` und README sagen „IS NOT: a generator“ bzw. „Is not: a code generator“. Der Autor hat entschieden, den Satzteil ganz zu streichen.

## Zielbild

- Verb `graphcode vertragstest [SCHEMA-uid …] [--ziel <dir>]`. Liest den Snapshot `docs/graph/*.graph.json` (kein Store, kein Host-Konflikt). Ohne uids: jedes SCHEMA mit `realRef`, dessen Datei im Repo liegt. Ziel ohne Flag: `tests/vertrag/`.
- Je SCHEMA eine Datei `<uid>.vertrag.test.ts` mit Kopf `// erzeugt aus dem Modell (graphcode vertragstest) — <uid> → <file>#<symbol>. Nicht von Hand ändern, neu erzeugen.`
- Der Bericht je SCHEMA (Fälle, verworfene Fälle oder Fehler) geht als JSON nach stderr. Exit 1, wenn ein SCHEMA keinen Test bekam; Exit 2 bei falschem Aufruf.
- Die TS-Quellen des Ziel-Repos lädt ein Kindprozess mit `--experimental-transform-types` und einem Lade-Hook `.js → .ts`. Gemessen: Strip-only (Node 22 ohne Flag) scheitert an Parameter-Properties in `status.ts`, `scaffold.ts`, `init-verb.ts`, `upgrade.ts`.

## Änderungen

| Datei | Was |
|---|---|
| `src/projections/vertragstest.ts` (neu) | `beispiel`, `erzeugeFaelle`, `testDatei`, `erzeugeVertragstests`; Schemas `VertragstestSatzSchema`, `VertragstestBerichtSchema` |
| `src/surface/vertragstest-verb.ts` (neu) | `executeVertragstest`: Satz aus dem Snapshot, Kindprozess, Bericht |
| `src/surface/cli-args.ts`, `src/cli.ts` | Verb und Usage |
| `tests/vertragstest.test.ts` (neu) | Unit-Tests aus graphanalyze übernommen, plus Verb gegen ein Temp-Repo |
| `tests/vertrag/*.vertrag.test.ts` | 5 bestehende neu erzeugt (Kopf), 2 neue für die Schemas dieses CR |
| `CLAUDE.md`, `README.md` | Satzteil „generator“ gestrichen; README nennt das Verb |
| graphanalyze: `werkzeuge/vertragstest/`, `tests/vertragstest.test.ts`, README | gelöscht bzw. Zeile entfernt (kein zweiter Weg) |

**Dateigrenze überschritten:** 13 Dateien in graphcode, 6 in graphanalyze. Begründung (FAQ `cr-dateigrenze-ausnahme`): Jeder Schnitt ließe den Generator an zwei Orten stehen oder 5 Testköpfe auf ein gelöschtes Werkzeug zeigen. Die 7 Testdateien sind mechanisch erzeugt.

## Modell

- FUNC `FUNC-vertragstest-verb` (MOD-surface, `executeVertragstest`) und `FUNC-erzeuge-vertragstests` (MOD-projections, `erzeugeVertragstests`).
- FLOW `FLOW-vertragstest-satz` (Verb → Erzeuger, SCHEMA `SCHEMA-vertragstest-satz`) und `FLOW-vertragstest-bericht` (Erzeuger → Verb, SCHEMA `SCHEMA-vertragstest-bericht`); `FLOW-cli-command` io zum Verb.
- FCHAIN `FCHAIN-contract-test-generation` unter `UC-intent-to-code`.
- REQ `REQ-contract-test-generation` mit TEST `TEST-vertragstest-generator` (`tests/vertragstest.test.ts`); je neues SCHEMA ein TEST-vertrag-*.

## Akzeptanzkriterien

- [ ] `graphcode vertragstest` erzeugt in graphcode dieselben 5 Vertragstests wie bisher, nur mit neuem Kopf; alle grün.
- [ ] Die 2 neuen SCHEMA haben erzeugte Vertragstests, grün.
- [ ] Unit-Tests grün; Verb gegen Temp-Repo: Datei entsteht, Exit 0; unbekannte uid: Exit 2.
- [ ] `CLAUDE.md` und README nennen kein „generator“ mehr in der Ist-nicht-Liste.
- [ ] graphanalyze enthält keinen Generator mehr; seine Tests grün.
- [ ] Build, Lint, `verify:full CR-GC-962` grün; R-26, R-32, RC-04, RC-08 ohne Befund an den neuen Knoten.


---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| — | keine | Der CR setzt CR-GC-961 F1 um. |

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
