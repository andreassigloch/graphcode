# CR-GC-296 — phase_readiness konsumieren + Sprachregelung (Folge von CR-SM-226)

**Status:** open — blockiert durch CR-SM-226 (contracts: RULE_TO_PHASE +
Sprachregelung, Familie-Review)
**Datum:** 2026-08-04
**Kontext:** Analyse 2026-08-04: Der Harness kennt die Phase-Gates nicht —
`graph_generate`/Handoff können „Struktur trägt" melden, während PDR rot ist
(real passiert: arch-Readiness 0.86 bei null FLOWs). Die Gates werden mit
CR-SM-226 Teil des Regelwerks (RULE_TO_PHASE); graphcode muss sie konsumieren
und die neue Sprachregelung durchziehen.

## Ziel

1. **Konsum:** `graph_readiness` liefert zusätzlich `phase_readiness`
   (SRR/PDR/CDR/TRR covered/total + fehlende Legs aus dem Regelstrom);
   `generationStep`-Handoff verlangt neben Schwelle + 0 blockingErrors auch
   „aktuelles Phase-Gate vollständig" (welches Gate „aktuell" ist, folgt aus
   dem ersten unvollständigen in der Reihenfolge SRR→PDR→CDR→TRR).
2. **Sprachregelung:** Begriffe aus dem contracts-SSOT — `dimension_readiness`
   / `phase_readiness` / `dimension_readiness_delta` in Tool-Outputs,
   Executor-Traces (`focus(...)`/`total` bleiben, Label im Stats-JSON) und
   Doku. Keine lokalen Label-Strings.
3. **Artikel + Diagramme richten:** `docs/articles/07-the-scoring-landscape.md`
   (Begriffe, „three views"-Tabelle bleibt inhaltlich, bekommt die neuen
   Namen); SVG-Labels „Readiness Delta" in
   `docs/articles/img/candidate-flow.svg` und `img/progress-scatter.svg` →
   `dimension_readiness Δ`. `efficiency-cumulative.svg` bleibt.
4. **Export-Governance (GVE-Audit F9):** `graph_export` bekommt den Modus
   „export-after-own-mutate" (Tool-seitige Entscheidung statt `force:true` im
   Viewer): der Refuse-to-clobber-Guard darf übersprungen werden, wenn die
   Löschungen aus im selben Prozess auditierten Batches stammen (Abgleich mit
   dem Audit-Trail seit Prozessstart). GVE stellt danach auf den Modus um.

## Dateien (≤6)

- `src/readiness.ts` (phase_readiness aus Regelstrom + RULE_TO_PHASE)
- `src/generate.ts` (Handoff-Bedingung)
- `src/tools/export.ts` (export-after-own-mutate)
- `docs/articles/07-the-scoring-landscape.md`
- `docs/articles/img/candidate-flow.svg` + `img/progress-scatter.svg`
- Tests (bestehende Dateien im Budget)

## Akzeptanzkriterien

- [ ] `graph_readiness` zeigt beide Achsen; Handoff blockt bei rotem aktuellem Gate
      (Unit-Test: Graph mit Schwelle erreicht, aber PDR-Lücke ⇒ kein done)
- [ ] Begriffe konsistent (grep „Readiness Delta" außerhalb done-CRs = 0)
- [ ] SVG-Labels aktualisiert, Artikel konsistent
- [ ] export-after-own-mutate: Unit-Test Merge→Export ohne force, Fremd-Löschung
      weiterhin refused
- [ ] `npm run build` + Tests grün
