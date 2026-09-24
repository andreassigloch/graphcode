# CR-GC-656: Executor openai-Zweig: fetch bricht nach 300 s ab (undici headersTimeout) — Thinking-Modelle unbenutzbar

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-557 (bug)
**Erstellt:** 2026-09-24
**Item:** bok/items/ITEM-2026-557.json (Lane: code)

---

## Befund

Rig-Probe mit qwen3.8-27b (Thinking) ueber Ollama: Aufruf 2.2 endet mit `fetch failed`.
Nachgewiesen mit einem lokalen Server, der 310 s bis zur Antwort wartet: Nodes eingebautes fetch
(undici) bricht nach **301,4 s** ab, cause `UND_ERR_HEADERS_TIMEOUT` — obwohl
`AbortSignal.timeout(600 s)` gesetzt war. Der openai-Zweig fragte ungestreamt an; der Kopf kommt
dann erst mit der fertigen Antwort. qwen3.8 denkt standardmaessig (~23 tok/s, 5–8k Denk-Token
= 4–6 min) — jeder solche Aufruf scheitert, unabhaengig von `callTimeoutMs`.

Zweitens: Ollama liefert das Denken im Feld `reasoning` und zaehlt es in `completion_tokens` mit,
meldet aber keine `reasoning_tokens` — `tokensReasoning` bleibt 0. Die Ausgabe-Zahl enthaelt das
Denken; eine eigene Zahl wird nicht geschaetzt.

## Umsetzung

- `src/loop/openai-stream.ts` (neu): liest `/v1/chat/completions` gestreamt (SSE) und setzt Text,
  Denken (`reasoning` / `reasoning_content`), stueckweise Werkzeug-Argumente und die Zaehlung zur
  selben Drahtform zusammen, die ungestreamt kaeme. Antwortet der Server am Stueck, wird JSON gelesen
  — beide Formen laesst das Protokoll zu. Ein Fehler-Stueck im Strom wird zum Fehler.
- `executor-backend.ts`: `stream: true`, `stream_options.include_usage`; die Vertragspruefung
  (`OpenAiWireAnswer`) bleibt die eine Stelle danach.
- Live gegen Ollama geprueft (qwen3-coder-30b): Werkzeugaufruf und Zaehlung kommen an, 2,4 s.

## Nicht in diesem CR

Der anthropic-Zweig fragt ebenfalls ungestreamt an und unterliegt derselben 300-s-Grenze. Bei
Opus mit 32.000 Ausgabe-Token ist das erreichbar; bisher nicht beobachtet. Eigenes Item.

## Dateien (4)

`src/loop/openai-stream.ts` (neu), `src/loop/executor-backend.ts`, `tests/openai-stream.test.ts`
(neu), diese Datei.

## Akzeptanzkriterien

- [x] SSE-Zusammensetzung: Text, Denken (beide Feldnamen), zerschnittene Argumente, zwei Aufrufe,
      Zaehlung; Fehler-Stueck; JSON-Antwort; der Zweig sendet `stream:true` + `include_usage`.
- [x] Bestehende Roundtrip-Tests der drei Backends gruen.
- [ ] Rig mit qwen3.8-27b (Thinking): kein `fetch failed` mehr.
