# CR-GC-789: Merkmal sync an den Fluessen des Selbstmodells

**Status:** ✅ Done (2026-10-11)
**Typ:** aus Item ITEM-2026-838 (idea)
**Erstellt:** 2026-10-11
**Item:** bok/items/ITEM-2026-838.json (Lane: graph)

---

**Bezug:** `docs/graphcode_analyse_optimierungskonzept.md`, Abschnitt 10; sigloch-modules
`docs/cr/open/CR-SM-408-antwortweg-je-kette-merkmal-sync-am-flus.md`; Skill `se-vorbereitung`, Schritt 3.

## Ergebnis

119 von 127 Flüssen tragen das Attribut `sync`: 98 mit `sync`, 21 mit `async`. Acht bleiben ohne Merkmal: fünf
offen, drei zu trennen. Kein Fluss wurde getrennt, keine Kante bewegt.

Der Antwortweg ist bei 6 von 22 Ketten mit Ausgang an einen Akteur lesbar, bei 16 blockiert ein Fluss ohne
Merkmal die Aussage. `FLOW-gate-verdict` allein blockiert 14 Ketten.

## Anlass

Die Laufzeitanalyse einer Kette liest den Antwortweg: die Glieder, auf die die Antwort an einen Akteur wartet.
Dafür braucht jeder Fluss das Merkmal. Kein Fluss des Modells trug es. CR-SM-408 wartet auf ein Modell, das es
im SSOT trägt.

## Bedeutung (vom Autor festgelegt)

- `sync`: der Abnehmer wartet beim Aufruf auf diese Lieferung; seine Antwort hängt daran.
- `async`: der Erzeuger hat vorab geliefert (eigener Takt, Ablage, Datei, Ereignisstrom, vorher gesetzter
  Zustand); der Abnehmer liest, was da ist.
- Es gilt die Sicht des Abnehmers. Ein Wert je Fluss.

## Umfang

Nur das Attribut `sync` an FLOW-Knoten, durch `graph_mutate` (Version 695 auf 697), dazu der CR-Knoten
(Version 698). Je Fluss wurden Erzeuger und Abnehmer aus dem Modell gelesen und die Bindung (`realRef`) der
beteiligten Funktionen im Code nachgeschlagen.

## Urteile

Diese Setzungen folgen nicht allein aus dem Code. Der Autor kann sie anders sehen.

1. **Fluss in eine Ablage ist `async`.** Der Schreiber ruft und wartet, die späteren Leser hängen nicht am
   Schreiber; die Ablage entkoppelt. Betrifft: `graph-delta`, `imported-graph`, `reseeded-graph` (Store),
   `audit-record` (Log), `lock-release` (Lock-Datei), `session-entry`, `target-profile-file`, `config-file`,
   dazu die Dateien an einen Akteur: `graph-snapshot-file`, `markdown-docs`, `export-pending`, `trajectory`,
   `schlupf-zeile`, `channel-guardrails`.
2. **Abruf beim Besitzer der Ablage ist `sync`.** `graph-state` (23 Abnehmer) steht auf `sync`: der Abnehmer
   ruft `current()` oder `loadGraph()` und wartet. Damit liegt `graph-store` auf fast jedem Antwortweg. Wer den
   gehaltenen Stand als vorher gesetzten Zustand liest, setzt hier `async`.
3. **Übergabe beim Start ist `sync`.** `harness-handle`, `tool-context`, `mcp-tool`, `mcp-tool-registry`,
   `tool-registry`, `store-ownership`: die Lieferung entsteht einmal beim Start im Aufruf des Abnehmers, spätere
   Werkzeugaufrufe lesen sie als Zustand. Gesetzt nach dem Aufruf im Code.
4. **`metric-policy` ist `async`,** obwohl sie ebenfalls beim Start entsteht: ihre Abnehmer (`evaluate-rules`,
   `take-steering-snapshot`) laufen je Aufruf und lesen das gehaltene Feld.
5. **Ereignisse sind `async`:** `live-event`, `live-event-host`, `sse-frame`. Im Code ist der Weg ein direkter
   Rückruf im Hook nach dem Anwenden; die Antwort des Abnehmers hängt nicht daran.
6. **Vom Menschen gepflegte Konstanten sind `async`:** `channel-dimension-template`, `channel-rule-clause`,
   `channel-gate-protocol` (Erzeuger im Modell ist der Owner, im Code sind es Konstanten).
7. **`vorschlag` an den Owner ist `sync`:** das Feld reist in der Antwort von `graph_mutate`. Den Weg vom
   Werkzeugergebnis zum Menschen legt der Client; er steht nicht im Code von graphcode.
