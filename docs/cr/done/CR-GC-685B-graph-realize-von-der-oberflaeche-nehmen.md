# CR-GC-685B: graph_realize von der MCP-Oberflaeche nehmen

**Status:** ✅ Done (2026-09-27)
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

- [x] Rot zuerst: Registry enthielt `graph_realize` (`tests/mcp.realize.test.ts`, 1/7 rot).
- [x] `tools/list` ohne `graph_realize`: **24 Werkzeuge / 34.591 Zeichen → 23 / 31.201**
  (−3.390; gemessen als `JSON.stringify({name, description, inputSchema})` je Werkzeug, master vs.
  Zweig, gleiche Methode).
- [x] Veroeffentlichte Werkzeugzahl = Registry: README, Artikel 03 und 05 auf 23, claims-Test gruen.
- [ ] VOLL-Lane → einmal am Ende des Zugs (nach CR-GC-686, gleicher Zweig).

## Ergebnis (2026-09-27)

`graph_realize`, `RealizeBindingSchema`, `GraphRealizeInputSchema`, `bindingFehler` und der
`readTestRefs`-Import sind aus `src/surface/write.ts` geloescht, der Eintrag aus
`NON_CONSULTING_TOOLS`. README-Werkzeugtabelle: `graph_mutate` nennt das Binden
(`~ FUNC-x` + `@realRef`). `verify:code`: 78 Dateien / 586 Tests gruen.

**Bewusst stehen gelassen:**
- `scripts/retro-kpi.mjs` (`GRAPH_SCHREIBT`): klassifiziert AUFGEZEICHNETE Laeufe; alte Transkripte
  enthalten `graph_realize`-Aufrufe und muessen weiter als Schreibzug zaehlen. Kein Oberflaechen-
  bezug, keine Aenderung.
- `rig/code-test/run-code.mjs`, `rig/code-test/README.md`: Prompt-/Beschreibungstext des Rigs —
  gehoert zu CR-GC-686.
- Kommentar in `tests/skill-authoring-gate.test.ts` zitiert den Wortlaut von
  `REQ-skill-authors-through-gate` ("ueber graph_mutate oder graph_realize") — der Wortlaut lebt im
  Modell, s. Graph-Lane.
- Artikel 05 nennt "~4,100 tokens" Werkzeugdefinitionen — eine alte Messung, um ~100 Token zu hoch;
  nicht neu gemessen.
- Fixtures (`tests/fixtures/*.graph.json`, `rig/graphs/*`) und `docs/cr/done/*`: Historie.

## Offen (Graph-Lane)

- CR-Knoten `CR-GC-685B` anlegen/`done` (`aise cr close`).
- FUNC des Werkzeugs `graph_realize` (realRef symbol `graph_realize`, write.ts) ist jetzt hohl:
  `graph_impact` + Loeschzug per `/se-umbau`, danach RC-* kongruent.
- TEST-Knoten zu `tests/mcp.realize.test.ts` (Beschreibung "graph_realize setzt…") und
  `REQ-skill-authors-through-gate` (Wortlaut "oder graph_realize") auf Format-E/`graph_mutate`
  nachziehen; FLOW-Beschreibung "bootstrap, import-code-verb, graph_realize und graph_test_ingest
  lesen es" ohne graph_realize.
