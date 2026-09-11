# CR-GC-509: Offene Korrekturen aus CR-GC-505..508

**Status:** ✅ Done (2026-09-11)
**Typ:** aus Item ITEM-2026-043 (finding)
**Erstellt:** 2026-09-11
**Item:** bok/items/ITEM-2026-043.json (Lane: code)

---

## Problem

In den Abschnitten „Bewusst offen“ von CR-GC-505..508 stehen sechs benannte Korrekturen:

- a) Drei echte Absender von `FLOW-mutate-cmd` haben keine FUNC: graph_realize, graph_test_ingest und der Skill se:top-level.
- b) `FLOW-round-scope` ist nur konzeptuell modelliert und hat graph-impact als Produzenten.
- c) Der Gate-Zugang liest den Graphen selbst, ohne dass eine Kante das zeigt, und sein Ergebnis an die Treiberschleife ist kein eigener FLOW.
- d) Ein Rig importiert `dist/executor.js`.
- e) `npm run lint` hat keine Konfiguration.
- f) read.ts hat zwei Serialisierungswege für Format-E.

## Dateischnitt (vor Beginn gezählt)

Vor Beginn gezählt: `docs/graph/graphcode.graph.json` und vier Rig-Dateien, zusammen 5 Dateien. f ändert keine Datei (Befund: bewusst verschieden), e ist blockiert. Damit reicht eine CR; die generierten Views zählen nicht.

Nachträglich kam eine 6. Datei dazu: Die volle Suite machte den Mess-Spike `tests/arch.optimization-dry-run.spike.test.ts` rot (siehe unten). Die Grenze von 6 ist damit erreicht, aber nicht überschritten.

## Befund am Code (I1, I2)

### a) Absender ohne FUNC

**graph_realize** (`src/surface/write.ts`)
- Liest Knoten aus dem Store: `harness.getGraph().nodes` (:418).
- Baut update-node-Kommandos für realRef von FUNC und SCHEMA und für testRefs einer Abnahme (:419-470).
- Sendet mit `harness.mutate(commands)` (:493) und liest das Verdict (:494-509).
- Eingang ist also der Store-Graph plus das Verdict, Ausgang der eigene Batch.

**graph_test_ingest** (`src/projections/testreport.ts`)
- `planIngest(harness.getGraph(), files)` (:93) und `nodes` (:111).
- Kommandos je Knoten (:122-141), dann `harness.mutate(commands)` (:142) und Verdict (:144-151).

**Skill se:top-level** (`.claude/commands/se/top-level.md:140`)
- Weist an: „Every batch through `graph_mutate` with `dryRun: true` first“.
- Einen Direktschreibweg nennt die Datei nicht; `tests/skill-authoring-gate.test.ts` prüft das jetzt mit.

### b) FLOW-round-scope

**Widerlegt: kein Codepfad von der Impact-Scheibe zur Regelauswertung.**
- `gate.evaluate(graph)` bekommt den ganzen Graphen (`gate.ts:226`).
- `harness.evaluateRules()` übergibt `store.current()` (`harness.ts:354-355`). Das ist genau die schon modellierte Kante `graph-state → evaluate-rules`.
- `harness.impact` hat genau einen Aufrufer, das Lese-Werkzeug (`read.ts:349`, seit CR-GC-505 als `FLOW-impact-slice` modelliert).
- read.ts ruft `evaluateRules` nicht auf.

**Positivkontrolle:** Dieselbe Suche findet `evaluateRules` in write.ts dreimal (:33, :242, :349). Der Runden-Scope ist Kontext im Kopf des Agenten zwischen zwei Werkzeugaufrufen und kein Datenfluss.

### c) Gate-Zugang (`src/loop/executor-gate.ts`)

**Lesen:** `loadGraphSnapshot` ruft über die Registry
- `graph_elements({limit:100000})` (:120), das ist `read.ts:263` → `harness.listElements`, also `FUNC-list-elements` → `FLOW-element-slice`;
- `graph_get_edges({edgeType:'verify'})` (:123), das ist `read.ts:300` → `harness.getGraph().edges`, also `FLOW-graph-state`.

