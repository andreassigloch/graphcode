# CR-GC-877: Skill se:import-code in eigene Kette

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1112 (finding)
**Erstellt:** 2026-10-28
**Item:** bok/items/ITEM-2026-1112.json (Lane: graph)

---

FUNC-import-code (Skill se:import-code) hängt seit CR-GC-874 in keiner Kette (R-30). Am Code: der Agent liest den Skill und ruft dann das CLI-Verb import-code (FLOW-cli-invocation-import-code agent-loop -> cli-dispatch -> import-code-verb). Eigene Kette unter UC-model-exchange, Einsprung agent-loop, Senke wie model-import; Skill bekommt REQ+TEST.

---

## Prüfung am Code

- Kein toter Code: `.claude/commands/se/import-code.md` weist den Agenten an, `npx @sigloch/graphcode import-code` zu rufen.
  Das Verb lebt: `src/cli.ts` `main` → `executeImportCode` (`src/surface/import-code-verb.ts`).
- Das Modell trägt den Weg schon: `FUNC-agent-loop -io-> FLOW-skill-request -io-> FUNC-import-code -io->
  FLOW-anleitung-import-code -io-> FUNC-agent-loop -io-> FLOW-cli-invocation-import-code -io-> FUNC-cli-dispatch`.
- `FCHAIN-model-import` startet bei `FUNC-cli-dispatch` (`ACTOR-auftraggeber`, `FLOW-cli-invocation`). Der Weg über
  den Skill hat einen anderen Einsprung (`FUNC-agent-loop`). Nach `se:top-level` Regel 4 ist das eine zweite Kette.
  In `model-import` aufgenommen, meldete FC-06 `[triggers-disagree]` (CR-GC-874 hat genau das aufgelöst).

## Entscheidung

Neue Kette `FCHAIN-skill-import-code` „Code per Skill einlesen" unter `UC-model-exchange`, vom Auslöser bis zur Senke:
`FUNC-agent-loop`, `FUNC-import-code`, dazu die Glieder von `FCHAIN-model-import`. Die Ketten teilen Glieder (Verband);
die neue Kette unterscheidet sich durch `FUNC-agent-loop` und `FUNC-import-code`.

Verworfen:
- `skill-help`: der Skill liest nicht nur, er lässt schreiben; 10 R-21-Warnungen (CR-GC-874).
- `skill-authoring`: der Skilltext nennt kein Gate-Werkzeug, `tests/skill-authoring-gate.test.ts` scheitert;
  die Glieder des Imports gehören nicht zum Anlegen per `graph_mutate`.

## Umfang

| Ort | Änderung |
|---|---|
| Modell | `FCHAIN-skill-import-code`, `UC-model-exchange -compose->` sie, `compose` auf die Glieder; `sync` an den Flüssen prüfen |
| Modell | `REQ-skill-import-code-nennt-verb` (functional) + `TEST-…`, `FUNC-import-code -satisfy->` |
| `tests/skill-import-code.test.ts` (neu) | die Command-Datei nennt das Verb `import-code`, das im CLI registriert ist, und `graph_export` |
| CR-Knoten | `relation` auf Kette, REQ, TEST, `FUNC-import-code` |

## Akzeptanz

- R-30 an `FUNC-import-code` weg; FC-06 an der neuen Kette 0 Befunde; R-21, IO-01, FC-05 ohne neue Befunde.
- Der neue Test ist rot gegen eine Skill-Datei ohne das Verb, grün gegen die echte.
- `verify:model` und `npm test` grün bis auf das bekannte Rot in `distribution.test.ts`.

Nicht im Umfang: `FUNC-schema-guard` bleibt Glied von `host-start` und `http-host` (`open` ruft ihn beim Start;
Entscheidung des Autors 2026-10-28: in der Kette, nicht separat).

---

## Umsetzung (2026-10-28)

Schreibweg: `graph_mutate` des graphcode-Hosts (Socket `.graphcode/host.sock`), Version 983 → 986, danach `graph_export`. Kein Hand-Edit der SSOT.

Modell-Züge:
- `FCHAIN-skill-import-code` „Code per Skill einlesen", `UC-model-exchange -compose->` sie.
- 15 Glieder per `compose`: die 13 FUNC von `FCHAIN-model-import` sowie `FUNC-agent-loop` und `FUNC-import-code`. Alle 13 werden auf dem Weg `import-code` durchlaufen (Beleg unten); keines fiel weg.
- `REQ-skill-import-code-nennt-verb` (`@kinds ["functional"]`), `FUNC-import-code -satisfy->` sie, `UC-model-exchange -compose->` sie.
- `TEST-skill-import-code-nennt-verb -verify->` REQ, `testRefs` auf `tests/skill-import-code.test.ts`, Ergebnis `passed` über `graph_test_ingest`.
- `CR-GC-877 -relation->` REQ, `FUNC-import-code`, `UC-model-exchange`.
- Alle Flüsse an den Gliedern tragen schon `sync`/`async`; `unsynced` meldet FC-06 für die neue Kette nicht. Kein Fluss neu angelegt.

Abweichung vom Umfang: Die Ontologie lässt `CR -relation->` nur auf FUNC, REQ, MS, MOD, SCHEMA, UC zu. `CR → FCHAIN` und `CR → TEST` lehnt das Gate mit R-18 ab. Die Kante geht deshalb auf das UC (`UC-model-exchange`), das die Kette trägt, nicht auf Kette und TEST.

