# CR-GC-748: Nachzug contracts 11 / graphcode-client 2 — Marken statt Gates, die Phasenabdeckung entfällt, eine abnehmbare Menge; der Build ist wieder grün

**Status:** ✅ Done (2026-10-06)
**Typ:** aus Item ITEM-2026-762 (idea)
**Erstellt:** 2026-10-06
**Item:** bok/items/ITEM-2026-762.json (Lane: code)
**Deckt:** sigloch-modules CR-SM-395 (Commits 9631a27..c34cbf5, unveröffentlicht) — `@sigloch/contracts` 11.0.0,
`se-engine` 2.0.0, `graphcode-client` 2.0.0, `graph-api-core` 5.10.2. Entwurf: `docs/graphcode_regelmatrix_entwurf.md`.
**Schnitt:** Teil 1 von 3. Dieser CR macht Build und Suite wieder grün (Exporte, Marken, Bericht, Hilfe, Panels,
Rig). Teil 2 (CR-GC-749): der Schritt wählt nach Stufe, der Kaltstart kommt aus den Regeln. Teil 3 (CR-GC-750):
Regelmatrix-Skript, Skills, Rig-Aufgaben. Baut zurück: CR-GC-745, CR-GC-746 (Gate-Zustand) und aus CR-GC-743/744
die Leser von `ruleApplies`.

---

## Befund

Gegen die verlinkte Arbeitskopie baute graphcode nicht: 51 Typfehler in 11 Quelldateien — jeder ein entfallener
Export (CR-SM-395 §12). Dahinter stand in graphcode eine zweite Antwort auf drei Fragen, die der Katalog jetzt
einmal beantwortet:

| Frage | bisher in graphcode | jetzt |
|---|---|---|
| Ist ein Gate bestanden? | `computePhaseReadiness` / `currentPhaseGate` (Regelabdeckung je Phase, CR-GC-296/745), daneben `phaseGates`/`implGates` aus dem Client | `ReadinessReport.marks` aus dem Client, durchgereicht |
| Ist eine Regel gestellt? | `ruleApplies` in `readiness.ts` und `incose.ts`; Kommentar „Code-Präsenz nur, wenn etwas gebunden ist" in der Fokusmenge | `isDue` am Katalog; die Fokusmenge bekommt nur fällige Befunde |
| Was ist abnehmbar? | Liste je Arbeitsschritt, mit vier Bindungsregeln | eine Menge, aus der Rolle `analysis` gelesen |

## Umsetzung

**Marken durchgereicht, nichts nachgebaut.**
- `src/kernel/measure/readiness.ts`: nur noch Re-Export (`computeMarks`, `MARK_LABELS`, `ReadinessMark`, …).
  Entfallen ohne Nachfolger: `computePhaseReadiness`, `currentPhaseGate`, `PhaseGateReadiness`,
  `PHASE_GATE_ORDER`, `PhaseRuleHit` und alle Gate-Re-Exporte.
- `src/projections/readiness-completeness.ts`: gelöscht (Re-Export der Vollständigkeits-Beine).
- `graph_readiness` (`report.ts`): trägt `marks`; `phaseGates`, `implGates`, `stateLabel` und der Block
  `phase_readiness` sind weg. `catalogs.gate.fields` nennt `marks`. Werkzeugbeschreibung um einen Halbsatz kürzer.
- `GenerationStep.phaseReadiness` und `SteeringSnapshot.phaseReadiness` entfallen. Die Freigabe folgt seit
  CR-GC-593 allein dem Fokus; das Feld war Bericht. Die Marken stehen an EINER Stelle (`graph_readiness`) — im
  Schritt wären sie aus einem zweiten Regelstrom (ohne Abgleich Modell/Code) gerechnet und könnten an der Marke
  Bau abweichen.
