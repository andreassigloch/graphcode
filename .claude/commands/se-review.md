---
name: se-review
version: 1
description: Readiness gate check — blockers and next steps
---

Pull readiness + violations from the governed graph over MCP. The graphcode harness speaks **MCP-stdio only** — there is no HTTP server, use the bound tools:

1. `graph_readiness` → the `ReadinessReport`: `compliance` (fraction of elements with **no error-severity** violation, in `[0,1]`), `violationsByRule` (counts keyed by contracts rule-ID — `R-*` / `RD-*`, never `BQ-*`), and the severity-sorted raw `violations` (`{ ruleId, severity, message, elementId }`).
2. `rules_get_violations` with `{ "severity": "error" }` for the hard blockers, then `{ "severity": "warning" }` for the warnings.

**Kongruenz-Urteil (BOK-CR-033).** `graph_readiness` liefert zwei Felder, die den Score erst
interpretierbar machen — lies BEIDE, bevor du PASS sagst:

- `skipped` — jede Regel, die NICHT ausgewertet wurde, als `rule:<id>`. Stehen dort
  `rule:RC-*`, war die Code-Konformanz gar nicht messbar (kein lesbarer Repo-Baum). Das ist
  **nicht** dasselbe wie "keine Verstöße", und RC-01/RC-02/RC-03 sind `error`.
- `importCoverage` — wie viel des Import-Graphen die RC-Auflösung ansehen konnte.
  `null` genau dann, wenn `skipped` die RC-Regeln nennt.

Daraus genau EINE der drei Aussagen, nie eine vierte:

| sagen | wenn |
|---|---|
| **kongruent** | `importCoverage` da, keine RC-Verstöße |
| **gedriftet** | RC-Verstöße im Report — sie einzeln auflisten wie die übrigen Blocker |
| **nicht prüfbar** | `skipped` nennt `rule:RC-*` — dann die Bindungsquote dazu sagen (FUNC mit `realRef` / FUNC gesamt) |

**Nie "grün" bei `nicht prüfbar`.** Ein Urteil ohne Bindung ist kein Urteil; ein Modell mit 0 %
Bindung kann nie kongruent sein, nur schön.

Perform the gate check:

- List every error-severity violation as a **BLOCKER** — `ruleId` · `elementId` · `message`.
- List warning-severity violations as **WARNINGS**.
- Flag readiness below the 70% threshold: report `compliance.score` as a percentage.
- Name the current phase if a milestone marks it — query `graph_elements` `{ "type": "MS" }` and read element status. The formal phase model (SRR/PDR/CDR/TRR gates) is **not yet defined** in graphcode (CR-GC-125); derive a best-effort phase and say so — do not assert a gate that does not exist.
- Recommend specific next actions to clear the top blockers, using each violation's `message`.
- State clearly: **PASS** (no error-severity violations) or **FAIL** (blockers remain) — und
  daneben das Kongruenz-Urteil aus der Tabelle oben. Ein PASS ohne Kongruenz-Aussage ist die
  halbe Zusage: Code gegen Code geprüft, Modell gegen Code nicht.
