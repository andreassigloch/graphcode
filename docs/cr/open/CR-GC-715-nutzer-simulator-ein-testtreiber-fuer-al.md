# CR-GC-715: Nutzer-Simulator: EIN Testtreiber für das interaktive Rig — drückt Enter auf jeden `vorschlag`, beantwortet Fragen aus dem Antwortblatt

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-645 (idea)
**Erstellt:** 2026-09-28 · **umgeschrieben:** 2026-10-03 (Autor: interaktiv ist der Hauptfall, Executor eingefroren, S2 ersetzt)

---

## Befund

Bis 2026-10-03 war der Simulator als Automode-Treiber beschrieben („autonom bis spec ready + code ready“, Ketten A/D2
über `graphcode run` oder `graph_delegate`). Dieser Automodus ist jetzt Testmodus, nicht Zielbild; der Executor ist
eingefroren. Die Proben G–J und der Frontier-Arm B (2026-10-03, `rig/agentdiary/messung-rollen-todo.md`) haben den
interaktiven Ablauf von Hand gefahren: Start-Prompt → Agent fragt und plant → „Ja, Schritt 1“ → je Zug der
vorbefüllte `vorschlag`. Von Hand heißt: ohne Stempel, N = 1–4, und mein Simulator hat die Fragen des Agenten nie
beantwortet — J und Frontier B setzten darum Annahmen.

## Ziel

**EIN** Testtreiber für beide Arme des interaktiven Rigs (Leitlinie §9.4/§9.5, T-E3):

- startet den Client headless mit dem Start-Prompt des Korpus — `opencode run --attach` (Arm `modellieren lokal`,
  qwen3.8 über sigllm) oder `claude -p --resume` (Arm `modellieren Frontier`, Opus); gleiche Anweisung in beiden
  Armen (OpenCode-Agent `modellieren` bzw. dieselbe Datei als CLAUDE.md);
- liest nach jedem Zug den `vorschlag` (lokal: `.graphcode/vorschlag.txt` aus dem Plugin; Frontier: aus der
  Antwort von `graph_mutate` im Stream) und schickt ihn unverändert als nächsten Zug — das ist das Enter des Nutzers;
- beantwortet Fragen des Agenten aus einem festen **Antwortblatt** des Korpus (Auftraggeber-Wissen); was dort nicht
  steht, beantwortet er mit „offen, bitte als offen führen“ — nie erfunden. Eine Frage erkennt er an der letzten
  Agenten-Antwort (Fragezeichen oder `AskUserQuestion`); dann geht die Antwort vor dem Vorschlag;
- endet nach fester Zugzahl oder wenn der Vorschlag die Freigabe nennt („Fasse das Modell zusammen …“);
- schreibt je Lauf dieselben Artefakte (Audit, Stream/OpenCode-DB-Auszug mit Denken, Graph-Export, Fragen und
  Antworten) mit `openMeasured`-Stempel, damit `report.mjs`, Blindurteil und die Bedarfsanalyse (T-E9, OpenCode-Spur
  folgt als eigenes Item) für beide Arme gleich rechnen.

Je Zug gemessen: Dauer, Schritte, Gate-Ablehnungen, Steuerwert (Audit); Zug 1: Fragenzahl; am Ende Blindurteil.

## Umfang

`rig/interaktiv/` (Treiber, Antwortblatt je Korpus, Anbindung an `run.mjs`), Korpus zunächst Todo-Liste
(Start-Prompt und Antwortblatt aus `todo-local/README.md` und Probe-Antworten), dann sigllm-Prosa. Die Arme
`opus5`/`gcrun` des Greenfield-Rigs bleiben eingefroren stehen (S2 alt), kein paralleler Treiber für dieselbe Frage.

## Akzeptanz

- Beide Arme auf dem Todo-Korpus, N ≥ 3, je Lauf eine Zeile in `docs/messung/verlauf.md` mit Stempel.
- Fragen und Antworten des Simulators im Lauf protokolliert; kein erfundener Wert (Blindurteil O-Punkte 0).
- T-E3-Kriterium der Leitlinie ist aus den Artefakten berechenbar (Spannen je Zug, Fragenzahl Zug 1, Blindurteil).

## Umsetzung (2026-10-04)

| Datei | Inhalt |
|---|---|
| `rig/interaktiv/treiber.mjs` | Lauf: Repo aus Vorlage, Züge, Artefakte, Stempel (`openMeasured` am Export), Zeile |
| `rig/interaktiv/arme.mjs` | lokal (`opencode serve` + `run --attach`, Vorschlag aus `vorschlag.txt`, Denken aus `opencode.db`) · frontier (EIN `claude -p` mit stream-json-Eingabe, Vorschlag aus dem Stream, Denken aus `thinking`) |
| `rig/interaktiv/simulator.mjs` | rein: Fragen erkennen, Antwortblatt einmal, sonst Vorschlag; Ende Freigabe/Zuglimit |
| `rig/interaktiv/auswertung.mjs` | Kennzahlen je Lauf, Zeile nach `docs/messung/interaktiv.md` |
| `rig/interaktiv/korpus/todo.json` | Start-Prompt, Antwortblatt (Antworten des Autors im Handlauf), Raster P01–P11 / O01–O05 |
| `tests/rig-interaktiv.test.ts` | Simulator, Kennzahlen, Prompt-Umschrift |
| `rig/README.md`, `.gitignore` | Abschnitt interaktiv; `rig/interaktiv/runs/` intern |

Abweichungen vom Ziel oben: die Zeilen stehen in einer eigenen Tabelle `docs/messung/interaktiv.md` — die Spalten von
`verlauf.md` sind die des Executor-Rigs. Der Frontier-Arm läuft nicht über `claude -p --resume` (ein neuer Prozess je
Zug startete einen neuen Host und verlöre dessen Sitzungsgedächtnis, CR-GC-734), sondern als EIN Prozess mit
Nachrichten über stdin. Beide Arme entstehen aus derselben Vorlage, nicht aus `todo-frontier-b`.

Nachtrag 2026-10-04 abends (Entscheid Autor): Läufe enden am Kern (erster Analyse-Vorschlag von graphcode) — die
Analysen sprengten lokal das Kontextfenster (lokal-2: `finish: length` bei 72 000 Zeichen Denken, danach dreimal
`ContextOverflowError`). Der Vergleich ist auf den Kern normiert; die 12-Züge-Läufe stehen als Rohdaten (Reihe 1).
Neu: `--modell`/`--arm` für weitere Arme, Abbrüche je Zug (Ausgabelimit, Fehler) aus OpenCode-DB bzw. Stream.

