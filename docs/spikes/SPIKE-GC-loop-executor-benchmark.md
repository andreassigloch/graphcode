# SPIKE-GC: Loop-Executor-Benchmark (graph-first Implementierung)

**Status:** Done (2026-06-27) · **Schwester-Spike:** [`SPIKE-GC-context-sufficiency`](SPIKE-GC-context-sufficiency.md) (etablierte `graph_context`)
**Frage:** Welcher **Executor × Modell** implementiert einen Graph-Milestone **korrekt, graph-first** und **aktualisiert den Graphen** — und zu welchen Kosten (Turns / aktive Zeit / Kontext)?

## Setup

- **Rig:** [`rig/dummy-slicer/`](../../rig/dummy-slicer/) — fiktiver Consumer (graphify unberührt). Spec-Ära-Graph, `FN-slice` un-realisiert; stale `docs/SPEC.md` mit **absichtlich falschen** Werten (recall 0.70 / sourceRef optional / random UUID).
- **Akzeptanz:** `scripts/verify.ts` (recall ≥0.85 + Determinismus Jaccard=1.0 + sourceRef) — **zur Laufzeit ausgeführt**. Graph-Check: `scripts/graph-check.mjs` (liest den persistierten Store).
- **Bedingungen:** echte headless Loops, scoped `--allowed-tools` (kein Permission-Bypass), MCP `graphcode` + CR-214-Hook aktiv.
- **Lokales Modell:** LM Studio, qwen/qwen3.6-27b, 48 GB M4. **LM Studio bietet ein Anthropic-`/v1/messages`-Interface mit `tool_use`** → `claude -p` kann lokal treiben.

## Ergebnis — Rig, **1 Milestone** (kontrollierter Vergleich)

Vergleichsmaß = **Tool-Calls** (über alle Executors identisch gezählt) + Wall-Zeit. „LLM-Round-Trips" (RT) unterscheiden sich in Granularität — Claude zählt Text-only-Turns mit, opencode zählt Loop-Steps — daher **nur Kontext, kein Vergleich**.

| Executor | Modell | Code (verify) | Graph-Update | Wall | Tool-Calls | LLM-RT | `graph_context` | SPEC |
|---|---|---|---|---|---|---|---|---|
| `claude -p` | Cloud | ALL PASS | n/a (nicht beauftragt) | **157 s** | 10 | 21 | 1 | **0** |
| opencode | qwen3.6-27b | ALL PASS | Versuch — abgelehnt (Format) | 201 s | 10 | 7 | 1 | **0** |
| opencode (Voll, +write-back) | qwen3.6-27b | ALL PASS | **JA** (`codeRef`, `missingRefs=[]`, compliance=1) | 293 s | 12 | 9 | 2 | **0** |
| `claude -p` @40k | qwen3.6-27b | ALL PASS | denied (Allowlist) | 556 s | 10 | 29 | 1 | **0** |
| `claude -p` @22k | qwen3.6-27b | **FAIL** (ctx-overflow) | — | — | — | — | — | — |

**Plausibilität:** alle ~10–12 Tool-Calls für denselben Milestone; **Cloud am schnellsten** (157 s), lokal langsamer (201–556 s) = reiner Inferenz-Speed, nicht Tool-Zahl. claude-lokal am langsamsten (schwerer Per-Turn-Prompt × 29 RT). Die zuvor behaupteten „293 s schlagen 2 h" und „7 vs 29 Turns" waren **irreführend** (Multi- vs Single-Milestone; inkonsistente Turn-Definition) — hier korrigiert.

## Real-World-Referenz (NICHT zeit-/turn-vergleichbar)

Realer graphify-Implementier-Lauf (Session `4025681c`): **643 Turns, ~2 h aktiv** (von 17,9 h wall, 26 `/loop`-Fires), **multi-milestone** (ganze Slicer-Pipeline), **vor** `graph_context`. Dient **nicht** als Zeit-/Turn-Vergleich gegen die Single-Milestone-Rig-Läufe, sondern als **qualitatives Anti-Pattern**: 0 Präzisions-Query, 50k stale `SPEC.md` gelesen. Das „After" (Rig) = 1–3 `graph_context`, 0 SPEC.

## Befunde

