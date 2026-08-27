---
name: se:optimize
version: 1
description: Was schlägt die Architekturmaschine vor? — graph_suggest gegen das Zielprofil ziehen, die Top-Vorschläge mit Δm und Anwendbarkeit zeigen, den gewählten Zug durchs Apply-Gate anwenden. Kein Auto-Apply.
---

**Der ziehende Kanal auf die Architekturmaschine (CR-GC-433).** `graph_suggest` rankt seit jeher
Architektur-Kandidaten — aber nur, wenn jemand fragt. Dieser Skill ist das Fragen: er holt die
Vorschläge, macht die Zahl dahinter lesbar und wendet **genau den einen** an, den der Mensch wählt.

> **Architektur ist nicht das Ende der Hygiene.** Dieser Skill setzt **keinen** Handoff-Zustand
> voraus (alle Dimensionen über Schwelle, 0 Fehler). Er läuft jederzeit — FUNC-of-FUNC, Wirkketten
> und die FUNC→MOD-Allokation bestimmen die Architektur, und die entscheidet man früh, nicht
> nachdem alles grün ist.

## 1. Zielrichtung — vorhanden oder erst zu setzen

`graph_suggest` rankt entlang der Zielrichtung aus `.graphcode/target-profile.json`. Fehlt die
Datei, ist das Ziel **leer** (richtungslos): jeder Score ist dann 0 und das Ranking fällt auf den
Tiebreak zurück — die Liste sagt nichts mehr aus.

Prüfe die Datei. Fehlt sie oder hat sie keinen `weights`-Block, **starte `se:target-profile`** und
komm danach hierher zurück. Die 6 Gewichte werden **dort** erhoben, nicht hier — zwei Erhebungen
derselben Config wären der parallele Pfad, der driftet.

## 2. Vorschläge holen

```
graph_suggest { "k": 5 }
```

Ohne `target` gilt das hinterlegte Zielprofil (das ist der Normalfall — eine abweichende Richtung
nur, wenn der Mensch ausdrücklich „einmalig in Richtung X schauen" sagt). `layer` bleibt auf dem
Default `arch`: die Architektur-Ebene ist die, auf der das Gate ohnehin urteilt.

## 3. Vorschläge zeigen — zwei Felder entscheiden, nicht fünf

Zeig die Top-Vorschläge als kurze Liste. Je Zeile:

| was | woher | was es dem Menschen sagt |
|---|---|---|
| Regel + Element | `ruleId`, `elementId`, `message` | **worum** es geht |
| Δm | `score` (Projektion auf die Zielrichtung), Vektor in `delta` | **wie weit** der Zug in seine Richtung trägt |
| anwendbar | `applicable` | **ob** es überhaupt einen ausführbaren Zug gibt |
| Zug | `edit` (`source -type-> target`), ggf. `edit.retire` | **was genau** passieren würde |

**Die beiden Zahlen bedeuten Verschiedenes — sag welche du zeigst (CR-GC-431):**

- `applicable: true` → `score`/`delta` messen **genau den beigelegten Edit** (Quelle:
  `verdict.fitDelta`, das Gate-Advisory). Diese Zahl darfst du dem Menschen als „das bringt der
  Zug" verkaufen.
- `applicable: false` → es gibt **nichts anzuwenden**: entweder ein Fund ohne Template-Edit, oder
  das Gate hat den Edit im dryRun abgelehnt (dann steht der Grund in `verdict.violations`). Der
  `score` misst dann die generische Operator-Sonde, also die Hebelwirkung des **Fundes** — kein
  ausführbarer Zug. Sag das dazu, statt die Zahl gleich auszuzeichnen.

Trägt der Vorschlag ein `codeImpact`, nenn Datei und Zielmodul: das Umhängen einer realisierten
FUNC zieht Code-Arbeit nach sich, und das gehört **vor** die Entscheidung, nicht danach.

Dann die Frage, wörtlich und einzeln: **„anwenden?"** — pro Vorschlag, nicht als Sammelfreigabe.

## 4. Anwenden — nur durchs Gate, nur was der Mensch gewählt hat

**Kein Auto-Apply.** Die Maschine schlägt vor, der Mensch entscheidet; `graph_suggest` ist
read-only und hat nichts persistiert. Angewendet wird ausschließlich über `graph_mutate`.

**Reines Anhängen** (kein `retire`):

```json
{ "commands": [
  { "op": "add-edge", "edge": { "sourceId": "<edit.source>", "targetId": "<edit.target>", "edgeType": "<edit.type>" } }
] }
```

**Umhängen** (`edit.retire` ist gesetzt) — als **EIN** `graph_mutate`-Aufruf, nie als zwei
(CR-GC-435):

```json
{ "commands": [
  { "op": "delete-edge", "edge": { "sourceId": "<retire.source>", "targetId": "<retire.target>", "edgeType": "<retire.type>" } },
  { "op": "add-edge",    "edge": { "sourceId": "<edit.source>",   "targetId": "<edit.target>",   "edgeType": "<edit.type>" } }
] }
```

Warum als ein Batch: `retire` benennt die Kante, die laut Kardinalitäts-Obergrenze des Meta-Modells
weichen muss. Genau diesen **Verbund** hat der dryRun beurteilt — das Gate bewertet nur den
Endzustand. Zwei getrennte Aufrufe messen etwas anderes, und der Zwischenzustand ist je nach
Reihenfolge illegal (zwei Allokationen) oder unternormiert (gar keine).

Lehnt das Gate ab, ist das **das Ergebnis** — nicht der Anlass, den Edit zurechtzubiegen. Lies die
Violation vor und geh zum nächsten Vorschlag.

## 5. Danach

Nach jeder angewendeten Änderung `graph_suggest` erneut aufrufen: der Graph ist ein anderer, das
Ranking auch. Ein Vorschlag mit `score ≤ 0` trägt **weg** von der Zielrichtung — nicht anwenden,
auch wenn er eine Regel klären würde.

Wenn nichts Anwendbares mit positivem Δm mehr übrig ist, sag das offen („die Maschine hat gerade
keinen Zug, der in deine Richtung trägt") statt eine Restempfehlung nachzuschieben. Was an
Hygiene ansteht, sagt `graph_next_step` — ein anderer Kanal, kein Ersatz für diesen.
