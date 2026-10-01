# CR-GC-724: Analysen ueber den Executor (lokaler Weg, Profil local): graph_delegate und graphcode run nehmen task (conops|trade|irr|fmea|plan) und reichen ihn an graph_generate; die fuenf Analyse-Skills bekommen einen inject-Ausschnitt mit gueltigem Format-E-Vorbild fuer ihr Artefakt (Test: jedes Vorbild geht durchs Gate); Werkzeugtext und AGENTS.md nennen die Tasks. IRR: Annahmen als Rueckfrage, offene als CR. Beleg: local-2 — mit Profil local hat der Client kein graph_generate/graph_mutate, der Executor kennt keinen task. Stempel durch den Code folgt als eigener Schritt (ITEM-2026-684)

**Status:** ✅ Done (2026-10-01)
**Typ:** aus Item ITEM-2026-694 (idea)
**Erstellt:** 2026-10-01
**Item:** bok/items/ITEM-2026-694.json (Lane: code)

---

## Befund

Mit dem lokalen Profil (CR-GC-723) hat der Client vier Werkzeuge: `graph_delegate` und drei Leser. Die
Analysen (ConOps, Trade, Annahmen-Review, FMEA, Bauplan) hatten damit keinen Weg ins Modell: der Client
kann nicht schreiben, und der Executor kannte keinen Task. In `local-2` (2026-10-01) endeten IRR, FMEA und
Plan als Prosa im Chat.

Der Stempel, der einen Task schließt, war bis hierher frei setzbar — `local-1` setzte fünf ohne Artefakt.

## Umsetzung

- **Task durchreichen.** `graph_delegate({task})` und `graphcode run --task <t>` reichen den Task an
  `runExecutor`, der ihn je Runde an `graph_generate` gibt. `task` allein startet eine Delegation;
  `auftrag` ist dann eine optionale Vorgabe.
- **Vorbild statt Verweis** (`src/loop/task-clause.ts`). Am Eintritt eines Analyse-Tasks stellt im Executor
  (`selection: driver`) eine Task-Klausel den Imperativ: ein Auftrag und ein Format-E-Vorbild des Artefakts,
  mit den uids des Graphen. Der Verweis auf Skill und `graph_generate` entfällt dort — der Executor hat
  beides nicht. Der Host-Weg (Client mit Skills) bleibt beim Verweis. Der Bestand der Runde kommt nach Typ.
- **Der Code stempelt** (`task-artifact.ts`, `executor-task.ts`). Vor jedem Schritt prüft der Executor, ob das
  Artefakt steht; dann setzt er den Stempel durch das Gate (alle vorhandenen Stempel reisen mit, `crRefs`
  bei trade und irr). Kriterium: mindestens eine vollständige Einheit, und entweder nichts mehr offen oder
  die letzte Runde brachte keine neue.

  | Task | Einheit | offen |
  |---|---|---|
  | fmea | Risiko-REQ mit Gegenmaßnahme (compose) und Erfüller | Wirkketten ohne Risiko |
  | plan | Meilenstein mit zugeordnetem CR | Blatt-REQ ohne Bauauftrag |
  | trade | CR mit `decides`-Kante | — |
  | irr | CR je offener Annahme (nur während des Tasks entstandene) | — |
  | conops | nicht-funktionale REQ am System (nur während des Tasks entstandene) | — |

- **IRR im Executor** (Entscheid Autor 2026-10-01): Annahmen gehen als Fragezeile an den Auftraggeber, was
  offen bleibt, wird CR. Kein Record als Datei. Vereinheitlichung mit dem Skill-Weg: ITEM-2026-693.

## Abnahme

- `tests/task-analysen.test.ts`: jedes der fünf Vorbilder geht durchs echte Gate und ergibt eine Einheit
  (der Test fing ein illegales Vorbild: CR-relation-FCHAIN); Rundenprompt driver/host; Kriterium; Stempel-Zug;
  Executor stempelt nach geschriebenem Artefakt und erhält die übrigen Stempel; `graph_delegate`-Schema.
- Positivkontrolle am Frontier-Graphen (`rig/agentdiary`, v73): alle fünf Artefakte erkannt. Gegenprobe
  `local-1` (fünf Stempel ohne Artefakt): conops, trade, fmea, plan nicht erkannt.
- Am echten Modell: `graphcode run --task fmea` auf dem `local-1`-Kern ohne Stempel, qwen3-coder-30b:
  81 s, 3 Risiko-REQ (je Wirkkette eine), Stempel vom Executor nach Runde 1.
- `tests/mcp.tool-profile.test.ts`: die Schranke des lokalen Profils steigt einmal von 3.400 auf 3.600 Zeichen
  (neuer Parameter `task`, gemessen 3.500).

## Bewusst offen

- Ein Stempel, den das Modell selbst schreibt, wird hier noch nicht verworfen — CR-GC-725.
- Nach dem Stempel laufen die Detailregeln des Tasks (FM-01..03, MS-/CR-R-Regeln) ohne eigenes Vorbild;
  im Probelauf stagnierte der Executor dort drei Runden.
- Der Client-Weg (Skills, `GRAPHCODE.md`) nennt den Task-Parameter nicht ausdrücklich; die Werkzeugbeschreibung
  trägt ihn.
- Modell: `FUNC-task-abschluss` ist an keinen FLOW gebunden (R-31, Warnung).

## Umfang laut Graph

`FUNC-task-abschluss` (neu), `FUNC-run-executor`, `FUNC-graph-delegate`, `FUNC-generation-step`,
`REQ-analyse-artefakt-vor-stempel` (neu), `TEST-task-analysen` (neu). Zehn Dateien.
