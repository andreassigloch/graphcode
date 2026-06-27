# SPIKE-GC: Loop-Executor-Benchmark (graph-first Implementierung)

**Status:** Done (2026-06-27) · **Schwester-Spike:** [`SPIKE-GC-context-sufficiency`](SPIKE-GC-context-sufficiency.md) (etablierte `graph_context`)
**Frage:** Welcher **Executor × Modell** implementiert einen Graph-Milestone **korrekt, graph-first** und **aktualisiert den Graphen** — und zu welchen Kosten (Turns / aktive Zeit / Kontext)?

## Setup

- **Rig:** [`rig/dummy-slicer/`](../../rig/dummy-slicer/) — fiktiver Consumer (graphify unberührt). Spec-Ära-Graph, `FN-slice` un-realisiert; stale `docs/SPEC.md` mit **absichtlich falschen** Werten (recall 0.70 / sourceRef optional / random UUID).
- **Akzeptanz:** `scripts/verify.ts` (recall ≥0.85 + Determinismus Jaccard=1.0 + sourceRef) — **zur Laufzeit ausgeführt**. Graph-Check: `scripts/graph-check.mjs` (liest den persistierten Store).
- **Bedingungen:** echte headless Loops, scoped `--allowed-tools` (kein Permission-Bypass), MCP `graphcode` + CR-214-Hook aktiv.
- **Lokales Modell:** LM Studio, qwen/qwen3.6-27b, 48 GB M4. **LM Studio bietet ein Anthropic-`/v1/messages`-Interface mit `tool_use`** → `claude -p` kann lokal treiben.

## Ergebnis

| Lauf | Executor | Modell | Milestones | Code (verify) | Graph aktualisiert | Aktive Zeit | Turns | `graph_context` | SPEC.md |
|---|---|---|---|---|---|---|---|---|---|
| **Original (graphify, real)** | `claude -p` Cloud, `/loop` | Cloud | viele (Slicer-Pipeline) | grün | **nein** (kein Write-back-Schritt) | **~2 h** (von 17,9 h wall; 26 Fires) | **643** | **0** (Tool existierte nicht) — las `SPEC.md` 50k | **viele** |
| Rig — Cloud-Control | `claude -p` | Cloud | 1 (`FN-slice`) | **ALL PASS** | n/a (nicht beauftragt) | 157 s | 21 | 1 | **0** |
| Rig — Local | opencode | qwen3.6-27b | 1 | **ALL PASS** | Versuch — abgelehnt (Format) | 201 s | 7 | 3 | **0** |
| Rig — Local | `claude -p` @40k | qwen3.6-27b | 1 | **ALL PASS** | Versuch — denied (Allowlist) | 556 s | 29 | 1 | **0** |
| Rig — Local | `claude -p` @22k | qwen3.6-27b | 1 | **FAIL** (ctx-overflow) | — | — | — | — | — |
| **Rig — Local Voll** | **opencode** | qwen3.6-27b | 1 | **ALL PASS** | **JA — `codeRef={file,symbol}`, `missingRefs=[]`, compliance=1** | 293 s | — | ✓ | **0** |

> Original-Zeile = multi-milestone, **vor** `graph_context`; Turns/Zeit nicht 1:1 mit den Single-Milestone-Rig-Läufen vergleichbar. Qualitativ ist sie das **Anti-Pattern**: 0 Präzisions-Query, 50k stale SPEC gelesen, 643 Turns. Die Rig-Läufe sind das **After**: 1–3 `graph_context`, 0 SPEC, 7–29 Turns.

## Befunde

1. **Code lauffähig in jedem lauffähigen Lauf** — `verify.ts` ALL PASS (recall 1.0, deterministisch, sourceRef). Die opencode-Routine nutzt `crypto.createHash` + Satz-Splitting + `sourceRef {doc,page,region}`.
2. **Graph-first emergiert:** alle Rig-Executors zogen die Definition-of-Done aus `graph_context`, **0 SPEC.md-Reads** — die falschen SPEC-Werte tauchten in **keiner** Implementierung auf. Der Original-Lauf (ohne `graph_context`) las dagegen die 50k-SPEC.
3. **Graph-Update braucht das richtige Werkzeug:** die einfachen Rig-Arme **versuchten** `graph_mutate` selbständig, schrieben aber **nicht** erfolgreich (claude: nicht in Allowlist → denied; lokales Modell: Format geraten — `op:update`+String statt `op:update-node`+`codeRef:{file,symbol}`). **Erst der Voll-Lauf** mit ausbuchstabiertem Kommando schrieb über das Gate korrekt zurück. → **Rohe `graph_mutate` ist zu scharf für kleine Modelle** (siehe CR-GC-216).
4. **`claude -p` lokal = no-go:** @22k ctx Overflow (Claude-Code-Harness > Fenster); @40k noch 29 Turns / 556 s. **opencodes schlanker Harness** läuft im kleinen Fenster, in **7 Turns / 201 s** (~3,5× schneller). → **opencode ist der lokale/BYOK-Executor** („OpenCode-executed").
5. **CR-214-Hook feuerte in keinem Loop** — die Agenten gingen freiwillig graph-first. Der Hook ist der **Backstop**; die deterministische Sperre ist in der Context-Sufficiency-Spike (Arm B) bewiesen.

## Win-Condition

Erreicht: **ein 27B-Modell lokal (opencode) implementiert den Milestone korrekt, graph-first, und realisiert ihn im Graphen** — code + `codeRef`-Write-back über das Gate. Das Framework (präziser `graph_context` + schlanker Executor) macht das kleine Modell tragfähig.

## Grenzen (ehrlich)

- **Single-Milestone** (`FN-slice`); kein Multi-Milestone-`/loop` bis E2E im Rig.
- **`status` blieb `specified`** — Voll-Lauf setzte nur `codeRef`; volle Realisierung würde `status` + TEST-`testRef` setzen.
- **Timings = Wall-Clock**, 48 GB M4 / qwen3.6-27b; nicht normiert. Original-„aktive Zeit" = Summe der Inter-Message-Gaps <120 s (Idle/`/loop`-Waits eliminiert).

## Reproduzieren

`rig/dummy-slicer/`: `scripts/run-*` (siehe Scratch-Runner) · `node --experimental-strip-types scripts/verify.ts` · `node scripts/graph-check.mjs`. Lokal: LM Studio @ ≥40k ctx für `claude -p`; opencode via `opencode.json` (lmstudio-Provider + `graphcode`-MCP).
