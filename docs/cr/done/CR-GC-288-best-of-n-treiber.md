# CR-GC-288 — Best-of-N-Auswahl im Treiber (deterministisch)

**Status:** done (2026-08-01, alle Akzeptanzkriterien erfüllt; zusätzlich
Env-Wiring `GRAPHCODE_LLM_CANDIDATES`/`GRAPHCODE_LLM_JUDGE` in run-verb.ts,
damit N>1 ohne Folge-CR nutzbar ist; `selection: 'host'|'driver'` am
graph_generate-Input hält die Protokoll-Prosa für MCP-Clients ohne Treiber)
**Datum:** 2026-08-01
**Kontext:** Das Gate-Protokoll („Alternativen per dryRun einreichen, Verdicts
vergleichen, besten anwenden") ist Prosa im generate-Prompt — befolgt hat es im
gesamten Greenfield-Vergleich NUR Haiku (29 dryRun-Proben); devstral und Opus
wandten direkt an. Die Kandidaten-Auswahl fand also de facto nicht statt.
Design bereits fixiert in `docs/executor-bigpicture.md` §6: Auswahl gehört in
den Code, nicht in die Instruktion. Entscheidungen aus der Design-Runde:
Judge als Config, **Default = unser Algo (gate)**; Best-of-N = N× „Erstelle
Lösung" (gemessene Sampling-Spreizung: temp 0.15/0.4/0.7 → Jaccard
0.45/0.18/0.14); Algo-Pick vs. LLM-Pick vergleichbar loggen.

## Ziel

1. **Sammeln:** der Executor fordert pro generate-Runde N Batches an
   (N konfigurierbar, Default 1 = heutiges Verhalten; lokal via
   Temperatur-Spread 0.15/0.4/0.7, anthropic via N Calls).
2. **Deterministisch wählen:** jeden Kandidaten als Gate-dryRun proben;
   Auswahl im Code aus dem Verdict: tier (auto-apply > suggest > block),
   dann Δm-fitAdvisory auf layer:arch, dann Element-Ausbeute als Tiebreaker.
   Nur der Gewinner wird echt angewandt.
3. **Judge-Config:** `judge: 'gate' | 'model'` — Default `gate` (unser Algo
   zieht; sonst brauchen wir ihn nicht). Bei `model` wählt die LLM aus den
   gerenderten Verdicts; BEIDE Picks werden geloggt, damit Algo- und
   LLM-Judgement messbar vergleichbar sind.
4. **Protokoll-Prosa zurückbauen:** der dryRun-Vergleichs-Auftrag verschwindet
   aus dem GATE_PROTOCOL-Prompt, wenn der Treiber die Auswahl übernimmt —
   keine parallelen Pfade (Prompt verlangt, was der Code schon tut).

## Kosten-Realität

N>1 multipliziert lokal nur Wall-Zeit ($0), bei Frontier Tokens (Opus ≈ N×).
Default bleibt darum N=1; Best-of-N ist ein bewusst gesetzter Qualitätshebel,
zuerst für den Local-Arm.

## Dateien (≤6)

- `src/executor.ts` (Sammeln, dryRun-Probe, Auswahl, Judge-Config, Logging)
- `src/generate.ts` (GATE_PROTOCOL-Anpassung)
- `tests/executor.test.ts` (scripted callModel mit N Kandidaten)
- `tests/generate.test.ts`

## Akzeptanzkriterien

- [ ] Unit-Test: 3 Kandidaten (block/suggest/auto-apply) → auto-apply gewinnt,
      nur er wird persistiert, dryRun-Proben auditiert als validate
- [ ] Unit-Test: Gleichstand im tier → Δm entscheidet, dokumentierter Tiebreaker
- [ ] judge:'model' loggt beide Picks (algoPick, modelPick) in den Stats
- [ ] N=1-Pfad byte-identisch zum heutigen Verhalten (Regression)
- [ ] `npm run build` + Tests grün
