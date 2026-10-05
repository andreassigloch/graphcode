# Standard-Auswertung AgentDiary, Frontier-Arm (`frontier-1`)

Stempel: graph `cf84e271927d` (179/380, graphVersion 73) · policy default · rules 34.0.0 (Audit: 86/86 Sätze unter 34.0.0) ·
code graphcode `85b1c4d`+dirty (fremde Änderungen in `rig/`, `tests/`; `src/`/`dist/` unverändert) · 2026-09-29.
Quellen: `agentdiary-frontier` (Graph-Export, `.graphcode/audit.jsonl` + `trajectory.jsonl`, `src/`, `docs/records/`,
`docs/cr/`), Transcript `d9c55ac6-…jsonl`. Der Live-Store des Repos wurde nicht geöffnet. Gemessen wurde über
`openMeasured({ graph, repoRoot })` mit einem Wegwerf-Store. Hilfsskripte liegen im Scratchpad, nicht im Repo.

## Ergebnis vorab

- **Spezifikation formal fertig, Code kongruent.** 0 Fehler. Steuerwert 0. `kongruent` bei 92 % Reichweite
  (44 von 48 Quelldateien einem MOD zugeordnet). Bindung 11 von 11 Blatt-FUNC. TEST mit testRefs 29 von 35 (die übrigen 6 sind `concept`).
- **Die Freigabe-Gates stehen bei 4/8.** Die vier Impl-Gates (SAR/FCA/SVR/FRR) haben 0 anwendbare Prüfpunkte, weil sie an feste
  MS-Kennungen gebunden sind. Die gibt es in AgentDiary nicht (Befund 1). T-M2 ist damit für dieses Projekt nicht erreichbar.
- **Nach dem Handoff steuert der Plan (MS/CR), nicht der Fokus.** `done` ab v29 (10:03, vor dem ersten Code) ist gewollt: ab da führen Meilensteine und CRs die Integrationsreihenfolge (Korrektur des Autors 2026-09-30). M1 → M2 → M3 wurde eingehalten; Lücken im Plan selbst: siehe Befund 3.
- **T-E11 sauber:** 0 Dubletten, 0 Neuanlagen bestehender Knoten, 0 REQ ohne kinds/Erfüller, 0 namensgleich, 0 Vorbild-Leck.
- **Analysen (T-O7) vorhanden und in Modell und Code verankert.** Alle Stempel stehen auf v44, das Modell auf v73. Danach änderte sich die
  Alarm-/Auslieferkette (7 Strukturzüge), und die FMEA prüft das nicht nach. AF-01..05 prüfen nur, ob ein Stempel da ist (Befund 2).
- **Suite heute 136/137.** Der rote Test hängt von der Umgebung ab, Ursache belegt (Befund 5).

## Standard-Auswertung → Stand

| Baustein (Leitlinie) | Werkzeug | Stand |
|---|---|---|
| Token, Kosten, Zeit (T-E5, T-E9) | Transcript + `turn-analyse` | vorhanden: `sitzungsanalyse-2026-09-29.md` §4 |
| Graph gegen Grep (T-E1), Bedarfsanalyse | `turn-analyse.bedarfsAnalyse` | vorhanden: Sitzungsanalyse §3 (mit Werkzeug-Hinweis) |
| Gate-Ablehnungen, Dubletten | `audit.jsonl`, `verhalten.dubletten` | vorhanden: Sitzungsanalyse §2, §8 |
| Skill-Nutzung, Chronologie, Drehbuch lokal | Transcript | vorhanden: Sitzungsanalyse §1, §6, §7 |
| Kennzahlen/Readiness, Legalität (T-M2) | `metrics.mjs`, `graph_readiness` | **hier §1** |
| Steuerung (Kanäle, Zeitlinie, Navigation, Effizienz, Endstand) | `steuerung.mjs` | **hier §2** |
| Trajektorie ℝ⁶/Steuerwert/Readiness (T-M2) | `trajektorie.mjs` | **hier §3**, ohne Golden |
| Schatten-`graph_suggest` | `schatten-suggest.mjs` | **hier §4** |
| Arbeitsweise (T-E11) | `verhalten.mjs` | **hier §5** |
| Code, Kongruenz (T-C1, Frontier-Hälfte T-E4) | `code-test/messen.mjs` (Funktionen) | **hier §6**, ohne freien Arm |
| Inhaltliche Analysen (T-O7) | Prüfliste | **hier §7** |
| Struktur-Referenz für den lokalen Arm (T-V5) | `verhalten.struktur` | **hier §8** |
| Züge je Fokusregel | `zuege.mjs` | nicht anwendbar: braucht `run-raw.log` und das Audit-Feld `model` (nur Executor) |
| Verlauf | `verlauf.mjs` | nicht anwendbar: Instrument für S2-Runden, schreibt `docs/messung/verlauf.md` |
| Blindurteil (T-E10) | `blindurteil.mjs` | gefahren, Abschnitt „Blindurteil“ unten (`blind-frontier/`) |
| Lokal ≈ Frontier (T-E3) | alle oben | Frontier-Hälfte hier; der lokale Arm fehlt noch |

