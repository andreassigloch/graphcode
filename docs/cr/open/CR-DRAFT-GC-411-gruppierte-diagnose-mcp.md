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

---

## Stand 2026-08-25 — Teil 1 fertig, Teil 2+3 warten auf den Publish

### Teil 1 — SSOT-Funktion: FERTIG (nicht publiziert)

| | |
|---|---|
| Paket | `@sigloch/graphcode-client` (`sigloch-modules/packages/graphcode-client`) |
| Version | **1.3.0** (Minor, additiv) — vorher 1.2.0 |
| Commit | `7b4bf4e` — `feat: violation grouping (CR-GC-411)` |
| Export | `groupViolations(violations: RuleViolation[], elementLimit = 10): ViolationGroup[]` + `type ViolationGroup` (in `src/panels.ts`, über `export * from './panels.js'` am Root-Barrel **und** am Subpath `./panels`) |
| Tests | `tests/unit/violation-groups.test.ts` — 11 Fälle, alle über der Kappgrenze; rot gesehen (11/11 `groupViolations is not a function`), danach 47/47 grün, `tsc --noEmit` sauber |

`ViolationGroup = {ruleId, severity, count, message, fixHint?, elementIds, elementIdsOmitted}`,
sortiert nach `count` absteigend. Erst gruppieren, dann kappen: `count` kommt aus den
UNGEKAPPTEN Listen, `elementIdsOmitted` benennt die Kappung.

**`npm publish` fährt der Auftraggeber** (`packages/graphcode-client`). Bis dahin ist in
graphcode und gve NICHTS committet — jeder Konsumenten-Commit wäre bis zum Publish rote Baseline.

### Teil 2 — `detail:'grouped'` in graphcode (NACH dem Publish)

1. `npm i @sigloch/graphcode-client@^1.3.0` in `/Users/andreas/Developer/dev/graphcode`
   (aktuell `^1.1.0` in `package.json` — der Range würde 1.3.0 schon auflösen, aber die
   Anforderung gehört gepinnt, `package-lock.json` ist der Nachweis).
2. `src/tools/report.ts` — alles in dieser einen Datei:
   - `detailField` (Z. 56): `z.enum(['summary','full'])` → `+ 'grouped'`, Beschreibung nachziehen.
   - `detailOf` (Z. 72) + `project` (Z. 129): dritter Zweig `grouped` →
     `groupViolations(findings)` statt `stripViolationContext(findings)`.
   - Rückgabetypen von `rules_evaluate` (Z. 132) / `rules_get_violations` (Z. 151):
     `Finding[] | ViolationGroup[]`; `total` bei `rules_get_violations` bleibt `matched.length`
     (Zahl der Verstöße, NICHT der Gruppen).
   - `full` bleibt Default und semantisch unangetastet (mcp.mutate-violations, CR-GC-309).
3. Test: Antwortgröße auf dem realen Graphen messen (`grouped ≪ summary ≪ full`) — offenes
   Akzeptanzkriterium.

### Teil 3 — gve importiert statt zu kopieren (NACH dem Publish)

Folge-CR in `graph-view-edit` (Dep dort `">=1 <2"`, Lockfile muss neu aufgelöst werden):
`vite.config.js` Z. 197 `recommendationGroups` **löschen** und durch
`import { groupViolations } from '@sigloch/graphcode-client'` ersetzen. Betroffene Aufrufer im
selben Zug: `recommendationsPayload` (Z. 225), `gateBlockerGroups` (Z. 236), `gateBlockerRollup`
(Z. 260) sowie `tests/vite-config-load-graph.test.mjs` (importiert `recommendationGroups`
namentlich). Keine parallelen Pfade: die lokale Kopie wird entfernt, nicht deprecated.
