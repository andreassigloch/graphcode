# CR-GC-785: se:optimize Version 3: ein Optimierer fuer Vorschlaege aus jeder Analyse

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-825 (idea)
**Erstellt:** 2026-10-11
**Item:** bok/items/ITEM-2026-825.json (Lane: code)

---

**Bezug:** `docs/graphcode_analyse_optimierungskonzept.md`, Abschnitt 10 und Abschnitt 6. **Wartet auf CR-SM-407; nimmt Vorschläge aus CR-GC-782 und CR-GC-783.**
**Frage des Autors (2026-10-11):** ist der Optimierer je Analyse eigen oder allgemein?

## Antwort und Anlass

Allgemein. Eigen je Analyse ist der **Vorschlag**: nur die Analyse einer Dimension kennt den Zweck und den Ort.
Gleich für alle ist der **Umgang** mit einem Vorschlag: proben, zeigen, was er berührt, wählen lassen, anwenden,
nachmessen. Zwei Optimierer würden denselben Umbau zweimal verschieden behandeln.

`se:optimize` Version 2 kennt nur eine Quelle, `graph_suggest`. Dessen Steuerwert liest Befunde, Kreuzungen und
Zusammenhalt, also die Größen, die in den Spikes am häufigsten gegen das Urteil liefen.

## Umfang

`.claude/commands/se/optimize.md`, Version 3:

1. **Zwei Quellen, nicht gemischt.** (a) Vorschläge aus einer Analyse in fester Form (Zweck, Kette, Ort,
   Handlungsklasse, Prognose, Preis). (b) Vorschläge von `graph_suggest` zur Güte des Modulbaums und des
   Funktionsbaums. Der Skill zeigt sie getrennt und bildet keine gemeinsame Rangfolge.
2. **Probe** per Trockenlauf durchs Gate.
3. **Gesamt-Impact als Vorlage** (Konzept 6b), davor und danach: Betrachtungsumfang; jede Kette, deren Zeile
   sich ändert; sicherheitsrelevante Fläche und Antwortweg; Kennzahlen von Modulbaum und Funktionsbaum mit
   Schwellen. Der Skill ordnet nicht und empfiehlt nicht nach einer Summe.
4. **Prüfung gegen die Prognose:** was gleich bleiben muss und nicht gleich bleibt, steht oben.
5. **Wahl durch den Autor, Anwendung durchs Gate, Nachmessung** gegen die Prognose; das Ergebnis steht im CR.

Dazu ein Test, der den Skilltext an die Felder aus CR-SM-407 bindet und festhält, dass er keine Rangfolge
bildet; Anforderung und Test am Knoten des Skills; Hilfetext.

## Nicht im Umfang

Eine Änderung an `graph_suggest` oder am Steuerwert. Ob der Steuerwert die Kettensicht lesen soll, ist eine
eigene Frage (CR-GC-771 steht dazu noch offen).

## Abnahme

- An den drei Entwürfen des Falls sigllm (graphanalyze `docs/messung/gesamt-impact-fall3-2026-10-10/`) zeigt der
  Skill je Entwurf die Vorlage mit den Zahlen der Notiz und nennt keinen Sieger.
- Der Skilltext enthält keine Summe über Kennzahlen.

## Grenzen

Die Vorlage ist so gut wie die Vorbereitung des Modells; ohne geschlossene Kette verweist der Skill dorthin.
