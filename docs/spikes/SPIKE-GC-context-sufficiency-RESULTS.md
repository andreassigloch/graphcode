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

## Grenzen (ehrlich)

- **Kein voller agentischer `/loop`** mit Claude Code, das das lokale Modell treibt: Claude Code spricht das Anthropic-API-Format, LM Studio ist OpenAI-kompatibel; `opencode` (der vorgesehene BYOK-Executor) ist nicht installiert. Arm C testete die **entscheidende** Hypothese (Modell implementiert aus dem Bundle) direkt über die LM-Studio-API. Der end-to-end-Loop bleibt ein opencode-Setup (Folge-Schritt).
- **Arm B** validierte den Enforcement-**Mechanismus** deterministisch (Hook + Bundle), nicht das emergente Agentenverhalten unter Vollloop. Ein headless `claude -p`-Lauf gegen den Rig (Anthropic-Modell) ist als Zusatz-Arm möglich.

## Graph-Lücken

- `FN-slice` ohne `codeRef` (Spec-Ära, korrekt von `missingRefs` geflaggt). Im echten Loop schließt der Agent das, indem er `src/slice.ts` realisiert; die Referenz-Impl (`spikes/score.ts`) ist ein `codeRef`-Ziel, kein neues Attribut.