## 1. Kennzahlen und Readiness

**Werkzeug:** `openMeasured({graph, repoRoot})` → `graph_readiness`, `rules_evaluate`; dann
`metrics.runMetrics({graphPath, readinessPath, auditPath, goldenPath: null})`.

| Dimension | req | uc | arch | alloc | ver | schema | cr | ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Score (Schwelle 0,8) | 0,900 | 1 | 0,995 | 1 | 0,996 | 1 | 0,983 | **0,722** |
| Verstöße | 43 | 0 | 3 | 0 | 1 | 0 | 4 | 10 |

- **Gate-Katalog:** 0 Fehler bei 179 Elementen (Compliance 1,0). Dazu 18 Befunde: CR-R03 ×4 (Element von 2 offenen CRs
  verfolgt), MS-03 ×10 info (CR ohne Meilenstein), CR-01 ×3 info (je 2 Verträge über eine Modulgrenze, genau auf der Schwelle), FM-03 ×1.
- **`req` = 0,90 kommt aus Regeln außerhalb des Gates.** BQ-02 ×36 („no measurable criterion“, bei 43 REQ) und BQ-06 ×7 (kein
  „System shall…“-Muster). Beide stehen in `skipped` des Gate-Katalogs, die Dimensions-Readiness zählt sie trotzdem (voller Katalog, 78 Regeln).
- **Phasen-Gates** SRR/PDR/CDR/TRR 4/4 bestanden. **Impl-Gates** SAR/FCA/SVR/FRR: je 0/0 Prüfpunkte, als nicht bestanden gezählt, zusammen
  `gatesPassed 4/8` (Befund 1).
- **Steuerwert** 0 (`measured` 3, alle Terme CR-01 mit Überschuss 0). `intentCoverage`: 6 von 7 Ankern adressiert, „umgebung“ nicht.
- **Legalität** (`metrics.legality`): 2 blockiert bei 86 Audit-Sätzen (73 mutate angewandt, davon 14 `test-ingest`, 11
  validate, 2 rejected). Gate-Durchgang der Agentenzüge ohne Dry-Run: 59 von 61.

**Einschränkung:** `graphVersion` in der Readiness-Antwort ist 0, weil `importGraph` die Version nicht fortschreibt. Die Version stammt aus dem Export (73).
`moduleAudit` entfällt, es gibt kein Golden.

## 2. Steuerung (Claude-Code-Arm)

**Werkzeug:** `steuerung.steuerungsBericht([{label:'frontier', strom:<Transcript>, elemente:179}])`, dazu die Einzelfunktionen.

| Kanal | geliefert / erwähnt |
|---|---|
| Gate-Block | 2 |
| `steerAdvisory` | 10 / 0 |
| `steeringDelta` | 11 / 0 |
| `fitAdvisory`, `workOrder` | 0 / 0 |
| Guide · Proben (Dry-Run) · readiness · help · suggest · STEERING.md · Rückfragen-Werkzeug | 12 · 11 · 2 · 1 · **0** · 1 · 0 |

