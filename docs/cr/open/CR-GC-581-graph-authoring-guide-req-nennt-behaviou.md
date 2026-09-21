# CR-GC-581: graph_authoring_guide REQ nennt 'behavioural/structural kinds' ohne Werte und Syntax, UC-05/06 verlangen kinds:[postcondition] — opus5 durchsucht dafuer den Quellcode (runde7: 6/12/31 Suchen, bis 59k Zeichen)

**Status:** ✅ Umgesetzt und am Bestaetigungslauf gemessen
**Typ:** aus Item ITEM-2026-429 (finding)
**Erstellt:** 2026-09-21
**Item:** bok/items/ITEM-2026-429.json (Lane: graph)

---

## 1 Befund (Runde 7)

`graph_authoring_guide {type:"REQ"}` nannte an den satisfy-Kanten "behavioural kinds only" /
"structural kinds only" — ohne einen einzigen Wert und ohne Schreibweise. UC-05/06 verlangen aber
einen REQ mit `kinds:["postcondition"]` bzw. `["precondition"]`. Opus suchte die Syntax im
Quellcode: 6 / 12 / 31 Suchen in den drei Laeufen, bis 59.218 Zeichen Antwort — der groesste
einzelne Posten der Cache-Lesung in `opus5-8`.

Tiefer: `ELEMENT_ATTRIBUTES.REQ` in contracts kennt `kinds` gar nicht (nur die FMEA-Felder),
obwohl Regeln und where-Praedikate es lesen. Die Werte stehen als Enum `ReqKind`.

## 2 Umsetzung

- `attributesFor(type)` in `authoring-example.ts`: die Attribute je Typ aus `ELEMENT_ATTRIBUTES`,
  fuer REQ davor `kinds` mit `enumValues = ReqKind.options` und der Syntax `@kinds ["postcondition"]`.
  Werte aus der SSOT, lokal nur die Schreibform.
- `graph_authoring_guide` liefert das Feld `attributes`; das REQ-`formatEExample` traegt die
  `@kinds`-Folgezeile.
- Abnahme `tests/mutate.formate-name.test.ts`: Werte = `ReqKind.options`, die dokumentierte Syntax
  decodiert zu `['postcondition']`, das Beispiel zu `['functional']`, Nicht-REQ bekommt kein kinds.

**Offen, nicht hier:** `kinds` gehoert in `ELEMENT_ATTRIBUTES` der contracts — ein sigloch-modules-Zug.

## 3 Kriterien

| # | Kriterium | Ergebnis |
|---|---|---|
| 1 | Guide nennt Werte und Syntax, gegen den Codec geprueft | erfuellt |
| 2 | Bestaetigungslauf: Quelltextsuchen nach der Syntax gehen deutlich zurueck | erfuellt — 0 statt 6 / 12 / 31 |

## 4 Bestaetigung

Bestaetigungslauf `opus5-9` (2026-09-21, sigllm-Prosa, Claude Code, 1 Lauf): 265 Elemente, Konformitaet 1,0, 10,85 $, 22 min.

Keine einzige Suche im graphcode- oder contracts-Quelltext (Runde 7: 6 / 12 / 31, bis 59.218
Zeichen). Bash-Aufrufe gesamt 5 statt 11 / 21 / 40.

**Kongruenz:** RC-* nicht aus dieser Session geprueft — benannte Ausnahme wie bei CR-GC-570.
