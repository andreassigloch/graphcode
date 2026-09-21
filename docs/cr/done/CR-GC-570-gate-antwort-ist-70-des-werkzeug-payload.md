# CR-GC-570: Die Gate-Antwort kuerzen — sie ist 70 % des Kontexts und zur Haelfte Wiederholung

**Status:** ✅ Done (2026-09-21)
**Typ:** aus Item ITEM-2026-411 (finding)
**Erstellt:** 2026-09-21
**Abgeschlossen:** 2026-09-21
**Item:** bok/items/ITEM-2026-411.json (Lane: graph)

---

## 1 Befund (gemessen, `runs/opus5-5`)

| Werkzeug-Ergebnisse im Kontext | Zeichen | Anteil | Ø je Aufruf |
|---|---:|---:|---:|
| `graph_mutate` | 202.833 | **70 %** | 8.818 |
| `graph_generate` | 44.307 | 15 % | 4.430 |
| `graph_authoring_guide` | 11.961 | 4 % | 1.329 |

In 23 Gate-Antworten stehen **487 Violations, davon nur 237 distinkte** (Regel, Element)-Paare —
**51 % ist Wiederholung**; `R-21 @ FCHAIN-auftrag-abarbeiten` stand 13-mal drin. Und **alle 487
sind `gating: false`**: kein einziger haette die Anwendung verhindert.

Der teuerste Posten im Kontextfenster ist eine Liste, die nichts erzwingt und sich staendig
wiederholt. Sie verursacht zugleich 48 % der `cache_creation` (CR-GC-567) — der Posten mit
etwa dem Zwoelffachen des Lesepreises.

## 2 Zielbild

Die Gate-Antwort traegt, was der Empfaenger nicht schon weiss:
1. **Blockierendes immer** — vollstaendig, mit `fixHint`.
2. **Nicht-blockierendes nur, wenn neu** gegenueber der vorigen Antwort derselben Sitzung.
3. **Wiederholtes als Zahl**, nicht als Liste ("37 unveraenderte Befunde, davon 12 im Fokus").

Kein Informationsverlust: der vollstaendige Stand ist einen `rules_get_violations`-Aufruf
entfernt und steht ohnehin in `readiness`.

## 3 Drei Wege — und warum alle drei falsch lagen

Die Frage war: das Gate ist **zustandslos**, jeder `graph_mutate`-Aufruf bewertet neu und kann
nicht wissen, was er beim letzten Mal schon gesagt hat. "Nur Neues melden" braucht also ein
Gedaechtnis — oder einen Verzicht darauf.

**(a) Der Aufrufer schickt den Stand mit.** Sauber, aber der veroeffentlichte Werkzeugvertrag
waechst und **jeder** Client muss die Liste mitfuehren — auch `claude -p`, das nicht weiss, dass
es sie fuehren soll.

**(b) Der Host merkt es sich je Sitzung.** Einfach, aber **derselbe Aufruf liefert je nach
Vorgeschichte eine andere Antwort.** Determinismus traegt hier Rankings, Tests und Replay.

**(c) Nicht diffen, sondern begrenzen** — nicht-blockierende Befunde nur fuer die Fokus-Typen
der Runde, der Rest als Zahl. Das war die Empfehlung.

**(c) wurde nachgerechnet und faellt aus: 0,2 % Ersparnis.** Gegen denselben Lauf simuliert
behaelt der Fokus-Typ-Filter **410 von 411** nicht-blockierenden Befunden, weil die Batches
fast alle Elementtypen zugleich beruehren. Es gibt keinen Fokus, den man abziehen koennte.

Zwei weitere Annahmen dieser CR hielten der Messung ebenfalls nicht stand:

- **"Die Antwort berichtet den ganzen Graphen."** Tut sie nicht. Das Gate filtert seit jeher
  gegen eine Baseline und liefert nur die Befunde, die **dieser** Batch einfuehrt
  (`gate.ts`, Schritt 3). Die 51 % Wiederholung entstehen woanders: aus den **dryRun→apply-Paaren**.
  Der Autor probt einen Batch, bekommt 48 Befunde, wendet denselben Batch an und bekommt
  dieselben 48 noch einmal — gemessen fuenf solche Paare (48, 30, 34, 49, 1). Das ist das
  vorgesehene MCP-Protokoll, nicht ein Defekt der Antwort.
- **"Alle 487 sind nicht-blockierend."** Nein: **76 error**, 362 warning, 49 info. Die 76 sind
  blockierend. Die urspruengliche Zahl kam aus einer Zaehlung ueber `gating`, die das
  Severity-Feld nicht mitgelesen hat.

### Was die Messung stattdessen zeigt

| Block der Antwort | Zeichen | Anteil |
|---|---:|---:|
| `violations` | 143.531 | **78 %** |
| `fitAdvisory` + `steerAdvisory` + `workOrder` | 29.994 | 16 % |
| Rest (Huelle) | 10.405 | 6 % |

