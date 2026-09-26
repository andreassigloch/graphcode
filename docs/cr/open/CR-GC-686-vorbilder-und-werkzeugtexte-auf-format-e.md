# CR-GC-686: Vorbilder und Werkzeugtexte auf Format-E: Skills, SCHEMA-01-fixHint, graph_merge-Beschreibung

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-602 (idea)
**Erstellt:** 2026-09-26
**Item:** bok/items/ITEM-2026-602.json (Lane: code)

---

Teil von ITEM-2026-571. JSON-commands als Vorbild ersetzen durch Format-E: .claude/commands/se/close-violations.md:11-12, se/optimize.md:70-81, se-fmea.md:128, se/import-doc.md:99-106 (Transport - pruefen, ob Format-E geht); SCHEMA-01-fixHint src/kernel/gate.ts:73-77; Werkzeugtexte write.ts (commands als Alternative, graph_merge-Beschreibung = Knoten-Merge statt Branch-Replay - BUG); README und rig/code-test/run-code.mjs (graph_realize). NICHT: executor-prompt.ts AUTHORING_PARAMS (Executor-Dateien gehoeren der CR-GC-682-Session).

---

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.

## Umfang (9 Dateien)

`.claude/commands/se/close-violations.md`, `se/optimize.md`, `se-fmea.md`, `se/import-doc.md`,
`src/kernel/gate.ts` (SCHEMA-01-fixHint), `src/surface/write.ts` (Werkzeugtexte, graph_merge; formatE-Beschreibung nennt vorab: Knoten-Operationen `+ ~ - !` stehen unter `## Nodes` + `### <TYPE>`, Kanten unter `## Edges` — Nachtrag aus CR-SM-369),
`README.md`, `rig/code-test/run-code.mjs`, `tests/skills.mcp-conformance.test.ts` (kein JSON-commands-Vorbild).

**Nach CR-GC-685** (write.ts, README und Rig nennen dann kein graph_realize mehr).

## Akzeptanz

- [ ] Rot zuerst: Konformanztest findet heute JSON-commands-Vorbilder in den vier Skills.
- [ ] graph_merge-Beschreibung beschreibt Branch-Replay (log, sinceVersion), Knoten-Merge verweist auf Format-E `M`.
- [ ] Smeagol gruen (`tests/skill-rule-ids.test.ts`, `tests/policy-herkunft.test.ts`).
- [ ] VOLL-Lane gruen.
