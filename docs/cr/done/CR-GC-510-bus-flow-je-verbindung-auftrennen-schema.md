# CR-GC-510: Bus-FLOW je Verbindung auftrennen, SCHEMA teilen

**Status:** ✅ Done (2026-09-11)
**Typ:** aus Item ITEM-2026-044 (finding)
**Erstellt:** 2026-09-11
**Item:** bok/items/ITEM-2026-044.json (Lane: graph)

---

## Problem

IO-02 (ein FLOW, ein Produzent) meldet am Modell v258 sechs FLOW mit mehreren Produzenten. Ursache ist die
Modellierung: ein Bus ist als EIN geteilter FLOW-Knoten gebaut statt als ein FLOW je echter Verbindung mit
gemeinsamem SCHEMA. Ein geteilter FLOW mit P Produzenten und K Konsumenten behauptet P×K Verbindungen, von
denen die meisten im Code nicht existieren.

Bestand v258 (neu gezählt, `rig/flow-cardinality/measure.mjs` → `io02`):

| FLOW | Produzenten | Konsumenten | behauptete Paare |
|---|---|---|---|
| FLOW-mutate-cmd | 21 | 2 | 42 |
| FLOW-query-request | 10 | 14 | 133 |
| FLOW-skill-report | 6 | 1 | 6 |
| FLOW-formatE-artifact | 5 | 5 | 23 |
| FLOW-install-result | 3 | 1 | 3 |
| FLOW-steering-trigger | 3 | 1 | 3 |

(behauptete Paare ohne Selbstpaar; keiner der sechs FLOW hat FCHAIN-compose, testRefs oder andere Kanten
außer `relation → SCHEMA`.)

## Regel (Entscheidung Auftraggeber 2026-09-11)

- Je Verbindung Produzent → Konsument ein eigener FLOW mit **demselben SCHEMA** wie bisher
  (contracts IO-02 fix_hint: n FLOW → 1 SCHEMA ist legal).
- Eine echte Verteilung (EINE Quelle, mehrere Leser) bleibt EIN FLOW mit mehreren Konsumenten.
- Nur **belegte** Paare (I1): Code-Aufruf Datei:Zeile; bei Skills die Werkzeuge, die die Skill-Datei aufruft;
  ACTOR-agent als MCP-Client erreicht jedes registrierte Werkzeug (Registry-Zeile als Beleg), einschließlich
  der Kern-FUNC, an die der Werkzeug-Handler die Parameter unverändert weitergibt.
  Wird die Nutzlast unterwegs umgeformt (Format-E-Text → Commands), zählt nur der erste Empfänger.
- uid `FLOW-<kurzname>-<produzent-kurz>`, Name `<Name ohne Klammerzusatz> (<Produzent>)`; die bisherige
  Beschreibung wandert mit, ergänzt um die konkrete Verbindung. Alte FLOW werden gelöscht, alte uids nicht
  wiederverwendet.

## Paarliste mit Belegen

### FLOW-mutate-cmd → 21 FLOW (SCHEMA-mutate-command)

| neuer FLOW | Konsument(en) | Beleg |
|---|---|---|
| -agent | mutate, host-socket | `src/surface/write.ts:263` graph_mutate; `src/surface/host-shim.ts:176` Proxy-Session reicht über callHost an den Host-Socket |
| -owner | host-socket | graph-view-edit `vite.config.js:1254` (/api/mutate → callHost 'graph_mutate') |
| -author-req, -author-uc, -close-violations, -se-generate, -se-optimize, -se-top-level, -se-conops, -se-fmea, -se-irr, -se-plan, -se-trade | mutate | Skill-Datei ruft graph_mutate (`.claude/commands/…`) |
| -import-doc | mutate | `.claude/commands/se/import-doc.md:106` registry graph_mutate |
| -bootstrap | mutate | `src/surface/bootstrap.ts:140` |
| -gate-client | mutate | `src/loop/executor-gate.ts:166` |
| -graph-realize | mutate | `src/surface/write.ts:493` |
| -graph-suggest | mutate | `src/loop/suggest.ts:236` (dryRun) |
| -import-code-verb | mutate | `src/surface/import-code-verb.ts:190` (lokale Registry, `:135`) |
| -merge-nodes | mutate | `src/kernel/merge.ts:223` |
| -test-ingest | mutate | `src/projections/testreport.ts:142` |

Nicht belegt, nicht angelegt: owner → mutate (der Mensch schreibt nur über den Viewer und damit über den
Host-Socket); host-socket von allen 19 übrigen Produzenten (alle rufen in-process).

### FLOW-query-request → 10 FLOW (SCHEMA-query-params)

