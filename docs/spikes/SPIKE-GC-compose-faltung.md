# SPIKE-GC: Compose-Faltung — der Graph als Blackbox-Baum statt als Liste

**Status:** Abgeschlossen — Ergebnis: [`SPIKE-GC-compose-faltung-RESULTS.md`](SPIKE-GC-compose-faltung-RESULTS.md)
**Vorgänger:** `SPIKE-GC-minimal-whitebox` (2026-08-18) — dort war der Außenring nach **Tiefe**
geschnitten und erwies sich als Ballast (H2). Hier wird nach **Struktur** gefaltet.

## 1. Frage

Ein kleines Modell kann den ganzen Graphen nicht im Kopf halten — ein Mensch auch nicht. Der
Mensch liest ein System als Baum aus Blackboxes: eine FUNC mit ihren Unter-FUNCs (`compose`) ist
von außen **eine** Box, dasselbe für MOD in MOD, UC mit seinen REQ, FCHAIN mit ihren FUNC.
Aufgeklappt wird nur der Ast, an dem gearbeitet wird; wer mehr braucht, lädt nach.

> **Zu zeigen:** Ein deterministisch gefalteter Graph — Arbeitsast offen, Geschwister als Box
> (uid · Name), alles darunter verborgen — trägt die Mutationen, die in den aufgezeichneten Läufen
> tatsächlich gemacht wurden, bei einem Bruchteil der Größe und mit seltenem Nachladen.

## 2. Faltung (Definition, vor der Messung festgelegt)

- **Baum:** `compose`-Kanten. Knoten ohne `compose`-Elternteil hängen an ihrem **Eigner** über die
  erste Kante zu einem Baumknoten, in der Reihenfolge `verify` (TEST→REQ) · `io` (FLOW↔FUNC) ·
  `relation` (SCHEMA→FLOW) · `satisfy` · `allocate` · sonst. Ohne Eigner: Wurzel.
- **Saat `S`** (vor der Mutation bekannt, nie aus ihr abgeleitet): die `respondsTo`-Elemente des
  Audits (der Befund, auf den reagiert wird); fehlen sie, die Knoten, die die **vorige** Mutation
  berührt oder angelegt hat.
- **Offen:** `S`, ihre Teilbäume, ihre Vorfahren. **Box:** Kinder offener Vorfahren und alle
  Wurzeln, die nicht offen sind — Zeile `uid [Name]`, keine Beschreibung, keine Attribute.
  **Verborgen:** alles andere. Kanten nur zwischen sichtbaren Knoten.

## 3. Hypothesen

- **H1 — Größe.** Bei Graphen ab 50 Elementen ist die gefaltete Ansicht **≤ 30 %** der vollen
  (Zeichen, gleiche Zeilenform). *Falsifiziert*, wenn der Median darüber liegt.
- **H2 — Nachladen selten.** Höchstens **20 %** der Mutationen berühren einen Knoten, der
  verborgen ist oder als Box dasteht und inhaltlich geändert wird. *Falsifiziert* darüber.
  Referenzieren einer Box per uid (Kante) zählt **nicht** als Nachladen — die uid ist sichtbar.
- **H3 — Nachladen flach.** Wo nachgeladen werden muss, reicht im Median **eine** Ebene
  (`graph_expand` auf die nächste sichtbare Box).
- **H4 — Executor ≠ Frontier.** Frontier (opus5, gcrun-frontier) und lokaler Executor (gcrun)
  unterscheiden sich in der Nachladequote. Offen, welche Richtung — die Vermutung des
  Auftraggebers ist: nur der Executor braucht die Faltung, und dort kann sie deterministisch
  mit Datenbankaufrufen passieren.

## 4. Korpus und Nachspiel

`rig/greenfield-systemtest/runs/*/audit.jsonl` — je Mutation die Befehle und `respondsTo`.
Der Graph vor jeder Mutation wird aus den Befehlen der vorigen nachgebaut (nur angewandte).
Reine Auswertung, kein LLM: `rig/greenfield-systemtest/faltung.mjs`.

## 5. Grenzen (vorab)

- Die Aufzeichnung zeigt, was das Modell **getan** hat, nicht was es **gebraucht** hätte. Ein
  Modell, das die Faltung sieht, hätte vielleicht anders gearbeitet — das misst nur ein echter Lauf.
- Die Saat ist ein Näherungswert für „woran wird gearbeitet“; eine schlechte Saat erhöht die
  Nachladequote, sie verfälscht sie nicht nach unten.
