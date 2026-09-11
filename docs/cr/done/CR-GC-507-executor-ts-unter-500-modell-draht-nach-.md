# CR-GC-507: executor.ts unter 500 — Modell-Draht nach executor-backend.ts

**Status:** ✅ Done (2026-09-11)
**Typ:** aus Item ITEM-2026-027 (finding), Folge-CR zu CR-GC-506
**Erstellt:** 2026-09-11
**Item:** bok/items/ITEM-2026-027.json (Lane: code)

---

## Problem

Nach CR-GC-506 hatte `src/loop/executor.ts` noch 575 Zeilen. Der Rest über 500 ist die Gruppe „Modell-Draht“: Tool-Angebot (`toJsonSchema`, `buildToolSpecs`, `toBackendTools`) und die zwei Backends (`buildCallModel`). CR-GC-506 hatte sie wegen der Dateigrenze zurückgestellt: fünf Quelldateien plus drei Test-Importeure.

**Nummer:** `aise dispatch prepare` mintet für ein Item mit crRefs kein zweites Mal (bok/scripts/aise/lib/dispatch.mjs:79). Die Nummer kommt deshalb aus derselben Funktion `nextCrNumber` (open/ und done/ gescannt, Ergebnis 507), die Datei aus `materializeCr`, und der crRef ist im Item nachgetragen. CR-GC-507 kam vorher weder in graphcode noch in bok vor.

## Befund am Code (I1)

- Der Block steht in executor.ts (Stand CR-GC-506) von „Tool-Schemas“ bis zum Ende von `buildCallModel`. Importeure: `tests/executor.test.ts` (`buildToolSpecs`), `tests/flow-contracts.test.ts` und `tests/cli.run.test.ts` (`buildCallModel`). `src/surface/run-verb.ts` importiert nur Typen und `runExecutor`.
- **Modellfolge:**
  - `ModelAnswer.parse` stand nur in `buildCallModel` (executor.ts:258 und 303, grep über src).
  - `SCHEMA-model-answer` ist gebunden (realRef `model-answer-contract.ts::ModelAnswer`) und weder concept noch external.
  - Seine io-FUNCs waren `run-executor` (Produzent) und `extract-mutate`.
  - Wandert der Parse nach executor-backend.ts, liegt er in keiner Datei eines io-verbundenen FUNC mehr.
- **Positivkontrolle (I2):** Nach dem Code-Schnitt, noch ohne Modelländerung, meldet `graph_readiness` RC-04 = **6**, vorher 5. Das Risiko ist also real, nicht vermutet.
- **Wer bildet die Antwort?** `buildCallModel` schickt die Anfrage, prüft die Draht-Form (`BackendFailure`, `AnthropicWireAnswer`/`OpenAiWireAnswer`) und liefert `ModelAnswer`. `runExecutor` stellt die Anfrage (System, Messages, Tools) und liest die Antwort. Der echte Produzent von `FLOW-model-answer` war im Modell nicht vorhanden. `run-executor` stand dort, obwohl es die Antwort nur empfängt.

## Schnittplan (umgesetzt)

| Datei | Inhalt |
|---|---|
| `src/loop/executor-backend.ts` (neu) | `toJsonSchema`, `buildToolSpecs`, `toBackendTools` (jetzt exportiert), `safeParse`, `buildCallModel` — Körper unverändert |
| `src/loop/executor.ts` | Konfiguration, `ModelResponse`/`CallModel`/`ExecutorStats`, Treiberschleife; Importe auf executor-backend.ts umgestellt, `model-answer-contract` nur noch als Typ |
| `tests/executor.test.ts`, `tests/flow-contracts.test.ts`, `tests/cli.run.test.ts` | Import von `buildToolSpecs` bzw. `buildCallModel` aus executor-backend.ts |

Der Block in executor.ts ist gelöscht, es gibt keinen Re-Export. executor-backend.ts importiert aus executor.ts nur Typen.

`rig/minimal-whitebox/run-armC-pull.mjs:37` importiert `buildToolSpecs` aus `../../dist/executor.js`. Diesen Pfad gab es schon vor dem Build dieser CR nicht mehr (`ls dist/executor.js` → nicht vorhanden; seit dem Modulschnitt liegt die Datei unter `dist/loop/`). Nicht angefasst, siehe „Bewusst offen“.

## Modelländerung (über `graph_mutate`, v256 → v257)

- **Neu `FUNC-call-model`:**
  - realRef `src/loop/executor-backend.ts::buildCallModel`, allocate MOD-loop
  - Kind von `FUNC-block-antrieb`, Glied von `FCHAIN-steering-loop`
  - satisfy `REQ-one-driver-local-and-frontier` („Backend-Wechsel ist Konfiguration“)
- **Neu `FLOW-model-request`** (run-executor → call-model) mit `SCHEMA-model-request`. Das SCHEMA ist concept: die Signatur `CallModel`, kein Zod-Vertrag.
- **`FLOW-model-answer`:** Produzent jetzt `call-model`, Konsumenten `run-executor` und `extract-mutate`. Die Kante `run-executor → model-answer` ist gelöscht.
- **Beschreibung:** `FUNC-run-executor` nennt den Weg über den Modell-Draht.
- **dryRun:** success, tier suggest, 0 Fehler. Gemeldet werden nur R-04 MOD-loop (bestand schon) und MT-02 info; workOrder `src/loop/executor-backend.ts` → MOD-loop, blind leer.

