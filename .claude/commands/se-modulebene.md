---
name: se-modulebene
version: 0
description: Entwurf — die oberste Modulebene auf Vereinfachung prüfen. Liest Linienstärke je Modulpaar, Fremdkörper je Modul, die Kopplung der Akteure und Lücken an den Funktionen, jeweils mit Gegenprobe im Funktionsbaum und im Code. Trennt Modellfehler von Optimierungen. Optimierungen gehen in fester Form an se:optimize. Wendet nichts an.
---

# se-modulebene — wo lässt sich die oberste Ebene vereinfachen

## Wofür dieser Skill da ist

Du prüfst die Module direkt unter dem SYS: welche Linie, welche Funktion, welcher Fluss ist zu viel
oder liegt falsch. Du lieferst zwei Listen: **Modellfehler** (das Modell sagt etwas, das der Code
nicht tut) und **Vorschläge** (das Modell stimmt, die Struktur lässt sich vereinfachen).

**Modellfehler zuerst.** Ein Vorschlag auf einem falschen Modell misst das Falsche. Am
2026-10-21 hing der einzige Antwortweg der eigenen Ketten an einer Kante, die es im Code nicht gab
(CR-GC-823).

**Zwei Bäume.** `MOD` ist der Abhängigkeitsbaum, `FUNC` der Wertbaum. Sie spiegeln sich nicht.
Jeder Befund im Modulbaum bekommt die Gegenprobe im Funktionsbaum, bevor er ein Vorschlag wird.

**Du rechnest keine Kennzahl selbst.** Die Zahlen kommen aus `rules_get_violations`,
`graph_metrics` und den Kanten. Eine Zahl ist die Länge einer Liste oder ein zitierter Wert.

---

## 1. Ausgangsstand festhalten

```
graph_readiness()                          # steer.score, steer.terms, graphVersion
graph_metrics()                            # modules[]: cohesion, fanIn, fanOut, uphillDependencies
rules_get_violations({ detail: "grouped" })   # CR-01, R-04, BW-02, R-31
```

Merk dir `graphVersion`, `steer.score` und je MOD `cohesion.ratio`. Jeder spätere Zug wird daran gemessen.

## 2. Linienstärke je Modulpaar

Die Linie zwischen zwei Modulen ist so dick wie die Zahl der Verträge, die sie kreuzen. `CR-01`
nennt je Paar ab drei Verträgen den Wert; der Viewer zeigt dieselbe Zahl als `data-count` an der Linie.

- **Dünne Linien zuerst.** Ein Vertrag, der eine ganze Modulkante trägt, ist der billigste Zug.
- **Die Richtung ist kein Signal.** Antworten fließen immer zurück. Nur die Anzahl zählt.
- **Ist die dünne Linie gewollt?** Lies `realRef` der Funktion (`graph_context`) und prüf im Code,
  wer die Datei importiert. Die Werkzeug-Bindung an `bind-tools` ist gewollt.

## 3. Fremdkörper im Modul

Je Funktion an einer dünnen Linie:

1. Unter welchem Wertblock steht sie im Funktionsbaum? Unter welchem stehen ihre Modulnachbarn?
2. Wo liegen ihre Geschwister im Funktionsbaum?
3. Passt das Zielmodul zu seiner Beschreibung? `surface` ist „Adapter ohne eigene Logik".
4. Was importiert ihre Datei? Ein Umzug nach `kernel` setzt voraus, dass sie keinen Client importiert.

Beispiel: `decode` war die einzige Grounding-Funktion in `loop`; ihre Geschwister `import`, `reseed`,
`merge-nodes` lagen in `kernel`, und die Datei importierte nur Fremdpakete (ITEM-2026-984).

## 4. Kopplung der Akteure

```
graph_get_edges({ uid: "<ACTOR>", edgeType: "io" })
```

Je Fluss des Akteurs: welche Funktion erzeugt oder empfängt ihn, in welchem Modul liegt sie?