- **Fokus befolgt:** **13 von 17** (Werkzeug nach CR-GC-716; vorher 1/2 — das Fenster ignorierte `next` an Mutationen). Handzählung nur über `focusKey`: 11 von 15.
  Von 62 Fokusquellen (3× `graph_generate`, 59× `next`) meldeten **44 `done`**.
  Fokus-Wiederholung 3.
- **Zeitlinie** (Anteil der 439 Werkzeugaufrufe): 1. Skill 2 %, 1. generate, 1. Guide und 1. Mutation je 3 %, readiness bei 2 % und 38 %.
  Ungeführte Typ-Batches 0/133. Mutationen ohne frischen Fokus 13/71 (die 11 Dry-Runs und 2 Ablehnungen tragen kein `next`).
- **Navigation:** Graph-Anteil **0,36** (Werkzeug nach CR-GC-716: 76 Dateizugriffe ohne Auftrag/Doku, davon Sichten 0, Werkzeug-Quelltext 6).
  Vorher 0,22 bei 148 Zugriffen — Commit-, Testlauf- und Schreibzeilen zählten mit, `contracts` traf das eigene `src/contracts`.
  Blindstelle: Lesen der Modelldatei per `python3 -c` zählt nicht als Navigation.
  Die exakte Handzählung steht in der Sitzungsanalyse §3 (19 eng / 46 weit gegen 60).
- **Effizienz je Element:** Das Werkzeug meldet „nicht verfügbar (kein result)“ (CR-GC-716). Mit den Summen der Sitzungsanalyse
  (Hauptagent) über `effizienz()` gerechnet:

  | Umfang | Elemente | ct/Element | Turns/Element | aktive s/Element |
  |---|---:|---:|---:|---:|
  | ganze Sitzung (39,56 $) | 179 | 22,1 | 1,94 | 25,2 |
  | Spec bis Plan, Phasen 1–5 (15,44 $) | 169 (v30) | 9,1 | 0,87 | 11,0 |

- **Endstand der Freigabe:** `done`, Phase `handoff`, 0 blockierend. Die Spalten „unter Schwelle“ und „offen an den Gates“ des
  Werkzeugs stammen aus dem letzten `graph_generate` (09:55, v25) und nicht aus dem Endstand. Den Endstand zeigt §1.

**Einschränkungen (Werkzeug, Datei:Zeile):**
- `steuerung.mjs:175`: `bashSuche` greift bei jeder Zeile mit grep/ls/cat. 77 Zeilen sind Commit-, Testlauf- oder Schreibzeilen,
  z. B. `git add … $(ls docs/views/*.md)` und `| grep "Tests "`.
- `steuerung.mjs:153`: Das Muster `contracts` trifft AgentDiarys eigenes `src/contracts/`. Echter Werkzeug-Quelltext: 8 statt 28.
- `steuerung.mjs:84–85`: Das Fenster für „befolgt“ endet an der nächsten Fokusquelle. Trägt jede Mutation ein `next`, ist das Fenster leer,
  daher nur 2 beurteilte Schritte.
- `steuerung.mjs:210`: `endstand` mischt die Tabellen des letzten `generate` mit dem `next` der letzten Mutation.
- `steuerung.mjs:192–193`: `effizienz` braucht eine `result`-Zeile im stream-json, die ein Sitzungs-Transcript nicht hat.
- „erwähnt“ ist nur für sichtbaren Text aussagekräftig: 263 Thinking-Blöcke mit zusammen 12 933 Zeichen, also redigiert.

## 3. Trajektorie

**Werkzeug:** `trajektorie.spieleNach(audit)` + `bewegung()` + `profil(export)`. Die Readiness je Zug kommt aus
`generationStep(graph, policy, …, 'kern')` (`dist/loop/generate.js`) über denselben Nachbau. **Es gibt kein Golden und keinen
Referenz-Trail für AgentDiary**, deshalb nur der Verlauf und kein Vergleich Hand gegen Auto.

Nachspiel: 73 angewandte Züge, 2 abgelehnt. Der Endgraph ist mit dem Export identisch (179/380).

| Größe | Übergänge mit Bewegung (von 72) |
|---|---:|
| ℝ⁶ | 13 (18 %) |
| Steuerwert | 2 (3 %) |
| Anker | 2 (3 %) |
| Q deklariert | 13 (18 %) |
| Engpass | 2 (3 %) |
| Quoten Bindung/Test/REQ-Deckung | 24 (33 %) |

