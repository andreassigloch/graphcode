# CR-GC-707: Executor: Stillstand an AF-01..04 (Analyse-Stempel conops/trade/irr) — S2 gcrun-339..341 je Lauf mehrere 3-Runden-Stillstaende, der Executor kann die Analyse-Skills nicht fahren; Klausel oder gezieltes Zurueckstellen

**Status:** ✅ Done (2026-09-27)
**Typ:** aus Item ITEM-2026-632 (finding)
**Erstellt:** 2026-09-27
**Item:** bok/items/ITEM-2026-632.json (Lane: code)

---

_(kein Body im Item — Befund/Zielbild hier ausarbeiten, BEVOR die Lane startet)_

---

## Eine Ursache, zwei Symptome (ITEM-2026-632 und ITEM-2026-633)

S2 gcrun-339..341: in den Runden 7–10 stand `ver:AF-04:SYS-sig-local` im Fokus — ein Eintrittspunkt
(Analyse-Stempel des Plan-Tasks). Der Text war der der Dimension (`ver`: „je unverifiziertem REQ
einen TEST"), das Modell kann den Stempel nicht setzen und legte je Runde eine neue SYS-REQ mit TEST
an (`REQ-sig-local-requirement` … `-6`), bis der Treiber nach drei Runden zurueckstellte. Dasselbe fuer
AF-01/02/03: der Stillstand (632) und die Dubletten (633, 23/16/5, alle „ohne Befund") sind eins.

## Umfang

`FUNC-generation-step` (`src/loop/generate.ts`, Fokuswahl in `stepCore`), `tests/generate.task.test.ts`.

## Ergebnis

Im Treiber-Modus (Executor) ist ein Eintrittspunkt nie Fokus: der Executor startet keine Tasks
(`graph_generate` ist ihm vorenthalten). Bleiben nur Eintrittspunkte, endet der Lauf im vorhandenen
Endzustand `stalled` mit der Liste der Tasks — die Uebergabe an Mensch oder Host. Der Host (Claude
Code) bekommt den Eintrittspunkt unveraendert und kann den Task starten.

## Akzeptanz

- [x] Rot zuerst: am Golden ueber alle Funde gelaufen, stand im Treiber nie ein AF im Fokus (vorher AF-05).
- [x] Gegenprobe: der Host bekommt AF weiter in den Fokus.
- [x] generate/statemachine/task/channel-rank/focus-set/first-step 112/112, `tsc` sauber.
- [x] Im Lauf (S2 gcrun-342..344, 40 Runden, gegen gcrun-339..341): kein AF mehr im Fokus, kein
      AF-Stillstand. **arch erreicht in allen drei Laeufen** — `FUNC -compose-> FUNC` und
      `FUNC -allocate-> MOD` jetzt in allen (vorher in keinem); FUNC Median 11 (vorher 4), MOD 2 (0);
      Aehnlichkeit zum Golden 59/56/63 %. Stillstand-Runden 17/3/6 (vorher 11/10/13).
- Nicht erreicht, benannt: Dubletten 53/9/14 bei 187/147/116 Elementen (28/6/12 %) — T-E11 (≤ 5 %)
  weiter verfehlt, jetzt mit anderem Ausloeser (UC-01, RD-05+R-31, ohne Befund) statt der SYS-REQs
  der AF-Runden. gcrun-342 ist Ausreisser: 158 Gate-Ablehnungen (IO-01/IO-02), 61 neu angelegte MOD,
  17 Stillstand-Runden in arch/alloc. ITEM-2026-633 bleibt offen (Ursache verschoben).
