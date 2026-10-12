# CR-GC-793: Start-Lieferungen tragen sync: Sperre faelschlich Glied in 16 Ketten

**Status:** ✅ Done (2026-10-12)
**Typ:** aus Item ITEM-2026-852 (bug)
**Erstellt:** 2026-10-12
**Item:** bok/items/ITEM-2026-852.json (Lane: graph)
**Freigabe:** Autor, 2026-10-12. Reine Modellarbeit, kein Quellcode.

---

## Befund

CR-GC-789 setzte `FLOW-store-ownership` auf `sync` (Leitsatz 3 dort: „Übergabe beim Start ist
`sync`"). CR-GC-792 nahm deshalb die Sperre `FUNC-claim-store-lock` in 16 Ketten als Glied auf.
Danach hing jede dieser Ketten am Eingang der Sperre (`FLOW-cli-command`), und keine wurde lesbar.

Das Merkmal ist aus Sicht des Abnehmers definiert: `sync` heißt, die Antwort wartet beim Aufruf auf
die Lieferung; `async` heißt vorab geliefert. Am Code:

| Stelle | Aussage |
|---|---|
| `src/kernel/graph-store.ts:72` | `lock.acquire()` steht nur in `GraphStore.open()` |
| `src/kernel/graph-store.ts:86-87, 103` | Fingerabdruck rechnen, Marke lesen, Marke stempeln: nur in `open()` |
| `src/kernel/harness.ts:214` | `open()` wird allein von `harness.initialize()` gerufen |
| `src/surface/mcp-server.ts:213` | der Host ruft `initialize()` einmal beim Start (`electAndBoot`) |
| `src/kernel/graph-store.ts:117, 126` | `current()` und `commit()`, die Wege je Anfrage, fassen weder Sperre noch Fingerabdruck an |

Für jede Anfrage an den laufenden Host ist die Lieferung vorab geschehen. `sync` an
`FLOW-store-ownership` war eine Fehlsetzung, die Aufnahme der Sperre in 16 Ketten folgte aus ihr.

## Züge

### Zug 1 (graphVersion 708 auf 709)

- `FLOW-store-ownership`: `sync` auf `async`.
- `FLOW-schema-fingerprint`: ohne Merkmal auf `async`. CR-GC-789 hatte ihn als „zu trennen: ein
  Abnehmer, zwei Wege" offen gelassen (rechnen im Aufruf, Marke vom letzten Start lesen). Beide Wege
  liegen in `open()`, der einzige Abnehmer `FUNC-graph-store` bezieht beide beim Start. Keine Trennung nötig.
- `FCHAIN -compose-> FUNC-claim-store-lock` gelöscht in den 16 Ketten aus CR-GC-792:
  advisory-roundtrip, dashboard-metrics, interface-escalation, live-update, recall,
  snapshot-freshness, steering-loop, agent-query, generation-states, capture, loop-closure,
  model-import, modelfree-gate, skill-authoring, skill-report, test-ingest.
  Glied bleibt die Sperre in apply-gate und repo-lifecycle (Stand vor CR-GC-792).
- `FUNC-graph-store` bleibt Glied in 17 Ketten (Aussage des Autors: der Abruf des Graph-Zustands ist `sync`).

### Zug 2 (graphVersion 709 auf 710)

Dieselbe Klasse: `FLOW-mcp-tool-registry` und `FLOW-tool-registry` von `sync` auf `async`.
Erzeuger `FUNC-bind-tools`, einziger Abnehmer `FUNC-serve-stdio`. Beleg: `bindToolsToHarness`
läuft in `bootHost` (`src/surface/mcp-server.ts:144`), `serveStdio` holt das Register einmal
(`registry = await electAndBoot()`, `src/surface/mcp-server.ts:241`) und bindet es an den Server;
ein Werkzeugaufruf liest das gehaltene Register.

## Nicht angefasst

| Fluss | Grund |
|---|---|
| `FLOW-cli-command` (bleibt `sync`) | Die Kante an die Sperre ist ein Start-Bezug, aber acht weitere Abnehmer sind CLI-Verben, auf deren Handler `main` im Aufruf wartet (`src/cli.ts:73-203`). Ein Wert passt nicht für alle. Nach Zug 1 hindert der Fluss keine Kette mehr. |
| `FLOW-harness-handle` (bleibt `sync`) | Gemischt: im Host beim Start (`mcp-server.ts:201`), in den CLI-Verben im Aufruf (`src/surface/import-code-verb.ts:118`, `src/surface/rewind.ts:140`). Hindert live-update und model-import. Zu trennen. |
| `FLOW-target-profile` (bleibt `sync`) | Wird je Aufruf frisch geladen (`src/loop/suggest.ts:368`, `src/loop/next-step.ts:133`). `sync` stimmt. |
| `FLOW-ontology-json` (ohne Merkmal) | Gemischt, wie CR-GC-789 es festhielt: der Import bekommt den Inhalt im Aufruf (`src/kernel/harness-import.ts:234`), `heldBackTraces` liest die Datei je Aufruf selbst (`:208`). Kein Start-Fluss. |
| `FLOW-tool-context`, `FLOW-mcp-tool`, `FLOW-harness-handle-host` (bleiben `sync`) | Stehen in Leitsatz 3 von CR-GC-789, hindern keine Kette. `bindToolsToHarness` läuft auch in CLI-Verben im Aufruf (`import-code-verb.ts:151`, `src/surface/measured.ts:198`); ohne Bedarf nicht umgesetzt. |
| `FLOW-mutate-cmd-*` | Bleiben `sync` (ITEM-2026-843). Kein Absender wurde Glied. |

## Grenzen des Befunds (Urteil, nicht Messung)

1. **CLI-Verben öffnen den Store im Aufruf.** `graphcode rewind` und `graphcode import-code` rufen
   `createHarness` und `initialize()` in ihrem eigenen Lauf (`rewind.ts:140-144`,
   `import-code-verb.ts:118-122`). In den Ketten recall und model-import wartet der Akteur also
   auf die Sperre. Mit einem Wert je Fluss gilt jetzt `async` auch dort; recall wird damit als
   lesbar gemeldet, obwohl sein Antwortweg die Sperre streng genommen enthält.
2. **Beförderung eines Proxys.** Stirbt der Host, öffnet der Proxy im laufenden Werkzeugaufruf
   einen eigenen (`src/surface/host-shim.ts:181`, `promote`). Das ist der einzige Weg, auf dem
   Sperre, Fingerabdruck und Werkzeug-Register im Aufruf entstehen; ein Fehlerpfad.
3. **Startkette.** In repo-lifecycle ist der Start selbst der Aufruf. Die Sperre bleibt dort Glied,
   ihr Ausgang trägt aber jetzt `async`.

## Stand davor (graphVersion 707) und danach (710)

- Marken unverändert: SRR erreicht; PDR, CDR, TRR, Bau nicht. Fehler: 0 davor, 0 danach.
- Trockenläufe beider Züge: keine Befunde, Befunde je Stufe unverändert (Plan 271 auf 270),
  Steuerwert unverändert (4,0012).
- Lesbare Ketten: 6 auf 8. Neu: agent-query (Antwortweg: graph-expand, graph-impact, graph-store,
  list-elements, read-tools, view-fmea) und recall (Antwortweg: graph-store).
- `FUNC-graph-store` Glied in 17 Ketten (unverändert), `FUNC-claim-store-lock` in 2 (davor 18).
- `FLOW-cli-command` hindert 0 Ketten (davor 16), `FLOW-schema-fingerprint` 0 (davor 17).

### Verbleibende Hindernisse je Kette (danach)

| Kette | Befehl ans Gate | Merkmal fehlt | anderer Erzeuger außerhalb |
|---|---|---|---|
| advisory-roundtrip | 20 | learning-query | expand-subgraph, generation-step-suggest, module-metrics, query-request-view-fmea, zug-bericht |
| apply-gate | 20 | | module-metrics |
| capture | 20 | | rule-findings |
| dashboard-metrics | 21 | | rule-findings |
| generation-states | 0 | learning-query | dimension-readiness, target-profile |
| interface-escalation | 21 | | expand-subgraph, query-request-view-fmea, rule-findings |
| live-update | 21 | | harness-handle, module-metrics |
| loop-closure | 21 | | dimension-readiness, rule-findings |
| model-import | 19 | | harness-handle, rule-findings |
| modelfree-gate | 21 | | module-metrics |
| repo-lifecycle | 0 | | cli-invocation-import-code |
| skill-authoring | 8 | | rule-findings |
| skill-report | 0 | | audit-entries, audit-report |
| snapshot-freshness | 21 | | module-metrics |
| steering-loop | 20 | learning-query, ontology-json | completeness, conformance-findings, module-metrics |
| test-ingest | 20 | | rule-findings |

Namen ohne das Präfix `FLOW-`. Keine Kette hängt allein an den Befehlsflüssen: neben ihnen steht
je genau ein weiterer Fluss bei apply-gate, modelfree-gate, snapshot-freshness (`module-metrics`)
und bei capture, dashboard-metrics, skill-authoring, test-ingest (`rule-findings`).

## Abnahme

| Punkt | Stand |
|---|---|
| `FLOW-store-ownership`, `FLOW-schema-fingerprint` tragen `async` | erfüllt |
| Sperre Glied nur in apply-gate und repo-lifecycle | erfüllt |
| Store Glied in 17 Ketten | erfüllt |
| kein neuer Fehler, Marken unverändert | erfüllt |
| `npm run verify:model` | 50 Dateien, 438 Tests grün |
