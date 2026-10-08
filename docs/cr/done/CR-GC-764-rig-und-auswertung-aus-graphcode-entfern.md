# CR-GC-764: Rig und Auswertung aus graphcode entfernen (Split nach graphanalyze, zweite Haelfte)

**Status:** ✅ Done (2026-10-08)
**Typ:** aus Item ITEM-2026-787 (idea)
**Erstellt:** 2026-10-08
**Item:** bok/items/ITEM-2026-787.json (Lane: graph)

---

Rig und Auswertung leben seit 2026-10-08 im privaten Repo dev/graphanalyze (Commit 86b925d, 85 Dateien, 40 Tests gruen, energymanager-Auswertung mit gleichen Zahlen nachgefahren). Kopplung dort: eine Datei graphcode.mjs, die eine gebaute graphcode-Arbeitskopie laedt — graphcode braucht dafuer keine neuen Exporte. In graphcode steht noch die Kopie: rig/ (40 Dateien), auswertung/ (8), tests/auswertung.test.ts, tests/rig-interaktiv.test.ts, docs/messung/benchmark.*, docs/archive/messung-*, docs/graphcode_messaufbau_konzept.md. Umbau (se-umbau, keine parallelen Pfade): Dateien loeschen; im Modell MOD-rig, MOD-auswertung, FUNC-rig-lauf/-serie/-referenz, FUNC-auswertung-auswerten/-blindurteil/-nachspielen, FCHAIN-rig-benchmark, FLOW/SCHEMA-benchmark-datensatz, REQ-rig-benchmark, REQ-benchmark-harness, TEST-rig, TEST-auswertung ueber das Gate entfernen; Leitlinie (Messmethoden T-E3, T-E10, T-E11, T-M5, T-V5, Abschnitt 9.4/9.5), README, CLAUDE.md und .gitignore auf graphanalyze umverweisen; rig/runs (1,7 GB lokal) verschieben. Offen: tests/generate.statemachine.test.ts ist ein Produkt-Test und benutzt nachspielenRein aus auswertung/ — die Funktion (20 Zeilen, rein) bleibt in graphcode oder der Test zieht mit um. Mehr als 10 Dateien: ueberwiegend Loeschungen, Schnitt vor dem Start festlegen. Danach ITEM-2026-786 (History).

---

## Entscheidungen des Autors (2026-10-08)

- Zwei CRs: dieser löscht Dateien und Modellknoten (ein mechanischer Zug), CR-GC-765 zieht Leitlinie und Verweise nach.
- `nachspielenRein` (20 Zeilen, rein) bleibt als Testhelfer in graphcode; `tests/generate.statemachine.test.ts` zieht nicht um.

## Umfang laut `graph_impact` (graphVersion 638)

Zu entfernen, in EINEM Batch durchs Gate:

| Knoten | hängt an |
|---|---|
| `MOD-rig`, `MOD-auswertung` | `SYS-graphcode -compose->`; je drei `allocate`; `relation` von CR-GC-740/741/742 |
| `FUNC-rig-lauf`, `-serie`, `-referenz` | `realRef` auf `rig/treiber.mjs` (zeigt nach dem Löschen ins Leere, RC-01) |
| `FUNC-auswertung-auswerten`, `-blindurteil`, `-nachspielen` | `realRef` auf `auswertung/*.mjs` |
| `FCHAIN-rig-benchmark` | `UC-loop-closure -compose->`; `compose` auf alle sechs FUNC |
| `FLOW-lauf-artefakte`, `FLOW-benchmark-datensatz`, `SCHEMA-benchmark-datensatz` | `io` nur innerhalb der sechs FUNC |
| `REQ-rig-benchmark` | `satisfy` von allen sechs FUNC, `verify` von beiden TEST, sonst nichts |
| `TEST-rig`, `TEST-auswertung` | `testRefs` auf die zwei Testdateien, die gehen |

Bleibt, mit benannter Folge:

- **`UC-loop-closure`** (Status open) verliert seine einzige Wirkkette. Der Anwendungsfall „Schwellen am Trail
  kalibrieren" ist ab jetzt ein Anwendungsfall von graphanalyze. Vor dem Zug entscheiden: UC mit entfernen oder die
  Warnung „UC ohne Wirkkette" als benannte Abweichung führen. Empfehlung: entfernen.
