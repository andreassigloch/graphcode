# CR-GC-719: Zusage Blackbox-/Schnittstellentests 100 % gebunden ist verfehlt: Blackbox 82/95 (13 TESTs ohne testRefs, u. a. TEST-cache, TEST-no-direct-graph-write, TEST-interface-schema), realisierte Vertraege mit gebundenem TEST 9/42 (verify:full CR-GC-718)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-668 (finding)
**Erstellt:** 2026-09-30
**Item:** bok/items/ITEM-2026-668.json (Lane: graph)

---

## Ergebnis

| Kennzahl (`blackboxBindung`, committeter Snapshot) | vorher | nachher |
|---|---|---|
| Blackbox-TESTs mit Laufadresse | 82/95 | **85/94** |
| realisierte Verträge mit gebundenem verify-TEST | 9/42 | **33/42** |

Die Zusage (100 %) ist **nicht** erreicht. Die 18 offenen Punkte sind unten je einzeln mit Grund
benannt: Verhalten nicht realisiert, Benchmark nicht gebaut, oder Vertrag eines Fremdpakets, den
graphcode an seiner Grenze nicht selbst parst. Keiner davon ist durch eine Gefälligkeitsbindung
geschlossen worden.

Blackbox-Nenner 95 → 94: zwei Konzept-TESTs sind entfallen (s. u., R-29), einer der
übernehmenden TESTs zählt neu als Blackbox-TEST.

## Befund

- 13 Blackbox-TESTs waren `concept:true` ohne `testRefs`. Für 4 gab es eine prüfende Datei bzw.
  realisiertes Verhalten, für 9 nicht.
- 33 realisierte Verträge hatten keinen gebundenen verify-TEST. 19 davon **hatten** Vertragstests
  (Gut- und Abweisungsfall), nur fehlte die `verify`-Kante oder der TEST-Knoten
  (`tests/flow-contracts.test.ts`, `tests/schema-parse-at-interface.test.ts` hatten gar keinen).
- R-29 (eine Testdatei gehört genau einem TEST) verbietet, eine schon gebundene Datei einem zweiten
  Konzept-TEST zuzuschlagen. Wo die Datei schon einem TEST gehörte, verifiziert jetzt **dieser** TEST
  die REQ, und der Konzept-Zwilling ist gelöscht (TEST-no-direct-graph-write, TEST-interface-schema).

## Zuordnung je Punkt

### Blackbox-TESTs

| TEST | Ergebnis | Beleg |
|---|---|---|
| TEST-no-direct-graph-write | REQ-gate-only-writes jetzt verifiziert von TEST-single-write-door + TEST-export-graph-guard; Konzept-TEST gelöscht (R-29) | `tests/gate.single-door.test.ts:126` (Hook verweigert Write auf SSOT), `:54`/`:99` (graph_mutate landet / gate-validiert), `tests/export-graph-guard.test.ts:82` (hand-editiertes JSON abgewiesen) |
| TEST-interface-schema | REQ-interface-schema jetzt verifiziert von TEST-readiness-completeness; Konzept-TEST gelöscht (R-29) | `tests/readiness.completeness.test.ts:124` (FLOW ohne SCHEMA hält CDR rot, `:136`) |
| TEST-hooks | gebunden, **neuer Test** | `tests/hooks.extension-points.test.ts:33` (drei Phasen), `:48` (Reihenfolge), `:66`/`:131` (Timeout als Block, auch am Gate), `:88` (Default 5000 ms), `:117` (pre-commit blockt am echten Gate) |
| TEST-reduced-llm | gebunden, **neuer Test** | `tests/gate.modelfree.test.ts:85` (0 Netz-Aufrufe), `:93` (deterministisch), `:103` (nur Executor degradiert) |
| TEST-cache | Lücke | `ResponseCache` (`src/surface/emit.ts:130`) hat keinen Aufrufer; Cache-Layering/Prefix-Hygiene nicht realisiert |
| TEST-capture | Lücke | Beschreibung sagt „suggest-Tier, kein auto-apply“; `src/kernel/gate.ts:203` wendet warnungsfreie Batches mit `tier:'auto-apply'` an, auch `suggest` persistiert. Review-vor-Persist gibt es nur als opt-in dryRun |
| TEST-code-quality | Lücke | Abnahme „vs classic“ braucht REQ-benchmark-harness — nicht gebaut |
| TEST-docs-taxonomy | Lücke | „records durable“ ist im Repo nicht prüfbar: `docs/records/` steht in `.gitignore` (seit dem Public-Split lokal) |
| TEST-greenfield-systemtest | Lücke | Abnahmeläufe mit zwei LLMs je 3× — kein vitest-Artefakt; die Rig-Tests prüfen das Rig, nicht das Ergebnis |
| TEST-interface-escalation | Lücke | kein Mechanismus unterscheidet Realisierungs- von Facilitating-Agent; ein direkter FLOW-Zug geht durchs Gate |
| TEST-responsiveness | Lücke | keine absolute < 0,2 s-Assertion; TEST-advisory-roundtrip-latency prüft bewusst nur die Skalierung |
| TEST-store-recovery | Lücke | Lock-Konflikt/toter Owner/korrupter Lock sind realisiert (TEST-store-lock), Recovery eines korrupten Kuzu-Stores nicht |
| TEST-token-efficiency | Lücke | Token-Vergleich gegen grep-Lauf braucht REQ-benchmark-harness — nicht gebaut |

