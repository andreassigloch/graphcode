# CR-GC-380 — Spike: warum jeder Lauf ein Volllauf ist

**Status:** open · **Angelegt:** 2026-08-21

## Problem

`npm test` = `vitest run`, der CI-Step ruft genau das, `fileParallelism: false` macht die Kosten
linear in der Dateizahl: 106 Testdateien, CI-Lauf 9–12 min. Die selektive Auswahl existiert seit
CR-GC-134/204 (`graph_tests` → `harness.testImpact()`), ist aber nirgends verdrahtet — und die Frage,
ob sie überhaupt verdrahtet werden **darf**, war unbeantwortet. Ohne Messung ist beides möglich:
still Tests verlieren (False-Green) oder ohne Grund die volle Suite zahlen.

## Ergebnis

`docs/spikes/SPIKE-GC-selective-tests.md` — Messung am eigenen Snapshot und an sieben weiteren
Familien-Graphen, Regelbefunde aus dem echten Evaluator (`@sigloch/contracts/se`, RULES_VERSION 6.0.0).

Kernzahlen: 19 von 63 Quelldateien und 48 von 106 Testdateien sind überhaupt modelliert; die
Graph-Auswahl trifft **13 %** der direkt koppelnden Tests (`src/upgrade.ts` → leere Auswahl,
`src/rewind.ts` → die falsche Datei); Potenzial über die letzten 60 Commits **53 %** weniger
Testdatei-Läufe mit dem heutigen Modell, **74 %** bei vollständigem.

Nebenbefunde: 36 FUNC tragen das abgelöste `codeRef` neben `realRef` (13 widersprüchlich), R-29 ist
16× verletzt (7 Dateien mit je 2–3 Knoten), `case` ist von genau einem Konsumenten genutzt, kein MOD
trägt `path`.

**Verdrahtung ist nicht Teil dieses CR** und bleibt bis nach der Modellvertiefung ausgesetzt
(Betreiberentscheidung 2026-08-20). Falsifikationskriterium für die spätere Entscheidung steht im
Spike §6: Recall ≥ 60 % nach Modellfix, sonst trägt die Graph-Auswahl nicht.

## Änderungen

| Datei | Was |
|---|---|
| `docs/spikes/SPIKE-GC-selective-tests.md` | **neu** — Frage, Leitsatz, Methode, M1–M10, Befund, Falsifikationskriterium |
| `docs/KPI.md` | KPI 6 gespalten: knotenseitig (R-19/R-20) **und** realitätsseitig (modellierte ÷ vorhandene Dateien) |
| `docs/cr/open/CR-DRAFT-GC-357-testhandling.md` | §2b Konsumentenbefund — Option b folgt aus dem Leitsatz, E2 bricht in der Handarbeit, E3 bleibt offen |
| diese CR-Datei | |

## Warum die KPI gespalten wird

R-19 und R-20 melden auf diesem Repo **null** Befunde, KPI 6 liest also 100 % — bei 45 %
modellierter Testdateien. Eine Pro-Element-Regel kann nicht sehen, was nie modelliert wurde. Die
knotenseitige Zahl sagt „das Modell ist in sich vollständig", die realitätsseitige „das Modell deckt
das Repo ab". Für eine selektive Testauswahl zählt die zweite.

## Akzeptanzkriterien

- [x] Jede Zahl im Spike ist aus dem committeten Snapshot bzw. dem echten Regel-Evaluator reproduzierbar
- [x] Vergleichsmaßstab (Direkt-Import statt transitiver Hülle) ist begründet und als untere Schranke benannt
- [x] Falsifikationskriterium für die spätere Verdrahtung ist festgelegt
- [x] CR-DRAFT-GC-357 bleibt DRAFT, bekommt aber die gemessene Konsumentenantwort
- [x] Keine Codeänderung, keine Verdrahtung in diesem CR

@author andreas@siglochconsulting