- **`REQ-benchmark-harness`** (Status open, „nur Requirement") hängt an `REQ-token-efficiency`, nicht am Rig. Bleibt.

Testspur laut `graph_tests`: `vitest run tests/auswertung.test.ts tests/rig-interaktiv.test.ts` — beide Dateien
gehen mit; sie laufen in graphanalyze (40 Tests grün, Commit 86b925d).

## Was der Graph nicht zeigte (grep nach den Pfaden)

Zwei Produkt-Tests und ein Skript lesen die Referenzläufe der Aufgabe `todo` als Testdaten:

- `tests/generate.statemachine.test.ts` — `rig/aufgaben/todo/referenz/{lokal,frontier}/graph.json` und deren
  `audit.jsonl` über `nachspielenRein`
- `tests/generate.stufen.test.ts` — dieselben zwei `graph.json`
- `scripts/randbreiten.mjs` (Familie `lauf`) samt `tests/randbreiten.test.ts`

Lösung: die zwei Referenzläufe (`graph.json`, `audit.jsonl`) gehen als **eingefrorene Kopie** nach
`beispielgraphen/todo-referenz/<arm>/`, wie jeder andere Korpus dort. Die lebende Referenz pflegt graphanalyze; die
Kopie hier ist Testeingabe und wandert nur mit Absicht.

## Dateien

Löschen: `rig/` (40), `auswertung/` (8), `tests/auswertung.test.ts`, `tests/rig-interaktiv.test.ts`,
`docs/messung/benchmark.jsonl`, `docs/messung/benchmark.md`, `docs/graphcode_messaufbau_konzept.md`,
`docs/archive/messung-agentdiary/` (9), `docs/archive/messung-executor/` (5),
`docs/archive/messung-interaktiv-2026-10-04.md`.

Ändern (7): `tests/generate.statemachine.test.ts`, `tests/generate.stufen.test.ts`, `scripts/randbreiten.mjs`,
`tests/randbreiten.test.ts` (nur falls Pfade dort stehen), `scripts/model-test-set.mjs` (zwei Einträge, zwei
Texte), `.gitignore` (Rig-Zeilen), neu `tests/helpers/nachspielen-rein.ts`.

Verschieben: `rig/runs/` (1,7 GB, nicht versioniert) nach `graphanalyze/rig/runs/`.

Mehr als 10 Dateien, weil der Zug überwiegend löscht; geändert werden sieben.

## Abnahme

- `git grep` nach `rig/` und `auswertung/` trifft in `src/`, `tests/`, `scripts/` nur noch Herkunftskommentare.
- `graph_readiness`: kongruent, keine RC-Verstöße; Bindungsquote ausgewiesen.
- `npm run verify:full CR-GC-764` grün.
- In graphanalyze: `npm test` grün gegen den Stand nach diesem CR.

## Nicht in diesem CR

Leitlinie, `README.md`, `CLAUDE.md`, `docs/messung/kennzahlen.md`, `beispielgraphen/README.md`, der Text zu T-V1 in
`scripts/messung.mjs` → CR-GC-765. Die öffentliche History → ITEM-2026-786.

## Ergebnis (2026-10-08)

- **Dateien:** 75 geändert, 7 055 Zeilen entfernt, 39 neu (`a65ef0f8`). `rig/runs` (1,7 GB) liegt in graphanalyze.
- **Modell:** 16 Knoten in einem Batch durchs Gate entfernt (Graph-Version 641 → 642, 58 Mutationen): zwei MOD,
  sechs FUNC, `FCHAIN-rig-benchmark`, zwei FLOW, zwei SCHEMA (`SCHEMA-lauf-artefakte` kam beim Lesen der Kanten dazu),
  `REQ-rig-benchmark`, zwei TEST. Einziger Befund am Zug: RD-04 an `SYS-graphcode`, bestand vorher.
- **Abweichung vom Plan:** `UC-loop-closure` bleibt. Der Trockenlauf zeigte, dass der Anwendungsfall eine zweite
  Wirkkette trägt (`FCHAIN-loop-closure`); `graph_impact` listet nur eingehende Kanten, die Annahme „einzige
  Wirkkette" war falsch. Umfang des CR-Knotens: `UC-loop-closure`, `REQ-benchmark-harness`.
- **Kongruenz:** keine RC-01 (kein `realRef` zeigt ins Leere); Import-Deckung 109 von 110 Dateien
  (`src/index.ts` ohne Zuordnung, bestand vorher). RC-04 (13) und RC-07 (28) stehen im Bericht und stammen nicht aus
  diesem Zug; gemessen vom laufenden Host, der seit 2026-10-07 läuft.
- **Volllauf** (`verify:full`, sauberes Arbeitsverzeichnis auf `a65ef0f8` mit dem exportierten Modell): 200 von 201
  Dateien grün, 1 755 Tests. Rot: `tests/distribution.test.ts` — das gepackte Paket importiert `countByStage` aus
  `@sigloch/graphcode-client`, das die Registry-Version nicht exportiert (Link-Modus seit CR-GC-757, in den
  Aufzeichnungen von CR-GC-763 und CR-GC-766 ebenfalls rot). Kein Schlupf.
- **Gegenprobe graphanalyze:** siehe Commit dort nach diesem CR.
