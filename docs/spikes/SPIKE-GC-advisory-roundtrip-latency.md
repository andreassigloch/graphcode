# SPIKE-GC: Advisory-Roundtrip-Latency (read → status → propose → apply)

**Status:** Done (2026-08-05) · **Vorausgesetzt von:** [`FCHAIN-advisory-roundtrip`](../graph/graphcode.graph.json)
(Modellierung siehe git-Historie), Referenz-Artikel `docs/articles/05-the-advisory-roundtrip.md` /
`07-the-scoring-landscape.md`
**Frage:** Wie lange dauert der reale ①read→②status→③propose→④apply-Rundenlauf deterministisch
(ohne LLM), heute und bei Skalierung — und ist ein flaches <200ms-Budget für die GANZE Runde
realistisch?

## Auslöser

`REQ-responsiveness` bindet heute nur "erste Reaktion < 0,2s" für Draft-Apply + betroffenen
Subgraph (④ apply allein, subgraph-scoped) — nicht die volle Runde inkl. ③ propose
(`graph_suggest`, Best-of-N-Kandidaten-Ranking). Bevor eine neue REQ für die volle Runde formuliert
wird: reale Zahlen statt Schätzung.

## Setup

- **Messskript:** `tests/perf.advisory-roundtrip.spike.test.ts` — echter Disk-Kuzu (mkdtemp-Temp-Dir,
  nie `:memory:`, nie der Live-Store), kein Mock. Misst die vier Schritte in-process:
  - ① read: `harness.impact('FUNC-mutate', 2)` (echtes `graph_impact`-Backend)
  - ② status: `harness.evaluateRules()` (V3_RULES, ganzer Graph)
  - ③ propose: `targetFor(...)` + `suggestEdits(...)` — dieselben Aufrufe, die `graph_suggest`s
    Handler macht (minus die pro-Vorschlag dryRun-Gate-Schleife, die separat unter ④ zählt)
  - ④ apply: ein `dryRun`-`mutate()` (Gate-Check ohne Persist — derselbe Preview-Typ, den
    `graph_suggest` selbst pro Vorschlag durchläuft)
- **Zwei Datenpunkte:** (a) der reale graphcode-SSOT-Graph (382 Knoten/785 Kanten, aktuelle
  Selbstmodell-Größe), (b) eine 5x-Klon-Skalierung desselben Graphen (1910 Knoten/3925 Kanten,
  gleiche Dichte/Struktur, nur mehr davon) — kein synthetisch-triviales Chain-Graph, sondern echte
  SE-Struktur (FUNC/FLOW/REQ/UC/TEST/MOD mit realen Trace-Typen).
- **Wiederholungen:** 5 Runden (klein) / 3 Runden (groß), Median berichtet (keine Ausreißer-Politur,
  aber auch kein Single-Sample-Rauschen).

## Ergebnis

| Größe | read | status | propose | apply | **total** |
|---|---|---|---|---|---|
| 382 Knoten / 785 Kanten (heute) | 48,4 ms | 10,7 ms | **272,0 ms** | 30,6 ms | **363,1 ms** |
| 1910 Knoten / 3925 Kanten (5x) | 37,2 ms | 117,2 ms | **5.066,3 ms** | 392,8 ms | **5.612,9 ms** |

**Ein flaches <200ms-Budget für die GANZE Runde ist heute NICHT erreicht — schon bei aktueller
Graphgröße** (363 ms Median, propose allein bereits 272 ms > 200 ms). Bei 5x Skalierung bricht es
vollständig ein (5,6 s).

## Befunde

1. **③ propose dominiert, mit Abstand.** Bei aktueller Größe sind read+status+apply zusammen
   ~90 ms — unter dem 200ms-Budget, WENN man propose separat betrachtet. propose allein (272 ms)
   ist der einzige Schritt, der das Budget an dieser Stelle bereits reißt.
2. **propose skaliert schlechter als linear.** 5x mehr Knoten/Kanten → 18,6x mehr Zeit
   (272 ms → 5.066 ms), nicht 5x. Erklärung im Code (`@sigloch/se-optimizer/suggest.ts`):
   `suggestEdits` ruft `evaluateAllRules(graph)` (das VOLLE Regel-Set, nicht nur V3_RULES) UND die
   6D-Metrik `metrics(graph)` — beides einmal für den Baseline-Graph, dann NOCH EINMAL pro
   feuernder Operator-Regel als Richtungssonde. Wächst die Zahl feuernder Regeln mit der
   Graphgröße mit (plausibel — mehr Elemente, mehr potenzielle Verletzungen), multipliziert sich
   der Effekt: mehr Sonden × teurere Einzel-Auswertung.
3. **④ apply (dryRun-Gate) skaliert moderat** (30,6 ms → 392,8 ms, ~13x bei 5x Graphgröße) —
   spürbar, aber nicht der dominante Faktor.
