# CR-GC-876: se-view-Skills entfernen: paralleler Pfad zu auto-export docs/views (fmea rendert von Hand)

**Status:** ✅ Done (2026-11-02)
**Typ:** aus Item ITEM-2026-1111 (finding)
**Erstellt:** 2026-10-28
**Item:** bok/items/ITEM-2026-1111.json (Lane: graph)

---

## Befund

Die 11 Skills unter `.claude/commands/se-view/` sind ein zweiter Pfad zu den Sichten. Der Exporter schreibt
`docs/views/*.md` nach jeder angewandten Mutation selbst (TEST-auto-export). Zehn Skills rufen nur
`graph_export` und geben die Datei aus. `se-view:fmea` rendert dagegen von Hand aus Abfragen, und
`docs/views/fmea.md` (renderFmea, TEST-view-fmea) zeigt dasselbe deterministisch. Jede Sicht hat einen
Renderer im Exporter (`MARKDOWN_VIEWS`), auch conops, implplan, intplan und changelog.

## Entscheidung des Autors (2026-10-28)

- Der Ordner `se-view/` zählt als eine Datei. Der Umbau läuft als drei CRs:
  1. **CR-GC-876 (dieser):** Ordner löschen, Modell-Zug, README, `help-content.ts`.
  2. **Folge-CR:** Verweise in 6 Skill-Texten und 5 Quell-Kommentaren.
  3. **Folge-CR:** `update` und `remove` der Scaffold entfernen se-Dateien, die das Paket nicht mehr ausliefert.
     Belegt: graphify trägt noch `se-view/trade.md` aus CR-GC-756.
- Die Hilfe von `R-04` (`prompt: "se-view:arch"`) liegt in `@sigloch/contracts/se/rule-help.ts`. Sie geht als
  Item an sigloch-modules (Familie, Version-Bump). Bis dahin bleibt die Ausnahme `R-04` in
  `tests/skill-rule-ids.test.ts` stehen.

## Umfang laut `graph_impact` (graphVersion 981, vor der Löschung gelesen)

| Knoten | eingehend | ausgehend |
|---|---|---|
| `FUNC-render-views` (realRef `se-view/arch.md`, vertritt arch, implplan, nfr, testconcept, testmatrix) | compose von FCHAIN-doc-export, FUNC-block-dokumentenwerk; io von FLOW-skill-request; 10 CR-relation | satisfy REQ-doc-export, allocate MOD-agent-surface, io FLOW-anleitung-render-views |
| `FUNC-view-{changelog,conops,fmea,icd,intplan,rtm}` | dieselben drei Kanten; CR-relation (fmea 4, rtm 4, sonst 1) | dieselben drei, je eigener FLOW-anleitung-view-* |

