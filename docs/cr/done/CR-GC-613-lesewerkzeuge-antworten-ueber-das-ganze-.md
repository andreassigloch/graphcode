# CR-GC-613: Lesewerkzeuge antworten ueber das ganze Modell statt ueber die Scheibe: rules_get_violations 32.630, graph_test_report 25.602, graph_context je 9.300 Zeichen — 62% der graphcode-Antworten eines Laufs

**Status:** ✅ Done (2026-09-22)
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

- [x] Reine Funktion `arbeitsmengeAusAudit` (`src/kernel/measure/working-set.ts`), eigener Test
      (`tests/working-set.test.ts`, 9 Fälle). Liegt im **Kernel**, nicht in `projections`: sie ist
      eine reine Messung, und `tool-contract.ts` braucht ihren Typ — ein Import nach oben hätte die
      Schichtordnung gebrochen (`tests/import-boundaries.test.ts`).
- [x] `rules_get_violations`, `graph_test_report` und `graph_readiness` tragen `umfang`
      (`art` · `uids` · `ausserhalb`). **Gemessen am sigllm-Golden v98 (255 Knoten), echter
      Kuzu-Store, nach EINEM Schreibzug am `MOD-scheduler`:**

      | Aufruf | ganzes Modell | auf die Scheibe |
      |---|---:|---:|
      | `rules_get_violations {severity:'warning'}` | 51.748 | **304** |
      | `graph_test_report {}` | 22.800 | **2.137** |
      | `graph_context {depth:2}` | 9.036 | **6.696** |
      | zusammen | 83.584 | **9.137** |

- [x] Die drei Aufrufe zusammen unter 15.000: **9.137**.
- [ ] **`graph_context` unter 3.000 bei `depth: 2` — NICHT erreicht, und zwar prinzipiell.**
      Gemessen: die 30-Knoten-Scheibe kostet allein an Format-E-**Struktur** (uids, Namen, Typen,
      35 Kanten) **4.080 Zeichen**, bevor ein Wort Prosa dazukommt; die Beschreibungen sind 4.956,
      davon 1.959 REQ und 431 SCHEMA — genau das, was der Befund als GEBRAUCHT benennt. Unter 3.000
      käme man dort nur, indem man Knoten weglässt, und die TESTs und das MOD sind die
      Definition-of-Done, die dieses Werkzeug zusagt. Erreicht ist **9.036 → 6.696 (−26 %)**, und
      bei `depth: 1` **2.926**. Der ehrliche Hebel liegt damit im Ablauf, nicht im Werkzeug: bei
      `depth: 1` bleiben, wo `depth: 1` die Frage beantwortet. Die Zahl 3.000 war eine Schätzung
      ohne den Strukturboden.
- [x] Erster Aufruf einer Sitzung ohne Schreibzüge: ganzes Modell, unverändertes Verhalten
      (eigener Testfall, und `tests/testreport.test.ts` prüft beide Lagen nebeneinander).
- [ ] **Kipp-Kriterium** — offen bis zum Bestätigungslauf (CR-GC-610). Es ist eine Aussage über
      einen LAUF, nicht über den Code, und wird dort gemessen, nicht hier behauptet.
- [x] Testsuite grün (bis auf `distribution` und `lockfile-sync`, die erwarteten Link-Modus-Roten).

## Entscheidungen, die beim Bauen fielen

**Der Schnitt von `graph_context` geht nach TYP, nicht nach Ring.** Ein erster Anlauf kürzte ab
Ring 2 und sparte gemessen 17 % — bei `depth: 2` ist der Innenring schon fast alles. Er sah nur
deshalb grün aus, weil der Messtest sich mit `FUNC-scheduler-operation` (2.693 Zeichen) einen
kleinen Anker ausgesucht hatte. Jetzt behalten Anker, REQ und SCHEMA ihre Prosa; alles andere steht
als Knoten und Kante da, mit `…` und **einer** Legendenzeile. Der ausgeschriebene Hinweis je Knoten
kostete auf derselben Scheibe 1.178 Zeichen und machte die Kürzung zur Hälfte zunichte.

**`graph_readiness` weist den Umfang aus, schneidet aber die SCORES nicht.** Readiness ist eine
Aussage über das Projekt. Eine auf die eigenen Schreibzüge geschnittene Compliance-Zahl wäre genau
das, wovor dieser CR selbst warnt: ein Gate, das grün meldet, weil es weniger gesehen hat.

**Die Erweiterung folgt `satisfy` UND `verify`.** Beide zeigen auf ein REQ. Ohne `verify` verlöre
`graph_test_report` nach einem `graph_test_ingest` genau die REQ, über die er berichten soll — real
aufgefallen an `tests/testreport.test.ts`, nicht am Reißbrett.
