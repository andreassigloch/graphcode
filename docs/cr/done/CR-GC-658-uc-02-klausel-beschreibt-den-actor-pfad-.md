# CR-GC-658: UC-02-Klausel beschreibt den ACTOR-Pfad nur halb — FLOW ohne SCHEMA, Platzhalter-uids

**Status:** ✅ Done (2026-09-24)
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
- [x] Rig — Ablehnungen 13,3 → 3,0, R-18 FLOW/SCHEMA 66 → 6.

## Rig-Messung (2026-09-24, `results-runde19-gcrun-658-659.json`, gcrun-100..102, gemeinsam mit CR-GC-659)

| Mittel je Lauf | 657 | 658 + 659 |
|---|---:|---:|
| Gate-Ablehnungen | 13,3 | **3,0** |
| R-18 „FLOW ohne SCHEMA" (Gate, 3 Laeufe) | 66 | **6** |
| `FUNC satisfy REQ` im Preflight geblockt (3 Laeufe) | 34 | **8** |
| STRUCT (3 Laeufe) | 14 | 5 |
| Readiness req / uc / ver | .80 / .79 / .85 | **.89 / .85 / .86** |
| Elemente | 41 | 44 (39/55/39) |
| neue Kanten | 43 | 59 |
| Tokens ein / Laufzeit | 307k / 374 s | 218k / 231 s |

Beide Zaehler, auf die die CRs zielen, fallen um drei Viertel und mehr; die Readiness erreicht den
besten Stand der Messreihe. **Nebenbefund:** Neu-Deklarationen wieder 15 je Lauf, 26 von 45 davon
ueberschreiben Text oder Namen — teils mit dem Beispieltext des Vorbilds („Nimmt die Anfrage
entgegen."). Weiter in CR-GC-660 (im Code, nicht im Prompt).