8. **Kennzahlen an das Dashboard sind `sync`** (`chain-metrics`, `function-criticality`, `module-metrics`):
   der Viewer fragt `graph_metrics` ab. Der Beleg für diesen Abnehmer liegt im Viewer-Repo, nicht hier.
9. **Befehl ans Gate ist `sync`.** Der Abnehmer ist das Gate; es wird mit dem Befehl gerufen, sein Urteil hängt
   daran. Folge in der Nachmessung: jeder Absender eines Befehls, der kein Glied der Kette ist, erscheint als
   „verlässt die Kette".
10. **`FUNC-compute-readiness` gilt als gebunden,** obwohl `realRef` auf
    `packages/se-engine/src/readiness-compute.ts` zeigt und es diese Datei nicht gibt. Das Symbol
    `computeReadiness` liegt in `packages/graphcode-client/src/readiness.ts:194`; dort wurde gelesen. Betrifft
    `completeness`, `conformance-findings`, `dimension-readiness`.

## Gemeinsame Belege der Gruppen

- **G1, Befehl ans Gate (22 Flüsse `mutate-cmd-*`):** ein Aufrufweg für alle. `src/surface/write.ts:388`
  (`graph_mutate` wartet auf `harness.mutateWithStates`), `src/kernel/harness.ts:354-355`, `src/kernel/gate.ts:48`.
  Die Skills rufen `graph_mutate` und warten (je Skill-Datei unter `.claude/commands`, z. B. `se-fmea.md:138`,
  `se/author-req.md:14`, `se-vorbereitung.md:17`); der Agent über `src/surface/mcp-server.ts:87`; Code-Absender:
  `src/surface/bootstrap.ts:119`, `src/loop/suggest.ts:240`, `src/surface/host-shim.ts:89`,
  `src/surface/import-code-verb.ts:224`, `src/kernel/merge.ts:223`, `src/projections/testreport.ts:138`.
- **G2, Leseanfrage (10 Flüsse `query-request-*`):** `src/surface/mcp-server.ts:87` (der Handler läuft im Aufruf),
  die Sicht-Skills rufen `graph_export` und warten (`.claude/commands/se-view/<sicht>.md:9`), `view-fmea` ruft
  `graph_elements` (`se-view/fmea.md:9`), `auto-export` ruft den Handler (`src/projections/auto-export.ts:75`).
- **G3, Bericht eines Skills an den Menschen (6 Flüsse `skill-report-*`):** der Skill antwortet dem Aufrufer im
  selben Zug (Skill-Dateien `se-help`, `se-retro`, `se-review`, `se-status`, `se-test`, `se-test-ui`).

## Tabelle über alle 127 Flüsse

Ohne die Vorsilben `FLOW-`, `FUNC-`, `ACTOR-`. Pfade ohne Zusatz liegen in graphcode.

