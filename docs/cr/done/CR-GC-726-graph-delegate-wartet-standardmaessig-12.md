# CR-GC-726: graph_delegate wartet standardmaessig 120 s, OpenCode bricht MCP-Aufrufe nach 60 s ab: der Client sieht 'Request timed out', der Executor laeuft unbemerkt weiter (Lauf local-3, 2026-10-02: 5 Batches, 52 Befehle geschrieben, Client begann zu coden). Dazu: die Spur der Delegation steht nur im Speicher, nach einem Abbruch ist nicht feststellbar, woran der Lauf steht

**Status:** ✅ Done (2026-10-02)
**Typ:** aus Item ITEM-2026-705 (bug)
**Erstellt:** 2026-10-02
**Item:** bok/items/ITEM-2026-705.json (Lane: code)

---

## Befund

Lauf `local-3` (2026-10-02, OpenCode 1.18.34, Client qwen3-coder, Executor qwen3.8 medium): der erste
`graph_delegate({auftrag})` endete nach 60 s mit `MCP error -32001: Request timed out`. Der Aufruf wartet
standardmäßig 120 s auf ein Ereignis; der MCP-Client bricht nach 60 s ab. Mit qwen3-coder im Executor
(15 s je Runde) kam das erste Ereignis früher, mit qwen3.8 (85 s je Runde) nicht.

Folgen im Lauf: der Client hielt graphcode für defekt und schrieb Code; der Executor schrieb unbemerkt
5 Batches (52 Befehle, 0 Ablehnungen); woran er danach stand, ist nirgends aufgezeichnet — die Spur lag
nur im Speicher der Delegation. Ein Ereignis, das einem bereits abgebrochenen Aufruf zugestellt wird, ist
verloren.

## Umsetzung

`src/surface/delegate.ts`:

- `wartenSek`: Vorgabe 120 → 45 (`WARTEN_VORGABE_SEK`), Obergrenze 600 → 55 (`WARTEN_MAX_SEK`). Kein Aufruf
  wartet länger als der 60-s-Abbruch des Clients.
- Die Spur jeder Delegation steht zeilenweise mit Zeitpunkt in `.graphcode/delegation.log`: Start (Modell,
  Task), jede Spurzeile des Executors, Frage, Antwort, Ende oder Fehler.
- Ein zweiter Auftrag bei laufender Delegation nennt den Aufruf, der weiterführt: `graph_delegate({})`, bei
  offener Frage zusätzlich `graph_delegate({antwort})`.

## Abnahme

`tests/delegate.test.ts`: Obergrenze unter 60 s, 60 s abgewiesen, Vorgabe unter der Obergrenze; die Spur
trägt Start, Frage, Antwort und Ende mit Zeitpunkt; die Fehlermeldung nennt bei offener Frage `{antwort}`.

## Nicht in diesem CR

Ein Client mit kürzerem Abbruch als 45 s verliert weiterhin das Ereignis eines abgebrochenen Aufrufs; dafür
müsste der Host den Abbruch des Clients sehen (MCP `notifications/cancelled`).

## Umfang laut Graph

`FUNC-graph-delegate`, `SCHEMA-delegate-input`, `REQ-delegate-antwortet-vor-client-abbruch` (neu, verifiziert
von `TEST-delegate-in-host`). Zwei Dateien.