| neuer FLOW | Konsument(en) | Beleg |
|---|---|---|
| -agent | read-tools, list-elements, graph-impact, graph-expand, deduce-tests, resolve-tests-from-code, export-markdown | Registry `src/surface/read.ts:253/263` graph_elements→listElements, `:338/349` graph_impact→impact, `:392/402` graph_expand→subgraph; `src/projections/report.ts:384/398` graph_tests→testImpact; `src/projections/export.ts:161/251` graph_export→exportMarkdown |
| -owner | view-changelog, view-conops, view-fmea, view-icd, view-intplan, view-rtm, render-views, export-markdown, list-elements, graph-expand | Slash-Commands `.claude/commands/se-view/*.md`; `scripts/export-graph.mjs:73`; Viewer-Brücke `src/surface/host.ts:220` (/elements), `:261` (/subgraph) |
| -auto-export | export-markdown | `src/projections/auto-export.ts:92` graph_export → `export.ts:251` |
| -render-views, -view-changelog, -view-conops, -view-icd, -view-intplan, -view-rtm | export-markdown | Skill-Datei ruft allein graph_export (z. B. `se-view/arch.md` Schritt 1) |
| -view-fmea | read-tools, list-elements | `se-view/fmea.md` ruft graph_elements |

Nicht belegt, nicht angelegt (116 von 133 behaupteten Paaren):
- agent ↛ render-views, view-* (Skills sind Slash-Commands des Menschen; kein Werkzeug)
- owner ↛ read-tools, graph-impact, deduce-tests, resolve-tests-from-code (kein Weg ohne Agent)
- auto-export, render-views, view-changelog/-conops/-icd/-intplan/-rtm ↛ alles außer export-markdown
- view-fmea ↛ alles außer read-tools, list-elements

### FLOW-skill-report → 6 FLOW (SCHEMA-markdown-view)

-se-help, -se-retro, -se-review, -se-status, -test, -test-ui → owner. Beleg: die Skill-Antwort geht an den
Menschen (`se/help.md:16`, `se-retro.md:19`, `se-review.md:36`, `se-status.md:4`; se-test/se-test-ui liefern
das Testdesign als Antwort). Keine behaupteten Paare entfallen.

### FLOW-formatE-artifact → 2 FLOW (SCHEMA-format-e)

| neuer FLOW | Konsument | Beleg |
|---|---|---|
| -read-tools | agent | `src/surface/read.ts:269` (graph_elements format:formatE), `:321` (graph_get_edges), Slices von graph_impact/graph_expand |
| -agent | decode | `src/surface/write.ts:215` (graph_mutate formatE → decode) |

Nicht belegt, nicht angelegt (21 von 23):
- encode ↛ alle: encode liefert seinen Text an read-tools zurück (`read.ts:269`), read-tools war kein Konsument.
- import-code ↛ alle: der Skill ruft `graphcode import-code` und graph_reseed, kein Format-E.
- import-doc ↛ alle: der Skill schickt commands (`import-doc.md:106`), kein Format-E.
- agent ↛ mutate (die Nutzlast erreicht das Gate erst als Commands, das ist FLOW-mutate-cmd-agent), bootstrap, encode.
- read-tools ↛ bootstrap, decode, encode, mutate.
- bootstrap hat in `src/` keinen Aufrufer (nur Paket-Export `src/index.ts:49`).

### FLOW-install-result → 3 FLOW (SCHEMA-cli-command)

-collect-status (`src/cli.ts:202-205`), -harness-cli (`src/cli.ts:238-240`), -upgrade (`src/cli.ts:220-229`) → owner.

### FLOW-steering-trigger → 1 FLOW (SCHEMA-query-params)

-agent → take-steering-snapshot: `src/projections/report.ts:227` graph_next_step → `src/loop/steering.ts:67`;
`src/surface/write.ts:347` (graph_mutate dryRun).

Nicht belegt, nicht angelegt:
- owner ↛ take-steering-snapshot (der Mensch löst eine Runde über den Agenten oder `graphcode run` aus).
- run-verb ↛ take-steering-snapshot: `run-verb.ts:141` ruft graph_readiness, das über `evaluateAll`
  (`src/kernel/evaluation.ts:218` → computeReadiness) rechnet, nicht über takeSteeringSnapshot.

**Summe:** 6 FLOW gelöscht, 43 FLOW angelegt.

## Messplan

Vorher (v258) und nachher, am exportierten SSOT:
1. `graph_readiness`: errors, importCoverage, violationsByRule (RC-04, R-31, FC-04, IO-01, BW-02, CR-01 …).
2. IO-02 je FLOW über `io02()` aus `rig/flow-cardinality/measure.mjs`; Anzahl FLOW-Knoten.
3. `moduleCrossings` (contracts) byFunc/byModule je Rand, Differenz je Rand benannt; BW-02.
4. Sichtcheck im Viewer (Funktionsnetzwerk, Grounding offen, Statuszeile), Bilder
   `data/bilder-2026-09-10/cr510-vorher.png` / `cr510-nachher.png`.

