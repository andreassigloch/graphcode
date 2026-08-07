# CR-GC-309 — `graph_mutate` echot Violations in voller Länge; Summary als Default

**Status:** open · **Angelegt:** 2026-08-07 · **Max Files:** 3
**Herkunft:** graphcode-Feldtest Graphview (`docs/GC_test-graphview-results.md` §6.1/§6.6),
Code-Audit 2026-08-07. Unabhängig von den übrigen offenen CRs.

## Problem

`graph_mutate` gibt das `MutateResult` unverändert zurück (`src/tools/write.ts:258`) — jede
Antwort listet sämtliche Warnungen mit vollem `context`, inklusive `candidate_targets`. Eine
Antwort im Feldtest führte 39 Kandidaten auf; zwei Antworten (70,3 KB und 64,9 KB) sprengten das
Tool-Result-Limit.

Bei 40 Mutationen mit dauerhaft 20-45 offenen `R-19`/`R-20`-Warnungen wiederholt sich derselbe
Text zigfach — und liegt danach in jedem Cache-Read. Gemessen: `graph_mutate`-Ergebnisse sind
**189 KB von 929 KB** aller Tool-Ergebnisse (20 %, ~47k Token).

`graph_readiness` hat das Muster mit `detail:true` bereits, die Mutation nicht.

### Warum es im Treiber nicht auffiel

Der eingebettete Executor kappt selbst — `formatGateFeedback` (`src/executor.ts:751-772`) auf
8 Violations und 2500 Zeichen, der Erfolgspfad auf `JSON.stringify(outcome).slice(0, 6000)`
(`src/executor.ts:1427`). Nur der Host-Pfad (Claude Code / OpenCode) zahlt voll.

Die zweite Kappung ist zugleich ein eigener Defekt: `.slice(0, 6000)` schneidet mitten im JSON.
Bei einer 70-KB-Antwort bekommt das lokale Modell einen abgeschnittenen Blob — kein Parse, keine
verwertbare Violation. Ein Summary-Default heilt das mit, weil die Antwort dann unter die Grenze
passt statt abgehackt zu werden.

### Zweiter Punkt: große Batches gehen zweimal raus

Das Gate-Protokoll verlangt Trockenlauf, dann Anwendung. Im Feldtest gingen der Flow-Batch
(85 Kommandos), FMEA (74), Mitigations (63) und ConOps (56) je zweimal über die Leitung.

Der A/B-Vergleich zweier Alternativen ist ein **eigener Zweck** und bleibt — der Treiber
instrumentiert ihn sogar (`stats.dryRunProbes`, `src/executor.ts:1421-1424`). Für den Fall
„ein Batch, keine Alternative" ist der zweite Durchlauf aber reine Verdopplung: das Gate ist
transaktional, ein geblockter Batch schreibt `mutations: 0`.

## Architektur-Entscheidung

Zwei additive Optionen, keine Verhaltensänderung an bestehenden Aufrufen außer dem Default von
`violations`:

```ts
violations: 'summary' | 'full'      // Default 'summary'
applyIf:    'always' | 'not-blocked' // Default 'always'
```

`summary` behält pro Violation `ruleId`, `severity`, `message`, `fixHint` und die betroffenen
uids; es entfällt `context` (und damit `candidate_targets`). **`fixHint` bleibt zwingend** — der
Treiber liest ihn (`src/executor.ts:756`).

`rules_evaluate` / `rules_get_violations` bleiben unverändert auf voller Tiefe. Sie sind die
Diagnose-Tools (`src/tools/report.ts:116`); wer `candidate_targets` braucht, fragt dort gezielt.
Das ist die Query-Precision-Regel, nicht Result-Kompression.

`applyIf: 'not-blocked'` führt den Batch in einem Durchgang aus und persistiert nur, wenn das
Verdict nicht `block` ist. `dryRun: true` bleibt vollständig unverändert.

### Geprüfte Nicht-Risiken

- `generate.ts` / `steering.ts` lesen die Mutate-Violations nicht — sie rufen `evaluateAllRules`
  selbst auf dem Graphen. Keine Kopplung.
- Der Executor liest ausschließlich Felder, die in `summary` erhalten bleiben.

## Scope (≤ 3 Dateien)

1. `src/tools/write.ts` — `GraphMutateInputSchema` um beide Felder erweitert; Projektion des
   `MutateResult` vor dem Return; `applyIf`-Zweig
2. `tests/mcp.mutate.test.ts` — Summary-Projektion, `full` unverändert, `fixHint` erhalten,
   `applyIf`-Semantik
3. `tests/executor.test.ts` — Regression: das gekappte Erfolgsergebnis ist gültiges JSON

## Akzeptanzkriterien

- [ ] Default-Antwort enthält kein `context`/`candidate_targets`, aber `ruleId`, `severity`,
      `message`, `fixHint`, uids
- [ ] `violations: 'full'` liefert byte-identisch das heutige Ergebnis
- [ ] `rules_evaluate` / `rules_get_violations` unverändert (Regression)
- [ ] `applyIf: 'not-blocked'` persistiert bei sauberem Verdict und schreibt bei `block`
      `mutations: 0` — ein Aufruf, ein Audit-Eintrag
- [ ] `dryRun: true` verhält sich unverändert, inkl. `steeringDelta` und Preview-Audit
- [ ] Ein Batch, der im Host heute > 60 KB Antwort erzeugt, liegt mit Default unter 10 KB
      (gemessen im Test, nicht geschätzt)
- [ ] `npm test && npm run build` grün

## Erwartete Wirkung

Überschlägig $5-8 in einem Lauf der Größe des Feldtests, wachsend mit der Sitzungslänge. Es ist
**nicht** der Hauptposten — der ist die Sitzungslänge selbst (Empfehlung §8.1 des Berichts:
Mechanik aus der Denk-Session heraushalten). Diese Zahl ist eine Überschlagsrechnung; der
Kontrafaktik-Lauf existiert nicht.
