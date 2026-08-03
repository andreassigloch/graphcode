# CR-GC-289 — Best-of-N-Ranking: Ziel-Delta statt Volumen

**Status:** done (2026-08-03, v18 validiert: 24 Rd. devstral N=3 → 40 El/78 Tr,
voller Typ-Mix statt UC-Monokultur [8 UC/12 FCHAIN/6 FUNC/5 REQ/5 TEST],
NUR 2 Steering-Errors — bester lokaler Endgraph der Messreihe [v14: 19, v12: 14],
0 Gate-Rejections, 115 min. Inklusive tier-Fix nach v17-Befund: tier nur noch
Block-Filter + späte Präferenz.)
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

## Warum Readiness-Delta primär und nicht ℝ⁶ (Design-Entscheid 2026-08-02)

Ziel ist nicht der große, sondern der GUTE und VOLLSTÄNDIGE Graph. Die beiden
Räume teilen sich das so auf:

- **Vollständig + regelbasiert gut = Readiness-Raum.** Der Steering-Katalog
  enthält neben Abdeckung auch die Qualitätsregeln (UC-01..06, BQ, ND) — ein
  Volumen-Batch (v16: 26 UCs) hat hier ein NEGATIVES Delta und verliert, weil
  er den Graphen messbar schlechter macht, nicht weil er groß ist.
- **Topologisch gut = ℝ⁶.** Als Primärkriterium in der Expand-Phase ungeeignet:
  (a) die arch-Ebene ist früh leer — UC/REQ/TEST-Batches bewegen ℝ⁶ nicht
  (exakt der v16-Bug: Δm ≈ 0 → Durchfall auf den Volumen-Tiebreaker);
  (b) ℝ⁶ ist ohne Zielprofil richtungslos (6er-Vektor, Gewichte fehlen).
  Deshalb Rang 2 direkt hinter dem Readiness-Delta: sobald Kandidaten die
  arch-Ebene berühren, entscheidet ℝ⁶ mit. Die reine ℝ⁶-Steuerung ist die
  Handoff-Phase (graph_suggest + Zielprofil) — bisher von keinem Lauf erreicht.
- Mutations-Zahl bleibt NUR Determinismus-Anker bei komplettem Gleichstand;
  Graphgröße wird vom Stop-Kriterium (Schwelle→Handoff) begrenzt, nicht belohnt.

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
  **Entscheidung (2026-08-03): nur dryRun.** Der einzige Konsument ist das
  Best-of-N-Ranking (dryRun-Proben); nach echtem Apply ist der Nachher-Zustand
  per `graph_readiness` lesbar — die doppelte Katalog-Evaluierung pro Write
  wäre Kostenstelle ohne Nutzer. Messhelfer: `src/steering-snapshot.ts`
  (extrahiert aus generate.ts, EIN Messpfad für Fokus-Wahl und Delta).
- Messlauf v17 (24 Rd. devstral, N=3, sonst v16-Konfiguration): Erwartung
  Typ-Mix statt Monokultur; auch ein Negativ-Ergebnis wird dokumentiert.
  **v17 gefahren (2026-08-03) — KONFUNDIERT, kein valider Ranking-Beleg:**
  auf der neuen LM-Studio-Box (10.1.3.76) blieben 55/72 Kandidaten-Slots leer;
  temp 0.15 lieferte nur 3/24 Batches (8 Leerantworten) — invertiert zur alten
  Box, Sampler-/Box-Thema, mit der danach nicht mehr erreichbaren Box nicht
  weiter verifizierbar. Nur 6 Applies → 16 Elemente. ZWEI verwertbare Befunde:
  (a) die Pick-Traces zeigen das Ziel-Delta aktiv (R1: 13-Mutationen-Kandidat
  schlägt 2× 18er über total-Delta); (b) Runde 3 belegte einen RANKING-FEHLER —
  tier VOR focus ließ einen Null-Fortschritt-auto-apply (20 Upserts, total 0.00)
  eine Reparatur (+0.04, suggest) schlagen, weil frische TESTs R-19-Warnings
  tragen → Reparatur landet als suggest. **Gefixt:** tier ist jetzt nur noch
  Block-Filter + späte Präferenz bei gleichem Ziel-Delta (Test „v17-Fix" in
  executor.bestofn.test.ts). Validierungslauf v18 bei stabiler Box nachholen.

## Dateien (≤6)

- `src/tools/write.ts` (steeringDelta im dryRun-Zweig)
- `src/readiness.ts` oder kleiner Helper (Readiness-Snapshot-Vergleich)
- `src/executor.ts` (rankCandidates, Trace)
- `tests/executor.bestofn.test.ts`
- `tests/mcp.mutate-input.test.ts` (Verdict-Payload)

## Akzeptanzkriterien

- [x] Unit-Test: Fokus-Reparatur-Kandidat schlägt Volumen-Kandidaten
      (echte Verdicts auf Disk-Kuzu: REQ+TEST/4 Mut. schlägt 6 UCs/18 Mut.)
- [x] steeringDelta deterministisch, auditiert als Teil des Preview-Verdicts
      (Verdict-Payload wie fitAdvisory; der Preview selbst = validate-Eintrag —
      das AuditEntry-Schema aus graph-api-core trägt keine Zusatzfelder,
      Erweiterung wäre ein Contracts-Bump)
- [x] Trace macht den Pick nachvollziehbar (alle Ranking-Stufen sichtbar)
- [x] N=1-Regression: Verhalten unverändert
- [x] Messlauf dokumentiert (v17 konfundiert; v18 = valider Beleg:
      Typ-Mix statt Monokultur, 40 El, 2 Steering-Errors, 0 Rejections)
- [x] `npm run build` + Tests grün (68 Dateien / 417 Tests)