## Akzeptanz

- [x] IO-02 für die sechs FLOW = 0; jeder Rest begründet.
- [x] byFunc/byModule steigen an keinem Rand; jedes Sinken ist je Rand benannt.
- [x] errors 0; jede Änderung eines Regelzählers in readiness erklärt.
- [x] Keine alte uid bleibt im Modell, in `src/` oder `tests/` referenziert.
- [ ] Volle Suite: nur die bekannte Grundlast rot.

---

## Umsetzung

Drei Batches über `graph_mutate` (je dryRun, dann mit baseVersion; consumerId `cr-gc-510`), erzeugt aus der
Paarliste oben. Der Generator bricht ab, wenn ein Paar außerhalb der alten P×K liegt oder eine uid schon existiert.
Alte uids werden nicht wiederverwendet: delete und add betreffen nie dieselbe uid.

| Batch | graphVersion | Inhalt | Kommandos |
|---|---|---|---|
| 1 | 258 → 259 | FLOW-mutate-cmd → 21 FLOW | 110 |
| 2 | 259 → 260 | FLOW-query-request → 10 FLOW | 82 |
| 3 | 260 → 261 | skill-report (6), formatE-artifact (2), install-result (3), steering-trigger (1) | 81 |

Danach `node scripts/export-graph.mjs` (SSOT + 15 Sichten). Code/Tests:
- `src/surface/scaffold.ts:81` Kommentar auf `FLOW-install-result-harness-cli`.
- `tests/arch.optimization-dry-run.spike.test.ts`: Plateau-Kette neu gepinnt (Messtest verlangt Neumessung), Kopfkommentar mit neuem Befund.

Namen: `<Name ohne Klammerzusatz> (<Produzent>)`. Der Klammerzusatz des alten Namens entfällt, sonst stünden zwei
Klammern hintereinander. Beschreibung: Kernsatz der alten Beschreibung plus konkrete Verbindung; die alten
Sammeltexte nannten alle Produzenten und gelten für die einzelne Verbindung nicht.

## Messung (v258 → v261)

**IO-02** (`io02()` aus `rig/flow-cardinality/measure.mjs` am exportierten SSOT): 6 → 0 Befunde.

| alter FLOW | IO-02 vorher | neue FLOW | IO-02 nachher |
|---|---|---|---|
| FLOW-mutate-cmd | 21 P | 21 | 0 |
| FLOW-query-request | 10 P | 10 | 0 |
| FLOW-skill-report | 6 P | 6 | 0 |
| FLOW-formatE-artifact | 5 P | 2 | 0 |
| FLOW-install-result | 3 P | 3 | 0 |
| FLOW-steering-trigger | 3 P | 1 | 0 |

**FLOW-Knoten:** 65 → 102 (−6, +43).

**moduleCrossings** (contracts `moduleCrossings`, verschiedene SCHEMA je Rand): an keinem Rand gestiegen.
Gesunken, jeweils um genau ein SCHEMA:
- byFunc: FUNC-block-abfrage 7→6, -autorieren 6→5, -gate 10→9, -gedaechtnis 7→6, -speicherwerk 11→10,
  FUNC-goal-steerer 15→14 (jeweils SCHEMA-format-e); FUNC-block-bedienung 9→8, -betrieb 11→10, -messwerk 10→9
  (jeweils SCHEMA-query-params); FUNC-block-grounding 19→17 (beide).
- byModule: MOD-agent-surface 8→7, MOD-kernel 18→17, MOD-projections 8→7, MOD-surface 12→11 (SCHEMA-format-e);
  MOD-kernel-measure 10→9 (SCHEMA-query-params).
- Ursache: Die Ränder hingen an Scheinpaaren. format-e an encode/import-code/import-doc → bootstrap/decode/mutate,
  query-params an owner/run-verb → take-steering-snapshot und an den nicht belegten Lese-Paaren.

**graph_readiness:**

