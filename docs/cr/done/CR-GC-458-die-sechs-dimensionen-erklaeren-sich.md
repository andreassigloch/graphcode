# CR-GC-458 — Die sechs Zieldimensionen erklären sich, wie jede Regel es tut

**Status:** **done** — 2026-09-02 · **Angelegt:** 2026-09-02 · **Herkunft:** Review graph-view-edit 30.08.26,
Punkte 3 + 5, zweite Runde — „das versteht ja sonst keiner, aber der Assistent redet ja permanent
darüber, also müssen wir Messung, Purpose und Stellhebel erklären."

## Problem

`modifiability`, `faultTolerance`, `flowEfficiency`, `coherence`, `viability`, `scalability`
entscheiden über jede `graph_suggest`-Empfehlung, stehen im Zielprofil, im Fit-Advisory jedes
Gate-Verdikts und seit CR-GC-451 als Ist-Vektor in `graph_metrics`. Der Assistent nennt sie in
jedem zweiten Satz.

Im Hilfe-Katalog kommen sie **nicht vor**. `HELP_CONTENT` kennt jede Regel, jedes Gate, jedes
Artefakt; `HELP_VOCAB` kennt jeden Element- und Trace-Typ. `graph_help({ token: 'coherence' })`
antwortet heute:

```
graph_help: unknown token 'coherence'.
```

Damit gibt es für die sechs Begriffe, die die Steuerung tragen, **keine Quelle** — und ein
Konsument, der sie trotzdem erklären will (das gve-Dashboard braucht sie im Mouseover), schreibt
seine eigenen Texte. Das ist dieselbe zweite Quelle, die bei Regeltexten bewusst vermieden wird
(`fetchRuleHelp` in gve holt jeden Regeltext vom Host, statt ihn zu formulieren).

Zweiter Teil des Befunds: die drei Fragen, die an einer Kennzahl hängen, sind **nicht dieselben**
wie bei einer Regel. Eine Regel sagt „was ist kaputt → tu das". Eine Kennzahl beantwortet drei
getrennte Fragen, und wer nur eine davon beantwortet, hilft nicht:

- **Messung** — was zählt die Zahl eigentlich?
- **Zweck** — warum will man sie hoch (oder niedrig)?
- **Stellhebel** — was bewegt sie?

## Änderung

### 1. Ein Kennzahl-Katalog neben dem Regel-Katalog

`help-content.ts` bekommt `METRIC_HELP`, gekeyt auf die Dimensionsnamen, mit genau diesen drei
Feldern plus dem umgangssprachlichen Titel:

```ts
export interface MetricHelpEntry {
  title: string;    // Alltagsbegriff — „Zusammenhalt", nicht „coherence"
  measure: string;  // was gezählt wird, in der Formelsprache der Engine
  purpose: string;  // wofür der Wert steht
  lever: string;    // was ihn bewegt
}
```

Eigene Konstante statt drei optionaler Felder in `HelpContentEntry`: die Fragen sind andere, und
ein Regeleintrag mit drei leeren Kennzahl-Feldern wäre ein Schema, das für die Mehrheit seiner
Einträge nicht gilt. Es bleibt **eine** Datei und **ein** Zugriffspunkt (`helpEntry`).

Die Texte sind aus `metrics.ts` (`@sigloch/se-engine`) abgeleitet, nicht erfunden — `measure`
nennt die Formel, die dort steht, in Worten.

### 2. `helpEntry` kennt die Art `metric`

`HelpEntry` bekommt `kind: 'metric'` und die drei Felder (optional, nur dort gesetzt). `plain` und
`se` bleiben belegt — `plain` als ein Satz, `se` als Formel —, damit jeder bestehende Konsument
unverändert weiterläuft; gve's `fetchRuleHelp` etwa behält heute nur `title`/`plain`/`prompt`.

`prompt` ist `se:target-profile`: die eine Aktion, die aus dem Verständnis einer Zieldimension
folgt, ist das Setzen ihres Ziels.

### 3. Ein unbekannter Token nennt die neue Art mit

Der Fehlertext von `graph_help` listet die gültigen Token-Klassen auf. Eine Klasse, die er nicht
nennt, findet niemand.

## Dateien (5)

- `src/surface/help-content.ts` — `METRIC_HELP` + `MetricHelpEntry`
- `src/surface/help.ts` — `kind: 'metric'`, die drei Felder, der Dispatch-Zweig
- `src/projections/report.ts` — `graph_help`-Beschreibung und Fehlertext nennen die Kennzahlen
- `tests/help-content.test.ts` — Abdeckung gegen `METRIC_DIMENSIONS`, kein Hand-Count
- `docs/cr/done/CR-GC-458-die-sechs-dimensionen-erklaeren-sich.md`

## Akzeptanz

1. `graph_help({ token: 'coherence' })` liefert einen Eintrag mit `kind: 'metric'` und drei
   nicht-leeren Feldern `measure` / `purpose` / `lever`. Rot vorher (`unknown token`).
2. Die Abdeckung wird gegen `METRIC_DIMENSIONS` aus `@sigloch/se-engine` geprüft, nicht gegen eine
   Liste im Test: eine siebte Dimension in der Engine lässt den Test fallen, ohne dass ihn jemand
   anfasst.
3. Jeder Kennzahl-Eintrag trägt zusätzlich `plain` und `se` — kein bestehender Konsument, der nur
   diese beiden liest, sieht ein leeres Feld.
4. Die bestehenden Token-Arten (Regel, Gate, Panel, Artefakt, Vokabel) antworten unverändert; die
   Abdeckungstests aus CR-GC-227 bleiben grün.
