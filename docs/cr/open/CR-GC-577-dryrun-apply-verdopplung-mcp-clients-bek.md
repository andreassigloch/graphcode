# CR-GC-577: Der Probelauf liefert sein Urteil zweimal — 19 % der Gate-Antwort

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-419 (finding)
**Erstellt:** 2026-09-21
**Item:** bok/items/ITEM-2026-419.json (Lane: graph)

---

## 1 Befund (gemessen, `runs/opus5-5`)

23 `graph_mutate`-Aufrufe: 12 als `dryRun`, 11 als Anwendung. In **5 Faellen** folgte auf einen
Probelauf unmittelbar die Anwendung **desselben Batches** — und das Gate lieferte denselben
Befundsatz noch einmal, Element fuer Element identisch:

| Probe | Befunde | Anwendung | Befunde |
|---|---:|---|---:|
| Aufruf 1 | 48 | Aufruf 3 | 48 |
| Aufruf 8 | 30 | Aufruf 9 | 30 |
| Aufruf 10 | 34 | Aufruf 11 | 34 |
| Aufruf 14 | 49 | Aufruf 15 | 49 |
| Aufruf 17 | 1 | Aufruf 18 | 1 |

**120 doppelt gelieferte Befunde in 34.973 Zeichen — 19,0 % der gesamten Gate-Antwort.**

Das war die eigentliche Quelle der „51 % Wiederholung" aus CR-GC-570. Die dort vermutete
Ursache (die Antwort berichte den ganzen Graphen) stimmte nicht: das Gate filtert gegen eine
Baseline und liefert nur, was **dieser** Batch einfuehrt. Es liefert es nur zweimal, weil der
Batch zweimal kommt.

## 2 Was hier NICHT das Problem ist

Der Probelauf selbst ist richtig und soll bleiben. Er ist die einzige Art, ein Gate-Urteil zu
erfahren, ohne es zu verursachen, und die Grundlage von Best-of-N (CR-GC-288).

Falsch ist nur, dass die zweite Antwort so tut, als sage sie etwas Neues. Der Aufrufer hat
diese 48 Befunde zwei Zuege vorher wortgleich gelesen.

Fuer den eingebetteten Executor ist das seit CR-GC-568 erledigt (`selection: 'driver'` — er
probt bei einem Kandidaten gar nicht mehr). Offen ist es fuer **MCP-Clients**, und dort ist es
kein Versehen, sondern das vorgesehene Protokoll: der Schema-Default `selection: 'host'`
beauftragt den Client ausdruecklich, selbst zu proben.

## 3 Drei Wege

**(a) Der Client hoert auf zu proben, wenn es nichts zu vergleichen gibt.** Bei einem einzigen
Kandidaten ist der Probelauf reine Vorschau — das Gate persistiert bei `block` ohnehin nichts
(pinnt `mcp.mutate-violations.test.ts` bereits als Invariante). Preis: er steht dann ohne
Vorwarnung vor einer Ablehnung. Genau das hat der Executor akzeptiert und ist dabei besser
gefahren.

**(b) Die Anwendung nach einer Probe antwortet knapper.** Braucht ein Gedaechtnis im Gate —
faellt aus denselben Gruenden aus wie in CR-GC-570 (Determinismus traegt Rankings, Tests, Replay).

**(c) Nichts aendern, nur messen.** 19 % sind viel, aber der Probelauf kauft dafuer etwas:
eine Ablehnung, die nie passiert ist. Wie oft er das tut, ist **nicht gemessen** —
in `opus5-5` gab es 2 Rejections bei 12 Proben.

**Empfehlung: erst die Gegenrechnung, dann (a).** Bevor der Kanal abgeschaltet wird, muss auf
dem Tisch liegen, was er verhindert: Anteil der Proben, deren Verdict `block` war und die
deshalb NICHT angewendet wurden. Ist er nahe null, zahlt der Probelauf 19 % fuer nichts; ist
er hoch, ist er sein Geld wert. Das ist dieselbe Frage wie bei ITEM-2026-413 (die Dry-Run-Quote
braucht die Ausbeute daneben) und sollte einmal beantwortet werden, nicht zweimal.

## 4 Akzeptanzkriterien

1. Die Gegenrechnung liegt vor: je Arm die Zahl der Proben, davon `block`, davon nicht
   angewendet — aus dem Audit-Trail, nicht geschaetzt.
2. Erst danach die Entscheidung; sie steht im CR mit ihrer Zahl, nicht mit einer Meinung.
3. Faellt sie auf (a): ein Lauf ohne Probelauf liegt nicht unter dem Kontrollband der Ausbeute
   (68–122 Elemente).

## 5 Reihenfolge

**Nach CR-GC-579 und CR-GC-576.** Die 19 % sind gegen die heutige Antwort gemessen; nach den
beiden anderen Zuegen ist die verdoppelte Antwort kleiner und der Posten neu zu erheben.
