---
name: se-view:conops
description: Concept of Operations — actors, system context, use-case scenarios and their flows
---

Render the Concept of Operations (ConOps) from the live governed graph — graphcode has no view endpoint, the agent is the renderer (KNOW-via-query). ConOps answers *who operates the system, in what context, to do what*: the `ACTOR` nodes (operators/consumers), the `SYS` node (the system boundary), the `UC` nodes (operational scenarios), and the `FLOW`/`compose` traces that connect them. Fetch over MCP:

1. `graph_elements` `{ "type": "ACTOR" }` — every operator/consumer (e.g. developer, claude-code, graphify, learning-engine, dashboard). The roles.
2. `graph_elements` `{ "type": "SYS" }` — the system-of-interest boundary node.
3. `graph_elements` `{ "type": "UC" }` — the use cases: the operational scenarios the system supports.
4. `graph_get_edges` `{ "edgeType": "io" }` — ACTOR ↔ system data exchange: what each actor sends/receives. The operational interfaces.
5. `graph_get_edges` `{ "edgeType": "compose" }` — UC → FUNC/FCHAIN decomposition and SYS → UC composition: how a scenario breaks into function chains.
6. `rules_get_violations` `{ "severity": "error" }` — **R-14** (UC without `compose`), **R-16** (ACTOR without `io`), **R-17** (SYS without `compose`): the incompleteness signals for a ConOps.

Present a structured summary:

## 1. Akteure & Rollen
One row per ACTOR: `ACTOR | Rolle | io-Schnittstellen (gesendet/empfangen)`. Distinguish human operators from consuming systems (graphify, learning-engine). An ACTOR with no `io` edge (R-16) is an undefined role — flag it.

## 2. Systemkontext
The `SYS` node and its boundary: which actors touch it (from the `io` edges), and which UCs it composes. State the system purpose in one line from the SYS description.

## 3. Operationelle Szenarien
One entry per UC: the scenario, the actor(s) that drive it, and its `compose`-linked function chain (FCHAIN/FUNC). A UC with no `compose` edge (R-14) is an unrealized scenario.

## 4. Kontextdiagramm
A Mermaid `graph LR` placing `SYS` at the center, each `ACTOR` linked by its `io` direction, and each `UC` as a scenario node. Keep node labels free of `(`, `)`, and `|` — those blank the whole diagram; use uids or plain names.

Source every actor, scenario, and interface from the graph queries above — do not read a hand-maintained ConOps document.
