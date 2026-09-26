# CR-GC-676: Mess-Artefakte aufräumen: abgeschlossene Spikes, Recorder, tote Rigs und Alt-Ergebnisse löschen

**Status:** ✅ Done (2026-09-26)
**Typ:** aus Item ITEM-2026-589 (finding)
**Erstellt:** 2026-09-26
**Item:** bok/items/ITEM-2026-589.json (Lane: code)

---

## Befund

Die Varianten der ℝ⁶-Architekturkennzahl sind gemessen und alle No-Go/widerlegt (graphcode-Leitlinie T-O4).
Ihre Spike-Skripte beweisen danach nichts mehr, stehen aber im Bestand §9.5 und suggerieren eine Messung.

## Umfang (erledigt)

- Gelöscht: `scripts/spike-archetype-eigenvector.mjs`, `spike-ebenen-konformanz.mjs`, `spike-rekursive-metrik.mjs`, `spike-lexikographisch.mjs`.
- Bleibt: `scripts/known-answer-set.mjs` — das Known-Answer-Set ist nach §9.1 Pflicht für jede Architektur-Kennzahl.
- Nachgezogen: Kommentar `src/surface/measured.ts`, `rig/README.md` (Abschnitt „Offen"), `rig/graphs/README.md` (Leser jetzt `randbreiten.mjs`; Prüfsummen werden nicht geprüft — benannt), Leitlinie §9.5.

## Umfang laut `graph_impact`

Keine Graph-Bindung: kein Knoten trägt einen `realRef`/`testRef` auf die gelöschten Dateien (Suche in `docs/graph/graphcode.graph.json`: 0 Treffer). RC-Kongruenz unberührt.

## Verifikation

`npm run type-check` grün; `tests/import-boundaries`, `policy-herkunft`, `verify-model.completeness` grün.