Und der entscheidende Fund: **in allen 487 Befunden steht die elementId im Meldungstext.**
Der Befundkoerper — `message` Ø 73 Zeichen plus `fixHint` Ø 78 — wiederholt sich damit je
Element **wortgleich bis auf die eine uid**: `R-19` 73-mal, `RD-01` 73-mal, `R-22` 39-mal.

Die Antwort ist nicht zu lang, weil sie zu viel sagt. Sie ist zu lang, weil sie dasselbe
zu oft sagt.

## 4 Umgesetzt: falten statt kuerzen

Ein Eintrag je (Regel, Meldungsmuster) statt einer je Element. `{el}` steht an der Stelle der
uid, die betroffenen Elemente stehen als Liste daneben:

```
{ ruleId: 'R-19', severity: 'warning',
  message: '{el} hat keinen verifizierenden TEST',
  fixHint: 'verify-Kante von einem TEST auf {el} ziehen',
  elements: ['REQ-a', 'REQ-b', ...] }
```

Das ist eine **Faktorisierung, keine Kuerzung**. Aus Muster plus Elementliste ist jede
Originalmeldung wieder herstellbar — deshalb darf die Projektion auch blockierende Befunde
falten, sie verliert keinen. Gefaltet wird nur, was sich wirklich gleicht: der Schluessel ist
das vollstaendige Muster, keine Heuristik auf der ruleId. Gemessen bleibt `R-18` mit 19
verschiedenen Mustern auf 32 Funden entsprechend in 19 Eintraegen.

`violations: 'full'` liefert unveraendert einen Eintrag je Element.

**Nicht zusammengelegt mit `contextualHelp` (`projections/help.ts`), bewusst.** Die gruppiert
ebenfalls je Regel (CR-GC-316), aber mit anderem Vertrag: nur nach `ruleId`, mit `count`, mit
auf `MAX_EXAMPLE_ELEMENTS` gedeckelter Beispielliste und angehaengter Hilfe — **absichtlich
verlustbehaftet**, weil sie Erklaerung liefert, nicht Reparaturmaterial. Die beiden zu einer
Funktion zu zwingen machte entweder die Hilfe riesig oder die Gate-Antwort unvollstaendig.

Die uid wird nur als **ganzes Token** ersetzt, nie als Teilstueck eines laengeren Bezeichners:
bei elementId `REQ-a` bleibt `REQ-ab` stehen. Sonst koennten zwei verschiedene Meldungen auf
dasselbe Muster maskieren und falsch zusammenfallen — ein stiller Inhaltsfehler statt
gesparter Bytes.

**Dateien (7) — eine ueber dem harten Limit von 6.** Benannt, nicht kaschiert. Die drei
angefassten Fremdtests sind keine Zusatzarbeit, sondern die erzwungene Folge der einen
Quelltextaenderung: jeder von ihnen behauptete die alte Drahtform. Sie in eine zweite CR zu
schieben hiesse, die Suite zwischen den beiden CRs rot zu lassen — teurer als der Ueberhang.

- `src/kernel/evaluation.ts` — `groupViolationsByRule`, `GroupedViolation`, `ELEMENT_PLACEHOLDER`
  (neben `stripViolationContext`, damit die Projektion nicht zum zweiten Mal entsteht, CR-GC-398)
- `src/surface/write.ts` — `summarizeViolations` faltet nach dem Context-Strip; Werkzeugtext nennt die Form
- `tests/mcp.mutate-violation-grouping.test.ts` — neu, 10 Tests
- `tests/mcp.mutate-violations.test.ts` — zwei CR-GC-309-Tests trugen die alte Form; der Vergleich
  "summary und full unterscheiden sich NUR in context" ist jetzt der Verlustfreiheits-Test
  (entfaltet muss summary wieder full sein)
- `tests/mcp.symmetry.test.ts` — Symmetrie heisst gleiches Urteil, nicht gleiche Serialisierung;
  verglichen wird das betroffene Element, nicht das Feld, in dem es steht
- `tests/mcp.mutate-input.test.ts` — der R-18-Test las das illegale Paar aus dem Rohtext der Meldung
- `docs/cr/open/CR-GC-570-*.md` — dieses Dokument

## 5 Akzeptanzkriterien

| # | Kriterium | Ergebnis |
|---|---|---|
| 1 | Ein Lauf gleicher Elementzahl schreibt messbar weniger `cache_creation` | **offen** — braucht einen Rig-Lauf (CR-GC-572) |
| 2 | Kein blockierender Befund faellt je weg — Test mit erzwungener Ablehnung | **erfuellt** |
| 3 | Anteil von `graph_mutate` am Werkzeug-Payload faellt unter 40 % | **nicht erfuellt: 51,4 %** |

