# CR-GC-506: executor.ts entlang der Gate-Kette schneiden, FLOW-mutate-cmd am Code korrigieren

**Status:** ✅ Done (2026-09-11)
**Typ:** aus Item ITEM-2026-027 (finding)
**Erstellt:** 2026-09-11
**Item:** bok/items/ITEM-2026-027.json (Lane: code), Befund Stelle 1 aus ITEM-2026-028

---

## Problem

`src/loop/executor.ts` hatte 1185 Zeilen, die Grenze liegt bei 500 (CLAUDE.md). Zugleich stand im Modell die Kette des Executors falsch am Bus `FLOW-mutate-cmd`, der 22 Produzenten hat (IO-02). Parser (`FUNC-extract-mutate`), Preflight (`FUNC-preflight`) und Rangfolge (`FUNC-rank-candidates`) waren als Absender modelliert. Gesendet wurde aber nur in `runExecutor` über den Closure `callGate` (HEAD executor.ts:577).

Der Schnitt der Datei entlang dieser Kette ist zugleich die Modellkorrektur. harness.ts ist bereits erledigt (CR-GC-503/504). scaffold-templates.ts folgt in einer eigenen CR.

## Messung vor dem Schnitt: Aufrufgruppen in executor.ts (HEAD)

| Gruppe | Zeilen | liest / ruft |
|---|---|---|
| Konfiguration, Typen, Stats | 69–171 | – |
| Lese-Werkzeuge (`READ_TOOLS`, Guard) | 173–251 | Dateisystem |
| Tool-Angebot (`buildToolSpecs`, `toBackendTools`) | 253–304 | Registry, `READ_TOOLS` |
| Backends (`buildCallModel`) | 306–413 | HTTP, `model-answer-contract` |
| Gate-Feedback (`MutateOutcome`, `formatGateFeedback`) | 415–458 | – |
| Gate-Kette (Closures `loadGraphSnapshot`, `runPreflight`, `callGate`, `runMutate`) | 501–608 | Registry, `preflightBatch`, nd-similarity |
| Werkzeug-Ausführung (`execReadOrGraphTool`, `pushToolResults`) | 610–659 | Registry, `READ_TOOLS`, Backend-Form |
| Best-of-N (`collectCandidateBatch`, `probeCandidate`, `traceCandidate`, `modelJudgePick`, `runBestOfNStep`) | 661–974 | alles oben, `rankCandidates` |
| Treiberschleife (generate-Runden, Ein-Kandidaten-Turn-Loop) | 976–1185 | alles oben |

`graph_context` bestätigt: nur `FUNC-run-executor` hat eine realRef in executor.ts. extract-mutate, preflight und rank-candidates liegen bereits in eigenen Dateien (`executor-parse.ts:11`, `preflight.ts:126`, `executor-rank.ts:185`).

**Dateizählung, Grund für den Folge-CR.** Ein Schnitt unter 500 Zeilen braucht fünf Quelldateien. Die Backend-Gruppe (`buildCallModel`, `buildToolSpecs`) wird zusätzlich von drei Tests importiert (`flow-contracts`, `cli.run`, `executor`), zusammen also acht Dateien. Diese CR schneidet deshalb die Kette: Gate-Zugang, Best-of-N und Werkzeug-Ausführung. Das Modell-Draht-Stück folgt als eigene CR, dann liegt executor.ts unter 500.

## Schnittplan (umgesetzt)

