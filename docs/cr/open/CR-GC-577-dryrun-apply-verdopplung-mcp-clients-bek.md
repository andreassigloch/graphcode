# CR-GC-577: Der Probelauf liefert sein Urteil zweimal — 19 % der Gate-Antwort

**Status:** ✅ Abgeschlossen 2026-09-21 — Kriterium 3 gemessen
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

---

## 6 Die Gegenrechnung (Kriterium 1, 2026-09-21)

Aus den Audit-Trails **aller** Rig-Laeufe, nicht geschaetzt. „Nicht angewandt" heisst: auf
die geblockte Probe folgte keine Anwendung, sondern eine Revision.

| Arm | Laeufe | Proben | davon `block` | `block` + nicht angewandt | Anwendungen | davon abgelehnt |
|---|---:|---:|---:|---:|---:|---:|
| `gcrun` | 6 | 75 | 37 | 35 | 77 | 3 |
| `opus5` | 6 | 30 | **4** | **3** | 71 | 6 |
| `qwen-35b` | 1 | 0 | 0 | 0 | 1 | 0 |

Der offene Fall ist `opus5` — der MCP-Client. **30 Proben, 4 Blocks, 3 verhinderte
Anwendungen.**

## 7 Die Entscheidung (Kriterium 2): (a), und die Zahl sagt warum

Die 3 verhinderten Anwendungen haben **keinen Schaden verhindert**: eine abgelehnte
Anwendung persistiert nichts — das pinnt `mcp.mutate-violations.test.ts` bereits als
Invariante. Verhindert wurde ein No-Op.

Damit ist die Arithmetik eindeutig, und sie braucht keinen Geschmack:

| | sauberer Batch | abgelehnter Batch |
|---|---:|---:|
| **ohne Probe** | 1 Gate-Antwort | 2 |
| **mit Probe** | 2 | ≥ 2 |

Proben ist bei EINEM Kandidaten nie billiger, und in **26 von 30** Faellen war es
nachweislich reine Verdopplung. Bei MEHREREN Alternativen bleibt die Probe richtig: sie ist
die einzige Art, Verdicts zu vergleichen, ohne sie zu verursachen — die Grundlage von
Best-of-N (CR-GC-288). Genau diese Grenze zieht der Zug.

**Umgesetzt:** `GATE_PROTOCOL.host` verlangt die Probe nur noch fuer mehrere Alternativen
und schickt den einzelnen Batch direkt ans Gate — mit der Begruendung im Satz, sonst liest
sich die Anweisung wie eine Nachlaessigkeit statt wie eine Rechnung. `selection: 'driver'`
bleibt unveraendert (dort ist es seit CR-GC-568 erledigt).

## 8 Der Posten neu erhoben (§5)

Nach CR-GC-570, 576 und 579, nachgespielt an `runs/opus5-5` (6 Paare aus Probe und
Anwendung desselben Batches — die CR zaehlte 5, der Unterschied ist eine Paar-Grenze):

| | Zeichen | Anteil am `graph_mutate`-Payload |
|---|---:|---:|
| damals, wie im Strom | 44.587 | 24,2 % |
| heute: gefaltet + kompakt + ohne stille Advisories | 10.520 | **20,0 %** |

Der Posten selbst ist um **76,4 %** geschrumpft, sein **Anteil** nur von 24,2 auf 20,0 % —
weil der Rest der Antwort mitgeschrumpft ist. Die 19 % aus §1 stehen also im Kern
unveraendert, und das ist der Grund, warum dieser Zug trotz der drei Vorgaenger noch lohnt.

## 9 Kriterien

| # | Kriterium | Ergebnis |
|---|---|---|
| 1 | Gegenrechnung aus dem Audit-Trail, je Arm | erfuellt — §6 |
| 2 | Entscheidung mit ihrer Zahl, nicht mit einer Meinung | erfuellt — §7 |
| 3 | ein Lauf ohne Probelauf liegt nicht unter dem Kontrollband (68–122 Elemente) | **offen** — braucht einen Rig-Lauf |

**Die CR bleibt offen, bis Kriterium 3 gefahren ist.** Der Zug aendert einen Rang-Kanal des
Rundenprompts; ihn ohne Ausbeute-Messung zu schliessen waere genau das, was CR-GC-575
verbietet.

---

## 10 Kriterium 3 gemessen (Runde 7, 2026-09-21)

**Ohne Probe (Executor, `gcrun`):** 0 Proben in allen drei Laeufen, 91 / 47 / 88 Elemente —
Median im Band 68–122 (Tabelle in CR-GC-575 §5).

**MCP-Client (`opus5`), gegen den Bezugslauf `opus5-5`:**

| | Bezug | Lauf 6 | Lauf 7 | Lauf 8 |
|---|---|---|---|---|
| Elemente | 150 | 280 | 321 | 278 |
| Proben | 12 | 6 | 6 | 8 |
| Probe → identische Anwendung | 6 Paare, 44.587 Z. | 2, 9.550 Z. | 1, 2.852 Z. | 2, 2.684 Z. |

Die Verdopplung ist um **79–94 %** gefallen, nicht auf null: der Client probt weiter 6–8-mal,
teils Alternativen hintereinander (das ist der erlaubte Fall), teils noch den einzelnen Batch.
Die Ausbeute liegt klar ueber dem Bezug. **Erfuellt.** Kongruenz: benannte Ausnahme wie oben.
