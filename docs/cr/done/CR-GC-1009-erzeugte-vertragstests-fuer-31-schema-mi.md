# CR-GC-1009: Erzeugte Vertragstests fuer 31 SCHEMA mit Zod-Symbol

**Typ:** aus Item ITEM-2026-1595 (finding)
**Erstellt:** 2026-11-22
**Item:** bok/items/ITEM-2026-1595.json (Lane: graph)

---

31 SCHEMA mit Zod-Symbol hatten `verify` nur auf einen Test von Hand. Regel (FAQ `vertrag-ohne-refine-custom` Punkt 8, `schema-vertragstest-pflicht`): für ein SCHEMA mit Zod-Symbol gibt es den erzeugten Vertragstest. Vorgehen wie CR-GC-1007.

## Änderung

- `graphcode vertragstest` für die 31 SCHEMA (Exit 0, kein Abbruch, kein roter Fall): 31 Dateien unter `tests/vertrag/`, 2010 Fälle. Verworfen: 1 (`SCHEMA-mutate-result`: `violations[]: lehnt ab: context mit falschem Typ`).
- Modell in einem Batch: 31 TEST (`TEST-vertrag-<name>`) mit `testRefs` und `verify` auf das SCHEMA; CR-Knoten mit Kanten auf die 31 SCHEMA. Das Ergebnis je TEST schreibt `verify:code` über `graph_test_ingest`.
- Von Hand geändert: keine Quelldatei. Testdateien von Hand sind nicht gekürzt.

## Die alte `verify`-Kante vom Hand-TEST auf das SCHEMA

Jeder der Hand-TEST verifiziert außer dem SCHEMA mindestens eine REQ (1 bis 12). Nach FAQ `test-verify-ziel` (ein Vertragstest hängt am SCHEMA, ein Test einer Anforderung an der REQ) und `test-verifiziert-mehrere-req` (ein TEST darf n REQ verifizieren) bleibt die Kante: die Dateien bleiben unverändert und prüfen Verhalten; die Kante entfällt erst, wenn der Autor die Schema-Fälle dort streicht. Im Zweifel bleibt sie (Auftrag).

## Fälle in den Testdateien von Hand

Zählung je `it`/`test`: „nur Annahme/Ablehnung" heißt, der Fall ruft `Symbol.parse` oder `.safeParse` und keine andere Funktion aus `src/` oder den Paketen. Das ist eine Näherung per Skript, kein Urteil; die Kandidaten sind je Fall zu lesen, bevor sie gestrichen werden.

