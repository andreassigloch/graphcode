# CR-GC-740: Messaufbauten alter Definition löschen: greenfield-systemtest, code-test, referenz-change, dummy-slicer, Executor-Teile; Texte ins Archiv

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-743 (idea)
**Erstellt:** 2026-10-05
**Item:** bok/items/ITEM-2026-743.json (Lane: code)

---

CR 4 von 5 des Konzepts [`docs/graphcode_messaufbau_konzept.md`](../../graphcode_messaufbau_konzept.md) (§5 Bestand,
§6 Löschkonzept). Lösch-CR: mehr als zehn Dateien, vom Autor freigegeben (Entscheide 2026-10-05).

## Befund

Nach CR-GC-737/738/739 lagen neben dem einen Rig (`rig/`) und der Auswertung (`auswertung/`) fünf Aufbauten alter
Definition, deren Eingang nicht mehr entsteht (Executor-Läufe, `createHarness`-Subprozess, Sitzungsprotokolle
eines einmaligen Referenz-Changes) oder deren Frage beantwortet ist (Spike `dummy-slicer`): 2,2 GB Rohdaten,
sechzig versionierte Ergebnisdateien, vier Testdateien, die nur diese Aufbauten prüften, und im Selbstmodell ein
Modul mit vier Funktionen, deren `realRef` auf die zu löschenden Dateien zeigte. Löschkonzept Regel 3 und 6:
kein Parkplatz.

## Umsetzung

**Gelöscht** (`git rm`): `rig/greenfield-systemtest/` (Treiber, Executor-Arme, Auswertungen, `results-*.json`,
`blind-cr682/`, `results/{gc-run-devstral-v9,gc-run-opus5}.graph.json` — Regel 5, kein Leser mehr),
`rig/code-test/`, `rig/referenz-change/`, `rig/dummy-slicer/`, `rig/sigllm-spezifikation/` (Prompt und
Antwortblatt leben seit CR-GC-738 in `rig/aufgaben/sigllm-prosa/`), `rig/minimal-whitebox/{run-armC*,run-pull-*,
run-phase1-authoring,run-typediet,tally-toolcalls}` + `results/`, `.env.example`; Tests `systemtest-rig`,
`rig-zuege`, `rig-steuerung-transcript`, `rig-verhalten`.

**Ins Archiv** (Regel 2): `docs/archive/messung-executor/{greenfield-systemtest-README,auswertung-cr682,
auswertung-runde20,verlauf}.md`.

**Rohdaten** (Regel 1, lokal, gitignored): `rig/greenfield-systemtest/runs/` (2,2 GB), `rig/code-test/{runs,
node_modules}` und die Läufe der Reihe 2026-10-04 (`rig/runs/todo/{lokal,frontier}-1..3`, `lokal-nvfp4-1..3`,
`blind-kern*`) liegen in `~/.Trash/graphcode-rig-rohdaten-2026-10-05/` — der Autor leert. Lokal bleibt die Serie
2026-10-05 (`lokal-4..6`, `frontier-4..6`, `blind-serie-738`).

**Leser umgestellt:**
- `scripts/kongruenz.mjs` (neu): `binding`, `codeVerdict` aus `metrics.mjs` des Rigs; Leser `scripts/messung.mjs`
  (T-V4). Tests nach `tests/kongruenz.test.ts`.
- `auswertung/nachspielen.mjs`: `nachspielenRein(auditPfad)` — Nachspiel ohne Store (`applyCommands`), ersetzt
  `trajektorie.spieleNach`; `tests/generate.statemachine.test.ts` prüft `done ⇔ kein Fokus` jetzt am Golden, am
  Endstand seines Trails und an den beiden Referenzläufen `rig/aufgaben/todo/referenz/{lokal,frontier}` statt an
  lokalen opus5-Läufen, die es nur auf einer Maschine gab.
- `scripts/randbreiten.mjs`: Klasse `lauf` = die Referenzläufe des Rigs statt `greenfield-systemtest/runs`.
- `scripts/model-test-set.mjs`: Ausnahmen der gelöschten Tests entfernt, Begründung des Statemachine-Tests angepasst.
- Kommentare: `src/loop/executor.ts`, `src/surface/mcp-server.ts`; `.gitignore`; `rig/README.md` (Bestand),
  `rig/minimal-whitebox/README.md`, `docs/messung/kennzahlen.md` (Executor-Züge → Archiv),
  `docs/graphcode_arbeitspakete_konzept.md`, `README.md`, Konzept §5/§7.

