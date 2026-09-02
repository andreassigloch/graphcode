# CR-GC-457 — Blockschnitt: drei Features statt zehn Blöcke

**Status:** open
**Angelegt:** 2026-09-02

## Root Cause

Zehn Wurzel-FUNCs gegen die eigene `se:top-level`-Regel „max 5 Blöcke je Ebene". Schwerer wiegt,
dass der **wichtigste Claim im Modell nicht sichtbar ist**: die inhaltliche Optimierung — die fünf
Urteilssitzungen ConOps, Annahmen-Review, FMEA, Trade Study, Implementierungsplan — liegt in
`FUNC-block-se-steuerung`, zusammen mit `generationStep` und `rankCandidates`.

Das ist Prüffrage 3 der Skill („hat ein Block zwei Leben?"), und die Antwort ist ja:

| | Führung (strukturell) | Urteilsarbeit (inhaltlich) |
|---|---|---|
| Takt | jede Runde | einmal je Stufe |
| Treiber | Agent, deterministisch | Mensch, geführte Sitzung |
| Werkzeug tut | rechnet und rankt | prüft Existenz + Frische, **nie den Inhalt** |

`FUNC-block-anschluss` hat sogar drei Leben: Abfrageoberfläche, Autoren-Skills und reiner Betrieb
(`graphcode init`, `healthEndpoint()`, `serveStdio()`).

## Die Story, die den Schnitt bestimmt

Drei Features, vom Auftraggeber gesetzt:

1. **Grounding** — die Daten und die daraus erzeugten Antworten sind prüfbar (Abfrage + Regel + Datenbank)
2. **Führung** — adaptiv: der schwächste Score benennt den nächsten Schritt, und man darf abbiegen
3. **Optimierung** — Vorschläge, architektonisch **und** inhaltlich

Nicht aus Statistik, sondern aus definierten Kenngrößen. Nichts davon blockiert: blockieren kann
nur eine Regel, und Regeln blockieren nur *unzulässig*, nie *suboptimal*.

## Zielbaum — 4 Wurzeln

```
Grounding                 (neu)     Gate · Abfrage(neu) · Messwerk · Nachweis · Gedächtnis · Speicherwerk
Führung                   (= FUNC-goal-steerer, umbenannt)
                                    Antrieb · Fokus & Ziel · Autorieren(neu) · Anleitung(neu)
Optimierung               (neu)     Architektur-Optimierung · Urteilsarbeit(neu)
Betrieb                   (bleibt)  Bedienung + Rüstzeug          ← nicht im Pitch
```

`FUNC-goal-steerer` wird **umbenannt, nicht ersetzt**: er trägt als einziger Wurzelblock
`satisfy → REQ-steering-from-metrics` („Nächster Schritt folgt aus gemessenen Kenngrößen") plus das
Messvektor→Handlung-Paar. Das ist wörtlich der Führungs-Claim; ein neuer Knoten hätte ihn verloren.

`FUNC-block-anschluss` und `FUNC-block-se-steuerung` werden aufgelöst — beide tragen nur ein
`allocate`, keine Zusage geht verloren.

## Bewusste Abweichung

Grounding bekommt **sechs** innere Blöcke statt fünf. Begründung: es ist der Block, der drei der
fünf Pitch-Mechanismen trägt, und die Skill sagt selbst „the answer to 'too big' is a level, not
more modules" — die Ebene ist genau das Mittel. Die *oberste* Ebene bleibt mit 4 unter Budget.

Nachgelagert, nicht in diesem CR: `Betrieb` behält gemischte Tiefe (12 Blätter neben einem Block).
Und der **Modulschnitt** ist heute ein Schichtschnitt (Kohäsion 0,10–0,27) — gegen die neuen
Story-Blöcke geschnitten wäre er die eigentliche Aufräumung.

## Ergebnis — gemessen, inklusive des Preises

**Struktur:** 4 Wurzeln, Kompositionsbaum intakt (kein FUNC mit zwei Eltern), keine Funktion
verloren. 108 → 113 FUNC; die fünf neuen sind Strukturblöcke (Grounding, Abfrage, Autorieren,
Anleitung, Optimierung, Urteilsarbeit, Bedienung & Sitzung — minus die zwei aufgelösten).
**Sechs der 38 FLOWs werden blockintern** und verschwinden damit aus der obersten Ebene: die
Flow-Zahl folgt dem Blockschnitt, wie vorhergesagt.

**Regeln:** 1 error (`UC-02`, `UC-loop-closure` von keinem ACTOR erreichbar) — unverändert
gegenüber vorher. **Suite:** identisches Rot-Set wie HEAD (10 Dateien / 16 Tests), 22 Tests mehr grün.

**Fitness — der Preis, offen ausgewiesen:**

| Dimension | vorher | nachher | Δ | Gewicht | Beitrag |
|---|---:|---:|---:|---:|---:|
| modifiability | 2,692 | 2,826 | +0,134 | 0 | 0 |
| flowEfficiency | 0,929 | 0,821 | −0,108 | 0,4 | −0,043 |
| coherence | 3,822 | 3,729 | −0,092 | 1,0 | **−0,092** |
| scalability | 4,046 | 4,016 | −0,030 | −0,2 | +0,006 |
| | | | | **Summe** | **−0,129** |

Der Schnitt bewegt den Graphen **gegen** das erklärte Zielprofil. Er wird trotzdem gefahren, weil
die Skill das so vorsieht: die Pitch-Struktur ist das Ziel, die Metrik ist eine Ablesung.

**Der Rückholversuch ist gemessen und gescheitert.** Naheliegend wäre, die Grenzflüsse auf die
Wurzelblöcke zu heben (77 Kanten über 32 Grenzflüsse). Trockenlauf: flowEfficiency **0,821 → 0,000**,
coherence −0,141, gewichtet **−0,429**. Der Grund steht in der Skill selbst — *„The top FUNC set is
a **projection**, not an edge […] read it, do not assert it"*, mit dem Präzedenzfall CR-SM-266 D2
(`MOD -io-> MOD` gelöscht, weil eine ableitbare Relation als Kante driftet). Die −0,129 sind damit
nicht heilbar; sie sind der ehrliche Preis der Ebene.

Warum das ein Befund über die Messebene ist und nicht über diesen Umbau:
`CR-DRAFT-GC-458`.

## Acceptance

- [x] 4 Wurzel-FUNCs
- [x] `REQ-steering-from-metrics` weiterhin von der Führung erfüllt
- [x] Urteilsarbeit als eigener Block
- [x] keine FUNC ohne Elternblock, Baum-Invariante geprüft (0 Doppel-Eltern)
- [x] `rules_evaluate` blockingErrors = 1 (Stand vorher)
- [x] Suite ohne neue Rote gegenüber der HEAD-Baseline (10 Dateien / 16 Tests)
