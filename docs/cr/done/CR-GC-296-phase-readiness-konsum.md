# CR-GC-296 — phase_readiness konsumieren + Sprachregelung (Folge von CR-SM-226)

**Status:** done — CR-SM-226 published (@sigloch/contracts@3.0.0,
@sigloch/graphcode-client@0.5.0), phase_readiness konsumiert, Sprachregelung
durchgezogen, 437/437 Tests grün.
**Datum:** 2026-08-04 (closed 2026-08-04)
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

- [x] `graph_readiness` zeigt beide Achsen; Handoff blockt bei rotem aktuellem Gate
      (Unit-Test: Graph mit Schwelle erreicht, aber PDR-Lücke ⇒ kein done)
- [x] Begriffe konsistent (grep „Readiness Delta" außerhalb done-CRs = 0)
- [x] SVG-Labels aktualisiert, Artikel konsistent
- [x] export-after-own-mutate: Unit-Test Merge→Export ohne force, Fremd-Löschung
      weiterhin refused
- [x] `npm run build` + Tests grün (437/437)

## Nachtrag (Umsetzung 2026-08-04)

- **phase_readiness-Design:** ein RULE_TO_PHASE-Rule zählt als "covered" nur bei
  NULL offenen Findings (jede Severity) — strenger als `blockingErrors` (nur
  error). Bewusst: eine leere FCHAIN (R-15, warning) oder fehlende FLOW→SCHEMA
  (SC-04, warning) muss den Gate blocken, nicht nur error-Funde.
- **Entdeckt, außerhalb CR-296-Scope:** `exportGraphJson` (src/exporter.ts)
  flacht `node.attributes` auf Top-Level ab; einige contracts/se-Regeln (R-19,
  R-20, VR-01, SC-04 u.a.) lesen aber `element.attributes?.x` (genestet). In der
  `evaluateAllRules(exportGraphJson(graph))`-Pipeline (generate.ts/steering.ts,
  NICHT der L2-Gate) feuern diese Regeln deshalb für JEDEN Graphen mit ≥1
  TEST/FUNC IMMER — TRR (und teils CDR) werden über diesen Pfad strukturell nie
  vollständig `covered`. `graph_readiness` (harness.evaluateRules(), kein
  Export-Umweg) ist NICHT betroffen. Empfehlung: Follow-up-CR gegen
  exporter.ts oder eine Re-Nestung-Konvention — nicht in CR-296 gefixt (Datei
  nicht im Budget, Verhaltensänderung mit Tragweite über diesen CR hinaus).
- **Nebenbefund (Versions-Bump, nicht CR-296-Scope):** `graphcode-client@0.5.0`
  entfernte `hasOutTo/refFile/hasTestRef/hasCodeRef/isLeafFunc/fchainActorBounded`
  aus `readiness-completeness.ts` (CR-SM-226 rebuild) und änderte
  `scoreCompleteness`'s Signatur (3. Arg `violations` jetzt Pflicht) sowie TRR-
  Semantik (concept:true exempt jetzt komplett, nicht mehr strenger als R-19).
  `src/readiness-completeness.ts` (Re-Export-Shim) und
  `tests/readiness.completeness.test.ts` (8 Tests) entsprechend angepasst.
