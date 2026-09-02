# CR-DRAFT-GC-458 — Die Fitness-Metrik bestraft genau den Zug, den die eigene Doktrin vorschreibt

**Status:** draft — braucht Familie-Review (`@sigloch/se-engine`, Drift-Lock L2)
**Angelegt:** 2026-09-02
**Ausgelöst durch:** CR-GC-457 (Blockschnitt auf drei Features)

## Der Widerspruch

Zwei Sätze aus demselben Werkzeug, beide normativ, die einander widersprechen:

> `.claude/commands/se/top-level.md`:
> **„Size: the answer to 'too big' is a level, not more modules."**
> „Max 5 modules per level. When five modules each hold 14–26 FUNCs, every size threshold breaks —
> the fix is a level *inside* the modules, never a sixth module."

> `metrics(G, {layer:'arch'})`, gemessen an CR-GC-457:
> Eine eingezogene Ebene kostet **coherence −0,092 · flowEfficiency −0,108**, gewichtet gegen das
> Zielprofil dieses Repos **−0,129**.

Die Doktrin schreibt einen Zug vor, den die Messung als Verschlechterung ausweist.

## Mechanik — warum das kein Zufall ist

`layer: 'arch'` misst den Architektur-Teilgraphen (FUNC/FLOW/MOD/SCHEMA/ACTOR) **flach über alle
Kompositionstiefen**. Ein Strukturblock trägt per Definition nur `compose` und **kein `io`** — er ist
eine Abstraktion, kein Datenaustausch. `coherence` misst aber, wie natürlich der
*Abhängigkeitsgraph* clustert. Für diese Messung ist ein Knoten ohne io-Kanten ein Knoten ohne
Nachbarn.

Also: **jede eingezogene Ebene erhöht die Knotenzahl, ohne eine einzige Kante beizusteuern, die die
Metrik sieht.** Der Effekt ist systematisch und skaliert mit der Zahl der Ebenen. Er trifft
`modifiability` nicht (dort +0,134), weil die anders rechnet.

## Warum der naheliegende Ausweg versperrt ist

Man könnte den Strukturblöcken die Grenzflüsse ihres Teilbaums geben. Gemessen (CR-GC-457,
77 Kanten über 32 Grenzflüsse): **flowEfficiency 0,821 → 0,000**, coherence −0,141, gewichtet
**−0,429**. Fünfmal schlimmer als das Problem.

Und es ist ohnehin verboten — dieselbe Skill:

> „**The top FUNC set is a projection**, not an edge […] a derivable relation asserted as an edge can
> drift from the truth, and a computed one cannot […] **read it, do not assert it**."

mit Präzedenzfall CR-SM-266 D2 (`MOD -io-> MOD` wurde aus genau diesem Grund gelöscht).

## Die scharfe Formulierung

**Die Architekturmaschine kann den Zug nicht vorschlagen, den ihre eigene Doktrin vorschreibt.**
`graph_suggest` rankt nach `score = Δm·t̂`. Ein Zug, der eine Ebene einzieht, hat systematisch ein
negatives Δm auf `coherence` — der Dimension, die dieses Repo mit **1,0** gewichtet, also der
höchsten überhaupt. Er landet damit strukturell hinter jedem Nichtstun. Kein Anwender, der der
Rangliste folgt, wird je eine Ebene einziehen.

Das ist die Klasse Fehler, die im Produktversprechen selbst sitzt: „dynamische Führung zur guten
Spezifikation, aus definierten Kenngrößen". Wenn die Kenngröße den guten Zug bestraft, führt die
Führung falsch — deterministisch und reproduzierbar, was es schlimmer macht, nicht besser.

## Optionen (nicht entschieden)

| | Ansatz | Kosten | Bemerkung |
|---|---|---|---|
| **A** | Reine Strukturknoten aus dem arch-Teilgraphen ausschliessen (FUNC mit `compose`-Kindern, ohne `realRef`, ohne `io`) | klein, in `se-engine` | billigster korrekter Fix; deckt sich damit, dass R-30 solche Knoten schon von der Kettenpflicht ausnimmt |
| **B** | Je Ebene messen: den Vektor auf der Wurzelprojektion **und** auf der Blattebene, beide ausweisen | mittel, braucht die Rollup-Projektion (lesend, nicht als Kante) | die vollständige Antwort; macht „welche Ebene ist gemeint" explizit, statt sie zu mitteln |
| **C** | Nichts ändern, Doktrin ergänzen: der Fitness-Vektor ist eine **Blattebenen**-Messung und ist kein Urteil über einen Ebenen-Einzug | null | ehrlich, aber lässt `graph_suggest` weiter falsch ranken |

Empfehlung: **A**, mit **B** als Ziel. **C** allein reicht nicht, weil die Rangliste automatisch
wirkt und niemand die Fussnote liest.

## Was zu prüfen ist, bevor das entschieden wird

- Gilt derselbe Effekt für `MOD -compose-> MOD`? Dann trifft er den Modulschnitt genauso.
- Ist `flowEfficiency 0,000` beim Rollup ein echter Wert oder ein degenerierter Sonderfall
  (Division durch eine Pfadlänge, die durch die doppelten Pfade kollabiert)? Die Zahl ist exakt 0,
  das riecht nach Sonderfall und sollte nicht als Messwert zitiert werden, bevor es geklärt ist.
- Trifft es auch die Blattebenen-Dekomposition (`FUNC -compose-> FUNC` tiefer unten), oder nur
  Blöcke ohne io? Falls nur letztere: Option A ist exakt zielgenau.

## Abgrenzung

Kein graphcode-lokaler Fix möglich: `metrics` kommt aus `@sigloch/se-engine`, die Änderung ist
Familie-Sache (Version-Bump, Drift-Lock L2). Dieser Draft ist die Vorlage für dieses Review,
kein Implementierungs-CR.
