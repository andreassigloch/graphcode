# CR-GC-671: graphcode-Kern auf zwei REQ-kinds und neuen contracts-Floor

**Status:** ✅ Done (2026-09-27)
**Typ:** aus Item ITEM-2026-582 (idea)
**Erstellt:** 2026-09-25
**Item:** bok/items/ITEM-2026-582.json (Lane: code)

---

ZIELBILD (ITEM-2026-575, Diskussion 2026-09-25): REQ.kinds = genau EIN Wert aus {functional, non-functional}. functional -> FUNC; non-functional -> MOD (lokales Budget) | SYS (Systemebene) | FCHAIN (Ende-zu-Ende). Ohne kinds kein Erfueller (BQ-07). pre-/postcondition entfallen (Vorbedingung = Eingangs-FLOW der Kette, Nachbedingung = UC-Ziel, geprueft ueber R-21). risk/mitigation werden ein Rollen-Attribut (FM-01..03), satisfy-neutral. Gemischtes functional+non-functional = falsch zerlegt -> teilen.

ZIEL: Kern auf den Ontologie-Major heben: Peer-Floor @sigloch/contracts auf die Major-Version (der Floor folgt den Imports); Kern-Stellen, die pre/post/risk/mitigation oder BEHAVIOURAL/STRUCTURAL_KINDS kennen, auf den neuen Wertebereich; Rollen-Attribut in Gate/Merge/Readiness durchreichen.

UMFANG (laut grep, <= 10 Dateien): src/kernel/gate.ts, merge.ts, measure/readiness.ts, harness-import.ts; package.json, package-lock.json; Tests apply-commands.kinds, readiness.model, mutate.formate-name, fixtures/perf-basis.graph.json. Weitere Treffer ueber graph_impact vor Beginn — bei > 10 splitten.

ABNAHME: npm run build gruen; graph_tests-Auswahl gruen; volle Suite vor Abschluss; Host bootet auf dem migrierten Eigenmodell ([5]).

REIHENFOLGE der Kette (9 CRs): [1] GC Regel-Matrix + Smeagol-Wertebereich -> [2] SM Rollen-Attribut risk/mitigation -> [3] SM kinds auf zwei Werte + FCHAIN nur NFR (mit [2] EIN Ontologie-Major, Publish durch den Auftraggeber) -> [4] GC Migrationswerkzeug (vor dem Publish baubar) -> [5] GC Eigenmodell migrieren (graph-Lane) -> [6] GC Kern + Peer-Floor -> [7] GC Loop/Executor -> [8] GC Projektionen -> [9] GC Skills + Help. Danach Datenmigration je Familien-Repo (eigene Items, sobald [4] steht). Dies ist [6].

---

## Umfang laut `graph_impact`

Der MCP-Host dieser Sitzung laeuft auf altem Code/alten contracts — Umfang aus dem committeten
Snapshot gelesen (dieselbe Quelle wie `verify:code`): `src/kernel/gate.ts` ist `FUNC-mutate`
(satisfy REQ-confidence-tier, REQ-graph-snapshot-per-commit, REQ-single-write-door) und
`FUNC-evaluate-rules` (REQ-rule-enforcement); `src/surface/bootstrap.ts` ist `FUNC-bootstrap`.
Bindung des Changesets 2/2 (100 %), Testspur `verify:code --plan`: 11 Dateien.

Grep-Befund gegen den geratenen Umfang: `merge.ts`, `measure/readiness.ts`, `harness-import.ts`
kennen weder Altwerte noch BEHAVIOURAL/STRUCTURAL_KINDS (Treffer dort sind das Wort
"precondition" in Prosa bzw. ein Typ-Cast auf `ReqKind`). Attribute laufen dort generisch durch
(`{...base, ...cmd.attributes}`; `toOntologyGraph` reicht `attributes` an die Regeln) — die Rolle
braucht keinen eigenen Pfad. Beleg: CR-GC-669-Probelauf, graphify nach dem Umzug FM-02/FM-03 ueber
`rules_evaluate` an den role-REQ.