- **satisfy:** keine REQ wird unerfüllt. `REQ-doc-export` behält `FUNC-export-markdown` als Erfüller.
- **realRef:** alle 7 zeigen nach der Löschung ins Leere — darum Knoten löschen, nicht umhängen.
- **compose:** `FCHAIN-doc-export` verliert 7 Glieder. Es bleiben agent-loop, export-markdown,
  graph-export-snapshot, graph-store. Die Beschreibung („meist aus einem se-view-Skill") wird falsch.
- **Flüsse:** je FUNC ein `FLOW-anleitung-*` (io zu FUNC-agent-loop, relation zu SCHEMA-skill-text). Ohne
  Skill gibt es keine Anleitung. Die 7 FLOW entfallen mit.

## Modell-Zug (ein Batch, `dryRun` zuerst)

- `-` die 7 FUNC und die 7 FLOW-anleitung (render-views, view-changelog, view-conops, view-fmea, view-icd,
  view-intplan, view-rtm) mit ihren Kanten.
- `~ FCHAIN-doc-export`: Auslöser ist die angewandte Mutation oder ein `graph_export`-Aufruf, kein Skill.
- `~ FUNC-block-dokumentenwerk`: „und die se-view-Sichten" entfällt.
- `~ TEST-skills-mcp`: „(se-view/* → REQ-doc-export)" entfällt. Prüfpunkt: verify auf REQ-doc-export trägt
  ohne Skill-Erfüller keine Bedeutung mehr — per `graph_context` klären, ob die Kante auf die Skill-REQ wandert.
- `CR-GC-876 -relation->` REQ-doc-export, FCHAIN-doc-export, FUNC-export-markdown, MOD-agent-surface.

## Dateien

| Datei | Änderung |
|---|---|
| `.claude/commands/se-view/` (11 Dateien) | gelöscht |
| `README.md` | 9 Zeilen `se-view:*` entfallen; ein Satz: die Sichten stehen in `docs/views/` |
| `src/projections/help-content.ts` | 15 Verweise: Render-Prompts nennen `docs/views/<datei>.md` statt `se-view:*` |
| `tests/help-content.test.ts` | neu: kein `prompt` und kein `se`-Text nennt `se-view:` |
| `docs/graph/graphcode.graph.json`, `docs/views/*` | Modell-Zug, Export |

## Testspur (`graph_tests`)

`vitest run tests/auto-export.test.ts tests/exporter.test.ts tests/mcp.export.test.ts tests/mcp.member-name.test.ts
tests/skills.mcp-conformance.test.ts tests/view-fmea.test.ts tests/views.auditor.test.ts tests/views.conformance.test.ts`
— 8 TEST, alle gebunden, `unresolved` leer. Dazu `tests/help-content.test.ts`, `tests/skill-rule-ids.test.ts`,
`tests/cli.scaffold.test.ts` (ausgelieferte Skill-Liste). VOLL einmal vor dem Schließen.

## Belegter Schaden des zweiten Pfads

CR-GC-875 (f5fb6015) hob `se-view/conops.md` von v3 auf v4 und schrieb die Rollen aus `chainRoles` in deren
Tabelle. Die Sicht kam schon vorher aus `renderConOps` (CR-GC-873, f02a3a89); die Änderung an
`docs/views/conops.md` im selben Commit stammt aus dem Re-Export, nicht aus dem Skill. Die Skill-Tabelle war eine
zweite Beschreibung des Renderers, die jede Änderung an ihm von Hand nachziehen muss. Inhaltlich stimmt sie mit dem
Renderer überein (dieselben vier Etiketten); sie entfällt mit diesem CR.

## Umsetzung (2026-10-28)

- Modell-Zug angewandt (graphVersion 988 → 989), abweichend vom Plan oben:
  - `FUNC-block-dokumentenwerk` gelöscht statt umbeschrieben. Mit nur `FUNC-export-markdown` als Kind
    feuerte RD-05; das Umhängen von graph-export-snapshot und auto-export aus Speicherwerk feuerte BW-02
    (8 Verträge). `FUNC-export-markdown` hängt jetzt direkt an `FUNC-block-grounding`. Beide Varianten im
    `dryRun` gemessen; die gewählte bringt keine neue Warnung.
  - `TEST-skills-mcp` verifiziert jetzt `REQ-agent-loop-executes-skill` statt `REQ-doc-export`.
  - `CR-GC-756 -relation-> FUNC-export-markdown`: seine einzige Umfangskante zeigte auf FUNC-render-views (CR-R01).
  - `CR -relation-> FCHAIN` ist illegal (R-18); die Kante entfällt.
- `tests/help-content.test.ts`: neuer Test, vor der Änderung rot mit 17 Verweisen auf gestrichene Skills.
- Offen: `tests/skill-rule-ids.test.ts` „jeder RULE_HELP.prompt nennt einen ausgelieferten Skill" ist rot,
  weil `R-04.prompt` in contracts `se-view:arch` nennt (ITEM-2026-1113).

## Abnahme

- `ls .claude/commands/se-view` scheitert; `grep -rn "se-view:" README.md src/projections/help-content.ts` leer.
- `graph_elements({search:"se-view"})` zeigt keine FUNC und keine FLOW mehr.
- `rules_evaluate`: kein neuer Fehler; RC-* kongruent oder hier benannt.
- Testspur grün, `npm run verify:full CR-GC-876` grün.