Längste Anker-Standzeit: 46 Züge ohne Überschuss.

Verlauf (Auswahl der Wendepunkte, Zeiten MESZ):

| v | Zeit | Elemente | Steuerwert | ℝ⁶ mod · ft · flow · coh · via · scal | Q dekl. | Bindung · Test · REQ-Deckung | Readiness req/uc/arch/alloc/ver/schema/cr/ms | Phase |
|---:|---|---:|---:|---|---:|---|---|---|
| 1 | 28. 16:29 | 1 | 0 | 0 · 0 · 0 · 0 · 0 · 0 | — | — | —/—/—/—/—/—/—/— | seed |
| 7 | 28. 16:32 | 75 | 0 | 2,58 · 1,71 · 0,71 · 3,5 · 5 · 3,2 | −0,03 | 0 · 0 · 0 | 0,92/1/1/—/0,85/1/—/— | expand |
| 16 | 28. 17:03 | 108 | 0 | 2,63 · 1,7 · 0,61 · 3,53 · 5 · 3,05 | −0,03 | 0 · 0 · 0,54 | 0,88/1/1/—/1/1/0,94/— | expand |
| 21 | 29. 09:36 | 104 | 0 | 2,8 · 1,7 · 0,6 · 3,62 · 5 · 2,98 | −0,03 | 0 · 0 · 0,5 | 0,87/1/1/—/1/1/0,96/— | expand (Umbau) |
| 26 | 29. 10:00 | 141 | 0 | 2,89 · 2 · 0,63 · 3,77 · 5 · 2,95 | 0,33 | 0 · 0 · 0,63 | 0,87/1/0,98/1/0,96/1/0,96/— | expand (Modulschnitt) |
| 28 | 29. 10:02 | 152 | 0 | 2,99 · 2,46 · 0,59 · 4,11 · 5 · 2,83 | 0,40 | 0 · 0 · 0,63 | 0,87/1/0,99/1/0,96/1/0,96/— | stalled |
| 29 | 29. 10:03 | 169 | 0 | unverändert | 0,40 | 0 · 0 · 1 | 0,9/1/0,99/1/0,96/1/0,94/0,77 | **handoff (done)** |
| 47 | 29. 11:33 | 176 | **1,25** (R-04@MOD-report) | 2,89 · 2,62 · 0,61 · 3,91 · 5 · 2,77 | 0,39 | 0,45 · 0,34 · 1 | …/alloc 0,96/…/ms 0,71 | expand |
| 48 | 29. 11:34 | 177 | 0 | 2,99 · 2,58 · 0,59 · 4,19 · 5 · 2,83 | 0,41 | 0,45 · 0,34 · 1 | …/alloc 1/… | handoff (done) |
| 66 | 29. 13:05 | 178 | 0 | 3 · 2,58 · 0,62 · 4,03 · 5 · 2,9 | 0,40 | 1 · 0,83 · 1 | 0,9/1/0,99/1/0,98/1/0,97/0,71 | handoff (done) |
| 73 | 29. 13:22 | 179 | 0 | 3,01 · 2,66 · 0,62 · 4,1 · 5 · 2,91 | 0,39 | 1 · 0,83 · 1 | 0,9/1/0,99/1/1/1/0,98/0,72 | handoff (done) |

- ℝ⁶ bleibt bis v6 bei 0, weil die arch-Schicht leer ist. Die Bewegungen kommen aus Umbau (v21), Modulschnitt (v26–28) und den io-Änderungen der Code-Phase (v47–68).
- Ab v29 bewegen sich nur noch die Quoten: Bindung 0 → 1,0 und Test 0 → 0,83, CR für CR. Das ist die Code-Phase.
- `ms` liegt ab v29 durchgehend unter 0,8 (0,71–0,77, MS-03 info). `done` gilt trotzdem, weil der Fokus info-Befunde ausnimmt.

**Einschränkung:** Readiness je Zug über `generationStep` mit der Default-Policy des Stempels, ohne RC-Konformanz, weil ein Nachbau ohne Quellbaum-Stand keine hat.

