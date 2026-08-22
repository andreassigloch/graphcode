# CR-GC-393 — Der Executor existiert im Code, aber nicht im Modell

**Status:** open · **Angelegt:** 2026-08-22 · **Basis:** graphVersion 168 · **Umsetzung:** dieses Repo
(reine Modellarbeit durchs Gate, kein Code)

## Problem

30 der 66 Quelldateien unter `src/` tragen keinen modellierten FUNC. Das ist keine kosmetische
Lücke: die Datei→MOD-Auflösung der Konformanz-Regeln läuft ausschließlich über
`FUNC.realRef.file` plus die `allocate`-Kante (`conformance-rules.js`, `resolveMod`). Eine Datei ohne
FUNC ist für RC-04/RC-05 unsichtbar, und ihr Modul erscheint in MT-02 als unzusammenhängend.

Gemessen bei graphVersion 168:

| Symptom | Zahl | Zusammenhang |
|---|---|---|
| `RC-05` undokumentierte Modulgrenzen-Importe | 3 | der Regeltext listet die 30 Dateien wörtlich als *unassigned* |
| `MT-02` LCOM4 über der Schwelle | 5 | `MOD-dashboard` = 11 FUNCs in 11 getrennten Gruppen |
| `R-31` nicht verdrahtete FUNC | 27 | teilweise; die Gegenstücke fehlen, weil die Funktion fehlt |
| `RD-01` unerfüllte Leaf-REQ | 4 | 2 davon nur deshalb, weil ihr Erfüller kein Knoten ist |

Der größte zusammenhängende blinde Fleck ist der **Executor**: `graphcode run` — 1873 Zeilen über
fünf Dateien, mit CR-GC-278/279/280/284–291/320 gebaut — hat **weder ein MOD noch einen einzigen
FUNC**. `FUNC-rank-candidates` (`src/executor-rank.ts`) ist der einzige Knoten daraus und hängt an
`MOD-steering`. Deshalb findet `REQ-one-driver-local-and-frontier` keinen Erfüller, obwohl
`tests/executor.test.ts` die Eigenschaft grün prüft.

## Warum nicht einfach 30 FUNCs anlegen

graphcode ist Harness, kein Code-Modell (`CLAUDE.md`: *„IS NOT … a code extractor/slicer"*). Ein
FUNC pro Datei wäre Modellieren für die Kennzahl. Der CR legt deshalb zuerst das Kriterium fest und
wendet es dann auf **einen** Cluster an.

**Kriterium (Vorschlag zur Bestätigung):** eine Datei bekommt einen FUNC, wenn sie ein exportiertes
Symbol trägt, das *entweder* über eine Modulgrenze hinweg aufgerufen wird *oder* eine REQ erfüllt,
die heute keinen Erfüller hat. Alles andere bleibt bewusst unmodelliert.

## Umfang dieses CR — nur der Executor-Cluster

1. `MOD-executor` anlegen (`path: src/executor*`), `SYS-graphcode -compose-> MOD-executor`.
2. Vier FUNC durchs Gate, jeder mit `realRef` auf sein exportiertes Symbol:
   - `FUNC-run-executor` — `src/executor.ts`, `runExecutor` (die Treiberschleife)
   - `FUNC-build-round-injection` — `src/executor-prompt.ts`, `buildRoundInjection`
   - `FUNC-extract-mutate` — `src/executor-parse.ts`, `extractMutateFromText` (Prosa-Recovery)
   - `FUNC-nd-similarity` — `src/nd-similarity.ts`, `computeND` (Near-Duplicate-Erkennung)
3. `FUNC-rank-candidates` von `MOD-steering` nach `MOD-executor` umhängen — alte `allocate`-Kante
   löschen, keine parallelen Pfade.
4. `FUNC-run-executor -satisfy-> REQ-one-driver-local-and-frontier` (Beleg:
   `tests/executor.test.ts`, ein Treiber für lokales und Frontier-Backend ohne Code-Verzweigung).
5. Die vier neuen FUNC in `FCHAIN-steering-loop` einhängen und über bestehende FLOWs verdrahten
   (`FLOW-round-prompt`, `FLOW-formatE-candidates`, `FLOW-suggested-edit`) — **nur wo der Aufruf im
   Code belegt ist**; wo kein Fluss existiert, bleibt R-31 offen statt einen zu erfinden.

`src/run-verb.ts` (`executeRun`) bleibt draußen: das ist der CLI-Einsprung, gehört zu `MOD-cli` und
wird im Folge-CR mit dem übrigen CLI-Cluster behandelt.

## Akzeptanzkriterien

- [ ] `MOD-executor` existiert, trägt `path`, und `graphcode`-Konformanz zählt `src/executor.ts`,
      `executor-prompt.ts`, `executor-parse.ts`, `nd-similarity.ts` nicht mehr als *unassigned*.
- [ ] `RD-01` fällt von 4 auf 3 (`REQ-one-driver-local-and-frontier` hat einen Erfüller).
- [ ] `R-20` feuert nicht: jeder neue FUNC trägt eine `realRef`, deren Symbol in der genannten Datei
      auflösbar ist.
- [ ] Fehler bleiben 0, `graph_readiness.compliance` bleibt 1,000.
- [ ] `MOD-steering` verliert eine Funktion; `R-04` für `MOD-steering` wird neu gemessen und der Wert
      im Abschluss genannt — auch wenn er sich nicht verbessert.
- [ ] `npm test` unverändert grün (Modelländerung, kein Code).

## Ausdrücklich nicht in diesem CR

Die übrigen 26 Dateien (CLI-, Tools-, Viewer-, Config-Cluster). Sie bekommen eigene CRs, sobald das
Kriterium oben bestätigt ist. Ebenso bleiben die `FUNC-block-*`-Verstöße aus `R-02`/`R-31` außen vor
— die behandelt CR-GC-391 an der richtigen Stelle, in den Regeln.
