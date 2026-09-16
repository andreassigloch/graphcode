# CR-GC-545: Grenzmengen-Messung: welche FUNC MUESSEN ins Modell — die, deren Symbol eine MOD-Grenze kreuzt. Untergrenze, keine Gleichheit; jetzt auf einer Datei->MOD-Aufloesung von 98,9% statt 59%

**Status:** ✅ Done (2026-09-16)
**Typ:** aus Item ITEM-2026-219 (idea)
**Erstellt:** 2026-09-16
**Item:** bok/items/ITEM-2026-219.json (Lane: code)

---

MESSUNG, kein Gate. Ergebnis sind Zahlen und eine Pflichtliste; ob daraus eine Regel wird,
ist eine eigene Entscheidung.

## Die Definition

Eine FUNC MUSS ins Modell, wenn ihr Symbol **aus seinem Modul heraustelefoniert**. Eine Blackbox
ist ihre Grenze (Leitlinie Satz 1); was sie kreuzt, ist ihre Schnittstelle, was drinnen bleibt,
geht niemanden an. Dasselbe fuer SCHEMA — das ist Satz 2 „Worueber (der Vertrag, der die Grenze
definiert)".

**Untergrenze, keine Gleichheit.** Mehr darf modelliert sein, wenn es Warum oder Wie traegt.
Als Gleichheit gelesen waeren die 57 modellierten FUNC, die keine Grenze kreuzen, allesamt
Verstoesse — Unsinn, eine FUNC darf in einer Wirkkette stehen, ohne ein Modul zu verlassen.
Sparsamkeit hat einen eigenen Besitzer: Satz 3 und die Kennzahlen.

Voraussetzung war CR-GC-544. Ohne `MOD.path` kannte die Datei->MOD-Aufloesung 59 % der Dateien,
und „kreuzt eine Grenze" waere eine Aussage ueber die andere Haelfte gewesen.

## Ergebnis (graphVersion 283, `scripts/grenzmenge.mjs`)

93 Quelldateien, **395 Import-Bindungen: 302 modul-intern, 93 grenzueberschreitend.**
**76 % des Verkehrs bleibt in seiner Box** — die Blackboxen sind echt, nicht behauptet.

| | Pflichtmenge | im Modell | Deckung | fehlt | modelliert, kreuzt nicht |
|---|---:|---:|---:|---:|---:|
| FUNC | 44 | 15 | **34,1 %** | 29 | 57 |
| SCHEMA | 49 | 7 | **14,3 %** | 42 | 27 |

**Kein blinder Fleck:** jedes Importziel loeste zu einem MOD auf. Das ist CR-GC-544s Ertrag —
vorher waere ein Teil der Antwort „weiss nicht" gewesen, ununterscheidbar von „kreuzt nicht".

### Korrektur einer frueheren Behauptung

Ich hatte gesagt, die SCHEMA-Ebene folge der Regel schon — 49 grenzueberschreitende Typen gegen
48 SCHEMA-Knoten. **Die ZAHLEN stimmten ueberein, die MENGEN nicht: 7 von 49.** Eine
Zahlengleichheit ist kein Beleg; das war eine unbelegte Behauptung, und sie war falsch.

### Der schaerfste Einzelbefund

`src/kernel/tool-contract.ts` traegt mit `MCPTool`, `MCPToolRegistry` und `ToolPort` die drei
Vertraege, die von **je drei Modulen** geholt werden — der meistgekreuzte Vertrag des Repos.
Keiner davon hat einen SCHEMA-Knoten. Auf der FUNC-Seite dasselbe Muster:
`toOntologyGraph` (3 Module), `stripViolationContext`, `graphSnapshotRel`, `impactedTests`
(je 2) — alle ungemodelliert.

Die Fehlmenge liegt fast vollstaendig in `src/kernel/*`: das Modul mit der groessten
Aussenwirkung ist innen am besten und an seiner Grenze am schlechtesten beschrieben.

## Was NICHT Teil dieses CR ist

- **Keine Regel.** Aus 34 % wird kein Gate, bevor jemand entschieden hat, ob die Pflichtmenge
  der richtige Nenner ist. Das ist die naechste Entscheidung, nicht dieser Zug.
- **Kein Modellzug.** Die 71 fehlenden Knoten werden hier GEZAEHLT und BENANNT, nicht angelegt.
- **Nur graphcode.** Die anderen Familienmitglieder haben noch kein `MOD.path` (CR-GC-544 war
  ein graphcode-Zug); dort waere die Messung heute wieder eine Aussage ueber die halbe Menge.

## Abnahme

`node scripts/grenzmenge.mjs` laeuft read-only, nennt die Pflichtmenge je Typ, die Deckung, und
listet die fehlenden Symbole nach Zahl der holenden Module — die Reihenfolge, in der sie
nachzuziehen waeren. Wiederholbar: waechst die Deckung, sagt derselbe Lauf es.
