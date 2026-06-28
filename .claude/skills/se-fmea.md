---
name: se-fmea
version: 1
description: Perform a state-of-the-art FMEA (AIAG-VDA 7-step) on a system, subsystem, or component and integrate findings into the SE-graph + spec
---

Conduct a Failure Mode and Effects Analysis following the **AIAG-VDA FMEA Handbook (2019)** 7-step method, mapped onto this project's SE-ontology graph. Output is `docs/records/failure-mode-analysis.md` plus a CR that integrates derived requirements into the graph. This is the FMEA **create** skill; once findings are in the graph, render them with `se-view:fmea` (the read-only FMEA view) — do not re-author the analysis at render time.

**Scope argument:** the user names the analysis target (whole system, a module e.g. a `MOD` node, or a component e.g. `ACS712`). If unscoped, ask for it — do not guess.

Reference exemplar (existing, RPN-based — upgrade it to AP, do not copy verbatim): `docs/records/failure-mode-analysis.md`, integrated via `docs/cr/done/CR-FMEA-001-failure-mode-requirements.md`.

---

## The 7 Steps (each maps to graph artifacts)

### Step 1 — Planning & Preparation
- Define scope, boundary, and what is in/out of scope (e.g. COTS locomotives = out of scope).
- State the basis: domain-fault research (search authoritative sources for the domain — forums, datasheets, app notes) **plus** component-specific analysis driven by the actual BOM (`docs/project/bom-*.md`) and spec (`docs/project/specification.md`).
- List the graph elements in scope (SYS/UC/FUNC/MOD).

### Step 2 — Structure Analysis
- Walk the graph's `compose` hierarchy for the scoped target: `SYS → UC → FCHAIN → FUNC` and `MOD → MOD`.
- Query the live structure over MCP — do NOT invent elements, analyze what exists:
  - `graph_impact` `{ "id": "<scoped-target-uid>", "depth": 2 }` for the blast-radius slice around the target (Format-E),
  - `graph_elements` `{ "type": "SYS" }` (and `"UC"` / `"FUNC"` / `"MOD"`) to enumerate the in-scope nodes,
  - `graph_get_edges` `{ "edgeType": "compose" }` to walk the parent→child hierarchy; deepen a single branch on demand with `graph_expand`.
- Produce a structure tree (system → subsystem → component/function element).

### Step 3 — Function Analysis
- For each FN/MD in scope, state its intended function (what it must do, with measurable acceptance where the spec defines it).
- Link functions to the requirements they `satisfy` (FUNC→REQ edges already in graph; query via `graph_get_edges` `{ "edgeType": "satisfy" }`).

### Step 4 — Failure Analysis
- For each function, derive the **failure chain**: Failure Effect (FE, on system/user) ← Failure Mode (FM, how the function fails) ← Failure Cause (FC, root cause).
- Number failure modes `FM-NN`. Each FM entry contains:
  - **Schwere/Severity (S, 1–10) | Auftreten/Occurrence (O, 1–10) | Entdeckung/Detection (D, 1–10)**
  - **Ursache (FC):** root cause, physically grounded (cite datasheet figures, measured values where possible).
  - **Auswirkung (FE):** effect on the system and the user; flag safety-critical effects explicitly.
  - **Mitigation:** categorize each measure as `SW (Pflicht)`, `HW (Pflicht)`, `HW (Empfehlung)`, `Config`, or `Betrieb`.
  - **Spec-Bezug:** the FN/MD/RQ element the finding affects.

### Step 5 — Risk Analysis → **Action Priority (AP), not RPN**
- Rate S, O, D on the 10-point scales.
- Assign **Action Priority** using the AIAG-VDA AP logic — **Severity first, then Occurrence, then Detection**:
  - **High AP** — action MUST be taken or a justification documented. (High severity of effect, esp. S 9–10, with any non-trivial occurrence; or high S+O combinations.)
  - **Medium AP** — action SHOULD be taken or a justification documented.
  - **Low AP** — action MAY be taken.
  - Use the canonical AIAG-VDA AP lookup table for the exact S/O/D → AP mapping; Detection only shifts priority within a fixed S/O band. Safety/regulatory effects (S 9–10) are never demoted below the band their occurrence dictates by a good Detection score alone.
- Render a **risk matrix** table sorted by AP (High → Low): `# | Fehlermodus | S | O | D | AP | Kategorie`.
- **Legacy compatibility:** the existing doc shows an RPN column. You MAY keep an `RPN = S×O×D` column as a secondary/legacy indicator, but **AP is the primary, governing classification** — never let RPN override AP.

