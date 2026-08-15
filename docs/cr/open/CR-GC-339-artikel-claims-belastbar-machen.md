# CR-GC-339 — Artikel-Claims belastbar machen (Publikations-Blocker)

**Status:** open · **Angelegt:** 2026-08-15 · **Max Files:** 6 (dieser CR: **6**)
**Ziel:** `docs/articles/` publikationsreif — jeder Claim entweder belegt, korrigiert oder gestrichen.
**Herkunft:** Claim-Audit 2026-08-15 gegen `@sigloch/contracts@4.0.0` (ONTOLOGY 6.0.0,
RULES 2.26.0), `docs/executor-abschlussbericht.md`, `docs/spikes/` und
`docs/graph/graphcode.graph.json`.
**Nachfolger:** CR-GC-340 (Tests, die diese Zahlen dauerhaft halten) · CR-GC-341 (Modell) ·
CR-GC-342 (Doku-Lücken).

---

## 1. Problem

Die Artikel sollen veröffentlicht werden. Vier Claims überleben ein Nachrechnen nicht, fünf Zahlen
sind veraltet, drei Aussagen untertreiben ausgelieferte Funktion, drei Belege fehlen im Repo.

Die Blocker sind nicht „ungenau" — sie werden **von den eigenen verlinkten Quellen widerlegt**. Ein
Leser, der dem Link folgt, findet den Widerruf.

---

## 2. Blocker — vor der Veröffentlichung zwingend

### B-1 · „Why Opus lost" ist im zitierten Bericht widerrufen

[`06-claims.md:46-48`](../../articles/06-claims.md) behauptet kausal:

> **Why Opus lost.** Its usual edge comes from working its own way … A tight, structured loop takes
> exactly that away. The same regime that scaffolds a small model constrains a large one.

[`docs/executor-abschlussbericht.md:99-111`](../../executor-abschlussbericht.md) (Nachtrag
2026-08-01) widerruft das ausdrücklich:

- „**„81 Rejections = Emissions-Regime beschneidet Frontier" ist widerlegt.**"
- Nur **18 der 81** Rejections erreichten das Gate; **63 waren Client-Fehler**.
- Ursache: `maxTokens 2048` (für die lokale 16-tok/s-Box dimensioniert) kappte Opus' große
  Tool-Call-JSONs → leeres Input-Objekt → unauditierter Handler-Wurf.
- Gegenprobe mit `maxTokens 8192`: **0 Rejections**.
- Opus 5 mit Fix, 12 Runden: **60 Elemente / 93 Traces, 5 Errors, 6,5 min, ~$1,60** — mehr Ausbeute
  als der zitierte 48-Runden-Lauf (57/81, 36 min, $11,85) in einem Viertel der Runden.

Damit fallen mit: „**The smallest model won outright**", der $1,58-vs-$11,85-Vergleich (die $11,85
sind der Preis eines Truncation-Bugs) und die Rahmung „Opus produced the *smallest* graph".

**Was der Bericht stehen lässt** (`abschlussbericht:125-128`): „Die Regime-These bleibt nur in
abgeschwächter Form: Haiku folgt dem dryRun-Protokoll freiwillig, Opus/devstral nie — die Auswahl
gehört in den Code (CR-288, umgesetzt)."

**Fix:** Absatz „Why Opus lost" streichen. Der 48-Runden-Vergleich bleibt nur mit dem Nachtrag im
selben Absatz, sonst gar nicht. Der belastbare Kern-Claim ist der Bericht-Kern: *derselbe Treiber
fuhr local (LM Studio), Opus 5 und Haiku 4.5 ohne Code-Verzweigung; devstral erreichte 85 Elemente /
148 Traces über alle Dimensionen für $0.* Das trägt „going local" vollständig — ohne eine Aussage
über Frontier-Modelle, die die eigene Quelle zurücknimmt.

### B-2 · „ran out of context" wurde nie gemessen

[`01-structure-and-llm-needs.md`](../../articles/01-structure-and-llm-needs.md):

> The same model, given the full document instead, ran out of context before finishing.

