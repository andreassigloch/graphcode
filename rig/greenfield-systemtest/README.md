# Greenfield System Test — graphcode's top-level system test

The automated greenfield test: an **empty graph**, **one prompt**, and the question
whether a **local model matches a frontier model** at authoring a governed
architecture — scored by graphcode's own rules, not by an AI judge.

Recorded in graphcode's own graph as `TEST-greenfield-systemtest`, verifying
`UC-reduced-llm`, `UC-token-efficiency`, and `UC-code-quality`.

## What it proves (and what it doesn't)

| Claim | Maps to | Measured by |
|---|---|---|
| **b — local ≈ frontier** | `UC-reduced-llm` | same prompt/host, qwen-35b vs Opus 5, metric ranges over N runs |
| **token cost is honest** | `UC-token-efficiency` | tokens in/out/**reasoning** + cost + wall, never merged |
| **c — runnable app** | `UC-code-quality` | Phase 2 only, on ONE chosen graph (not in this script yet) |

It does **not** decide whether an architecture is *good* — that stays human
judgment. It measures form (readiness), reuse of real capability, legality, and
redundancy — all decidable, all computed.

## Design

- **Start:** empty graphcode workspace per run (`graphcode init`). The
  sigloch-modules graph (59 elements) is the **held-out golden** — used only to
  score, never loaded. The module *source/docs* are readable material, so
  discovering the capabilities is part of the task (true greenfield).
- **Host:** both arms run through **Claude Code** — the only variable is the
  model. Local (qwen3.6-35b-a3b) is routed via LM Studio's Anthropic endpoint
  (`ANTHROPIC_BASE_URL`); Opus 5 runs native. "opencode vs Claude Code" is a
  separate test, deliberately not mixed in here.
- **Gate:** authoring goes through the real MCP Apply-Gate (`graph_mutate`), so
  this exercises graphcode, not just a raw model call.
- **Arms:** `qwen-35b` (local), `opus5` (frontier). N = 3 runs each → 6 runs,
  the run-to-run spread is the "stability" signal.

## Metrics per run (`metrics.mjs`, pure/auditable)

- **readiness** — 8 dimensions from `graph_readiness` (form completeness).
- **reuse-coverage** — % of golden MOD/FUNC/UC the architecture converged on
  (conservative exact-name match; **lower bound**, audit the match list).
- **redundancy** — new elements duplicating an existing golden capability.
- **legality** — blocked/illegal mutations from the run's `audit.jsonl`.
- **tokens** — in / out / reasoning, **cost**, **wall** (from `claude -p --output-format json`).

## Run

```bash
# prerequisites: dist built (npm run build), LM Studio up with the local model,
# Claude Code authenticated for Opus 5.
export LMSTUDIO=http://<lm-studio-ip>:1234   # local endpoint (Anthropic-compatible)
export RUNS=3
node rig/greenfield-systemtest/run.mjs        # → results.json (raw rows)
node rig/greenfield-systemtest/report.mjs      # → table + ranges + limits
```

Per run leaves `runs/<arm>-<i>/` with `graph.json`, `readiness.json`,
`audit.jsonl`, `usage.json` — everything inspectable by hand.

## Status

- `metrics.mjs` math **verified** against real graphs (golden-vs-golden = 100 %,
  independent graphs discriminate correctly).
- `run.mjs` / `report.mjs`: wired, syntax-checked; **not yet executed
  end-to-end** — needs the live LM Studio endpoint + Opus access + ~6 multi-minute
  runs. First execution will confirm the `claude -p` usage-JSON shape and the
  `graph_export`/`graph_readiness` handler return shapes (both handled
  defensively, but unverified against a live authored store).

## Then: Phase 2 (claim c)

Pick the best-fit graph **together** (human), author its implementation plan
through the gate, then run the coding round — executors `qwen-35b` and `devstral`
(the non-reasoning coder is the probe: can precise structure de-skill the coder
into producing a green build?). Not scripted here yet.

## Betriebsmodi der Arme (CR-GC-572)

Ein Arm unterscheidet sich vom naechsten in bis zu drei Achsen. `ARM_ACHSEN` in
`run.mjs` traegt sie, `report.mjs` zeigt sie und rechnet paarweise aus, in wie vielen
Achsen sich zwei Arme unterscheiden:

| Arm | wer treibt | Modell | Agent-Harness |
|---|---|---|---|
| `qwen-35b` | Agent | lokal | opencode |
| `qwen38-claude` | Agent | lokal | claude-code |
| `opus5` | Agent | frontier | claude-code |
| `gcrun` | Executor | lokal | entfaellt |
| `gcrun-frontier` | Executor | frontier | entfaellt |

`agent: null` heisst **entfaellt**, nicht unbekannt: treibt der Executor, gibt es keinen
fremden Agenten, und seine Abwesenheit IST die Treiber-Differenz — keine zweite Variable
daneben. Unter den agent-getriebenen Armen ist der Agent sehr wohl eine Achse
(`qwen-35b` gegen `qwen38-claude`).

Warum das zaehlt: `opus5` gegen `gcrun` unterscheidet sich in **zwei** Achsen zugleich
(Treiber und Modell). Jede Aussage dieser Paarung ueber "die Steuerung" ist damit
konfundiert. `gcrun-frontier` schliesst die Luecke — gegen `opus5` unterscheidet er sich
in **genau einer**: wer die Schleife treibt.

### Den Frontier-Executor fahren

```bash
cp ../../.env.example ../../.env        # einmalig; Key eintragen — .env ist gitignored
ARMS=gcrun-frontier,opus5 RUNS=3 node run.mjs
node report.mjs
```

**Der Key** liegt in `graphcode/.env` (Umgebung hat Vorrang). `run.mjs` liest die Datei,
laedt sie aber nicht in `process.env`: nur `gcrun-frontier` bekommt den Wert, `claude -p`
nie — sonst liefe `opus5` still ueber API-Abrechnung statt ueber den Claude-Code-Login.

**Kosten:** ~9 $/Lauf (Erfahrungswert `opus5`). Deshalb faehrt der Arm **nur auf
namentliche Nennung** in `ARMS` — ein blosses `node run.mjs` laesst ihn aus. Fehlt der
Key, bricht der Lauf ab, bevor irgendetwas startet. `GCRUN_FRONTIER_MAX_ROUNDS` (Default
8) und `maxStepTurns` begrenzen zusaetzlich; ein Ausreisser kostet kein Vielfaches.

Der Key ist die **Leitung, nicht der Unterschied**: `claude -p` ist ein Agent (eigener
System-Prompt, Kontext-Management, Kompaktierung, Skills), `graphcode run` ist unsere
Schleife (Rundenprompt aus `graph_generate`, kuratiertes Toolset, vorenthaltene Werkzeuge,
Preflight, Gate-Reparatur). Gleiches Modell, gleiche MCP-Werkzeuge, andere Schleife.