| Fluss | Erzeuger | Abnehmer | Wert | Beleg |
|---|---|---|---|---|
| action | goal-steerer | Akteur agent | offen | FUNC-goal-steerer ist ein Block ohne Bindung an Code |
| arch-fitness | arch-fitness | fit-advisory | sync | src/kernel/measure/fit-advisory.ts:67 (metrics im Aufruf) |
| audit-entries | audit-trail | Akteur owner, se-retro | sync | src/surface/audit.ts:446 (Antwort von audit_trail); se-retro ruft audit_trail nicht (kein Beleg fuer diesen Abnehmer) |
| audit-record | mutate | audit-stats, audit-trail | async | Ablage: src/surface/tool-context.ts:391 schreibt ins Log, src/surface/audit.ts:455 und :487 lesen es spaeter |
| audit-report | audit-stats | Akteur owner, se-retro | sync | src/surface/audit.ts:474 (Antwort von audit_stats); .claude/commands/se-retro.md:12 |
| chain-metrics | chain-metrics | Akteur dashboard, graph-metrics, se-fmea, se-optimize, se-vorbereitung | sync | src/projections/metrics.ts:173 (chainMetrics im Aufruf); Skills rufen graph_metrics (se-fmea.md:32, se/optimize.md:21, se-vorbereitung.md:30); Dashboard fragt graph_metrics ab (Code im Viewer-Repo) |
| channel-dimension-template | Akteur owner | generation-step | async | vorab: Konstante GENERATION_TEMPLATE, src/loop/generate.ts:366 |
| channel-fit-advisory | fit-advisory | Akteur agent | sync | src/kernel/measure/zug-bericht.ts:46, in der Antwort von graph_mutate (src/surface/write.ts:388) |
| channel-gate-protocol | Akteur owner | generation-step | async | vorab: Konstante GATE_PROTOCOL, src/loop/generate.ts:132 |
| channel-gate-verdict | block-gate | Akteur agent | offen | FUNC-block-gate ist ein Block ohne Bindung an Code |
| channel-grammar | authoring-guide | Akteur agent | sync | src/projections/report.ts:508 (Antwort von graph_authoring_guide) |
| channel-guardrails | harness-cli | Akteur agent | async | Datei: src/surface/scaffold.ts:515 schreibt GRAPHCODE.md, der Agent liest sie spaeter |
| channel-handoff | generation-step | Akteur agent | sync | src/loop/suggest.ts:373 und :387 (Antwort von graph_generate), Feld done src/loop/generate.ts:838 |
| channel-next-step | generation-step | Akteur agent | sync | src/surface/write.ts:431 (Feld vorschlag in der Antwort von graph_mutate) |
| channel-rule-clause | Akteur owner | generation-step | async | vorab: Konstante RULE_CLAUSE, src/loop/generate.ts:245 |
| channel-skill-reference | generation-step | Akteur agent | sync | src/loop/generate.ts:536 (Feld skill im Schritt), Antwort von graph_generate src/loop/suggest.ts:387 |
| channel-steer-advisory | fit-advisory | Akteur agent | sync | src/kernel/measure/zug-bericht.ts:46 (computeSteerAdvisory), in der Antwort von graph_mutate (src/surface/write.ts:388) |
| cli-command | cli-dispatch | bootstrap, claim-store-lock, collect-status, create-harness, gve-supervise, harness-cli, import-code-verb, rewind, upgrade | sync | src/cli.ts:73-203 (main ruft den Handler und wartet) |
| cli-invocation | Akteur owner | cli-dispatch, plan-code-lane | sync | src/cli.ts:70 (argv des Aufrufs); scripts/verify-code.mjs:56 |
| cli-invocation-import-code | import-code | cli-dispatch | sync | .claude/commands/se/import-code.md:23 (Skill startet den Prozess und wartet), src/cli.ts:101-106 |
| code-lane-plan | plan-code-lane | Akteur owner | sync | scripts/verify-code.mjs:56 (Ausgabe des Aufrufs an der Schale) |
| completeness | score-completeness | compute-readiness | sync | sigloch-modules packages/graphcode-client/src/readiness.ts:211 (computeMarks im Aufruf); realRef von FUNC-compute-readiness zeigt auf eine Datei, die es nicht gibt |
| config-file | Akteur owner | load-config | async | Datei: src/kernel/config.ts:129 liest graphcode.config.jsonc |
| conformance-findings | check-code-conformance | compute-readiness | sync | src/kernel/evaluation.ts:246-247 und :308 (Konformanz im Aufruf, dann computeReadiness) |
| dimension-readiness | compute-readiness | graph-readiness, se-retro, se-review, se-status, take-steering-snapshot, test, test-ui | sync | src/projections/report.ts:316 (readinessOf im Aufruf); Skills rufen graph_readiness (se-retro.md:13, se-review.md:9, se-status.md:9, se-test.md:23); kein Beleg fuer se-test-ui und take-steering-snapshot (steering-snapshot.ts:50) |
| element-slice | list-elements | Akteur agent | sync | src/surface/read.ts:398 (Antwort von graph_elements) |
| expand-subgraph | graph-expand | read-tools | sync | src/surface/read.ts:569 |
| export-pending | export-marker | Akteur owner | async | Datei: src/kernel/export-marker.ts:69 schreibt die Marke, der pre-commit-Hook liest sie |
| fit-advisory | fit-advisory | zug-bericht | sync | src/kernel/measure/zug-bericht.ts:46 |
| formatE-artifact-agent | Akteur agent | decode | sync | src/surface/write.ts:343 (Eingabe von graph_mutate) |
| formatE-artifact-read-tools | read-tools | Akteur agent | sync | src/surface/read.ts:379-636 (Antworten der Lese-Werkzeuge), src/surface/mcp-server.ts:87 |
| function-criticality | function-criticality | Akteur dashboard, graph-metrics | sync | src/projections/metrics.ts:189; Dashboard fragt graph_metrics ab (Code im Viewer-Repo) |
| gate-verdict | mutate | Akteur owner, bootstrap, graph-suggest, import-code-verb, se-retro, test-ingest, tool-context | zu trennen | sync: src/surface/bootstrap.ts:119, src/loop/suggest.ts:240, src/surface/import-code-verb.ts:224, src/projections/testreport.ts:138, src/surface/tool-context.ts:527; async: se-retro liest die Urteile aus dem Log (.claude/commands/se-retro.md:12) |
| generation-step-suggest | generation-step | graph-suggest | sync | src/loop/suggest.ts:373 und :387 |
| generation-step-vorschlag | generation-step | vorschlag | sync | src/loop/next-step.ts:135 |
| graph-delta | mutate | graph-store | async | Ablage: src/kernel/gate.ts:195 ruft commit und wartet, src/kernel/graph-store.ts:126-137 schreibt; Leser haengen nicht am Schreiber |
| graph-snapshot-file | graph-export-snapshot | Akteur owner | async | Datei: src/projections/export.ts:99 und :171 schreiben docs/graph |
| graph-state | graph-store | Akteur owner, arch-fitness, auto-export, chain-metrics, check-code-conformance, compute-readiness, emit-trajectory, emit-update-event, evaluate-rules, export-marker, fit-advisory, function-criticality, graph-export-snapshot, graph-suggest, list-elements, merge-nodes, module-metrics, mutate, read-tools, score-completeness, seed-from-json, take-steering-snapshot, test-ingest | sync | Abruf beim Besitzer: src/kernel/graph-store.ts:117 (current), src/kernel/harness.ts:223, :261, :316; kein Lesebeleg fuer export-marker, emit-update-event, emit-trajectory |
| harness-handle | create-harness | bind-tools, import-code-verb, rewind, serve-stdio, tool-context | sync | src/surface/mcp-server.ts:201 und :144, src/surface/mcp-tools.ts:132, src/surface/import-code-verb.ts:118, src/surface/rewind.ts:140 |
| harness-handle-host | own-kuzu-host | serve-sse | sync | src/surface/host.ts:116 |
| health-report | health-endpoint | Akteur dashboard | sync | src/surface/host.ts:204-205 (Antwort auf GET /health) |
| held-back-traces | held-back-traces | graph-export-snapshot, graph-readiness | sync | src/projections/export.ts:222, src/projections/report.ts:356 |
| impact-slice | graph-impact | read-tools | sync | src/surface/read.ts:515 |
| impacted-tests | resolve-tests-from-code | deduce-tests, measure-test-schlupf, plan-code-lane | sync | src/projections/report.ts:399, src/projections/test-selection-audit.ts:194, scripts/verify-full.mjs:59 |
| imported-graph | import | graph-store | async | Ablage: src/kernel/harness-import.ts:172 ruft replace, src/kernel/graph-store.ts:149-153 schreibt |
| install-result-collect-status | collect-status | Akteur owner | sync | src/cli.ts:167-170 (Ausgabe des Aufrufs) |
| install-result-harness-cli | harness-cli | Akteur owner | sync | src/cli.ts:203 |
| install-result-upgrade | upgrade | Akteur owner | sync | src/cli.ts:185-193 |
| learning-advice | Akteur learning-engine | graph-suggest | offen | geplant, kein Code (Beschreibung des Flusses, CR-GC-465); in src/loop/suggest.ts kein Aufruf |
| learning-query | graph-suggest | Akteur learning-engine | offen | geplant, kein Code (Beschreibung des Flusses, CR-GC-465); in src/loop/suggest.ts kein Aufruf |
| live-event | emit-update-event | broadcast-diff, serve-sse, serve-stdio | async | Ereignis: src/surface/emit.ts:64-79 loest je Mutation aus, src/surface/mcp-server.ts:204 und src/surface/host.ts:121 nehmen ab |
| live-event-host | serve-sse | broadcast-diff | async | Ereignis: src/surface/host.ts:121 reicht es an broadcast |
| lock-release | session-shutdown | claim-store-lock | async | Ablage (Lock-Datei): src/surface/mcp-server.ts:225, src/kernel/graph-store.ts:168 |
| markdown-docs | export-markdown | Akteur owner | async | Datei: src/projections/export.ts:255 schreibt docs/views |
| mcp-tool | graph-suggest | bind-tools | sync | src/surface/mcp-tools.ts:149 |
| mcp-tool-registry | bind-tools | serve-stdio | sync | src/surface/mcp-server.ts:144 und :97 |
| measurement-vector | take-steering-snapshot | generation-step | sync | src/loop/generate.ts:513 |
| metric-policy | load-config | evaluate-rules, take-steering-snapshot | async | vorher gesetzter Zustand: src/surface/create-harness.ts:68 laedt beim Start, src/kernel/harness.ts:125 haelt, :166 gibt heraus |
| metrics-answer | graph-metrics | Akteur agent | sync | src/projections/metrics.ts:144 (Antwort von graph_metrics) |
| module-metrics | module-metrics | Akteur dashboard, evaluate-rules, graph-metrics | sync | src/projections/metrics.ts:188; Dashboard fragt graph_metrics ab (Code im Viewer-Repo) |
| mutate-cmd-agent | Akteur agent | host-socket, mutate | sync | G1 |
| mutate-cmd-author-req | author-req | mutate | sync | G1 |
| mutate-cmd-author-uc | author-uc | mutate | sync | G1 |
| mutate-cmd-bootstrap | bootstrap | mutate | sync | G1 |
| mutate-cmd-close-violations | close-violations | mutate | sync | G1 |
| mutate-cmd-decode | decode | mutate | sync | G1 |
| mutate-cmd-graph-suggest | graph-suggest | mutate | sync | G1 |
| mutate-cmd-host-socket | host-socket | mutate | sync | G1 |
| mutate-cmd-import-code-verb | import-code-verb | mutate | sync | G1 |
| mutate-cmd-import-doc | import-doc | mutate | sync | G1 |
| mutate-cmd-merge-nodes | merge-nodes | mutate | sync | G1 |
| mutate-cmd-owner | Akteur owner | host-socket | sync | G1 |
| mutate-cmd-se-conops | se-conops | mutate | sync | G1 |
| mutate-cmd-se-fmea | se-fmea | mutate | sync | G1 |
| mutate-cmd-se-generate | se-generate | mutate | sync | G1 |
| mutate-cmd-se-irr | se-irr | mutate | sync | G1 |
| mutate-cmd-se-optimize | se-optimize | mutate | sync | G1 |
| mutate-cmd-se-plan | se-plan | mutate | sync | G1 |
| mutate-cmd-se-top-level | se-top-level | mutate | sync | G1 |
| mutate-cmd-se-trade | se-trade | mutate | sync | G1 |
| mutate-cmd-se-vorbereitung | se-vorbereitung | mutate | sync | G1 |
| mutate-cmd-test-ingest | test-ingest | mutate | sync | G1 |
| next-step-advice | generation-step | Akteur agent | sync | src/loop/suggest.ts:387 (Antwort von graph_generate) |
| ontology-json | seed-from-json | held-back-traces, import | zu trennen | sync: src/kernel/harness-import.ts:234 (seedFromJsonFile reicht den Inhalt an den Import); async: src/kernel/harness-import.ts:208 (heldBackTraces liest die Datei selbst) |
| query-request-agent | Akteur agent | authoring-guide, deduce-tests, export-markdown, graph-expand, graph-impact, graph-metrics, graph-readiness, list-elements, read-tools, resolve-tests-from-code | sync | G2 |
| query-request-auto-export | auto-export | export-markdown | sync | G2 |
| query-request-owner | Akteur owner | export-markdown, graph-expand, list-elements, render-views, view-changelog, view-conops, view-fmea, view-icd, view-intplan, view-rtm | sync | G2 |
| query-request-render-views | render-views | export-markdown | sync | G2 |
| query-request-view-changelog | view-changelog | export-markdown | sync | G2 |
| query-request-view-conops | view-conops | export-markdown | sync | G2 |
| query-request-view-fmea | view-fmea | list-elements, read-tools | sync | G2 |
| query-request-view-icd | view-icd | export-markdown | sync | G2 |
| query-request-view-intplan | view-intplan | export-markdown | sync | G2 |
| query-request-view-rtm | view-rtm | export-markdown | sync | G2 |
| readiness-report | graph-readiness | Akteur agent | sync | src/projections/report.ts:299 (Antwort von graph_readiness) |
| rendered-views | render-views | Akteur owner | sync | .claude/commands/se-view/arch.md:10 (Skill gibt die Sicht dem Aufrufer aus) |
| reseed-order | reseed | apply-reseed | sync | src/kernel/harness.ts:394 |
| reseed-snapshot | rewind | reseed | sync | src/surface/rewind.ts:148 |
| reseeded-graph | apply-reseed | graph-store | async | Ablage: src/kernel/harness-import.ts:249, src/kernel/graph-store.ts:149-159 |
| rule-findings | evaluate-rules | health-endpoint, mutate, se-retro, se-review, se-status | sync | src/kernel/gate.ts:151 und :155, src/surface/host.ts:323; Skills rufen rules_evaluate oder rules_get_violations (se-retro.md:16, se-review.md:10, se-status.md:12) |
| schema-fingerprint | schema-guard | graph-store | zu trennen | sync: src/kernel/graph-store.ts:86 (schemaFingerprint im Aufruf); async: src/kernel/graph-store.ts:87 liest die Marke vom letzten Start |
| schlupf-zeile | measure-test-schlupf | Akteur owner | async | Datei: scripts/verify-full.mjs:75 haengt an docs/messung/testauswahl.jsonl an |
| session-entry | gve-supervise | gve-sessions | async | Datei: src/surface/gve-sessions.ts:65, geschrieben von src/surface/gve.ts:291 |
| session-registry | gve-sessions | gve-supervise | sync | src/surface/gve.ts:262 |
| skill-report-se-help | se-help | Akteur owner | sync | G3 |
| skill-report-se-retro | se-retro | Akteur owner | sync | G3 |
| skill-report-se-review | se-review | Akteur owner | sync | G3 |
| skill-report-se-status | se-status | Akteur owner | sync | G3 |
| skill-report-test | test | Akteur owner | sync | G3 |
| skill-report-test-ui | test-ui | Akteur owner | sync | G3 |
| skill-request | Akteur agent | author-req, author-uc, close-violations, import-code, import-doc, se-conops, se-fmea, se-generate, se-help, se-irr, se-optimize, se-plan, se-retro, se-review, se-status, se-top-level, se-trade, se-vorbereitung, target-profile, test, test-ui | sync | Anfrage eines Akteurs: der Client laedt die Skill-Datei unter .claude/commands im selben Zug (kein Code in graphcode) |
| sse-frame | broadcast-diff | Akteur dashboard | async | Ereignisstrom: src/surface/host.ts:271-297 (SSE) |
| steering-delta | compute-steering-delta | bind-tools | sync | src/surface/write.ts:401 |
| steering-snapshot | take-steering-snapshot | compute-steering-delta, generation-step | sync | src/loop/generate.ts:513, src/surface/write.ts:375-401 |
| steering-trigger-agent | Akteur agent | take-steering-snapshot | sync | src/loop/suggest.ts:355-387 (graph_generate ruft generationStep, src/loop/generate.ts:513) |
| store-ownership | claim-store-lock | create-harness, graph-store, own-kuzu-host, session-shutdown | sync | src/kernel/graph-store.ts:72 (acquire im Aufruf, wirft bei Verweigerung), src/kernel/own-kuzu.ts:74 |
| target-profile | target-profile-load | generation-step, graph-suggest | sync | src/loop/suggest.ts:368, src/loop/next-step.ts:133 |
| target-profile-file | target-profile | target-profile-load | async | Datei: .claude/commands/se/target-profile.md:4 schreibt .graphcode/target-profile.json, src/loop/target-profile.ts:100-105 liest |
| test-selection | deduce-tests | Akteur agent, Akteur owner | sync | src/projections/report.ts:385 (Antwort von graph_tests) |
| tool-context | tool-context | bind-tools | sync | src/surface/mcp-tools.ts:132 und :144-151 |
| tool-registry | bind-tools | serve-stdio | sync | src/surface/mcp-server.ts:144 und :97 |
| tool-surface | serve-stdio | Akteur agent | sync | src/surface/mcp-server.ts:87 und :261 |
| trajectory | emit-trajectory | Akteur learning-engine | async | Datei: src/projections/trajectory.ts:108 schreibt trajectory.jsonl |
| version-bump | Akteur owner | migrate-schema, schema-guard | offen | FUNC-migrate-schema ist nicht an Code gebunden |
| vorschlag | vorschlag | Akteur owner | sync | src/surface/write.ts:431 (Feld in der Antwort auf die Aenderung) |
| zug-bericht | zug-bericht | Akteur agent, graph-suggest | sync | src/surface/write.ts:388, src/loop/suggest.ts:240 |
| zug-staende | mutate | zug-bericht | sync | src/kernel/gate.ts:229, src/surface/write.ts:388 |

