# CR-GC-792: Antwortweg lesbar machen: Gate-Urteil trennen, Store und Sperre als Glied

**Status:** ✅ Done (2026-10-12)
**Typ:** aus Item ITEM-2026-851 (finding)
**Erstellt:** 2026-10-12
**Item:** bok/items/ITEM-2026-851.json (Lane: graph)
**Freigabe:** Autor, 2026-10-12. Reine Modellarbeit, kein Quellcode.

---

## Befund (graph_metrics, graphVersion 704)

Von 24 bewertbaren Ketten ist der Antwortweg (`answerPath`) in 6 lesbar, in 18 verhindert.

- `FLOW-gate-verdict` trägt kein Merkmal `sync` und hindert 14 Ketten. Grund: die Abnehmer
  beziehen verschieden (Antwort im Aufruf gegen später aus dem Log), ein Wert je Fluss passt nicht.
- `FLOW-store-ownership` (Erzeuger: die Sperre `FUNC-claim-store-lock`) trägt `sync` und hindert
  7 Ketten, in denen die Sperre kein Glied ist.
- `FLOW-graph-state` (Erzeuger: `FUNC-graph-store`) trägt `sync` und hindert 4 Ketten, in denen der
  Store kein Glied ist; hinter dem Gate-Urteil stehen laut Trockenlauf 5 weitere (zusammen 9).

## Züge

### Zug 1: Gate-Urteil je Bezugsart trennen

Am Code festgestellt (realRef der Abnehmer):

| Abnehmer | Bezug | Stelle |
|---|---|---|
| `FUNC-bootstrap` | im Aufruf | `src/surface/bootstrap.ts:119` `await harness.mutate(commands)` |
| `FUNC-graph-suggest` | im Aufruf | `src/loop/suggest.ts:240` `await harness.mutateWithStates(…, { dryRun: true })` |
| `FUNC-import-code-verb` | im Aufruf | `src/surface/import-code-verb.ts:224` `await registry['graph_mutate'].handler(…)` |
| `FUNC-test-ingest` | im Aufruf | `src/projections/testreport.ts:138` `await harness.mutate(commands)` |
| `FUNC-tool-context` | im Aufruf | `recordAudit(consumerId, result, …)` bekommt das Urteil als Argument, der Schreibaufruf wartet darauf (`src/surface/write.ts:418`) |
| `ACTOR-owner` | im Aufruf | liest es als Antwort des Werkzeugs |
| `FUNC-se-retro` | später aus dem Log | `.claude/commands/se-retro.md` ruft das Gate nie; es liest `audit_stats` über das Operations-Log |

Der asynchrone Fluss existiert schon: `FLOW-audit-record` („Aufgezeichnete Gate-Entscheidung",
Erzeuger `FUNC-mutate`, Vertrag `SCHEMA-audit-record`, `sync: async`). Ein zweiter Knoten daneben
wäre ein paralleler Pfad. Deshalb:

