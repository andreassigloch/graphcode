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

`LCOM4=5` ist die eigentliche Aussage: die Klasse zerfällt in fünf Gruppen, die einander nicht
berühren — fünf Zuständigkeiten in einer Datei.

## Warum das die Testauswahl deckelt

70 von 109 Testdateien importieren `src/harness.ts`, aber alle 70 nur, um `initialize()` zu rufen.
Für die selektive Auswahl (SPIKE-GC-selective-tests, M2) heißt das: jede Änderung an irgendeiner
Harness-Zuständigkeit sieht wie eine Änderung an allen aus. Deshalb weist CR-GC-387 den Recall
zweimal aus — 37 % gesamt, 42 % ohne diese eine Datei.

Nach einem Schnitt zeigt der Aufsetz-Import auf ein Lebenszyklus-Modul statt auf den ganzen Harness,
und die Auswahl folgt dem Schnitt, ohne dass am Messgerät gedreht wird.

## Schnittvorschlag (Ausgangspunkt, nicht Beschluss)

Die fünf LCOM4-Gruppen sind der Kandidat für die Grenzen:

1. **Lebenszyklus** — `initialize`, `close`, Store-Lock-Anbindung, Schema-Drift-Erkennung
2. **Gate** — `mutate`, `evaluateRules`, Hook-Aufrufe, `persist`
3. **Lesen** — `impact`, `subgraph`, `listElements`, `testImpact`, `getGraph`, `loadGraph`
4. **Import/Reseed** — `importGraph`, `seedFromJson`, `reseed`
5. **Zugriffe** — die Getter (`getStore`, `getScope`, `getRepoRoot` …); Kandidat für eine
   schmale Kontext-Struktur statt einer Methode je Feld

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