1. **Code lauffähig in jedem lauffähigen Lauf** — `verify.ts` ALL PASS (recall 1.0, deterministisch, sourceRef). Die opencode-Routine nutzt `crypto.createHash` + Satz-Splitting + `sourceRef {doc,page,region}`.
2. **Graph-first emergiert:** alle Rig-Executors zogen die Definition-of-Done aus `graph_context`, **0 SPEC.md-Reads** — die falschen SPEC-Werte tauchten in **keiner** Implementierung auf. Der Original-Lauf (ohne `graph_context`) las dagegen die 50k-SPEC.
3. **Graph-Update braucht das richtige Werkzeug:** die einfachen Rig-Arme **versuchten** `graph_mutate` selbständig, schrieben aber **nicht** erfolgreich (claude: nicht in Allowlist → denied; lokales Modell: Format geraten — `op:update`+String statt `op:update-node`+`codeRef:{file,symbol}`). **Erst der Voll-Lauf** mit ausbuchstabiertem Kommando schrieb über das Gate korrekt zurück. → **Rohe `graph_mutate` ist zu scharf für kleine Modelle** (siehe CR-GC-216).
4. **`claude -p` lokal = no-go:** @22k ctx Overflow (Claude-Code-Harness > Fenster); @40k lauffähig, aber **lokal generell langsamer als Cloud** (Inferenz) **und** schwerer als opencode (großer Per-Turn-Harness-Prompt, 29 RT). **opencodes schlanker Harness** ist der praktikable lokale Pfad — gleiche Tool-Zahl (10 vs 10), kleineres Fenster, BYOK. → **opencode ist der lokale/BYOK-Executor** („OpenCode-executed").
5. **CR-214-Hook feuerte in keinem Loop** — die Agenten gingen freiwillig graph-first. Der Hook ist der **Backstop**; die deterministische Sperre ist in der Context-Sufficiency-Spike (Arm B) bewiesen.

## Win-Condition

Erreicht: **ein 27B-Modell lokal (opencode) implementiert den Milestone korrekt, graph-first, und realisiert ihn im Graphen** — code + `codeRef`-Write-back über das Gate. Das Framework (präziser `graph_context` + schlanker Executor) macht das kleine Modell tragfähig.

## Grenzen (ehrlich)

- **Single-Milestone** (`FN-slice`); kein Multi-Milestone-`/loop` bis E2E im Rig.
- **`status` blieb `specified`** — Voll-Lauf setzte nur `codeRef`; volle Realisierung würde `status` + TEST-`testRef` setzen.
- **Timings = Wall-Clock**, 48 GB M4 / qwen3.6-27b; nicht normiert. Original-„aktive Zeit" = Summe der Inter-Message-Gaps <120 s (Idle/`/loop`-Waits eliminiert).

## Offene Frage: kann opencode@local auch den **Spec-Prozess**?

Inspektion des realen Spec-Laufs (Session `2d86fe2b`, **vor** der Implementierung):

| Spec-Demand | Messung (2d86fe2b) | Lokal-Limit (qwen3.6-27b @40k via opencode) |
|---|---|---|
| Kontext-Breite | **Peak 504k tok** | 40k-Fenster = **~12× zu klein**; Spec referenziert das ganze wachsende Modell + Research |
| Authoring-Last | 14× `graph_mutate`, **Ø 4144 chars/Kommando** | das lokale Modell verhaute schon einen **trivialen** `codeRef`-Mutate; 4k-MutateCommands sind unerreichbar |
| Urteil/Generativität | 1,02M Output-Tok, IRR, FMEA, „welche UCs fehlen?" | **kein objektives Orakel** (Impl hatte `verify.ts`); 27B schwächer bei offenem Urteil |
| Mensch-im-Loop | **~29 Steuer-Nachrichten** (IRR, fehlende UCs, Constraints) | Spec ist Ko-Autorschaft, kein autonomer Loop |

**Befund:** Implementierung ist ein **guter** lokaler Fit (bounded, präzise DoD aus `graph_context`, ~10 Tool-Calls, 40k reicht). **Spezifikation ist es heute nicht** — vier Limits, nach Schärfe geordnet:

1. **Authoring-Ergonomie (härtester, aber fixbar):** Spec = hunderte add-node/add-edge-Mutationen mit Prosa; das kleine Modell scheitert schon am rohen `graph_mutate`-Schema (Benchmark-Befund 3). → ein **Authoring-Affordance-Layer** — CR-GC-216 (`graph_realize`) verallgemeinert auf flache `add-uc` / `add-req` / `add-trace`-Helfer — ist die **Vorbedingung**.
2. **Kontext-Breite:** 504k vs 40k. Graph-first senkt das, aber Spec-Reasoning ist inhärent breiter als ein Einzel-FUNC; das Limit bleibt, solange das lokale Fenster klein ist.
3. **Offenes Urteil:** kein PASS/FAIL-Orakel für „ist diese REQ-Menge vollständig/richtig?"; 27B ist hier schwächer als bei mechanischer Realisierung.
4. **Mensch-im-Loop:** Spec ist Kollaboration (29 Steuer-Nachrichten). „Local macht Spec" heißt **assistieren** (Knoten autoren, die der Mensch entscheidet, + Readiness/Rules-Feedback fahren), nicht autonom spezifizieren.

**Fazit:** opencode@local kann den Spec-Prozess **assistieren** (graph-natives Autoren einzelner, vom Menschen entschiedener Knoten), aber **nicht autonom durchziehen** wie die Implementierung. Reihenfolge: erst Authoring-Affordances (CR-216-Familie), dann gegen Kontext-Breite + offenes Urteil testen — ein eigener Spec-Benchmark-Spike.

## Reproduzieren

`rig/dummy-slicer/`: `scripts/run-*` (siehe Scratch-Runner) · `node --experimental-strip-types scripts/verify.ts` · `node scripts/graph-check.mjs`. Lokal: LM Studio @ ≥40k ctx für `claude -p`; opencode via `opencode.json` (lmstudio-Provider + `graphcode`-MCP).
