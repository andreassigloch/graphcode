# CR-GC-365 — GVE zeigt den Agenten-Slice, statt ihn nachzurechnen

**Status:** draft
**Datum:** 2026-08-18
**Voraussetzung:** `SPIKE-GC-minimal-whitebox` §8 (definiert das Slice-Artefakt)
**Kontext:** Befund 2026-08-18 — GVE `ImpactMap` lädt den **vollen** `graph.json`
(`graph-store.mjs:51`) und rechnet in `impactTransform` einen eigenen
**ungerichteten** Frontier-BFS im Browser. `graph_impact` wird nie aufgerufen.
Der Blast-Begriff stimmt überein (GVE `blast` = Kante zeigt INS Changeset =
Dependents = `graph_impact`), die **Traversierung** nicht: MCP ist gerichtet
eingehend mit Tiefe N aus Kuzu, GVE deckt beide Richtungen auf, Default Tiefe 1
plus manuelles „+". Was der Mensch sieht, ist in der Richtung eine Obermenge und
in der Tiefe eine Teilmenge dessen, was der Agent bekam — aus einer anderen Quelle
gerechnet.

## Ziel

**GVE bleibt Viewer.** Es rendert den Slice, den der Agent bekommen hat, und
rechnet ihn nicht nach. Zwei zulässige Wege, im CR **einen** wählen:

- (a) GVE holt den Slice über die read-only Host-Bridge (`GET /subgraph/:root`
  bzw. der Slice-Endpunkt aus dem Spike) und rendert nur.
- (b) Die Traversierungs-Definition zieht nach `@sigloch/graph-api-core`, MCP und
  GVE rufen dieselbe Funktion — ein Schreiber, zwei Leser.

**Nicht** zulässig: beide Wege parallel, oder `impactTransform` als zweite
Definition stehen lassen. Nach dem Umbau wird die alte clientseitige
BFS-Traversierung **gelöscht** (keine parallelen Pfade).

## Was bleibt clientseitig

Layout ist Ansichtssache, nicht Semantik: Ringradius, `MIN_ARC_PER_NODE`,
Label-Fitting, das „+/−"-Aufklappen als **Nachforderung eines größeren Slice**
(nicht als lokale Neuberechnung). Die Rollen `seed | whitebox | blackbox` kommen
aus dem Slice, nicht aus dem Browser.

## Dateien (≤6)

- `src/views/ImpactMap.jsx` (GVE)
- `src/graph-store.mjs` (GVE) — oder der Slice-Fetch-Pfad
- `src/viewer/host.ts` (graphcode) — Slice-Endpunkt, falls Weg (a)
- Tests je Repo (GVE-Rendertest + graphcode-Endpunkt-Test)

## Akzeptanzkriterien

- [ ] Derselbe Seed liefert in GVE und über MCP **knotengleiche** Mengen —
      Test vergleicht beide Ergebnisse direkt, nicht per Augenschein
- [ ] `impactTransform`-Eigen-BFS ist **entfernt**, nicht deaktiviert (grep-Nachweis)
- [ ] „+" fordert einen größeren Slice an; kein clientseitiges Nachtraversieren
- [ ] Rollen `seed/whitebox/blackbox` kommen aus dem Slice-Artefakt
- [ ] UI-Test prüft **gerendertes Ergebnis** gegen die Slice-Knotenmenge (se-test-ui:
      Rendered Intent, nicht DOM-Präsenz)
- [ ] `npm run build` + Tests in beiden Repos grün