Zu 2: gegen `runs/opus5-5` nachgespielt bleiben **76 von 76** blockierenden Befunden nach dem
Entfalten Element fuer Element erhalten; zwei Tests pinnen das am Gate mit einem erzwungen
geblockten Batch.

Zu 3: gemessen an denselben 23 Antworten faellt der Violations-Block von 143.531 auf 46.587
Zeichen (**−67,5 %**, 487 Befunde in 107 Eintraegen) und der gesamte Werkzeug-Payload von
266.188 auf 169.244 (−36 %). `graph_mutate` steht damit bei **51,4 %** statt 69 % — deutlich
besser, aber ueber der Marke. Die Luecke liegt in den beiden Posten, die diese CR nicht
anfasst, und beide sind gemessen:

- **Advisory-Rauschen, 16 % der Antwort.** `steerAdvisory` war in **21 von 21** Faellen
  durchgehend null, `workOrder` in 18 von 21 leer, `fitAdvisory` in 12 von 21 ein
  Null-Delta ueber sechs Dimensionen — ausgeschrieben, weil die Antwort mit Einrueckung 2
  serialisiert wird. → ITEM-2026-418.
- **Die dryRun→apply-Verdopplung.** Fuer den Executor hat CR-GC-568 sie abgestellt
  (`selection: 'driver'`); fuer MCP-Clients ist sie das vorgesehene Protokoll. Ob der
  Probelauf seinen Preis wert ist, ist eine Protokollfrage. → ITEM-2026-419.

Beide haben jetzt eigene Zuege: **CR-GC-576** (leere Advisories) und **CR-GC-577**
(dryRun-Verdopplung). Dazu kam beim Nachmessen ein dritter, groesserer: **CR-GC-579** —
`mcp-server.ts` serialisiert JEDE Werkzeugantwort mit Einrueckung 2, gemessen **18,3 % des
gesamten Werkzeug-Payloads** fuer ein Argument.

**Diese CR schliesst mit AK3 offen, nicht erfuellt.** Entscheidung des Auftraggebers vom
2026-09-21: „jede reduzierung ist gut, auch wenn wir noch nicht am ziel sind." Der Grund, sie
zu schliessen statt offen zu halten, ist nicht die Nachsicht, sondern dass die Restarbeit
vollstaendig benannt ist und eigene Nummern hat — eine CR, die auf fremde Zuege wartet, ist
kein Vorhaben mehr, sondern ein Merkzettel.

## 6 Testlage

Volle Suite: **1220 Tests, 3 rot** — davon zwei durch diese Aenderung (die alte Drahtform in
`mcp.symmetry` und `mcp.mutate-input`), beide oben angepasst und gruen.

Der dritte ist **vorbestehend und nicht von dieser CR**: `audit.trail-projection` misst gegen
den **lebenden** `.graphcode/audit.jsonl` des Repos und reisst seine 11-%-Schwelle bei 20,8 von
165,2 KB. Nachgewiesen durch einen Lauf mit `src` auf HEAD — identisch rot. Ein Test, der eine
Quote gegen eine Datei behauptet, die eine andere Session fortschreibt, ist per Konstruktion
flaky. → ITEM-2026-420.

## 7 Kongruenz

Nicht geprueft. `RC-*` braucht das Gate, und die Session, die diese Aenderung geschrieben hat,
erreicht den graphcode-Graphen nicht: sie wurde in `bok` gestartet und bindet ueber
`bok/.mcp.json` den bok-Graphen, waehrend der graphcode-Graph von pid 3637 aus einer anderen
Session bedient wird (`.graphcode/owner.lock`, ein Besitzer je Repo). **Benannte Ausnahme,
nachzuholen im naechsten Zug am graphcode-Graphen** (CR-GC-569).

Die Aenderung beruehrt keine `allocate`-Kante und keinen `realRef`; betroffen ist eine
Projektion auf der MCP-Flaeche, kein Modellzug.

---

## 8 Nachtrag: AK1 und AK3 am echten Lauf (Runde 7, 2026-09-21)

`opus5`, sigllm-Prosa-Korpus, nach CR-GC-570/576/577/579, gegen den Bezugslauf `opus5-5`:

| | Bezug | Lauf 6 | Lauf 7 | Lauf 8 |
|---|---|---|---|---|
| `cache_creation` je Element | 2.455 | 1.172 | 1.325 | 1.458 |
| Anteil `graph_mutate` an allen Werkzeugantworten | 69,1 % | 42,5 % | 25,9 % | 25,8 % |

**AK1 erfuellt:** 41–52 % weniger Cache-Aufbau je Element. **AK3 (<40 %) in zwei von drei Laeufen
erfuellt.** Das ist die Summe der vier Kontext-Zuege, nicht CR-570 allein.
