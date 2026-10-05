# Messaufbau — Rig, Auswertung, Beispielgraphen

Stand 2026-10-05, vom Autor freigegeben (Entscheide unten in §7). Ordnet, was unter `rig/` gewachsen ist, nach
drei Dingen, die heute vermischt liegen — und sagt, was davon bleibt, wohin es geht und was gelöscht wird.
Begriffe sind die der Leitlinie (§9.4: Aufgabe, Referenz, Arm, Treiber, Stempel); kein neuer kommt dazu.

| Ding | tut | hinterlässt | liegt in |
|---|---|---|---|
| **Rig** | fährt Läufe: Aufgabe → Arm → Züge bis „SRR und PDR bestanden" | je Lauf ein Verzeichnis mit Artefakten | `rig/` |
| **Auswertung** | rechnet über die Artefakte eines Laufs; deterministisch bis auf das Blindurteil | je Lauf einen Datensatz; ein laufendes Dokument | `auswertung/` → `docs/messung/` |
| **Beispielgraphen** | eingefrorene Graphen als Eingabe für Rang-, Kennzahl- und Regressionsfragen | — | `beispielgraphen/` |

Daneben, unverändert: die **S1-Messungen** am eigenen Modell (`scripts/messung.mjs` → `docs/messung/stand.md`,
`randbreiten.mjs`, `grenzmenge.mjs`, `retro-kpi.mjs`, `cr-messung.mjs`). Sie fahren keine Läufe und rechnen
nicht über Läufe; sie bleiben in `scripts/`.

## 1. Zielbild

```
rig/
  README.md            was ein Rig ist, die eine Regel (openMeasured), wie ein Lauf endet
  treiber.mjs          EIN Treiber: Aufgabe × Arm × Modell → Lauf; --serie fährt das Standard-Set
  simulator.mjs        der Nutzer: Start-Prompt, Antwortblatt, Enter auf den Vorschlag, Sitzungswechsel
  arme.mjs             die Clients: lokal (OpenCode) · frontier (Claude Code); Repo aus der Vorlage
  serie.json           das Standard-Set: Aufgaben × Arme (mit Modell) × N, Zug- und Sitzungsgrenzen
  aufgaben/
    todo/aufgabe.json          Start-Prompt, Antwortblatt, Raster (P*/O*), Quelle, Sequenz
    todo/referenz/<arm>/       der Referenzlauf: graph.json · audit.jsonl · lauf.json · denken.json · stempel.json
    sigllm-prosa/aufgabe.json  Auftrag als Prosa, Projektdefinition als Antwortblatt, Raster, Sequenz
  runs/                (gitignored) je Lauf: lauf.json · audit.jsonl · graph.json · denken.json · todo/

auswertung/
  README.md            welche Analyse was rechnet, woraus, für welchen Test der Leitlinie
  auswerten.mjs        Runner: Läufe → Datensätze → docs/messung/benchmark.jsonl → benchmark.md
  nachspielen.mjs      Graph eines Laufs nach n Mutationen aus dem Audit, durchs echte Gate; Readiness dazu
  kennzahlen.mjs       Züge, Sitzungen, Dauer, Fragen, Schritte, Mutationen, Abbrüche, Gate-Zug
  verhalten.mjs        Ablehnungen je Regel, Dubletten, Struktur gegen die Referenz (T-E11, T-V5)
  schatten-suggest.mjs was graph_suggest je Zug vorgeschlagen hätte (T-M5)
  blindurteil.mjs      Spec rendern, Gutachter-Vorgabe, Gutachten einlesen (T-E10); spec-render.mjs dazu

beispielgraphen/
  README.md            Herkunft, Stand, sha256 je Graph — eingefroren
  *.graph.json         bok, graph-view-edit, graphcode, moneyflow, gc_test-graphview,
                       sigllm-v98 (Golden), gc-run-{opus5,haiku45,devstral-v9,devstral-v14}

docs/messung/
  benchmark.jsonl      ein Datensatz je Lauf, nur angehängt — das Gedächtnis des Benchmarks
  benchmark.md         GENERIERT aus der jsonl: Stand je Aufgabe × Arm, darunter der Verlauf
  stand.md · kennzahlen.md · testauswahl.jsonl   wie heute (S1)
```