- Im Code erreicht der Auftraggeber das System über MCP, CLI und Host-Socket. Eine Antwort im Aufruf,
  die direkt aus `kernel`, `projections` oder `loop` an den Akteur geht, ist ein **Modellfehler**.
- Eine Datei auf Platte (Snapshot, Views, Messzeile) darf direkt enden.
- Im Funktionsbaum ist die direkte Kopplung richtig: jeder Wertblock zeigt, was er liefert. Im
  Modulbaum täuscht sie Abhängigkeiten vor.

## 5. Wirkketten zu kurz?

Lies je Kette `answerPath` und `answerPathBlockedBy` aus `graph_metrics`. Ein Antwortweg, der nur
über eine Kante aus Schritt 4 entsteht, ist kein Beleg. Endet eine Kette am Akteur ohne das Glied,
das die Antwort im Code trägt, ist das ein Modellfehler.

## 6. Funktion ohne Eingang oder Ausgang?

Der Viewer bündelt beide Richtungen zu einem zugeklappten Modul in eine Linie. Zähl deshalb erst
die Kanten (`graph_get_edges({ uid: "<FUNC>", edgeType: "io" })`). Dann prüf Eingang und Ausgang
gegen die Signatur im Code. Beispiel: `computeMarks(violations)` bekam im Modell den ganzen Graphen.

## 7. Flüsse mit vielen Abnehmern

Ein Fluss mit sehr vielen Abnehmern hängt sich an fast jede Kette. Prüf im Code, ob alle
Abnehmer dasselbe bekommen, und zwar je Symbol aus `realRef`, nicht je Datei: zwei Funktionen
teilen sich oft eine Datei. Lesen und Schreiben sind zwei Flüsse, auch mit demselben Vertrag.

Eine Teilung mit demselben SCHEMA bewegt keine Kennzahl, denn `R-04`, `BW-02` und `CR-01`
zählen Verträge. Sie lohnt nur, wenn die Abnehmer im Code wirklich Verschiedenes bekommen.
Beispiel: `FLOW-graph-state` hat über 20 Abnehmer, aber nur `apply` hält den Store; alle anderen
lesen denselben Wert `store.current()`. Der Fluss ist richtig (ITEM-2026-989).

---

## 8. Ergebnis

**Modellfehler** gehen in einen eigenen CR, vor jedem Vorschlag: je Fehler die Kante, der Beleg im
Code, die Korrektur. Der CR misst die Kennzahlen aus Schritt 1 davor und danach.

**Vorschläge** in der festen Form für `se:optimize`:

| Zweck | Kette | Ort | Handlungsklasse | Prognose | Preis |
|---|---|---|---|---|---|
| Linie loop–surface von 3 auf 2 Verträge | die Ketten durch die Funktion (`functions[].chains`) | FUNC-decode in MOD-loop | Verschieben nach MOD-kernel | loop–surface und loop–kernel je ein Vertrag weniger; der Funktionsbaum bleibt | Datei und Importe wandern; kernel bekommt eine Funktion mehr bei Kohäsion <Wert aus Schritt 1> |

Handlungsklassen: **Verschieben** (Funktion in ein anderes Modul), **Teilen** (ein Fluss wird zwei),
**Zusammenlegen** (zwei Module werden eins; nur mit gemessener Kohäsion davor und danach).

**Du wendest nichts an.** `se:optimize` probt jeden Vorschlag per Trockenlauf; Anwenden und
Nachmessen gehören dem CR des Umbaus.

## Abschluss-Prüfliste

- [ ] Ausgangsstand mit `graphVersion` festgehalten
- [ ] Modellfehler und Vorschläge getrennt, Modellfehler zuerst
- [ ] jeder Befund mit Gegenprobe im Funktionsbaum und Beleg im Code
- [ ] keine Kennzahl selbst gerechnet, jeder Wert zitiert
- [ ] jeder Vorschlag mit sechs Angaben, nichts angewandt
