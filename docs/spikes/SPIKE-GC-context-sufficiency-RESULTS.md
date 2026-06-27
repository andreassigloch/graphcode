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

| Arm | Executor | Modell | Code (verify) | Graph aktualisiert | Zeit | Turns | `graph_context` | SPEC.md |
|---|---|---|---|---|---|---|---|---|
| Cloud-Control | `claude -p` | Cloud | **ALL PASS** | n/a (nicht beauftragt) | 157 s | 21 | 1 | **0** |
| Local | opencode | qwen3.6-27b | **ALL PASS** | Versuch — **abgelehnt** (Format) | 201 s | 7 | 3 | **0** |
| Local | `claude -p` | qwen @40k | **ALL PASS** | Versuch — **denied** (Allowlist) | 556 s | 29 | 1 | **0** |
| Local | `claude -p` | qwen @22k | **FAIL** (ctx-overflow) | — | — | — | — | — |
| **Local — Voll** | **opencode** | qwen3.6-27b | **ALL PASS** | **JA — `codeRef` gesetzt, `missingRefs=[]`** | 293 s | — | ✓ | **0** |

**Code getestet+lauffähig:** alle Läufe `scripts/verify.ts` = ALL PASS (recall 1.0, Determinismus Jaccard=1.0, sourceRef) — zur Laufzeit ausgeführt, nicht behauptet. Die opencode-Routine nutzt `crypto.createHash` (deterministische IDs), Satz-Splitting, `sourceRef {doc,page,region}`.

**Befunde:**

1. **Alle lauffähigen Executors** implementieren den Milestone **korrekt**, **graph-first** (`graph_context` als DoD-Quelle), **0 SPEC.md-Reads** — die absichtlich falschen SPEC-Werte (recall 0.70 / optional / random) tauchten in **keiner** Implementierung auf.
2. **Graph-Update — Korrektur:** die einfachen Arme **versuchten** `graph_mutate` aus eigenem Antrieb, aber **keiner schrieb erfolgreich** — `claude -p` hatte `graph_mutate` nicht in der Allowlist (denied), und das lokale Modell riet das Kommando-Format falsch (`op:update` + `codeRef:"string"` statt `op:update-node` + `codeRef:{file,symbol}`). **Erst der Voll-Lauf** mit ausbuchstabiertem Format schrieb über das Gate korrekt zurück: `FN-slice.codeRef={file,symbol}`, `missingRefs=[]`, readiness-compliance=1. → **Rohe `graph_mutate` ist ein scharfes Werkzeug für kleine Modelle; ein `graph_realize(funcUid,file,symbol)`-Affordance (analog zur `graph_context`-Ergonomie) ist der nächste Schritt.**
3. **LM Studio hat ein Anthropic-`/v1/messages`-Interface MIT `tool_use`** → `claude -p` kann das lokale Modell voll-agentisch treiben.
4. **`claude -p` lokal = no-go:** beim User-Default 22601 ctx → Overflow (Claude-Code-Harness > Fenster); selbst @40k ist es 29 Turns / 556 s. **opencodes schlanker Harness** läuft im kleinen Fenster, in **7 Turns / 201 s** (~3,5× schneller). → opencode ist der lokale Executor; großes Kontextfenster killt lokale Performance.
5. **Der CR-214-Hook feuerte in keinem Loop** — die Agenten gingen freiwillig graph-first. Der Hook ist der **Backstop**; Arm B beweist die Sperre deterministisch.

## Grenzen (ehrlich)

- **Hook-Firing im Loop nicht beobachtet** — die Agenten lasen `SPEC.md` gar nicht erst (graph-first). Arm B deckt die Sperre deterministisch ab.
- **`status` blieb `specified`** — der Voll-Lauf setzte nur `codeRef` (so beauftragt); ein voll-realisierter Knoten würde zusätzlich `status` + die TEST-`testRef` setzen.
- **Timings = Wall-Clock** auf 48 GB M4 / qwen3.6-27b; nicht normiert.
- **Single-Milestone** (`FN-slice`), kein Multi-Milestone-`/loop` bis E2E.

## Graph-Lücken

- `FN-slice` ohne `codeRef` (Spec-Ära, korrekt von `missingRefs` geflaggt). Im echten Loop schließt der Agent das, indem er `src/slice.ts` realisiert; die Referenz-Impl (`spikes/score.ts`) ist ein `codeRef`-Ziel, kein neues Attribut.
