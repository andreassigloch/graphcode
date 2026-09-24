# CR-GC-658: UC-02-Klausel beschreibt den ACTOR-Pfad nur halb — FLOW ohne SCHEMA, Platzhalter-uids

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-560 (finding)
**Erstellt:** 2026-09-24
**Item:** bok/items/ITEM-2026-560.json (Lane: code)

---

## Befund

Nach CR-GC-655 (kein falscher Skill im UC-02-Fenster) baut qwen3-coder den ACTOR-Pfad selbst und
scheitert an Wissen, das die Klausel nicht liefert. gcrun-70..72: 42× R-18 „FLOW ohne
relation→SCHEMA", STRUCT „Cannot resolve type of source ACTOR" (Platzhalter statt uid, FLOW nicht
deklariert), IO-02 (ein FLOW mit mehreren Erzeugern). Die Klausel nannte nur ACTOR io→FLOW io→FUNC.

## Umsetzung

Die UC-02-Klausel traegt ein vollstaendiges Format-E-Vorbild fuer den Pfad: FLOW, SCHEMA, FUNC
deklariert; ACTOR io→FLOW, FLOW io→FUNC, FLOW relation→SCHEMA, FCHAIN compose→FUNC — in einem
Batch, mit echten uids. Dazu die zwei Regeln in einem Satz (genau ein Vertrag, genau ein Erzeuger je
FLOW). SCHEMA kommt in die Fokus-Typen (die Grammatik und die Liste muessen ihn zeigen, weil der
Text ihn nennt — der bestehende Waechter „kein genannter Typ fehlt im Fokus" erzwingt das).

## Dateien (3)

`src/loop/generate.ts`, `tests/executor.test.ts`, diese Datei.

## Akzeptanzkriterien

- [x] Das Vorbild geht am echten Store unveraendert durchs Gate und loest den UC-02-Fund des UC auf.
- [x] Fokus-Waechter und Klausel-Tests gruen.
- [ ] Rig (gcrun, N=3) gegen 657: R-18/STRUCT/IO-02-Ablehnungen deutlich weniger, UC-02-Funde
      geloest, Elemente/Readiness nicht schlechter.
