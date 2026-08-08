# CR-GC-316 — `graph_help` ohne Token zählt pro Element auf: derselbe Erklärtext 96× im Prompt

**Status:** done · **Angelegt:** 2026-08-08 · **Abgeschlossen:** 2026-08-08 · **Max Files:** 3 (→ 2)
**Herkunft:** CR-GC-312-Arbeit 2026-08-08. Rückfrage beim Schnitt des Help-Rests: „gibt eine
help anfrage dann wieder alles zurück oder nur spezifisch das thema / regel? bei ersterem
erzeugen wir gigantischen prompt bloat."
**Blockiert:** das Authorn der ~34 fehlenden Plain/SE-Paare aus CR-GC-312. Dieser CR muss
**davor** laufen — sonst baut man den Bloat erst auf und räumt ihn hinterher weg.

## Problem

`graph_help` hat zwei Modi (`src/tools/report.ts:326`). Der Token-Modus ist unkritisch:

| Aufruf | Rückgabe | Größe |
|---|---|---|
| `graph_help({token:'R-01'})` | genau ein `HelpEntry` | **378 Bytes** |
| `graph_help({})` | kontextuelle Maßnahmen aus den live Violations | skaliert mit dem Graphen |

Der token-lose Modus zählt **pro Violation** auf, nicht pro Regel (`contextualHelp`,
`src/viewer/help.ts:164`). Jede Maßnahme trägt eine **vollständige Kopie** des `HelpEntry` —
Titel, `plain`, `se`, `prompt`, Severity, Gate. Auf dem heutigen SSOT feuert `CR-R02` 96×,
`CR-R04` 62×, `VR-01` 58×, `MS-03` 54×: 336 Violations aus 19 verschiedenen Regeln.

Gemessen (voller Katalog, ohne BQ/ND/RC):

```
336 Violations · 19 verschiedene Regeln · ~541 Bytes pro Maßnahme
```

Heute unsichtbar, weil `contextualHelp` eine Violation nur aufnimmt, wenn ein authored Entry
existiert — und das trifft aktuell auf **4 von 336** zu (~2 KB). Genau das kippt, sobald die
CR-GC-312-Paare geschrieben sind:

| | Maßnahmen | Payload |
|---|---:|---:|
| heute | 4 | ~2 KB |
| nach dem Authorn, ungekappt | 336 | **~178 KB** |
| nach dem Authorn, dedupt | 19 | **~10 KB** |

178 KB in **jedem** späteren Cache-Read der Sitzung. Dieselbe Bauform wie CR-GC-309, wo
`graph_mutate` jede Violation mit vollem `context` echote (189 KB von 929 KB Tool-Output).

Die 96 `CR-R02`-Maßnahmen tragen 96× denselben Erklärtext. Wiederholung ist die Kosten,
nicht die Zahl der betroffenen Elemente — die ist die eigentliche Information und schrumpft
auf eine Zahl.

## Architektur-Entscheidung

**Eine Maßnahme pro Regel, nicht pro Violation.** Der Erklärtext gehört zur Regel; die
betroffenen Elemente sind Belege dafür:

```ts
interface ContextualMeasure {
  entry: HelpEntry;
  severity: 'error' | 'warning' | 'info';
  blockerKind: 'rule' | 'creation';
  count: number;           // NEU — wie oft die Regel feuert
  elementIds: string[];    // NEU — gekappt, siehe unten
  gateId?: string;
  message: string;         // die Meldung des ersten Treffers, als Beispiel
}
```

`elementIds` trägt bis zu **5** uids. Die Grenze ist bewusst und wird **nicht** stillschweigend
gezogen: `count` steht daneben, also ist an der Antwort ablesbar, dass gekürzt wurde. Wer die
volle Liste braucht, fragt `rules_get_violations` — das Diagnose-Tool, das auf voller Tiefe
bleibt. Query-Precision, keine Result-Kompression (dieselbe Trennung wie CR-GC-309).

Die Severity einer zusammengefassten Maßnahme ist die **höchste** ihrer Violations, damit die
Sortierung nicht von der Eingabereihenfolge abhängt.

Creation-Blocker (CR-GC-221) sind bereits pro Artefakt dedupt und bleiben unverändert —
sie bekommen `count: 1` und ihre eine `elementIds`-Einträge-freie Form.

### Warum nicht Top-N

Ein `limit: 10` würde die 19 Regeln auf 10 kürzen und dabei echte Befunde verlieren — bei 19
Regeln ist die Liste nach dem Dedup ohnehin klein und wächst nur mit der Zahl **verschiedener**
feuernder Regeln, also mit dem Regelkatalog (66), nicht mit dem Graphen (403 Elemente). Ein
zweiter Kappmechanismus wäre Aufwand ohne Wirkung.

## Scope (tatsächlich 2 Dateien)

1. `src/viewer/help.ts` — `ContextualMeasure` um `count`/`elementIds`, exportiertes
   `MAX_EXAMPLE_ELEMENTS`; `contextualHelp` gruppiert Rule-Blocker nach `ruleId`
2. `tests/help.contextual-dedup.test.ts` (neu) — 8 Tests
3. — `src/viewer/panels.ts` **nicht nötig**: kein Konsument las `ContextualMeasure.elementId`
   (geprüft per grep, nicht angenommen)

## Akzeptanzkriterien

- [x] Eine Regel, die N-mal feuert, erzeugt **eine** Maßnahme mit `count: N`
- [x] `elementIds` trägt höchstens 5 uids; `count` bleibt die echte Zahl (kein stilles Kappen)
- [x] Die Severity der Maßnahme ist die höchste ihrer Violations, unabhängig von der
      Eingabereihenfolge
- [x] Creation-Blocker unverändert (Regression)
- [x] Sortierung unverändert: error vor warning vor info
- [x] Gemessen im Test: Payload für einen Graphen mit 300+ Violations aus <25 Regeln liegt
      unter 20 KB — und wächst beim Verdoppeln der Violations **nicht**
- [x] `graph_help({token})` byte-identisch wie heute (der Token-Modus ist nicht das Problem)
- [x] `npm test && npm run build` grün — 82 Dateien / 590 Tests

## Nachweis

Mutationsprobe: Gruppierung auf die Vor-CR-Fassung (eine Maßnahme pro Violation)
zurückgedreht → 5 der 8 Tests rot, darunter beide Payload-Messungen. Die drei grün
bleibenden sind genau die Regressions-Tests (Severity-Ranking, Creation-Blocker) — sie
sollen unverändertes Verhalten sichern und tun das.
