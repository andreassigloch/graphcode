# CR-GC-989: Fluesse tragen den Vertrag, den der Code uebertraegt

**Typ:** aus Item ITEM-2026-1557 (finding)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1557.json (Lane: code)

---

## Befund

Folge von CR-GC-986. Der Autor hat am 2026-11-21 entschieden (FAQ `flow-ein-schema`): ein FLOW, genau ein Vertrag; je Verbindung ein eigener FLOW. Neun FLOW hingen an `SCHEMA-cli-command` (`CliVerbSchema`, der Name eines CLI-Verbs), zwei an `SCHEMA-mutate-result`, obwohl der Code etwas anderes überträgt. Am Code geprüft (Stand graphVersion 1438: R-26 8, R-32 11, RC-04 15, R-21 1, FC-06 2, R-19 21):

| FLOW | Was der Code überträgt | Beleg | Zug |
|---|---|---|---|
| `FLOW-cli-output` | je Verb eine andere Form auf stdout oder stderr | `src/cli.ts` 148, 176, 200, 235, 256, 265, 279, 291, 312 | geteilt, Sammelfluss gelöscht |
| `FLOW-gve-attach` | Pfad der Repo-Wurzel an `attachGve` | `src/surface/mcp-server.ts` `serveStdio` | an `SCHEMA-repo-pfad` |
| `FLOW-viewer-start` | `--repo <Pfad>` beim Start und SIGTERM beim Ende | `src/surface/gve.ts` `spawnViewer`, `killProcessGroup` | geteilt: Start trägt den Pfad, Ende kommt in `FLOW-viewer-stop` |
| `FLOW-session-end` | ein Grund: Signal, Ende des stdio-Clients, Verlust des Locks | `src/surface/session-lifecycle.ts` `installTriggers`, `end`; `mcp-server.ts` `onLockLost` | an `SCHEMA-sitzungsende` |
| `FLOW-gve-stop` | `gve.stop()` ohne Argument | `src/surface/gve.ts` `GveHandle.stop` | an `SCHEMA-aufruf-ohne-daten` |
| `FLOW-proxy-answer`, `FLOW-proxy-answer-agent` | die Antwort des Werkzeugs, je Werkzeug eine andere Form | `src/surface/host-shim.ts` `handleLine` (`result = await tool.handler(...)`), `dispatch` (liefert `unknown`) | ausgelassen, siehe unten |

## Änderung

**Code (7 Dateien).** Neu: `src/surface/repo-pfad-contract.ts` (`RepoPfadSchema = z.string().min(1)`), `src/surface/session-end-contract.ts` (`SitzungsendeSchema`, fünf Werte; `SITZUNGSENDE_SIGNALE` leitet die Signale daraus ab), `src/surface/aufruf-ohne-daten-contract.ts` (`z.void()`). Geändert: `mcp-server.ts` (`serveStdio` parst den Pfad zuerst), `gve.ts` (`ensureViewer` parst den Pfad, `stop` parst sein Argument), `session-lifecycle.ts` (`end` parst den Grund, `installTriggers` bindet die Signale aus dem Vertrag, die zweite Liste entfällt), `projections/vertragstest.ts` (`z.void` als Wurzel: Beispiel `undefined`, Ablehnung eines Werts). Gezählt: 3 neue, 4 geänderte Quelldateien.

**Modell.** Drei SCHEMA mit `realRef`, drei TEST mit `verify` und `testRefs`. `FLOW-cli-output` gelöscht, sechs FLOW dafür (`FLOW-cli-output-status`, `-upgrade`, `-import-code`, `-rewind`, `-vertragstest`, `-remove`), je `FUNC-cli-dispatch` an `ACTOR-auftraggeber` mit dem vorhandenen SCHEMA der Ausgabe. Vier FLOW umgebunden (delete-edge und add-edge in einem Batch), `FLOW-viewer-stop` neu. CR-Kanten auf die Funktionen und SCHEMA des Umfangs.

**Tests.** Von Hand: `tests/flow-vertraege.test.ts` (6 Fälle: Parse an den Grenzen), 4 neue Fälle in `tests/vertragstest.test.ts` (Wurzel `z.void`, `z.enum`, `z.string().min(1)`), und `tests/arch.optimization-dry-run.spike.test.ts` (festgeschriebene Zugliste neu gemessen, siehe unten). Gezählt: 7 Quell- und 3 Handtestdateien, zusammen 10. Erzeugt (Fan-out, 3 Dateien): `tests/vertrag/SCHEMA-repo-pfad.vertrag.test.ts` (4 Fälle), `SCHEMA-sitzungsende.vertrag.test.ts` (8), `SCHEMA-aufruf-ohne-daten.vertrag.test.ts` (2).

## Ausgelassen: Proxy-Flüsse

Die Prüfung nach Auftrag: (a) `CallToolResultSchema` steht in `@modelcontextprotocol/sdk` 1.29.0 (`dist/esm/types.d.ts:2501`). (b) Der Proxy überträgt diese Form nicht: `handleLine` sendet das rohe Ergebnis von `tool.handler`, `dispatch` gibt `unknown` zurück; den Text-Block `{ content: [{ type: 'text', ... }] }` baut erst `bindRegistryToMcpServer` (`mcp-server.ts` 88), außerhalb des Proxys. (c) Der Generator löst nur `@sigloch/<name>` aus `packages/<name>/src/...` auf (`vertragstest-verb.ts` `paketVon`), kein Schema aus dem MCP-SDK. Also kein Vertrag „Werkzeug-Antwort", kein lokaler Nachbau. `FLOW-proxy-answer` und `FLOW-proxy-answer-agent` bleiben an `SCHEMA-mutate-result`, vorgelegt.