## Zählung

| Wert | Flüsse |
|---|---|
| `sync` | 98 |
| `async` | 21 |
| offen | 5 |
| zu trennen | 3 |
| Summe | 127 |

## Offen (5)

| Fluss | Grund |
|---|---|
| `FLOW-action` | Erzeuger `FUNC-goal-steerer` ist ein Block ohne Bindung an Code. |
| `FLOW-channel-gate-verdict` | Erzeuger `FUNC-block-gate` ist ein Block ohne Bindung an Code. |
| `FLOW-version-bump` | Abnehmer `FUNC-migrate-schema` ist nicht an Code gebunden. |
| `FLOW-learning-query` | Geplant, kein Code (CR-GC-465). |
| `FLOW-learning-advice` | Geplant, kein Code (CR-GC-465). |

Gründe nach Häufigkeit: Funktion nicht an Code gebunden (3), kein Code vorhanden (2).

## Zu trennen (3)

| Fluss | Befund | Vorschlag |
|---|---|---|
| `FLOW-gate-verdict` | Sechs Abnehmer bekommen das Urteil als Antwort (Owner, `bootstrap`, `graph-suggest`, `import-code-verb`, `test-ingest`, `tool-context`). `se-retro` liest die Urteile später aus dem Log (`se-retro.md:12`, `audit_stats`). | (a) `FLOW-gate-verdict`, Urteil als Antwort, `sync`, ohne `se-retro`. (b) Für `se-retro` kein neuer Fluss nötig: der Weg steht schon als `FLOW-audit-record` und `FLOW-audit-report`; die Kante von `FLOW-gate-verdict` auf `FUNC-se-retro` entfällt. |
| `FLOW-ontology-json` | `import` bekommt den Inhalt im Aufruf (`harness-import.ts:234`). `held-back-traces` liest die committete Datei selbst (`harness-import.ts:208`). | (a) Inhalt der Graph-Datei an den Import, `seed-from-json` an `import`, `sync`. (b) Committete Graph-Datei an `held-back-traces`, `async`; Erzeuger wäre der Schreiber der Datei (`graph-export-snapshot`). |
| `FLOW-schema-fingerprint` | Ein Abnehmer, zwei Wege: `graph-store` rechnet den geltenden Fingerabdruck im Aufruf (`graph-store.ts:86`) und liest die Marke vom letzten Start (`graph-store.ts:87`). | (a) Geltender Fingerabdruck, `schema-guard` an `graph-store`, `sync`. (b) Gestempelte Marke neben dem Store, `async`. |

