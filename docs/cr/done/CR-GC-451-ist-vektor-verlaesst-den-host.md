# CR-GC-451 — Der Ist-Vektor verlässt den Host

**Status:** **done** — 2026-08-30 · **Angelegt:** 2026-08-30
**Herkunft:** Review graph-view-edit 30.08.26, Punkte 2 + 3 (Dashboard-Karten „Hält der Bauplan?"
und „Was die Maschine dazu sagt")

## Problem

Das gve-Dashboard zeigt beim Zielprofil **die Zielrichtung und sonst nichts** — und schreibt das
auch ehrlich an:

> „Den Ist-Wert je Dimension liefert derzeit kein graphcode-Tool — gezeigt wird die Zielrichtung,
> nichts wird erfunden."

Der Satz stimmt, und genau das ist der Befund. Gerechnet wird der Ist-Vektor längst:
`metrics(G, { layer: 'arch' })` aus `@sigloch/se-engine` liefert alle sechs Dimensionen
(`modifiability`, `faultTolerance`, `flowEfficiency`, `coherence`, `viability`, `scalability`), und
`fit-advisory.ts` bewertet damit **jeden** Zug, den `graph_suggest` vorschlägt. Der Wert entscheidet
also bereits über Empfehlungen — er kommt nur nie an die Oberfläche.

Zwei Folgen im Dashboard, beide vom Auftraggeber gemeldet:

1. **Ziel ohne Ist ohne Trend.** Man sieht, wohin es gehen soll, nicht wo man ist und nicht, ob
   man sich darauf zubewegt.
2. **Die Kohäsions-Karte sieht doppelt aus.** Sie zeichnet *eine* Zahl aus `graph_metrics`
   (intern/extern je MOD); R-04 in den Architektur-Befunden ist die **Regelform derselben
   Messung**. Von sechs gerechneten Dimensionen wird eine gezeichnet — „entweder alle oder keine",
   und das ist der richtige Einwand.

Nachrechnen in gve ist ausgeschlossen: das ist die Grenze aus CR-GVE-257 und die Lehre aus
CR-GC-402 (der Host besitzt die Zahlen). Also muss der Host sie herausgeben.

## Änderung

`graph_metrics` bekommt neben `modules` ein Feld `fit`:

```
fit: {
  layer: 'arch',
  metrics: { modifiability, faultTolerance, flowEfficiency, coherence, viability, scalability },
  target: { weights: {...}, source: 'profile' | 'none' },
}
```

- `metrics` = **genau** `metrics(toOntologyGraph(graph), { layer: 'arch' })` — dieselbe Funktion,
  aus der `fit-advisory` seine Δm rechnet. Keine zweite Rechnung, kein zweiter Layer.
- `target` = das geladene Zielprofil (`.graphcode/target-profile.json`) bzw. `source: 'none'`.
  Wert und Zielmarke verlassen den Host **zusammen** — dieselbe Regel wie `policy`/`policySource`
  bei den Modulzahlen (CR-GC-329): ein Konsument, der eine eigene Zielmarke hält, ist eine zweite
  Quelle für dieselbe Zahl.
- `layer: 'arch'` steht mit im Ergebnis. Der Wert ist nicht der globale `metrics(G)`; wer ihn
  vergleicht, muss wissen, worauf.

**Kein neuer Toolname.** `graph_metrics` ist schon „die Architektur-Kennzahlen" — ein zweites Tool
daneben wäre eine zweite Adresse für dieselbe Frage. Der Größen-Guard von `metrics.ts` (CR-GC-256
§6) bleibt eingehalten: die Datei liegt weit unter 500 Zeilen.

### Verlauf (Punkt 3: „ich sehe keinen Trend / keine Konvergenz")

Nicht in diesem CR, und mit Absicht: der Verlauf ist eine **History**-Frage. gve misst die
Commit-Stände heute schon selbst (`measureGraphHistory`, CR-GC-410) und lässt jeden Stand durch
`fromOntologyGraph` + Engine laufen. Sobald `fit` existiert, kann derselbe Lauf denselben Vektor je
Stand mitnehmen — das ist eine gve-Änderung, kein Host-Tool. Sie hängt nur an diesem CR.

## Dateien

- `src/projections/metrics.ts` — `fit` im Ergebnis, Binding auf `metrics()` + `loadTargetProfile`
- `tests/metrics.test.ts` — `fit.metrics` ist bit-identisch zu `metrics(G, {layer:'arch'})`
- `docs/` — Tool-Beschreibung nachziehen (`graph_metrics` nennt jetzt beides)

## Akzeptanz

1. `graph_metrics` liefert `fit.metrics` mit allen sechs Dimensionen.
2. Der Wert ist **identisch** mit dem, den `fit-advisory` für seine Δm benutzt — der Test vergleicht
   beide Aufrufe, nicht nur das Schema. Sonst zeigt das Dashboard eine Zahl, auf der das Ranking
   nicht sitzt.
3. Ohne Zielprofil: `target.source === 'none'`, `weights` leer — kein erfundener Nullvektor.
4. Read-only, wie der Rest von `graph_metrics`.

## Folge-CR in graph-view-edit (blockiert durch diesen)

**Eine** Karte „Hält der Bauplan?" statt heute zwei, Vorschlag für das Layout:

```
Hält der Bauplan?                                    (graph_metrics · Zielprofil)

  Dimension               Ist          Ziel      seit 20 Ständen
  ─────────────────────────────────────────────────────────────
  Zusammenhalt        ███████░░░  3.4    ↑ heben     3.1 → 3.4  ▲
  Änderbarkeit        █████░░░░░  2.6    ↑ heben     2.9 → 2.6  ▼
  Robustheit          ████░░░░░░  1.9    – neutral   1.9 → 1.9  ·
  Flusseffizienz      ██████░░░░  3.0    – neutral   …
  Tragfähigkeit       █████████░  4.5    – neutral   …
  Skalierbarkeit      ███░░░░░░░  1.4    ↓ senken    …

  Wo es klemmt (Kohäsion je Modul, worst first)
    MOD-skills     ▓▓▓▓▓▓▓▓▓▓░░  0 % intern     25 Funktionen
    MOD-harness    ▓▓▓░░░░░░░░░  10 % intern    15 Funktionen
    → R-04 meldet dazu 2 Befunde                      (Mouseover erklärt R-04)
```

Drei Regeln, die daraus folgen:

- **Alle sechs oder keine.** Kohäsion ist eine Zeile in „wo es klemmt", keine eigene Karte.
- **Ist, Ziel und Verlauf in EINER Zeile** — die Frage „bewege ich mich darauf zu?" ist genau der
  Vergleich dieser drei, und getrennt aufgestellt beantwortet sie niemand.
- **Der Befund gehört an die Zahl**, nicht in eine zweite Tabelle: R-04 ist die Regelform der
  Kohäsion, nicht ein davon unabhängiger Fund.

---

## Umsetzung (2026-08-30)

**Die Identität ist strukturell, nicht nur getestet.** `fit-advisory.ts` hatte die Messung in einem
privaten `measure()` eingeschlossen; sie ist jetzt `archMetrics(graph)` und wird von beiden Seiten
benutzt — es gibt keine zwei Aufrufe von `metrics(…, {layer:'arch'})`, zwischen denen etwas
driften könnte. Der Test beweist es ohne eigene Rechnung: das Advisory einer Nullmutation
(`before === after`) trägt als `before` exakt den Vektor, den das Tool herausgibt. Ersetzt man
`archMetrics` durch einen zweiten `metrics()`-Aufruf auf dem Default-Layer, wird er rot — geprüft.

`fit.graphVersion` ist gestrichen: das Ergebnis trägt sie schon auf oberster Ebene, ein zweites
Feld wäre eine zweite Quelle für dieselbe Zahl.

### Nebenbefund: die Fixture war älter als die Regel

`tests/metrics.test.ts` war **vor** diesem CR rot (5/5) — nicht wegen ihm. Unter contracts 10.0.0
verlangt **R-18** für jeden FLOW genau eine `relation` auf ein SCHEMA, und die Fixture aus
CR-GC-326 kennt die Regel nicht. Repariert mit einem geteilten `SCHEMA-c`; die Modulzahlen bleiben
unberührt (FLOW→SCHEMA berührt weder `fan_in`/`fan_out` eines MOD noch seine Kohäsion), alle fünf
Alt-Zusagen bleiben unverändert grün.

**Das ist eine Klasse, keine Einzelstelle.** Vor diesem CR: 21 rote Tests in 11 Dateien, nach ihm
16 in 10 — die Differenz sind genau die fünf reparierten, dazu vier neue grüne. Die übrigen 16
stammen aus derselben contracts-10-Umstellung (R-18-Fixtures, Steering-Kausalität) sowie aus dem
Link-Modus (`distribution`, `lockfile-sync`). Sie gehören in einen eigenen CR — hier wurde nur
repariert, was diesen CR verifizierbar macht.
