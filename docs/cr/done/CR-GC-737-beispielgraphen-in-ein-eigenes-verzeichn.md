# CR-GC-737: Beispielgraphen in ein eigenes Verzeichnis: rig/graphs, Fixture-Graphen und sigllm-Golden eingefroren unter beispielgraphen/

**Status:** ✅ Done (2026-10-05)
**Typ:** aus Item ITEM-2026-740 (idea)
**Erstellt:** 2026-10-05
**Item:** bok/items/ITEM-2026-740.json (Lane: code)

---

CR 1 von 5 des Konzepts [`docs/graphcode_messaufbau_konzept.md`](../../graphcode_messaufbau_konzept.md)
(Rig · Auswertung · Beispielgraphen).

## Befund

Eingefrorene Graphen lagen an drei Orten: `rig/graphs/` (fünf Repo-Exporte), `rig/greenfield-systemtest/results/`
(vier Fixture-Graphen des Executor-Programms) und `rig/sigllm-spezifikation/golden/` (das handgeführte Golden
mit seinem Audit-Trail). Zehn Leser in `tests/` und `scripts/` zeigten auf drei Pfade; zwei Rigs, die mit dem
Konzept fallen, trugen Dateien, die bleiben müssen.

## Umsetzung

- `beispielgraphen/` = `rig/graphs/` (git mv) + `gc-run-haiku45`, `gc-run-devstral-v14` (Leser `nd-similarity`)
  + `sigllm-v98.graph.json` und sein Audit als `sigllm-v98.audit.jsonl` (Leser `generate.statemachine`,
  `trajektorie.referenzTrail` löst `<golden>.audit.jsonl` auf). `gc-run-devstral-v9`/`-opus5` bleiben in
  `results/`: ihr einziger Leser (`minimal-whitebox/run-phase1-authoring.mjs`) fällt mit CR 4 — Regel 5.
- README: drei neue Zeilen mit Herkunft, Umfang, sha256/12; die Leser je Graph; alte Prüfsummen unverändert.
- Leser umgestellt: `scripts/randbreiten.mjs`, `scripts/model-test-set.mjs` (Begründungstexte), acht Tests,
  `rig/code-test/run-code.mjs` (fällt mit CR 4, bricht bis dahin nicht), `rig/README.md`.

## Verifikation

`npx vitest run` auf den neun lesenden Tests: 132 grün. `npm run verify:full CR-GC-737`: 1812 grün, rot nur `tests/distribution.test.ts` — der dokumentierte
Publish-Pending-Zustand (graphcode-client 1.6.0 vorbereitet, nicht publiziert), kein Befund dieser CR.