**Rückgabe:**
- `callGate` formt aus dem graph_mutate-Ergebnis ein `MutateOutcome` mit erzwungenem `success` und `hints` (:164-180).
- `runPreflight` liefert bei lokalem Block ein Verdict ohne Gate-Call (:136-143).
- Konsumenten:
  - `runExecutor` für Zähler und `formatGateFeedback` (`executor.ts:324`, `:362`);
  - die Best-of-N-Runde, die das Ergebnis als `c.verdict` ablegt (`executor-bestofn.ts:179`, `:188`);
  - `rankCandidates`, das nur dieses `CandidateProbe.verdict` liest (`executor-rank.ts:37`). Es importiert weder Registry noch Harness (:10-12).

Die Kante `gate-verdict → rank-candidates` war damit falsch adressiert: Die Rangfolge liest den Gate-Ausgang des Executors und nicht das Verdict von mutate direkt.

### d) Rig-Importe

- Nicht nur `run-armC-pull.mjs` ist betroffen. `grep dist/executor rig scripts` findet 4 Dateien mit 5 toten Importen:
  - `dist/executor.js` in run-armC-pull und run-armC;
  - `dist/executor-prompt.js` in run-armC-pull, measure und run-phase1-authoring.
- Seit dem Modulschnitt liegen die Module unter `dist/loop/`.
- `buildToolSpecs` liegt seit CR-GC-507 in `dist/loop/executor-backend.js`.

### e) Lint

**Blockiert, nichts geändert.**
- Installiert ist `eslint` 9.39.4, aber kein TypeScript-Parser (`node_modules/typescript-eslint` und `@typescript-eslint` fehlen).
- In der Git-History gab es nie eine `.eslintrc*` und nie `typescript-eslint` in package.json.

**Positivkontrolle:**
- `const a: number = 1;` über `eslint --stdin --stdin-filename x.js` → `Parsing error: Unexpected token :`
- `const a = 1;` → exit 0

Eine flat config ohne TS-Parser würde jede .ts-Datei als Parse-Fehler melden. `npm run lint` bricht heute mit exit 2 ab („couldn't find an eslint.config“), bevor eine Datei gelintet wird. **Eine Befundzahl gibt es deshalb nicht.** Neue Abhängigkeiten waren ausgeschlossen.

### f) Zwei Format-E-Wege in read.ts

**Bewusst verschieden, kein paralleler Pfad, nichts geändert.** Gemessen am SSOT (v257) mit `dist/projections/codec.js` und der echten Import-Abbildung `elementToNode`, je Typ-Scheibe wie bei `graph_elements format:formatE`:

| Scheibe | `gcCodec.encode` → decode | `FormatECodec.serialize(omitProvenance)` → decode |
|---|---|---|
| FUNC (115 Knoten, 111 Kanten) | Namen 115/115, created_at 27/27, Kanten 111/111 | Namen 0/115, created_at 0/27, Kanten 111/111 |
| FLOW (65) | Namen 65/65, created_at 10/10 | Namen 0/65, created_at 0/10 |
| TEST (124) | Namen 124/124, created_at 39/39 | Namen 0/124, created_at 0/39 |

- **graph_elements/graph_get_edges** (`read.ts:269`, `:321`) versprechen eine round-trip-stabile, re-importierbare Scheibe. Das steht in der Tool-Beschreibung, und `tests/mcp.read-format.test.ts:58-87` decodiert sie mit `gcCodec`. Dafür braucht es `__name` und die Provenienz.
- **graph_impact/expand/context** (`read.ts:358`, `:405`, `:432`) liefern die Agenten-Sicht aus CR-GC-373. Dort ist das Weglassen der Provenienz gewollt: „dieselbe Serialisierung bedient zwei Konsumenten, den Re-Import und den Agenten“.
- Verschiedene Semantik bedeutet zwei Aufrufe. Eine Vereinheitlichung würde entweder den Re-Import oder die Token-Ersparnis brechen.

## Umsetzung

### Modell (über `graph_mutate`, v257 → v258)

Ein Batch mit 42 Kommandos. Zuerst dryRun gegen baseVersion 257, danach `scripts/export-graph.mjs`.

**a)**
- **Neu `FUNC-graph-realize`:**
  - realRef `src/surface/write.ts::graph_realize`, allocate MOD-surface
  - Kind von Autorieren, Glied von skill-authoring
  - satisfy `REQ-test-runnable-binding`
  - io: `graph-state →`, `gate-verdict →`, `→ mutate-cmd`
  - `TEST-graph-realize` verifiziert jetzt auch `REQ-test-runnable-binding`, weil `mcp.realize.test.ts:67-79` den testRefs-Eintrag assertiert.
  - Erster Versuch mit satisfy `REQ-gate-only-writes`: R-18 im dryRun, weil die REQ als non-functional deklariert ist.
