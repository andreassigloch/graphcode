# CR-GC-105: Architektur-Verfeinerung — Kunden-Aktoren, Interface-Eskalation, UC×FCHAIN

**Status:** Done · **Closed:** 2026-06-18 · **Datum:** 2026-06-17 · **Modul:** Modell (graph) · **Refs:** ADR-001, Diskussion 2026-06-17
**Graph:** mehrere Knoten/Traces (siehe Scope) · **Max Files:** 5

## Problem (Why)
Drei Architektur-Lücken: (1) die **Kundengruppe** (Systems Engineers + Vibe Coder) fehlt als Aktor — sie
arbeiten auf Architektur-/Nutzen-Ebene und **delegieren Realisierung** an gegatete Agenten; (2) **Interface-
Änderungen** brechen die conflict-free Parallelität, ohne Eskalationsprozess entsteht Drift/Tech-Debt;
(3) zwei Use Cases (`efficient-testing`, `reduced-llm`) haben **kein FCHAIN** — Verhalten nicht modelliert.

## Entscheidung
1. **Aktoren:** `ACTOR-systems-engineer` + `ACTOR-vibe-coder` (Kunden, `io→` alle 4 UCs). `ACTOR-claude-code`
   = **Realisierungs-Agent** (graphcode-kontrolliert, OpenCode-executed). Altitude-Split: Mensch = UC/FUNC/
   FCHAIN, Agent = Realisierung durchs Gate.
2. **Interface-Eskalation** (Interface = FLOW ist bindend): Realisierungs-Agent darf FLOW NICHT direkt
   mutieren → (a) Notwendigkeit prüfen (sonst im Vertrag bleiben), (b) CR an `ACTOR-facilitating-agent` +
   Boundary pausieren, (c) `graph_impact(FLOW)` Impact-Analyse, (d) Gate-Entscheidung (versionierte FLOW-
   Mutation / reject), (e) Dependents re-scopen/sequenzieren. Zentral beim Architekten, nicht als Merge-Konflikt.
3. **UC×FCHAIN:** jeder UC ≥1 Szenario; `code-quality` hat bereits 1:N (3 FCHAINs).

## Scope (Graph-Knoten)
- `+ACTOR-systems-engineer`, `+ACTOR-vibe-coder`, `+ACTOR-facilitating-agent` (io→ UCs).
- `+REQ-interface-change-escalation` (UC-code-quality →compose).
- `+FCHAIN-interface-escalation` (compose `FUNC-graph-impact` + `FUNC-mutate`; satisfy REQ-interface-change-escalation).
- `+FCHAIN-impact-testing` (UC-efficient-testing; compose `FUNC-graph-impact`; satisfy REQ-impact-based-testing).
- `+FCHAIN-modelfree-gate` (UC-reduced-llm; compose `FUNC-mutate`+`FUNC-evaluate-rules`; satisfy REQ-small-model-viable + REQ-graceful-degradation).
- `+TEST-interface-escalation` (verify REQ-interface-change-escalation).
- Re-render `docs/views/architecture-graph.md §3` → alle 4 UCs × FCHAINs.

## Akzeptanzkriterien
- Jeder UC hat ≥1 FCHAIN; `TEST-interface-escalation -verify→ REQ-interface-change-escalation`.
- Aktoren `io→` UCs; ontologie-konform (TRACE_PATTERNS); keine dangling/invalid Traces; `seed-graph.mjs` HTTP 200.
- `architecture-graph.md §3` zeigt alle 4 UCs mit ihren FCHAINs (Mermaid-Regel: keine `()`/`|` in Labels).

## Dependencies
Additive Modell-Verfeinerung innerhalb des Frames (vordefinierte Boxen, bestehende ElementTypes).
