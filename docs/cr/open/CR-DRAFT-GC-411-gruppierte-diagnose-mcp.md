# CR-DRAFT-GC-411 — Gruppierte Verstöße als MCP-Detail-Level (eine Aggregation, zwei Konsumenten)

**Status:** DRAFT — nicht freigegeben · **Angelegt:** 2026-08-25
**Herkunft:** Dashboard-Review 2026-08-25, Frage „was bekommt die LLM — würde die Aggregation
auch dort helfen?"

## Befund — die Mittel-Ebene fehlt auf der MCP-Surface

Was die LLM heute bekommt:

| Tool | Default | Inhalt |
|---|---|---|
| `graph_readiness` | summary | Scores + `violationsByRule` (Count je Regel, **ohne** Element-IDs) |
| `rules_evaluate` | **full** | jedes Finding einzeln inkl. `context` — gemessen > 750 KB bei 667 Knoten |
| `rules_evaluate summary` | — | je Verstoß eine Zeile, aber **ungruppiert** |

Die Mittel-Ebene — EINE Gruppe je ruleId mit Count, message, fixHint und gekappter
elementIds-Liste — existiert nur privat in gve (`vite.config.js recommendationGroups`,
CR-GVE-250): ein paralleler Aggregationspfad außerhalb der Familie.

## Änderung

`detail:'grouped'` für `rules_evaluate` (und `rules_get_violations`):
`{ruleId, severity, count, message, fixHint, elementIds (gekappt, Kappung benannt),
elementIdsOmitted}` — erst gruppieren, dann kappen (Zählung über die ungekappten Listen,
CR-GVE-250-Lehre). Die Gruppierungsfunktion wird EINMAL implementiert und exportiert
(graphcode-client), gve ersetzt seine `recommendationGroups`-Kopie durch den Import
(Folge-CR dort — kein Parallelpfad mehr).

## Nutzen

- LLM: token-präzise Diagnose („welche Regeln feuern, an welchen Elementen") ohne
  750-KB-Antwort und ohne Zeile-pro-Verstoß-Rauschen; `full` bleibt für den
  candidate_targets-Fall (CR-GC-309-Zusage unangetastet).
- Familie: eine Aggregation, zwei Konsumenten (MCP + gve-Dashboard).

## Akzeptanzkriterien (bei Freigabe zu präzisieren)

- [ ] `detail:'grouped'` liefert Gruppen mit korrektem Count aus ungekappten Listen
      (Test > Kappgrenze, vorher rot).
- [ ] Antwortgröße auf dem 667-Knoten-Graphen gemessen: grouped ≪ summary ≪ full.
- [ ] `full`-Default und Semantik unverändert (mcp.mutate-violations-Vertrag).
- [ ] gve-Folge-CR angelegt (Import statt Kopie).

## Dateien (≤ 4, Schätzung)

1. Gruppierungsfunktion (graphcode-client, exportiert)
2. `rules_evaluate`/`rules_get_violations` Tool-Layer
3. Tests
4. dieser CR