`rig/` ist **das** Rig, nicht ein Ordner voller Rigs. Kommt ein zweites (etwa ein Code-Test nach der
Modellphase), bekommt es ein eigenes Verzeichnis daneben — kein Unterordner, kein zweiter Treiber im selben.

## 2. Das Rig

**Lauf** = frisches Repo aus der Vorlage (`todo-local`, eingecheckter Stand ohne Modell) → Start-Prompt der
Aufgabe → je Zug: Antwort lesen, Simulator entscheidet die nächste Nachricht → Ende, sobald die Readiness
**SRR und PDR** als bestanden meldet (geprüft nach jedem Zug mit Mutation, am Nachbau aus dem Audit), sonst
bei Freigabe-Bitte oder Zuglimit. Jede Analyse und die Rückkehr zur Strukturarbeit laufen in einer frischen
Sitzung (neuer Client-Prozess, derselbe Store). So steht es seit CR-GC-715 in `treiber.mjs`; neu ist nur der Ort.

**Aufgabe** (`aufgaben/<name>/aufgabe.json`): `start` (der Prompt), `antwortblatt` (was der Nutzer auf Fragen
antwortet — das Bedienskript), `punkte` (Raster P*/O* für das Blindurteil), `quelle`, `sequenz`. Für `todo` ist das heute `korpus/todo.json`;
für `sigllm-prosa` liegen die Teile unter `rig/sigllm-spezifikation/` (Auftrag, Projektdefinition,
`auftragspunkte.json`, Golden) und werden zu einer Aufgabe zusammengezogen — die Leitlinie nennt S2 auf
sigllm-prosa.

