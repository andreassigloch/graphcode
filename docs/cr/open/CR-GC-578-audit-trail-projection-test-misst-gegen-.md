# CR-GC-578: Der Trail-Test behauptet eine Quote gegen eine Datei, die er nicht kontrolliert

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-420 (bug)
**Erstellt:** 2026-09-21
**Item:** bok/items/ITEM-2026-420.json (Lane: graph)

---

## 1 Befund

`tests/audit.trail-projection.test.ts`, Fall „a default answer over the repo trail is ~89 %
smaller than the raw records", ist am 2026-09-21 rot geworden:

```
20.8 KB projected vs 165.2 KB raw: expected 21268 to be less than 18610.13
```

**Ohne jede Codeaenderung.** Nachgewiesen: derselbe Lauf mit `src/` auf HEAD ist identisch rot.
Der Test liest die **lebende** `.graphcode/audit.jsonl` des Repos, nimmt deren letzte 50
Eintraege und vergleicht gegen eine absolute Schwelle von 11 %. Heute sind es 12,6 %.

Die Datei wird fortgeschrieben, waehrend die Suite laeuft — in diesem Fall von einer zweiten
Claude-Code-Sitzung, die am selben Repo arbeitet. Das Ergebnis des Tests haengt damit davon ab,
was zufaellig in den letzten 50 Operationen stand.

## 2 Der Test weiss das bereits

Sein eigener Docstring sagt es:

> „before CR-GC-346 the same threshold read 13.6 % here and 10.3 % one session earlier, i.e.
> it went red from batch width alone"

und misst drei gleitende Fenster mit 4,2 % / 8,2 % / 5,5 %. Die Streuung ist dokumentiert, die
Schwelle blieb trotzdem absolut. Das ist kein Versehen, sondern eine bewusste Entscheidung,
die sich jetzt eingeloest hat.

**Die Schwelle anzuheben ist verboten** — der Docstring sagt auch warum: „loosening a threshold
until a test passes is how a suite learns a regression." Das gilt weiter.

## 3 Zug

Die Zusage bleibt, der Traeger wechselt. Der Fall am echten Trail **misst und berichtet**, er
urteilt nicht mehr:

- Er rechnet die Quote weiter aus und schreibt sie in die Testausgabe — die Messung auf echten
  Daten ist wertvoll und soll nicht verschwinden.
- Er prueft nur noch, was unabhaengig vom Inhalt gilt: die Projektion ist kleiner als das
  Rohmaterial, und die schweren Felder (`context`, `candidate_targets`) sind weg.

Das Urteil traegt der **synthetische Gegencheck**, der schon danebensteht. Er hat ein bekanntes
Fettverhaeltnis und faellt, sobald die Projektion schlechter wird — unabhaengig davon, wie der
lokale Trail heute aussieht. Der Docstring nennt ihn bereits „the trail-independent half of the
size promise"; nach diesem Zug traegt er sie ganz.

**Nicht gewaehlt: eine Stichprobe einchecken.** Der Docstring lehnt das mit einem guten Grund ab
(„would freeze the very ratio being measured"), und er bleibt richtig.

## 4 Akzeptanzkriterien

1. Kein Testfall behauptet eine Schwelle gegen `.graphcode/audit.jsonl`.
2. Die Quote auf echten Daten steht weiterhin in der Testausgabe.
3. Der synthetische Fall behaelt seine 11 % unveraendert — die Zusage wird nicht gelockert,
   nur an die Stelle gehaengt, die sie halten kann.
4. Ein Lauf bei laufender Zweitsitzung ist gruen; zweimal hintereinander, mit Mutationen dazwischen.

## 5 Der allgemeine Fall

Wenn ein Test gegen `.graphcode/` misst, misst er gegen einen Zustand, den eine andere Sitzung
aendert. Ein Grep, ob es weitere solche Faelle gibt, gehoert in diesen Zug — sonst ist der
naechste rote Lauf wieder eine halbe Stunde Diagnose.
