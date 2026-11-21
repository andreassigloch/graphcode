# CR-GC-985: FLOW-mutate-answer ist an SCHEMA-mutate-result gebunden, traegt aber die Werkzeug-Antwort von graph_mutate

**Typ:** aus Item ITEM-2026-1544 (finding)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1544.json (Lane: code)

---

## Befund

Folge von CR-GC-982 bis 984 (Klassifikation: SCHEMA an einem FLOW, dessen Wert der Vertrag nicht trägt). `FLOW-mutate-answer` war an `SCHEMA-mutate-result` gebunden (`MutateResultSchema`, `@sigloch/contracts/harness`). Das ist der Vertrag von `harness.mutate` im Prozess. Die Antwort des Werkzeugs `graph_mutate` (`src/surface/write.ts`) ist ein anderer Wert: ohne `violations` und `graphVersion` aus dem Gate-Urteil, dafür `graphVersion` immer, `violations` gefaltet oder je Element, die Berichte zum Zug (`steerAdvisory`, `workOrder`, `metricsAfter`, `berichtFehlt`), `steeringDelta`, `vorschlag`, `refs`, `nameWarning`, `occWarning`. Der Typ stand als Inline-Typ im `MCPTool`, geparst wurde nichts.

Stand graphVersion 1418: R-26 8, R-32 11, RC-04 15 (SCHEMA-mutate-result gehört zu den 15), CR-R01 1 (dieser CR, bis die Kanten stehen).

**Flüsse an SCHEMA-mutate-result, am Code geprüft.**

| FLOW | Was trägt er | Beleg | Entscheid |
|---|---|---|---|
| `FLOW-mutate-answer` | Antwort von graph_mutate an die Ablaufsteuerung | `write.ts`, Handler `graph_mutate`; `mcp-server.ts` `bindRegistryToMcpServer` gibt `handler(...)` zurück | umgebunden |
| `FLOW-mutate-answer-host-socket` | dieselbe Antwort über host.sock | `host-shim.ts:79-100` `handleLine`: `tool.handler(req.input)` | umgebunden |
| `FLOW-mutate-answer-import-code-verb` | dieselbe Antwort an den Code-Import | `import-code-verb.ts:297` `registry['graph_mutate'].handler(...)` | umgebunden |
| `FLOW-vorschlag` | das Feld `vorschlag` der Antwort | `write.ts`, `vorschlagNachAnwendung` im Rückgabewert | umgebunden (Feld des neuen Vertrags) |
| `FLOW-gate-verdict` | Urteil von `harness.mutate` im Prozess, an die Werkzeuge und die Post-Apply-Hooks | `kernel/hooks.ts` `runPostApplyHooks`, Gate-Ergebnis vor `mitBericht` | bleibt an `SCHEMA-mutate-result` |
| `FLOW-proxy-answer`, `FLOW-proxy-answer-agent` | Antwort des Hosts an die angedockte Sitzung für jedes Werkzeug | `host-shim.ts:181` `dispatch(tool, input)` ist für alle Werkzeuge gleich | bleiben, dem Autor vorgelegt (Entscheidungen) |

**Unstimmigkeit an elementId (ITEM-2026-1085).** Sie liegt in zwei Verträgen: `GateViolation.elementId` ist Pflicht (`@sigloch/graphify`), `MutateResultSchema.violations.elementId` optional (contracts). Beides liegt außerhalb dieses Vertrags. In diesem Vertrag liegt die Folge: `reseedTransport` (`import-code-verb.ts`) las `graph_mutate` im Default `summary`, dort trägt kein Befund `elementId`, und schrieb `''` samt `{el}` in der Meldung an graphify (gleiche Ursache wie CR-GC-860 für `se:import-doc`). Der Import fordert jetzt `violations: 'full'` an und liest die Antwort gegen den Vertrag, nicht per Cast. Der Kommentar an `MutateTransportResult` und das Pflichtfeld in `GateViolation` gehören zu graphify (ITEM-2026-1085 bleibt dort offen).