- `FLOW-gate-verdict` bleibt als der synchrone Fluss (uid bleibt, Name „Gate-Verdikt (Antwort im
  Aufruf)", `sync: sync`, Beschreibung neu, Erzeuger `FUNC-mutate`, Vertrag `SCHEMA-mutate-result`).
- `FUNC-se-retro` wechselt von `FLOW-gate-verdict` auf `FLOW-audit-record`.

### Zug 2: Store und Sperre als Glied

Je Kette, in der `FLOW-graph-state` oder `FLOW-store-ownership` in `answerPathBlockedBy` steht:
`FCHAIN -compose-> FUNC-graph-store` bzw. `FCHAIN -compose-> FUNC-claim-store-lock`. Wird der Store
Glied, wartet er seinerseits auf die Sperre; sie wird im selben Zug Glied. Die Liste der Ketten
steht unter „Ergebnis".

## Nicht im Umfang

- Befehlsflüsse `FLOW-mutate-cmd-*` an das Gate (ITEM-2026-843): bleiben `sync`, kein Absender wird Glied.
- `FLOW-ontology-json`, `FLOW-schema-fingerprint` und die Flüsse ohne Merkmal: nur berichten.
- Status am CR-Knoten (ITEM-2026-850).

## Abnahme

- `FLOW-gate-verdict` in der alten Form gibt es nicht mehr; jeder Abnehmer hängt an genau einem
  der beiden Flüsse; beide tragen das Merkmal.
- In keiner Kette steht ein Fluss von Store oder Sperre in `answerPathBlockedBy`.
- Kein neuer Fehler; Marken unverändert oder besser.
- Tabelle davor/danach.

## Stand davor (graphVersion 704)

- Marken: SRR erreicht; PDR, CDR, TRR, Bau nicht erreicht. Fehler: 0. Befunde gesamt: 453.
- Lesbar (6): codec-roundtrip, doc-export, grammar-query, impact-testing, merge-branches, skill-help.
- Nicht bewertbar (1): schema-migration (`loose-member`).

## Ergebnis (graphVersion 707)

### Trockenläufe

- Zug 1: kein neuer Fehler, keine neue Warnung, Befunde je Stufe unverändert. Drei Schwellwerte
  sinken: R-04 `MOD-agent-surface` 10 auf 9 Verträge, BW-02 `FUNC-block-anleitung` 6 auf 5,
  BW-02 `FUNC-goal-steerer` 12 auf 11. Fit-Advisory: coherence +0,035, scalability −0,004.
- Zug 2: keine Befunde, Befunde je Stufe unverändert, Steuerwert unverändert.

### Zug 2, angewandt

- Sperre wird Glied (Store war es schon), 7 Ketten: advisory-roundtrip, dashboard-metrics,
  interface-escalation, live-update, recall, snapshot-freshness, steering-loop.
- Store und Sperre werden Glied, 9 Ketten: agent-query, generation-states, capture, loop-closure,
  model-import, modelfree-gate, skill-authoring, skill-report, test-ingest. Vier davon nannte
  `graph_metrics` schon davor; fünf standen hinter dem Gate-Urteil und zeigten sich im Trockenlauf
  von Zug 1.
- `FUNC-graph-store` ist Glied in 17 Ketten (davor 8), `FUNC-claim-store-lock` in 18 (davor 2).

### Abnahme

| Punkt | Stand |
|---|---|
| `FLOW-gate-verdict` trägt `sync`, `FUNC-se-retro` hängt an `FLOW-audit-record` (`async`) | erfüllt |
| kein Fluss von Store oder Sperre in `answerPathBlockedBy` | erfüllt (`FLOW-graph-state`, `FLOW-store-ownership` in keiner Kette mehr) |
| kein neuer Fehler | erfüllt (0 davor, 0 danach) |
| Marken | unverändert (SRR erreicht) |
| Befunde je Regel | unverändert; MS-03 240 auf 241 durch den Knoten dieses CR |
| `npm run verify:model` | 50 Dateien, 438 Tests grün |

### Lesbare Ketten

Davor 6, danach 6, dieselben: codec-roundtrip, doc-export, grammar-query, impact-testing,
merge-branches, skill-help. Kein Zug öffnet eine Kette: hinter den beseitigten Hindernissen stehen weitere.

### Verbleibende Hindernisse je Kette (danach)

| Kette | Befehl ans Gate | zu trennen | Merkmal fehlt | anderer Erzeuger außerhalb |
|---|---|---|---|---|
| advisory-roundtrip | 20 | schema-fingerprint | learning-query | cli-command, expand-subgraph, generation-step-suggest, module-metrics, query-request-view-fmea, zug-bericht |
| agent-query | 0 | schema-fingerprint | | cli-command |
| apply-gate | 20 | schema-fingerprint | | cli-command, module-metrics |
| capture | 20 | schema-fingerprint | | cli-command, rule-findings |
| dashboard-metrics | 21 | schema-fingerprint | | cli-command, rule-findings |
| generation-states | 0 | schema-fingerprint | learning-query | cli-command, dimension-readiness, target-profile |
| interface-escalation | 21 | schema-fingerprint | | cli-command, expand-subgraph, query-request-view-fmea, rule-findings |
| live-update | 21 | schema-fingerprint | | cli-command, harness-handle, mcp-tool-registry, module-metrics, tool-registry |
| loop-closure | 21 | schema-fingerprint | | cli-command, dimension-readiness, rule-findings |
| model-import | 19 | schema-fingerprint | | harness-handle, rule-findings |
| modelfree-gate | 21 | schema-fingerprint | | cli-command, module-metrics |
| recall | 0 | schema-fingerprint | | cli-command |
| repo-lifecycle | 0 | | | cli-invocation-import-code |
| skill-authoring | 8 | schema-fingerprint | | cli-command, rule-findings |
| skill-report | 0 | schema-fingerprint | | audit-entries, audit-report, cli-command |
| snapshot-freshness | 21 | schema-fingerprint | | cli-command, module-metrics |
| steering-loop | 20 | ontology-json, schema-fingerprint | learning-query | cli-command, completeness, conformance-findings, module-metrics |
| test-ingest | 20 | schema-fingerprint | | cli-command, rule-findings |

Alle Namen ohne das Präfix `FLOW-`. Die Zahl unter „Befehl ans Gate" zählt die Flüsse `FLOW-mutate-cmd-*`.

### Neue Befunde

1. `FLOW-cli-command` (Erzeuger `FUNC-cli-dispatch`, `sync`) ist Eingang der Sperre. Mit der Sperre
   als Glied hindert er 16 Ketten (davor 1). Die Sperre wird beim Start des Hosts genommen, nicht
   je Aufruf; ob dieser Eingang für eine Abfragekette `sync` ist, ist offen.
2. `FLOW-schema-fingerprint` (ohne Merkmal, Eingang des Stores) hindert 17 Ketten.
3. Im Code liest `se-retro` das Log nicht selbst, sondern über `audit_stats` (`FLOW-audit-report`).
   Die Kante `FLOW-audit-record -io-> FUNC-se-retro` folgt der Aussage „liest später aus dem Log";
   streng nach Code wäre sie entbehrlich.
4. `tests/contracts.surface.test.ts:6` nennt `FLOW-gate-verdict` im Kommentar; die uid besteht fort.