| Datei | Inhalt | aus HEAD executor.ts |
|---|---|---|
| `src/loop/executor-gate.ts` (neu) | `MutateOutcome`, `ruleIdsOf`, `formatGateFeedback`, `bindGateClient` → `{runPreflight, callGate, runMutate}` | 415–458, 501–608 |
| `src/loop/executor-bestofn.ts` (neu) | `runBestOfNStep` mit `collectCandidateBatch`, `probeCandidate`, `traceCandidate`, `modelJudgePick`, `stripDryRun` | 661–974 |
| `src/loop/executor-tools.ts` (neu) | `READ_TOOLS`, `execReadOrGraphTool`, `pushToolResults` | 173–251, 610–659 |
| `src/loop/executor.ts` | Konfiguration, Tool-Angebot, Backends, Treiberschleife; bindet Gate-Zugang und Best-of-N an | Rest |
| `tests/executor-tools.test.ts` (neu) | Lese-Werkzeuge ausführen, Guard, Registry-Pfad, dryRun-Durchreichen, beide Backend-Formen | – |

Die Code-Körper sind unverändert übernommen, nur Closure-Zugriffe wurden zu Parametern. Die Sub-Module importieren aus executor.ts ausschließlich Typen (`import type`), zur Laufzeit gibt es keinen Zyklus. Kein Importeur musste umgestellt werden, und es gibt keine Re-Exporte.

## Befund: alle 22 Produzenten von FLOW-mutate-cmd (I1, am Code gelesen)

| Klasse | Anzahl | Produzenten, Beleg | Entscheidung |
|---|---|---|---|
| Echter Absender im Code | 4 | `bootstrap` bildet `MutateCommand[]` aus Format-E und ruft `harness.mutate` (bootstrap.ts:111–140) · `import-code-verb` bildet den Batch und ruft `registry['graph_mutate']` (import-code-verb.ts:179–193) · `merge-nodes` spielt Log-Chargen erneut durchs Gate (merge.ts:199–223) · `graph-suggest` bildet `batchFor(edit)` und ruft den dryRun (suggest.ts:236) | bleiben |
| ACTOR, legitim | 2 | `ACTOR-agent` über MCP · `ACTOR-owner` über den Viewer: `/api/mutate` → `callHost(…, 'graph_mutate')` → Host-Socket (src/index.ts:79–84; graph-view-edit command-bridge.mjs:23) | bleiben |
| Skill, legitim (prompt-realisiert) | 10 | author-req.md:9 · author-uc.md:17 · close-violations.md:14 · se-conops.md:18 · se-fmea.md:108 · se/generate.md:16–17 · se-irr.md:19 · se/optimize.md:65–83 · se-plan.md:29 · se-trade.md:16 | bleiben; Skill-Bus = fehlende Rolle (ITEM-2026-028, Kandidat A) |
| Aufgerufener mit Rückgabewert | 3 | `extract-mutate` gibt `{commands}` oder null zurück (executor-parse.ts:11) · `preflight` gibt `PreflightOutcome` zurück (preflight.ts:126) · `rank-candidates` gibt `T[]` zurück (executor-rank.ts:185) | **korrigiert**: Kante weg, Rückgabewert als eigener FLOW |
| Weiterreicher | 1 | `host-socket` parst `req.input` und ruft `tool.handler` (host-shim.ts:89). Den Inhalt bildet der Client (Agent-Proxy oder Viewer). | **korrigiert**: Produzentenkante weg |
| Sendestelle verschoben | 1 | `run-executor` hat bis HEAD selbst gesendet (executor.ts:577). Jetzt sendet der Gate-Zugang (executor-gate.ts:166). Den vom Modell selbst angeforderten dryRun reicht die Treiberschleife unverändert durch die Werkzeug-Ausführung (executor.ts:528–534). | **korrigiert**: Kante weg, neuer Produzent `FUNC-gate-client` |
| Sendet nicht | 1 | `target-profile`: der Skill schreibt Konfiguration, „write it directly (no `graph_mutate`)“ (target-profile.md:7) | **korrigiert**: Kante weg |

