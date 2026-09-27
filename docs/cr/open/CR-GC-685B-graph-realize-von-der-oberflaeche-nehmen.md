# CR-GC-685B: graph_realize von der MCP-Oberflaeche nehmen

**Status:** 🟠 Open
**Typ:** Folge-CR aus CR-GC-685 (Teilung wegen Dateigrenze), Item ITEM-2026-571
**Erstellt:** 2026-09-27

---

CR-GC-685 hat den Bindungsreport (`refs`) ins `graph_mutate`-Ergebnis gelegt, `~` auf unbekannte
uids gesperrt und alle Test-Konsumenten auf Format-E umgestellt. Uebrig ist das Entfernen selbst.
GVE bindet seit CR-GVE-299 ueber `graph_mutate` (Voraussetzung erfuellt).

## Umfang (10 Dateien)

`src/surface/write.ts` (Werkzeug, Schemas, `bindingFehler` weg), `src/surface/mcp-tools.ts`
(NON_CONSULTING_TOOLS), `tests/mcp.realize.test.ts` (Werkzeug nicht mehr in der Registry),
`tests/mcp.agent-agnostic.test.ts`, `tests/skill-report-measured.test.ts`,
`tests/skill-authoring-gate.test.ts`, `tests/claims.conformance.test.ts` (24 → 23),
`README.md` (Werkzeugtabelle, Zahl, Absatz), `docs/articles/03-graphcode-harness-goal-and-concept.md`,
`docs/articles/05-the-advisory-roundtrip.md` (Zahl).

## Akzeptanz

- [ ] Rot zuerst: Registry enthaelt `graph_realize` noch.
- [ ] `tools/list` ohne `graph_realize`; Zeichen der Oberflaeche vorher/nachher.
- [ ] Veroeffentlichte Werkzeugzahl = Registry (claims-Test).
- [ ] VOLL-Lane gruen.
