# CR-GC-613: Lesewerkzeuge antworten ueber das ganze Modell statt ueber die Scheibe: rules_get_violations 32.630, graph_test_report 25.602, graph_context je 9.300 Zeichen — 62% der graphcode-Antworten eines Laufs

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-476 (finding)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-476.json (Lane: code)

---

Gemessen an Lauf gefuehrt-1 des Code-Tests (2026-09-22). Andere Ursache als ITEM-2026-369: dort feste Grundlast, hier fehlender Umfang an der Abfrage. Die Antwort ist sachlich richtig, beantwortet aber eine weitere Frage als die gestellte.

| Aufruf | Zeichen | Inhalt | noetig gewesen |
| rules_get_violations {severity:'warning'} | 32.630 | alle Warnungen des Systems, vor allem R-19/R-20 der 6 nicht beauftragten Module | die RC-Regeln der Scheibe |
| graph_test_report {} | 25.602 | 81 REQs mit Testlage, davon 70 nie gelaufen; die Scheibe hat ~10 | die REQs der Scheibe |
| graph_context {depth:2}, 3x | je ~9.300 | 96 % formatE: 27-30 Knoten mit voller Beschreibung inkl. ACTOR, FCHAIN, Nachbar-FLOWs | die FUNC, ihre SCHEMAs und REQs |

Zusammen ~90.000 der 144.000 Zeichen, die graphcode in dem Lauf lieferte (62 %).
BELEG, dass es nicht abgearbeitet wird: nach den 32.630 Zeichen schreibt der Agent EINEN Satz ('RC-01/02/03/05/06/07 are clean. Only RC-04 fires (5x)') und exportiert. Der graph_test_report kam NACH dem Export kurz vor dem Commit und loeste gar nichts mehr aus — das ist ein Ablauf-Befund am Skill, kein Antwort-Befund.

ZIELBILD: kein neues Argument, sondern ein ABGELEITETER Vorgabe-Umfang aus den eigenen Schreibzuegen der Sitzung (Audit-Log seit Boot kennt jeden per graph_realize/graph_mutate angefassten Knoten), und die Antwort nennt den Umfang, den sie genommen hat, plus den Rest als ZAHL ('ausserhalb der Scheibe: 41 Befunde').
Warum kein scope-Argument: jedes Argument steht im Katalog und damit im Executor in jeder Runde (200-400 Zeichen x alle Aufrufe).
Warum der Rest als Zahl: ein Gate, das ohne Abdeckung gruen meldet, ist schlimmer als keins (Leitlinie).
Warum der Umfang in der Antwort steht: sonst liefert dieselbe Abfrage je nach Sitzungsstand etwas anderes — nicht testbar, nicht pruefbar, und der Agent kann nicht erkennen, ob er alles bekam.
Testbarkeit: reine Funktion 'Arbeitsmenge aus dem Audit'.

Kipp-Kriterium und Nulllinie wie in ITEM-2026-369.

## Akzeptanzkriterien

- [ ] Reine Funktion „Arbeitsmenge aus dem Audit seit Sitzungsstart", eigener Test.
- [ ] `rules_get_violations`, `graph_test_report` und `graph_readiness` antworten vorgabeweise auf diese Menge und nennen
      den genommenen Umfang sowie die Zahl der Befunde außerhalb.
- [ ] `graph_context` liefert Nachbarn ohne volle Prosa (Kanten statt Beschreibungen): am Scheduler-Modell unter 3.000
      statt 9.300 Zeichen.
- [ ] Die drei Aufrufe zusammen am Scheduler-Modell unter 15.000 statt 90.000 Zeichen.
- [ ] Erster Aufruf einer Sitzung ohne Schreibzüge: ganzes Modell, unverändertes Verhalten.
- [ ] **Kipp-Kriterium** wie in CR-GC-612: 0 Rückfälle, nicht mehr Nachschlage-Aufrufe.
- [ ] Testsuite grün.
