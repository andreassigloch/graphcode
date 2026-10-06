# CR-GC-752: Der Bauplan setzt keinen Stempel mehr — sein Ergebnis sind offene Aufträge; der Preflight liest das Label einer Kante

**Status:** ✅ Done (2026-10-06)
**Typ:** aus Item ITEM-2026-762 (idea)
**Erstellt:** 2026-10-06
**Item:** bok/items/ITEM-2026-762.json (Lane: code)
**Deckt:** sigloch-modules CR-SM-395 §2 (AF-05 neu gefasst), §12 („`AnalysisArtifactId` ohne `implplan`; AF-05
liest den Stempel nicht"), Entwurf `docs/graphcode_regelmatrix_entwurf.md` §2, §4, §8.9/8.10.
**Schnitt:** Teil 3c des Nachzugs (3a: CR-GC-750, 3b: CR-GC-751). 7 Dateien: 5 Quelldateien, 1 Skill, 1 Testdatei.

---

## Befund

Seit contracts 11 heißt AF-05 „es gibt Ungebautes, aber keinen offenen Auftrag". Den Stempel
`analysisFreshness.implplan` liest niemand mehr. graphcode setzte ihn weiter an zwei Stellen:

- der Executor im Task `plan` (`task-artifact.ts`, `STEMPEL_ID.plan = 'implplan'`), sobald ein Meilenstein mit
  Auftrag stand — der Eintritt blieb danach offen, weil das Vorbild Aufträge **ohne** `status` schrieb;
- der Skill `se-plan` in seinem letzten Schritt.

Beim Schreiben des Tests kam ein dritter Befund dazu, unabhängig vom Nachzug: der Preflight des Executors prüfte
ein Kantenpaar ohne das Label. `MS -relation-> MS` gilt nur als `depends-on`; der Preflight wies die
Meilenstein-Reihenfolge deshalb ab, die das Gate annimmt. Das Vorbild des Bauplans kam im Executor nie durch
(„preflight blocked: R-18 Illegales Trace-Paar: MS relation MS"). Der bestehende Test fuhr das Vorbild nur
direkt durch `graph_mutate`, nicht durch den Executor.

## Umsetzung

- `src/loop/task-artifact.ts`: `STEMPEL_ID` führt `plan` nicht mehr (Typ `GestempelterTask`), `hatStempel(task)`.
  `artefakte`/`offen` für `plan` bleiben — sie speisen den Rundenprompt („noch ohne Bauauftrag").
- `src/loop/executor-task.ts`: für einen Task ohne Stempel setzt der Executor nichts. Der Task ist durch, sobald
  die Eintrittsregel schweigt — das stellt `graph_generate {task:'plan'}` fest wie für jeden Task.
- `src/loop/task-clause.ts`: das Vorbild des Bauplans schreibt die Aufträge mit `@status open`; der Auftragssatz
  nennt es. Kein anderer Satz geändert.
- `src/loop/preflight.ts`: `legalPair` reicht das Label der Kante an `isValidTrace` (auch für die Gegenrichtung
  beim Auto-Flip).
- `.claude/commands/se-plan.md` (Version 6): §7 lautet „No stamp — the plan is the open orders": kein Stempel,
  Ergebnis sind die CRs mit `status: "open"` und die Meilensteine; AF-05 schließt der erste offene Auftrag und
  kommt wieder, sobald Ungebautes keinen offenen Auftrag mehr hat. Nur dieser Abschnitt.
- `src/surface/tool-context.ts`: ein Kommentar zu der in CR-GC-748 entfernten Aktualitäts-Rechnung gestrichen.

## Tests — `tests/task-analysen.test.ts`

**Rot zuerst:** der neue Executor-Fall lief gegen den Stand mit entferntem Stempel, aber altem Preflight:
„expected 0 to be greater than 0" — kein Auftrag im Graphen, Spur
`preflight blocked: R-18 Illegales Trace-Paar: MS relation MS (MS-echt-2 → MS-echt-1)`. Mit dem Label im
Preflight grün. Gegen den Stand VOR der Änderung an `task-artifact.ts` ist der Fall nicht gelaufen; dass der
Executor dort stempelte, steht im gestrichenen Testfall (`stempelZug('plan', …)` → `"implplan"`).

| Fall | |
|---|---|
| **neu** — kein Stempel-Schlüssel für den Bauplan | `hatStempel('plan') === false`, `STEMPEL_ID` ohne `implplan` |
| **neu** — Executor, Task `plan` | vorher AF-05 im Fokus; das Vorbild geht durch den Preflight; kein Stempel; jeder Auftrag trägt `status: open`; danach meldet der Task fertig |
| **neu** — Stempel von Hand | ein Alt-Stempel `implplan` lässt sich schreiben und schließt den Eintritt nicht |
| **neu** — Skill | `se-plan` nennt keinen Stempel und `status: "open"` als Ergebnis |
| geändert — Stempel-Zug | die Zeile zu `plan`/`implplan` gestrichen |
| geändert — CR-GC-735 | die Liste der Skills, die „lesen, übernehmen, ganz schreiben", ohne `se-plan` |

## Was sich ändert

- Im Executor endet der Task `plan` ohne Stempel-Zug; `stats.taskStempel` bleibt dort leer.
- Ein offener Auftrag eröffnet den Bau: R-19, R-20, R-26 melden danach an allem Ungebundenen. Das ist die
  Arbeitsliste, kein Rückschritt — die Zahl offener Warnungen steigt aber mit dem Plan (CR-SM-395 §11).
- Die Meilenstein-Reihenfolge erreicht im Executor jetzt das Gate.

## Offen

- **Modell-Zug** (laufender Host tabu): die Beschreibung der Knoten zum Analyse-Abschluss nennt den Stempel für
  alle fünf Analysen.
- Ob ein Auftrag, den Variantenvergleich oder Annahmen-Review anlegen, als Bauauftrag zählt, entscheidet der
  Katalog (CR-SM-395 §10.4). graphcode schreibt dort `status` nicht vor und liest die Regel.

## Verifikation

- `npm run build` grün. `tests/task-analysen.test.ts` (18), `tests/executor.preflight.test.ts` (27) grün.
- `npm run verify:full CR-GC-752` (Zeile in `docs/messung/testauswahl.jsonl`): Spur CODE, Auswahl 46/203,
  1790 Tests, 3 rot — `tests/lockfile-sync.test.ts`, `tests/distribution.test.ts` (Link-Modus, erwartet),
  `tests/conformance.test.ts` (1 Fall, Modell-Zug aus CR-GC-748). Alle drei liegen außerhalb der Auswahl und
  zählen als **Schlupf**; keiner rührt von diesem CR her. Folge ohne Schlupf: 0/10.
