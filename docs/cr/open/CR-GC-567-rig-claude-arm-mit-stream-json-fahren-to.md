# CR-GC-567: Tokenverbrauch je Turn, und welches Werkzeug ihn verursacht

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-395 (idea)
**Erstellt:** 2026-09-21
**Item:** bok/items/ITEM-2026-395.json (Lane: graph)
**Deckt mit ab:** ITEM-2026-398 (cache_creation je Turn gegen Werkzeug)

---

## 1 Befund

Zwei Opus-Läufe derselben Sitzung, gemessen mit `--output-format json`:

| | Sitzung 1 | Rewind |
|---|---:|---:|
| Turns | 56 | 28 |
| Eingabe gesamt | 7,69 M | 7,66 M |
| **cache_read** | 7,32 M | 7,03 M |
| **cache_creation** | 368 k | **624 k** |
| Kosten | $9,27 | $8,32 |

**Der Rewind hat halb so viele Turns und schreibt 70 % mehr Cache.** Das ist die Zahl, an
der die Effizienz hängt: `cache_read` kostet etwa ein Zehntel, `cache_creation` das
Anderthalbfache des normalen Eingabepreises. Von $8,32 entfällt der größte Teil nicht auf
das Wiederlesen, sondern auf das **Neuschreiben** des Caches.

Warum es neu geschrieben wird, sagt die Summe nicht. Der Verdacht: jede große
Werkzeugantwort am Ende des Kontexts entwertet den Cache-Suffix, und der nächste Turn
baut ihn neu auf. Welche Antwort wie teuer ist — Dry-Run-Verdict, Readiness-Array,
Guide-Slice, Element-Index — ist mit einer Gesamtsumme nicht zu trennen.

`--output-format json` liefert genau eine Usage-Zeile für den ganzen Lauf. `stream-json`
liefert sie je Assistant-Nachricht.

## 2 Zielbild

Der claude-Arm läuft mit `--output-format stream-json --verbose`. Das Rig schreibt den
Strom nach `claude-stream.jsonl` und wertet ihn aus:

- **je Turn:** `input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`,
  `output_tokens` — plus die in diesem Turn gerufenen Werkzeuge.
- **Aggregat:** `cache_creation` gruppiert nach dem Werkzeug, dessen Ergebnis dem Turn
  vorausging. Das benennt den teuersten Kontextfüller statt ihn zu vermuten.
- **Dry-Run-Wirksamkeit:** wie oft folgte auf ein `dryRun:true` ein `dryRun`-freier
  `graph_mutate` mit demselben Batch — und trug der angewandte Batch das bessere
  `fitAdvisory.delta` als die verworfenen? Das misst, ob die Metrik die Auswahl wirklich
  steuert, statt nur mitzulaufen.

Die Endsumme bleibt kompatibel: `stream-json` schließt mit demselben `result`-Objekt, aus
dem die heutige Auswertung liest.

## 3 Umfang

- `rig/greenfield-systemtest/run.mjs` — `stream-json`, Strom sichern, Usage je Turn sammeln
- `rig/greenfield-systemtest/report.mjs` — die drei Auswertungen oben
- `rig/greenfield-systemtest/turn-analyse.mjs` — neu, die Strom-Auswertung

Drei Dateien.

## 4 Abnahme

1. `claude-stream.jsonl` existiert nach einem Lauf und trägt eine Usage-Zeile je Turn.
2. Die Gesamtsumme aus dem Strom stimmt mit der `result`-Zeile überein — sonst misst die
   neue Auswertung etwas anderes als die alte.
3. Der Bericht nennt das Werkzeug mit dem höchsten `cache_creation`-Anteil.
4. Der Bericht nennt die Dry-Run-Trefferquote.
5. Der gcrun-Arm bleibt unberührt — er spricht kein Claude-Code-Protokoll.

## 4a Erster Befund — noch vor dem naechsten Lauf

Die Dry-Run-Auswertung laeuft schon gegen die vorhandenen Audits, weil sie nur `audit.jsonl`
braucht:

| | Previews | Anwendungen | geprobt-und-verworfen | Quote |
|---|---:|---:|---:|---:|
| Opus (`claude -p`) | 14 | 16 | 6 | **0,43** |
| qwen (Executor) ×3 | **0** | 15–18 | 0 | 0 |

**Opus probt und verwirft 43 % seiner Previews — die Metrik traegt dort die Auswahl.**
Der Executor-Arm probt in drei Laeufen **kein einziges Mal**; die Loop-Zaehler bestaetigen
es mit `dryRunProbes: 0`.

Der Grund ist das vierte Vorkommen desselben Musters: Best-of-N ist aus, also steht
`selection: 'host'` und der Rundenprompt traegt das volle Gate-Protokoll
(*„Alternativen zuerst als graph_mutate mit dryRun:true einreichen und die Verdicts
vergleichen"*). Der SYSTEM-Prompt des Executors sagt zwei Absaetze hoeher
*„emittiere den geforderten Batch … dann STOPP"* und *„Handeln vor Analysieren"*.

Zwei Imperative, der Zweite verbietet, was der Erste verlangt. Das kleine Modell folgt dem
strengeren. **Damit hat der Executor-Arm den einzigen Steuerungskanal, der nachweislich
funktioniert, in keinem Lauf benutzt** — und alle Steuerungsmessungen dieser Sitzung liefen
ohne ihn. → ITEM-2026-399

## 5 Was bewusst offen bleibt

Ob sich aus dem Befund ein Zug ableiten lässt, ist offen. Denkbar wäre, große
Werkzeugantworten zu kürzen oder stabil zu halten, damit der Cache-Präfix länger trägt —
aber welche, entscheidet die Messung, nicht dieses CR.

## 4b Der Bericht nennt es jetzt (Kriterien 3/4)

`report.mjs` importiert die Auswertung und haengt eine Tabelle an: je Lauf Turns,
Cache-Schreibung, teuerster Verursacher, Previews, verworfen, Quote. Damit sind 3 und 4
nicht mehr ein Skript, das man von Hand aufruft, sondern Teil des Berichts.

Gegen die vorhandenen Laeufe (ohne Strom, deshalb nur die Audit-Haelfte):

| Lauf | Previews | verworfen | Quote |
|---|---:|---:|---:|
| opus5 #4 | 14 | 6 | **0,43** |
| opus5 #0 | 3 | 1 | 0,33 |
| opus5 #1 | 1 | 0 | 0 |
| opus5 #2/#3 | 0 | 0 | 0 |
| gcrun #0/#1/#2 | 0 | 0 | 0 |

Die Cache-Spalten bleiben leer, bis ein Lauf mit `stream-json` vorliegt — Kriterium 1 und 2
sind erst danach abnehmbar.
