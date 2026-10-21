# CR-GC-823: Actor-Flows aus kernel ohne surface: gate-verdict (apply), graph-state (GraphStore), export-pending (setExportPending) erreichen den Auftraggeber im Code nur ueber surface

**Status:** ✅ Done (2026-10-21)
**Typ:** aus Item ITEM-2026-986 (finding)
**Erstellt:** 2026-10-21
**Item:** bok/items/ITEM-2026-986.json (Lane: graph)

---

## Befund (Sitzung 2026-10-21)

Die Analyse der obersten Modulebene zeigte Kanten, die es im Code nicht gibt (ITEM-2026-986, -988, -991):

- Kernel, projections und loop lieferten direkt an den Auftraggeber: `gate-verdict` (apply), `graph-state` (GraphStore),
  `vorschlag`, `test-selection`; die Leseanfrage des Auftraggebers ging direkt an `graph-expand`, `list-elements`,
  `export-markdown`. Im Code erreicht der Auftraggeber das System nur über MCP (Ablaufsteuerung), CLI und Host-Socket.
  Folge: 22 von 26 Wirkketten endeten am Auftraggeber ohne das Glied, das die Antwort wirklich trägt.
- `computeMarks(violations)` bekam im Modell `FLOW-graph-state`; der Code nimmt `RuleViolation[]`.
- `graph_test_ingest` hatte keinen Eingang für den Laufbericht der Spuren und keine Antwort.

Die Kanten stammen aus der Zeit von `ACTOR-owner`; CR-GC-815 hat sie nur umgehängt. Datei-Ausgänge
(Snapshot, Views, Schlupf-Zeile, Drift-Marke, Code-Spur-Plan) sind richtig und bleiben.

## Umsetzung (Modellzug, kein Code)

- Gelöscht: die vier Ausgänge an den Auftraggeber und die drei direkten Leseanfragen.
- `FLOW-vorschlag` geht an `graph-mutate-tool` (Beleg `src/surface/write.ts`); den Nutzer erreicht er mit `FLOW-mutate-answer`.
- Host-Socket gibt die Antwort zurück: `FLOW-mutate-answer` → `host-socket` → `FLOW-mutate-answer-owner` → Auftraggeber.
- `computeMarks` liest `FLOW-rule-findings` statt `FLOW-graph-state`.
- `graph_test_ingest`: `FLOW-test-run-report-code` (plan-code-lane) und `-full` (measure-test-schlupf), beide
  `SCHEMA-test-ingest-input` (realRef `GraphTestIngestInputSchema`); Antwort `FLOW-test-ingest-answer` an beide Spuren.
  Beide Spuren liegen jetzt in `FCHAIN-test-ingest`.
- `FCHAIN-recall` bekommt seinen Ausgang zurück: `FLOW-rewind-summary` (CLI-Ausgabe von rewind).
- `FCHAIN-snapshot-freshness` bekommt seinen Eingang über `FUNC-agent-loop`.
- Folge des Zugs: `FLOW-query-request-owner` und `FLOW-auftrag` gingen danach beide vom Auftraggeber an die
  Ablaufsteuerung, mit demselben Vertrag. `graph_suggest` bot das Zusammenführen an
  (`tests/arch.optimization-dry-run.spike.test.ts` meldete den neuen Zug); `FLOW-auftrag` nimmt ihn auf.
  Kohärenz +0,021, Steuerwert unverändert.
- Code (RC-08, `tests/conformance.test.ts`): `RewindSummary` ist ein Zod-Schema (`RewindSummarySchema`), das
  `executeRewind` beim Erzeugen prüft; `GraphTestIngestInputSchema` ist exportiert.
- `FLOW-mutate-answer` und `FLOW-ergebnis` tragen `sync`: der Aufrufer wartet im Aufruf auf beide.

## Ein Test hing am Modellfehler

`tests/metrics.test.ts` (CR-GC-767) belegte, dass `sync` am Werkzeug ankommt, mit „mindestens eine Kette hat ein
Glied auf dem Antwortweg". Die einzige solche Kette war `FCHAIN-recall` mit `[FUNC-graph-store]` — über die
Kante `graph-state` → Auftraggeber, die es im Code nicht gibt. Nach der Korrektur hat keine Kette einen
Antwortweg (`recall` hindert jetzt der CLI-Aufruf des Agenten an denselben Dispatcher). Der Beleg ist jetzt
modellunabhängig: dieselbe Rechnung ohne `sync` muss andere Antwortwege liefern.

## Bewusst offen

- `SCHEMA-test-ingest-answer` ohne realRef (R-26): die Antwort hat im Code keinen Zod-Vertrag — gleiche Klasse wie ITEM-2026-982.
- `SCHEMA-rewind-summary` ist ein TypeScript-Interface, kein Zod-Vertrag (RC-04 bleibt).
- Kein Einfügen von `graph-mutate-tool` in Ketten, deren FUNCs das Gate direkt rufen (test-ingest, merge-branches).

## Kennzahlen (v790 → v800)

| Kennzahl | v790 | v800 |
|---|---|---|
| Module, die der Auftraggeber direkt berührt | 5 | 4 (Rest = Datei-/Schalenausgänge) |
| FUNCs an Flows des Auftraggebers | 42 | 16 |
| Ketten mit Aufruf-Ende außerhalb surface | 22 / 26 | 2 / 26 (beide Datei/Schale) |
| Steuerwert (steer) | 5,25 | 5,75 — schlechter: Grounding zeigt 27 statt 25 Verträge, weil die echten Antworten jetzt modelliert sind |
| Flows über Modulgrenzen | 61 | 62 (loop–surface 2 → 3: vorschlag) |
| Fehler | 0 | 0 |
