# CR-GC-1035: graphcodes eigene Messdaten docs/messung nach graphanalyze

**Typ:** aus Item ITEM-2026-1682 (finding)
**Erstellt:** 2026-11-26
**Item:** bok/items/ITEM-2026-1682.json (Lane: code)

---

testauswahl.jsonl, kennzahlen.md, aenderungs-heatmap.html, vertragstest-mutanten-*.md sind Analysen und gehören nach graphanalyze. stand.* (Release-Zug) und se-retro bei Konsumenten bleiben. Schreiber: verify-full.mjs, messung.mjs, aenderungs-heatmap.mjs, test-schlupf.ts, retro-kpi.mjs.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| Gehören Messdateien, die produktiver Code liest oder schreibt, nach graphanalyze? | Nein. `docs/messung/testauswahl.jsonl` (verify:full, Schlupf-Zähler) und `docs/messung/kennzahlen.md` (Definition für retro-kpi und se-retro) bleiben in graphcode als ausdrückliche Ausnahme in `erlaubtePfade`. Nach graphanalyze gehen Analysen und Analyse-Tools, die kein Produktpfad braucht. | Entscheidung des Autors am 2026-11-26: Release (`npm version` → stand.md) und verify:full liefen sonst nur mit einem graphanalyze-Klon daneben, CI hat keinen. |
| Was hebt eine Pfad-Ausnahme der Push-Prüfung auf? | Nur die Pfadregel; die PII-Prüfung gilt für die Datei weiter. | Eine erlaubte Datei darf trotzdem keine personenbezogenen Daten tragen. |
| Bleibt eine Messung, die als Spike entstand und heute stand.md speist, ein Spike? | Nein, sie verliert den Spike-Namen: `scripts/spike-kettenkennzahlen.mjs` heißt `scripts/kettenkennzahlen.mjs` und liefert T-O1. | Entscheidung des Autors am 2026-11-26. |

---

## Umfang

- `scripts/spike-nd-known-answer.mjs`, `spike-engpass-known-answer.mjs`, `spike-sync-herleitung.mjs` → `graphanalyze/werkzeuge/spikes/`; Imports laufen dort über `graphanalyze/graphcode.mjs` (eine contracts-Instanz). Ausgabe alt gegen neu byte-gleich (120, 88, 27 Zeilen).
- `docs/messung/vertragstest-*mutanten-*.md` (6) → `graphanalyze/docs/messung/vertragstest-mutanten/`.
- `scripts/spike-kettenkennzahlen.mjs` → `scripts/kettenkennzahlen.mjs`; `scripts/messung.mjs`, Leitlinie, Architekturkonzept, `kennzahlen.md` nachgezogen.
- Push-Prüfung: `erlaubtePfade` = `kennzahlen.md`, `testauswahl.jsonl`; `erlaubtePfade` hebt nur noch die Pfadregel auf (vorher auch die PII-Prüfung). Neuer Testfall, Gegenprobe mit alter Logik rot.
- `.gitignore`: `scripts/spike-*`.
- Nicht hier: das Heatmap-Tool samt Ausgabe `docs/messung/aenderungs-heatmap.html` (eigener CR); bis dahin blockt die Push-Prüfung.