- **Neu `FUNC-test-ingest`:**
  - realRef `src/projections/testreport.ts::graph_test_ingest`, allocate MOD-projections
  - Kind von Abfrage, Glied von impact-testing
  - satisfy `REQ-test-runnable-binding`
  - io: `graph-state →`, `gate-verdict →`, `→ mutate-cmd`
- **Neu `FUNC-se-top-level`:**
  - realRef `.claude/commands/se/top-level.md`, allocate MOD-agent-surface
  - Kind von Autorieren, Glied von skill-authoring
  - satisfy `REQ-skill-authors-through-gate`
  - io: `skill-request →`, `→ mutate-cmd`

**b)**
- `FLOW-round-scope` und `SCHEMA-round-scope` samt ihrer drei Kanten gelöscht.
- In der Beschreibung von `FLOW-round-injection` den Verweis auf den Runden-Scope entfernt.

**c)**
- Neu `FLOW-element-slice → gate-client` und `FLOW-graph-state → gate-client`.
- Neu `FLOW-gate-outcome` (gate-client → run-executor, rank-candidates) mit `SCHEMA-gate-outcome` (concept: TS-Typ `MutateOutcome`, kein Zod).
- Kante `FLOW-gate-verdict → FUNC-rank-candidates` gelöscht.
- Die Beschreibungen von `FUNC-gate-client`, `FLOW-gate-verdict` und `FLOW-mutate-cmd` nennen den Code-Weg.

### Mess-Spike `arch.optimization-dry-run` (aus der vollen Suite)

**Befund:** Der Spike hält am SSOT fest: „Greedy findet 0 Züge, dominiert von BW-02 @ FUNC-block-grounding“. Er verlangt ausdrücklich: Wird ein Zug möglich, soll der Test rot werden und der Befund neu geschrieben werden. Nach v258 kam 1 Zug.

**Nachmessung:** Dieselbe Testlogik lief als temporäre Kopie gegen beide SSOT-Stände.
- **v257:** grün. Alle 10 anwendbaren Merges haben Score 0, audit-record hat −1.4e-5.
- **v258:** `OP-MERGE FLOW-mutate-cmd absorbiert FLOW-candidate-batch` hat Score 2.454e-5 und liegt damit über `EPS = 1e-9`.
- Realisiert auf dem Zielprofil: −0.0299.
- Dominierender Term unverändert, Befund-Bilanz 0 geschlossen / 0 neu.

**Ursache:** Der Score in se-engine ist `worst + EPS_AUGMENT · mean` mit `EPS_AUGMENT = 1e-3` (`steer.js:31`, `:70`). Der Merge senkt nur den Mittelwert der Überschüsse, nicht das Maximum; es ist ein Plateau-Zug über den Ausgleichsterm. Den Mittelwert verschieben die neuen Verträge aus a und c.

**Neu geschrieben:**
- (3) Kein Zug verspricht `≥ EPS_AUGMENT`. Ein echter Schritt am Maximum ist mindestens 1/Schwelle (≥ 0.11).
- (4) Die gemessene Plateau-Kette ist gepinnt.

**Positivkontrolle:** Der neue Test gegen den v257-SSOT wird an (4) rot („expected [] to deeply equal [Array(1)]“).

### Code

**d)** Die Importe zeigen auf `dist/loop/executor.js`, `dist/loop/executor-backend.js` (buildToolSpecs) und `dist/loop/executor-prompt.js`, in allen 4 Dateien. Zwei Kommentarpfade in run-armC-pull.mjs sind nachgezogen.

## Akzeptanzkriterien