## 4. Schatten-`graph_suggest`

**Werkzeug:** `node rig/greenfield-systemtest/schatten-suggest.mjs <scratch>/lauf-frontier` mit einer **Kopie** von `audit.jsonl`,
weil das Werkzeug `schatten-suggest.json` in den Laufordner schreibt (`schatten-suggest.mjs:129`). Laufzeit 37 s.

| Züge | mit anwendbarem Vorschlag | Agent traf ihn | Vorschlag besser | verpasste Verbesserung | Verbesserung Agent |
|---:|---:|---:|---:|---:|---:|
| 73 | 1 (Zug 48: BW-02@FUNC-compose-report, Score 5·10⁻⁵) | 0 | 0 | 0 | 0 (−1,25 in Zug 47, +1,25 in Zug 48) |

Das heutige Gate lehnt keinen der 73 Züge ab. Der Optimierer hatte nichts zu sagen, weil der Steuerwert fast immer 0 ist.
Ein Zielprofil gibt es nicht: `target-profile.json` trägt nur `intentAnchors`.

## 5. Arbeitsweise T-E11

**Werkzeug:** `verhalten.dubletten(audit)`, `verhalten.pruefungen(ladeGraph(export))`, Neuanlage bestehender Knoten per `nachbau.anwenden`
(add-node auf vorhandene uid).

| Größe | Wert | Schwelle T-E11 |
|---|---:|---|
| Dubletten (alle Typen, auch im Batch) | 0 (0 Schablone) | ≤ 5 % der Elemente ✓ |
| Neuanlagen bestehender Knoten | 0 von 188 add-node | fällt über Runden: N = 1, nicht prüfbar |
| REQ · ohne kinds · ohne Erfüller · namensgleich überzählig | 43 · 0 · 0 · 0 | — |
| Vorbild-Leck (`VORBILD_UIDS`) | 0 | 0 ✓ |

Kommandos gesamt: add-node 188 · add-edge 430 · update-node 218 · delete-edge 27 · delete-node 8 · merge-nodes 1.
**Einschränkung:** `ablehnungen()` braucht `run-raw.log` (Executor) und fällt hier aus. Ablehnungen und Preflight siehe Sitzungsanalyse §2 (2 / 0).

## 6. Code und Kongruenz (T-C1)

**Werkzeug:** `messen.codeKennzahlen` (rein) auf `src/`. `architektur()` als Scratch-Nachbau von `messen.mjs:101–126`, weil die Funktion nicht exportiert ist
(Kopie nach tmp, `graphcode init` + `import-code`). Kongruenz über `openMeasured` + `metrics.codeVerdict`, **nicht** über
`messen.kongruenz`: `messen.mjs:144` öffnet `createHarness({repoRoot: ws})`, also den Live-Store, der hier verboten ist.
`messe()` schreibt `messung.json` in den Arbeitsbereich (`messen.mjs:243`) und wurde nicht gerufen. Tests: `npx vitest run --exclude '**/*.live.test.ts'`.

| Größe | Wert |
|---|---|
| Tests | 31 Dateien, **136/137 grün**. Rot: `transcript-contract.test.ts` (Befund 5) |
| Quelltext ohne Tests | 17 Dateien, 1120 Zeilen (ohne Leer- und Kommentarzeilen), größte 195, 82 Exporte, 44 relative Importe, 0 Zyklen |
| Verzeichnisse (Module) gegen MOD | 5 (`activity`, `contracts`, `lib`, `report`, `run-state`) gegen 3 MOD (activity, report, run-state) |
| `import-code`-Steuerwert | **8,083** ohne Testdateien: 23 MOD / 48 FUNC / 44 FLOW / 39 SCHEMA. Terme: RD-04@SYS 4,33, R-04@run-day.ts 2,00, R-04@run-state 1,25 u. a. |
| RC-Urteil | **kongruent**, 0 RC-Befunde. RC-Regeln liefen (nicht in `skipped`) |
| Reichweite | 44/48 Dateien (92 %). Nicht zugeordnet: `src/contracts/schemas.ts`, `src/lib/day-window.ts` + 2 Tests |
| Bindung Blatt-FUNC mit `realRef` | 11/11 (100 %). Die 12. FUNC `FUNC-compose-report` ist zusammengesetzt |
| TEST mit `testRefs` | 29/35. Die übrigen 6 sind `concept:true`: agent-holds-no-secret, crash-reaches-alarm, declarative-sigllm-task, local-only, report-deadline, run-audit |