4. **① read und ② status bleiben klein** in beiden Größen (read sogar leicht kleiner bei groß,
   im Rauschen; status wächst mit, bleibt aber < 120 ms selbst bei 5x).

## Grenzen (ehrlich)

- **Ein Prompt-Vergleich, eine Maschine** — keine Normierung, kein Multi-Run-Confidence-Intervall
  über viele Sessions. Ausreichend für „Größenordnung + Trend", nicht für ein hartes SLA.
- **③ propose ohne die pro-Vorschlag dryRun-Schleife gemessen** — `graph_suggest`s echter Handler
  macht zusätzlich einen `dryRun`-Mutate-Call PRO Vorschlag mit Edit (hier: bis zu 5). Die reale
  `graph_suggest`-Latenz liegt also noch über den hier gemessenen 272 ms / 5.066 ms für propose
  allein — dieser Spike unterschätzt tendenziell eher, als dass er übertreibt.
- **5x-Klon ist Struktur-Skalierung, nicht Wachstums-Skalierung** — reale Graphen wachsen nicht
  durch Duplizieren derselben Struktur; die Regel-/Metrik-Kosten könnten bei organischem Wachstum
  anders (besser oder schlechter) skalieren. Reicht als erster Trend-Datenpunkt, nicht als Beweis.

## Empfehlung für die REQ (nicht hier entschieden, für die Familie-Review)

Ein <200ms-Budget über die GANZE Runde inkl. propose ist mit dem heutigen `suggestEdits`-Algorithmus
nicht haltbar, sobald der Graph wächst — und selbst bei aktueller Größe knapp verfehlt. Drei
Optionen, keine hier vorentschieden:

1. **REQ auf read+status+apply beschränken** (analog zu `REQ-responsiveness`s heutigem Scope),
   propose bekommt ein eigenes, großzügigeres Budget oder gar keins (es ist ohnehin advisory,
   blockt nichts — siehe `REQ-responsiveness`s eigene Feststellung "der Advisor blockt nie").
2. **propose optimieren, bevor die REQ committed wird** — die O(n·Regelzahl)-artige Sondier-Strategie
   in `suggestEdits` ist der eigentliche Hebel (eigener CR in sigloch-modules/se-optimizer).
3. **Budget skaliert mit Graphgröße** statt flach — z. B. <200ms bis N Elemente, dann proportional
   — ehrlicher als ein Wert, der bei Wachstum automatisch bricht, aber schwerer zu kommunizieren.

## Reproduzieren

`npx vitest run tests/perf.advisory-roundtrip.spike.test.ts` — zwei Tests, Konsole loggt Median +
Teilzeiten je Schritt. Kein externer Zustand nötig (frischer Temp-Kuzu-Store pro Testlauf).

## Resolution (2026-08-05, sigloch-modules CR-SM-228)

Root-Cause-Analyse in `se-optimizer` fand den echten Engpass — nicht `betweenness()`, wie eine
erste (irreführende) Einzelmessung nahelegte, sondern zwei redundante Vollgraph-Operationen pro
Kandidat in `suggestEdits`s Probe-Loop: ein `structuredClone()` des gesamten Graphen für einen
Ein-Kanten-Edit, und eine erneute `evaluateAllRules(graph)`-Auswertung pro Probe, obwohl der
Aufrufer sie bereits einmal berechnet hatte. Details, Messungen, Fix: `sigloch-modules/docs/cr/open/
CR-SM-228-betweenness-array-indexed.md`.

**Verifiziert per `npm link`** (lokale Arbeitskopie, vor Publish) gegen genau dieses Spike-Skript:

| Größe | vorher | nachher | Faktor |
|---|---|---|---|
| aktuell (382/785) | 363,1 ms | **123,1 ms** | 2,9x — **unter dem 200ms-Ziel** |
| 5x (1910/3925) | 5.612,9 ms | 1.120,1 ms | 5,0x — noch über dem Ziel, aber deutlich näher |

**Noch nicht live in diesem Repo:** `@sigloch/se-optimizer` ist auf 0.3.2 gepatcht und committed,
aber **nicht publiziert** — `npm publish` ist durch einen unabhängigen, zeitgleich bearbeiteten
Gap aus CR-SM-227 blockiert (fehlende Regel-Klassifikation, nicht dieser CR). Dieses Repos
`tests/perf.advisory-roundtrip.spike.test.ts` läuft deshalb weiterhin gegen die alte,
langsamere `@sigloch/se-optimizer@0.3.1` aus der Registry — die hier dokumentierten
Nachher-Zahlen sind real gemessen, aber noch nicht das, was `npm test` in diesem Repo aktuell
zeigt. Sobald `se-optimizer` publiziert und hier gebumpt ist, sollten die Spike-Testschwellen
entsprechend verschärft werden (aktuelle Größe: harte <200ms-Assertion statt der heutigen
10s-Sanity-Decke).
