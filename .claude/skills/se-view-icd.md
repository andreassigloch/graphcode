---
name: se-view:icd
version: 1
description: Interface Control Document — schema contracts, module boundaries and flow completeness
---

Render the Interface Control Document (ICD) from the live governed graph — graphcode has no view endpoint, the agent is the renderer (KNOW-via-query). The ICD is the catalog of *interfaces between parts*: the `SCHEMA` nodes (the typed data contracts, Zod), the `MOD` boundaries they cross, the `FLOW` nodes that move data, and the `io` traces that bind actors/modules to those flows. Fetch over MCP:

1. `graph_elements` `{ "type": "SCHEMA" }` — every interface contract (e.g. mutate-command, mutate-result, format-e, cli-command, ontology-graph). Each `SCHEMA` carries its Zod definition in `attributes`.
2. `graph_elements` `{ "type": "MOD" }` — the modules whose boundaries the interfaces cross.
3. `graph_elements` `{ "type": "FLOW" }` — the data flows; a FLOW is complete only when both ends are bound.
4. `graph_get_edges` `{ "edgeType": "io" }` — who produces/consumes each flow: ACTOR/MOD ↔ FLOW. The directional interface bindings.
5. `graph_get_edges` `{ "edgeType": "allocate" }` — FUNC → MOD, to attribute each interface-bearing function to its owning module.
6. `rules_get_violations` `{ "severity": "error" }` — **R-08** (trace consistency: dangling/typed-wrong edges), **R-10** (FLOW completeness: a flow missing a producer or consumer), **R-16** (ACTOR without `io`): the canonical interface-defect signals.

Present a structured summary:

## 1. Schnittstellen-Inventar
One row per SCHEMA: `SCHEMA | Zweck | Zod vorhanden? | nutzende MOD(s)`. The data contracts that define every cross-boundary message. A SCHEMA with no Zod definition in `attributes` is an unspecified interface — flag it.

## 2. Modul-Grenzen
For each `MOD`, list the flows crossing its boundary (from the `io` edges) and the schemas on those flows. This is the per-module interface surface — what it exposes and what it requires.

## 3. Flow-Vollständigkeit
Every FLOW with its producer and consumer (the two `io` ends). Flag each incomplete flow (R-10) — a flow with one end unbound is a dangling interface. Cross-check against R-08 trace-consistency errors.

## 4. Schnittstellendiagramm
A Mermaid `graph LR` of `MOD --> FLOW --> MOD` chains annotated with the SCHEMA on each flow. Keep node labels free of `(`, `)`, and `|` — those blank the whole diagram; use uids or plain names.

Source every interface, contract, and boundary from the graph queries above — do not read a hand-maintained ICD spreadsheet.