**Sequenz** (`aufgabe.sequenz`, Vorgabe `["modellieren"]`): die Stufen eines Laufs, jede mit eigener
Ende-Regel. Heute gibt es eine — `modellieren` endet bei SRR und PDR. Code-Erzeugung oder eine andere Folge
(etwa „modellieren → code → abnahme") kommt als weitere Stufe in dieselbe Schleife: der Treiber kennt die Stufen,
die Stufe kennt ihr Ende und ihre Artefakte. Nicht jetzt gebaut, aber so geschnitten, dass es ein Modul und
kein zweiter Treiber wird (Entscheid Autor 2026-10-05).

**Referenzlauf** (`aufgaben/<name>/referenz/<arm>/`): je Standardfall (Aufgabe × Arm) liegt **ein** Lauf
im Repo vorrätig — Referenzgraph, graphcode-Log (`audit.jsonl`), LLM-Log (`lauf.json` mit Nachrichten und
Antworten, `denken.json`) und sein Stempel. Zusammen rund 250 KB; das Lauf-Repo (60 MB) bleibt draußen. Er ist
die Referenz der Leitlinie §9.4 für diese Aufgabe: `verhalten` misst die Struktur gegen seinen Graphen, Tests
spielen sein Audit nach (statt lokaler Läufe, die niemand außer dem Autor hat), und eine Sequenzstufe nach dem
Modellieren kann auf seinem Graphen aufsetzen, ohne erst zu modellieren. `treiber.mjs referenz runs/<lauf>`
tauscht ihn aus — der Autor entscheidet, welcher Lauf Referenz wird; der alte geht mit dem Tausch.

**Arm** = Client × Modell. Die Vorlage trägt das lokale Vorgabemodell (seit 2026-10-05 `qwen3.8:27b-nvfp4`);
`--modell` tauscht es, `--arm` benennt die Kennung. Frontier = Claude Code mit `claude-opus-5-5`.

**Serie** (`serie.json`) = das Standard-Set der Leitlinie als Datei: Aufgaben × Arme × N (≥ 3), Zug- und
Sitzungsgrenzen. `treiber.mjs --serie` fährt, was für den aktuellen Stempel fehlt. Ein einzelner Lauf wie
heute über Flags.

**Stempel** je Lauf: Graph (sha, Umfang), Policy, Regel- und Code-Stand (`stampLine`) — dazu neu der Commit
der Vorlage, weil der Prompt dort lebt und S2 „jede Änderung am Prompt" messen soll.

**Artefakte** je Lauf unter `runs/<arm>-<nr>/` sind die Schnittstelle zur Auswertung: `lauf.json` (Züge mit
Sitzung, Nachricht, Antwort, Dauer, Werkzeugen, Audit-Delta, Gates), `audit.jsonl`, `graph.json` (Export des
Hosts), `denken.json`, das Lauf-Repo. Der Treiber rechnet selbst nichts außer dem Ende.

## 3. Die Auswertung

`node auswertung/auswerten.mjs [runs/…] [--analysen=a,b,…]` — ohne `--analysen` laufen **alle**
deterministischen Analysen (Entscheid: im Zweifel alles); das Blindurteil hat zwei Schritte, weil ein
Gutachter dazwischen sitzt. Jede Analyse ist ein Modul mit einer Funktion `lauf → Teil-Datensatz`; der Runner
fügt die Teile zu einem Datensatz je Lauf, hängt ihn an `docs/messung/benchmark.jsonl` (ein Lauf = eine Zeile,
Schlüssel `arm-nr` + Stempel; erneutes Auswerten ersetzt die Zeile) und erzeugt `benchmark.md` neu.

| Analyse | Frage | Eingang | Test | Herkunft |
|---|---|---|---|---|
| `kennzahlen` | Wie lief es: Züge, Sitzungen, Dauer je Zug, Fragen in Zug 1, Schritte, Mutationen angenommen/abgelehnt, Abbrüche, Zug an dem SRR bzw. PDR fiel | `lauf.json` | T-E3 | `rig/interaktiv/auswertung.mjs` |
| `nachspielen` | Graph und Readiness nach n Mutationen | `audit.jsonl`, Lauf-Repo | Grundlage | `auswertung.mjs` (ersetzt `nachbau.mjs`, `zuege.nachspielen`) |
| `verhalten` | Ablehnungen je Regel, Dubletten, Struktur gegen den Referenzlauf | `audit.jsonl`, `graph.json`, `referenz/<arm>/graph.json` | T-E11, T-V5 | `greenfield-systemtest/verhalten.mjs` ohne die Executor-Eingänge (`run-raw.log`, Preflight) |
| `schatten-suggest` | Was hätte `graph_suggest` je Zug vorgeschlagen, und wurde es berührt? | `audit.jsonl` | T-M5 | `greenfield-systemtest/schatten-suggest.mjs` |
| `blindurteil` | Deckt die Spec den Auftrag, ohne offene Werte zu erfinden? | `graph.json`, `aufgabe.punkte`, `aufgabe.start` | T-E10 | `greenfield-systemtest/blindurteil.mjs` + `spec-render.mjs`; Raster aus der Aufgabe statt fest aus sigllm |

**Laufendes Dokument** `benchmark.md`: oben je Aufgabe × Arm die jüngste Serie — Stempel, N, Spannen der
Kennzahlen, Blindurteil (P* ✓/~/✗, O* offen, erfunden, Dubletten) —, darunter der Verlauf aller Läufe. Der
Text wird generiert; die Deutung (T-E3 erfüllt oder nicht) schreibt der Autor in die Leitlinie, nicht in die
Tabelle. Die Zeilen vom 2026-10-04 (Schnitt am ersten Analyse-Vorschlag, „kern") bleiben als abgeschlossener
Abschnitt stehen und werden nicht in die jsonl übernommen: andere Ende-Regel, nicht vergleichbar.

Was so **nicht** mehr gerechnet wird und wofür ein Item entsteht: die Bedarfsanalyse (T-E9: was las das
Modell nach, hätte der Graph es geliefert) und die Turn-Bilanz (T-E5). Beide brauchen den rohen Strom je Zug;
der Treiber speichert ihn heute nicht. Erst speichern, dann klein neu schreiben — nicht die 543 Zeilen
`turn-analyse.mjs` am alten Ergebnisformat weiterziehen.

## 4. Beispielgraphen

Eingefrorene Kopien echter Exporte, nie Zeiger auf `docs/graph/` (Begründung in `rig/graphs/README.md`,
bleibt). Dazu kommen die vier Fixture-Graphen aus `greenfield-systemtest/results/` (Leser:
`tests/nd-similarity.test.ts`) und das Golden `sigllm-v98.graph.json` (Leser: fünf Tests, `randbreiten.mjs`,
die Aufgabe sigllm-prosa). Löschen nur, wenn `grep` keinen Leser mehr findet.

## 5. Bestand → Zielbild

| Heute | Ist | Entscheidung | Grund · Folge |
|---|---|---|---|
| `rig/interaktiv/{treiber,simulator,arme}.mjs`, `korpus/todo.json` | Rig | → `rig/`, `rig/aufgaben/todo/` | das eine Rig |
| `rig/interaktiv/auswertung.mjs` | Auswertung | → `auswertung/kennzahlen.mjs` + `nachspielen.mjs`; `normieren`/`bisErsteAnalyse` löschen | Einmal-Code für die Reihe vom 2026-10-04; ihre Zeilen stehen |
| `greenfield-systemtest/run.mjs`, `driver.mjs`, `prompt.txt`, `.gitignore`, `README.md` | Rig alter Definition (autonom, Executor) | **löschen** | Executor eingefroren; Läufe enden nicht bei SRR+PDR. T-V3, T-M2, T-C2 verlieren ihren Aufbau |
| `zuege.mjs`, `verlauf.mjs`, `metrics.mjs`, `report.mjs`, `faltung.mjs`, `steuerung.mjs`, `trajektorie.mjs`, `turn-analyse.mjs`, `nachbau.mjs` | Auswertungen über Executor-Runden, Claude-Stream, Golden-Trajektorie | **löschen** | Eingang entsteht nicht mehr (`run-raw.log`, `results.json`); Spike compose-faltung ist ausgewertet. Items: T-E9/T-E5 fürs interaktive Rig |
| `verhalten.mjs`, `schatten-suggest.mjs`, `blindurteil.mjs`, `spec-render.mjs` | Auswertung | → `auswertung/`, auf Lauf-Artefakte und Aufgabe umgestellt | rechnen über Audit und Graph, also auch über interaktive Läufe |
| `results-*.json` (50), `blind-cr682/` (19) | Rohdaten der Executor-Runden | **löschen** | Regel 1 unten; Ergebnis steht in `auswertung-*.md` |
| `auswertung-runde20.md`, `auswertung-cr682.md`, `docs/messung/verlauf.md` | Auswertungstexte der Executor-Zeit | → `docs/archive/messung-executor/` | Regel 2: Ergebnisse bleiben, am Ort des Executor-Abschlussberichts |
| `results/*.graph.json` (4) | Beispielgraphen | → `beispielgraphen/` | Leser `nd-similarity.test.ts` |
| `rig/graphs/` | Beispielgraphen | → `beispielgraphen/` | Leser `randbreiten.mjs`, Test |
| `sigllm-spezifikation/golden/sigllm-v98.graph.json` | Beispielgraph (Golden) | → `beispielgraphen/` | fünf Tests, `randbreiten`, `model-test-set` |
| `sigllm-spezifikation/{material-prosa/auftrag.md, material/…projektdefinition.md, golden/auftragspunkte.json}` | Aufgabe | → `rig/aufgaben/sigllm-prosa/` | Leitlinie S2 auf sigllm-prosa |
| `sigllm-spezifikation/{lauf*.env, prompt*.txt, golden/referenz-trail.jsonl, README.md}` | Executor-Konfiguration, Trajektorie | **löschen** | Eingang weg; `ergebnis.md` → Archiv |
| `rig/code-test/` | Rig für Code (T-C1, T-E4, T-E5), zwei Arme, Golden im Store | **löschen** (Empfehlung) | nicht die aktuelle Definition; baut auf dem Executor-Golden auf. T-C1 verliert seinen Aufbau — Nachfolger wäre eine Code-Phase nach SRR+PDR im selben Rig, eigener Entscheid |
| `rig/referenz-change/` | Aufgabe + Auswertung über ein Sitzungsprotokoll (T-E1, T-C3) | **löschen** (Empfehlung) | T-E1 läuft als Dauermessung (`cr-messung`, `retro-kpi`); „nur die Grundlinie", nie wiederholt. T-C3 verliert seinen Aufbau |
| `rig/minimal-whitebox/{measure,jobs,run-phase1}.mjs` | S1-Messung am eigenen Modell (T-E2) | → `scripts/whitebox-messung.mjs`, in `npm run messung` (das ist CR-GC-679B) | deterministisch, kein Lauf; gehört zu den S1-Messungen |
| `rig/minimal-whitebox/{run-armC*,run-phase1-authoring,run-typediet,tally-toolcalls}.mjs`, `results/` (69) | Executor-Arme, Rohdaten | **löschen** | Eingang `buildRoundInjection` ist Executor; SPIKE-RESULTS trägt das Ergebnis |
| `rig/dummy-slicer/` | fiktives Konsumenten-Repo, Spike 2026-06 | **löschen** | ausgewertet, kein Leser (Fixture `perf-basis` nennt nur Pfade) |
| `rig/moneyflow-struktur/`, `rig/agentdiary/` | lokal, nicht im Repo | moneyflow bleibt (S1-Positivkontrolle T-O4); agentdiary **lokal löschen** nach Freigabe | agentdiary = Executor-Kette D2 |
| `rig/interaktiv/runs/` (565 MB) | Rohdaten der Reihe 2026-10-04 | bleiben bis zur ersten Serie nach neuer Definition, dann löschen | Regel 1 |
| `.env.example` | Schlüssel für den Opus-Arm von `run.mjs` | **löschen** | einziger Leser fällt |
| `docs/messung/interaktiv.md` | Tabelle des Rigs | → `docs/archive/messung-interaktiv-2026-10-04.md`, aus `benchmark.md` verlinkt (CR-GC-739) | andere Ende-Regel, nicht vergleichbar — Regel 2 |

Mitzuziehen: `tests/systemtest-rig.test.ts`, `rig-zuege`, `rig-steuerung-transcript` (fallen),
`rig-verhalten` (Blindurteil- und Verhalten-Teile → neue Testdatei), `generate.statemachine.test.ts`
(nutzt `trajektorie.spieleNach` und lokale opus5-Läufe — auf `nachspielen` und den Referenzlauf umstellen), Pfade in `nd-similarity`, `steer-optimum`, `generate.task`,
`apply-commands.kinds`, `randbreiten`, `scripts/model-test-set.mjs`, `scripts/randbreiten.mjs`,
`scripts/messung.mjs` (Texte zu T-V1/T-E2); Kommentare in `src/loop/executor.ts`, `src/surface/mcp-server.ts`;
`.gitignore`; das Selbstmodell (`TEST-greenfield-systemtest`, `REQ-greenfield-systemtest-dod`, FUNC-Knoten
mit `realRef` auf gelöschte Dateien) über `graph_mutate`. `tests/fixtures/perf-basis.graph.json` bleibt
unverändert — eingefrorene Fixture.

## 6. Löschkonzept

1. **Rohdaten sind entbehrlich, sobald ihr Ergebnis mit Stempel im laufenden Dokument steht.** Im Repo liegen
   keine Rohdaten (`runs/` ist gitignored). Lokal bleibt je Aufgabe × Arm die jüngste ausgewertete Serie als
   Reserve; die davor wird gelöscht.
2. **Auswertungstexte sind Ergebnisse.** Sie wandern ins Archiv (`docs/archive/`), nie in den Papierkorb.
3. **Code eines Rigs oder einer Auswertung geht, wenn sein Eingang nicht mehr entsteht oder seine Frage
   beantwortet ist** (Spike). Das ist das Kriterium der Leitlinie §9.5 („ohne Test-Zuordnung → entfernen"),
   um einen Fall erweitert: mit Test-Zuordnung, aber ohne Eingang → entfernen **und** Item für den Ersatz.
4. **Einmal-Code geht mit der Serie, der er diente** (`normieren`).
5. **Beispielgraphen bleiben**, solange ein Leser existiert (`git grep` auf den Dateinamen).
6. **Kein Parkplatz:** nichts wird „vorerst behalten". Was keine Entscheidung hat, bekommt eine.

## 7. Umsetzung

Reihenfolge so, dass das Repo nach jedem Schritt baut und die Suite grün ist. Je CR höchstens zehn
geänderte Logik-Dateien; reine Löschungen von Daten- und Ergebnisdateien zählen als ein Posten — das braucht
die Freigabe des Autors, sonst werden es sieben statt vier CRs.

| CR | Inhalt | Lane |
|---|---|---|
| 1 | `beispielgraphen/` anlegen: `rig/graphs/*`, `results/*.graph.json`, Golden umziehen; Leser umstellen (`randbreiten.mjs`, `model-test-set.mjs`, 6 Tests) | CODE |
| 2 | `rig/` neu: `interaktiv/*` eine Ebene hoch, `aufgaben/todo/`, `aufgaben/sigllm-prosa/` aus `sigllm-spezifikation`; Sequenz im Treiber; `serie.json`; Vorlage-Commit im Stempel; `treiber.mjs referenz`; erste Referenzläufe todo (lokal nvfp4, frontier); `rig/README.md` neu | CODE |
| 3 | `auswertung/`: Runner, `kennzahlen`, `nachspielen`, `verhalten`, `schatten-suggest`, `blindurteil`+`spec-render` umgestellt; `benchmark.jsonl/md`; `interaktiv.md` übernommen; Tests | CODE |
| 4 | Löschen: `greenfield-systemtest/` restlos, `sigllm-spezifikation/` Rest, `code-test/`, `referenz-change/`, `dummy-slicer/`, `minimal-whitebox` Executor-Teile + `results/`, `.env.example`; Auswertungstexte → `docs/archive/messung-executor/`; abhängige Tests; Kommentare; `.gitignore`; Selbstmodell | CODE + Modell |
| 5 | `scripts/whitebox-messung.mjs` aus `minimal-whitebox` Phase 1, in `npm run messung` (= CR-GC-679B, T-E2) | CODE |
| 6 | Items: Bedarfsanalyse/Turn-Bilanz interaktiv (T-E9, T-E5); Code-Phase nach SRR+PDR (T-C1) — falls gewollt | — |

Vor CR 4 fährt die erste Serie nach neuer Definition (`--serie`, todo, lokal nvfp4 × 3, frontier × 3), damit
`benchmark.md` nicht leer startet und die Rohdaten vom 2026-10-04 nach Regel 1 gehen können.

**Entscheide des Autors** (2026-10-05): `code-test` und `referenz-change` werden gelöscht; Lösch-CRs dürfen
mehr als zehn Dateien tragen; Sequenzen (Code-Erzeugung u. a.) müssen automatisiert testbar werden; je
Standardfall liegt ein Referenzlauf mit Graph, graphcode-Log und LLM-Log vorrätig und wird bei einer neuen
Referenz ausgetauscht. Offen: `rig/agentdiary` (lokal, intern — trägt Auswertungstexte, die nach Regel 2 nicht
in den Papierkorb gehören; Ort nennt der Autor). Leitlinie §9.4/§9.5: Textvorschlag nach CR 4, ändern tut der
Autor.
