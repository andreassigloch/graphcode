# CR-GC-814: Modell: Recall falsch verdrahtet (seedFromJson an GraphStore statt applyReseed), sieben Wirkketten ohne Ausloeser

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-965 (bug)
**Erstellt:** 2026-10-16
**Item:** bok/items/ITEM-2026-965.json (Lane: graph)

---

## Befund (2026-10-16, aus GVE CR-GVE-368)

Der Kettenfokus in GVE soll nur zeigen, was zum Ausführen des Tasks nötig ist (Auftraggeber). GVE leitet das aus den
io-Flüssen der Kette ab; zwei Modellfehler machen das Bild falsch:

1. **Recall falsch verdrahtet.** Modell: `FUNC-graph-store -> FLOW-graph-state -> FUNC-seed-from-json`,
   `seedFromJson -> FLOW-ontology-json -> importGraph / heldBackTraces`, `importGraph -> GraphStore`; daneben
   `applyReseed -> FLOW-reseeded-graph -> GraphStore`. Im Bild entsteht eine Schleife GraphStore → seedFromJson →
   importGraph → GraphStore neben dem Hauptpfad. Code: `applyReseed` ruft `seedFromJsonFile`, das
   `importOntologyGraph` ruft (`src/kernel/harness-import.ts:227-250`). Richtig ist der Ablauf
   rewind → reseed → applyReseed → seedFromJson → importGraph → GraphStore.
2. **Sieben Wirkketten ohne Auslöser** — sie beginnen am Store statt an einem Akteur bzw. einem auslösenden Fluss:
   merge-branches, dashboard-metrics, snapshot-freshness, loop-closure, impact-testing, interface-escalation,
   generation-states (Messung GVE 2026-10-16 am Live-Modell). Ohne Quelle hat die Kette keinen Anfang.

3. **Sackgassen im Kettenfokus** (GVE CR-GVE-368, live 2026-10-16: Glieder, die keine Senke erreichen): Apply-Gate
   metrics, createHarness, computeFitAdvisory, ownKuzu, createToolContext, zugBericht; Bestand einlesen CLI-Dispatch,
   createHarness, graph_mutate, executeImportCode; Skill berichtet conformanceViolations, computeReadiness,
   computeMarks; Advisory Roundtrip graph_impact, bindReadTools; Repo-Lebenszyklus liveSessions, attachGve;
   Steuerungsschleife computeSteeringDelta; Recall heldBackTraces. Je Glied klären: fehlt der Ausgang im Modell
   (Code-Beleg) oder gehört das Glied nicht in die Kette (compose entfernen).

## Zielbild

- Recall: `applyReseed` liefert an `seedFromJson` (Fluss neu benennen, z. B. reseed-snapshot-path, oder den
  bestehenden verwenden); `FLOW-graph-state -> seedFromJson` nur, wenn es im Code einen solchen Lesezugriff gibt —
  sonst löschen. Wo `seedFromJson` außerhalb von Recall läuft (Boot `mcp-server.ts:111`, `import-code-verb.ts:126`),
  gehört es in die Kette, die den Boot beschreibt, nicht in Recall.
- Je Kette ohne Auslöser: den tatsächlichen Auslöser aus dem Code bestimmen (Akteur, CLI-/MCP-Aufruf, Timer, Hook)
  und als Quelle modellieren; ist keiner da, im CR benennen.
- Abstimmung mit **CR-GC-813** (Veranlasser statt Aufrufer, Agent-Ablaufsteuerung als FUNC): dieselbe Grundfrage
  „welcher Fluss existiert im Code". Erst nach dem Modellzug von 813 beginnen.

## Abnahme

- Jede geänderte Kante mit Code-Beleg (Datei:Zeile) im CR.
- GVE-Fokus Recall: kein Kreis über GraphStore; die sieben Ketten haben eine Quelle (Akteur oder Fluss von außen).
- `rules_evaluate` ohne neue Errors; `npm run verify:model` grün.

---

## Umfang laut `graph_impact`

- `graph_impact` auf FUNC-seed-from-json, FUNC-import, FUNC-apply-reseed, FUNC-graph-store und die sieben FCHAIN
  vor dem Zug. Nur Modell (`docs/graph`, `docs/views`) + CR-Dokument.

## Umsetzung (2026-10-16, v774 → v775)

Ein Batch durchs Gate, ohne Fehler. Je Kante der Code-Beleg:

**1. Recall** — jetzt geradlinig: CLI → rewind → reseed → applyReseed → seedFromJson → importGraph → GraphStore.