- `src/index.ts`: exportiert `computeMarks`, `MARK_LABELS`, `ReadinessMark`, `analysisSignals` statt
  `GATE_STATES`, `GATE_STATE_LABELS`, `GateState`, `GatePanel`, `analysisFreshness`, `creationCurrencyProvider`.

**Hilfe.** `help.ts`: `HelpEntry.stage` und `.mark` (aus `ALL_RULE_DEFS`) statt `ownedByGate`; Art `mark` statt
`gate`; `helpForRules()` gruppiert nach Marke plus `immer`; `contextualHelp(violations)` führt nur noch
Regelbefunde — die „creation blocker" (CR-GC-221) und das nicht durchschrittene Gate (CR-GC-746) entfallen, weil
alles, was eine Marke hält, ein Regelbefund ist. `help-content.ts`: fünf Marken-Einträge (Stufe und Mengen aus
`MARK_STAGE`/`STAGE_SETS` gelesen), die vier Bau-Gates SAR/FCA/SVR/FRR gestrichen. `tool-help.ts`: `marks` erklärt.

**Fälligkeit.** `incose.ts` (ICD-Zelle) fragt `isDue` an der Definition von R-26.

**Aktualität der Analysen.** `computeAnalysisCurrency` gibt es nicht mehr. Die Kopfzeile `// !! STALE-ANALYSIS`
an `graph_context`/`graph_impact` (CR-GC-363) ist deshalb entfernt, nicht nachgebaut
(`tool-context.ts`, `tool-context-contract.ts`, `read.ts`).

**Arbeitsschritte.** Der Schritt `realisierung` ist weg (`TASK_SKILL`, `next-step.ts`, Werkzeugtext in
`suggest.ts`). Die Regeln der Analysen (FM-01..03, CL-01, TR-01, IR-01, MS-, CR-R-Regeln) und die Bindungsregeln
führt jetzt der Kern (`taskOf` aus contracts); ein Analyse-Task hat im Fokus nur noch seinen Eintrittspunkt.
- Folge 1 — `focus-set.ts`: **eine** Menge `ABNEHMBAR` statt `ABNEHMBAR_JE_TASK`: Regeln mit Rolle `analysis`
  (AF-01..04, TR-01, IR-01), die Eintrittsregeln aus `TASK_ENTRY` (bringt AF-05, Rolle `existence`) und zwei
  begründete Ausnahmen (`ABNEHMBAR_BEGRUENDET`). Einzeln geprüft:

  | Regel | abnehmbar | Grund |
  |---|---|---|
  | CL-01 | ja | Ein Akteur in nur einer Betriebsart kann richtig sein; ob eine zweite fehlt, entscheidet der Auftraggeber. |
  | FM-03 | ja | Verlangt einen bestandenen Testlauf (`result: passed`), ist aber fällig, sobald es ein hohes Risiko gibt — im Entwurf nicht erfüllbar. |
  | MS-01 | nein | Ein Zug im Modell schließt ihn (Auftrag zuordnen oder Meilenstein löschen). |
  | CR-R01 | nein | Ein Zug im Modell schließt ihn (Umfang verbinden). |
  | R-19, R-20, R-26, R-32 | nein | Standen nur in der Liste, weil sie im Entwurf feuerten. Fällig erst im Bau, dort die Arbeitsliste. |

  Leser umgestellt: `decisions.ts` (Satz `acceptance`), `authoring-example.ts`, `generate.ts`,
  `.claude/commands/se/generate.md` (trägt den Satz wörtlich; dazu der Absatz über Analysen berichtigt).
- Folge 2 — `generate.ts`, `analyseSkill(ruleId)`: steht eine Regel einer Analyse im Kern-Fokus, nennt der
  Schritt den Skill der Analyse (gelesen aus `RULE_HELP[…].prompt`) statt der Autorier-Anleitung der Dimension —
  für FM-01 wäre das `se:author-req` gewesen. Im Treiber-Modus stehen Regeln mit Rolle `analysis` wie
  Eintrittspunkte nie im Fokus.