Fehlende echte Absender, gezielt über Registry-Aufrufe gesucht: `grep "\['graph_mutate'\]\.handler|harness\.mutate("` über src sowie `graph_mutate` in `.claude/commands`.
- `se:import-doc` sendet über `registry['graph_mutate'].handler` (import-doc.md:106), `FUNC-import-doc` existiert, die Kante fehlte → **ergänzt**.
- `graph_realize` (write.ts:493) und `graph_test_ingest` (testreport.ts:142) bilden und senden eigene Batches. Dafür gibt es keine FUNC → bewusst offen.
- `se:top-level` weist graph_mutate an (top-level.md:140). Auch dafür gibt es keine FUNC → bewusst offen.
- `graph_mutate` selbst (write.ts:356) reicht den Batch des Agenten an `harness.mutate` weiter. Das ist die Gate-Tür, nicht modelliert und richtig so.

### Positivkontrollen (I2)

- **Absender-grep:** Er findet die bekannte Sendestelle executor.ts:577 und die modellierten Absender bootstrap, import-code-verb, merge und suggest. Zusätzlich findet er zwei unmodellierte (write.ts:493, testreport.ts:142). Der grep sieht also, was er sehen soll.
- **Skill-grep:** Er trifft alle zehn legitimen Skills. Denselben Treffer gibt es in target-profile.md:7, dort aber als Verneinung. Die Unterscheidung kommt deshalb aus dem Lesen, nicht aus dem Treffer.
- **IO-02-Rig** (`rig/flow-cardinality/measure.mjs::io02`) am SSOT v254: `FLOW-mutate-cmd` mit 22P, darunter die drei Kettenstufen, host-socket und target-profile.
- **Nebenfund beim Lesen:** Im Best-of-N geht ein zweiter graph_mutate im selben Turn über die Werkzeug-Ausführung direkt an die Registry, ohne Probe, Preflight und Ranking. Reproduziert mit einer temporären Testdatei (Store danach mit SYS-b, obwohl nur Kandidat a geprobt und angewandt wurde) → ITEM-2026-041 (bug), hier nicht behoben.

## Modelländerung (über `graph_mutate`, v254 → v256)

- **Neu `FUNC-gate-client`:**
  - realRef `src/loop/executor-gate.ts::bindGateClient`, allocate MOD-loop, Kind von `FUNC-block-antrieb`
  - satisfy `REQ-prose-recovery` („durch dasselbe Apply-Gate geschickt“), Glied von `FCHAIN-steering-loop`
  - io: `candidate-batch`, `preflight-outcome` und `gate-verdict` rein, `mutate-cmd` raus
- **Rückgabewerte als eigene FLOWs mit genau einem Produzenten:**
  - `FLOW-recovered-batch`: extract-mutate → run-executor, SCHEMA-mutate-command
  - `FLOW-candidate-batch`: run-executor → gate-client, preflight, SCHEMA-mutate-command
  - `FLOW-preflight-outcome`: preflight → gate-client, neu `SCHEMA-preflight-outcome` (concept, TS-Interface)
  - `FLOW-candidate-ranking`: rank-candidates → run-executor, neu `SCHEMA-candidate-probe` (concept, TS-Interface)
- **Gelöscht:**
  - `extract-mutate → mutate-cmd`, `preflight → mutate-cmd`, `rank-candidates → mutate-cmd`, `run-executor → mutate-cmd`
  - `host-socket → mutate-cmd`, `target-profile → mutate-cmd`
  - Konsumkante `mutate-cmd → preflight`: der Preflight liest den Kandidaten, nicht das Gate-Kommando
- **Ergänzt:** `import-doc → mutate-cmd`.
- **Beschreibungen:** `FUNC-run-executor` und `FLOW-mutate-cmd` nennen den Code-Weg.
- **Zwei Züge:** v255 legte gate-client ohne Eltern-Block an. Die Sicht zeigte ihn als eigenen Knoten (21 · 89), und goal-steerer exponierte 16 Verträge. v256 ergänzt `FUNC-block-antrieb -compose-> FUNC-gate-client`, analog zu read-tools in CR-GC-505.

## Messplan und Akzeptanzkriterien

