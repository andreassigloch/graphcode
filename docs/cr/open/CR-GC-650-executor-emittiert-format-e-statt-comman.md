# CR-GC-650: Executor emittiert Format-E statt commands (Faktor 2,4-3,3 Ausgabe) — Rig-Messung zuerst

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-542 (idea)
**Erstellt:** 2026-09-24
**Item:** bok/items/ITEM-2026-542.json (Lane: code)

---

## Befund

CR-GC-627 hat gemessen: Format-E kostet 84–94 statt 223–279 Zeichen je geschriebenem Element
(Faktor 2,4–3,3). Der Executor erzwang trotzdem `commands` — im SYSTEM, im Schluss-Satz jeder
Runde und im Nachfassen —, waehrend die Beschreibung von `graph_mutate` seit CR-GC-627 das
Gegenteil sagt („Prefer a formatE block over commands"). Zwei Anweisungen in jedem Aufruf. Lokal
(~15 Token/s) bestimmt die Ausgabelaenge die Wall-Zeit.

Der Haken, warum das kein Einzeiler war: der Preflight reichte Format-E ungeprueft durch
(`preflight.ts`), der R-01-Stub, der R-18-Flip und der Duplikat-Hinweis waeren fuer genau die
Form weggefallen, die das Modell kuenftig schreibt. Voraussetzung dafuer war CR-GC-649.

## Umsetzung

- **Prompt:** SYSTEM zeigt die Format-E-Form einmal, mit einem legalen Beispiel (REQ + TEST,
  `UC compose REQ`, `TEST verify REQ`) — das alte Beispiel trug `ACTOR io UC`, das R-18 seit
  contracts 9 abweist. Schluss-Satz und Nachfassen verweisen nur noch auf die Form.
- **Gate-Zugang:** ein Format-E-Batch wird mit derselben Abbildung wie `graph_mutate` uebersetzt
  (`formatEToCommands`), der Preflight prueft die Kommandos. Ohne Korrektur geht der
  **Originaltext** ans Gate (Namenswarnung, CR-GC-321, bleibt erhalten); mit Korrektur gehen die
  korrigierten Kommandos. Ein Parse-Fehler ist kein Preflight-Urteil — der Text geht unveraendert
  ans Gate, dessen Meldung auditiert ist.
- **Text-Bergung:** ein Format-E-Block wird aus Modelltext geborgen (roh, im Code-Zaun, als
  JSON-Feld). Die `commands`-Bergung bleibt: das Gate nimmt beide Formen, und ein Modell, das
  trotz Anweisung JSON schreibt, soll nicht an der Bergung scheitern.

## Umfang laut Graph

`CR-GC-650 -relation-> FUNC-gate-client, FUNC-extract-mutate, FUNC-preflight, FUNC-run-executor`;
die Beschreibungen von FUNC-gate-client und FUNC-extract-mutate sind nachgezogen.

## Dateien (7)

`src/loop/executor-prompt.ts`, `src/loop/executor-gate.ts`, `src/loop/executor-parse.ts`,
`src/loop/executor.ts` (Typ), `src/loop/preflight.ts` (Kommentar),
`tests/executor.preflight.test.ts`, `tests/executor.test.ts`.

## Akzeptanzkriterien

- [x] Format-E-REQ ohne TEST bekommt denselben Stub wie ein commands-Batch und wird angewandt —
      **rot auf dem alten Gate-Zugang** (Gegenprobe per `git stash`), gruen auf dem neuen.
- [x] Format-E ohne Befund geht als Text ans Gate, nicht uebersetzt.
- [x] Text-Bergung: roh, Zaun, JSON, Nicht-Batch, commands (5 Faelle).
- [x] Executor-Tests gruen (14 Dateien).
- [ ] **Rig-Abnahme** (gcrun, sigllm-gcrun, N=3) — zusammen mit CR-GC-651 gegen die Vorher-Messung
      `results-runde19-gcrun-vor.json`. Offen bis zum Nachher-Lauf.

## Bekannt offen bis CR-GC-651

Die injizierten Skill-Rumpfe `author-req`/`author-uc` zeigen noch `commands`-JSON als Beispiel —
ein Widerspruch zum SYSTEM, den CR-GC-651 mit den inject-Markern schliesst. Beide gehen zusammen
in den Nachher-Lauf.
