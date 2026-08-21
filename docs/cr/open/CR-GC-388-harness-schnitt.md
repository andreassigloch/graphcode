# CR-GC-388 — Den Harness schneiden

**Status:** open · **Angelegt:** 2026-08-21 · **Basis:** CR-GC-387 (Messung), CLAUDE.md (500-Zeilen-Grenze)

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

Nach einem Schnitt zeigt der Aufsetz-Import auf ein Lebenszyklus-Modul statt auf den ganzen Harness,
und die Auswahl folgt dem Schnitt, ohne dass am Messgerät gedreht wird.

## Schnittvorschlag (aus dem Quelltext gelesen, nicht aus der Metrik)

Die Metrik liefert keine Grenzen (s. o.), nur den Anlass. Dieser Vorschlag kommt aus dem Lesen der
776 Zeilen und ist der Ausgangspunkt für die Diskussion, kein Beschluss:

1. **Lebenszyklus** — `initialize`, `close`, Store-Lock-Anbindung, Schema-Drift-Erkennung
2. **Gate** — `mutate`, `evaluateRules`, Hook-Aufrufe, `persist`
3. **Lesen** — `impact`, `subgraph`, `listElements`, `testImpact`, `getGraph`, `loadGraph`
4. **Import/Reseed** — `importGraph`, `seedFromJson`, `reseed`
5. **Zugriffe** — die Getter (`getStore`, `getScope`, `getRepoRoot` …); Kandidat für eine
   schmale Kontext-Struktur statt einer Methode je Feld

Ob der Schnitt trägt, zeigt die Metrik danach: der Zehner-Klumpen muss in mehrere MOD zerfallen,
sonst wurde nur die Datei geteilt und nicht die Zuständigkeit.

Die öffentliche Fassade `GraphCodeHarness` bleibt bestehen (sie ist in `src/index.ts` exportierte
API) und delegiert — keine parallelen Pfade, kein zweiter Einstieg.

## Weitere Dateien über der Grenze

`src/executor.ts` (1136), `src/scaffold-templates.ts` (641), `src/viewer/help-content.ts` (638),
`src/tools/write.ts` (527), `src/scaffold.ts` (508). Nicht Teil dieses CR — hier zuerst der Harness,
weil an ihm die Messung hängt.

## Akzeptanzkriterien

- [ ] Keine Quelldatei des Harness-Schnitts über 500 Zeilen
- [ ] `GraphCodeHarness` bleibt als Fassade erhalten, alle bestehenden Aufrufer unverändert
- [ ] Die 14 FUNC-Knoten zeigen per `realRef` auf die neuen Dateien, R-02/R-22/R-30/R-31 steigen nicht
- [ ] R-04/RD-04 an `MOD-harness` sind weg (oder auf die neuen MOD verteilt und je unter der Schwelle)
- [ ] `npm test` grün, `npm run build` grün
- [ ] `scripts/test-selection-audit.mjs` vor und nach dem Schnitt — M2 gesamt und ohne Hub

@author andreas@siglochconsulting
