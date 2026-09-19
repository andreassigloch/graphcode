# CR-GC-553: die Bewertungsmaschiene des Rigs trägt eine fremde CR-Nummer

**Status:** 🟢 Done (2026-09-19)
**Typ:** aus Item ITEM-2026-359 (finding)
**Erstellt:** 2026-09-19
**Item:** bok/items/ITEM-2026-359.json (Lane: code)

---

## 1. Root Cause

Zwei Commits von heute, `61abfc9` (12:23) und `1daa454` (12:27), tragen die volle
Bewertungsmaschiene des Rigs in elf Dateien ein und nennen dabei **CR-GC-552**. Diese Nummer
**existierte zur Commit-Zeit nicht**: die CR-Datei entsteht erst um 13:22 mit `a34ac4a`, und
zwar für etwas anderes — das dritte Modell-Backend `sigllm` im Executor, vier Dateien in
`src/loop/`, aus ITEM-2026-356.

Damit hat die Bewertungsmaschiene **keine CR**, und CR-GC-552 trägt in seiner Umfangstabelle
vier Dateien, während sieben Codestellen auf ihn zeigen, die er nie umfasst hat.

Zweiter Vorfall derselben Art in dieser Sitzung — bei CR-GC-551 wurden die vorgezogenen
Verweise noch vor dem Commit entfernt, hier nicht. → Regel: **erst minten, dann zitieren.**

## 2. Impact

**Was nicht bricht:** nichts Laufendes. Die Maschinerie funktioniert, ist getestet und hat
Lauf 1 bewertet; die falsche Nummer ist reine Buchhaltung.

**Was bricht:** die Nachvollziehbarkeit, und zwar in beide Richtungen. Wer von CR-GC-552 aus
liest, findet elf Dateien Umfang, die die CR nicht nennt. Wer von `metrics.mjs` aus liest,
landet bei einer CR über Modell-Backends. RC-07 merkt davon nichts — es prüft Knoten gegen
Verzeichnis, nicht Kommentar gegen Umfang.

## 3. Fix

Die sieben Verweise zeigen auf **diese** CR. Der Code selbst bleibt unberührt — er ist richtig,
nur falsch etikettiert.

### Dateien (4)

| # | Datei | Verweise |
|---|---|---|
| 1 | `rig/greenfield-systemtest/metrics.mjs` | 3 |
| 2 | `rig/greenfield-systemtest/report.mjs` | 2 |
| 3 | `rig/greenfield-systemtest/run.mjs` | 1 |
| 4 | `rig/sigllm-spezifikation/README.md` | 1 |

**Zur 6-Dateien-Grenze:** der Änderungsumfang dieses Zuges sind diese vier Dateien. Die elf
Dateien der Maschinerie sind bereits ausgeliefert und werden hier nur **nachdokumentiert**, nicht
bewegt — der Blast Radius, den die Grenze meint, ist vier.

### Was die Maschinerie umfasst — die Nachdokumentation

Aus `61abfc9` und `1daa454`, Auftrag vom 2026-09-19 („du stellst sicher, dass die
Bewertungsmaschiene für graphcode-Projekte vollständig und verfügbar ist, für Spec und Code"):

- `metrics.mjs` — `specVerdict` (Score je Dimension, Steuerwert mit Anker, **nicht ausgewertete**
  Regeln), `binding` (FUNC mit `realRef`), `codeVerdict` (dreiwertig: kongruent / gedriftet /
  nicht prüfbar, immer mit Reichweite), `briefCoverage` (Prüfliste gegen die Auftrags-Anforderungen).
  Dazu die Korrektur an `legality()`: zählt `result !== 'applied'`, nicht nur `tier === 'block'`.
- `report.mjs` — die zwei Hälften im Bericht, plus `RESULTS_FILE` als Pflicht statt Sammelglob.
- `run.mjs` — `CHECKLIST` durchgereicht.
- `rig/sigllm-spezifikation/` — `prompt-prosa.txt`, `lauf-prosa.env`, `material-prosa/auftrag.md`,
  `golden/anforderungen-auftrag.json` (42 Anforderungen), README und `ergebnis.md`.

## 4. Nachweis

- [x] `grep -rn 'CR-GC-552' rig/` nennt nur noch Stellen, die wirklich das Backend meinen (erwartet: keine).
- [x] CR-GC-552 unverändert — sein Umfang bleibt die vier Executor-Dateien.
- [x] Lauf 2 (prosaischer Auftrag) lief mit der so etikettierten Maschinerie durch: 248 Elemente,
      27 min, 0 Abbrueche. Die Maschinerie hat dabei zwei eigene Maengel offengelegt — die
      hartkodierte 42/42-Prosa im Bericht (hier korrigiert) und die Unvergleichbarkeit der
      Pruefliste (ITEM-2026-360).
