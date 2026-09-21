# CR-GC-568: Executor: SYSTEM-Prompt verbietet den dryRun-Vergleich, den das Gate-Protokoll verlangt

**Status:** ✅ Done (2026-09-21)
**Typ:** aus Item ITEM-2026-399 (bug)
**Erstellt:** 2026-09-21
**Item:** bok/items/ITEM-2026-399.json (Lane: graph)

---

## 1 Befund

`graph_generate` rendert das Gate-Protokoll in zwei Varianten (CR-GC-288): `host` — der
MCP-Client probt selbst per `dryRun` und vergleicht die Verdicts; `driver` — der Best-of-N-Treiber
probt im Code. Der Executor setzt `selection` **nur bei `candidates > 1`** (`executor.ts:221`).
Bei `candidates = 1` — dem Default und der Einstellung jedes bisherigen Rig-Laufs — greift der
Schema-Default `host`, und der Rundenprompt verlangt:

> „(2) Alternativen zuerst als graph_mutate mit dryRun:true einreichen und die Verdicts vergleichen"

Derselbe Turn traegt den SYSTEM-Prompt des Executors, der das ausdruecklich verbietet:

> „emittiere den geforderten Batch als EINEN graphcode_graph_mutate-Aufruf …, dann STOPP."
> „Handeln vor Analysieren: rufe graph_mutate, rate die Instruktion nicht tot."

Zwei Imperative zur selben Sache — das Muster, das in dieser Serie viermal gemessen wurde
(CR-GC-560..562, 564, 565). Der Widerspruch ist hier nicht einmal aufloesbar: bei
`candidates = 1` **probt niemand**. Weder das Modell (verboten) noch der Treiber (der
Probe-Pfad `runBestOfNStep` laeuft nur bei N > 1). Der Prompt verspricht einen Vergleich,
den die Maschinerie in dieser Konfiguration nicht hat.

**Gemessen** (`rig/greenfield-systemtest/turn-analyse.mjs`, `dryRunWirkung()` ueber die Audits):

| Arm | Previews | Anwendungen | verworfen | Quote |
|---|---:|---:|---:|---:|
| opus5-4 (host, echter MCP-Client) | 14 | 16 | 6 | **0,43** |
| gcrun-0/1/2 (Executor, candidates=1) | **0** | 18/16/17 | 0 | 0 |

Der Opus-Arm probt und verwirft 43 % seiner Proben — dort traegt die Metrik die Auswahl. Der
Executor-Arm hat den Kanal in keinem der drei Laeufe benutzt.

## 2 Zielbild

Der Executor sagt **immer**, wer waehlt — der Schema-Default `host` ist fuer MCP-Hosts da, nicht
fuer einen Loop, dessen SYSTEM-Prompt Analyse-Turns verbietet.

Damit wird `selection` zu dem, was ihr Name sagt: eine Aussage darueber, **wer** die Verdicts
liest, nicht darueber, wie viele Kandidaten es gibt. Die Anweisung an das Modell ist in beiden
N-Faellen dieselbe — *einen* vollstaendigen Batch, keine eigenen Proben —, also darf sie auch nur
einmal dastehen. Der Unterschied zwischen N = 1 und N > 1 ist Treiber-intern und geht das Modell
nichts an; die `driver`-Klausel wird entsprechend so formuliert, dass sie bei jedem N wahr ist.

`host` bleibt: der Opus-/`claude -p`-Arm ist genau dieser Fall und nutzt ihn nachweislich.

## 3 Umfang

| Datei | Aenderung |
|---|---|
| `src/loop/executor.ts` | `genInput.selection = 'driver'` unbedingt; `bestOfN` steuert nur noch den Step-Pfad |
| `src/loop/generate.ts` | `driver`-Klausel N-agnostisch formuliert; Kommentar an `GenerationSelection` |
| `src/loop/executor.test.ts` | Test: bei `candidates = 1` traegt der generate-Aufruf `selection: 'driver'` |
| `src/loop/generate.test.ts` | Test: die `driver`-Klausel verspricht keinen Kandidaten-Vergleich |
| `tests/executor.bestofn.test.ts` | CR-GC-288-Regression angepasst: sie hielt das `host`-Protokoll bei `candidates = 1` fest |
| `rig/sigllm-spezifikation/lauf-gcrun.env` + `rig/greenfield-systemtest/run.mjs` | `GCRUN_CANDIDATES` → `GRAPHCODE_LLM_CANDIDATES` durchgereicht — der Kanal wird eingeschaltet, nicht nur der Widerspruch entfernt |