Beleg am Code (`src/cli.ts` `main`, `src/surface/import-code-verb.ts`):
- `FUNC-cli-dispatch`: `main`, Zweig `case 'import-code'`.
- `FUNC-import-code-verb`: `executeImportCode`.
- `FUNC-create-harness`: `createHarness` im Verb. `FUNC-open-store` und `FUNC-claim-store-lock`: `harness.initialize()` ruft `GraphStore.open` (Lock, Schema-Guard). `FUNC-graph-store`: derselbe Store.
- `FUNC-seed-from-json`, `FUNC-import`: `harness.seedFromJson()` bei leerem Graph → `seedFromJsonFile` → `importOntologyGraph`.
- `FUNC-bind-tools`: `bindToolsToHarness(harness)`.
- `FUNC-graph-mutate-tool`, `FUNC-decode`, `FUNC-mutate`: `registry['graph_mutate'].handler` → `formatEToCommands` → `apply`.
- `FUNC-graph-export-snapshot`: `registry['graph_export'].handler`.
- Senke: `main` schreibt die Zusammenfassung auf stderr und setzt den Exit-Code. Beim Skill-Weg liest der Agent beides und gibt es mit `FLOW-ergebnis` an `ACTOR-auftraggeber`. Das Modell trägt zusätzlich `FLOW-cli-output` (`FUNC-cli-dispatch` → Auftraggeber) wie bei `model-import`; es gibt keinen Fluss `cli-dispatch` → `agent-loop`.

## Messung

Mit `fc06OneTrigger` und `evaluateAllRules` (Standardpolicy) aus `sigloch-modules/packages/contracts/dist` über `docs/graph/graphcode.graph.json`.

| Messgröße | vorher (v983) | nachher (v986) |
|---|---|---|
| R-30 | 1 (`FUNC-import-code`) | 0 |
| FC-06 gesamt | 1 (`docked-session`) | 2 (`docked-session`, `skill-import-code`) |
| FC-06 an `skill-import-code` | – | 1 (`triggers-disagree`) |
| R-21 | 1 | 1 |
| IO-01 | 0 | 0 |
| FC-05 | 0 | 0 |
| Fehler (severity error) | 0 | 0 |
| R-02 | 1 | 0 (`FUNC-import-code` hat jetzt eine REQ) |
| CR-R01 | 26 | 25 |
| alle anderen Regeln | gleich | gleich |

Akzeptanz: R-30 weg (erfüllt), keine Fehler (erfüllt), R-21/IO-01/FC-05 ohne neue Befunde (erfüllt), **FC-06 an der neuen Kette 0 (nicht erfüllt: 1)**.

## Befund: FC-06 `triggers-disagree` an `FCHAIN-skill-import-code`

Root Cause: Die Kette hat zwei Eingänge des Auftraggebers, und beide erreichen alle 15 Glieder.
- `FLOW-auftrag` an `FUNC-agent-loop` (der gewollte Einsprung).
- `FLOW-cli-invocation` an `FUNC-cli-dispatch` (Aufruf durch einen Menschen; `cli-dispatch` ist Glied, also zählt der Fluss).
- Von `cli-dispatch` führt der Weg zurück zu `agent-loop` über `FLOW-cli-command` → `import-code-verb` → `FLOW-export-request-import-code` → `graph-export-snapshot` → `FLOW-export-answer` an `agent-loop` (ebenso `FLOW-mutate-answer` von `graph-mutate-tool`). Diese beiden Antwortflüsse gehen im Modell an den Agenten, der die Werkzeuge direkt über MCP ruft. Auf dem Skill-Weg antwortet `graph_export` dem Verb, nicht dem Agenten. Sobald `agent-loop` und diese Werkzeuge Glieder derselben Kette sind, sieht `chainRoles` den Rückweg.

Geprüft, nicht behoben:
- `FUNC-graph-export-snapshot` aus der Kette nehmen: `graph-mutate-tool` liefert denselben Rückweg.
- Beide Werkzeuge aus der Kette nehmen: `FUNC-decode` hängt ab (FC-05 +1, IO-01 +1, FC-06 `no-trigger`). Das verfälscht den Weg, der am Code durchlaufen wird.
- Ein Fluss `cli-dispatch` → `agent-loop` für die Senke verschärft den Rückweg.

Entscheidung nötig (Autor): (a) `chainRoles` in sigloch-modules so ändern, dass ein Eingang, dessen Deckung nur über Antwortflüsse an den Agenten ganz M erreicht, nicht als Auslöser zählt; (b) Antwortflüsse je Aufrufer trennen (`FLOW-export-answer-import-code-verb` für das Verb, `FLOW-export-answer` nur für den Agenten) und den Agenten-Antwortfluss nicht in dieser Kette führen — das Modell kennt Flüsse nur global, (b) lässt den Rückweg bestehen; (c) FC-06 an dieser Kette als benannte Entscheidung stehen lassen, wie `docked-session`.

## Tests

- `tests/skill-import-code.test.ts` (neu, 4 Tests). Rot gegen eine Kopie von `import-code.md` ohne das Verb und ohne `graph_export` (3 von 4 rot, geprüft mit temporärer Testkopie, danach gelöscht), grün gegen die echte Datei.
- `verify:model` grün (53 Dateien, 448 Tests). `type-check` grün.
- `npm test`: 1651 grün, 2 rot plus 1 Datei nicht ladbar, keines davon aus diesem CR:
  - `distribution.test.ts` (bekannt, contracts unveröffentlicht).
  - `skill-rule-ids.test.ts`, `skill-top-level-ausloeser.test.ts`: lesen `.claude/commands/se-view/*`, die die Nachbarsitzung (CR-GC-876) im Arbeitsbaum löscht. `help-content.test.ts` ist dort ebenfalls geändert.
- Keine Kettenzahlen neu verankert; kein Test zählte Ketten.

**Status:** offen. Der CR bleibt offen, bis die Entscheidung zu FC-06 gefallen ist.
