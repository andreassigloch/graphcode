# CR-GC-696: Nachzug Lokal-Modus: rote Spikes/Tests nach Major + Operatoren, Vorschlag-Leser ohne add-node

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-614 (finding)
**Erstellt:** 2026-09-27
**Item:** bok/items/ITEM-2026-614.json (Lane: code)

---

Nachzug Lokal-Modus (2026-09-27), rot auf master nach Ontologie-Major und CR-SM-356/367: (1) tests/steering.divergence-two-profiles.test.ts: Kriterium Schrittzahl setzt einen Ein-Kanten-Zugraum voraus; ein RD-04-add-node-Zug erreicht +0,495 Richtung SCALABLE gegen +0,3226 der alten 5-Kanten-Kette. Entscheidung (Koordinator): Reichweite zum Zielprofil statt Schrittzahl messen, Divergenz der beiden Profile bleibt das Kriterium. (2) tests/arch.optimization-dry-run.spike Lauf A: 15-Schritt-Deckel durch BW-02/CR-01-Umhaenge-Zuege (CR-SM-356). (3) generate.test (1), generate.task (6), claims.conformance (2), skill-rule-ids CR-R05 Hilfe-Prompt se-plan vs Dimensions-Skill - Ursache je Test klaeren. (4) Leser der Vorschlagsform ohne node/edges/retires: executor-prompt.ts zeigt einen Vorschlag als eine Kante; noteTemplateEdits in src/surface/mcp-tools.ts identifiziert Edits nur ueber source/target. NACHTRAG nach CR-GC-669..695 (2026-09-27): (5) RC-10 (CR-SM-344), CR-R05, FC-05 fehlen in graphcodes Regelkatalog/Readiness-Modell: tests/readiness.model, evaluation.rule-catalog, claims.conformance (Engine-Regelzahl 66 -> 68 in Artikeln 03/04). (6) Rig-Korpora mit alten kinds-Werten (golden sigllm-v98, opus5-Laeufe): read-tools.scope, working-set.spezlauf, Korpus-Teile von generate.statemachine - Datenmigration mit scripts/migrate-req-kinds.mjs (CR-GC-669). (7) channel-rank.test.ts rot seit 673/674/684. (8) perf.advisory-roundtrip.spike rot (Wachstumsfaktor, nicht kinds). NICHT hier: executor.preflight, generate.*, steer-optimum -> CR-GC-672.

---

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
