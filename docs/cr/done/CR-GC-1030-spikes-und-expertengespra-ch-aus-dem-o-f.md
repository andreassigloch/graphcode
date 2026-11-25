# CR-GC-1030: Spikes und Expertengespräch aus dem öffentlichen Repo nach graphanalyze

**Typ:** aus Item ITEM-2026-1680 (finding)
**Erstellt:** 2026-11-25
**Item:** bok/items/ITEM-2026-1680.json (Lane: graph)

---

docs/archive/spikes/ (19 Dateien) und docs/archive/2026-11-10-expertengespraech-systemmodell.md liegen öffentlich. Entscheidung Autor 2026-11-25: keine Spikes im öffentlichen Archiv ausser ausdrücklich beschlossen; Gesprächsprotokolle raus. Revidiert CR-GC-888 für Spikes.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| Liegen Spikes und ihre Ergebnisse im öffentlichen graphcode-Repo? | Nein. Spikes, Spike-Ergebnisse und Gesprächsprotokolle liegen in graphanalyze; öffentlich bleibt ein Spike nur nach ausdrücklicher Entscheidung des Autors, dann mit eigener Ausnahmezeile in `.gitignore`. Revidiert CR-GC-888 für `docs/archive/spikes/`. | Entscheidung des Autors am 2026-11-25. Eine Messung mit echten Projekten oder ein Gespräch mit Dritten gehört nicht in ein öffentliches Repo. |

---

## Umfang

Reiner Dokument-Umzug, kein Modellknoten betroffen (die Dateien tragen keinen `realRef`/`testRef`).

- `docs/archive/spikes/` (19 Dateien) → `graphanalyze/docs/spikes/`, byte-gleich geprüft.
- `docs/archive/2026-11-10-expertengespraech-systemmodell.md` → `graphanalyze/docs/archive/`.
- `.gitignore`: `docs/**/spike/`, `docs/**/spikes/`, `docs/**/SPIKE-*`, `docs/archive/*gespraech*`.
- Verweise ohne Link: Leitlinie (2×), Arbeitspakete-Konzept, Artikel 01 und 03, CR-GC-921.
- Nicht hier: die vier `scripts/spike-*.mjs` ziehen mit `docs/messung/` um (ITEM-2026-1682), weil `scripts/messung.mjs` `spike-kettenkennzahlen.mjs` importiert.
- Die öffentliche History behält die Dateien (FAQ `oeffentliches-repo`, Punkt 5).
