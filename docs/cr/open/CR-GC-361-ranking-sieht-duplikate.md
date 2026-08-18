# CR-GC-361 — Das Ranking soll Fortschritt von Scheinfortschritt unterscheiden

**Status:** open
**Datum:** 2026-08-18
**Vorgänger:** CR-GC-289 (Ziel-Delta-Ranking) · **Braucht zur Validierung:** CR-GC-359

## Der blinde Fleck

Das Ranking wählt heute nach **Score-Delta der Fokus-Dimension** (`executor-rank.ts`,
CR-GC-289). Readiness-Scores entstehen aus Regel-Verletzungen, und die Regeln sind
strukturell pro Element: „UC hat REQs", „REQ hat verify-TEST". **Ein Beinahe-Duplikat
erfüllt sie exakt so gut wie ein eigenständiges Element.**

Damit gilt: ein Kandidat, der 5 fast gleiche REQs an dieselbe UC hängt, erzeugt
denselben `focusDelta` wie einer mit 5 verschiedenen — und gewinnt anschließend den
späteren Tiebreaker `mutations` (Element-Ausbeute), wenn er mehr Knoten mitbringt. Das
Ranking belohnt also messbar Scheinfortschritt, und zwar **nach** der CR-289-Korrektur:
CR-289 hat die *Typ*-Monokultur behoben (v16: 26 von 33 Elementen UC), nicht die
*inhaltliche* Redundanz innerhalb eines Typs.

## Warum das kein Modellproblem ist

Der Befund tritt bei **jedem** Arm auf, lokal wie Frontier:

| Arm | Befund (Zitat aus der Messreihe) |
|---|---|
| Haiku 4.5 (Top-Graph) | „Schwäche: Duplikat-REQs (gleiche Anforderung mit/ohne ‚messbarem Kriterium')" |
| devstral v14 | „sichtbare EN-Duplikatpaare (zwei ‚User generates custom reports')" |
| qwen3.6-35b-a3b (Local-Optimum) | „Schwäche: req/uc dünn (5 REQ, 1 Duplikat)" |

`docs/executor-abschlussbericht.md` führt „Duplikat-Erkennung vor add-node (alle Modelle
erzeugen Beinahe-Duplikate)" seit 2026-08-01 unter „Offene Optimierungen". Wenn alle
Modelle denselben Fehler machen, ist die Auswahl im Code die Stelle, nicht der Prompt.

## Die Information ist bereits da — sie wird nur nicht gerankt

Das ist der Kern dieses CRs: es muss **nichts Neues erkannt** werden.

- `nd-similarity.ts` → `duplicateHints(effective, snap.index)` vergleicht neue REQ/UC-
  add-nodes gegen den Element-Index (CR-GC-287). Das Ergebnis wird in `executor.ts:541`
  berechnet, als `preflight hint:` **getract** und dem Outcome angehängt — und dort endet
  es. `rankCandidates` hat keinen Term dafür.
- ND-01 (FUNC) / ND-02 (SCHEMA) sind echte Regeln in `@sigloch/contracts/se` und laufen im
  Steering-Katalog. Für REQ/UC gibt es bewusst keine Regel (Familie-Review nötig) — der
  lokale Hinweis ist der zulässige Ersatz.

Wir berechnen die Redundanz also bereits pro Kandidat und werfen sie weg, kurz bevor die
Entscheidung fällt.

## Änderung

1. `duplicateHints` liefert **strukturiert** statt nur Strings: `{ uid, matchedUid, score }`.
   Die String-Darstellung für die Trace-Zeile bleibt erhalten (kein Verlust an Lesbarkeit,
   kein zweiter Berechnungspfad).
2. `CandidateProbe` trägt die Duplikat-Treffer des Kandidaten.
3. `rankCandidates` bekommt einen Term — und zwar **nicht** als weiteren späten
   Tiebreaker, denn das würde nichts ändern: das Duplikat hat den `focusDelta` ja bereits
   gewonnen. Stattdessen wird der Fokus-Fortschritt um die Duplikat-Treffer **bereinigt**
   („effektiver Fokus-Delta"), sodass ein Score-Gewinn, der nur aus Redundanz stammt,
   nicht als Fortschritt zählt.

## Risiko und Gegenmaßnahme (bewusst benannt)

Der Fehler, den dieses CR nicht wiederholen darf, ist der **v16-Fehler in Gegenrichtung**:
ein Kriterium, das so stark zieht, dass der Lauf verhungert. Zwei genuin verschiedene REQs
können sprachlich ähnlich sein — die Bereinigung darf sie nicht unterdrücken.

Deshalb: der Term ist eine **Ranking-Präferenz, kein Block**. Kein Kandidat wird verworfen,
das Gate bleibt unberührt, die Delta-Semantik unberührt. Der Threshold bleibt der bereits
gemessene ND-Wert (0.85) — dieses CR erfindet keine neue Ähnlichkeits-Formel.

## Dateien (4)

- `src/nd-similarity.ts` — strukturierte Rückgabe, String-Rendering bleibt
- `src/executor.ts` — Treffer in die `CandidateProbe`
- `src/executor-rank.ts` — bereinigter Fokus-Delta
- `tests/executor.bestofn.test.ts` — s.u.

## Akzeptanzkriterien

- [ ] Unit: zwei Kandidaten mit **identischem** `focusDelta`, einer davon aus
      Beinahe-Duplikaten — der eigenständige gewinnt. Ohne den Fix gewinnt der
      Duplikat-Kandidat (Test muss zuerst rot gesehen werden, sonst prüft er nichts)
- [ ] Unit: ein Kandidat mit ECHTEM Fortschritt **und** einem Duplikat schlägt weiterhin
      einen ohne Fortschritt — die Bereinigung darf Fortschritt nicht auslöschen
- [ ] Determinismus bleibt: gleiche Kandidaten ⇒ gleiche Reihenfolge (Index-Anker zuletzt)
- [ ] `npm run build` + Suite grün (Baseline 765/767, s. CR-GC-358)
- [ ] **Validierung durch Lauf** (nach CR-GC-359): REQ-Anteil und Duplikat-Zahl gegen
      den qwen35a3b-Bestlauf (53 El, 5 REQ, 1 Duplikat). Ohne diesen Lauf bleibt das CR
      offen — ein Ranking-Kriterium ohne Messung ist genau der Fehler, den CR-GC-288/289
      schon einmal gekostet haben (v16 Volumen-Bias, v17 konfundiert, erst v18 valide)

## Abgrenzung

KEINE neue Regel in `@sigloch/contracts/se`, kein ND-Threshold-Fork, kein Eingriff ins
Gate. Sollte sich zeigen, dass REQ/UC echte ND-Regeln brauchen, ist das ein eigener
Familie-Review mit Version-Bump — nicht dieses CR.
