# CR-GC-619: Ein Lauf behält seine Belege, nicht seinen Zwischenstand

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-491 (finding)
**Erstellt:** 2026-09-23
**Item:** bok/items/ITEM-2026-491.json (Lane: code)

---

## Befund

`rig/greenfield-systemtest/runs/` steht auf **2,2 GB**. Gemessen, wo das liegt:

| Was | je Lauf | gesamt |
|---|---|---|
| `.graphcode/kuzu` (+ `.wal`) | 109 MB | **1,8 GB** |
| `claude-stream.jsonl` | 1,1 MB | — |
| `audit.jsonl`, `graph.json`, `readiness.json`, `usage.json` | < 0,5 MB | — |

Der Store ist der **Zwischenstand**, nicht der Beleg. `captureArtifacts` hat aus ihm längst
`graph.json` (über `graph_export`) und `readiness.json` gezogen und `audit.jsonl` herauskopiert;
danach liest ihn keine Auswertung mehr — `report.mjs` und `rig/code-test/messen.mjs` greifen auf
`.graphcode/audit.jsonl`, nie auf `kuzu`. Und er ist reproduzierbar: `graph.json` ist die SSOT,
aus der ein Reseed denselben Store wieder aufbaut.

Es fehlt also nichts, wenn er weg ist. Es fehlt Platz, wenn er bleibt — und mit jedem Lauf 109 MB
mehr.

## Zielbild

Nach `captureArtifacts` fallen `.graphcode/kuzu` und `.graphcode/kuzu.wal` weg. Alles andere unter
`.graphcode/` bleibt (`audit.jsonl`, `trajectory.jsonl`, `rewind-batches.json`, `prompts/`,
`ontology.schema`) — genau die Dateien, die spätere Auswertungen und der Rewind-Pfad lesen.

Kein Schalter: eine Ausnahme, die man setzen muss, wird nie gesetzt und trägt nur den Zweifel,
ob die Belege vollständig sind. Was ein Lauf beweist, steht in seinen Artefakten.

## Akzeptanzkriterien

- [ ] Nach einem Lauf gibt es `graph.json`, `readiness.json`, `audit.jsonl`, `usage.json` — aber kein `kuzu`
- [ ] Ein Test führt den echten Pfad und prüft beides: was bleibt UND was weg ist
- [ ] Die bestehenden Läufe unter `runs/` werden nicht angefasst (Entscheidung des Auftraggebers)

## Umfang

`rig/greenfield-systemtest/run.mjs`, `tests/systemtest-rig.test.ts`.