- [x] a: drei FUNCs mit realRef, compose-Eltern, allocate und io am Code belegt.
- [x] b: Produzent und Konsument am Code geprüft, Widerlegung mit Positivkontrolle, FLOW entfernt.
- [x] c: Lesezugriff und Rückgabe modelliert, falsch adressierte Kante korrigiert.
- [x] d: alle Rig-Importe lösen auf (vorher 5 FAIL, nachher 0), ohne LLM-Lauf.
- [ ] e: blockiert, fehlender TS-Parser (siehe Befund).
- [x] f: am Output gemessen, bewusst verschieden begründet, nichts geändert.
- [x] readiness 0 Fehler, importCoverage sinkt nicht, Veränderungen berichtet.
- [x] volle Suite nur Grundlast rot; die neue rote Datei ist nachgemessen und nicht umgangen.

## Messung

| Größe | vorher (v257) | nachher (v258) |
|---|---|---|
| IO-02 (Rig am SSOT) | 6 | 6 |
| `FLOW-mutate-cmd` | 18P × 2K | **21P** × 2K (+ graph-realize, test-ingest, se-top-level) |
| `FLOW-gate-verdict` | 1P × 10K | 1P × 11K (+ graph-realize, test-ingest; − rank-candidates) |
| `FLOW-gate-outcome` | – | 1P × 2K |
| `FLOW-element-slice` | 1P × 1K | 1P × 2K |
| `FLOW-graph-state` | 1P × 21K | 1P × 24K |
| `FLOW-round-scope` | 1P × 1K | entfernt |
| formatE-artifact / install-result / query-request / skill-report / steering-trigger | 5P / 3P / 10P / 6P / 3P | unverändert |
| `graph_readiness` Fehler | 0 | 0 |
| importCoverage | 88/89 | 88/89 (`src/index.ts`) |
| RC-04 / R-31 / FC-04 | 5 / 12 / 3 | 5 / 12 / 3 |
| IO-01 | 2 | **3** (+ `FUNC-test-ingest` in `FCHAIN-impact-testing`) |
| BW-02 | 15 | **16** (+ `FUNC-block-autorieren`, 6 Verträge) |
| CR-01 (rules_get_violations, gruppiert) | 7 | **8** (+ MOD-projections ↔ MOD-surface, 3 Verträge); in readiness 14 → 14 |
| Rig-Importe (4 Dateien) | 5 FAIL | 0 FAIL |
| `npm run lint` | exit 2, keine Config | unverändert (blockiert) |
| GVE Funktionsnetzwerk, Grounding offen | 20 Knoten · 85 Kanten | 20 Knoten · 85 Kanten |

Bilder (lokal, `data/` ist gitignored): `data/bilder-2026-09-10/cr509-vorher.png` und `data/bilder-2026-09-10/cr509-nachher.png`.

**Sichtcheck (I3):** Knoten- und Kantenzahl sind gleich, aber die Ports am Block Abfrage haben sich verschoben.
- **Weg:** `out.FLOW-round-scope`. Das war b, die Linie von graph-impact zu evaluate-rules im Qualitäts-Gate.
- **Neu:** `out.FLOW-mutate-cmd`. Das ist a: test-ingest schickt seinen Batch an mutate im Gate.
- **Neu:** `in.lift.FUNC-block-gate`. Dieser Port ersetzt `in.FLOW-audit-record`. Aus dem Gate kommen jetzt zwei Signale in die Abfrage, audit-record (wie bisher) und gate-verdict an test-ingest (neu), und der Viewer bündelt sie zu einem Lift.
- **Messwerk:** Ports unverändert.
- **Führung:** graph-realize, se-top-level, gate-client, run-executor und rank-candidates liegen dort alle innerhalb des zugeklappten Blocks. Deren neue Signale laufen auf dieser Ebene über schon vorhandene Bündel (Mutate-Command, Graph-State, Gate-Verdict) und sind nicht als eigene Linie sichtbar.

## Tests

- **Type-Check:** `npm run type-check` grün (geändert ist nur die Testdatei, kein `src/`).
- **Auswahl:** `graph_tests` für die acht betroffenen FUNCs (23 Dateien, `unresolved` leer), dazu die modellgebundenen graph-integrity, views.conformance und mcp.agent-agnostic.
  - Ergebnis: 26 Dateien, 220 von 222 grün.
  - Rot sind nur `steering.artifact-coupling` und `steering` (Grundlast).
  - `skill-authoring-gate` prüft `FUNC-se-top-level` jetzt mit.
