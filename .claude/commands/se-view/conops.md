---
name: se-view:conops
version: 3
description: Concept of Operations view (ISO 29148 §5.2.4 OpsCon — constraints, user classes, scenarios, change impacts) — deterministic render, thin trigger of the CR-GC-220 exporter
---

Thin trigger for the **deterministic Concept of Operations** view. It projects what `se-conops` (CREATE) and the CRs put into the graph; it does not author anything. Do NOT re-render by hand — agent formatting is a non-deterministic parallel path to the CR-GC-220 exporter.

1. Call `graph_export` `{ "views": ["conops"] }` — materializes the view to `docs/views/conops.md` and returns its path.
2. Output that file verbatim. Do not reformat, summarize, or re-query the graph — the export **is** the view (byte-identical on every re-run). To *author* operational concerns, use `se-conops`.

## What the six sections are rendered from (CR-GC-304)

Every row walks a real edge — nothing is inferred:

| § | Section | Graph source |
|---|---|---|
| 1 | System overview | `SYS.description` |
| 2 | Operational policies & constraints | `REQ` with `kinds` ∋ `non-functional` **and** `SYS compose\|satisfy REQ` or an ACTOR edge |
| 3 | User classes & involved personnel | `ACTOR` + `ACTOR io UC` |
| 4 | Operational scenarios | `UC compose FCHAIN compose FUNC` |
| 5 | Modes of operation | **named gap** — no `MODE` element type exists |
| 6 | Nature of changes & summary of impacts | `CR` + `CR relation → {UC, REQ, FUNC, MOD}` |

## Reading an empty section

An empty section is a **finding**, not a formatting bug — say so rather than glossing over it:

- **§2 empty** → the operational concerns were never authored, or the REQs exist but hang off a single FUNC/MOD instead of the SYS anchor (then they are design, not ConOps). Fix with `se-conops`.
- **§4 "kein Betriebsablauf beschrieben"** → that UC has no `FCHAIN`. The operational flow is genuinely unspecified.
- **§5** is always a gap statement — a new element type is a family decision (Drift-Lock L1/L2), not something to patch locally.
- **§6 empty** → the CRs carry no `relation` edges to the elements they touched. Add them at CR close; a change need not be a new use case to belong here.
