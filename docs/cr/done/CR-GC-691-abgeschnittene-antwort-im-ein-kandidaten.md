# CR-GC-691: Abgeschnittene Antwort im Ein-Kandidaten-Pfad verwerfen, executor.ts erkennt 'length' nicht (Rest CR-GC-688)

**Status:** ✅ Done (2026-09-27)
**Typ:** aus Item ITEM-2026-605 (bug)
**Erstellt:** 2026-09-27
**Item:** bok/items/ITEM-2026-605.json (Lane: code)

---

Rest aus CR-GC-688 (Teil-Fix im Mehr-Kandidaten-Pfad, 2d2386a). Der beobachtete Fall (seed:actor, 8 ACTORs) lief im Ein-Kandidaten-Pfad: src/loop/executor.ts vor 'if (resp.toolCalls.length === 0)' dieselbe Pruefung istAbgeschnitten(resp.stopReason) (model-answer-contract.ts); executor.ts:390 prueft nur 'max_tokens' und uebersieht 'length' (openai-kompatibel, ollama, sigllm) - auf istAbgeschnitten umstellen. ABGESCHNITTEN_NUDGE von executor-bestofn.ts nach executor-prompt.ts. Test tests/executor.truncation.test.ts um candidates:1 erweitern. Wartet auf CR-GC-682 (Executor-Dateien). Ungeprueft: ob sigllm Abschneiden als 'length' meldet.

---

## Umfang — 5 Dateien

| Datei | Aenderung |
|---|---|
| `src/loop/executor.ts` | vor `if (resp.toolCalls.length === 0)`: `istAbgeschnitten(resp.stopReason)` → Spur `abgeschnitten (stop=…)`, Antwort als Text in die History, `ABGESCHNITTEN_NUDGE`, `continue`; Spurzeile Z. 390 auf `istAbgeschnitten` statt `=== 'max_tokens'` |
| `src/loop/executor-prompt.ts` | `ABGESCHNITTEN_NUDGE` neben `IDLE_NUDGE` — eine Stelle fuer beide Pfade |
| `src/loop/executor-bestofn.ts` | Konstante entfernt, Import aus `executor-prompt.ts` |
| `tests/executor.truncation.test.ts` | beide Faelle je Pfad (`candidates` 2 und 1), Werkzeugaufruf je Stop-Vokabel (`max_tokens`, `length`) |
| diese Datei | |

`graph_tests` war in der Lane nicht verfuegbar; Auswahl = Testdateien, die `executor`,
`executor-prompt` oder `executor-bestofn` importieren (25).

## Akzeptanz

- [x] Rot zuerst: 3 von 7 rot — genau die `candidates: 1`-Faelle (Teil-Batch angewandt, kein Hinweis)
- [x] Ein-Kandidaten-Pfad: abgeschnittener Text (Salvage) und abgeschnittener Werkzeugaufruf
      (`max_tokens` und `length`) → nichts angewandt, Spur nennt den Grund, Folgeantwort angewandt
- [x] `ABGESCHNITTEN_NUDGE` an einer Stelle (`executor-prompt.ts`), beide Pfade importieren sie
- [x] `npm run build` gruen; 25 Testdateien / 373 Tests gruen

## Ergebnis

Der Pfad, auf dem das Symptom gemessen wurde (`seed:actor`, candidates=1), verwirft abgeschnittene
Antworten jetzt wie Best-of-N. Die Annahme „sigllm meldet `length`" entfaellt mit CR-GC-693: sigllm
laeuft dann ueber das openai-Backend, dessen `finish_reason` `length` ist.
