# CR-GC-716: steuerung.mjs auf Claude-Code-Sitzungs-Transcripts: Navigation zaehlt Schreib-/Commit-Zeilen und fremdes src/contracts (:153/:175), befolgt-Fenster leer wenn jede Mutation next traegt (:84), Endstand mischt letztes generate mit Endzustand (:210)

**Status:** ✅ Done (2026-09-30)
**Typ:** aus Item ITEM-2026-663 (bug)
**Erstellt:** 2026-09-30
**Item:** bok/items/ITEM-2026-663.json (Lane: graph)

---

## Befund

`rig/greenfield-systemtest/steuerung.mjs` wurde fuer den `claude -p`-Strom gebaut. Auf einem
Claude-Code-Sitzungs-Transcript (Kette A, Frontier-Lauf agentdiary 2026-09-29, 439 Werkzeugaufrufe)
zaehlt es falsch — Ist laut `rig/agentdiary/auswertung-frontier.md` §2, nachgerechnet:

| Kennzahl | Ist | Ursache |
|---|---|---|
| Fokus befolgt | 1/2 beurteilt (62 Fokusquellen) | Fenster endet VOR der naechsten Fokusquelle; traegt jede Mutation `next`, ist die Mutation selbst die naechste Quelle → Fenster leer |
| Navigation | Graph-Anteil 0,22 (42 gegen 148; Werkzeug-Quelltext 28) | `bashSuche` greift bei jeder Zeile mit grep/ls/cat — auch `git add … $(ls …)`, `npx vitest … \| grep`, `cat > datei <<EOF`; Muster `contracts` trifft das eigene `src/contracts/` des Fremdrepos |
| Endstand | done, 0 blockierend, dazu Schwellen/Gates von graph_generate v25 | `{...letzterGen, ...letzterSchritt}` mischt die Tabellen des letzten generate mit dem `next` der letzten Mutation |
| Effizienz | „—“ ohne Grund | `effizienz` braucht die `result`-Zeile, die ein Sitzungs-Transcript nicht hat |

## Root Cause

Die Auswertung setzt stillschweigend den `claude -p`-Strom voraus (Fokus nur ueber graph_generate,
Bash nur zum Lesen, eine result-Zeile) — auf Kette A treffen alle drei Annahmen nicht zu.

## Aenderung

1. `navigation`: eine Bash-Zeile ist Datei-Navigation nur, wenn der **Kopf einer Pipeline** ein
   Lese-Verb ist (grep/rg/find/cat/ls/head/sed/tail) — ohne Heredoc-Koerper, ohne `$(…)`, ohne
   `cat >`/`sed -i` (Schreiben), ohne Filter hinter `|`. Das Ziel wird nur aus diesen Segmenten
   bestimmt. `werkzeugQuelle` ohne das nackte Muster `contracts`.
2. `kanalWirkung`: das Fenster schliesst eine Mutation ein, die selbst `next` traegt — sie wurde
   unter dem vorigen Fokus geschrieben.
3. `endstand`: alle Felder aus EINER Quelle, der letzten Fokusquelle; was `next` nicht traegt
   (Schwellen, Gates, blockierend), ist `null` und wird als „nicht im next“ berichtet; `quelle` benennt sie.
4. `effizienz`: ohne result-Zeile `{ verfuegbar: false, grund: 'kein result' }`; der Bericht druckt
   „nicht verfuegbar (kein result)“.

## Umfang

- `rig/greenfield-systemtest/steuerung.mjs` (Teil von FUNC-systemtest-report, nicht eigens gebunden)
- `tests/rig-steuerung-transcript.test.ts` (neu, synthetisches Kette-A-Fixture)
- `tests/systemtest-rig.test.ts` (Erwartungen an die geaenderten Rueckgaben)

## Abnahme

- Red-first: die neuen Tests schlagen auf dem alten Stand fehl, gruen danach.
- Gegenprobe am echten Transcript (nur lesend), neue Zahlen im Abschluss.

## Ergebnis

- `kanalWirkung`: Fenster schliesst die Mutation mit `next` ein; ein Schritt ohne Fokus (`done`, keine
  focusTypes/uids) wird nicht beurteilt.
- `navigation`: `leseSegmente()` (exportiert) — Pipeline-Kopf mit Lese-Verb, quote-bewusst zerlegt
  (`grep "a\|b"` bleibt ein Segment), ohne Heredoc/`$(…)`/`cat >`/`sed -i`; Ziel nur aus den lesenden
  Segmenten; kein nacktes `contracts` mehr.
- `endstand`: eine Quelle, `quelle: graph_generate | next`; Tabellen am `next` = `null` → „nicht im next“.
- `effizienz`: `{ verfuegbar:false, grund:'kein result' }`; Bericht „nicht verfuegbar (kein result)“.

Frontier-Transcript (d9c55ac6, 439 Aufrufe), vorher → nachher:

| Kennzahl | vorher | nachher |
|---|---|---|
| Fokus befolgt | 1/2 | 13/17 (Handzaehlung der Auswertung: 11/15, nur focusKey) |
| Navigation Datei ohne Auftrag/Doku | 148 (Sichten 28, Werkzeug-Quelltext 28, sonst 92) | 76 (Sichten 0, Werkzeug-Quelltext 6, sonst 70) |
| Graph-Anteil | 0,22 | 0,36 |
| Effizienz | „—“ | nicht verfuegbar (kein result) |
| Endstand | done + Schwellen/Gates von generate v25 | done, handoff, Quelle `next`, Tabellen „nicht im next“ |

Test: `tests/rig-steuerung-transcript.test.ts` (neu, 4 Tests: rot 4/4 auf altem Stand, gruen danach),
`tests/systemtest-rig.test.ts` 51/51. Modell: `CR-GC-716 -relation-> FUNC-systemtest-report`
(steuerung.mjs ist Teil des Berichts, nicht eigens gebunden — Bindung dieser Datei: keine).
