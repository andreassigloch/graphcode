# CR-GC-387 — Die Quellseite in den Graphen (nach dem Host-Neustart)

**Status:** done · **Angelegt:** 2026-08-21 · **Abgeschlossen:** 2026-08-21 · **Basis:** SPIKE-GC-selective-tests M1/M9, CR-GC-385

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

## Ergebnis

Alle Modelländerungen durchs Gate (graphVersion 131 → 133), kein `.ts` angefasst.

| Messpunkt | M1 Quellseite | M2 Recall | M2 Auswahl | M8 Ersparnis |
|---|---|---|---|---|
| Ausgangslage | 19/65 (29 %) | 39/132 (30 %) | 95 | 52 % |
| nach grober Ebene (Schritt 1) | 31/65 (48 %) | 49/144 (34 %) | 302 | 53 % |
| nach Harness-API (Schritt 2) | 31/65 (48 %) | 51/144 (35 %) | 308 | 55 % |
| nach Batch 1 (Schritt 3) | 33/65 (51 %) | 54/147 (37 %) | 322 | 58 % |

Regel-Bilanz gegen die Ausgangslage: **R-02 34, R-22 3, R-30 44, R-31 55 — unverändert.** Neun neue
FUNC, kein einziger neuer Befund dieser vier Regeln; Fehler-Verstöße bleiben bei 148. IO-01 sinkt von
5 auf 4. Neu sind je ein R-04- und RD-04-Befund an `MOD-harness` (14 Funktionen, 32 kreuzende
Flüsse) — der Befund selbst ist das Ergebnis, siehe unten.

### Schritt 1 — grobe Ebene: getragen, behalten

`path` auf `MOD-mcp-tools` (`src/tools`), `MOD-dashboard` (`src/viewer`), `MOD-docs` (`src/views`).
Auf den 12 so aufgelösten Dateien: **10 von 12** gekoppelten Tests getroffen, Kosten 207 ausgewählte
Dateiläufe. CR-GC-382 traf mit derselben Mechanik 3 von 20 — der Unterschied ist ausschließlich die
seit CR-GC-385 verankerte Testseite. Die grobe Ebene rät nicht mehr falsch, sie wählt zu viel.
Über-Auswahl kostet Zeit, Unter-Auswahl kostet einen grünen Lauf ohne Test: behalten.

### Schritt 2 — publizierte Harness-API modelliert

`GraphCodeHarness` ist in `src/index.ts` exportiert, seine Methoden sind damit publizierte API und
gehören modelliert — unabhängig von jeder Kennzahl. Fünf Verhaltensmethoden mit den vier Pflichten:
`initialize`, `close`, `loadGraph`, `seedFromJson`, `listElements`. Dazu `FLOW-element-slice`
(SCHEMA-gebunden) und die Kante `FLOW-impact-subgraph -io-> FUNC-graph-expand`, die die
progressive Vertiefung an ihre Quelle bindet (behebt einen IO-01-Befund).

**Nicht modelliert: die Zustands-Getter** (`getGraph`, `getStore`, `getScope`, `getRepoRoot`,
`getHooks`, `getGraphcodeConfig`, `getMetricPolicy`, `getFocusThreshold`). `getGraph` wird von 38
Testdateien gerufen — ein Knoten dort hätte den Recall gehoben. Ein Feldzugriff ohne Fluss ist aber
kein Verhalten; wer ihn modelliert, modelliert auf die Kennzahl hin.

### Der Befund: `src/harness.ts` ist ein God-Object, und das Modell sagt es jetzt

`src/harness.ts` trägt 69 der 147 gekoppelten Tests und trifft davon 21. Die Messung, was diese 70
Testdateien am Harness tatsächlich aufrufen:

| Methode | Testdateien | modelliert |
|---|---|---|
| `initialize` | 70 | ja (neu) |
| `close` | 67 | ja (neu) |
| `getGraph` | 38 | nein (Getter) |
| `mutate` / `importGraph` | je 28 | ja |
| `evaluateRules` | 11 | ja |

Jede dieser 70 Dateien ruft `initialize()` — Aufsetzen, nicht Prüfgegenstand. Das Orakel „Test
importiert Datei" zählt bei einem Hub das Aufsetzen als Kopplung. Deshalb wird M2 ab hier **zweimal**
ausgewiesen: **37 % gesamt, 42 % ohne `src/harness.ts`**.

Das Gate hat den Rest selbst gesagt: mit den fünf neuen FUNC meldet **R-04** „MOD-harness has 14
functions and 32 crossing flows (split recommended)", **RD-04** 14 Kinder auf einer Ebene, **MT-02**
LCOM4=5. 776 Zeilen bei einem 500-Zeilen-Limit. Die Auflösung ist der Schnitt, nicht das Modell —
→ **CR-GC-388**.

### Schritt 3 — feine Ebene, Batch 1

Modelliert: `src/store-lock.ts` (`StoreLock`, dazu `SCHEMA-lock-owner` + `FLOW-store-ownership`) und
`src/session-lifecycle.ts` (`SessionLifecycle`). Beide treffen exakt: 3 von 3 gekoppelten Tests bei
14 ausgewählten Dateiläufen.

**Nicht modelliert — und das ist ein Befund, kein Rest:** `src/status.ts`, `src/cli.ts` und
`src/scaffold-templates.ts` gehören zu einem Use Case, den das Modell nicht hat. `graphcode
init|upgrade|status|mcp` ist der Betrieb der Harness in einem fremden Repo; dafür existiert weder UC
noch FCHAIN. Der Versuch, `FUNC-read-repo-status` in `FCHAIN-live-update` zu hängen, quittierte das
Gate mit IO-01 („no FLOW path to FUNC-broadcast-diff") — die Kette ist die falsche. Ein UC
nachzuziehen ist kein Nebenschritt: UC-01/UC-02 sind **error**, ein neuer UC braucht ACTOR, mindestens
eine REQ und über R-01 deren verifizierenden TEST. Eigener CR.

Dieselbe Lücke deckelt `FUNC-harness-cli` und `FUNC-upgrade`, die heute in keiner Kette hängen
(R-30). Sie ist also älter als dieser CR und größer als die drei Dateien.

### Schritt 4 — Entscheidung zur Verdrahtung

**Noch nicht verdrahten.** `npm test` bleibt der Volllauf, CI unverändert. Begründung: 37 % Recall
gesamt / 42 % ohne Hub liegen unter dem Falsifikationskriterium von 60 %, und die verbleibende Lücke
sitzt nachweisbar in zwei Ursachen, die beide nicht „mehr Knoten" heißen — dem God-Object
(CR-GC-388) und dem fehlenden Betriebs-UC. Die Ersparnis wuchs trotzdem von 52 % auf **58 %**; die
Decke bei vollständiger Quellseite liegt bei 76 %.

## Akzeptanzkriterien

- [x] Host neu gestartet, Build und Speicher passen zum Store (Doppelkanten- und Ingest-Fix aktiv)
- [x] Grobe Ebene auf der verankerten Testseite gemessen — Ergebnis dokumentiert, egal wie es ausfällt
- [x] Jede neue FUNC erfüllt die vier Pflichten; R-02/R-22/R-30/R-31 steigen nicht
- [x] `scripts/test-selection-audit.mjs` vor und nach jedem Batch, Zahlen im CR
- [x] Entscheidung zur Verdrahtung erst nach der Recall-Messung

@author andreas@siglochconsulting
