# CR-GC-817: Dashboard bekommt Kennzahlen als drei Fluesse statt der einen graph_metrics-Antwort

**Status:** ✅ Done (2026-10-16)
**Typ:** aus Item ITEM-2026-970 (finding)
**Erstellt:** 2026-10-16
**Item:** bok/items/ITEM-2026-970.json (Lane: graph)
**Art:** Modellzug, kein Code

---

## Befund

Am UC „Modellstand live mitlesen" kamen beim `ACTOR-dashboard` fünf Flüsse an. Drei davon —
`FLOW-module-metrics`, `FLOW-function-criticality`, `FLOW-chain-metrics` — liefen direkt von der
jeweiligen Rechen-FUNC zum Dashboard. Im Code ruft der GVE-Server `graph_metrics` **einmal** über
`host.sock` (`graph-view-edit/vite.config.js:716`) und bekommt **eine** Antwort mit allen Blöcken
(`src/projections/metrics.ts:103`). Das Modell zeigte den Rechner statt des Auslieferers — dasselbe
Muster wie CR-GC-813. Die Antwort existierte schon als `FLOW-metrics-answer`, hing aber nur an
`FUNC-agent-loop`.

Beifang: `FLOW-metrics-answer` trug nur `SCHEMA-chain-metrics`, obwohl die Antwort auch Modul- und
Funktionsblöcke enthält; `FLOW-function-criticality` behauptete, das Dashboard rendere die Kritikalität
nicht (`Dashboard.jsx:813` rendert sie).

## Änderung

- `FLOW-metrics-answer -io-> ACTOR-dashboard`; die drei direkten Kanten der Teilflüsse ans Dashboard entfernt.
- Beschreibungen nachgezogen; die offenen Differenzen stehen jetzt an der Antwort (siehe unten).

Ergebnis: drei eingehende Flüsse am Dashboard — `FLOW-metrics-answer` (sync, host.sock),
`FLOW-health-report` (sync, `/health`), `FLOW-sse-frame` (async, `/events`). Die drei Teilflüsse
bleiben innerhalb von graphcode getrennt (je Erzeuger ein Fluss, in `FUNC-graph-metrics` hinein).

## Benannte offene Differenzen

- **Vertrag der Antwort:** `FLOW-metrics-answer` trägt weiter nur `SCHEMA-chain-metrics`. Versucht und
  zurückgenommen: ein eigenes `SCHEMA-metrics-answer` an `bindMetricsTools` — R-18 erlaubt genau ein
  SCHEMA je FLOW, RC-08 verlangt für einen lokal gebundenen Vertrag ein Zod-Schema, und contracts
  liefert keines für modules, functions, chains (nur `MetricPolicySchema`). Ein lokaler Nachbau wäre ein
  Fork. ITEM-2026-972; braucht einen contracts-Bump (Familie).
- **Rendering:** das Dashboard rendert modules und functions, chains noch nicht.

## Nicht enthalten

Der GVE-Server ruft über `host.sock` auch `rules_evaluate` und `graph_suggest`; diese Wege zum
Dashboard fehlen im Modell. ITEM-2026-971.
