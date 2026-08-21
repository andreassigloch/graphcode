# CR-GC-388 — Den Harness schneiden

**Status:** done · **Angelegt:** 2026-08-21 · **Abgeschlossen:** 2026-08-21 · **Basis:** CR-GC-387 (Messung), CLAUDE.md (500-Zeilen-Grenze)

## Problem

`src/harness.ts` hat 776 Zeilen und 22 öffentliche Methoden. Seit CR-GC-387 trägt die Datei 14
FUNC-Knoten, und damit sagt das Gate selbst, was vorher nur die Zeilenzahl sagte:

| Regel | Meldung |
|---|---|
| R-04 | MOD-harness has 14 functions and 32 crossing flows (split recommended) |
| RD-04 | 14 allocated FUNC children on one level (>11) |
| MT-02 | LCOM4=5 — 14 FUNCs in 5 disconnected groups |

`LCOM4=5` ist deterministisch gerechnet, aber es sagt etwas anderes als „fünf Zuständigkeiten".

**Wie die Zahl entsteht** (`moduleMetrics`, `@sigloch/contracts/se/metric-rules.ts`): Union-Find über
die einem MOD zugeteilten FUNC, zwei Durchgänge — (1) zwei FUNC sind verbunden, wenn sie ein
gemeinsames Ausgangsziel haben (derselbe FLOW als Ausgang oder dieselbe erfüllte REQ), (2) zusätzlich,
wenn sie denselben FLOW in *irgendeiner* Richtung berühren. LCOM4 ist die Zahl der Komponenten.
Reihenfolgeunabhängig, kein Schwellenwert, kein Modell — dieselbe Eingabe liefert immer dieselbe Zahl.

**Was die Eingabe ist:** der modellierte Graph, nicht der Quelltext. Gelesen werden `allocate`, `io`
und `satisfy` — keine Felder, keine Aufrufe, keine Imports von `harness.ts`. Die Zahl ist also so gut
wie die modellierten FLOWs; ein fehlender FLOW erfindet eine Trennung, ein zu grober verdeckt eine.

**Die tatsächlichen Komponenten** (Stand nach CR-GC-387) sind kein Fünferschnitt, sondern ein Klumpen
plus vier Einzelgänger:

| Komponente | FUNC |
|---|---|
| 1 (10) | claim-store-lock, close-store, evaluate-rules, import, load-graph, mutate, open-store, reseed, save-graph, seed-from-json |
| 2 (1) | check-code-conformance |
| 3 (1) | list-elements |
| 4 (1) | migrate-schema |
| 5 (1) | score-completeness |

Dazu `cohesion`: 6 interne gegen 35 externe Verbindungen (Ratio 0,15). Die Metrik sagt damit
„zusammenhanglos genug, um hinzusehen" — **wo** geschnitten wird, sagt sie nicht.

## Warum das die Testauswahl deckelt

70 von 109 Testdateien importieren `src/harness.ts`, aber alle 70 nur, um `initialize()` zu rufen.
Für die selektive Auswahl (SPIKE-GC-selective-tests, M2) heißt das: jede Änderung an irgendeiner
Harness-Zuständigkeit sieht wie eine Änderung an allen aus. Deshalb weist CR-GC-387 den Recall
zweimal aus — 37 % gesamt, 42 % ohne diese eine Datei.

**Nachtrag nach der Umsetzung:** dieser Deckel bleibt. Der Schnitt entlang der Kohäsions-Komponenten
lässt `initialize`/`close` im Sammler — sie hängen über `FLOW-graph-state` und `REQ-single-kuzu-owner`
am Gate, sind also genau *keine* eigene Komponente. Der Aufsetz-Import der 70 Tests zeigt weiter auf
`harness.ts`; M2 bleibt bei 36 % gesamt gegen 42 % ohne den Hub. Wer diesen Deckel heben will, muss
den Lebenszyklus gegen die Messung herausziehen — das wäre ein Schnitt aus einem anderen Argument.

