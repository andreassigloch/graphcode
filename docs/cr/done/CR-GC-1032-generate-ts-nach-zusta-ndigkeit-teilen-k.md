# CR-GC-1032: generate.ts nach Zuständigkeit teilen: Klauseln/Vorlagen, stepCore, generationStep — je Datei unter 500 Zeilen (Heatmap: MOD-loop 34 % Fixes)

**Typ:** aus Item ITEM-2026-1683 (idea)
**Erstellt:** 2026-11-25
**Item:** bok/items/ITEM-2026-1683.json (Lane: graph)

---

## Ziel

`src/loop/generate.ts` hatte 988 Zeilen bei einer Grenze von 500. Die Änderungs-Heatmap (CR-GC-1029) zeigt die Datei mit 85 Änderungen und 26 Fixes in 6 Monaten. `MOD-loop` hat 34 % Fixes und 27 % Nacharbeit. Von 22 Fix-Commits an der Datei änderten etwa 7 nur Text, etwa 9 nur Logik und 6 beides.

Der CR teilt die Datei nach Zuständigkeit. Verhalten, Texte und Modell bleiben gleich.

## Zug

| Datei | Inhalt | Zeilen |
|---|---|---|
| `src/loop/generate.ts` | Vertrag `GenerationStep`, `GenerationRequestSchema`, Einstieg `generationStep`, `steerState` | 160 |
| `src/loop/generate-step-core.ts` (neu) | `stepCore`, Kaltstart-Stufen (`SEED_STAGES`, `SEED_RULE`), `stufenRang`, `stufenName` | 475 |
| `src/loop/generate-klauseln.ts` (neu) | Gate-Protokoll, `RULE_CLAUSE` mit Skeletten, Vorlagen je Stufe, `STAGE_FOCUS_TYPES`, Skill-Zeiger (`SKILL_FOR_STAGE`, `TASK_SKILL`, `analyseSkill`), `handoffPrompt`, `steuerVermerk` | 389 |

Der Code ist wörtlich verschoben. Neu sind nur die Exporte `GATE_PROTOCOL`, `TASK_OF_ENTRY` und `stepCore`, die vorher dateiintern waren. Jeder Aufrufer importiert direkt aus dem neuen Modul; `generate.ts` leitet nichts weiter.

Abhängigkeit: `generate.ts → generate-step-core.ts → generate-klauseln.ts`. `GenerationStep` kommt als reiner Typimport zurück.

## Dateien (19, Grenze 10 überschritten)

**Design (7):** die drei Dateien oben, diese Datei und drei Tests, die Quelltext lesen. Sie lesen jetzt alle drei Dateien, sonst prüften sie nach dem Schnitt weniger:
- `tests/intent-anchors-internal.test.ts`: Steuerungsvokabular in Prompt-Literalen;
- `tests/decision-texts.test.ts`: kein Text widerspricht dem Register;
- `tests/channel-rank.test.ts`: die Vorrangordnung kommt aus `channel-rank.ts`, jetzt in `generate-step-core.ts` geprüft.

**Fan-out (12), mechanisch:** eine Importzeile je Datei.
- `src/projections/report.ts` (`stufenRang`);
- `scripts/regel-matrix.mjs` (nur zwei Kommentare);
- 10 Tests: `generate.test.ts`, `generate.stufen.test.ts`, `generate.task.test.ts`, `mcp.mutate-next-step.test.ts`, `steering.process-ratchet.test.ts`, `steering.artifact-coupling.test.ts`, `skill-rule-ids.test.ts`, `steer-optimum.test.ts`, `skill-kinds-werte.test.ts`, `focus-set.test.ts`.

Begründung (FAQ `cr-dateigrenze-ausnahme`): Ein Teil-CR ohne die Importe ließe die Tests rot. Eine Weiterleitung aus `generate.ts` wäre ein zweiter Weg zu denselben Symbolen.

## Abnahme

- `npm run type-check`: 0 Fehler.
- `npm run verify:code`: 123 von 123 Testdateien grün; Bindung 4 von 4 Quelldateien.
- Gegenprobe: `generate.ts` importiert `channel-rank.js` nicht mehr. Der alte Pfad im Test `channel-rank.test.ts` wäre damit rot.
- Smoke: Host mit neuem Build neu gestartet; `graph_generate` liefert einen `expand`-Schritt (Stufe Anforderung).
- Volllauf entfällt: `verify:full` meldete bei CR-GC-1029 32 CRs der CODE-Spur ohne Schlupf (Grenze 10).

## Offen und benannt

- Die Datei mit den Klauseln trägt weiter Text als Code. Ob Prompt-Text als Daten mit LLM-Testfällen lohnt, zeigt die Heatmap nach einigen Wochen. Steigt dann `generate-klauseln.ts` an die Spitze, folgt ein eigener CR.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| keine | | |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1632, Tiefe 1, Wurzeln: `FUNC-generation-step`._

Reichweite: 4 Elemente (FLOW 2, FUNC 2); Blackbox-Rand 3, nicht geoeffnet.

Dateien (realRef, 1):
- src/loop/generate.ts

Tests (`graph_tests`, 9):
- tests/generate.statemachine.test.ts
- tests/generate.stufen.test.ts
- tests/mutate.schema-guard.test.ts
- tests/schema-parse-at-interface.test.ts
- tests/task-analysen.test.ts
- tests/vertrag/SCHEMA-generation-request.vertrag.test.ts
- tests/vertrag/SCHEMA-generation-step.vertrag.test.ts
- tests/vertrag/SCHEMA-ontology-graph.vertrag.test.ts
- tests/vertrag/SCHEMA-steering-snapshot.vertrag.test.ts

TEST ohne Bindung (keine testRefs, laeuft in keiner Auswahl): TEST-loop-round-log, TEST-steering-promise-one-owner

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
