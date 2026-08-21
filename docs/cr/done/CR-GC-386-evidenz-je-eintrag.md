# CR-GC-386 — Evidenz je Eintrag: der Ingest stempelt alle Dateien einer Abnahme

**Status:** done · **Angelegt:** 2026-08-21 · **Geschlossen:** 2026-08-21 · **Gefunden beim Einspielen des eigenen Laufs (CR-GC-385)**

## Root Cause

`graph_test_ingest` baute **ein Kommando je Zuordnung**, alle aus dem Zustand VOR dem Batch — und
`testRefs` ist ein Array-Attribut, das als Ganzes ersetzt wird. Eine Abnahme aus zwei Dateien bekam
damit zwei Kommandos, jedes gebaut aus den ungestempelten Original-Einträgen; das zweite überschrieb
den Stempel des ersten.

## Impact

Der Lauf war grün, die Evidenz für eine der beiden Dateien blieb verschwunden, und VR-01 meldete sie
dauerhaft als `pending` — ein Zustand, den kein weiterer Lauf reparieren konnte, weil jeder Lauf
denselben Weg nahm. Gemessen am eigenen Graphen: `TEST-prompt-provenance` trägt zwei Dateien
(`audit.origin`, `hooks.prompt-relay`), beide liefen grün, gestempelt wurde eine.

Das trifft genau die Abnahmen, für die 1:n überhaupt eingeführt wurde (CR-SM-231: eine Abnahme, die
real Unit- und Visual-Lauf mischt) — also die, bei denen „einer rot, einer grün" darstellbar sein soll.

## Fix

| Datei | Was |
|---|---|
| `src/tools/testreport.ts` | Zuordnungen je Knoten gruppiert, **ein** `update-node` je Abnahme, jeder passende Eintrag mit seinem eigenen Ergebnis |
| `tests/testreport.test.ts` | Fall: eine Abnahme, zwei Dateien, ein Lauf mit `passed` und `failed` — beide Einträge tragen ihr eigenes Ergebnis |
| diese CR-Datei | |

Rot-zuerst belegt: mit der alten Ein-Kommando-je-Zuordnung fällt der neue Fall (1 rot / 10 grün).

## Nachtrag am eigenen Graphen

Der verlorene Stempel wurde per Gate-Mutation nachgetragen (`TEST-prompt-provenance`, beide Einträge
`passed`). Der laufende MCP-Server trägt weiterhin den alten Build — bis zu seinem Neustart würde
sein Ingest den Fehler wiederholen.

## Akzeptanzkriterien

- [x] Eine Abnahme mit n Dateien bekommt n Ergebnisse aus einem Lauf
- [x] Rot-zuerst per Mutation belegt
- [x] Kein Eintrag mit Bindung ohne Ergebnis mehr im eigenen Graphen (VR-01 nur noch für `TEST-distribution`, das real rot ist)
- [x] Gesamtsuite 851/852 — einzige Rotstelle bleibt der Vorbestand `tests/distribution.test.ts`
      (`@sigloch/graph-view-edit@^0.6.0` ist nicht publiziert, npm kennt nur bis 0.5.0)

@author andreas@siglochconsulting