## Umgesetzt: der Schnitt, den der Algorithmus hergibt

**Betreiberentscheidung 2026-08-21:** streng nach den Komponenten schneiden, mindestens zwei Module,
und der große Klumpen ist dann eben der Sammler. Kein aus dem Quelltext erfundener Fünferschnitt.

Die vier Nicht-Sammler-Komponenten sind aus `MOD-harness` heraus:

| Komponente | neues MOD | Realisierung |
|---|---|---|
| list-elements | `MOD-element-slice` | **neu: `src/element-slice.ts`** (aus `harness.ts` herausgelöst) |
| check-code-conformance | `MOD-conformance` | `src/conformance.ts` (lag schon dort, war nur falsch zugeteilt) |
| score-completeness | `MOD-completeness` | `external: true` — realisiert in `@sigloch/graphcode-client` |
| migrate-schema | `MOD-schema-migration` | `concept: true` — modelliert, noch nicht realisiert |

`MOD-harness` bleibt der Sammler mit den verbliebenen zehn: claim-store-lock, close-store,
evaluate-rules, import, load-graph, mutate, open-store, reseed, save-graph, seed-from-json.

**Ergebnis am Gate** (graphVersion 133 → 134):

| | vorher | nachher |
|---|---|---|
| MT-02 | LCOM4=5 (14 FUNC, 5 Gruppen) | **LCOM4=1** — kein Befund mehr |
| RD-04 | 14 Kinder auf einer Ebene | **weg** (10) |
| R-04 | 14 functions and 32 crossing flows (*split recommended*) | 10 functions and 27 crossing flows (*high coupling*) |

Der verbliebene R-04-Befund ist die ehrliche Restaussage: der Sammler ist nicht mehr zu groß, aber
weiterhin stark gekoppelt (27 kreuzende Flüsse, Kohäsion 6 intern gegen 32 extern).

**Code:** nur `listElements` ist gewandert — samt der fünf Aufrufstellen
(`src/tools/read.ts`, `src/viewer/host.ts` ×2, zwei Tests). Die Methode am Harness ist **gelöscht**,
keine Delegation, kein Parallelpfad. `src/harness.ts` steht damit bei **759 Zeilen** und bleibt über
der 500-Zeilen-Grenze: die Kohäsions-Komponenten geben keinen weiteren Schnitt her, den die Messung
stützt. Wer die Zeilenzahl senken will, braucht ein anderes Argument als LCOM4 — und einen eigenen CR.

## Weitere Dateien über der Grenze

`src/executor.ts` (1136), `src/scaffold-templates.ts` (641), `src/viewer/help-content.ts` (638),
`src/tools/write.ts` (527), `src/scaffold.ts` (508). Nicht Teil dieses CR — hier zuerst der Harness,
weil an ihm die Messung hängt.

## Akzeptanzkriterien

- [x] Schnitt streng entlang der LCOM4-Komponenten, ≥ 2 MOD, Sammler benannt
- [x] Jede herausgelöste FUNC trägt `realRef` auf ihr neues Zuhause; R-02/R-22/R-30/R-31 steigen nicht
- [x] MT-02 und RD-04 an `MOD-harness` sind weg; R-04 nur noch als Kopplungs-, nicht als Größenbefund
- [x] `harness.listElements` gelöscht, alle fünf Aufrufer auf das neue Modul umgestellt
- [x] `npm run build` grün, `npm test` grün
- [x] `scripts/test-selection-audit.mjs` nach dem Schnitt: M1 52 %, M2 36 %, M8 56 %

**Offen und bewusst nicht erledigt:** `src/harness.ts` bleibt mit 759 Zeilen über der
500-Zeilen-Grenze (s. o.), und die übrigen Überschreiter (`executor.ts` 1136,
`scaffold-templates.ts` 641, `viewer/help-content.ts` 638, `tools/write.ts` 527, `scaffold.ts` 508)
werden jetzt nicht refaktoriert.

@author andreas@siglochconsulting