**Selbstmodell** (`graph_mutate`, zwei Batches): `MOD-systemtest`, `FUNC-systemtest-{run,metrics,report,turn-analyse}`,
`FCHAIN-systemtest-run`, `REQ-greenfield-systemtest-dod`, `TEST-greenfield-systemtest`, `TEST-systemtest-evaluations`,
fünf `FLOW-systemtest-*`, fünf `SCHEMA-systemtest-*` gelöscht. Ersatz: `MOD-rig` (`rig/`), `MOD-auswertung`
(`auswertung/`), `FUNC-rig-{lauf,serie,referenz}`, `FUNC-auswertung-{nachspielen,auswerten,blindurteil}` mit `realRef`,
`FCHAIN-rig-benchmark` unter `UC-loop-closure`, `REQ-rig-benchmark`, `TEST-rig` (`tests/rig-interaktiv.test.ts`),
`TEST-auswertung` (`tests/auswertung.test.ts`), `FLOW/SCHEMA-lauf-artefakte`, `FLOW/SCHEMA-benchmark-datensatz`.
Offene Warnungen: FC-04 (Kette ohne ACTOR-Rand), R-31 an drei FUNC — der Rand des Rigs ist der Autor am Terminal,
kein modellierter Akteur; bewusst offen.

**Unverändert:** `tests/fixtures/perf-basis.graph.json`, `beispielgraphen/graphcode.graph.json` (eingefroren),
Kommentare, die eine Messung benennen („gemessen an opus5-5"), `docs/graphcode_leitlinie.md` (Autor; s. u.).

## Vorschlag für die Leitlinie §9.4/§9.5 (ändert der Autor)

- §9.4 Tabelle: T-V5, T-E3, T-E10, T-E11, T-M5 → Aufbau `rig/` + `auswertung/` (`verhalten`, `kennzahlen`,
  `blindurteil`, `schatten`), Eingang `rig/runs/<aufgabe>/<arm>-<nr>/`, Ergebnis `docs/messung/benchmark.md`;
  T-M2 (Steuern im Lauf) und T-E9/T-E5 interaktiv: **ohne Aufbau** bis ITEM-2026-745; T-C1/T-E4/T-E5 (Code):
  **ohne Aufbau** bis ITEM-2026-746 (Stufe `code` nach SRR+PDR im selben Rig); T-E2 → `scripts/whitebox-messung.mjs`
  nach ITEM-2026-744; T-C3 (Referenz-Change) entfällt — T-E1 läuft als Dauermessung (`cr-messung`).
- §9.4 „Referenz": je Aufgabe × Arm der Referenzlauf unter `rig/aufgaben/<name>/referenz/<arm>/` (Graph, graphcode-Log,
  LLM-Log, Stempel); der Autor tauscht ihn mit `treiber.mjs referenz`.
- §9.5: Löschkonzept §6 des Messaufbau-Konzepts als Regelsatz übernehmen („ohne Eingang → entfernen und Item für den
  Ersatz").

## Verifikation

- `npx vitest run tests/{auswertung,kongruenz,generate.statemachine,randbreiten,messung,verify-model.completeness,
  rig-interaktiv}.test.ts`: 7 Dateien, 55 Tests grün.
- `npm run verify:full CR-GC-740` (2026-10-05): 201 Dateien, 1752 Tests grün (vorher 204 / 1826 — drei Dateien gelöscht,
  eine neu); Spur CODE, Auswahl 85/201, Schlupf 0 (Folge ohne Schlupf 2/10).
- Kongruenz: RC-Regeln (`conformanceViolations` am exportierten Modell, Wurzel = Repo): kein RC-01/RC-02/RC-10 an den
  neuen Knoten — alle sechs `realRef` und beide `testRefs` lösen auf; `MOD-rig`/`MOD-auswertung` tragen `path`.
  Offen bleiben RC-07 (CR-Knoten offener CRs, u. a. dieser) und RC-04 (15 SCHEMA, vorbestehend).
- Nachgezogen nach dem Volllauf (nur Doku und ein Fixture-Pfad): `rig/minimal-whitebox/jobs.mjs` liest die
  Kalibrier-Fixture J1 jetzt aus `beispielgraphen/dummy-slicer.graph.json` (aus `rig/dummy-slicer/model/` übernommen,
  sha256/12 `67f95860f44c` — der Spike-Graph hatte doch einen Leser, Regel 5), `beispielgraphen/README.md`,
  `docs/articles/07` (zwei tote Links auf `results/`), `rig/minimal-whitebox/README.md` (Alt-Text ins Archiv).