- [x] executor.ts kleiner, Schnitt entlang der gemessenen Gruppen. Unter 500 erst mit dem Folge-CR (siehe Dateizählung).
- [x] Alte Stellen gelöscht, keine Re-Exporte, Import-Richtung grün (`tests/import-boundaries.test.ts`).
- [x] IO-02 per Rig, Produzenten je FLOW vorher/nachher; jeder neue FLOW genau 1P.
- [x] `graph_readiness`: 0 Fehler; importCoverage sinkt nicht; RC-04, R-31, FC-04, IO-01 ehrlich berichtet.
- [x] Sichtcheck mit Bild, Signal je verändertem Linienbündel benannt (I3).
- [x] Build und Type-Check grün; ausgewählte Tests grün; volle Suite nur mit Grundlast rot.
- [x] Smoke: `graphcode run` gegen ein Fake-Backend in einem Temp-Repo startet, wendet an und exportiert.

## Messung

| Größe | vorher (HEAD, v254) | nachher (v256) |
|---|---|---|
| src/loop/executor.ts | 1185 Zeilen | 575 |
| executor-gate.ts / executor-bestofn.ts / executor-tools.ts | – | 200 / 363 / 163 |
| IO-02 (Rig am SSOT) | 6 | 6 |
| `FLOW-mutate-cmd` | 22P × 3K | **18P × 2K** |
| recovered-batch / candidate-batch / preflight-outcome / candidate-ranking | – | 1P×1K / 1P×2K / 1P×1K / 1P×1K |
| formatE-artifact / install-result / query-request / skill-report / steering-trigger | 5 / 3 / 10 / 6 / 3 P | unverändert |
| `graph_readiness` Fehler | 0 | 0 |
| importCoverage | 83/84 | 86/87 (drei neue Dateien zugeordnet, offen bleibt `src/index.ts`) |
| RC-04 / FC-04 / IO-01 | 5 / 3 / 2 | 5 / 3 / 2 |
| R-31 | 11 | **12** (+ `FUNC-host-socket`) |
| BW-02 | 14 | **15** (+ `FUNC-block-antrieb`, 4 → 6 Verträge) |
| GVE Funktionsnetzwerk, Grounding offen | 20 Knoten · 86 Kanten | 20 Knoten · 85 Kanten |

Bilder (lokal, `data/` ist gitignored): `data/bilder-2026-09-10/cr506-vorher.png`, `data/bilder-2026-09-10/cr506-nachher.png`.

**Sichtcheck (I3), welches Signal fehlt.**
- Die Führungs-Box hatte vorher die Eingänge CLI-Kommando, Lern-Empfehlung, Skill-Aufruf und **Mutate-Command**. Nachher fehlt Mutate-Command.
- Das ist der Bus zur Führung, und sein einziger Konsument dort war `preflight` (Kind von antrieb unter goal-steerer), also die falsche Konsumkante.
- Im Nachher-DOM gibt es `e.FLOW-mutate-cmd.FLOW-mutate-cmd.*` nur noch zu Betrieb (host-socket) und Grounding (mutate).
- Die übrigen Korrekturen erzeugen auf dieser Ebene keine eigene Linie. Betrieb sendet weiter über import-code-verb und bootstrap, die Führung weiter über gate-client. Die vier neuen Rückgabeflüsse verlaufen innerhalb von Führung.
- Eine Hochrechnung der Linien aus dem SSOT bestand die Positivkontrolle gegen das DOM nicht (45 von 63 direkten Kanten ohne Treffer, der Renderer zeichnet über Bus-Knoten und Container-Ports). Die Aussage stützt sich deshalb auf Bild und DOM, nicht auf diese Rechnung.

## Tests