## Festgeschriebener Messwert nachgezogen

`tests/arch.optimization-dry-run.spike.test.ts` (Lauf A, Zugliste am Engpass) war nach dem Modellzug rot: drei Züge statt vier, `FUNC-block-abfrage -compose-> FUNC-serve-stdio` wird nicht mehr vorgeschlagen. Ursache: der Fluss `FLOW-gve-attach` trägt jetzt `SCHEMA-repo-pfad` statt `SCHEMA-cli-command`, und der Sammelfluss `FLOW-cli-output` ist in sechs Flüsse zerfallen. Neu gemessen am 2026-11-21 (graphVersion 1440), Vermerk mit Datum und Ursache im Test; keine Erwartung gelockert, ein Zug weniger.

## Nicht umgebaut, nur geprüft

| FLOW | Was der Code überträgt | Urteil |
|---|---|---|
| `FLOW-cli-command` | das geparste Verb (`verb = parsed.data`), der Handler wird per `switch` gewählt | trägt den Verb-Namen; die Beschreibung nennt `run` und `update`, die es nicht gibt, und lässt `status`, `render`, `upgrade`, `vertragstest` aus |
| `FLOW-cli-invocation` | die rohe Argumentliste (`process.argv`) mit Verb und Optionen; geht auch an `commit-check` und `verify:lane-*`, das sind Skripte, keine Verben | trägt mehr als den Verb-Namen |
| `FLOW-cli-invocation-import-code` | `import-code [dir]` | trägt Verb und Pfad |
| `FLOW-cli-invocation-render` | `render <sicht> --format ...` | trägt Verb, Sicht, Format |

Kein Verb ohne SCHEMA bis auf `skills sync`: `syncSkills` gibt `SkillSyncResult` zurück, in Code mit `SkillSyncResultSchema` (`scaffold.ts` 113), im Modell gibt es dazu kein SCHEMA und keinen FLOW. Nicht gebunden, vorgelegt.

## Nachweis rot-zuerst

| Prüfung | Rot gesehen |
|---|---|
| Generator, `z.void` als Wurzel | 2 rot (`Typ void nicht unterstuetzt`), nach Ergänzung grün; `z.enum`- und `z.string().min(1)`-Wurzel waren schon grün |
| Mutante: Parse in `serveStdio` entfernt | 1 rot |
| Mutante: Parse in `ensureViewer` entfernt | 1 rot (der Aufruf lief gegen den echten Viewer des Repos und lieferte `serving`) |
| Mutante: Parse in `stop` entfernt | 1 rot |
| Mutante: Parse in `end` entfernt | 1 rot |
| Mutante: Signalliste in `installTriggers` wieder eigen (nur 2) | 1 rot |
| Mutante: `RepoPfadSchema` ohne `min(1)` | 1 rot (erzeugter Test) |
| Mutante: ein sechster Wert im Enum | 1 rot (Werteliste) |
| Mutante: `z.void()` durch `z.undefined().or(z.string())` | 1 rot (erzeugter Test) |

## Akzeptanz

- [x] `npm run build` und `npm run type-check` grün. `verify:code`: 82 Dateien, 1327 Tests, ein roter Test (festgeschriebene Zugliste, nachgezogen, siehe oben), danach grün. `verify:full CR-GC-989`: 271 Dateien, 3468 Tests grün, Schlupf 0, Rückmeldung 208 Ergebnisse, 0 zurückgenommen.
- [x] `rules_evaluate` grouped vorher und nachher (graphVersion 1438 und 1440): R-26 8/8, R-32 11/11, RC-04 15/15, R-21 1/1, FC-06 2/2, R-19 21/21. Die drei neuen SCHEMA stehen in keiner Liste.
- [x] Smoke: `node dist/cli.js status` startet.

---

## Entscheidungen

| Frage | Festlegung | Begründung |
|---|---|---|
| Wie bindet ein FLOW die Ausgabe eines Verbs, das mehrere Verben teilen (`remove` und `upgrade --refresh-only`)? | ein FLOW je Verbindung `FUNC-cli-dispatch` zu `ACTOR-auftraggeber`; `remove` und `--refresh-only` teilen sich `FLOW-cli-output-remove`, weil sie dieselbe Verbindung und dieselbe Form (`InstallResult`) haben | FAQ `flow-ein-schema` |
| Gehört der Verlust des Store-Locks in `SCHEMA-sitzungsende`? | offen, beim Autor: `end` nimmt den Grund `store lock lost` über denselben Weg an, im Modell kommt er über `FLOW-lock-lost` mit `SCHEMA-lock-owner`, der Aufruf `onLockLost` trägt aber kein Argument | der Vertrag zählt, was `end` annimmt; die Bindung von `FLOW-lock-lost` ist nicht Teil dieses CR |
| Trägt das Ende des Viewers keine Daten? | offen, beim Autor: `killProcessGroup(pid)` bekommt die Prozess-ID als Adresse; der Vertrag `z.void` gilt für den Aufruf `stop()`, nicht für `kill(pid)` | die pid adressiert, sie ist keine Nutzlast des FLOW |

---

## Umfang laut `graph_impact`

`graph_impact(FLOW-cli-output)`, Tiefe 2: 40 Knoten, 9 FCHAIN, 6 UC, `FUNC-cli-dispatch`; keine Test- und Skriptdatei nennt die uid. `graph_impact(FLOW-viewer-start)`: `FUNC-gve-supervise`, `FLOW-gve-attach`, `FLOW-gve-stop`. Kein Dependent außer den genannten. Löschen: erst die sechs Ersatz-FLOW und ihre Kanten, dann der Sammelfluss, im selben Batch (FAQ `entfernen-reihenfolge`).