## Regelbefunde davor und danach

`rules_evaluate` vor und nach den Zügen, je Regel. Kein Fehler davor, keiner danach.

| Regel | davor | danach | Grund |
|---|---|---|---|
| `CR-R01` | 25 | 24 | CR-GC-789 nennt jetzt seinen Umfang. |
| `CR-R02` | 3 | 4 | Neue Warnung: CR-GC-789 ist done ohne `commitRef` (wie CR-GC-780, 781, 788). |
| `RC-07` | 42 | 43 | Nur zwischen Knoten-Zug und `git mv`; mit der Datei in `done/` wieder 42. |

Alle anderen 21 Regeln unverändert.

## Nachmessung: Antwortweg je Kette

Nur gelesen, aus dem exportierten Modell (Version 698), Skript nach der Vorlage graphanalyze
`docs/messung/flaechen-2026-10-11/fluss_trennen.py`, nicht eingecheckt. Start sind die Glieder, die über einen
Fluss mit `sync` an einen Akteur liefern. Von dort rückwärts über eingehende Flüsse mit `sync`, nur über
Glieder der Kette. Ein Fluss ohne Merkmal am Weg (mit einer Funktion als Erzeuger, oder als Ausgang an einen
Akteur) blockiert die Aussage. Ein Erzeuger, der kein Glied ist, ist ein Befund „verlässt die Kette".

