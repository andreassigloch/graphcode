# CR-GC-848: Commit-Prüfung: Fluss gegen Aufruf, Aufruf ohne Fluss, realRef; Code-Stand im Audit-Eintrag

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1042 (finding)
**Erstellt:** 2026-10-23
**Item:** bok/items/ITEM-2026-1042.json (Lane: code)
**Hängt an:** CR-GC-846 (Aufrufsuche im Kernel) und sigloch-modules CR-SM-415 (RC-12, RC-13). Start erst danach.

---

## Befund

Die Regeln RC-01, RC-12 und RC-13 laufen nur in einer vollen Auswertung (`rules_evaluate`, `graph_readiness`). Ein Commit, der einen Aufruf ändert, kommt ohne Auswertung durch. Die Drift zeigt sich erst, wenn jemand später ein lesendes Werkzeug ruft. So sind in CR-GC-832..838 etwa 4 von 10 Flüssen falsch geworden.

Ein `graph_mutate` hält heute nicht fest, gegen welchen Code-Stand es lief. Eine Modelländerung lässt sich deshalb nicht einem Code-Stand zuordnen.

Entschieden am 2026-10-23: die Prüfung läuft im Commit, nicht im Ergebnis von `graph_mutate`. Das Gate liest keinen Code.

## Änderung

1. **Commit-Hook** (`scripts/githooks/pre-commit`): Sind `.ts`-Dateien unter `callScope` gestaget, wertet ein neues Skript RC-01, RC-12 und RC-13 aus. Grundlage sind der gestagte Snapshot (`docs/graph/*.graph.json`) und der Arbeitsbaum.
   - Gemeldet wird jeder Befund, dessen FUNC- oder FLOW-`realRef` in einer gestagten Datei liegt. Ein Paar zählt mit, wenn eine seiner Seiten dort liegt.
   - Ein solcher Befund bricht den Commit ab. Die Meldung nennt das Paar, den Weg im Code und den Zug, der ihn behebt. Bei RC-01 ist das `update-node` mit dem neuen Symbol.
   - Ohne gestagte `.ts`-Datei läuft nichts, der Hook bleibt bei der Modell-Spur.
2. **Code-Stand im Audit-Eintrag:** `recordAudit` schreibt `codeState: { head, dirty }` in jeden Eintrag. `head` ist der Git-Commit, `dirty` sagt, ob ungespeicherte Änderungen unter `callScope` offen waren. Das Feld steht in `TrajectoryStamps`, das graphcode selbst gehört. Ein Bump von contracts ist nicht nötig.
3. Der Hook ist nur in graphcode installiert (`core.hooksPath`). Andere Repos im CR-Modus graph prüfen über `aise cr close` (BOK-CR-072).

## Umfang

`scripts/githooks/pre-commit`, neues Skript `scripts/commit-pruefung.mjs`, `src/surface/tool-context.ts`, `src/projections/trajectory.ts`, zwei Testdateien (Hook am Wegwerf-Repo, Audit-Feld), Modellzug: eine neue FUNC für den Commit-Hook als Einstieg (Regel 1 aus `se:top-level`), Fluss zu FUNC-check-code-conformance, `codeState` an FUNC-tool-context.

## Kosten

Gemessen am 2026-10-23 mit der Aufrufsuche aus CR-GC-843: 1,3 s je Durchlauf. Der Hook läuft nur bei Commits mit `.ts`-Dateien.

## Akzeptanz

- Wegwerf-Repo: Ein Commit fügt einen Aufruf zwischen zwei verankerten FUNCs ohne FLOW hinzu → der Hook bricht ab und nennt RC-13 mit dem Paar.
- Ein Commit entfernt den Aufruf hinter einem synchronen FLOW → der Hook bricht ab und nennt RC-12.
- Ein Commit benennt ein verankertes Symbol um, ohne die `realRef` nachzuziehen → der Hook bricht ab und nennt RC-01 mit `update-node`.
- Derselbe Commit mit dem passenden Modellzug im Snapshot → kein Abbruch.
- Ein Commit nur mit `docs/` → die Prüfung läuft nicht.
- Jeder Audit-Eintrag eines `graph_mutate` trägt `codeState.head`.
- Die Dauer des Hooks am Selbstmodell steht im CR.