## Änderung

**Code (4 Quelldateien).**

- `src/surface/mutate-answer.ts` (neu): `GraphMutateAnswerSchema` aus `MutateResultSchema.omit({violations, graphVersion})`, `ZugBericht` ohne `fitAdvisory` (partial: Berichte, die nichts melden, fehlen auf der Leitung), `SteeringDelta`, `GroupedViolationSchema`, `RuleViolationSchema.strict()` (je Element, strikt: ein missratener gefalteter Eintrag geht nicht als Eintrag je Element durch), `BindingReportSchema`. Typ per `z.infer`.
- `write.ts`: der Inline-Typ des `MCPTool` und das `interface BindingReport` sind gelöscht; der Handler parst die Antwort vor der Rückgabe (`GraphMutateAnswerSchema.parse`, ein Aufruf für alle Rückgabewege: Anwendung, Probelauf, OCC, SKILL, STRUCT, Gate-Ablehnung). Zurück geht das Original.
- `kernel/evaluation.ts`: `GroupedViolation` ist `GroupedViolationSchema` (strikt), das `interface` entfällt; Verwender: nur `write.ts`.
- `import-code-verb.ts`: `violations: 'full'`, Lesen per `GraphMutateAnswerSchema.parse`, der Cast `as MutateResult` entfällt.

**Modell.** Neuer `SCHEMA-mutate-answer` mit `realRef`; vier FLOW umgebunden (delete-edge der alten, add-edge der neuen Kante in einem Batch); `TEST-vertrag-mutate-answer` mit `verify`; CR-Kanten auf beide SCHEMA und die FUNC `FUNC-graph-mutate-tool`, `FUNC-import-code-verb`. `SCHEMA-mutate-result` hängt weiter an `FLOW-gate-verdict`, den zwei Proxy-FLOW und `TEST-contracts-surface`.

**Tests (4 Dateien, davon 1 erzeugt).**

- `tests/vertrag/SCHEMA-mutate-answer.vertrag.test.ts` (erzeugt, 311 Fälle, `node dist/cli.js vertragstest SCHEMA-mutate-answer`; Fan-out, nicht gezählt).
- `tests/vertrag/SCHEMA-mutate-answer.elemente.test.ts` (Hand, 13 Fälle): Zähler ganzzahlig und nicht negativ, `graphVersion`, `confidence` 0 bis 1, `tier`, Befund ohne Meldung, falsche Schwere, `openRefs`, Steuerdelta, `staleDelta`, Berichte, leere Listen gelten.
- `tests/mcp.mutate-answer.test.ts` (neu, 10 Fälle am echten Werkzeug, Kuzu auf Platte): Probelauf summary und full, Anwendung mit und ohne `baseVersion`, Fehlerregel (block), OCC, unbekannter Skill, Format-Fehler im Probelauf und bei Anwendung, `nameWarning`, `refs`.
- `tests/import-code-befund-element.test.ts` (neu, 1 Fall).

## Nachweis rot-zuerst

Mutanten, je zurückgenommen (die geprüften Dateien: Vertrag erzeugt, Hand, Werkzeug):

| Mutante | Ergebnis |
|---|---|
| Verdrahtung: `graphVersion` der Antwort als String | 6 rot (der Handler wirft) |
| `vorschlag` als Zahl | 16 rot |
| Liste ohne gefaltete Variante | 23 rot |
| `openRefs` ohne int und nonnegative | 1 rot (Hand) |
| `graphVersion` optional | 1 rot (erzeugt) |
| je-Element-Liste nicht strikt | 1 rot (Hand: gefalteter Eintrag mit falschem Element) |
| Import ohne `violations: 'full'` (alter Zustand) | 1 rot (kein Befund mit elementId) |

## Akzeptanz

