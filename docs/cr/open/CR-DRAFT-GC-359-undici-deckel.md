# CR-GC-359 — `callTimeoutMs` wirklich wirksam machen (undici-Deckel)

**Status:** draft — zurückgestuft 2026-08-21: nicht gebaut, im Quelltext ist keine undici-Konfiguration (`dispatcher`/`headersTimeout`/`bodyTimeout`) vorhanden.
**Datum:** 2026-08-18
**Vorgänger:** CR-GC-358 (Nachtrag Punkt b) · **Nachfolger:** CR-GC-360 (Probe)

## Problem

`GRAPHCODE_LLM_TIMEOUT_MS` ist unterhalb von 300 s **wirkungslos**. Node implementiert
`fetch()` intern über undici, und undici bringt eigene, vom `AbortSignal` unabhängige
Timeouts mit: `headersTimeout` (Default 300 s) und `bodyTimeout`. Der Executor übergibt
keinen Dispatcher, also gilt der Default.

Verschärfend: wir rufen **nicht streamend**. Ein nicht-streamender Server schickt die
Header erst, wenn die Antwort fertig ist — die komplette Generierung muss also in 300 s
durch sein, sonst reißt undici die Verbindung, bevor ein Byte ankommt.

Gemessen im qwen3.8-Lauf v2 (2026-08-16): Runde 2 verlor alle drei Kandidaten an diese
Decke. Die Fehlermeldung ist das nackte `fetch failed` — die eigentliche Ursache
(`UND_ERR_HEADERS_TIMEOUT`) steckt in `error.cause` und wird **nicht geloggt**; wir haben
sie erst über den LM-Studio-Server-Log gefunden.

Der Befund ist nicht neu: `docs/executor-harness-analysis.md` Punkt 6 hält seit 2026 fest,
dass 20 Tool-Schemas die Box „über 300s Time-to-first-byte (undici headersTimeout)"
trieben. Er wurde damals als Tool-Diät umgangen, nie als Transport-Defekt behoben.

## Warum das kein kosmetischer Fix ist

Ein Config-Wert, den eine tiefere Schicht still überstimmt, ist eine **Lüge im
Schema**. `callTimeoutMs` verspricht eine Obergrenze, die es nicht kontrolliert — und der
Betrieb sieht statt eines Timeouts einen Verbindungsfehler, also das falsche Symptom.

## Änderung

1. **Dispatcher aus `callTimeoutMs` ableiten**: `new Agent({ headersTimeout: callTimeoutMs,
   bodyTimeout: callTimeoutMs })` und als `dispatcher` an beide `fetch`-Aufrufe
   (openai- **und** anthropic-Backend) übergeben. Ein Agent pro `buildCallModel`, nicht
   pro Call.
2. **`error.cause` mitloggen**: der Executor fängt Call-Fehler ab und schreibt heute nur
   `e.message`. `fetch failed` allein ist nicht diagnostizierbar — der `cause.code`
   (`UND_ERR_HEADERS_TIMEOUT`, `ECONNREFUSED`, …) muss in die Trace-Zeile.

## Geprüft und zurückgestellt: Streaming

Streaming wäre der robustere Fix — Header kommen sofort, danach laufend Chunks, keiner der
beiden Timeouts kann feuern (genau deshalb hielt der `claude -p`-Pfad 40 min am Stück
durch). **Zurückgestellt**, weil es die Tool-Call-Zusammensetzung umschreibt: Argumente
kommen als Delta-Fragmente, und daran hängt die Recovery-Kaskade (Tool-Call → Prosa-JSON →
`[ARGS]`-Text → Salvage aus gekapptem JSON), die laut `docs/executor-abschlussbericht.md`
einen Großteil der lokalen Applies trägt. Der Dispatcher löst das beobachtete Problem
vollständig; Streaming wäre Risiko ohne zusätzlichen Nutzen für diesen Befund.

Wieder aufmachen, wenn: Fortschrittsanzeige während langer Calls gebraucht wird, oder ein
Backend auftaucht, das nicht-streamend gar nicht bedient.

## Dateien (2 + 1 Test)

- `src/executor.ts` — Agent in `buildCallModel`, `dispatcher` an beide fetch-Aufrufe
- `src/executor.ts` / Trace-Pfad — `cause.code` in die Fehlerzeile
- `tests/executor.test.ts` — s.u.

## Akzeptanzkriterien

- [ ] Ein Call, der länger als 300 s bis zum ersten Byte braucht, läuft mit
      `callTimeoutMs > 300 s` durch **statt** `fetch failed` zu werfen — als echter Test
      gegen einen lokalen HTTP-Server, der die Header verzögert (kein Mock des Timeouts)
- [ ] `callTimeoutMs` bleibt die wirksame Obergrenze: ein Call jenseits davon bricht ab
      und meldet den Abbruch als Timeout, nicht als Verbindungsfehler
- [ ] Fehlerzeile enthält `cause.code`, nicht nur `fetch failed`
- [ ] `npm run build` + Suite grün (Baseline: 765/767, s. CR-GC-358)
