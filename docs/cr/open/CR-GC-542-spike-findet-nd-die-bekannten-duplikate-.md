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

---

# ERGEBNIS (2026-09-16, `scripts/spike-nd-known-answer.mjs`)

**Empfehlung: NO-GO fuer die Scharfschaltung.** Nicht weil ND zu viel meldet, sondern weil es
in sechs von sieben Familiengraphen GAR NICHTS meldet — und die vier belegten Faelle
prinzipiell nicht sehen kann. Der Hebel liegt woanders (siehe „Was statt dessen").

## Korrektur am eigenen CR-Text

Die Praemisse oben war falsch. `0,5·Name + 0,5·Beschreibung`, Schwelle 0,55, ist der
REQ/UC-**Hinweis** in graphcodes `nd-similarity.ts` — nicht die Regel. ND-01 rechnet in
contracts `similarity.ts`:

    ND-01 = 0,35·descr + 0,25·Verb + 0,25·io-Topologie + 0,15·REQ-Ueberlappung
    ND-02 = 0,50·Felder + 0,30·descr + 0,20·Verwendung

Damit faellt Kandidat F3a („Nachbarschaft") als Vorschlag weg: er steckt mit 40 % schon drin.

## Die eine Tabelle

| Fall | zwei Knoten da? | ND-01 (synth.) | Code am realRef | gefunden von … |
|---|---|---:|---:|---|
| F1 ueber Paketgrenze, gleiches Repo | **nein** | 46,4 % | 41,4 % | **niemandem** |
| F2 ueber REPO-Grenze, 51 Tage (CR-GC-103) | **nein** | 42,9 % | 10,4 % | **niemandem** |
| F3 innerhalb EINES Pakets, zwei Dateien | **nein** | 40,0 % | 26,8 % | **niemandem** |
| F4 Kontrolle, zeichengleich | **nein** | 65,0 % | 86,7 % | Code |

`synth.` = die Knoten gibt es nicht; die Zahl ist ein Wenn-dann aus echtem Symbolnamen und
echtem Dateikopf. Wo „zwei Knoten da?" nein sagt, ist die Schwelle gegenstandslos: ND kann
den Fall auch bei 0,0 nicht melden.

**F1 — nein, das Mass findet sie nicht.** Aber der Grund ist nicht die Schwelle und nicht die
Formel: **4 von 4 Faellen haben nicht einmal zwei Knoten im selben Graphen.** Die Gegenprobe
ist der Beleg — zwei zeichengleiche `jaccard` kommen synthetisch auf 65 %, weil die Regel
Beschreibung und Topologie wiegt, nicht den Code. Nur die Code-Aehnlichkeit am `realRef`
(86,7 %) haette sie erkannt.

**F2 — die Reichweite ist die Wand.** ND-01/ND-02 laufen je Graph. sigloch-modules modelliert
graph-api-core als EINEN MOD-Knoten mit null FUNC, also fehlt bei F1/F2 die Gegenseite
komplett. Ein familienweiter Lauf waere konstruierbar, brachte aber nichts, solange die
Gegenseite nicht modelliert ist.

**F3 — Bodensatz und Bindung.**
- `jaccard(∅,∅) = 1`: zwei FUNC ohne io- und ohne satisfy-Kante bekommen 0,40 geschenkt, ohne
  ein einziges gemeinsames Wort. Mit gleichem ersten Wort stehen sie bei 0,65. Gemessen tragen
  20 von 120 FUNC in graphcode keine io-Kante, in moneyflow 106 von 306. Das ist ein
  Fehlalarm-Generator an genau den Knoten, die am wenigsten aussagen.
- Bindung (gleicher `realRef.symbol` in verschiedenen Dateien): 169 gebundene Knoten,
  136 Symbolnamen, **0 Kollisionen**. Als Duplikat-Fuehler ueber den Bestand: nutzlos.
- Code am `realRef` ist der einzige Kandidat, der die Kontrolle besteht (86,7 %) — und der
  einzige, der den Graphen verlaesst.

**F4 — Fehlalarme.** Bei Schwelle 0,85 ueber sieben Graphen: **16 Befunde, alle in moneyflow**
(306 FUNC, Code-Import ohne Wozu-Ebene). In den sechs governten Graphen: 0 Befunde, auch bei
0,70. Von den 16 sind 14 echte Mehrfach-Implementierungen (`handleSubmit` 6×,
`makeMockGraphService` 3×) und 2 Fehlalarme (`calcConfidence`, `groundingCheck` — Testfunktion
gegen gleichnamige Produktionsfunktion; genau die von SourcererCC belegte Klasse).

Die Scharfschaltung wuerde also in sechs Repos nichts aendern und in einem 16 `error` erzeugen,
von denen 14 richtig sind. Das ist kein schlechtes Verhaeltnis — aber es betrifft ausgerechnet
den Graphen, der keine Wozu-Ebene hat, und keinen der drei Faelle, wegen derer der Spike lief.

**F5 — der legitime Decorator.** Unbeantwortet gelassen, weil gegenstandslos: eine Regel, die
den Fall nicht sehen kann, braucht keinen Ausgang fuer ihn. Faellt wieder an, sobald ein Mass
existiert, das F2 findet.

## Was statt dessen — die Deckung

| Repo | exportierte Funktionen | exakt gebunden | Deckung | obere Schranke | Bindungsquote |
|---|---:|---:|---:|---:|---:|
| graphcode | 217 | 47 | **21,7 %** | 40,6 % | 82,5 % |
| sigloch-modules | 126 | 7 | **5,6 %** | 7,9 % | 72,7 % |
| bok | 114 | 7 | **6,1 %** | 10,5 % | 46,7 % |
| graph-view-edit | 99 | 6 | **6,1 %** | 8,1 % | 92,3 % |

Die letzten beiden Spalten messen Gegenrichtungen. Die **Bindungsquote** (CLAUDE.md) sagt:
wie gut haengt das Modellierte am Code. Die **Deckung** sagt: wie viel Code kennt das Modell
ueberhaupt nicht. graph-view-edit hat 92,3 % Bindung bei 6,1 % Deckung — beides gleichzeitig
wahr, und nur die zweite Zahl erklaert, warum kein Duplikat auffiel.

Alle sieben RC-Regeln pruefen **Modell → Code** („loest der realRef auf?"). **Keine prueft
Code → Modell** („hat diese Funktion einen Knoten?"). `importCoverage` ist der Praezedenzfall
fuer die ehrliche Messung — aber auf Datei-Ebene und nur fuer RC-05.

Damit ist die Frage beantwortet, die hinter dem Spike stand: das Modell findet die Duplikate
nicht, weil es sie nicht kennt. Nicht wegen der Formel, nicht wegen der Schwelle.

## Folge

- ND-01/ND-02 bleiben in `notInGate`. Keine Aenderung an contracts. Kein Folge-CR dort.
- Die Deckungs-Luecke geht als Item in den Store (Code → Modell als Messung, nicht als Gate).
- `scripts/spike-nd-known-answer.mjs` bleibt liegen: er ist wiederholbar und misst die
  Deckung mit. Wird die Deckung besser, sagt derselbe Lauf, ob ND dann etwas findet.
