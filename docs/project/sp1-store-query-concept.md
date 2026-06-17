# SP-1 — Store & Query Concept (Spike + Decision)

**Date:** 2026-06-17 · **Trigger:** review finding — `graph_impact`/`graph_expand` traverse an in-memory TS mirror instead of Kuzu; persistence model (`:memory:` vs disk) questioned.
**Status:** Decision proposed (confirm to lock). Realized by corrective CRs in `MS-3-mvp-readiness`.

## 1. Question
Is graphcode using Kuzu as a **query engine** or just a **file format**? And: `:memory:` Kuzu seeded from disk, or persistent on-disk Kuzu? Measured on the real graph (212 nodes / 421 traces) with the actual `kuzu-wasm` adapter.

## 2. Measurements

| Path | result |
|---|---|
| **TS-BFS** `graph_impact(MOD-harness,1)` (current impl) | **11 nodes**, 0.013 ms — but needs the **full 212-node array in RAM** |
| **Cypher** `getSubgraph(MOD-harness,1)` | **3 nodes**, 23 ms · depth 2 → still 3 nodes |
| Seed 212 nodes / 421 edges into Kuzu | **~2.4 s** (`:memory:` and disk identical — per-node MERGE) |
| Full `loadGraph()` | 18 ms |
| On-disk **reopen + load** (no re-seed) | **176 ms** |

## 3. Findings (the numbers changed the conclusion)

**F-1 — Correctness bug, not just an engine smell.** TS-BFS returns **11** nodes, Cypher `getSubgraph` returns **3** — they compute *different things*. TS-BFS is **undirected** (every neighbor both ways). `getSubgraph` is **outgoing-only** (`(root)-[*]->(m)`). But `graph_impact` is supposed to be the *blast radius* — "Caller/Traces/Tests" (R6/R12) — which is the **incoming/upstream** set (things that point **to** `MOD-harness`: its CRs, the FUNCs allocated to it, SYS). **Neither path is correct**: TS-BFS is over-broad (undirected), `getSubgraph` is the *wrong direction* (downstream). `TEST-impact-subgraph` passed anyway because it only asserts "subgraph < full" — it never checks the **node set** or **direction**. Same weak-test pattern as the M2 absolute-gate bug.

**F-2 — Persistence: the spike vindicates the disk lock.** `:memory:` Kuzu must **re-seed 2.4 s on every startup**; on-disk Kuzu **reopens in 176 ms** with no re-seed. So "in-memory + seed from disk" is *not* the cheaper model — it's a 2.4 s startup tax per process. The verriegelte `"Persistenz = Disk, nie :memory:"` is **confirmed by measurement**, not dogma. (The committed JSON is still needed as the git artifact — see F-3.)

**F-3 — Three representations, one too many.** Today: on-disk Kuzu **+** committed JSON **+** a persistent TS mirror (`this.graph`). The TS mirror is the redundant one — and it's what queries run against (F-1). The 194-vs-196 dashboard divergence is the same class: copies drift when there's no single authoritative sync path.

**F-4 — Cypher latency is a non-issue; seed is the only cost.** 23 ms/query is invisible next to agent/LLM round-trips. The only real cost is the 2.4 s seed — and on-disk pays it **once** (on `init`/import), not per startup. Batch-insert (UNWIND) can cut it later if needed.

## 4. Decision (proposed)

**Keep on-disk Kuzu as the single in-process store & query engine** (lock holds, now data-backed). **Retire the persistent TS mirror.** **The committed JSON is the durable git SSOT**, kept in sync by exactly one path.

Concretely:
1. **Queries → Kuzu Cypher, correct direction.** `graph_impact` = reverse/upstream traversal (`MATCH (m)-[*1..d]->(root) RETURN m` + the typed Caller/Trace/Test set), `graph_expand` = on-demand Cypher re-traversal (R13), `graph_elements`/`get_edges` = filtered Cypher. No query loads the full graph.
2. **Drop `this.graph` as a query source.** Keep a **transient** full load *only* for whole-graph rule-eval (`DefaultRuleEngine` needs a full `Graph`; loadGraph = 18 ms, acceptable). It is never the read path for agent queries.
3. **One write path, one sync path.** Every mutation goes through the gate → Kuzu. The **re-exporter** (`MOD-docs`/CR-GC-113) deterministically writes Kuzu → committed JSON on commit (`REQ-auto-persist-merge`). JSON ↔ Kuzu can never silently diverge → fixes the 194/196 class.
4. **Tests assert semantics, not size.** `graph_impact` tests pin the **exact dependent set + direction** (e.g. `CR-GC-100`, the allocated FUNCs must appear; downstream-only must not). Add a guard that the full graph is **not** materialized for a query.

