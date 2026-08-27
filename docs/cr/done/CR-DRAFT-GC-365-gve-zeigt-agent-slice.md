# CR-GC-365 — GVE zeigt den Agenten-Slice, statt ihn nachzurechnen

**Status:** done — 2026-08-27, **Weg (b)** (Auftraggeber-Entscheidung): die Traversierung
zog als `impactSlice()` nach `@sigloch/graph-api-core` (5.4.0 unreleased); graphcodes
`graph_impact` und GVEs ImpactMap rufen DIESELBE Funktion. Rollen `seed|whitebox|blackbox`
gemäß Spike-§8 (Blackbox-Front bei Tiefe+1, Beschreibung/Attribute gestrippt — Schnitt im
Artefakt). GVE-Eigen-BFS (`impactTransform`) gelöscht (grep-leer); `impactLayout` projiziert
nur noch. Knotengleichheit MCP↔GVE direkt getestet (gve `tests/impact-slice-parity.test.mjs`:
uid→Rolle identisch über echten graphcode-Host). Publish-Pending: graph-api-core 5.4.0 +
graphcode (roles-Feld) müssen publiziert werden, bis dahin läuft gve gegen die verlinkten
Arbeitskopien; der Paritätstest benennt den fehlenden Publish explizit im Fehlertext.
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

- [x] Derselbe Seed liefert in GVE und über MCP **knotengleiche** Mengen —
      gve `tests/impact-slice-parity.test.mjs` vergleicht uid→Rolle direkt (echter
      graphcode-Host über repo-host.mjs vs. `impactSlice` über dem committeten JSON)
- [x] `impactTransform`-Eigen-BFS ist **entfernt**, nicht deaktiviert (grep-Nachweis:
      0 Treffer in gve src/tests/scripts)
- [x] „+" fordert einen größeren Slice an (Tiefe+1 über dieselbe Core-Funktion);
      kein clientseitiges Nachtraversieren
- [x] Rollen `seed/whitebox/blackbox` kommen aus dem Slice-Artefakt (impactSlice)
- [x] UI-Test prüft **gerendertes Ergebnis** gegen die Slice-Knotenmenge
      (views-impactmap: renderedIds() == slice.nodes, data-role je Knoten)
- [x] `npm run build` + Tests grün: graph-api-core 148/148, gve 729/729,
      graphcode modulo der dokumentierten vorbestehenden Roten

---

## Blockiert (2026-08-18)

**Nicht implementieren, bis `SPIKE-GC-minimal-whitebox` abgeschlossen ist.** Der Spike
definiert, *was* die Scheibe ist (Rollen `seed | whitebox | blackbox`, §8) und *wie groß*
sie sein darf (H3). Vorher gebaut, würde dieser CR gegen eine Scheibe implementieren, die
der Spike gerade widerlegen soll. Auch **keine** weiteren CRs zu diesem Thema anlegen,
bis das Ergebnis vorliegt.
