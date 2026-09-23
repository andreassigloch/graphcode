# CR-GC-622: graph_authoring_guide wird trotz "einmal genuegt" 10x gerufen — derselbe Leitfaden braucht Idempotenz im Werkzeug, nicht einen Satz in der Beschreibung

**Status:** ✅ Done (2026-09-23)
**Typ:** aus Item ITEM-2026-481 (finding)
**Erstellt:** 2026-09-23
**Item:** bok/items/ITEM-2026-481.json (Lane: code)

---

## Befund

CR-GC-612 hat den Befund benannt („11 Aufrufe × ~2,2k, derselbe Leitfaden mehrfach") und die
Beschreibung gekürzt. Sie sagt seither wörtlich: *„Take it ONCE … a second call in the same session
buys nothing."* Im Spezifikationslauf `opus5-0` am 2026-09-22: **10 Aufrufe / 22.769 Zeichen.**

**Ein Satz in der Beschreibung ersetzt keine Idempotenz im Werkzeug.** Die Antwort ist je Typ
konstant — sie hängt an `SE_DESCRIPTOR` und `TRACE_PATTERNS`, nicht am Graphen. Eine Antwort, die
sich nie ändert, ein zweites Mal in voller Länge auszuliefern, ist eine Entscheidung des Werkzeugs,
keine des Agenten.

## Zielbild

Die Wiederholung antwortet **kürzer, nicht anders**: der zweite Aufruf für denselben Typ in
derselben Sitzung liefert die Kanten-Grammatik (`outgoing`/`incoming` ohne Kanten-Beschreibungen)
und `requiredAttrs` weiter — weggelassen werden die Attribut-Hinweise und das Format-E-Beispiel,
zusammen mit dem Vermerk, in welchem Aufruf sie standen.

Nachgemessen über alle 12 Elementtypen: **1.823 → 402 Zeichen im Mittel (−78 %)**.

| Typ | voll | wiederholt |
|---|---:|---:|
| FUNC | 3.169 | 630 |
| REQ | 3.051 | 718 |
| MOD | 2.671 | 508 |
| SCHEMA | 2.181 | 320 |
| TEST | 1.814 | 257 |

**Warum genau dieser Schnitt und kein leerer Stub:** der Executor bettet die Kanten-Grammatik
jede Runde neu in den Rundenprompt ein (`buildRoundChannels`, CR-GC-612) und liest dafür
`outgoing`, `incoming` und `requiredAttrs` — und nur die. Ein Stub hätte ab Runde 2 genau den
Block geleert, dessen Vorhandensein der Prompt zusichert („bereits eingebettet — dafür NICHT
erneut aufrufen"). Der gekürzte Aufruf trägt den Block vollständig.

Die Sitzung ist die Bindung der Registry: `bindReportTools` wird einmal je Host gebunden, das
Gedächtnis ist eine Closure darin. Kein Feld im `ToolPort`-Vertrag, kein Prozess-Global.

## Akzeptanzkriterien

- [x] Zweiter Aufruf desselben Typs: unter 800 Zeichen, mit `outgoing`/`incoming`/`requiredAttrs`
      vollständig und dem Vermerk, wann der volle Leitfaden kam
- [x] Erster Aufruf jedes Typs unverändert vollständig — auch nach neun anderen Typen
- [x] Der Rundenprompt des Executors trägt die Kanten-Grammatik auch in Runde 2 und 3 (Test gegen
      `buildRoundChannels`, nicht gegen den Handler allein)
- [x] Unbekannter Typ wirft weiter mit der Typenliste, auch beim zweiten Mal
- [ ] Testsuite grün

## Umfang

`src/projections/report.ts`, `tests/mcp.authoring-guide.test.ts`, `tests/executor.test.ts` — 3 Dateien.
