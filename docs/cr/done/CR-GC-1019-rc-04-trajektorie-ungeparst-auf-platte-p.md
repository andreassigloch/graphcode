# CR-GC-1019: RC-04: Trajektorie ungeparst auf Platte, Prozess-Vertraege ohne Grund

**Typ:** aus Item ITEM-2026-1626 (finding)
**Erstellt:** 2026-11-23
**Item:** bok/items/ITEM-2026-1626.json (Lane: code)

---

## Befund

RC-04 meldet 10 SCHEMA, deren Zod-Schema an keiner modellierten Schnittstelle geparst wird. Am Code geprüft fallen sie in drei Gruppen:

- **Echte Grenze, ohne Parse:** `SCHEMA-trajectory`. `materializeTrajectory` schreibt `trajectory.jsonl` auf die Platte. Den Parse macht nur der Helfer `projectTrajectory` aus learning-core, und den sieht RC-04 nicht.
- **Typ im selben Prozess:** completeness, impact-slice, mcp-tool, metric-vector, mutate-result, ontology-graph, rule-violation und steering-snapshot. Kein Fluss verlässt den Prozess. Wo die Daten nach außen gehen, tragen sie einen eigenen, geparsten Vertrag. Nach FAQ `rc04-parse-an-der-grenze` Punkt 4 (in graphcode entschieden, CR-GC-413) wird hier kein Parse erzwungen. Bisher nannte aber keine Beschreibung den Grund.
- **Schon begründet:** `SCHEMA-skill-text` (CR-GC-1017).

## Zug

1. `materializeTrajectory` parst jede Grundzeile mit `TrajectorySchema`, bevor sie auf die Platte geht.
2. Die acht SCHEMA im Prozess bekommen den Grund in die Beschreibung (FAQ `befund-stehen-lassen`, RC-04 ist nicht abnehmbar).
3. Nachtrag zu CR-GC-1017: RC-04 meldete danach `SCHEMA-audit-stats-input`. `FUNC-audit-stats` zeigte auf `aggregateAuditEntries` in `audit-stats.ts`, der Aufruf kommt aber im Handler `audit_stats` in `audit.ts` an, und dort steht der Parse. Die realRef zeigt jetzt auf die Werkzeugkonstante, nach dem Vorbild von `FUNC-graph-readiness`.

## Abnahme

- RC-04 nennt `SCHEMA-trajectory` nicht mehr.
- Jedes SCHEMA, das RC-04 noch nennt, trägt den Grund in seiner Beschreibung.
- verify:code ist grün.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| keine | | |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1579, Tiefe 1, Wurzeln: `SCHEMA-trajectory`._

Reichweite: 1 Elemente (FLOW 1); Blackbox-Rand 1, nicht geoeffnet.

Dateien (realRef, 1):
- packages/learning-core/src/interfaces/trajectory.ts

Tests (`graph_tests`, 1):
- tests/vertrag/SCHEMA-trajectory.vertrag.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