- **Volle Suite:**
  - Erster Lauf: 7 rote Tests in 6 Dateien, neu dabei `arch.optimization-dry-run.spike` (siehe Mess-Spike).
  - Nach der Nachmessung: 1082 von 1088 grün. Rot sind 5 von 136 Dateien mit 6 Tests, genau die Grundlast: `claims.conformance`, `perf.advisory-roundtrip.spike`, `steering.artifact-coupling`, `steering.process-ratchet`, `steering`.
- **Smoke d:** Import-Auflösung aller 4 Rigs. Bare Specifier werden relativ zur Rig-Datei aufgelöst; `./measure.mjs` wird statisch geprüft und nicht ausgeführt, weil es beim Laden einen Store öffnen würde. Vorher 5 FAIL (Positivkontrolle), nachher alle `ok`.

## Bewusst offen

- **e, Lint:** Für eine ESLint-9-flat-config fehlt `typescript-eslint` (Parser und Regeln). Entscheidung nötig: die Abhängigkeit aufnehmen oder das `lint`-Skript streichen. Solange keine lauffähige Config existiert, gibt es auch keine Befundzahl.
- **Anfragen an die Werkzeuge nicht modelliert:** die flache Bindungsanfrage an graph_realize (`GraphRealizeInputSchema`, write.ts:137) und der Runner-Report an graph_test_ingest (`GraphTestIngestInputSchema`, testreport.ts:34). Dasselbe gilt für die Rückgaben an den Aufrufer (missingRefs bzw. assignments/unresolved). Die Tool-Input-Schemas werden im MCP-Layer geparst (`mcp-server.ts:59`); ein SCHEMA mit realRef würde RC-04 auslösen, ein Sammel-Kanal wäre ein paralleler Pfad (Begründung bei SCHEMA-query-params).
- **IO-01 `FUNC-test-ingest`, neu:** Die Verbindung zu graph_tests läuft über den Agenten (Auswahl → Lauf → Report) und nicht über einen FLOW zwischen FUNCs.
- **CR-01 MOD-projections ↔ MOD-surface, neu:** Das ist die Folge von test-ingest in projections, das an `mutate-cmd` sendet; dessen Konsument host-socket liegt in surface. Außerdem sagt die Beschreibung von MOD-projections „schreibt nie in ihn zurück“, obwohl testreport.ts dort über das Gate schreibt. Nicht geändert.
- **BW-02 `FUNC-block-autorieren`, neu:** graph-realize bringt graph-state und gate-verdict über die Blockgrenze.
- **fitAdvisory:** modifiability, coherence und scalability regressieren leicht (−0,07 / −0,09 / −0,11). Das ist eine Advisory und kein Gate; die Ursache sind mehr ehrlich modellierte Flüsse.
- **build-round-injection:** liest den Graphen ebenfalls über die Registry (`graph_elements` executor-prompt.ts:171, `graph_authoring_guide` :149). Das ist dieselbe Klasse wie in c, gehört aber nicht zu diesem Auftrag.
- **Außerhalb von read.ts:**
  - `GraphCodeCodec.encode` und `FormatECodec.serialize` ohne Option liefern verschiedenen Text (encode trägt `__name`). Den Grund nennt der Dateikopf von codec.ts (CR-GC-103).
  - `host.ts:244` baut eine dritte `FormatECodec`-Instanz für die Agenten-Sicht.
- **Verweise auf den gelöschten FLOW:** `scripts/spike-archetype-eigenvector.mjs:330` nennt `FLOW-round-scope` noch in einer Abbildungstabelle für den eingefrorenen Korpus, das ist harmlos. `CR-DRAFT-GC-409` führt SC-04 an diesem FLOW; dieser Punkt ist damit gegenstandslos.
- **se-engine, Ausgleichsterm:** Über `EPS_AUGMENT · mean` bekommt ein Plateau-Zug einen positiven Score, und der Greedy-Lauf nimmt ihn. Der konkrete Vorschlag (candidate-batch in mutate-cmd mergen) würde den Schnitt aus CR-GC-506 rückgängig machen. Die Score-Definition ist Familie-Sache (se-engine) und hier nicht angefasst.
- **Bestehende Offenheiten:** ITEM-2026-041 (Best-of-N) und ITEM-2026-042 (Dateien > 500 Zeilen) sind nicht im Umfang.