### Verträge

| SCHEMA | Ergebnis | Beleg (gut / Abweisung) |
|---|---|---|
| audit-stats | **neuer Test** TEST-contracts-surface | `tests/contracts.surface.test.ts:64` / `:74`, `:80` |
| mutate-result (ext) | **neuer Test** TEST-contracts-surface (graphcode als Erzeuger) | `tests/contracts.surface.test.ts:87` / `:101` |
| graph-delta | **neuer Test** TEST-contracts-kernel | `tests/contracts.kernel.test.ts:66` / `:76`, `:83` |
| ontology-json | **neuer Test** TEST-contracts-kernel | `tests/contracts.kernel.test.ts:116` / `:123`, `:131` |
| phase-readiness | **neuer Test** TEST-contracts-kernel | `tests/contracts.kernel.test.ts:161` / `:169` |
| model-answer | neuer TEST-Knoten TEST-flow-contracts | `tests/flow-contracts.test.ts:58` / `:109` |
| export-pending | TEST-flow-contracts | `tests/flow-contracts.test.ts:164` / `:212` |
| fit-advisory | neuer TEST-Knoten TEST-schema-parse-at-interface | `tests/schema-parse-at-interface.test.ts:63` / `:68`, `:78` |
| steering-delta | TEST-schema-parse-at-interface | `tests/schema-parse-at-interface.test.ts:87` / `:94` |
| generation-step | TEST-schema-parse-at-interface | `tests/schema-parse-at-interface.test.ts:157` / `:166`, `:181` |
| impacted-tests | verify von TEST-selective-test-audit | `tests/test-selection.audit.test.ts:232` / `:241` |
| test-selection | verify von TEST-selective-test-audit | `tests/test-selection.audit.test.ts:248` / `:258` |
| target-profile | verify von TEST-target-profile | `tests/target-profile.test.ts:30` / `:43`, `:48` |
| cli-command (ext) | verify von TEST-cli-scaffold (graphcode definiert und parst ihn) | `tests/cli.scaffold.test.ts:657` (Optionen + `parse('mcp')` wirft) |
| markdown-view (ext) | verify von TEST-doc-export (graphcode definiert und parst ihn) | `tests/exporter.test.ts:198` / `:162` |
| mutate-command (ext) | verify von TEST-mutate-schema-guard (Gate parst jedes Kommando) | `tests/mutate.schema-guard.test.ts:106` / `:64` |
| steering-snapshot | verify von TEST-mutate-schema-guard | `tests/mutate.schema-guard.test.ts:248` (Altbestand → unmessbar; nach Migration messbar) |
| update-event (ext) | verify von TEST-live-event-contract (Emitter) | `tests/contract.live-event.test.ts:26`, `:73` / `:32`–`:42` |
| health-report | verify von TEST-readonly-bridge | `tests/host.bridge.test.ts:95` / `:101` |
| lock-owner | verify von TEST-store-lock | `tests/store-lock.test.ts:43` / `:238`, `:248`, `:257`, `:266` |
| schema-fingerprint | verify von TEST-schema-migration | `tests/schema-guard.test.ts:68` / `:86` |
| session-registry | verify von TEST-gve-supervision | `tests/gve-supervision.test.ts:133` / `:171` |
| format-e (ext) | verify von TEST-mutate-input-formate (Übersetzer parst an der Grenze) | `tests/mcp.mutate-input.test.ts:79` / `:121` |
| metric-policy (ext) | verify von TEST-thresholds-from-config (Config-Lader parst) | `tests/config.test.ts:114` / `:144`, `:155` |
| completeness (ext) | Lücke | graphcode importiert `GateCompleteness` nur als Typ |
| function-criticality (ext) | Lücke | nur Typ-Import (`src/projections/metrics.ts`) |
| impact-slice (ext) | Lücke | graphcode referenziert `ImpactSliceSchema` nicht |
| metric-vector (ext) | Lücke | nur Typ-Import aus se-engine |
| module-metrics (ext) | Lücke | nur Typ-Import |
| ontology-graph (ext) | Lücke | geparst nur geschachtelt im SteeringSnapshot, nicht an FLOW-graph-state/-element-slice/-imported-graph |
| readiness-report (ext) | Lücke | dito, nur geschachtelt im SteeringSnapshot |
| rule-violation (ext) | Lücke | dito, nur geschachtelt im SteeringSnapshot |
| trajectory (ext) | Lücke | learning-core-Vertrag, graphcode parst ihn nicht |

