# CR-GC-688: seed:actor lieferte 8 Actors aus abgeschnittener Antwort

**Status:** ✅ Done (2026-09-26) — Teil-Fix, Ein-Kandidaten-Pfad offen (wartet auf CR-GC-682)
**Typ:** aus Item ITEM-2026-387 (bug)
**Erstellt:** 2026-09-26
**Item:** bok/items/ITEM-2026-387.json (Lane: code)

---

## Befund

Eine am `maxTokens`-Budget abgeschnittene Modellantwort wird verarbeitet, als waere sie vollstaendig.
Der Stop-Grund liegt vor (`ModelAnswer.stopReason`, CR-GC-426), wird aber nur in die Spur
geschrieben, nie als Entscheidung gelesen:

- `src/loop/executor.ts:390-397` (Ein-Kandidaten-Pfad, der Pfad von `seed:actor` im Rig) und
  `src/loop/executor-bestofn.ts:100-106` (Best-of-N) loggen `stop=…` und geben die Antwort danach
  unbesehen an `extractMutateFromText` bzw. als Werkzeugaufruf ans Gate.
- `src/loop/executor-parse.ts:70-74` (`salvageCommands`) birgt aus einem abgeschnittenen
  `"commands": [ …` jedes vollstaendige Objekt — gebaut fuer devstrals Mega-Batches. Mit dem
  Stop-Grund `length` ist das kein Batch, sondern sein Anfang: 8 ACTORs kamen an, der Rest fehlte
  still, und `generationStep` (`src/loop/generate.ts:558`, „kein ACTOR ⇒ seed:actor") sah die Stufe
  als erledigt.
- Nebenbefund: `executor.ts:390` prueft nur `'max_tokens'` (anthropic). openai-kompatible Backends
  (openai, sigllm, ollama) melden denselben Fall als `'length'`.

## Zielbild

Abgeschnitten ist kein Batch. Eine Antwort mit Stop-Grund `max_tokens`/`length` wird nicht
angewandt — weder geborgener Text noch Werkzeugaufruf —, das Modell erfaehrt den Grund und liefert
kleiner neu. Eine Stelle kennt die Stop-Vokabeln aller Backends: `istAbgeschnitten(stopReason)`.

## Umfang — 5 Dateien

| Datei | Aenderung |
|---|---|
| `src/loop/model-answer-contract.ts` | `istAbgeschnitten(stopReason)`: `max_tokens` + `length`; `null` = nicht abgeschnitten |
| `src/loop/executor-bestofn.ts` | `collectCandidateBatch`: abgeschnittene Antwort → nichts uebernommen, Spurzeile `abgeschnitten (stop=…)`, `ABGESCHNITTEN_NUDGE` ans Modell, naechster Turn |
| `tests/executor.truncation.test.ts` (neu) | Praedikat; Best-of-N mit abgeschnittenem Text (Salvage) und abgeschnittenem Werkzeugaufruf, echter Gate-/Kuzu-Pfad |
| `docs/cr/…/CR-GC-688-….md` | dieser Text |
| `src/loop/executor.ts` | **offen, wartet auf CR-GC-682** — siehe unten |

## Akzeptanz

- [x] `istAbgeschnitten` erkennt `max_tokens` und `length`, nicht `end_turn`/`stop`/`tool_use`/`tool_calls`/`null`
- [x] Best-of-N: abgeschnittener Text mit 2 vollstaendigen + 1 halbem ACTOR → kein ACTOR im Store, Spur nennt den Grund, Modell bekommt den Hinweis, die vollstaendige Folgeantwort wird angewandt
- [x] Best-of-N: abgeschnittener `graph_mutate`-Aufruf (`max_tokens`) → nicht angewandt
- [x] Test vorher rot (3/3: Praedikat fehlt, `ACTOR-a` im Store), nachher gruen
- [x] `npm run build` gruen; Tests, die `executor`/`executor-bestofn`/`model-answer-contract` importieren, gruen
- [ ] **offen, wartet auf CR-GC-682:** Ein-Kandidaten-Pfad in `executor.ts`

## Offen, wartet auf CR-GC-682

`src/loop/executor.ts` wird parallel von CR-GC-682 umgebaut und ist hier nicht angefasst. Der
beobachtete Fall (`seed:actor`, candidates=1) laeuft genau dort — **er ist mit diesem CR noch nicht
behoben.** Noetige Aenderung nach CR-GC-682:

1. In der Turn-Schleife direkt nach der Spurzeile (heute Z. 386-395), vor
   `if (resp.toolCalls.length === 0)`: `if (istAbgeschnitten(resp.stopReason))` → Spur
   `abgeschnitten (stop=…) — nichts uebernommen`, Antwort als Text in die History,
   `ABGESCHNITTEN_NUDGE` als User-Nachricht, `continue` — identisch zum Best-of-N-Pfad.
2. Z. 390: `resp.stopReason === 'max_tokens'` durch `istAbgeschnitten(resp.stopReason)` ersetzen.
3. `ABGESCHNITTEN_NUDGE` dann nach `executor-prompt.ts` zu `IDLE_NUDGE` verschieben (beide Pfade
   importieren ihn von dort; `executor-prompt.ts` ist ebenfalls von CR-GC-682 belegt).
4. Test: `tests/executor.truncation.test.ts` um denselben Fall mit `candidates: 1` erweitern.

## Ergebnis

Best-of-N-Pfad behoben: ein am Budget abgeschnittener Kandidat wird nicht mehr als Teil-Batch
geprobt oder angewandt; das Modell erfaehrt den Grund. Das Praedikat ist die eine Stelle fuer
beide Stop-Vokabeln. Der Ein-Kandidaten-Pfad — der, auf dem das Symptom gemessen wurde — bleibt
bis nach CR-GC-682 offen (Folge-CR noetig). Annahme: sigllm meldet den Abbruch als `length`
(openai-Konvention); im sigllm-Vertrag nicht nachgeprueft.
