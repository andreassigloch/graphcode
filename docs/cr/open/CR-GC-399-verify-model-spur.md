# CR-GC-399 — Eine Modelländerung braucht keine sieben Minuten

**Status:** open · **Angelegt:** 2026-08-22 · **Umsetzung:** dieses Repo
**Dateien:** `package.json`, `scripts/githooks/pre-commit`, ein neuer Test

## Problem — gemessen

Diese Sitzung hat **sechs volle Testläufe** gekostet, zusammen rund **41 Minuten**, für Änderungen,
die keine einzige Quelldatei angefasst haben. 111 der 112 Testdateien können von einer Kante im
Graphen nicht betroffen sein.

`graph_tests` löst dieses Problem **nicht**, und das ist der Punkt: es leitet aus einem
**Code**-Changeset ab (`code → REQ → TEST`-BFS über `harness.testImpact`). Eine reine
Graph-Mutation hat keinen Code-Changeset, also auch keine Ableitung. Das Werkzeug beantwortet eine
andere Frage.

Die relevante Menge für eine Modelländerung ist klein und stabil: alles, was die committete
`docs/graph/graphcode.graph.json` liest — in diesem Repo **8 Dateien**, per Grep bestimmbar — plus
die Regel- und Ontologie-Tests.

## Änderung — drei Stufen, von auffindbar nach fest

**1. Skript.** `npm run verify:model` fährt genau diese Menge. Ein Wort statt sieben Minuten.

**2. Vollständigkeits-Test.** Ein Test greppt `tests/` nach `docs/graph` und vergleicht das
Ergebnis mit der Liste im Skript. Damit kann die Menge nicht veralten, wenn jemand einen neuen
Test schreibt, der den Graphen liest. Ohne diesen Test ist Stufe 1 eine Liste, die still falsch
wird.

**3. Spurwahl im Hook.** `scripts/githooks/pre-commit` weiß bereits, welche Dateien im Spiel sind —
er staged `docs/graph` und `docs/views` selbst dazu. Er wählt künftig die Spur nach dem Umfang des
Diffs:

| gestagter Diff | Spur |
|---|---|
| nur `docs/graph`, `docs/views`, `docs/cr`, `docs/*.md` | `verify:model` |
| irgendetwas unter `src/`, `tests/`, `scripts/` | volle Suite |

**Der Hook druckt, welche Spur er gewählt hat.** Das ist nicht Kosmetik: derselbe Hook hat in
dieser Sitzung dreimal still `docs/graph` und `docs/views` mit eingesammelt und damit einen
beabsichtigten Zwei-Commit-Schnitt zunichtegemacht. Erst `git config --get core.hooksPath` hat es
erklärt. Ein Hook, der schweigend entscheidet, kostet mehr Zeit, als er spart.

## Was dieser CR ausdrücklich nicht tut

Er baut `graph_tests` nicht um. Ein Modell-Modus dort wäre eine eigene Entscheidung — die
Testauswahl für Code-Änderungen funktioniert und soll nicht mit einer zweiten Semantik belastet
werden.

## Akzeptanzkriterien

- [ ] `npm run verify:model` läuft unter 60 Sekunden und deckt alle Tests ab, die den committeten
      Graphen lesen.
- [ ] Der Vollständigkeits-Test ist **rot gesehen**: ein neuer Test, der `docs/graph` liest und
      nicht in der Liste steht, lässt ihn fallen.
- [ ] Der Hook wählt die Spur nach Diff-Umfang und **schreibt die Wahl nach stderr**.
- [ ] Ein Commit, der `src/` anfasst, fährt weiterhin die volle Suite — kein Weg, sie zu umgehen.