- `npm run build` grün, `tsc --noEmit` grün. `npm run lint` hat im Repo keine ESLint-9-Konfiguration; das war schon vor dieser CR so.
- **Auswahl:** `graph_tests` für gate-client, run-executor, preflight, extract-mutate, rank-candidates, host-socket, target-profile und import-doc (12 Dateien, `unresolved`: TEST-capture, concept-only). Dazu executor.preflight, executor-tools, schema-parse-at-interface, flow-contracts und import-boundaries: 17 Dateien, 177 von 179 grün. Rot sind nur die Grundlast-Dateien `steering` (In-Memory-Fixture, erwartet 3 statt 2) und `steering.artifact-coupling` (IO-02 als neue offene PDR-Regel).
- **Assertion-Check:** executor.test, executor.preflight.test und executor.bestofn.test fahren runExecutor durch Gate-Zugang, Preflight und Best-of-N. Die Lese-Werkzeuge und der Containment-Guard liefen dagegen in keinem Test, geprüft wurden nur Namen. Deshalb gibt es neu `tests/executor-tools.test.ts` (7 Tests). Red-Check: Guard entfernt → der Containment-Test wird rot; zurückgestellt → 7/7 grün.
- **Smoke:** `node dist/cli.js run "<intent>"` im Temp-Repo gegen einen lokalen OpenAI-kompatiblen Fake-Server. Ergebnis `[generate 1] phase=seed`, `1.1: graph_mutate`, mutatesApplied 1, Export `docs/graph/<repo>.graph.json`, exit 0.
- **Volle Suite (Modell v256):** 1081 von 1087 grün. Rot sind 5 von 136 Dateien mit 6 Tests, genau die bekannte Grundlast: `claims.conformance`, `perf.advisory-roundtrip.spike`, `steering.artifact-coupling`, `steering.process-ratchet`, `steering`. Das sind dieselben 6 roten Tests wie in CR-GC-505; die 7 zusätzlichen Tests stammen aus `executor-tools`. Keine neue rote Datei.

## Bewusst offen

- **executor.ts 575 > 500:** Das Modell-Draht-Stück (`buildToolSpecs`, `toBackendTools`, `buildCallModel`, ca. 165 Zeilen) plus drei Test-Importeure kommen in den Folge-CR, der aus demselben Item entsteht.
- **R-31 `FUNC-host-socket`, neu:** Weiterreicher ohne eigenen Ausgang, dieselbe Klasse wie serve-stdio und serve-sse (CR-GC-501/505). Ich habe keine Ersatzkante angelegt.
- **BW-02 `FUNC-block-antrieb`, neu:** Die zwei ehrlichen Rückgabewege gehen jetzt über die Block-Grenze (`candidate-ranking` aus q-improvement, `gate-verdict` aus gate). Wahrheit gegen Vertragszahl, dieselbe Spannung wie in ITEM-2026-028.
- **Unmodellierte Absender:** `graph_realize` (write.ts:493), `graph_test_ingest` (testreport.ts:142) und Skill `se:top-level` (top-level.md:140) haben keine FUNC.
- **Nicht modellierte Lesezugriffe und Rückgaben:**
  - Der Gate-Zugang liest den Graph über `graph_elements`/`graph_get_edges` (executor-gate.ts, `loadGraphSnapshot`). Dafür gibt es keine Kante; dieselbe Klasse ist build-round-injection.
  - Das Verdict mit Hinweisen, das der Gate-Zugang an die Treiberschleife zurückgibt, ist kein eigener FLOW.
- **`merge-nodes`:** Der Eingang ist als graph-state modelliert. Die Chargen kommen aber aus Audit-Einträgen (merge.ts:186 `entries`). Nicht vertieft.
- **Bug ITEM-2026-041:** Ein zweiter graph_mutate im selben Best-of-N-Turn wird ohne Probe angewandt (executor-bestofn.ts:146–155).
- **Skill-Bus:** 10 Skills plus 2 ACTOR bleiben am Bus. Ob eine Rolle „Skill“ ihn trägt, ist Spike-Frage (ITEM-2026-028, Kandidat A).