**Rig.** `auswertung/nachspielen.mjs` füllt `gates` aus `readiness.marks[].reached`. Das Feld heißt weiter
`gates` (so steht es je Zug in jedem eingefrorenen `lauf.json`); `kennzahlen.gateZug` und `simulator.ZIEL` lesen
alte und neue Läufe über denselben Weg, unverändert. Kein eingefrorener Lauf ist umgeschrieben.

**Abhängigkeiten.** `package.json`: contracts `>=11 <12`, se-engine `^2.0.0`, graphcode-client `^2.0.0`,
graph-api-core `^5.10.2` (5.10.1 verlangt contracts `<11`). `package-lock.json` unverändert — Link-Modus.

## Umfang > 10 Dateien, nicht geschnitten

23 Quell- und Hilfsdateien, 28 Testdateien, zwei Artikel. Jeder kleinere Schnitt ist rot: die Exporte entfallen
gemeinsam, und die gekürzte Arbeitsschritt-Zuordnung wirkt in derselben Paketversion auf Fokusmenge und Tests.
Quelltext (src, auswertung): **+229 −464**.

## Tests — je Datei, was geschah

| Datei | |
|---|---|
| `readiness.completeness` | **umgeschrieben.** Vollständigkeits-Beine gibt es nicht mehr; die Aussage dahinter (leere Pflichtmenge liest nie „erreicht") steht jetzt an echten Regelläufen: 11 Fälle, je Marke und für den Bau. |
| `readiness.model` | **umgeschrieben.** Gelöscht: Gate-Partition, Bau-Gates, Pflicht-Analysen je Gate samt Aktualität, Regelabdeckung je Phase, Vorbedingungs-Tabelle. Neu: jede Familienregel trägt Stufe und abgeleitete Marke; der Bericht reicht `computeMarks` durch. |
| `help`, `help.contextual-dedup`, `help-content`, `mcp.help` | umgeschrieben auf Marke/Stufe; gelöscht: 3 Fälle zum nicht durchschrittenen Gate, 2 zu „creation blockern". Neu: leerer Graph ergibt keine leere Maßnahmenliste. |
| `mcp.readiness` | Gate-Zustand (2 Fälle) und `phase_readiness` (1 Fall) gelöscht; neu 2 Fälle „Marken am Werkzeug" auf Kuzu auf Platte. |
| `panels` | Gates → Marken; `analysisFreshness`/`creationCurrencyProvider` gelöscht, neu `analysisSignals`. |
| `contracts.kernel` | Block SCHEMA-phase-readiness gelöscht (2 Fälle). |
| `steering-snapshot` | Block `phaseReadiness` gelöscht (1 Fall); Fixture „alles gebunden" bindet jetzt auch das Schema. |
| `steering.process-ratchet` | T-B1 (Leiter) umgeschrieben auf die Marken, tabellengetrieben über die Existenz-Regeln des Katalogs; Skalar der Ratsche = Zahl offener Regeln. |
| `steering.artifact-coupling` | zwei Folgefälle umgeschrieben (offene Regeln statt `missing` je Gate); Fixture ohne handgeschriebenes Gate je Regel. |
| `mcp.read-format` | Banner-Fall umgeschrieben auf die Gegenaussage: ein Stempel hinter dem Graph-Stand ändert das Leseergebnis nicht. |
| `generate`, `generate.task`, `generate.statemachine`, `focus-set`, `stagnation`, `skill-rule-ids`, `decision-texts` | umgeschrieben auf die gekürzte Zuordnung und die eine abnehmbare Menge. Neu: Fokusmenge ohne/mit offenem Auftrag (4 Fälle), Skill der Analyse am Kern-Fokus. |
| `auswertung` | **neu:** an beiden Referenzläufen meldet das Ziel `srr+pdr`, `gates` = `marks[].reached`, `gateZug` liest den eingefrorenen Lauf. |
| `bootstrap`, `conformance`, `export.testref-materialize`, `mcp.mutate-input`, `schema-parse-at-interface`, `claims.conformance` | Einzelzusagen nachgezogen (R-33 am leeren Graphen, `isDue` statt `realizationBegun`, `null` statt 0 bei „nichts geprüft", 67 → 69 Regeln in zwei Artikeln). |

**Rot zuerst:** vor diesem CR baute das Repo nicht, jeder Test dieser Dateien war am Import rot. Für die vier
neuen Fokus-Fälle gilt: der Mechanismus (Fälligkeit) liegt in contracts und ist dort rot-zuerst belegt
(`se-rule-due.test.ts`); hier werden sie mit dem Build grün.

### Tests, die einen im Katalog strittigen Wert festschreiben (CR-SM-395 §10)

- `generate.statemachine` „ohne Abnahmen": die offenen Regeln am Golden als Liste — enthält R-19/R-20 (das
  Golden trägt Bindungen) und TR-01.
- `auswertung` „leeres Audit auf der Basis": `gates.Bau === false` an der Referenz `lokal` (AF-05 offen, nichts
  abgenommen). TRR ist bewusst nicht festgehalten (§10.1).
