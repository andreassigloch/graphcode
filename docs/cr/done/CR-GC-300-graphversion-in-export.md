# CR-GC-300 — graphVersion-Stempel im `graph_export`-Output (CR-SM-227-Voraussetzung)

**Status:** open
**Datum:** 2026-08-05
**Kontext:** Folge-CR von CR-SM-227 (`sigloch-modules`) — AF-01..05 (Analysis-
Freshness-Legs, contracts) + `computeAnalysisCurrency()` (graphcode-client)
sind dort geliefert und getestet. Der reale Konsument (`graph-view-edit`,
eigenes Repo, CR-GVE-229) kann sie aber nicht sinnvoll verdrahten, weil ihm
ein Vergleichswert fehlt.

## Befund

`docs/graph/<name>.graph.json` (geschrieben von `graph_export`, `src/tools/
export.ts`) enthält nur `{elements, traces}` — keine `graphVersion`. GVE liest
ausschließlich diese committete Snapshot-Datei, nie live gegen den Harness.
`computeAnalysisCurrency(graph, currentGraphVersion)` (CR-SM-227) braucht aber
die LIVE `graphVersion` als Vergleichswert gegen den Freshness-Stempel
(`SYS.attributes.analysisFreshness.<id>.graphVersion`). Ohne echten Wert würde
jeder gesetzte Stempel fälschlich als `current` (grün) gelesen (`stempel >= 0`
ist immer wahr) — ein neuer, stillerer Fehler statt der Behebung des
bisherigen (immer `absent`/rot).

**Fehleinschätzung korrigiert:** `exportGraphJson()` (`src/exporter.ts`) selbst
NICHT anfassen — 9 Call-Sites (`mcp-server.ts` Drift-Check, `fit-advisory.ts`,
`steering.ts`, `steering-snapshot.ts`, `tools/suggest.ts`, `tools/export.ts`),
dokumentiert als „exakte Inverse von `importGraph`, byte-identisch" mit
Round-Trip-/Determinismus-Tests (`tests/exporter.test.ts`), die bei einer
Signaturänderung brechen. Der tatsächliche Konsument ist genau EINE Stelle:
das `graph_export`-Tool, das die von GVE gelesene Datei schreibt.

Reseed-Pfad geprüft (`harness-import.ts`s `seedFromJsonFile`/
`importOntologyGraph`): liest nur `.elements`/`.traces` aus dem geparsten
JSON, kein Schema-Validator dazwischen — verträgt ein zusätzliches
`graphVersion`-Feld ohne jede Änderung dort.

## Ziel

`graph_export`s Handler (`src/tools/export.ts`) fügt `graphVersion:
ctx.graphVersion()` (Wert zum Schreibzeitpunkt, NICHT die beim Bind erfasste
`processStartVersion`) in die geschriebene `docs/graph/<name>.graph.json` ein
— als Nachbearbeitung des unveränderten `exportGraphJson()`-Outputs (z. B.
`JSON.parse` + Feld ergänzen + re-`stringify`, oder ein dünner
schreib-lokaler Wrapper), nicht durch Änderung von `exportGraphJson()` selbst.

## Dateien (≤6)

- `src/tools/export.ts`
- `tests/mcp.export.test.ts` (Regressionstest: geschriebene Datei trägt
  `graphVersion === ctx.graphVersion()` zum Schreibzeitpunkt)
- ggf. `tests/harness.import.test.ts` (Reseed einer Datei MIT `graphVersion`-
  Feld importiert unverändert korrekt — Regressionstest, erwartbar bereits grün)

## Akzeptanzkriterien

- [ ] `docs/graph/<name>.graph.json` trägt nach `graph_export` ein
      `graphVersion`-Feld == `ctx.graphVersion()` zum Schreibzeitpunkt
- [ ] `exportGraphJson()` selbst unverändert — alle 9 bestehenden Call-Sites +
      Byte-Identität-/Determinismus-Tests (`tests/exporter.test.ts`) bleiben
      grün, ohne Anpassung
- [ ] Reseed (`seedFromJsonFile`/`importOntologyGraph`) importiert eine Datei
      mit `graphVersion`-Feld unverändert korrekt (Regressionstest)
- [ ] `npm run build` + Tests grün