### Step 6 — Optimization
- For each High (and relevant Medium) AP item, define concrete mitigations grouped by horizon:
  - **Vor Prototyp** (design decisions: sensor choice, PCB redesign) — table: `# | Massnahme | Betroffene FMs | Aufwand`.
  - **Firmware** (before commissioning) — table: `# | Massnahme | Betroffene FMs`.
  - **Software** (sirail backend) — table: `# | Massnahme | Betroffene FMs`.
- State the **residual risk** intent: which mitigations lower O (prevention) vs. D (detection).

### Step 7 — Documentation of Results
- Write `docs/records/failure-mode-analysis.md` with sections:
  1. Zusammenfassung (count of FMs + Top-3 AP-High risks)
  2. Fehlermodi im Detail (`FM-NN`, the Step-4 entries)
  3. Risikomatrix (AP-sorted, Step 5)
  4. Handlungsempfehlungen priorisiert (Step 6)
  5. Auswirkung auf Spezifikation (Spec-Sektion → Aenderung table)
  6. Quellen (every external source actually used)
- Header: `**Stand:** <today>`, `**Methodik:** AIAG-VDA 7-Step, Action Priority`, `**Bezug:** [specification.md](specification.md)`.

---

## Graph + Spec Integration (mandatory close-out)

The FMEA is not done until findings live in the graph, not just the document.

1. **Derive requirements** from AP-High/Medium mitigations. Each becomes a `REQ` node. Check the graph first for ID collisions via `graph_get_node` `{ "uid": "<candidate>" }` (uids are not idempotent — a re-add is a collision). Use the next free `REQ-NNN`.
2. **Apply to graph** via `graph_mutate` with a single `MutateCommand[]` batch — every write goes through the Apply-Gate (L2). For each new `REQ` add:
   - an `add-node` for the `REQ`, with the FMEA finding in `attributes.rationale` and the requirement kind in `attributes.kinds` (e.g. `["risk"]` for a hazard, `["mitigation"]` for a countermeasure, or `["functional"]` / `["non-functional"]`),
   - an `add-edge` `satisfy` from the responsible `FUNC` → the `REQ` (which function is RESPONSIBLE, not merely related),
   - an `add-edge` `verify` from a `TEST` → the `REQ` (R-01: every REQ must have ≥1 verify).
   Example: `graph_mutate` `{ "commands": [ { "op": "add-node", "node": { "uid": "REQ-NNN", "type": "REQ", "name": "...", "description": "...", "attributes": { "rationale": "<FMEA finding>", "kinds": ["risk"] } } }, { "op": "add-edge", "edge": { "sourceId": "FUNC-...", "targetId": "REQ-NNN", "edgeType": "satisfy", "attributes": {} } }, { "op": "add-edge", "edge": { "sourceId": "TEST-...", "targetId": "REQ-NNN", "edgeType": "verify", "attributes": {} } } ] }`.
3. **Check the result.** `graph_mutate` returns `{ success, tier, appliedCommands, violations }`. The gate **BLOCKS the whole batch** if it would introduce a new **error-severity** violation (`tier: "block"`, `success: false`) — it does NOT silently drop nodes/edges. Read `violations`, fix the batch (e.g. add the missing `verify`), and re-apply.
4. **Check violations:** `rules_get_violations` — resolve any new R-01/R-02 gaps.
5. **Open a CR** `docs/cr/open/CR-FMEA-NNN-<desc>.md` listing the new RQs, affected spec sections, and acceptance criteria (mirror `CR-FMEA-001`). Patch `specification.md` sections named in the Step-7 impact table. If the SE-schema (ElementType/TraceType/rules) changed, bump the version in `@sigloch/contracts/se/index.ts`.
6. On completion, `git mv` the CR `open/ → done/` and commit `feat: FMEA findings for <scope> (CR-FMEA-NNN)`.

---

## Rules
- **Function-based, not part-based:** start from what each function must do, then how it fails — not from a parts list. (AIAG-VDA core principle.)
- **Severity drives priority.** A safety-critical effect (S 9–10) is High/Medium AP even at low occurrence; do not let a good Detection score hide it.
- **No symptom-fixes.** Mitigations address root causes (Step 4 FC), consistent with the project's Root-Cause-Debugging rule.
- **Real sources only.** Cite datasheets/measurements; mark engineering estimates as such. Never fabricate figures.
- **NFRs are system-wide** — do not allocate a cross-cutting failure (EMV, brownout) to a single FN if it affects the whole system (see CLAUDE.md graph rules).
- Every FM must trace to an in-graph FUNC/MOD; every derived REQ must end up in the graph with satisfy + verify.
