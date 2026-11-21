# CR-GC-982: RC-04 im Kern: Erzeuger parsen Delta, Advisory, Bericht und Neuaufbau-Hinweis

**Typ:** aus Item ITEM-2026-1536 (finding)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1536.json (Lane: code)

---

## Befund

RC-04 meldet 23 SCHEMA, deren Zod-Symbol an der modellierten Schnittstelle in keiner realisierten FUNC mit `X.parse(` oder `X.safeParse(` steht. Jedes SCHEMA wurde am Code klassifiziert, bevor etwas geändert wird (FAQ element-erfinden-fuer-regel Punkt 6). Dieser CR setzt die Klasse (a) im Kern um; die Klasse (a) in loop, projections und surface folgt in den Folge-CR. Die Tabelle gilt für alle.

Klassen: (a) Parse fehlt, Erzeuger parst; (b) Parse existiert, die Regel erkennt ihn nicht (Parse über ein umhüllendes Schema oder einen generischen Helfer); (c) Fehlbindung; (d) Vertrag aus einem Paket, nur in-process oder nur TS-Typ: nichts bauen, vorlegen; (e) unklar: vorlegen.

| SCHEMA | Klasse | Beleg | Zug |
|---|---|---|---|
| steering-delta | a | `computeSteeringDelta` baut das Delta, das an der `graph_mutate`-Antwort hängt (`steering-snapshot.ts:128`), ohne Parse | dieser CR |
| fit-advisory | a | `computeFitAdvisory` (`fit-advisory.ts:58`), Kommentar „verlässt den Prozess am MutateResult“ | dieser CR |
| zug-bericht | a | `zugBericht` (`zug-bericht.ts:122`) gibt den Bericht an Mutate- und Suggest-Antwort | dieser CR |
| store-rebuild-notice | a | `open-store` erzeugt den Hinweis in `graph-store.ts:99-117`; geparst wird erst im Formatierer `store-rebuild-notice.ts:40` (andere Datei, Aufrufer kann es umgehen) | dieser CR: Parse beim Erzeugen, der Parse im Formatierer entfällt |
| generation-step | a | `generationStep` (`loop/generate.ts:505`) ist die Antwort von `graph_generate` | Folge-CR loop |
| lauf-urteil | a | `laufUrteil` (`projections/test-schlupf.ts:225`) gibt das Urteil an die Lanes (`scripts/verify-*.mjs`) | Folge-CR projections |
| update-event | a | `broadcast` (`surface/host.ts:297`) schreibt `JSON.stringify(event)` auf den SSE-Draht | Folge-CR surface |
| cli-command | a und c | `CliCommandSchema` ist `init\|update\|remove` (`scaffold.ts:87`), die CLI kennt 11 Verben (`cli-args.ts:22`); `main` (`cli.ts:98`) schaltet den rohen String | Folge-CR surface: Verb-Schema aus der Verbtabelle, Parse in `main`, Bindung berichtigen (ITEM-2026-1474) |
| metric-policy | b | `GraphcodeConfigSchema.safeParse` (`kernel/config.ts:154`) prüft das Feld `metricPolicy: MetricPolicySchema.optional()` beim Lesen der Config-Datei | Regelbefund |
| mcp-tool | b | `MCPToolRegistrySchema.parse(registry)` (`surface/mcp-tools.ts:194`), `MCPToolRegistrySchema = z.record(MCPToolSchema)` | Regelbefund |
| test-ingest-input | b | `tool.inputSchema.parse(input)` in der Werkzeug-Hülle (`surface/mcp-tools.ts:115`), generischer Helfer; ein zweiter Parse im Handler wäre ein zweiter Pfad | Regelbefund |
| chain-metrics, function-criticality, module-metrics | b | `GraphMetricsAnswerSchema.parse` (`projections/metrics.ts:158`) enthält `z.array(ModuleMetrics)`, `z.array(FunctionCriticality)`, `ChainMetrics` | Regelbefund |
| trajectory | b | `projectTrajectory` aus `@sigloch/learning-core` prüft gegen ein geschlossenes Zod-Schema (`projections/trajectory.ts:152`); der Parse liegt im Paket | Regelbefund |
| steering-snapshot | e | CR-GC-786 hat den Parse bewusst entfernt (`steering-snapshot.ts:56`): ein Wert außerhalb des Vertrags ist ein Befund der Regel R-08; der Snapshot bleibt im Prozess | vorgelegt |
| mutate-result | e | `FLOW-mutate-answer` trägt die Werkzeug-Antwort (`Omit<MutateResult,'violations'>` plus Zusammenfassung, `surface/write.ts:300`), nicht `MutateResult`; `harness.mutate` ist in-process | vorgelegt |
| rule-violation, ontology-graph | d | in-process zwischen FUNC; `OntologyGraph` hat mehrere hundert Elemente je Messung (FAQ rc04-parse-an-der-grenze Variante 1) | vorgelegt |
| metric-vector | d | Paketfunktion `arch-fitness` zu `fit-advisory`, ein Aufruf im Prozess | vorgelegt |
| impact-slice | d | `impactSlice` aus `@sigloch/graph-api-core` (`kernel/harness.ts:262`); Parse gehörte in das Paket | vorgelegt |
| completeness | d | `ReadinessMark` ist ein TS-Typ, kein Zod-Schema | vorgelegt |
| readiness-report | c und d | `realRef` zeigt auf `contracts/src/se/readiness.ts`, der Typ liegt in `src/kernel/measure/readiness.ts` und ist kein Zod-Schema | vorgelegt (CR-GC-981: erst `realRef` berichtigen, Familie) |

