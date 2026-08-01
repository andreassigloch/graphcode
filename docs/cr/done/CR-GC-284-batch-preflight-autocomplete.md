# CR-GC-284 — Batch-Preflight + Autovervollständigung im Executor

**Status:** done (2026-08-01, alle Akzeptanzkriterien erfüllt; Preflight in
eigenem `src/preflight.ts` wegen 500-Zeilen-Regel)
**Datum:** 2026-08-01
**Kontext:** Audit-Analyse der Testläufe (`rig/greenfield-systemtest/results/audit/`):
R-01 (REQ ohne verify-TEST) dominiert die Gate-Rejections aller Modelle —
Haiku 26/29, Opus 17/18, devstral v14 10/23. Ursache ist teilweise selbst
provoziert: das req-Template in `generate.ts` fordert REQ-Kandidaten ohne
TEST-Erwähnung, während R-01 (error) jede REQ ohne verify im selben Batch blockt.
R-18 (illegale Trace-Paare) und R-08 (Referenz existiert nicht) sind rein
mechanisch vorab prüfbar.

## Ziel

Rejections deterministisch verhindern statt per Feedback-Loop reparieren
(Repair-Quote ist schwach: Haiku 7/33). Drei Maßnahmen im Executor, VOR dem
Gate-Call — das Gate bleibt die einzige Wahrheit, der Preflight ist reine
Batch-Hygiene ohne eigenes Regel-Urteil:

1. **Template-Fix:** req-Template (`GENERATION_TEMPLATE.req`) ergänzen um
   „jede neue REQ zusammen mit einem TEST (TEST verify REQ) im selben Batch".
2. **Batch-Autovervollständigung:** ausgehenden Batch scannen; REQ-add-node
   ohne TEST-verify-Partner (in Batch ∪ Graph) → TEST-Stub + verify-Kante
   deterministisch anhängen (Muster: it.todo-Materialisierung im Export).
   Autovervollständigte Commands im Ergebnis kennzeichnen (Log + Stats-Feld).
3. **Preflight-Checks:**
   - R-18: jedes add-edge gegen `TRACE_PATTERNS` prüfen; ist NUR die
     Gegenrichtung legal → Auto-Flip (deterministisch, geloggt); sonst lokales
     Feedback ohne Modell-Turn zu verbrennen.
   - R-08: jede Kanten-Referenz gegen Graph ∪ Batch prüfen; unbekannte uid →
     lokales Feedback mit Fuzzy-Kandidaten („unbekannt: X; ähnlich vorhanden:
     Y"), Batch NICHT ans Gate geben.

## Nicht-Ziele

- Kein zweites Gate, keine Regel-Duplikation: Preflight nutzt `TRACE_PATTERNS`
  und den Graph-Zustand aus denselben Imports (`@sigloch/contracts/se`), fällt
  bei Unsicherheit auf „durchreichen ans Gate" zurück.
- Keine Contracts-Änderung.

## Dateien (≤6)

- `src/executor.ts` (Preflight + Autocomplete + Stats)
- `src/generate.ts` (req-Template)
- `tests/executor.test.ts`
- `tests/generate.test.ts`

## Akzeptanzkriterien

- [ ] Unit-Test: Batch mit REQ ohne TEST → Stub angehängt, Gate applied
- [ ] Unit-Test: `REQ -verify-> TEST` → Auto-Flip zu `TEST -verify-> REQ`
- [ ] Unit-Test: add-edge auf unbekannte uid → lokales Feedback mit Kandidaten,
      kein Gate-Call, kein Modell-Turn verbraucht
- [ ] Stats zählen `preflightFixed` / `preflightBlocked` getrennt
- [ ] `npm run build` + bestehende Tests grün