| Kette | Funktionen auf dem Antwortweg | blockierende Flüsse | verlässt die Kette | Ausgang `async` |
|---|---|---|---|---|
| advisory-roundtrip | 3 von 7: graph-impact, graph-store, read-tools | gate-verdict, learning-query, schema-fingerprint | graph-store wartet auf claim-store-lock (store-ownership); read-tools wartet auf graph-expand (expand-subgraph); read-tools wartet auf view-fmea (query-request-view-fmea) | – |
| agent-query | 5 von 5: graph-expand, graph-impact, list-elements, read-tools, view-fmea | – | list-elements wartet auf graph-store (graph-state); read-tools wartet auf graph-store (graph-state) | – |
| apply-gate | 8 von 13: arch-fitness, claim-store-lock, evaluate-rules, fit-advisory, graph-store, host-socket, mutate, zug-bericht | gate-verdict, schema-fingerprint | mutate wartet auf 19 Absender eines Befehls, die keine Glieder sind (mutate-cmd-*); claim-store-lock wartet auf cli-dispatch (cli-command); evaluate-rules wartet auf module-metrics (module-metrics) | trajectory |
| capture | 0 von 2: – | gate-verdict | – | – |
| codec-roundtrip | – | kein Ausgang an einen Akteur | – | – |
| dashboard-metrics | 5 von 6: chain-metrics, function-criticality, graph-metrics, graph-store, module-metrics | gate-verdict, schema-fingerprint | graph-store wartet auf claim-store-lock (store-ownership) | – |
| doc-export | 1 von 7: render-views | – | – | markdown-docs |
| generation-states | 2 von 3: generation-step, take-steering-snapshot | learning-query | generation-step wartet auf target-profile-load (target-profile); take-steering-snapshot wartet auf compute-readiness (dimension-readiness); take-steering-snapshot wartet auf graph-store (graph-state) | – |
| grammar-query | 1 von 1: authoring-guide | – | – | – |
| impact-testing | 3 von 4: deduce-tests, plan-code-lane, resolve-tests-from-code | – | – | schlupf-zeile |
| interface-escalation | 3 von 4: graph-impact, graph-store, read-tools | gate-verdict, schema-fingerprint | graph-store wartet auf claim-store-lock (store-ownership); read-tools wartet auf graph-expand (expand-subgraph); read-tools wartet auf view-fmea (query-request-view-fmea) | – |
| live-update | 4 von 9: evaluate-rules, graph-store, health-endpoint, serve-stdio | gate-verdict, schema-fingerprint | evaluate-rules wartet auf module-metrics (module-metrics); graph-store wartet auf claim-store-lock (store-ownership); serve-stdio wartet auf bind-tools (mcp-tool-registry); serve-stdio wartet auf bind-tools (tool-registry); serve-stdio wartet auf create-harness (harness-handle) | sse-frame |
| loop-closure | 3 von 4: audit-stats, audit-trail, se-retro | gate-verdict | se-retro wartet auf compute-readiness (dimension-readiness); se-retro wartet auf evaluate-rules (rule-findings) | – |
| merge-branches | – | kein Ausgang an einen Akteur | – | – |
| model-import | 0 von 5: – | gate-verdict | – | – |
| modelfree-gate | 0 von 2: – | gate-verdict | – | – |
| recall | 1 von 7: graph-store | schema-fingerprint | graph-store wartet auf claim-store-lock (store-ownership) | – |
| repo-lifecycle | 4 von 11: cli-dispatch, collect-status, harness-cli, upgrade | – | cli-dispatch wartet auf import-code (cli-invocation-import-code) | channel-guardrails |
| schema-migration | – | kein Ausgang an einen Akteur | – | – |
| skill-authoring | 1 von 14: chain-metrics | gate-verdict | chain-metrics wartet auf graph-store (graph-state) | – |
| skill-help | 1 von 1: se-help | – | – | – |
| skill-report | 10 von 10: check-code-conformance, compute-readiness, evaluate-rules, module-metrics, score-completeness, se-retro, se-review, se-status, test, test-ui | gate-verdict | check-code-conformance wartet auf graph-store (graph-state); compute-readiness wartet auf graph-store (graph-state); evaluate-rules wartet auf graph-store (graph-state); module-metrics wartet auf graph-store (graph-state); score-completeness wartet auf graph-store (graph-state); se-retro wartet auf audit-stats (audit-report); se-retro wartet auf audit-trail (audit-entries) | – |
| snapshot-freshness | 1 von 7: graph-store | gate-verdict, schema-fingerprint | graph-store wartet auf claim-store-lock (store-ownership) | export-pending, graph-snapshot-file |
| steering-loop | 14 von 17: arch-fitness, compute-readiness, evaluate-rules, fit-advisory, generation-step, graph-readiness, graph-store, graph-suggest, held-back-traces, mutate, take-steering-snapshot, target-profile-load, vorschlag, zug-bericht | gate-verdict, learning-query, ontology-json, schema-fingerprint | mutate wartet auf 19 Absender eines Befehls, die keine Glieder sind (mutate-cmd-*); compute-readiness wartet auf check-code-conformance (conformance-findings); compute-readiness wartet auf score-completeness (completeness); evaluate-rules wartet auf module-metrics (module-metrics); graph-store wartet auf claim-store-lock (store-ownership) | – |
| test-ingest | 0 von 2: – | gate-verdict | – | – |

