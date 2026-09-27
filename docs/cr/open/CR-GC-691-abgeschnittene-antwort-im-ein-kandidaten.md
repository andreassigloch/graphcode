# CR-GC-691: Abgeschnittene Antwort im Ein-Kandidaten-Pfad verwerfen, executor.ts erkennt 'length' nicht (Rest CR-GC-688)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-605 (bug)
**Erstellt:** 2026-09-27
**Item:** bok/items/ITEM-2026-605.json (Lane: code)

---

Rest aus CR-GC-688 (Teil-Fix im Mehr-Kandidaten-Pfad, 2d2386a). Der beobachtete Fall (seed:actor, 8 ACTORs) lief im Ein-Kandidaten-Pfad: src/loop/executor.ts vor 'if (resp.toolCalls.length === 0)' dieselbe Pruefung istAbgeschnitten(resp.stopReason) (model-answer-contract.ts); executor.ts:390 prueft nur 'max_tokens' und uebersieht 'length' (openai-kompatibel, ollama, sigllm) - auf istAbgeschnitten umstellen. ABGESCHNITTEN_NUDGE von executor-bestofn.ts nach executor-prompt.ts. Test tests/executor.truncation.test.ts um candidates:1 erweitern. Wartet auf CR-GC-682 (Executor-Dateien). Ungeprueft: ob sigllm Abschneiden als 'length' meldet.

---

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
