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

**Korrektur (User-Einwand + empirischer Test).** Der Spec-Peak von **504k tok** (Session `2d86fe2b`) war ein **Non-graph-first-Artefakt** — die Session hielt `SPEC.md` + Dossiers + das ganze wachsende Modell im Kontext. **Kein** inhärenter Spec-Bedarf. Spec wird normal **inkrementell + lokal** autoriert: „eine UC + 2 REQs" oder „ein TEST + verify-Link" — jede Einheit braucht nur die **lokale Nachbarschaft**, nicht das ganze Modell. Auch die 14× `graph_mutate` à 4144 chars waren **gebatcht** (viele Elemente pro Call), nicht die atomare Einheit.

**Empirisch** (opencode + qwen3.6-27b, frischer Rig-Store, 127 s): Auftrag „autoriere `UC-export` + 2 REQs + `TEST-export-format` + die compose/verify-Kanten über `graph_mutate`". Ergebnis: **alle 4 Knoten + 4 Kanten korrekt über das Gate** — richtige Typen **und** Richtungen (SYS→UC `compose`, UC→REQ `compose` ×2, TEST→REQ `verify`), **0 Gate-Rejections**, 4 Mutate-Calls. → **Das kleine Modell autoriert die inkrementelle Spec-Einheit graph-nativ; Kontext-Breite ist NICHT das Limit.**

| Aspekt | Lokaler Stand |
|---|---|
| Inkrementelles Autoren (UC/REQ/TEST + Links) | **lokal lösbar — empirisch bestätigt**, nur lokale Nachbarschaft nötig |
| Authoring-Ergonomie **at scale** | mutate klappt, aber Feld-Shape + Kanten-Typen mussten **vorgegeben** werden; eine Affordance (`graph_context`-für-Authoring zeigt die **legalen Meta-Modell-Kanten** eines UC, **oder** flache `add-uc`/`add-req`/`link-verify`-Helfer, CR-216-Familie) macht es **selbständig** (kein Ausbuchstabieren pro Increment) |
| Offenes Urteil (IRR, FMEA, „welche UCs fehlen?") | **die wenigen Fälle** mit Breiten-/Urteilsbedarf → Mensch/Cloud (vom User akzeptiert) |
| Mensch-im-Loop | Mensch entscheidet **was** (UC/REQs); der lokale Agent **autoriert** es in den Graphen |

**Fazit (korrigiert):** opencode@local leistet die **Mechanik der Spec** — graph-natives Autoren der vom Menschen entschiedenen Inkremente — schon **heute** (lokal, kleiner Kontext, über das Gate). Es braucht **nicht** das ganze Modell. Nicht-autonom bleiben nur die **wenigen** breiten Urteils-Schritte (Vollständigkeit, FMEA/IRR). Einziger echter Hebel für Skalierung: **Authoring-Affordances (CR-216-Familie)**, damit Kanten-Typen nicht pro Increment vorgegeben werden müssen.

**Fazit:** opencode@local kann den Spec-Prozess **assistieren** (graph-natives Autoren einzelner, vom Menschen entschiedener Knoten), aber **nicht autonom durchziehen** wie die Implementierung. Reihenfolge: erst Authoring-Affordances (CR-216-Familie), dann gegen Kontext-Breite + offenes Urteil testen — ein eigener Spec-Benchmark-Spike.

## Reproduzieren

`rig/dummy-slicer/`: `scripts/run-*` (siehe Scratch-Runner) · `node --experimental-strip-types scripts/verify.ts` · `node scripts/graph-check.mjs`. Lokal: LM Studio @ ≥40k ctx für `claude -p`; opencode via `opencode.json` (lmstudio-Provider + `graphcode`-MCP).
