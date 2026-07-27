# CR-GC-238 — applyCommands: update-edge + merge-nodes ans Gate binden

**Status:** done · 2026-07-07
**Paket:** `@sigloch/graphcode` (Harness) · **Vorgänger:** sigloch-modules CR-196 (Schema, done) · **Abhängig von:** sigloch-modules CR-198 (shared Ausführung, open)
**Quelle:** graph-view-edit CR-GVE-D02 (native Edge-Ops statt delete+add-Interim)

## Problem

`MutateCommandSchema` (contracts ≥0.5.0) kennt seit CR-196 `update-edge` und `merge-nodes`; `harness.applyCommands()` implementiert beide nicht. Editoren emittieren weiter delete+add-Batches; im Audit ist ein Flip nicht von Delete+Add unterscheidbar.

## Änderung

**Keine eigene Rewiring-Logik im Harness** — die Ausführungssemantik (Flip, Merge-Umhängen) kommt als pure Helper aus graph-api-core (CR-198, ein Implementierungsort für SE-Harness UND ontologie-agnostischen GraphService). Hier nur:

1. `applyCommands`: die 2 Ops auf den CR-198-Helper mappen (in-memory Graph + Storage-Persist)
2. Gate unverändert: Regeln auf dem Ergebnisgraph (R-18), Tier-Ableitung, OCC
3. Audit: EIN semantischer Eintrag pro Op (nicht delete+add)

## Akzeptanz (aus CR-196 delegiert)

- [x] `update-edge` mit `flip:true` erzeugt die gedrehte Kante, alte weg — als ein Command
- [x] `merge-nodes` hängt alle inzidenten Kanten um, löscht source; illegales Ergebnis → tier `block`
- [x] Audit-Log zeigt EINEN semantischen Eintrag pro Op
- [x] Keine duplizierte Rewiring-Logik: Harness ruft den graph-api-core-Helper (grep-Nachweis: `updateEdge(this.graph, …)` / `mergeNodes(this.graph, …)` in `src/harness.ts`, keine lokale Flip-/Merge-Algorithmik mehr)
- [ ] graph-view-edit CR-GVE-D02: Interim-Pfad (delete+add) danach löschen — **nicht Teil dieses Repos/Closeouts**, offen für graph-view-edit

## Umsetzungsnotiz

Beim Ausräumen der lokalen Logik fiel auf, dass sie einen Dedup-Guard hatte (flip/merge kann auf eine bereits existierende Kanten-Identität rewiren), den der CR-198-Helper anfangs nicht hatte — als Fix in graph-api-core nachgezogen (`edge-ops.ts`, sigloch-modules), sonst wäre das ein stiller Korrektheits-Regress beim Umstieg auf den Helper gewesen. Volle Suite (269/269) grün nach dem Umbau.
