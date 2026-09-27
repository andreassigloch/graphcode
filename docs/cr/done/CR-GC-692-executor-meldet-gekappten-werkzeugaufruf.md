# CR-GC-692: Executor meldet gekappten Werkzeugaufruf als INPUT-SCHEMA statt als Budget-Ueberlauf — Modell wiederholt denselben zu grossen Batch (runde7: 38/38 Ablehnungen, 6 Turns je Schritt verbrannt)

**Status:** ✅ Done (2026-09-27) — behoben durch CR-GC-691, hier mit Reproduktion belegt
**Typ:** aus Item ITEM-2026-427 (finding)
**Erstellt:** 2026-09-27
**Item:** bok/items/ITEM-2026-427.json (Lane: code)

---

## Befund

Ein am Token-Budget gekappter Werkzeugaufruf kommt aus beiden Backends als `input: {}` an —
openai-kompatibel ueber `safeParse` der abgeschnittenen `arguments` (`executor-backend.ts`),
anthropic ueber den Stream-Zusammenbau (`anthropic-stream.ts`, CR-GC-572) — mit Stop-Grund
`length` bzw. `max_tokens`. Der Ein-Kandidaten-Pfad in `executor.ts` las den Stop-Grund nur fuer
die Spur und gab `{}` an `gate.runMutate`. Dort lieferte `graph_mutate` (`src/surface/write.ts`) das
Block-Verdict `INPUT-SCHEMA: supply exactly one of commands or formatE`, und `formatGateFeedback`
schickte es als Reparaturauftrag zurueck. Das Modell erfuhr nie, dass sein Batch zu gross war; es
schickte denselben Batch erneut — runde7: 38/38 Ablehnungen, jeder Schritt verbrannte alle 6 Turns.

**Wurzel:** der Stop-Grund wurde nicht als Entscheidung gelesen — derselbe Fehler wie CR-GC-688
(Salvage-Teil-Batch), nur mit leerer statt halber Eingabe. Er ist mit CR-GC-691 behoben: vor jedem
Werkzeug- oder Salvage-Pfad greift `istAbgeschnitten(resp.stopReason)`, nichts geht ans Gate, das
Modell bekommt `ABGESCHNITTEN_NUDGE` („… am Token-Budget abgeschnitten … Emittiere den Batch
kleiner"). Best-of-N war seit CR-GC-688 dicht.

## Umfang — 2 Dateien

`tests/executor.truncation.test.ts` (Reproduktion), diese Datei. Keine Codeaenderung — der Fix
liegt in CR-GC-691 (`src/loop/executor.ts`).

## Akzeptanz

- [x] Reproduktion des runde7-Musters: Modell wiederholt den gekappten Aufruf (`input: {}`), bis es
      einen Budget-Hinweis liest. Gegen den Stand vor CR-GC-691 rot: `mutatesRejected` 6 statt 0 fuer
      `candidates: 1` mit `max_tokens` und mit `length` — sechs Turns, sechs INPUT-SCHEMA-Ablehnungen.
- [x] Mit CR-GC-691 gruen: 0 Ablehnungen, kein `INPUT-SCHEMA` in Verlauf oder Spur, der zweite Turn
      traegt den Budget-Hinweis, die kleinere Folgeantwort wird angewandt. Best-of-N ebenso.
- [x] `tests/executor.truncation.test.ts` 10/10 gruen

## Ergebnis

Kein eigener Fix noetig — die Wurzel ist die in CR-GC-691 geschlossene. Nicht abgedeckt: ein
Werkzeugaufruf mit kaputtem JSON **ohne** Budget-Stop (z. B. ein Template-Fehler) faellt weiter auf
`{}` → INPUT-SCHEMA; das ist ein anderer Befund (die Meldung sagt dann „weder commands noch formatE",
nicht „JSON unlesbar") und hat keine Messung hinter sich.
