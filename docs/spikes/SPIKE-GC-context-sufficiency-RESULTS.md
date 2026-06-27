# SPIKE-GC: Context-Sufficiency — RESULTS (2026-06-26)

Rig: [`rig/dummy-slicer/`](../../rig/dummy-slicer/) — fiktiver Consumer, **graphify unberührt**. Spec-Ära-Graph, `FN-slice` un-realisiert; stale `docs/SPEC.md` (INPUT-ONLY, **absichtlich falsche** Werte: recall 0.70, sourceRef optional, random UUIDs).

## Verdikt

| Hypothese | Ergebnis |
|---|---|
| **H1 — Content-Sufficiency** | **bestätigt.** Der Graph hält die komplette Definition-of-Done als Prosa. A0: `graph_context('Slice')`-Closure ~250 tok vs ~34k tok, die die Originalsession aus SPEC.md+Spikes las. |
| **H2 — Efficiency** | **bestätigt.** Live gegen das graphcode-Selbstmodell: 3-Node-Bundle ~250 tok, **111× kleiner** als `graph_elements{300}`. Rig-Bundle (`FN-slice`): 11 Nodes, ~667 tok = das ganze DoD. |
| **H3 — Small-Model-Viability** | **bestätigt.** qwen3.6-27b (48 GB M4) implementiert `slice()` allein aus dem ~667-tok-Bundle: **5/5** statisch **und ausgeführt** — recall 1.0 (≥0.85), deterministisch (Jaccard=1.0), sourceRef auf jedem Kandidaten. 192,5 s. |

## Arm B — Enforcement (deterministisch, kein LLM)

`scripts/armB.mjs`:
- `graph_context FN-slice` → 11 Nodes / 10 Edges / ~667 tok; `missingRefs:["FN-slice"]` (un-realisiert, korrekt geflaggt).
- CR-GC-214-Hook: `Read docs/SPEC.md` (INPUT-ONLY) → **exit 2 BLOCKED**; `Read src/slice.ts` → **exit 0 ALLOWED**.
- **VERDICT: PASS** — der Bundle liefert das DoD, die stale SPEC ist read-seitig gesperrt, Source bleibt lesbar.

## Arm C — Lokales Modell (LM Studio, qwen3.6-27b)

`scripts/armC.mjs` → Modell bekommt **nur** das Bundle, **nie** die SPEC:
- 5/5 Kriterien: exportiert `slice()`, sourceRef {doc,page,region}, deterministischer Hash (djb2, **kein** random/uuid), recall-first (Superset, kein early-drop), `candidates`-Array.
- **Ausgeführt** (`node --experimental-strip-types`): recall **1.0**, **deterministisch**, jeder Kandidat mit non-empty sourceRef.
- **Schlüssel-Beobachtung:** Das Modell folgte den **Graph**-Werten (deterministischer Hash, sourceRef **required**), nicht den **SPEC**-Werten (random UUID, optional). Es sah die SPEC nie — strukturell geschützt: erst durch den Bundle-als-einzigen-Input, im Vollloop zusätzlich durch den CR-GC-214-Deny.

## Win-Condition

Erreicht: **ein kleineres lokales Modell erledigt den Job, weil das Framework präzisen Kontext liefert.** Das ist der positive Ausgang, den der Auftrag definiert hat — nicht „Opus spart Tokens", sondern „ein 27B-Modell implementiert korrekt aus ~667 tok statt an 600k Prosa zu scheitern".

## Agentischer Voll-Loop (claude -p + opencode, 2026-06-27)

Echte headless Agenten-Loops gegen den Rig (scoped `--allowed-tools`, kein Permission-Bypass; MCP `graphcode` aktiv; CR-214-Hook aktiv). Akzeptanz = `scripts/verify.ts` (recall ≥0.85 + Determinismus + sourceRef).

| Arm | Executor | Modell | Ergebnis | Zeit | Turns | `graph_context` | SPEC.md-Reads | out tok |
|---|---|---|---|---|---|---|---|---|
| Cloud-Control | `claude -p` | Cloud | **ALL PASS** | 157 s | 21 | 1 | **0** | 36,6k |
| Local | **opencode** | qwen3.6-27b | **ALL PASS** | 201 s | 7 | 3 hits (+ `graph_mutate` write-back) | **0** | — |
| Local | `claude -p` | qwen3.6-27b @40k | **ALL PASS** | 556 s | 29 | 1 (+ 2 `graph_mutate`) | **0** | 7,8k |
| Local | `claude -p` | qwen3.6-27b @22k | **FAIL** (ctx-overflow) | — | — | — | — | — |

**Befunde:**

1. **Alle drei lauffähigen Executors** implementieren den Milestone **korrekt** (verify ALL PASS), **graph-first** (`graph_context` als DoD-Quelle), **0 SPEC.md-Reads** — die absichtlich falschen SPEC-Werte (recall 0.70 / optional / random) tauchten in keiner Implementierung auf. Zwei schrieben via `graph_mutate` ins Modell zurück (graph-native über das bloße Lesen hinaus).
2. **LM Studio hat ein Anthropic-`/v1/messages`-Interface MIT `tool_use`** → `claude -p` kann das lokale Modell voll-agentisch treiben (nicht nur OpenAI-kompatibel).
3. **`claude -p` braucht ≥ ~40k Kontext:** beim User-Default 22601 → Overflow (Claude-Code-Harness-Prompt > Fenster); **opencodes schlankerer Harness läuft auch im kleinen Fenster — und in 7 statt 29 Turns** (weniger agentische Round-Trips, ~3,5× schneller). Konkrete Stütze für „OpenCode-executed" als BYOK/Local-Pfad.
4. **Der CR-214-Hook feuerte in keinem Loop** — die Agenten gingen freiwillig graph-first (Prompt + `graph_context`-Ergonomie). Der Hook ist der **Backstop**; Arm B beweist die Sperre deterministisch.

## Grenzen (ehrlich)

- **Hook-Firing im Loop nicht beobachtet** — die Agenten lasen `SPEC.md` gar nicht erst (graph-first). Ein Arm ohne „lies SPEC nicht"-Instruktion würde das Firing provozieren; Arm B deckt die Sperre bereits deterministisch ab.
- **Timings = Wall-Clock** auf 48 GB M4 / qwen3.6-27b; nicht modell-/hardware-normiert. Lokaler `claude -p` ist ~3,5× langsamer als opencode (schwererer Per-Turn-Prompt).
- **Single-Milestone** (`FN-slice`), kein Multi-Milestone-`/loop` bis E2E.

## Graph-Lücken

- `FN-slice` ohne `codeRef` (Spec-Ära, korrekt von `missingRefs` geflaggt). Im echten Loop schließt der Agent das, indem er `src/slice.ts` realisiert; die Referenz-Impl (`spikes/score.ts`) ist ein `codeRef`-Ziel, kein neues Attribut.