25 Ketten, 22 mit Ausgang an einen Akteur. Lesbar 6 (`agent-query`, `doc-export`, `grammar-query`,
`impact-testing`, `repo-lifecycle`, `skill-help`), davon 4 ohne Befund. Blockiert 16: durch `gate-verdict` 14,
`schema-fingerprint` 8, `learning-query` 3, `ontology-json` 1.

**`FCHAIN-steering-loop`:** 14 von 17 Gliedern liegen auf dem Antwortweg. Nicht darauf:
`compute-steering-delta`, `load-config`, `target-profile`. Die Aussage ist blockiert durch `gate-verdict`,
`learning-query`, `ontology-json`, `schema-fingerprint`. Befunde: `mutate` wartet auf 19 Absender eines Befehls,
die keine Glieder sind; `compute-readiness` wartet auf `check-code-conformance` und `score-completeness`;
`evaluate-rules` wartet auf `module-metrics`; `graph-store` wartet auf `claim-store-lock`.

## Nebenbefunde am Modell (nur gemeldet)

- `FUNC-compute-readiness`: `realRef` zeigt auf eine Datei, die es nicht gibt (Urteil 10).
- Kanten ohne Lesebeleg im Code: `FLOW-graph-state` auf `export-marker`, `emit-update-event`, `emit-trajectory`;
  `FLOW-dimension-readiness` auf `take-steering-snapshot` (seit CR-GC-514 ruft der Snapshot die Readiness nicht
  mehr) und auf `test-ui`; `FLOW-audit-entries` auf `se-retro`.
- `FLOW-mcp-tool-registry` und `FLOW-tool-registry` haben denselben Erzeuger und denselben Abnehmer.

## Grenzen

- Keine Struktur geändert. Die drei Trennungen und das Schließen der Ketten sind eigene Züge.
- Kein Produktcode, kein Test. Die Kennzahl `answerPath` kommt mit CR-SM-408; bis dahin gilt die Nachmessung hier.
- Belege nennen die Stelle des Aufrufs oder des Schreibens, nicht jede Stelle je Abnehmer.
