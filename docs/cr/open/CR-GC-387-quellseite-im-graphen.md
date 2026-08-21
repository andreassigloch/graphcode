# CR-GC-387 — Die Quellseite in den Graphen (nach dem Host-Neustart)

**Status:** open · **Angelegt:** 2026-08-21 · **Basis:** SPIKE-GC-selective-tests M1/M9, CR-GC-385

## Problem

Die Testseite steht (109/109, CR-GC-385). Die Quellseite nicht: **19 von 65 Quelldateien** tragen
einen Knoten. Damit deckelt sich alles, was daran hängt:

| | heute | mit vollständiger Quellseite |
|---|---|---|
| Auswahl-Recall (M2) | 30 % | Ziel ≥ 60 % (Falsifikationskriterium, Spike §6) |
| Ersparnis über 60 Commits (M8) | 52 % | 73 % |
| Code-Commits, bei denen die Auswahl überhaupt greift | 2 von 21 | alle |

Eine Änderung an `src/cli.ts`, `src/executor.ts`, `src/hooks.ts` oder 43 weiteren Dateien fällt
weiterhin in den Volllauf — nicht weil die Auswahl schlecht rät, sondern weil sie nichts zu fragen hat.

## Warum das nicht „realRef nachtragen" ist

Eine FUNC trägt seit CR-GC-366 **vier Pflichten**: eine REQ erfüllen (R-02), io-verdrahtet sein
(R-31), in einer Wirkkette hängen (R-30), in einem MOD wohnen (R-22). Der Bestand zeigt, dass schon
die vorhandenen 83 FUNC diese Pflichten nur teilweise erfüllen:

```
R-02  FUNC must satisfy REQ                 34
R-22  FUNC must be allocated to MOD          3
R-30  FUNC leaf must belong to a chain      44
R-31  FUNC must be wired (io in + out)      55
```

46 neue FUNC naiv anzulegen hieße, diese Zahlen zu verdoppeln — Modellierungsschulden gegen eine
Kennzahl eintauschen. Der Weg muss deshalb messen, bevor er modelliert.

## Vorbedingung: Host-Neustart

Der laufende MCP-Server trägt den Build von **vor** CR-GC-384/386 und einen Speicher-Graphen aus
derselben Zeit. Vor dem ersten Batch dieses CR:

```bash
# Server beenden, dann neu starten — Build und Speicher passen danach zum Store
graphcode mcp
```

Ohne das schreibt sein `graph_export` wieder Doppelkanten (CR-GC-384) und sein `graph_test_ingest`
verliert bei einer Abnahme aus zwei Dateien den zweiten Stempel (CR-GC-386).

## Schritte

1. **Grobe Ebene neu messen.** CR-GC-382 hat `MOD.path` gesetzt, gemessen und wieder ausgebaut:
   100 ausgewählte Läufe für 3 von 20 richtigen Treffern. Der Befund hing aber an der damals
   **unverankerten Testseite** — die MOD-Ebene zeigte auf die wenigen Abnahmen, die es zufällig gab.
   Diese Bedingung ist seit CR-GC-385 weg. Also: `path` auf `MOD-mcp-tools`/`MOD-docs`/
   `MOD-dashboard` setzen, `node scripts/test-selection-audit.mjs` laufen lassen, Recall vergleichen,
   und **wieder ausbauen, wenn er nicht steigt**. Drei Gate-Mutationen, eine Messung.
2. **Danach entscheiden**, nicht vorher: trägt die grobe Ebene, deckt sie den Baum für 11 Mutationen
   ab. Trägt sie nicht, bleibt nur die feine — dann Schritt 3.
3. **Feine Ebene in Batches**, je Modul und je Batch mit den vier Pflichten statt nur mit `realRef`.
   Reihenfolge nach Nutzen: die Dateien, die in den letzten 60 Commits am häufigsten geändert
   wurden, zuerst — sie bestimmen den realen Ertrag, nicht die Vollständigkeit.
4. **Gegen das Falsifikationskriterium messen.** Bleibt der Recall unter 60 %, trägt der Weg
   `Datei → REQ → TEST` nicht, und die Verdrahtung unterbleibt — so steht es im Spike, und daran
   ändert dieser CR nichts.

## Nicht in diesem CR

- **Keine Verdrahtung.** `npm test` bleibt der Volllauf, CI unverändert. Die Entscheidung fällt nach
  Schritt 4 anhand der Zahl, nicht nach Gefühl.
- **Keine Sanierung der bestehenden R-30/R-31-Schuld.** Die 44 + 55 Befunde sind älter als dieses
  Thema und gehören in einen eigenen Zug; hier zählt nur, dass neue FUNC sie nicht vermehren.

## Akzeptanzkriterien

- [ ] Host neu gestartet, Build und Speicher passen zum Store (Doppelkanten- und Ingest-Fix aktiv)
- [ ] Grobe Ebene auf der verankerten Testseite gemessen — Ergebnis dokumentiert, egal wie es ausfällt
- [ ] Jede neue FUNC erfüllt die vier Pflichten; R-02/R-22/R-30/R-31 steigen nicht
- [ ] `scripts/test-selection-audit.mjs` vor und nach jedem Batch, Zahlen im CR
- [ ] Entscheidung zur Verdrahtung erst nach der Recall-Messung

@author andreas@siglochconsulting