## 5. Target architecture (one line)
**Committed JSON = durable SSOT (git) → seeds → on-disk Kuzu = single live store + Cypher query engine → deterministic re-export back to JSON.** Agent reads = precise Cypher subgraphs. Rule-eval = transient full load. No persistent TS mirror.

## 6. Corrective CRs (graph-first, under MS-3)
- **CR-GC-119 (new)** — Query layer → Kuzu Cypher with correct impact direction; retire TS-BFS + persistent mirror; strengthen `TEST-impact-subgraph` to assert the dependent set. Realizes `REQ-query-precision`, `REQ-progressive-expansion` (currently *violated*), touches `MOD-mcp-tools` + `MOD-harness`.
- **CR-GC-113** — re-exporter (already planned) becomes the single Kuzu→JSON sync path (`REQ-auto-persist-merge`).
- Seed-perf (UNWIND batch) — noted, non-blocking; revisit only if `init` time matters.

## 6b. SP-2 — Scaling to 10k + the grep baseline (added 2026-06-17)

Measured: synthetic 10k-node / 10k-edge graph through the real adapter; grep/rg over a real 182-file / 33k-LOC codebase.

| | latency | scales with |
|---|---|---|
| **grep** (182 files) | **5–6 ms** | codebase size (grows with repo) |
| **ripgrep** | **9–12 ms** | codebase size |
| **Cypher** `getSubgraph` d1/d3/d5 @10k | **22 / 27 / 37 ms** | result size only — **flat vs graph size** |
| **TS-BFS** d1/d3/d5 @10k | 0.08 / 0.28 / 0.98 ms | full graph in RAM + O(edges)/step |
| Seed 10k (nodes 7.8s + **edges 51s**) | **59 s** | linear, edge-insert is the bottleneck |
| On-disk reopen (no re-seed) @10k | **617 ms** | — |

**Honest conclusions (the grep question forced these):**
- **"Graph is faster than grep" is FALSE on latency.** A Cypher call (~22 ms) costs ~3–4× a grep (~6 ms). Both are negligible next to LLM round-trips — latency is a wash, so it must **not** be the selling point.
- **The graph win is precision + tokens + scale-independence, not speed.** `graph_impact` returns the *exact typed dependent set* (3 nodes) the model uses directly — replacing grep's text hits + the follow-up file reads to reconstruct structure. Fewer calls, fewer tokens, no full-file dumps.
- **Scale flips it the right way.** grep grows with repo size; Cypher latency is **flat** as the graph grows (indexed); TS-BFS needs the whole graph in RAM (defeats the small-context / large-repo goal). At the scale graphcode is *for*, Cypher + precise subgraphs win — not at 212 nodes, where TS-BFS is actually 2000× faster.
- **On-disk is non-negotiable at scale.** In-memory would re-seed **59 s on every startup** at 10k; on-disk reopens in **617 ms**. Your "startup only once" holds for in-memory *per process* — but on-disk pays it *once ever*. The lock is reconfirmed, harder.
- **NEW blocker:** edge-seed is 51 s for 10k (per-edge MERGE). Must batch (UNWIND) before 10k is real → perf CR.

**Net:** choosing Kuzu/Cypher is a **strategic bet for scale + precision**, knowingly slightly over-engineered at today's 212 nodes. We commit to it because graphcode's whole reason for existing is large repos / small-context LLMs — but we stop claiming it's faster than grep.

**The one-line value prop (do use this one):** the agent should **KNOW the right elements (graph), not guess them (grep).** grep returns text candidates the model must then read files to interpret; `graph_impact` returns the *authoritative, typed* dependency set (the exact CRs/FUNCs/TESTs that touch a node) the model uses directly. The win is *correctness + determinism of the answer*, then tokens, then — at scale — flat latency. Never speed at MVP scale.

## 7. Residual / not changed
On-disk Kuzu stays the lock. `:memory:` remains valid only for ephemeral unit tests. Rule evaluation stays in `graph-api-core`'s `DefaultRuleEngine` (whole-graph, in-process) — moving rules to Cypher is out of scope here.
