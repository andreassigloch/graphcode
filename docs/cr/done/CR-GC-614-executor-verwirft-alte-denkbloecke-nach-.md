# CR-GC-614: Executor verwirft alte Denkbloecke nach jedem Zug — der Graph ist das Gedaechtnis, nicht der Gespraechsverlauf (gemessen: ~58% des Kontexts in Lauf 15)

**Status:** ✅ Done (2026-09-22)
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

- [x] **Zwischen zwei Zügen reist nichts mit** — und das war beim Nachmessen bereits so: `executor.ts`
      baut `messages` je Runde NEU. Die Eigenschaft hing an einer Zeile und war nirgends zugesagt;
      jetzt misst `tests/zugvermerk.test.ts` sie am laufenden Executor (drei Runden, 4.000 Zeichen
      Assistenten-Text je Runde, keiner davon in der nächsten).
- [x] **Was stattdessen mitreist, ist benannt und begrenzt:** `src/loop/zugvermerk.ts` — je Zug
      Runde, Fokus, Gate-Ergebnis und bei einer Abweisung die Regel-IDs (nie Regeltext). Neueste
      zuerst, hart bei `ZUGVERMERK_MAX = 1.200` Zeichen (≈300 Tokens), und **der Schnitt wird
      angesagt**: eine Obergrenze, die niemand sieht, ist ein Kontextleck mit Verzögerung. Auch der
      Best-of-N-Pfad vermerkt — sonst hätte ausgerechnet der Arm kein Gedächtnis, der am meisten probiert.
- [ ] **An einem Lauf gemessen** — offen bis zum Bestätigungslauf (CR-GC-610). Eine Aussage über
      einen Lauf gehört dorthin, nicht hierher.
- [x] Testsuite grün (bis auf die zwei erwarteten Link-Modus-Roten).

## Die Grenze, die beim Bauen gefunden wurde

Der erste Anlauf wollte die Denkblöcke auch **innerhalb** eines Schrittes verwerfen: der
anthropic-Zweig schickt sein `content` unverändert zurück, und dort liegen die ~220k Tokens. Das ist
verboten, und zwar nicht aus Vorsicht — **CR-GC-572 hat den Fall gemessen:** fehlt der Block, meldet
die API auf Turn .2 `messages.1.content.0.thinking.thinking: Field required`; im ersten
`gcrun-frontier`-Lauf folgte daraus **keine einzige Reparatur nach einer Gate-Ablehnung, 11 von 12
Schritten ohne zweiten Turn**. Der Schnitt war fertig und wurde zurückgenommen, als
`tests/executor.anthropic-roundtrip.test.ts` rot wurde — genau wofür dieser Test dasteht.

Daraus die ehrliche Aufteilung, die dieser CR liefert:

| | Denkblöcke |
|---|---|
| **innerhalb** eines Schrittes (Turn → Turn) | reisen mit — die API verlangt es |
| **zwischen** zwei Zügen (Runde → Runde) | reisen nicht mit; an ihrer Stelle der Zugvermerk |

Die 378k aus opus5-15 sind damit **kein Executor-Befund**: sie wurden in Claude Code gemessen, wo
der Verlauf nicht zu beschneiden ist. Der Executor war an dieser Stelle schon sparsam — ihm fehlte
das Gegenstück, das Gedächtnis.

## Zusammenhang

Voraussetzung dafür, dass der Executor mit einem lokalen Modell überhaupt fahren kann. Der Kontextanteil von graphcode
selbst wird in CR-GC-612 und CR-GC-613 gesenkt.