- [x] Regeln (`rules_evaluate` grouped, graphVersion 1420): R-26 8 und R-32 11 unverändert (das neue SCHEMA ist von Anfang an gebunden und verifiziert); RC-04 15 unverändert (`SCHEMA-mutate-result` bleibt in der Liste: sein Wert ist das Urteil im Prozess, nicht die Antwort; `SCHEMA-mutate-answer` kommt nicht hinzu); CR-R01 1 -> 0 (dieser CR trägt jetzt Kanten). Kosten des neuen Vertrags: CR-01 an MOD-agent-surface/MOD-surface 10 -> 11 und R-04 an MOD-agent-surface 20 -> 21; die Warnungen bestanden schon, die Zähler stiegen um einen Vertrag.
- [x] `npm run type-check` und `npm run build` grün.
- [x] `verify:code` grün: 77 Dateien, 1047 Tests, Bindung 4/4, Rückmeldung 60 Ergebnisse, 0 zurückgenommen. Der erste Lauf war rot an zwei Tests: RC-08 (`GraphMutateAnswerSchema` stand als `X.omit().extend()` auf einem importierten Schema, der Erkenner liest nur `z.…` oder ein Zod-Const derselben Datei: auf `z.object({...Schema.shape})` umgestellt) und der Spike `tests/arch.optimization-dry-run.spike.test.ts` (festgeschriebene Messung der Autopilot-Züge; ohne diesen CR im Worktree von HEAD grün, mit dem neuen Vertrag an der Grenze zwei Züge mehr und anderer Engpass: neu gemessen und mit Datum und Ursache nachgezogen, wie die Einträge davor; die Aussage „kein Zug fachlich begründet“ bleibt).
- [x] Smoke: `node dist/cli.js status` startet; `graph_mutate` über den Host (alter Code im laufenden Host, nicht neu gestartet) antwortet; den neuen Parse belegen die Tests.
- [ ] `verify:full CR-GC-985` (folgt, Ergebnis unten).

---

## Entscheidungen

| Frage | Festlegung | Begründung |
|---|---|---|
| `FLOW-proxy-answer` und `FLOW-proxy-answer-agent` tragen die Antwort des Hosts für jedes Werkzeug, hängen aber an `SCHEMA-mutate-result`. Welcher Vertrag trägt sie? | offen, beim Autor | `dispatch(tool, input)` in `host-shim.ts:181` kennt kein Werkzeug; ein Schema je Werkzeug hieße ein FLOW je Werkzeug (FAQ `flow-ein-schema`, `vertrag-je-variante`) |
| `SCHEMA-mutate-result` | bleibt, ein Knoten wird nie gelöscht | hängt noch an `FLOW-gate-verdict`, zwei Proxy-FLOW und `TEST-contracts-surface` |
| ITEM-2026-1085 (`GateViolation.elementId` Pflicht, contracts optional) | bleibt offen, gehört zu graphify und contracts | nicht Teil dieses Vertrags |

---

## Umfang laut `graph_impact`

`graph_impact(SCHEMA-mutate-result)` (vorher): FLOW `FLOW-gate-verdict`, `FLOW-mutate-answer`, `FLOW-mutate-answer-host-socket`, `FLOW-mutate-answer-import-code-verb`, `FLOW-proxy-answer`, `FLOW-proxy-answer-agent`, `FLOW-vorschlag`, CR-GC-823, `TEST-contracts-surface`. `graph_context(FLOW-mutate-answer)`: io zu `FUNC-graph-mutate-tool` und `FUNC-agent-loop`. Dateien: 4 Quelldateien, 4 Handtests (`SCHEMA-mutate-answer.elemente`, `mcp.mutate-answer`, `import-code-befund-element`, der nachgezogene Spike `arch.optimization-dry-run.spike`), 1 erzeugter Test (Fan-out); 8 gezählte Dateien, unter der Grenze von 10.
