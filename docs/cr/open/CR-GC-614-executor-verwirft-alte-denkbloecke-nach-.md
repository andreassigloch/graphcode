# CR-GC-614: Executor verwirft alte Denkbloecke nach jedem Zug — der Graph ist das Gedaechtnis, nicht der Gespraechsverlauf (gemessen: ~58% des Kontexts in Lauf 15)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-474 (idea)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-474.json (Lane: code)

---

## Befund (Spec-Lauf opus5-15, 2026-09-22)

Höchster Kontext im Lauf: 378k Tokens. Die Aufteilung, aus Zeichen geschätzt:

| Anteil | Tokens | Anteil |
|---|---:|---:|
| Denkblöcke des Modells (bleiben in Claude Code im Kontext) | ~220k | ~58 % |
| graphcode-Antworten | ~55k | ~15 % |
| Mutationen des Agenten (`formatE`) | ~45k | ~12 % |
| Claude-Code-Grundlast (Systemprompt, Werkzeuge) | ~35k | ~9 % |
| Write, Read, Text | ~20k | ~5 % |

Damit ist das eigene Denken der größte Posten im Kontext — größer als alles, was graphcode liefert. In Claude Code ist
das nicht zu ändern. Im eigenen Executor schon: Das Ergebnis eines Zuges steht im Graphen, nicht im Gesprächsverlauf.

## Zielbild

Der Executor verwirft die Denkblöcke abgeschlossener Züge und führt als Gedächtnis den Graphen plus einen kurzen
Zugvermerk (was wurde versucht, was sagte das Gate). Für ein lokales Modell ist das Pflicht, nicht Optimierung: 378k
Kontext kann kein lokales Modell, ~100k nur knapp.

## Akzeptanzkriterien

- [ ] Der Executor trägt nach einem angewandten Zug keine Denkblöcke früherer Züge mehr in die nächste Anfrage.
- [ ] Was stattdessen mitreist, ist benannt und begrenzt (Zugvermerk je Zug, Obergrenze in Zeichen).
- [ ] An einem Lauf gemessen: höchster Kontext mindestens halbiert, Ergebnis (Abnahme, Steuerwert) nicht schlechter.
- [ ] Testsuite grün.

## Zusammenhang

Voraussetzung dafür, dass der Executor mit einem lokalen Modell überhaupt fahren kann. Der Kontextanteil von graphcode
selbst wird in CR-GC-612 und CR-GC-613 gesenkt.

