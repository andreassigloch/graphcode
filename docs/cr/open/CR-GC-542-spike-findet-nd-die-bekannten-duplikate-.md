# CR-GC-542: SPIKE: findet ND die bekannten Duplikate? Known-Answer-Test gegen drei belegte Paare des Zuges 2026-09-16, bevor ND-01/02 aus notInGate ins Gate wandern

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-211 (idea)
**Erstellt:** 2026-09-16
**Item:** bok/items/ITEM-2026-211.json (Lane: code)

---

SPIKE, kein Feature. Ergebnis ist eine ZAHL und eine Empfehlung, kein scharfgeschaltetes Gate.
ND-01/ND-02 bleiben bis dahin in `notInGate` — genau da, wo sie heute stehen.

## Warum erst messen

ND-01/ND-02 stehen als `severity: error` im Katalog und blocken trotzdem nie: sie liegen in
`catalogs.notInGate` (gemessen am laufenden Host, 2026-09-16). Der naheliegende Schluss
„dann schalten wir sie scharf" ist falsch, und der Zug 2026-09-16 zeigt warum.

WAS ND HEUTE MISST: `0.5·jaccard(tokens(name)) + 0.5·jaccard(tokens(beschreibung))`,
Schwelle 0,85 (contracts `similarity.ts` / `near-duplicate-rules.ts`). ND-01 auf FUNC,
ND-02 auf SCHEMA.

WAS DER ZUG GEFUNDEN HAT: drei Duplikate, alle mit VERSCHIEDENEN Namen und Beschreibungen
bei gleichem Verhalten. Das Mass misst die BESCHRIFTUNG, der Befund ist das VERHALTEN. Eine
andere Schwelle aendert daran nichts.

Dazu zwei Reichweiten-Grenzen: ND vergleicht innerhalb EINES Graphen, zwei der drei Paare
lagen ueber Repo-Grenzen — und sigloch-modules modelliert Format-E mit NULL Knoten, ein
Duplikat gegen Nichts kann keine Aehnlichkeitsregel finden.

Eine `error`-Regel, die Fehlalarme wirft, wird abgeschaltet und ist dann schlechter als keine.

## Die Grundwahrheit: drei belegte Paare

Alle drei sind dokumentiert, datiert und inzwischen aufgeloest — also ein echter
Known-Answer-Set (wie `scripts/known-answer-set.mjs` ihn fuer andere Fragen fuehrt):

| # | Paar | war Duplikat bis | Besonderheit |
|---|---|---|---|
| 1 | contracts Format-E-Parser/Serializer vs. graph-api-core `format-e-codec` | CR-SM-331 | ueber Paketgrenze, gleiches Repo |
| 2 | graphcode `GraphCodeCodec.encode` vs. `FormatECodec.serialize` | CR-GC-536 | ueber REPO-Grenze, 51 Tage alt (CR-GC-103: 27.07. bis 16.09.) |
| 3 | `chainsByFunc`: Kennzahl vs. R-21 | CR-SM-335 | innerhalb EINER Datei |

Und ein vierter Fall als Gegenprobe fuer das Mass: `tokens`/`jaccard` lagen ZEICHENGLEICH in
graphcode und contracts (CR-GC-488). Wenn ein Kandidat DIESEN nicht findet, misst er nichts.

WICHTIG — Fall 2 ist der lehrreiche: er war bei der Geburt KEIN Duplikat. CR-GC-103 hat einen
Decorator gebaut, der drei Zusicherungen hinzufuegte, die der Basis-Codec nicht hatte. Er WURDE
erst eines, als graph-api-core sie bekam. Ein Mechanismus, der nur bei der Entstehung schaut,
kann diese Klasse prinzipiell nicht fangen — deshalb ueberhaupt ND und nicht eine Deklaration.

## Die fuenf Fragen

**F1 — Findet das heutige Mass die drei Paare?** Aehnlichkeit fuer jedes Paar ausrechnen und
gegen 0,85 halten. ERWARTUNG: deutlich darunter. Der Spike belegt oder widerlegt, dass nicht
die Schwelle das Problem ist, sondern das Mass.

**F2 — Reichweite.** Kann ND ueber Repo-Grenzen ueberhaupt vergleichen? Heute laeuft es je
Graph. Falls nein: ist ein familienweiter Vergleich konstruierbar (ein Lauf ueber alle
`docs/graph/*.graph.json`), und was kostet er? Ohne diese Antwort faellt Paar 2 — das
teuerste der drei — grundsaetzlich durchs Raster.

**F3 — Bessere Masse, an denselben vier Faellen gemessen.** Mindestens zwei Kandidaten,
Ergebnis je Fall als Zahl, nicht als Argument:

  a) **Nachbarschaft** — gleiche Ein-/Ausgaenge (SCHEMA/FLOW-Kanten). Ein Codec-Fork traegt
     dieselben Vertraege an den Raendern, egal wie er heisst.
  b) **Bindung** — `realRef`-Symbole mit gleichem exportierten Namen in verschiedenen Paketen.
     Haette Fall 4 sofort gefunden, Fall 2 vermutlich nicht.
  c) **Code am realRef** — Aehnlichkeit der referenzierten Datei bzw. des Symbols. Verlaesst
     den Graphen; CR-GC-488 ist der Beleg, dass es getragen haette. Ehrlich mitmessen, auch
     wenn es unbequem ist: eine Regel, die nur im Modell schaut, findet Fall 2 nie.

**F4 — Fehlalarm-Rate.** Jeder Kandidat gegen die 758 Knoten des graphcode-Modells. Wie viele
Paare meldet er, die KEINE Duplikate sind? Das ist die Zahl, an der die Scharfschaltung
scheitert oder nicht.

**F5 — Der legitime Decorator.** Fall 2 war monatelang richtig. Braucht ND einen Ausgang
„benannt und befristet" (CLAUDE.md: verboten ist nicht die Differenz, verboten ist die
unbenannte)? Wenn ja: wo lebt diese Notiz — am Knoten, im Item-Store, im CR?

## Abnahme

Fertig, wenn EINE Tabelle dasteht: je Kandidat mal je Fall die Aehnlichkeitszahl, plus die
Fehlalarm-Zahl auf dem echten Modell. Daraus folgt eine Empfehlung mit drei zulaessigen
Ausgaengen — scharf schalten (mit Schwelle), als `info` ohne Block fahren, oder No-Go mit
Begruendung. Alle drei sind erlaubte Ergebnisse; ein Spike, der nur einen Ausgang haben darf,
ist keiner.

NICHT Teil dieses CR: irgendeine Aenderung an contracts. ND bleibt in `notInGate`. Wandert es
spaeter ins Gate, ist das ein eigener CR in sigloch-modules mit Version-Bump.

DATEIEN: ein Spike-Skript (`scripts/spike-nd-*.mjs`) oder ein `tests/*.spike.test.ts` nach dem
Muster der vorhandenen Spikes, plus die Ergebnistabelle hier im CR. Kein Produktionscode.