## Änderung (Kern)

- `computeSteeringDelta`, `computeFitAdvisory`, `zugBericht`: der Erzeuger parst sein Ergebnis und gibt das Original zurück (FAQ erzeuger-parst-vertrag). `zugBericht` parst innerhalb des vorhandenen `try`: ein Bruch wird `berichtFehlt`, sichtbar statt still.
- `open-store`: `StoreRebuildNoticeSchema.parse(rebuild)` beim Erzeugen; der Formatierer parst nicht mehr (ein Parse, am Ort der Entstehung).

## Entscheidungen

keine.

## Umfang laut `graph_impact`

Die Änderung berührt vier FUNC im Kern (`FUNC-compute-steering-delta`, `FUNC-fit-advisory`, `FUNC-zug-bericht`, `FUNC-open-store`). Testspur über `graph_tests`.

## Nachweis rot-zuerst

- `computeSteeringDelta` mit `blockingErrors: NaN`: vor der Änderung lief das Delta durch (Test rot: „expected [Function] to throw“), danach lehnt der Erzeuger ab (grün).
- `computeFitAdvisory`, `zugBericht`, `open-store`: **kein Rot-zuerst-Fall**. Aus gültigen Graphen und Richtlinien entsteht kein Wert außerhalb des Vertrags (Probe: leerer Graph und Richtlinie mit NaN-Schwellen liefern gültige Berichte, der Test auf `berichtFehlt` blieb vor und nach der Änderung rot und ist gelöscht). Die Parse-Aufrufe schützen gegen künftige Brüche; ihr Nachweis ist die Regel: RC-04 sinkt von 23 auf 19.
- Messung RC-04 (Skript über `conformanceEvaluation` am Arbeitsbaum): fit-advisory, steering-delta, store-rebuild-notice und zug-bericht sind aus der Liste.
- Perf: die vier Parse laufen je Zug (zwei kleine Objekte) bzw. einmal je Store-Neuaufbau; `tests/perf.*` und `verify:code` (80 Dateien, 815 Tests) grün.


## Abschluss

`verify:code` 80 Dateien, 815 Tests grün; `verify:full CR-GC-982`: 263 Dateien, 2557 Tests grün, Schlupf 0. ITEM-2026-1474: wird vom CR-Folgeschritt `cli-command` (Surface) erledigt, nicht von diesem CR.