| Größe | v258 | v261 | Erklärung |
|---|---|---|---|
| errors | 0 | 0 | |
| importCoverage | 88/89 | 88/89 | |
| RC-04 | 5 | 5 | |
| BW-02 | 16 | 16 | Breite sinkt an 10 Rändern (s. o.), keiner fällt unter die Schwelle 5 |
| CR-01 | 14 | 13 | ein Modulpaar-Befund weniger; Vertragszahlen je Modulpaar sinken (Paar nicht einzeln zugeordnet) |
| R-04 | 5 | 5 | Vertragszahl je Modul sinkt (s. byModule), Schwelle bleibt überschritten |
| R-31 | 12 | 15 | +FUNC-encode, +FUNC-import-code, +FUNC-run-verb: ihr einziger Ausgang war ein Scheinpaar |
| FC-04 | 3 | 4 | +FCHAIN-codec-roundtrip: der ACTOR-Ausgang lief nur über encode → Bus → agent |
| IO-01 | 3 | 8 | +graph-impact, +read-tools (FCHAIN-advisory-roundtrip), +mutate (FCHAIN-capture, FCHAIN-interface-escalation), +encode (FCHAIN-codec-roundtrip): die Kettenpfade liefen nur über die Busknoten |
| MT-02 | 5 | 5 | |
| PDR completeness | 37/40 | 36/40 | Ursache nicht einzeln geprüft |
| Dimension uc / arch | 0.978 / 0.982 | 0.974 / 0.980 | dieselben Warnungen |

**Sicht** (Viewer Port 43354, Funktionsnetzwerk, Grounding offen): 20 Knoten · 85 Kanten → **17 Knoten · 69 Kanten**.
Die drei Bus-Kästen (Query-Request, Mutate-Command, Format-E-Artefakt) auf der Grounding-Ebene sind weg; die
Verbindungen erscheinen als Port-Kanten zwischen Blöcken und Akteuren. Gegen die Erwartung ist die Sicht damit
schlanker, nicht voller. Bilder: `data/bilder-2026-09-10/cr510-vorher.png`, `cr510-nachher.png`
(+ Ausschnitte `cr510-messwerk-abfrage-*.png`).

## Bewusst offen

1. **Neun Warnungen legen fehlende echte Verbindungen offen** (R-31 +3, FC-04 +1, IO-01 +5). Die echten Wege
   liegen außerhalb der alten P×K und wurden nicht angelegt: encode liefert an read-tools zurück (`read.ts:269`),
   der Skill import-code ruft das Verb import-code (`cli.ts:136`), run-verb liefert an die CLI (`cli.ts:111`),
   decode → mutate im graph_mutate-Handler (`write.ts:215/356`). Das gehört in ein Folge-Item (Intervention I4, ITEM-2026-040).
2. **graph_suggest schlägt den Rückbau vor:** OP-MERGE bietet an, FLOW-formatE-artifact-read-tools in
   FLOW-formatE-artifact-agent zu verschmelzen, also zwei Produzenten wieder in einem FLOW. Das Gate lässt es
   durch, weil IO-02 nicht im Gate-Katalog (contracts 10.1.0) steht. Der Schnitt ist damit nicht geschützt.
3. **Paare über Werkzeug-Handler:** agent → list-elements, graph-impact, graph-expand, resolve-tests-from-code und
   owner → list-elements, graph-expand (Viewer-Brücke `host.ts`) sind über Registry bzw. Handler belegt. Streng im
   Code steht read-tools bzw. die Host-Brücke dazwischen. Bei I4 zu prüfen.
4. **Alte uids außerhalb src/tests** (historische Spikes, von keinem Test ausgeführt, nicht angepasst):
   `scripts/spike-archetype-eigenvector.mjs:322-329`, `scripts/spike-repository-style.mjs:30` (findet FLOW-mutate-cmd
   nicht mehr), `rig/flow-cardinality/repair.mjs`. Der eingefrorene Korpus `rig/graphs/` bleibt unverändert.
5. **Nebenwirkung aus dem Item:** IO-02 schweigt jetzt auch bei einem falschen Produzenten mit eigenem FLOW; der
   Nachweis muss vom Code kommen (I4).

## Tests

- `graph_tests({changeSet:[6 alte FLOW]})`: keine TEST-Knoten betroffen (FLOW tragen kein satisfy/verify), `unresolved` leer.
- `npm run type-check`: grün (Kommentar in `scaffold.ts`).
- `tests/arch.optimization-dry-run.spike.test.ts` neu gemessen: v261 grün mit neuem Pin
  (OP-MERGE FLOW-formatE-artifact-agent ← FLOW-formatE-artifact-read-tools, realisiert −0.0042).
  Gegenkontrolle im Worktree auf HEAD `ba7b831` (v258): alter Pin grün (FLOW-mutate-cmd ← FLOW-candidate-batch,
  realisiert −0.0299, passt zum alten Kommentar −0.03).
- Volle Suite `npx vitest run`: 131 Dateien grün, 5 rot (1082/1088 Tests). Die 5 roten sind die bekannte
  Grundlast: claims.conformance, perf.advisory-roundtrip.spike, steering.artifact-coupling,
  steering.process-ratchet, steering.