**Einschränkungen:** Die verdeckte Abnahme (Block 1 von `messen`) gibt es nur für die Scheduler-Scheibe, für AgentDiary nicht.
Ein freier Arm fehlt, also kein Vergleich geführt gegen frei. `messen.mjs:103` kopiert `src/` samt den im Code liegenden `*.test.ts`. Damit
wird jede Testdatei ein MOD: 54 MOD, Steuerwert 15,183. Der Wert 8,083 ist ohne Tests gerechnet und nur so mit den Code-Test-Läufen vergleichbar.
`turnBilanz`/`bedarf` stehen schon in der Sitzungsanalyse.

## 7. Inhaltliche Analysen (T-O7)

**Werkzeug:** Prüfliste gegen `docs/records/`, den Graphen (Rollen, verify-Kanten, `analysisFreshness`) und den Audit ab v44.

| Analyse | Artefakt | Stempel (Modell v73) | Befunde → REQ/TEST/Ausnahme |
|---|---|---|---|
| ConOps | Task `conops` über `graph_generate`, Sicht `conops.md` | v44 | als system-REQ im Graphen |
| IRR | `irr-dfc06e1`, `-356e38f`, `-46c31fc`, `-25f98b2` | v44, crRefs CR-AD-002..005 | Jede Annahme (A1–A18) hat ein Ziel: CR, Record (benannt) oder FM-13/14 |
| FMEA | `failure-mode-analysis.md`, 15 FM | v44 | 10 als Risiko-REQ mit Gegenmaßnahme. FM-10/11 → Betrieb bzw. MessageRouter, FM-12 → Test Zeitumstellung (`collect-commits.window.test.ts:54`), FM-13 → CR-AD-004, FM-14 begründet ohne SW |
| Trade | CR-AD-001, -006, -007 (TR-01 ohne Befund) + `trade-sigllm-agent-runtime.md` | v44 | Die sigllm-Studie ist nach CR-SL-092 in sigllm geroutet und steht nicht im Stempel |
| Implplan | Sicht `implplan.md`, MS/CR im Graphen | v44 | 24 von 28 CR done |

- **FMEA-Risiken mit Nachweis:** 9 von 10. Deren TEST trägt `testRefs` (per `graph_test_ingest` als bestanden gemeldet). Ohne Nachweis ist
  `REQ-risk-run-aborted` (FM-16): TEST nur `concept`, CR-AD-005/022 offen, einzige FM-03-Warnung (Befund 6).
- **Freshness gegen Graph-Stand:** Alle fünf Stempel stehen auf v44. Seit v44 gab es 29 Versionen, strukturell FLOW-report-alarm neu (v48), io-Kanten ×6
  hinzu/×3 weg (v47, 48, 56, 66, 68), CR-AD-023/024 neu, 3 Beschreibungen geändert. FMEA §8 prüft nur 24 → 44 nach, `FLOW-report-alarm` kommt
  im Record 0× vor. AF-01..05 melden nichts (Befund 2).

## 8. T-V5-Vorbereitung: Struktur des Frontier-Graphen

**Werkzeug:** `verhalten.ladeGraph` + Mustern wie in `verhalten.struktur` (dort nur als Menge, hier mit Häufigkeit). Der Graph liegt
eingefroren als `golden/frontier-v73.graph.json` (gleicher sha256). 27 Muster, **18 tragend (≥ 5 Kanten)**, 380 Kanten.

