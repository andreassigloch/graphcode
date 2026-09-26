# CR-GC-662: Executor anthropic-Zweig: dieselbe 300-s-fetch-Grenze wie CR-GC-656, ungestreamt

**Status:** ✅ Done (2026-09-26)
**Typ:** aus Item ITEM-2026-558 (bug)
**Erstellt:** 2026-09-24
**Item:** bok/items/ITEM-2026-558.json (Lane: code)

---

## Befund

Aus CR-GC-656: Nodes eingebautes fetch bricht nach 300 s ohne Antwortkopf ab (nachgewiesen,
`UND_ERR_HEADERS_TIMEOUT` nach 301,4 s). Der anthropic-Zweig fragte `/v1/messages` ungestreamt an;
der Frontier-Arm laeuft mit 32.000 Ausgabe-Token und denkendem Opus — eine Antwort ueber 5 Minuten
ist erreichbar und scheitert dann unabhaengig von `callTimeoutMs`. Bisher nicht beobachtet.

## Umsetzung

- `src/loop/anthropic-stream.ts` (neu): liest die SSE-Ereignisse (`message_start`,
  `content_block_start/_delta/_stop` mit `text_delta`, `input_json_delta`, `thinking_delta`,
  `signature_delta`, `message_delta`, `error`) und setzt die Nicht-Streaming-Form zusammen. Denk-
  Bloecke behalten ihre Signatur — die Schleife schickt sie unveraendert zurueck (CR-GC-572). Am
  Budget abgeschnittenes Werkzeug-JSON wird wie ungestreamt zu `input: {}` mit
  `stop_reason: max_tokens` — der Grund bleibt in der Spur sichtbar, statt zu einem namenlosen
  Fehler zu werden. JSON-Antworten (Fehler vor dem Strom) werden am Stueck gelesen.
- `executor-backend.ts`: `stream: true` im anthropic-Zweig.

Bewusst ohne das offizielle SDK: der Executor spricht die API seit CR-GC-278 per fetch an; ein SDK
waere eine neue Familien-Abhaengigkeit und gehoert nicht in diesen CR.

Kein Live-Aufruf: der kostet API-Guthaben und braucht die Freigabe des Auftraggebers.

## Dateien (4)

`src/loop/anthropic-stream.ts` (neu), `src/loop/executor-backend.ts`,
`tests/anthropic-stream.test.ts` (neu), diese Datei.

## Akzeptanzkriterien

- [x] Denken mit Signatur, Text, zerschnittenes Werkzeug-JSON, Zaehlung aus zwei Ereignissen.
- [x] Abgeschnittenes Werkzeug-JSON → `input: {}` + `max_tokens`; error-Ereignis → Fehler; JSON-Antwort.
- [x] Der Zweig sendet `stream: true`, Echo behaelt die Signatur — rot auf dem alten Zweig.
- [x] Bestehende Roundtrip-Tests aller drei Backends gruen.
- [—] Live gegen die API (gcrun-frontier) — **entfallen, benannte Ausnahme:** der Arm ist aus der Betrachtung genommen (graphcode-Leitlinie §9.4, Entscheid des Autors 2026-09-25).
