# CR-GC-234: `graph_merge` — Replay-basierte Branch-Reintegration (semantischer Rebase)

**Status:** Open (2026-07-02) · **Milestone:** `MS-7-concurrency` · **Max Files:** 4
**Graph (SSOT):** geseedet (gate-only) `CR-GC-234`; REQ/FUNC/TEST bei Pick-up. Pointer, nicht autoritativ.
**Kontext:** Enterprise-Merge-Ladder Stufe 3 — **beendet den manuellen Merge** (User: „manual merge is a no go").

## Problem (Why)

Branch-Reintegration heute = git-**Text**-Merge auf `graph.json` + Reseed: sauber nur bei disjunkten
Änderungen; überlappende Knoten → Hand-Konflikt. State-Merge ist das falsche Primitiv. Enterprise-Antwort
(Event-Sourcing): **Operationen replayen, nicht Zustände diffen** — CRDT scheidet aus (unsere Ops
kommutieren nicht: `delete-node` vs `update-node`; `V3_RULES` sind globale Invarianten = Governance).

## Decision

Read-Tool + Write-Verb **`graph_merge`** in `src/merge.ts` (+ MCP-Registrierung):

- **Input:** Pfad zu einem Branch-Command-Log (`.graphcode/audit.jsonl` des Worktrees, CR-232) +
  `sinceVersion` (der Fork-Punkt: gemeinsame Basis-Version, CR-233) + `dryRun`.
- **Mechanik:** die Branch-Einträge **nach** dem Fork-Punkt werden in Log-Reihenfolge **durchs
  bestehende Gate** (`harness.mutate()`, O3-serialisiert — kein Parallelpfad) auf der aktuellen Base
  re-applied. Jeder Batch wird normal regel-validiert.
- **Konflikte = Gate-Sprache, keine Text-Konflikte:** ein Replay-Batch, der auf der neuen Base eine
  error-Violation erzeugt (R-08 dangling nach fremdem Delete, R-18 illegales Paar, Delta-Errors) →
  wird **übersprungen + im Report ausgewiesen** (`applied[] / conflicted[]` mit Violations + fixHint) —
  maschinell auflösbar durch den Agenten; Mensch nur bei echtem Semantik-Konflikt.
- **`dryRun:true`** ändert nichts (Report only) — der „merge preview".
- **Workflow:** `gcw <branch>` → arbeiten → `graph_export` + commit → auf der Ziel-Base:
  `graph_merge {log, sinceVersion}` → `graph_export`. git merged danach nur noch generierte Artefakte.

## Akzeptanz

- Zwei divergente Logs mit **disjunkten** Änderungen: Replay appliziert beide vollständig, 0 conflicted.
- **Überlappender** Konflikt (Branch A löscht Knoten, Branch B updated ihn): Replay überspringt den
  betroffenen Batch, Report nennt Violation + Element — nichts wird still angewendet.
- `dryRun` lässt Graph + Log byte-identisch.
- Report unterscheidet `applied` / `conflicted` / `skipped` (bereits enthalten, idempotent).
- `npm run build` + `npm test` grün.

## Out of scope (Follow-up)

- Auto-Resolution-Strategien (theirs/ours/interactive) — erst Erfahrung mit dem Report sammeln.
- `se-merge`-Skill (Agent-Workflow um das Tool) — folgt, wenn das Tool steht.

## Dependencies

**CR-GC-232** (Branch-Log als Quelle) · **CR-GC-233** (Fork-Punkt als Version). Gate/O3 vorhanden (CR-218).