- `conformance` „monorepo RC-05": das Fixture trägt einen offenen CR, damit der Fall nicht an §10.8 hängt.
- `claims.conformance`: 69 Regeln (R-33, R-34).

Alles Übrige liest Stufe, Rolle und Marke aus dem Katalog.

## Was verloren geht

- Die Regelabdeckung je Phase (`phase_readiness`, „8 von 8 Regeln") — am Werkzeug und im Schritt.
- `HelpEntry.ownedByGate`, die Art `gate`, die Felder `blockerKind`/`gateId` an `graph_help` ohne Token.
- Das Banner „Analyse veraltet" an `graph_context`/`graph_impact`.
- In einem Analyse-Task die Regeln der Analyse als eigener Fokus. Ein Task ist durch, wenn sein Eintrittspunkt
  schweigt; die Regeln stehen danach im Kern.

## Offen, benannt

- **Modell-Zug.** `FUNC-compute-phase-readiness` und `SCHEMA-phase-readiness` zeigen auf entfernte Symbole
  (RC-01, RC-03). `tests/conformance.test.ts` „the SSOT graph is RC-clean" ist deshalb **rot**, bis die beiden
  Knoten (samt `FLOW-phase-readiness`) durchs Gate entfernt sind — der laufende Host und `docs/graph` waren für
  diesen Nachzug tabu. Ebenso offen: CR-Knoten und `crRefs` im Item (CR von Hand angelegt, nicht über
  `aise dispatch prepare`).
- **graph-view-edit** liest `phaseGates`, `implGates`, `ownedByGate` (CR-SM-395 §12) — eigener Nachzug.

## Umfang laut `graph_impact`

Nicht gelaufen: der laufende Host war tabu. Umfang aus dem Typcheck (51 Fehler) und `git grep` über die
entfallenen Namen.

## Verifikation

- In sigloch-modules contracts, graph-api-core, se-engine, graphcode-client gebaut (11.0.0 / 5.10.2 / 2.0.0 / 2.0.0).
- `npm run build` grün. `npx eslint src`: 3 Befunde in `mcp-server.ts` und `scaffold-docs.ts`, beide Dateien von
  diesem CR nicht berührt.
- `npm run verify:code`: Spur VOLL (Auslöser `package.json`).
- `npm run verify:full CR-GC-748` (Zeile in `docs/messung/testauswahl.jsonl`): 202 Dateien, 3 rot —
  `tests/lockfile-sync.test.ts` und `tests/distribution.test.ts` (Link-Modus, erwartet) und
  `tests/conformance.test.ts` (1 Fall, s. „Offen, benannt"). Spur VOLL, damit kein Schlupf messbar; die Folge
  ohne Schlupf zählt diesen CR nicht.
