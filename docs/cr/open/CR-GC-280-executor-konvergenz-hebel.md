# CR-GC-280 — Executor-Konvergenz-Hebel (Folge zu CR-GC-278/279)

**Status:** open
**Datum:** 2026-07-31
**Branch:** feat/embedded-executor

## Ziel

Die drei im v6-Lauf identifizierten billigen Hebel, damit ein lokaler
`graphcode run` die Zerlegung bis MOD/REQ/TEST-Tiefe trägt:

1. **`[ARGS]`-Text-Recovery** — devstral schreibt Tool-Calls wiederholt als Text
   (`graphcode_graph_elements[ARGS]{"type":"UC"}`). Bisher fing das nur die
   Idle-Nudge ab (ein verlorener Turn). Jetzt: Call aus dem Text parsen,
   ausführen, Ergebnis in die History — der Turn trägt.
2. **Expand-Fokus** — im v6-Lauf scheiterten große Expand-Batches an der
   Grammatik. In der Expand-Phase wird das Modell auf den ERSTEN Fund und einen
   kleinen Batch verengt; die frische Runde (der gemessene Konvergenz-Motor)
   holt die übrigen Funde deterministisch nach.
3. **Runden-Budget als Motor** — Validierung mit 24 Runden statt 12
   (Default 40 bleibt; v6 zeigte: Konvergenz kommt aus Runden, nicht aus
   In-Step-Repair).

## Scope (max 6 Dateien)

1. `docs/cr/open/CR-GC-280-executor-konvergenz-hebel.md` (dieses Dokument)
2. `src/executor.ts` — `extractToolCallFromText()` + Routing (Mutate-`[ARGS]`
   durch die Gate-Outcome-Logik, andere Tools ausführen + Ergebnis zurück);
   Expand-Fokus-Suffix in der Step-Instruktion
3. `tests/executor.test.ts` — `[ARGS]`-Parse-Unit, `[ARGS]`-Turn trägt
   (Ergebnis in History, Step läuft weiter), Expand-Phase erhält Fokus-Suffix

## Akzeptanzkriterien

- [ ] `tool[ARGS]{…}`-Text führt den Call aus statt nur zu nudgen; Mutate-Fälle
      laufen durch dieselbe Applied/Rejected-Logik wie echte Tool-Calls
- [ ] Expand-Steps instruieren „nur der erste Fund, kleiner Batch"
- [ ] `npm run build` + `npm test` grün
- [ ] **Validierungslauf v7** (devstral, 24 Runden): mehr durable Elemente als
      v6 (14) und mindestens ein MOD/REQ/TEST-Element; Ergebnis (auch negativ)
      im Nachtrag von `docs/executor-harness-analysis.md`
