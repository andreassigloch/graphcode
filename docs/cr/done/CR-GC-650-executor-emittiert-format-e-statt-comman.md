# CR-GC-650: Executor emittiert Format-E statt commands (Faktor 2,4-3,3 Ausgabe) — Rig-Messung zuerst

**Status:** ✅ Done (2026-09-24)
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
- [x] **Rig-Abnahme** zusammen mit CR-GC-651 — siehe unten.

## Bekannt offen bis CR-GC-651

Die injizierten Skill-Rumpfe `author-req`/`author-uc` zeigen noch `commands`-JSON als Beispiel —
ein Widerspruch zum SYSTEM, den CR-GC-651 mit den inject-Markern schliesst. Beide gehen zusammen
in den Nachher-Lauf.

## Rig-Abnahme (2026-09-24, gcrun, Korpus sigllm-gcrun, qwen3-coder-30b via Ollama, N=3 je Arm, 12 Runden)

Vorher = Stand `b037983` (vor CR-GC-649), nachher = `3fe69fd` (CR-GC-650 + 651 zusammen), jeweils
eigener Worktree. `results-runde19-gcrun-vor.json` / `-nach.json`; Aufrufzahlen aus `run-raw.log`.

| Mittel je Lauf | vorher | nachher | Δ |
|---|---:|---:|---:|
| Elemente | 49,3 | 50,7 (57/61/34) | ≈, Streuung groß |
| Gate-Ablehnungen | 5,7 | 3,0 | −47 % |
| Turns | 53,7 | 42,3 | −21 % |
| Tokens ein / aus | 445k / 27,0k | 210k / 9,1k | −53 % / −67 % |
| Laufzeit | 596 s | 186 s | −69 % |
| Lese-Aufrufe des Modells | 291 | 106 | −64 % |
| davon graph_elements / Guide / get_node | 227 / 35 / 29 | 59 / 3 / 44 | get_node +52 % |

**Kipp-Kriterium (CR-GC-612) gehalten:** die Summe der Lese-Aufrufe faellt; nur `graph_get_node`
steigt — nach dem Wegfall der Parameterbeschreibungen fragt das Modell einzelne Knoten oefter nach.
Die beiden CRs sind im Rig nicht getrennt gemessen; die Aussage gilt fuer beide zusammen. Fuer
die Elementzahl ist N=3 zu klein (34 bis 61).