Für die neun ext-Lücken gehört der Vertragstest ins Fremdpaket (contracts, graph-api-core,
se-engine, learning-core) bzw. an einen Parse an graphcodes Grenze — das ist eine Folge-CR, kein Test hier.

## Red-first

Parse jeweils entfernt, Testdatei gefahren, Parse wiederhergestellt:
`GraphDeltaSchema.parse` in `GraphStore.commit` → `contracts.kernel:76` rot;
`OntologyJsonSchema.parse` in `importOntologyGraph`/`heldBackTraces` → `:123`, `:131` rot;
`AuditStatsSchema.parse` in `aggregateAuditEntries` → `contracts.surface:74` rot;
sequentielle Hook-Ausführung und fail-closed in `HookSystem` → `hooks.extension-points:48`, `:75` rot.
phase-readiness und mutate-result prüfen die Unterscheidungskraft des Schemas selbst (Abweisung
formfremder Zeilen/Verdicts); `gate.modelfree:103` ist die Positivkontrolle der Netz-Stolperfalle
(genau ein Aufruf, vom Executor).

## Nebenwirkungen

- `tests/mcp.tests-operational.test.ts` (g): Zeuge für „Konzept-TEST erscheint unter unresolved“
  ist jetzt TEST-docs-taxonomy statt des gelöschten TEST-interface-schema.
- `tests/test-selection.audit.test.ts`: `src/loop/format-e-commands.ts` wählt jetzt zusätzlich
  `tests/mcp.mutate-input.test.ts` — der Vertragstest des Formats, das der Übersetzer parst.
- `scripts/model-test-set.mjs`: `tests/contracts.kernel.test.ts` begründet ausgeschlossen
  (nennt `docs/graph/` nur als Temp-Pfad).

## Testnachweis

- `npm run build`, `npm run type-check` grün.
- `npm run verify:full CR-GC-719`, erster Lauf: 3 rot, alle drei **Schlupf** (außerhalb der
  CODE-Auswahl 4/199) — die drei Modell-abhängigen Tests oben, rot durch den Modell-Zug dieses CR.
  Zweiter Lauf nach den Anpassungen: 199/199 Dateien, 1761 Tests grün, Spur CODE, Auswahl 6/199,
  Schlupf 0, Folge ohne Schlupf 1/10. Beide Zeilen stehen in `docs/messung/testauswahl.jsonl`.