| Kante | Beleg |
|---|---|
| `− graph-state → seedFromJson` | `seedFromJsonFile` liest die Datei, nicht den Store (`src/kernel/harness-import.ts:232`) |
| `+ graph-snapshot-file → seedFromJson` | ebd., `readFile(abs)` |
| `reseeded-graph`: Abnehmer GraphStore → seedFromJson, Vertrag ontology-graph → ontology-json | `applyReseed` leert den Store und ruft `seedFromJsonFile(target, relPath)` (`harness-import.ts:240-241`); das Leeren ist ein Befehl, kein Datenfluss |
| `− ontology-json → heldBackTraces`, `+ graph-snapshot-file → heldBackTraces`, `+ graph-state → heldBackTraces` | `heldBackTraces` liest die committete Datei selbst und bekommt den Live-Graphen (`harness-import.ts:205-208`) |
| `− recall ∋ heldBackTraces` | Aufrufer sind `graph_export` und `graph_readiness`, nicht der Recall-Pfad |
| `+ repo-lifecycle ∋ seedFromJson, importGraph` | Seed beim Start: `src/surface/mcp-server.ts:111`, `src/surface/import-code-verb.ts:126` |

**2. Ketten ohne Auslöser** — nach CR-GC-813/815 hatten sechs der sieben bereits eine Quelle (Ablaufsteuerung, Auftraggeber,
Regelhalter). Offen war `merge-branches`:

| Kante | Beleg |
|---|---|
| `+ Ablaufsteuerung → branch-log → replayBranchLog` | MCP-Werkzeug `graph_merge` liest das Branch-Log und ruft `replayBranchLog` (`src/surface/write.ts:443-465`) |
| `+ replayBranchLog → merge-report → Ablaufsteuerung`, `SCHEMA-branch-merge-report` (verify: TEST-merge) | `MergeReport` (`src/kernel/merge.ts:48`) |
| `+ merge-branches ∋ Ablaufsteuerung` | Auslöser der Kette |

**3. Sackgassen** (Stand nach 813/815, eigene Auswertung entlang der io-Flüsse zur Senke):

| Kette · Glied | Zug | Beleg |
|---|---|---|
| advisory-roundtrip · graph_impact, bindReadTools | `+ ∋ Ablaufsteuerung` | Lesewerkzeuge antworten der Ablaufsteuerung |
| apply-gate · computeFitAdvisory, archFitness, zugBericht | `+ ∋ Ablaufsteuerung` | Berichte zum Zug gehen an den Aufrufer (CR-GC-778) |
| apply-gate · createHarness, ownKuzu, createToolContext | `− compose` | Aufbau, kein Schritt des Schreibablaufs (pre-commit → apply → evaluate → save → emit) |
| model-import · CLI-Dispatch, createHarness, graph_mutate, executeImportCode | `+ ∋ formatEToCommands` | graph_mutate → Decoder → Gate |
| skill-report · conformance, computeReadiness, completeness | `+ ∋ graph_readiness` | Skills lesen über das Werkzeug (CR-GC-813) |
| steering-loop · computeSteeringDelta | `steering-delta`: Abnehmer bindTools → graph_mutate; `+ gate-verdict → graph_mutate`; `+ graph_mutate → mutate-answer → Ablaufsteuerung`; `+ ∋ graph_mutate` | einziger Aufruf `src/surface/write.ts:400`; Antwort `write.ts:388-410` |
| repo-lifecycle · liveSessions, attachGve | `+ attachGve → viewer-start → Browser-Dashboard` | `src/surface/gve.ts:163` |
| recall · heldBackTraces | `− compose` | s. Teil 1 |

## Benannte Abweichungen

- R-21 `claim-store-lock → own-kuzu-host`: Übergabe beim Start, außerhalb des Schreibablaufs; beide nicht mehr in
  einer gemeinsamen Kette.
- R-21 `graph_export → seedFromJson`: Übergabe über die committete Datei, bewusst zeitversetzt.
- Steuerungsmaß 5,0 → 5,25 (BW-02 Grounding 24 → 25): neue, im Code belegte Verträge an der Blockgrenze.
- `SCHEMA-branch-merge-report` als Konzept ohne realRef (R-26): `MergeReport` ist ein TS-Interface, kein Zod-Schema
  (RC-08 verlangt Zod) — Zod-Schema als eigenes Item (ITEM-2026-973).
- Außerhalb des Befunds, nicht angefasst: `codec-roundtrip` (ein Glied, ohne Senke), `schema-migration`
  (`migrate-schema` ohne Code-Bindung).

Volllauf: 1 rot (`tests/arch.optimization-dry-run.spike.test.ts`, hält die Autopilot-Züge fest) — neu gemessen:
ein Zug statt drei, Engpass nach der Kette BW-02 @ Grounding statt R-04 @ MOD-kernel. Kein Schlupf.