| Muster | n | tragend |
|---|---:|---|
| TEST -verify-> REQ | 43 | ja |
| CR -relation-> SCHEMA | 30 | ja |
| FLOW -io-> FUNC | 30 | ja |
| CR -relation-> REQ | 29 | ja |
| UC -compose-> REQ | 28 | ja |
| FUNC -satisfy-> REQ | 26 | ja |
| CR -relation-> FUNC | 23 | ja |
| FLOW -relation-> SCHEMA | 23 | ja |
| FCHAIN -compose-> FUNC | 20 | ja |
| CR -relation-> MS | 18 | ja |
| TEST -verify-> SCHEMA | 18 | ja |
| FUNC -io-> FLOW | 17 | ja |
| FUNC -allocate-> MOD | 12 | ja |
| FCHAIN -satisfy-> REQ | 11 | ja |
| REQ -compose-> REQ | 10 | ja |
| ACTOR -io-> FLOW | 6 | ja |
| SYS -compose-> REQ | 5 | ja |
| SYS -satisfy-> REQ | 5 | ja |
| CR -relation-> MOD | 4 | |
| FLOW -io-> ACTOR · FUNC -compose-> FUNC · MOD -satisfy-> REQ · MS -relation-> MS · SYS -compose-> MOD · SYS -compose-> UC · UC -compose-> FCHAIN | je 3 | |
| CR -relation-> UC | 1 | |

- **Typen (179):** REQ 43 · TEST 35 · CR 28 · FLOW 23 · SCHEMA 19 · FUNC 12 · ACTOR 5 · MS 4 · UC 3 · FCHAIN 3 · MOD 3 · SYS 1.
- **FUNC je Wirkkette:** daily-workreport 10 · maintain-project-list 7 · report-failure 3. 0 Ketten mit genau einer FUNC, 0 ohne FUNC.
  11 Blatt-FUNC verteilen sich auf 20 compose-Kanten, eine FUNC gehört also oft zu mehreren Ketten.

## Befunde

1. **Impl-Gates sind für Fremdprojekte unerreichbar.** SAR/FCA/SVR/FRR sind hart an `MS-1-specification`, `MS-2-coding-vv`,
   `MS-3-mvp-readiness` und `MS-4-mvp2` gebunden (`node_modules/@sigloch/graphcode-client/dist/readiness.js:138–141`, v1.5.1). AgentDiary
   nennt seine Meilensteine `MS-1-sources` … `MS-4-calibration`. Folge: 0/0 Prüfpunkte, `gatesPassed 4/8`, obwohl M1–M3 mit 24 von 28 CR
   done sind. Das T-M2-Kriterium „8/8“ misst hier die Namenskonvention und nicht den Stand.
2. **Freshness-Stempel sind nur Präsenzprüfungen.** AF-01..05 fragen „Stempel da?“ (`contracts/dist/se/analysis-freshness-rules.js:10–27`),
   nicht „Stempel ≥ letzte Strukturänderung im Geltungsbereich“. Belege: Stempel v44, Modell v73. Danach FLOW-report-alarm und 9 io-Kantenzüge in
   der Alarm-/Auslieferkette, die FMEA §8 nicht behandelt. Es ist dieselbe Klasse, die der Nutzer um 11:29 von Hand korrigiert hat („Impact prüfen, nicht stempeln“).
3. **Nach dem Handoff steuert der Plan — mit drei Lücken** (ITEM-2026-662, korrigiert). Ab v29 führen MS/CR, nicht der Fokus des Kernels (gewollt). Eingehalten: die MS-Reihenfolge M1 → M2 → M3 (Commits CR-AD-010…014, 015/023/016/017/018, 019/020/021/024). Lücken: (a) innerhalb eines MS ist die CR-Reihenfolge nicht modelliert — keine depends-on-Kante zwischen CRs; CR-AD-023 wurde in M2 ad hoc eingeschoben; (b) die MS-Knoten tragen keinen `status`, obwohl M1 und M2 erledigt sind (implplan: „n/a“); (c) `ms` = 0,72 kommt allein aus MS-03: die 10 Spec-CRs (CR-AD-001…003, 007 samt Optionen, FMEA) hängen an keinem Meilenstein. Die Kongruenz kam aus 6 selbst gerufenen `rules_evaluate` — der Plan sagt nicht, wann sie zu prüfen ist.
4. **Code-Kongruenz am Endstand belegt, mit einer Lücke im Modulschnitt.** Ergebnis `kongruent`, 0 RC-Befunde, Reichweite 92 %, Bindung 11/11. Nicht
   zugeordnet sind `src/contracts/schemas.ts` und `src/lib/day-window.ts`: Der Code hat 5 Module, der Graph 3 MOD. Die Sitzungsanalyse §5
   („RC-Endstand nicht belegt“) ist damit geschlossen.