Dieser Arm existiert in
[`SPIKE-GC-context-sufficiency-RESULTS.md`](../../spikes/SPIKE-GC-context-sufficiency-RESULTS.md)
nicht. Der Spike fuhr Arm B (deterministisch, Hook + Bundle) und Arm C (Modell bekommt **nur** das
Bundle, **nie** die SPEC). Ein Gegenarm „Modell mit Volldokument" wurde nie gelaufen; die Formulierung
im Spike („statt an 600k Prosa zu scheitern") ist rhetorisch.

**Fix:** Satz ersatzlos streichen. Der belegte Befund ist stärker und steht schon da: das Modell
folgte den **Graph**-Werten (deterministischer Hash, `sourceRef` required) statt den **SPEC**-Werten
(random UUID, optional) — es sah die SPEC nie.

### B-3 · Die „~50×" stapeln zwei Messungen über zwei Systeme

Die Tabelle in `01` stellt **34.000 tok** gegen **667 tok**. Im Spike sind das getrennte Messpunkte:

| Zahl | Was sie wirklich ist |
|---|---|
| ~34k tok | was die **Originalsession** aus SPEC.md + Spikes las (graphcode-Selbstmodell) |
| ~250 tok | `graph_context('Slice')`-Closure — der eigentliche Gegenwert zu den 34k → **~136×** |
| ~667 tok | das **Rig**-Bundle `FN-slice` (11 Nodes, `rig/dummy-slicer`), aus dem qwen3.6-27b implementierte |
| 111× | ~250 tok gegen `graph_elements{300}` — nochmal ein anderer Nenner |

34.000 ÷ 667 = 51 verschmilzt Zähler und Nenner aus zwei Messungen über zwei Systeme.

**Fix:** **eine** apples-to-apples-Zahl. Empfehlung: **34k → ~250 tok (~136×)** für dieselbe Aufgabe,
plus ein Satz, dass das Rig-Bundle (667 tok, 11 Nodes) das größere Voll-DoD ist, aus dem das lokale
Modell implementierte. Die Überschrift „drops ~50×" zieht nach.

### B-4 · Token als Wörter ausgegeben

[`04-the-graphcode-story.md:77-79`](../../articles/04-the-graphcode-story.md): „a precise
**700-word** briefing" — es sind **667 Token** (≈ 500 Wörter). Im selben Satz „roughly seventy pages
of prose" für die 34k Token, während der Spike an anderer Stelle 600k Prosa nennt.

**Fix:** „a precise 667-token briefing"; die Seitenzahl entweder streichen oder aus einer der beiden
Zahlen sauber ableiten — nicht beide Baselines mischen.

---

## 3. Zahlen-Sweep (mechanisch)

Gemessen 2026-08-15 gegen die installierten `@sigloch/contracts/se`:

| Behauptet | Ist | Quelle der Wahrheit | Fundorte |
|---|---|---|---|
| 13 Elementtypen | **13** ✅ | `Object.keys(ELEMENT_DESCRIPTIONS)` | 03, 04, 06 |
| 7 Verbindungstypen | **7** ✅ | `TraceType.options` | 03, 04, 06 |
| 37 legale Verbindungsmuster | **36** | `TRACE_PATTERNS.length` | `03:33`, `04:137`, `06:96` |
| 66 Regeln | **72** | `ALL_RULE_DEFS.length` | 03, 04, 06 |
| 8 Readiness-Dimensionen | **8** ✅ | `new Set(Object.values(RULE_TO_DIMENSION))` | überall |
| 22 MCP-Tools | **25** | Tool-Registry | `03:33`, `05:111` |
| „~2.600 Token für 22 Tool-Beschreibungen" | mit 25 Tools neu messen | — | `05:111` |
| „current graph size (382 elements)" | **497 Elemente / 1041 Traces** | `docs/graph/graphcode.graph.json` | `05:90` |
| Haiku „42 applied, **14** rejected" | Bericht-Tabelle: **42 / 33** | `abschlussbericht:24` | `07:205` |

Die 25 Tools namentlich: `audit_stats`, `audit_trail`, `graph_authoring_guide`, `graph_context`,
`graph_elements`, `graph_expand`, `graph_export`, `graph_generate`, `graph_get_edges`,
`graph_get_node`, `graph_help`, `graph_impact`, `graph_merge`, `graph_metrics`, `graph_mutate`,
`graph_next_step`, `graph_readiness`, `graph_realize`, `graph_reseed`, `graph_suggest`,
`graph_test_ingest`, `graph_test_report`, `graph_tests`, `rules_evaluate`, `rules_get_violations`.

**Zusatz:** [`06-claims.md:96`](../../articles/06-claims.md) nennt die Trace-Muster „37 **rules**
(constraints)" — zwei Absätze vor „66 rules". Zwei Dinge, ein Wort. Umbenennen in
„legale Verbindungsmuster", damit „Regel" im ganzen Artikel genau eine Bedeutung hat.

**Zu den 42/14:** vermutlich nur die *gate-erreichenden* Calls (wie bei Opus 18 von 81). Dann muss
der Satz das sagen — sonst widerspricht `07` der Tabelle in `abschlussbericht`. Falls die Herkunft
nicht mehr rekonstruierbar ist: auf 42/33 korrigieren und die Grafik neu rendern.

---

## 4. Untertreibungen — der Artikel behauptet weniger, als ausgeliefert ist

| Artikel | Behauptung | Tatsächlich |
|---|---|---|
| [`05:34-37`](../../articles/05-the-advisory-roundtrip.md) + `05:60,79` | „⑤ measure (Architecture Fitness before/after) **is not built**" | `fitAdvisory` misst Δm vor/nach jeder erfolgreichen Mutation und benennt Regressionen ohne zu blocken — 5 Fälle in [`tests/harness.fit-advisory.test.ts`](../../../tests/harness.fit-advisory.test.ts), inkl. dryRun-Verdict. ⑤ **läuft**. |
| [`07:100-104`](../../articles/07-the-scoring-landscape.md) | Analysis-Freshness-Legs „decided … but **not yet implemented** — the diagram reflects that decision, not a running check" | **AF-01…AF-05** sind live (`AF_RULES`, severity `warning`), phasen-gemappt: ConOps→PDR, Trade→PDR, Assumption-Review→PDR, FMEA→CDR, ImplPlan→TRR. |
| [`05:96-98`](../../articles/05-the-advisory-roundtrip.md) | Latenz-Fix „committed but unpublished, waiting on an unrelated gap in a sibling CR" | Seit CR-GC-262 sind die `@sigloch/*`-Deps Registry-Pakete mit gepinntem Range. Status gegen die installierte `@sigloch/se-optimizer@^0.4.0` **verifizieren** und den Satz entweder streichen oder mit Datum versehen. |

Eine Untertreibung ist kein harmloser Fehler — sie signalisiert, dass der Rest genauso schlecht
gepflegt ist.

---

## 5. Unbelegt — im Repo keine Quelle auffindbar

1. **„4.0–4.2 von 5" Architecture-Fitness-Cohesion gegen „0 % auf jedem Modul", auf zwei realen
   Projekten** ([`07:165-168`](../../articles/07-the-scoring-landscape.md)) — der stärkste
   Einzelbeleg des Artikels, ohne Datei dahinter.
2. **Progress-Scatter: „devstral, best-of-N driver, 22 rounds", Runde 1 off-scale bei
   `dimension_readiness` +1,42 / fitness +6,67** ([`07:184-189`](../../articles/07-the-scoring-landscape.md))
   — der Bericht kennt v16 und v18 mit je 24 Runden, keinen 22-Runden-Lauf. Rohdaten liegen in
   `rig/greenfield-systemtest/results/`, das ist **nicht git-getrackt**.
3. **`05:90`**: `REQ-advisory-roundtrip-latency` bindet „under 200ms" — der einzige Test dazu
   ([`tests/perf.advisory-roundtrip.spike.test.ts:133`](../../../tests/perf.advisory-roundtrip.spike.test.ts))
   assertiert `toBeLessThan(10_000)`, also 10 s. Die 123 ms sind eine Spike-Messung, keine
   erzwungene Zusage.

**Fix je Punkt:** entweder die Rohdaten (mindestens die aggregierten Zahlen als Markdown) nach
`docs/spikes/` committen, oder die Behauptung auf das entschärfen, was ohne sie trägt.

**Nicht in diesem CR gemessen:** die aktuellen Regelverstöße des Selbstmodells. Der einzige hier
offene Weg wäre, `graphcode.graph.json` direkt in die Regel-Eval zu geben — genau der flache
Export-Pfad, den CR-GC-303/324 als Phantomquelle entlarvt haben (`attributes.*` wird abgeflacht,
R-19/R-20/R-26/VR-01/AF-01..05 feuern scheinbar). Wer die Zahl braucht, holt sie über
`rules_evaluate` am laufenden Server, nicht aus der JSON.

---

## 6. Weiterer Fund: `00 - Intro` ist unfertig

[`docs/articles/00 - Intro`](../../articles/00%20-%20Intro) bricht mitten im Satz ab
(„…wenn nicht klar ist welche Dinge und welche Verbindungen eigentlich „Richtig" sind, hilft es bei
der "). Die Datei ist untracked, ohne `.md`-Endung, und mischt Deutsch und Englisch.

**Fix:** fertigschreiben und als `00-intro.md` anlegen — oder aus dem Publikationssatz herausnehmen.
Nicht halb publizieren.

---

## 7. Akzeptanzkriterien

- [ ] `06-claims.md` enthält keine Aussage mehr, die `docs/executor-abschlussbericht.md` §Nachtrag
      widerspricht. Suchprobe: der Text „Why Opus lost" existiert nicht mehr.
- [ ] `01-structure-and-llm-needs.md` behauptet kein Ergebnis eines nicht gelaufenen Arms.
- [ ] In `01` steht **eine** Verhältniszahl, deren Zähler und Nenner aus **derselben** Messung
      stammen; die Herkunft ist im Satz genannt.
- [ ] Kein Artikel verwechselt Token und Wörter.
- [ ] Alle Zählungen aus §3 stimmen mit `@sigloch/contracts/se` + Tool-Registry überein
      (maschinell geprüft durch CR-GC-340, T-D1).
- [ ] Die drei Untertreibungen aus §4 sind korrigiert oder mit Datum als „Stand X" markiert.
- [ ] Jede Zahl aus §5 hat entweder eine Datei in `docs/spikes/` oder ist entschärft.
- [ ] `00 - Intro` ist fertig oder nicht mehr Teil des Satzes.
- [ ] `npm test` grün (bestehende Suites unangetastet — dieser CR ändert nur Markdown).

---

## 8. Betroffene Dateien (6)

| Datei | Änderung |
|---|---|
| `docs/articles/01-structure-and-llm-needs.md` | B-2 streichen, B-3 auf eine Zahl |
| `docs/articles/03-graphcode-harness-goal-and-concept.md` | Zahlen-Sweep (36/72/25) |
| `docs/articles/04-the-graphcode-story.md` | B-4, Zahlen-Sweep |
| `docs/articles/05-the-advisory-roundtrip.md` | ⑤ measure, Graphgröße, Tool-Zahl, Latenz-Status |
| `docs/articles/06-claims.md` | B-1, Zahlen-Sweep, „37 rules" → Verbindungsmuster |
| `docs/articles/07-the-scoring-landscape.md` | AF-Legs live, 42/33, §5-Belege |

`docs/articles/00 - Intro` ist untracked und zählt nicht gegen das Limit — Entscheidung dazu in §6.

---

## 9. Reihenfolge

1. **B-1** zuerst — das ist der einzige Punkt, der eine Veröffentlichung ernsthaft beschädigen kann.
2. B-2 / B-3 / B-4 (drei Sätze).
3. Zahlen-Sweep §3 — danach CR-GC-340 T-D1 bauen, damit er nicht wieder driftet.
4. §4 Untertreibungen.
5. §5 Belege beschaffen oder entschärfen.
6. §6 Intro.

@author andreas@siglochconsulting
