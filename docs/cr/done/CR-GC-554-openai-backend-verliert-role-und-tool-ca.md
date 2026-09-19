# CR-GC-554: das openai-Backend verliert `role` — jeder zweite Turn scheitert

**Status:** 🟢 Done (2026-09-19)
**Typ:** aus Item ITEM-2026-363 (bug)
**Erstellt:** 2026-09-19
**Item:** bok/items/ITEM-2026-363.json (Lane: code)
**Gefunden von:** dem ersten Versuch, `graphcode run` gegen ein lokales Modell zu fahren
(ITEM-2026-361 — das Rig misst bisher `claude -p`, nicht den Executor-Loop).

---

## 1. Root Cause

`OpenAiWireAnswer.choices[].message` deklariert genau zwei Felder, `content` und `tool_calls`.
Zod entfernt beim Parsen alles, was nicht deklariert ist — also **`role`** und
**`tool_calls[].type`**. Der openai-Zweig reicht dieses beschnittene Objekt unverändert als
`assistantMsg` weiter (`executor-backend.ts`, `assistantMsg: msg`), die Schleife hängt es an
die Historie, und in der nächsten Runde geht eine Nachricht **ohne Rolle** ans Modell.

Am Proxy mitgeschrieben, die Nachrichtenfolge der scheiternden Anfrage:

```
0  role=system     keys=role+content
1  role=user       keys=role+content
2  role=undefined  keys=content+tool_calls        <= hier
3  role=tool       keys=role+tool_call_id+content
```

Der sigllm-Zweig (CR-GC-552) und der anthropic-Zweig **bauen** ihre Assistenten-Nachricht
selbst und tragen `role` und `type` korrekt. Nur der openai-Zweig verlässt sich auf
Durchreichen — und das Schema war nie als Echo-Puffer gedacht, sondern als Leser.

## 2. Impact

**Der Executor-Loop kann über das openai-Backend keinen einzigen Werkzeug-Umlauf
abschließen.** Turn `.1` gelingt immer (noch keine Assistenten-Nachricht in der Historie),
Turn `.2` scheitert immer. Gemessen über drei Runden: 6 Modell-Turns, 3 Werkzeugrunden,
**0 Mutationen**.

```
[generate 1] phase=expand   1.1: read_file,graph_elements,graph_get_node
                            1.2: call failed (backend: 500) — skip
```

Serverseitig: `Jinja Exception: Unexpected message role.` Ein Template, das Rollen prüft,
bricht; ein nachlässiges Template würde die Nachricht still falsch rendern — das ist der
schlimmere Fall, weil er wie Modellschwäche aussieht.

**Was es nicht bricht:** `graphcode mcp` und damit alle Läufe über Claude Code — dort spricht
der Agent direkt MCP, das Backend ist nicht beteiligt. Die beiden Rig-Läufe von heute sind
davon unberührt. anthropic und sigllm sind heil.

## 3. Fix

Der openai-Zweig **baut** seine Assistenten-Nachricht, wie die beiden anderen Zweige es tun.
Kein Durchreichen aus dem Wire-Schema: drei Zweige, eine Bauform. Das Schema bleibt Leser und
wird nicht zum Echo-Puffer erweitert — sonst ist die Frage „welche Felder überleben das
Parsen" für jeden künftigen Anbieter wieder offen.

### Dateien (3)

| # | Datei |
|---|---|
| 1 | `src/loop/executor-backend.ts` — `assistantMsg` im openai-Zweig konstruieren |
| 2 | `tests/executor.openai-roundtrip.test.ts` — neu, die Abnahme |
| 3 | `docs/cr/open/…` → `done/` |

## 4. Nachweis

- [x] **Rot zuerst:** 3 von 3 neuen Prüfungen rot vor dem Patch, danach grün.
- [x] `role: 'assistant'` und `type: 'function'` stehen in der zurückgegebenen Nachricht.
- [x] Gegen das echte lokale Modell (qwen3.8-27b über ollama): **kein einziges
      `call failed` mehr**, 9 Modell-Turns über 3 Runden statt Abbruch nach jedem ersten.
      Vorher scheiterte Turn `.2` ausnahmslos.
- [x] `npm test` in graphcode grün: 145 Dateien, 1178 Prüfungen.

**Was dieser Zug NICHT zeigt:** `mutatesApplied > 0`. Das lokale Modell kommt aus einem
anderen Grund nicht zur Mutation — es erzeugt 4900 Token Reasoning je Turn bei 16,5 t/s und
läuft entweder in `stop=length` (max_tokens 2048) oder in ollamas Fünf-Minuten-Abbruch
(max_tokens 8192). Das ist eine Modell-/Betriebsfrage, kein Backend-Defekt, und liegt als
ITEM-2026-364. Der Umlauf selbst ist hier bewiesen.