| Hand-Datei | SCHEMA-Symbole | Fälle | nur Annahme/Ablehnung (Kandidaten) | Verhalten (bleiben) | Beispiel Kandidat | Beispiel Verhalten |
|---|---|---|---|---|---|---|
| `tests/cli.scaffold.test.ts` | CliVerbSchema | 54 | 0 | 54 | - | init scaffolds the current MCP-stdio architecture (REQ-repo- |
| `tests/constraint-ein-schreibweg.test.ts` | EingangsBefund | 4 | 1 | 3 | Vertrag EingangsBefund (SCHEMA-eingangs-befund): nimmt jede  | am committeten Modell: nur die sieben erlaubten Eingänge, ke |
| `tests/constraint-grenze-adapter.test.ts` | AdapterBefund, GrenzBefund | 15 | 2 | 13 | Vertrag GrenzBefund: nimmt jede Form an, lehnt fremde Felder | guter Snapshot: jeder Grenzfluss trägt ein Schema der Liste |
| `tests/contract.live-event.test.ts` | LiveUpdateEventSchema | 5 | 4 | 1 | accepts a well-formed invalidate event | a real mutation emits an event that round-trips through Live |
| `tests/contracts.kernel.test.ts` | GraphDeltaSchema, OntologyJsonSchema | 6 | 3 | 3 | ein vertragstreues Delta landet auf der Platte | ein formfremdes Delta wird vor dem ersten Schreibzug abgewie |
| `tests/contracts.surface.test.ts` | AuditStatsSchema, MutateResultSchema | 5 | 2 | 3 | angewandt, geblockt und dryRun: jede Verdict-Variante des Ga | die ECHTE audit_stats-Antwort nach einem angewandten und ein |
| `tests/exporter.test.ts` | MarkdownViewSchema | 51 | 2 | 49 | the foundation views mirror FLOW-export-request (architectur | ROUND-TRIP: exportGraphJson of the in-memory SSOT is byte-id |
| `tests/flow-contracts.test.ts` | ExportPending | 9 | 0 | 9 | - | die erste Mutation setzt since und einen Rückstand von 1 |
| `tests/gate.urteilt-und-speichert.test.ts` | ZugBericht | 9 | 0 | 9 | - | die Antwort des Gates traegt keinen der drei Berichte mehr |
| `tests/gve-supervision.test.ts` | SessionEntrySchema | 11 | 0 | 11 | - | startet den Viewer, wenn keiner dieses Repo bedient |
| `tests/harness.import-rejected-traces.test.ts` | RejectedTraceSchema | 5 | 0 | 5 | - | lädt den Graphen, hält die musterfremde Kante aus dem Store  |
| `tests/host.bridge.test.ts` | HealthPayloadSchema | 5 | 2 | 3 | (a2) die /health-Antwort erfuellt SCHEMA-health-report | (a) GET /health returns 200 with a real payload (store/gate  |
| `tests/knowledge-binding.test.ts` | CliVerbSchema | 16 | 0 | 16 | - | init mit Schluessel schreibt Hook, beide Eintraege und instr |
| `tests/metrics.test.ts` | ChainMetrics | 26 | 0 | 26 | - | liefert eine Zeile je MOD — auch fuer das Modul, ueber das k |
| `tests/mutate.schema-guard.test.ts` | SteeringSnapshotSchema | 16 | 0 | 16 | - | gate BLOCKS a malformed command with SCHEMA-01 + fixHint, no |
| `tests/schema-guard.test.ts` | SchemaFingerprintSchema, StoreRebuildNoticeSchema | 12 | 1 | 11 | lehnt einen formfremden Fingerabdruck und eine leere Quelle  | is deterministic for the same descriptor |
| `tests/schema-parse-at-interface.test.ts` | FitAdvisory, GenerationStep, SteeringDelta | 9 | 9 | 0 | vertragstreues Advisory kommt als Daten durch | - |
| `tests/se-plan.groups.test.ts` | CrGroupsSchema | 12 | 0 | 12 | - | trennt gemeinsame Datei und Abhaengigkeit, buendelt den Rest |
| `tests/store-lock.test.ts` | LockOwner | 21 | 0 | 21 | - | refuses a second owner while the first is held (loud, not si |
| `tests/target-profile.test.ts` | TargetProfileSchema | 11 | 4 | 7 | akzeptiert ein Profil mit Themen | fehlende Datei → null (kein Profil ist gültig) |
| `tests/test-schlupf.test.ts` | LaufUrteilSchema, SchlupfZeileSchema, VitestLaufSchema | 16 | 0 | 16 | - | ein roter Test ausserhalb der Auswahl ist Schlupf, getrennt  |
| `tests/test-selection.audit.test.ts` | CodeLanePlanSchema, TestImpactResultSchema | 28 | 1 | 27 | FLOW-impacted-tests: eine Auswahl ohne testIds passiert den  | erreicht vom geänderten MOD über allocate → satisfy → verify |
| `tests/verlauf.test.ts` | VerlaufSchema | 6 | 0 | 6 | - | drei Staende: je Stand Marken, Befunde je Stufe, Tests; der  |

## Messung

Zahlen stehen im Abschlussbericht dieses CR (Dateien, Fälle, `verworfen`, SCHEMA ohne erzeugten Test, Regeln, Zeilen).

## Entscheidungen

| Frage | Festlegung | Begründung |
|---|---|---|
| Entfällt die alte `verify`-Kante vom Hand-TEST? | Nein, sie bleibt. | Jeder Hand-TEST verifiziert weitere REQ, die Dateien bleiben ungekürzt; im Zweifel bleibt sie. |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1528, Tiefe 1, Wurzeln: `SCHEMA-adapter-befund`, `SCHEMA-audit-stats`, `SCHEMA-chain-metrics`, `SCHEMA-cli-command`, `SCHEMA-code-lane-plan`, `SCHEMA-cr-groups`, `SCHEMA-eingangs-befund`, `SCHEMA-export-pending`, `SCHEMA-fit-advisory`, `SCHEMA-generation-step`, `SCHEMA-graph-delta`, `SCHEMA-grenz-befund`, `SCHEMA-health-report`, `SCHEMA-impacted-tests`, `SCHEMA-lauf-urteil`, `SCHEMA-lock-owner`, `SCHEMA-markdown-view`, `SCHEMA-mutate-result`, `SCHEMA-ontology-json`, `SCHEMA-rejected-trace`, `SCHEMA-schema-fingerprint`, `SCHEMA-schlupf-zeile`, `SCHEMA-session-registry`, `SCHEMA-steering-delta`, `SCHEMA-steering-snapshot`, `SCHEMA-store-rebuild-notice`, `SCHEMA-target-profile`, `SCHEMA-update-event`, `SCHEMA-verlauf`, `SCHEMA-vitest-lauf`, `SCHEMA-zug-bericht`._

Reichweite: 76 Elemente (FLOW 76); Blackbox-Rand 51, nicht geoeffnet.

Dateien (realRef, 27):
- packages/contracts/src/harness/index.ts
- packages/contracts/src/se/chain-metrics.ts
- src/kernel/export-pending-contract.ts
- src/kernel/graph-store.ts
- src/kernel/harness-import.ts
- src/kernel/hooks.ts
- src/kernel/lock-owner-contract.ts
- src/kernel/measure/constraints.ts
- src/kernel/measure/fit-advisory.ts
- src/kernel/measure/steering-snapshot.ts
- src/kernel/measure/test-selection.ts
- src/kernel/measure/zug-bericht.ts
- src/kernel/schema-fingerprint-contract.ts
- src/kernel/store-rebuild-notice.ts
- src/loop/generate.ts
- src/loop/se-plan.ts
- src/loop/target-profile-contract.ts
- src/projections/exporter.ts
- src/projections/test-schlupf.ts
- src/projections/verlauf.ts
- src/surface/audit-stats.ts
- src/surface/cli-args.ts
- src/surface/gve-session-contract.ts
- src/surface/health.ts
- src/surface/host-shim.ts
- src/surface/host.ts
- src/surface/mcp-server.ts

Tests (`graph_tests`, 23):
- tests/cli.scaffold.test.ts
- tests/constraint-ein-schreibweg.test.ts
- tests/constraint-grenze-adapter.test.ts
- tests/contract.live-event.test.ts
- tests/contracts.kernel.test.ts
- tests/contracts.surface.test.ts
- tests/exporter.test.ts
- tests/flow-contracts.test.ts
- tests/gate.urteilt-und-speichert.test.ts
- tests/gve-supervision.test.ts
- tests/harness.import-rejected-traces.test.ts
- tests/host.bridge.test.ts
- tests/knowledge-binding.test.ts
- tests/metrics.test.ts
- tests/mutate.schema-guard.test.ts
- tests/schema-guard.test.ts
- tests/schema-parse-at-interface.test.ts
- tests/se-plan.groups.test.ts
- tests/store-lock.test.ts
- tests/target-profile.test.ts
- tests/test-schlupf.test.ts
- tests/test-selection.audit.test.ts
- tests/verlauf.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
