---
name: se-umbau
version: 1
description: Bestehendes ändern, ersetzen, entfernen — graph_impact und graph_tests VOR dem Löschzug, Modell-Zug im selben CR. Bei „entfernen", „ersetzen", „refactoren", „keine parallelen Pfade". Neues anlegen: se:author-req.
---

# se-umbau — was bricht, steht im Graphen, nicht im Testlauf

## Wofür dieser Skill da ist

Ein neuer Knoten bricht nichts. Ein **entfernter** schon. Der Umbau ist die einzige Lage, in der
ein übersehener Impact teuer wird — und die einzige, für die die Hausregel „keine parallelen
Pfade" überhaupt geschrieben ist.

**Gemessen am Referenz-Change vom 2026-09-23** (`rig/referenz-change/`, CR-GC-630/631): 0
Graph-Leseaufrufe, 27 Suchoperationen, 3 volle Testläufe à 5 Minuten. Die Gegenprobe sagt, was
die vier Fragen unten geantwortet hätten: **4 Testdateien statt 172**, und die 20 Kanten an den
zwei Knoten, deren Bindung der Löschzug brach. Gefunden hat sie stattdessen die Testsuite, 300
Sekunden später.

Dieser Skill ist die Reihenfolge, die dort teuer nachgeholt wurde.

---

## 1. Umfang benennen — welche Knoten hängen an den Dateien?

```
graph_elements({ search: "<Dateiname ohne Endung>" })
```

Die Bindung heißt `realRef`. Eine Datei ohne Knoten ist kein Freibrief, sondern ein blinder
Fleck: die abgeleitete Testspur fällt dann still auf die volle Suite zurück und meldet grün,
**weil sie weniger gesehen hat**.

## 2. `graph_impact` — VOR der ersten Löschung

```
graph_impact("<uid>")      # für JEDEN Knoten aus Schritt 1
```

Lies die Kanten, nicht die Zahl. Drei davon sind Stoppschilder:

| Kante | Was sie bedeutet |
|---|---|
| `X -satisfy-> REQ` | Nach dem Löschen steht diese REQ unerfüllt da — RD-01, und bei fehlendem verify auch R-01. |
| `realRef` am Knoten | Zeigt nach dem Löschen ins Leere — **RC-01**. Die volle Suite meldet das erst nach Minuten. |
| `FCHAIN -compose-> X` | Die Wirkkette verliert ein Glied und beschreibt danach etwas, das es nicht gibt. |

Wer hier nicht liest, erfährt dasselbe später vom Testlauf — nur ohne die Liste, was zu tun ist.

## 3. `graph_tests` — die Spur fahren, nicht die Suite

```
graph_tests({ changeSet: ["src/…", "tests/…"] })
```

Die volle Suite ist der **Riegel vor dem Schließen des CR**, kein Suchwerkzeug. Lies die
Bindungsquote mit: fällt die Auswahl auf VOLL zurück, sagt sie warum, und das ist selbst ein
Befund.

## 4. Der Modell-Zug gehört in denselben CR

Nach dem Löschen im Code ist das Modell **falsch**, nicht veraltet. Der Zug geht durchs Gate
(`graph_mutate`, nie an der JSON-Datei):

- Knoten, dessen Code weg ist → löschen, **nachdem** seine `satisfy`-Kanten einen neuen Erfüller
  haben. Beides in EINEM Batch, sonst blockt das Gate zurecht.
- Knoten, dessen Code umgezogen ist → `realRef` umhängen, `allocate` auf das neue MOD prüfen.
- `dryRun: true` zuerst. Das Verdict nennt die Regelverstöße, bevor irgendetwas persistiert.

**„Fertig" heißt kongruent oder benannt.** Eine Abweichung, die im CR steht, ist erlaubt; eine
unbenannte ist der Fehler.

## 5. VOLL erst als Riegel

Einmal, vor dem Schließen. Nicht dreimal als Suchlauf.

---

## Die zwei Fallen, die dieser Umbau wirklich gestellt hat

**Ein Test, der die gelöschte Datei behauptet.** `tests/test-selection.audit.test.ts` sicherte die
Testauswahl für eine Datei zu, die verschwand. Er wurde nicht rot — die Auswahl fiel auf VOLL
zurück und war formal „vollständig". Grep nach dem alten Pfad **in den Tests**, nicht nur in
`src/`.

**Der Ersatz ist oft selbst ein zweiter Pfad.** Nach dem Löschen eines Lesers braucht der
Aufrufer einen neuen — und der naheliegende ist ein eigener. Genau das passierte in CR-GC-631,
und CR-GC-632 musste es zurücknehmen. Die Frage lautet nicht „wie lese ich das hier?", sondern
„wer liest es schon, und kann ich den rufen?".

Prüfbar gemacht: `tests/engpass-ein-leser.test.ts` führt die benannten Engpässe und ihre
erlaubten Aufrufer. Wer einen neuen Aufrufer einträgt, begründet ihn im CR.

**Warum kein Ähnlichkeitsmaß hilft:** an sieben belegten Paaren gemessen (CR-GC-637) erreicht
keines die ND-Schwelle — Name-Jaccard 0,000, Rumpf-Jaccard 0,03–0,41. Ein zweiter Pfad ist dem
ersten nie ähnlich; er ist kürzer, anders benannt und kann weniger. Gemeinsam ist der **Eingang**.

---

## Abschluss-Prüfliste

- [ ] `graph_impact` für jeden Knoten am Umfang gelesen, **vor** der Löschung
- [ ] Testspur aus `graph_tests`, VOLL nur als Riegel
- [ ] alter Pfad gelöscht — kein „deprecated, funktioniert aber noch"
- [ ] `grep` nach dem alten Namen in `src/` **und** `tests/`
- [ ] Modell-Zug im selben CR, durchs Gate, RC-* sauber oder Abweichung benannt
- [ ] ausgeworfene Zeilen im CR beziffert
