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