## Akzeptanzkriterien

- [x] executor.ts < 500 Zeilen, alter Block gelöscht, Importeure umgestellt, import-boundaries grün.
- [x] RC-04 steigt nicht (Produzent am Code modelliert statt SCHEMA umgewidmet).
- [x] IO-02 per Rig; jeder neue FLOW genau 1P.
- [x] readiness 0 Fehler, importCoverage sinkt nicht; R-31/IO-01/FC-04/BW-02 berichtet.
- [x] Bild vorher/nachher, Signal je verändertem Bündel benannt.
- [x] Build grün, Auswahl grün, volle Suite nur Grundlast rot, Smoke `graphcode run`.

## Messung

| Größe | vorher (v256, nach CR-GC-506) | nachher (v257) |
|---|---|---|
| src/loop/executor.ts | 575 Zeilen | **400** |
| src/loop/executor-backend.ts | – | 186 |
| Executor gesamt (executor + gate + bestofn + tools + backend) | 1301 | 1312 (Dateiköpfe) |
| IO-02 (Rig am SSOT) | 6 | 6 |
| `FLOW-mutate-cmd` | 18P × 2K | 18P × 2K |
| `FLOW-model-answer` | 1P (run-executor) × 1K | 1P (call-model) × 2K |
| `FLOW-model-request` | – | 1P × 1K |
| `graph_readiness` Fehler | 0 | 0 |
| importCoverage | 86/87 | 87/88 (`src/index.ts` offen) |
| RC-04 | 5 (nur Code geschnitten: 6) | 5 |
| R-31 / IO-01 / FC-04 / BW-02 | 12 / 2 / 3 / 15 | 12 / 2 / 3 / 15 |
| GVE Funktionsnetzwerk, Grounding offen | 20 Knoten · 85 Kanten | 20 Knoten · 85 Kanten |

Bilder (lokal, `data/` ist gitignored): `data/bilder-2026-09-10/cr507-vorher.png` und `data/bilder-2026-09-10/cr507-nachher.png`. Das Vorher-Bild ist die Aufnahme nach CR-GC-506, weil das Modell zwischen den beiden CRs auf v256 stand.

**Sichtcheck (I3):** Kein Linienbündel ändert sich, Knoten- und Kantenzahl sind gleich. Alle Enden der geänderten Flüsse liegen innerhalb von `FUNC-block-antrieb` unter der Führung: run-executor, call-model und extract-mutate. Auf dieser Ebene gibt es deshalb kein Signal, das dazukommt oder wegfällt.

## Tests

- `npm run build` grün, `tsc --noEmit` grün.
- **Auswahl:** executor, cli.run, flow-contracts, executor.bestofn, executor.preflight, schema-parse-at-interface, executor-tools und import-boundaries, 8 Dateien, 103 von 103 grün. `graph_tests({changeSet: [FUNC-call-model, FUNC-run-executor]})` nennt cli.run, executor.bestofn und executor (alle enthalten), `unresolved` leer.
- **Assertion-Check:** `flow-contracts.test.ts` und `cli.run.test.ts` rufen `buildCallModel` direkt gegen einen realen lokalen HTTP-Endpunkt auf und prüfen Draht-Form und Body (`reasoning_effort`). `executor.test.ts` prüft `buildToolSpecs` (gültige Objekt-Schemas, withheld-Werkzeuge, authoring-Set). Die verschobenen Funktionen sind damit direkt getestet.
- **Volle Suite (v257):** 1081 von 1087 grün. Rot sind 5 von 136 Dateien mit 6 Tests, genau die bekannte Grundlast: `claims.conformance`, `perf.advisory-roundtrip.spike`, `steering.artifact-coupling`, `steering.process-ratchet`, `steering`.
- **Smoke:** `node dist/cli.js run "<intent>"` im Temp-Repo gegen einen lokalen OpenAI-kompatiblen Fake-Server. Ergebnis `[generate 1] phase=seed`, `1.1: graph_mutate`, mutatesApplied 1, mutatesRejected 0, Export geschrieben.

## Bewusst offen

- **`rig/minimal-whitebox/run-armC-pull.mjs`:** importiert `../../dist/executor.js`, das es seit dem Modulschnitt nicht mehr gibt. Das war schon vor dieser CR kaputt und ist von ihr unabhängig; es ist ein Rig und kein Produktpfad.
- **R-04 MOD-loop:** 15 Funktionen und 9 Verträge, bestand mit 14 schon vorher. Die zwei ehrlich modellierten Rückgabe-FUNCs (gate-client, call-model) erhöhen die Zahl der Funktionen.
- **Bestehende Offenheiten:** Alles aus CR-GC-506 „Bewusst offen“ gilt weiter, ausgenommen die Zeilengrenze von executor.ts.
