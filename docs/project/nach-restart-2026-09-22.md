# Nach dem Restart: offene CRs (Stand 2026-09-22, Ende Session Regel-Matrix)

Warum Restart: der MCP-Host dieser Session bootete am 2026-09-19 mit contracts 10.9 und urteilt noch
mit `gating`; seit heute liegen contracts 10.10.0 / graph-api-core 5.7.0 / se-engine 1.7.2 /
graphcode 0.24.0 in der Registry (CR-SM-353/354/355, CR-GC-605/607 — geschlossen). Ein Host, der
den Regelkatalog von gestern traegt, exportiert Views mit dem alten Stand.

## A. Angefangener Zug — Item ITEM-2026-477, Code auf Branch `item/ITEM-2026-477` in BEIDEN Repos

Reihenfolge ist zwingend (contracts `check:grammar` sweept den graphcode-Haupt-Worktree):

| # | CR | Repo | Stand | naechster Schritt |
|---|---|---|---|---|
| 1 | CR-GC-616 | graphcode | Textteil fertig, Branch gruen (5 Testdateien) | Branch nach master mergen (`git merge --ff-only item/ITEM-2026-477`), Suite |
| 2 | CR-SM-357 | sigloch-modules | Regeln entfernt, MT-02 warning, Fix-Roundtrip + Snapshot, contracts direkt gruen 700/700 | R-18/UC-02-Vorlagen (tot auf eigenem Fixture, s. CR) entscheiden; `npm test` (jetzt mit check:grammar); Release contracts/se-engine (+graph-api-core) |
| 3 | CR-GC-616 | graphcode | — | Floors heben, Matrix-Spalten Folge-Regeln + Fix aus `FIX_ROUNDTRIP`, Artikel 69 → 66, `it.todo` MT-02 scharf, Suite, Merge, CR-Knoten-Kanten, Export, Release 0.25, `aise rollout` |

Item-Store: ITEM-2026-462 (Zeilen-Fragen — entschieden, wird mit 357/616 erledigt), ITEM-2026-464
(ND-Aehnlichkeit — bleibt offen, Entscheidung Auftraggeber).

## B. Offene CRs der parallelen Session (nicht Teil dieses Zugs)

| CR | Titel |
|---|---|
| CR-GC-550 | se-plan leitet ueber REQ ab, nicht ueber FUNC-Blaetter |
| CR-GC-551 | `kinds` als Zeichenkette ueber den commands-Pfad |
| CR-GC-608 | Fertig-Kriterium der Steuerregeln: lokales Optimum bei Kreis oder Plateau ueber 3 Steuerzuege |
| CR-GC-610 | Code-Test (Leitlinie Satz 7): Scheduler-Scheibe aus sigllm, gefuehrt gegen frei |
| CR-GC-612 | Fester Vorspann je Lauf entflechten: GRAPHCODE.md, Werkzeugbeschreibungen, Skills, Antworten |
| CR-GC-613 | Lesewerkzeuge antworten ueber das ganze Modell statt ueber die Scheibe |
| CR-GC-614 | Executor verwirft alte Denkbloecke nach jedem Zug — der Graph ist das Gedaechtnis |
| CR-GC-615 | Rig captureArtifacts scheitert nach Git-Aktionen des Agenten an Export-Drift |

Ueberschneidung mit A geprueft (2026-09-22): keine gemeinsamen Dateien — 612 arbeitet an
GRAPHCODE.md/STEERING.md, 613–615 an Executor/Rig, 608/610 an eigenen Tests. Einziger Beruehrungspunkt
ist `docs/graph/graphcode.graph.json`: der Host exportiert die CR-Knoten beider Sessions in dieselbe
Datei, ein Commit nimmt die des anderen mit (Memory `graphcode-precommit-stagt-modell-dazu`).

## C. Nach dem Zug pruefen

- graph-view-edit: Compliance zaehlt seit CR-SM-353 nur Gate-Schuld (error); Warnungen faerben die
  Zahl nicht mehr — Dashboard-Texte auf „fehlerbehaftet" pruefen.
- Jedes Repo mit trade-Stempel ohne `crRefs` sieht im Task trade jetzt TR-01 — einmal nachstempeln.
- `aise doctor`: 9 vorbestehende Befunde (graphify CR-GF-131 doppelt, tote Dashboard-URLs, npx-Startzeilen
  in graph-view-edit/graphify, graphify 0.3.0 in sigloch-modules, graph-view-edit-Quelle vor dem Release).