## Ergebnis

- `gate.ts` (Element-Vertrag, SCHEMA-02): der fixHint nennt den Wertebereich aus den contracts
  (`ReqKind.options`, `ReqRole.options`) statt einer handgeschriebenen Liste mit sechs Altwerten;
  `role` an einer REQ wird ueber `readReqRole` geprueft — `invalid` blockt wie ein falsches kind,
  `null` bleibt der Grabstein. Nur an REQ (Typ aus dem Kommando oder dem aktuellen Graphen):
  gc_test-graphview traegt `role` an CR-Knoten (Altlast se-trade, CR-GC-308) — die blieben unberuehrt.
- `bootstrap.ts`: Kommentar auf contracts 10.x (kinds non-functional am MOD-satisfy).
- Tests: `mutate.schema-guard` +3 (Altwert `risk` blockt, Hinweis nennt role; ungueltige role blockt
  auch bei update-node ohne type; gueltige role + fremdes CR-role passieren, null raeumt). Rot
  gesehen: ohne den Gate-Zweig 2/3 rot. `apply-commands.kinds`: Beispielwerte ohne precondition.
- **Peer-Floor nicht gehoben:** die gelinkten Pakete tragen noch ihre Registry-Versionen
  (contracts 10.12.0, se-engine 1.9.0, graph-api-core 5.8.0) — der Major hat noch keine
  Versionsnummer. graphcode importiert Neu-Exporte (`ReqRole`, `readReqRole`; dazu schon
  `projections/helpers.ts` aus CR-GC-673), also folgt der Floor im Release-Schritt auf die dann
  vergebene contracts-Version (`aise release prepare` prueft das, BOK-CR-034). Bis dahin ist das Repo
  nur im Link-Modus baubar — der ehrliche Zustand.
- `tests/fixtures/perf-basis.graph.json` bewusst NICHT migriert: der Probelauf mit migrierter Kopie
  (Werkzeug CR-GC-669) liess `perf.advisory-roundtrip.spike` rot (Wachstumsfaktor 6,4 statt < 3,
  vorher 5,5) — der Ausfall kommt nicht von den kinds; die Fixture ist laut Test nur zusammen mit
  einer Neu-Eichung der Schranken zu erneuern.

Tests: `npm run build` gruen; Spur `verify:code` 11/11 Dateien (70 Tests) gruen; dazu Gate-/Format-E-
Tests 14/14 Dateien (121 Tests) gruen. Volle Suite: siehe unten.

**Volle Suite (Link-Modus):** 24 Dateien / 43 Tests rot, 164 gruen. Gegen den Stand vor diesem CR
(gleiche Suite nach CR-GC-669): kein neuer Rotfall durch diesen CR — `channel-rank.test.ts` ist auch
mit weggestashtem Diff rot (kam mit den master-Commits CR-GC-673/674/684 dazu), `distribution` ist
im Link-Modus erwartet. Offen und NICHT Kern-kinds: `smoke.create-harness` (Eigenmodell traegt noch
Altwerte → CR-GC-670), `readiness.model` / `evaluation.rule-catalog` / `evaluation.reconciliation` /
`readiness-conformance-skip` / `claims.conformance` (neue Regel RC-10 aus CR-SM-344 nicht im
Readiness-Modell/Katalog, Regelzahl 66 → 68 in den Artikeln — ohne CR); Tests, die den SSOT lesen
und am Steuerraum-Snapshot mit kinds-ZodError scheitern (`read-tools.scope`, `working-set.spezlauf`,
`readiness.steer`, `steering.*`, `*.spike`, `rig-measured`) → nach CR-GC-670 neu messen; Loop-Tests mit
Altwerten im eigenen Material (`generate.*`, `executor.preflight`, `steer-optimum`) → CR-GC-672;
`perf.advisory-roundtrip.spike` (Wachstumsfaktor, s.o.).