Sechs Dateien — an der Grenze, nicht darueber.

## 4 Die zweite Haelfte: der Kanal war im Rig nie an

Der Widerspruch zu entfernen macht den Prompt ehrlich, schaltet aber nichts ein. `candidates = 1`
heisst weiterhin: keine Probe, keine Auswahl, kein `fitAdvisory` im Entscheidungsweg. Die
Stellschraube existiert bereits (`GRAPHCODE_LLM_CANDIDATES`, `run-verb.ts:64`) und wurde im Rig
nie gesetzt. Genau das ist der Grund fuer die Null in der Tabelle oben — nicht ein fehlendes
Feature.

`lauf-gcrun.env` bekommt deshalb `GRAPHCODE_LLM_CANDIDATES=2`. Das Elementband bei
`candidates = 1` (68–122 nach CR-GC-566) ist die Kontrolle; der neue Lauf misst, ob der eine
Kanal, der auf dem Referenzarm 43 % seiner Proben verwirft, auf dem Executor-Arm ueberhaupt
greift.

## 5 Akzeptanzkriterien

1. `graphcode run` mit `candidates = 1` rendert das `driver`-Protokoll — kein `dryRun`-Auftrag
   mehr in einem Prompt, dessen SYSTEM-Prompt ihn verbietet.
2. Die `driver`-Klausel ist bei N = 1 und N > 1 wortgleich wahr.
3. Suite gruen, RC-* kongruent.
4. Neuer gcrun-Lauf (RUNS=3, `candidates = 2`): `dryRunProbes > 0` in allen drei Laeufen —
   der Kanal ist nachweislich an. Die Elementzahl ist **nicht** Akzeptanzkriterium; sie wird
   gegen das Band 68–122 berichtet.

## 6 Abnahme — der Kanal ist an, und die Quote misst nicht, was ich behauptet habe

Drei Laeufe mit `candidates = 2` (`runs/gcrun-3..5`):

| Lauf | Elemente | Proben | angewandt | verworfen | Quote | Gate-Ablehnungen | Wanduhr |
|---|---:|---:|---:|---:|---:|---:|---:|
| gcrun-3 | 94 | 22 | 10 | 13 | 0,59 | 0 | 2766 s |
| gcrun-4 | 59 | 23 | 9 | 15 | 0,65 | 0 | 3307 s |
| gcrun-5 | 45 | 30 | 7 | 24 | 0,80 | 0 | 2464 s |
| *Kontrolle (candidates = 1)* | *68–122* | *0* | *16–18* | *0* | *0* | *2–10* | *~775 s* |

**Kriterium 4 ist erfuellt:** `dryRunProbes > 0` in allen drei Laeufen. Der Kanal war vorher
abgeschaltet und ist jetzt an. `mutatesRejected` faellt auf 0 — was frueher das Gate ablehnte,
faengt jetzt die Probe ab, bevor etwas persistiert wird.

**Und genau hier kippt die Kennzahl.** Ich habe die Quote als „die Metrik traegt die Auswahl"
gelesen. Bei Opus (0,42) stimmt das: 12 Proben, 12 Anwendungen — geprobt wird, um zwischen
Brauchbarem zu waehlen. Bei gcrun (0,80) heisst dieselbe Zahl das Gegenteil: 30 Proben, 7
Anwendungen — beide Kandidaten waren meist unbrauchbar, und die Probe betreibt Schadensbegrenzung
statt Auswahl. **Eine hohe Quote ist kein Guetezeichen.**

Die Quote allein ist damit unbrauchbar und braucht die Ausbeute daneben:
Proben-zu-Anwendung 12:12 (Opus) gegen 30:7 (gcrun). Ein Folge-Item traegt das.

**Der Preis ist hoch und die Ausbeute faellt:** 45–94 Elemente gegen das Kontrollband 68–122,
bei 3,2- bis 4,3-facher Wanduhr. Fuer diesen Arm ist `candidates = 2` **kein Gewinn** — die
Stellschraube bleibt in `lauf-gcrun.env` dokumentiert, aber der Wert geht auf 1 zurueck, bis
ein Arm existiert, dessen Kandidaten ueberhaupt Auswahl-wuerdig sind (ITEM-2026-412).

Die Produktaenderung (kein `dryRun`-Auftrag in einem Turn, der ihn nicht ausfuehren darf) bleibt
davon unberuehrt und richtig.
