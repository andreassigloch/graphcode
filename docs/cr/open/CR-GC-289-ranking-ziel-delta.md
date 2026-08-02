# CR-GC-289 — Best-of-N-Ranking: Ziel-Delta statt Volumen

**Status:** open
**Datum:** 2026-08-02
**Kontext:** Messlauf v16-bo3 (CR-288, 24 Rd. devstral, N=3): 0 Gate-Rejections,
aber UC-Monokultur (26/33 Elemente, kein REQ/TEST/FUNC). Root Cause im Ranking
`tier → Δm → mutations`: Δm (fitAdvisory, CR-274) misst NUR den ℝ⁶-Vektor auf
layer:'arch' — Expand-Batches (UC/REQ/TEST/FCHAIN) bewegen diese Ebene nicht,
Δm ≈ 0 für alle Kandidaten, der Mutations-Tiebreaker entscheidet → Volumen-Bias.
Das widerspricht der Design-Intention: die Kandidaten-Auswahl soll ZIELGESTEUERT
sein (Reparatur der schwächsten Dimension), nicht mengengesteuert.

## Ziel

Das Ranking-Kriterium wird der messbare Steuerungs-Fortschritt im
Readiness-Raum — dem Raum, in dem `graph_generate` den Fokus wählt:

1. **`steeringDelta` im dryRun-Verdict** (`graph_mutate`, dryRun-Zweig): vor
   dem `loadGraph()`-Restore auf dem in-memory angewandten Zustand messen —
   `blockingErrors`-Delta und Readiness-Score-Delta je Dimension
   (`evaluateAllRules` + `computeReadiness`, der STEERING-Katalog inkl.
   UC-01/ND — nicht der Gate-Katalog). Pure Messung: beeinflusst weder tier
   noch success (Muster fitAdvisory/CR-274).
2. **`rankCandidates` im Executor** neu:
   tier (block raus) →
   **Score-Delta der Fokus-Dimension** (aus `GenerationStep.focusKey`) →
   **Gesamt-Readiness-Delta** (ungewichtete Summe der Score-Deltas;
   `blockingErrors`-Anstieg strikt negativ) →
   Δm(arch) →
   mutations (letzter Tiebreaker, unverändert als Determinismus-Anker).
3. **Trace** je Kandidat: `candidate 2/3: tier=… focus(uc)=+0.04 total=+0.02
   Δm=+0.0 mutations=26` — der Pick wird nachvollziehbar.

## Abgrenzung

- **Kein Zielprofil in diesem CR** (Gewichte je Dimension, Billion-User vs.
  Banking — der offene Runde-1-Design-Punkt aus dem Abschlussbericht):
  das Ranking nutzt Gleichgewichtung + Fokus-Priorität. Zielprofil = eigener
  CR, weil er auch `graph_generate`/Handoff betrifft.
- Gate-Semantik unverändert; steeringDelta ist Verdict-Payload, kein Urteil.
- N=1-Pfad unverändert (kein Ranking aktiv).

## Validierung

- Unit: Kandidat A „26 UCs, 40 Mutationen, tier suggest" vs. Kandidat B
  „3 REQ+3 TEST auf der Fokus-Dimension, 12 Mutationen, tier suggest" →
  **B gewinnt** (Fokus-Delta), mit echten Verdicts auf Disk-Kuzu.
- Unit: steeringDelta erscheint im dryRun-Verdict, nicht im Apply-Verdict
  (oder in beiden — Entscheidung dokumentieren), graphVersion bewegt sich nicht.
- Messlauf v17 (24 Rd. devstral, N=3, sonst v16-Konfiguration): Erwartung
  Typ-Mix statt Monokultur; auch ein Negativ-Ergebnis wird dokumentiert.

## Dateien (≤6)

- `src/tools/write.ts` (steeringDelta im dryRun-Zweig)
- `src/readiness.ts` oder kleiner Helper (Readiness-Snapshot-Vergleich)
- `src/executor.ts` (rankCandidates, Trace)
- `tests/executor.bestofn.test.ts`
- `tests/mcp.mutate-input.test.ts` (Verdict-Payload)

## Akzeptanzkriterien

- [ ] Unit-Test: Fokus-Reparatur-Kandidat schlägt Volumen-Kandidaten
- [ ] steeringDelta deterministisch, auditiert als Teil des Preview-Verdicts
- [ ] Trace macht den Pick nachvollziehbar (alle Ranking-Stufen sichtbar)
- [ ] N=1-Regression: Verhalten unverändert
- [ ] Messlauf v17 dokumentiert (Typ-Mix-Vergleich zu v16)
- [ ] `npm run build` + Tests grün