5. **Die Suite ist heute rot, weil der Test von der Umgebung abhängt.** `transcript-contract.test.ts:28–33` wählt das jüngste `*.jsonl` rekursiv unter
   `~/.claude/projects`. Beim Lauf war das die Subagent-Datei dieser Auswertung (`isSidechain: true`, 0 × `origin.kind: human`), also ein
   falscher Alarm. Der Detektionstest für FM-01 hängt damit davon ab, welche Sitzung zuletzt schrieb.
6. **FM-16: FMEA-Record und Regel bewerten verschieden.** Der Record sagt AP Medium (S7/O3/D5). Regel FM-03 sagt AP High (`rpn-interim`: 7·3·5 = 105 ≥
   `riskRpn` 100, `apTable: null`). Das ist die einzige offene FM-03-Warnung. Der Nachweis `TEST-crash-reaches-alarm` ist nur `concept`.
7. **REQ-Qualität außerhalb des Gates schwach.** BQ-02 „kein messbares Kriterium“ feuert 36-mal bei 43 REQ, BQ-06 7-mal. Die Befunde senken `req` auf
   0,90, stehen aber in `skipped` des Gates und blockieren nie. Für den Vergleich mit dem lokalen Arm (T-E3, T-E10) ist das der Qualitätsposten,
   den die Readiness nicht trennt.
8. **Arbeitsweise und Gate gesund (T-E11).** 0 Dubletten, 0 Neuanlagen, 0 Vorbild-Leck. 59 von 61 Zügen ohne Dry-Run angewandt. 0 von 133
   Typ-Batches ohne vorherigen Guide.


## Blindurteil (T-E10)

Arm-Raster `golden/arme/frontier-1/auftragspunkte.json` = Kern (14 P + 5 O, P09/P10 als Plattformthema
entfernt) + 4 Zustimmungen dieses Arms (PZ01–PZ04; G/V, Nachholtage/Eskalation, Kanäle, MessageRouter).
Zustimmungen sind Vorgabe (Autor 2026-09-30). Ein Gutachter, nur Spec A.

| Lauf | Spec | ✓ · ~ · ✗ (P*) | O* offen geführt | erfunden | Dubletten | Notensumme |
|---|---|---|---|---|---|---|
| frontier-1 | A | 14 · 3 · 1 | 0 von 3 | 17 | 11 | 17 |

Noten: Treue 4 · Dubletten 2 · REQ 4 · Tests 4 · Struktur 3. Urteil: „etwa ein Bereinigungszug bis baubar“.
Erste Runde mit dem Entwurfsraster (Zustimmungen als erfunden, P09/P10 drin): 9 · 3 · 4, Notensumme 13 — überholt.

**Stichprobe am Graphen (4 Befunde):**
- ✓ P14 (Router für andere Agenten) steht nur im Text von `CR-AD-006`, als Anforderung nirgends.
- ✓ „höchstens drei Sätze“ steht in `REQ-summarize-projects` und vier weiteren Knoten, ohne Vorgabe.
- ~ „Obergrenze 60 Nachholtage“: es ist der Wertebereich `maxCatchUpDays N (1–60)` in `SCHEMA-agentdiary-config`, kein
  Widerspruch zu N = 14 — als erfundene Grenze trotzdem richtig gezählt.
- ✗ **Artefakt:** `FUNC-compose-report` ist die zerlegte Elternfunktion (compose → check-completeness, render-note,
  summarize-projects); `spec-render.mjs` zeigt die Zerlegung nicht (ITEM-2026-666).

**Nicht belastbar:** die Dubletten-Note. 10 der 11 „Dubletten“ sind FMEA-Paare `REQ-risk-*` + `REQ-mit-*` mit gemeinsamem
TEST (se-fmea-Muster, ITEM-2026-665), die elfte ist das Zerlegungs-Artefakt.
