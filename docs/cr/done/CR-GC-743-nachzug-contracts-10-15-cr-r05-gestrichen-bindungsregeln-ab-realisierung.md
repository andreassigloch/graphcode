# CR-GC-743: Nachzug contracts 10.15 — CR-R05 gestrichen, Bindungsregeln zählen erst ab Beginn der Realisierung

**Status:** ✅ Done (2026-10-05)
**Typ:** aus Item ITEM-2026-752 (finding)
**Erstellt:** 2026-10-05
**Item:** bok/items/ITEM-2026-752.json (Lane: code)
**Deckt:** contracts CR-SM-390 (CR-R05 entfällt, `RULES_VERSION` 35.0.0) und CR-SM-392 (Vorbedingung
`realisierung-begonnen` an R-19/R-20/R-26/RC-10, `ruleApplies(ruleId, graph)`).

---

## Befund

Gegen die Arbeitskopie `@sigloch/contracts` 10.15.0 (`RULES_VERSION` 37.0.0, unveröffentlicht, Link-Modus):

- `src/kernel/measure/readiness.ts` rief `ruleApplies(id, countByType)` — die Signatur ist seit CR-SM-392
  `ruleApplies(ruleId, graph)`; zur Laufzeit ein `TypeError`, im Build ein Typfehler.
- `tests/readiness.model.test.ts` verlangte `RULE_PRECONDITION` ∋ `CR-R05` — die Regel gibt es nicht mehr.
- Zehn Testdateien prüften „FUNC/TEST/SCHEMA ohne Bindung → R-20/R-19/R-26" an Graphen ohne Bauplan-Stempel und
  ohne Bindung. Dort sind die Regeln jetzt nicht gestellt; acht der zehn wurden rot, zwei Fälle wären still grün
  geblieben (s. Fixtures).
- Zwei Artikel und der Kanarienvogel nannten 68 scorende Regeln; es sind 67.

## Umsetzung

- `src/kernel/measure/readiness.ts`: `computePhaseReadiness(violations, graph: OntologyGraph)` fragt
  `ruleApplies(id, graph)`. `typeCounts` ist gelöscht (einziger Zweck war die alte Signatur).
- Rufer: `src/kernel/measure/steering-snapshot.ts` (reicht `og`), `src/projections/report.ts`
  (`toOntologyGraph(harness.getGraph())` — derselbe Mapper wie der Regelpfad). Weitere Leser von
  `ruleApplies`/`RULE_PRECONDITION` gibt es in `src/`, `scripts/`, `rig/`, `auswertung/` nicht.
- `src/loop/generate.ts`: Kommentar ohne CR-R05.
- `package.json`: `@sigloch/contracts` `>=10.15 <11`, `@sigloch/se-engine` `^1.10.1`,
  `@sigloch/graphcode-client` `^1.6.1`. `package-lock.json` unverändert — 10.15 steht nicht in der Registry;
  bis zum Publish ist das Repo nur im Link-Modus baubar (`lockfile-sync` und `distribution` rot, erwartet).
- `docs/articles/03-…`, `04-…`: 68 → 67 engine rules.

### Fixtures — je Fall, was der Test prüfen will

| Datei | Fall | Änderung |
|---|---|---|
| `readiness.model` | CR-R05 ohne CR | **ersetzt** durch vier Fälle zur neuen Vorbedingung: Entwurf → R-19/R-20/R-26 weder Zähler noch Nenner (auch ein gemeldeter Befund wird kein fehlendes Bein); eine Bindung → sie zählen; Stempel allein genügt. Rot-zuerst belegt: ohne den `ruleApplies`-Filter schlägt der Entwurfsfall fehl. |
| `readiness.model`, `steering.process-ratchet` | `JEDER_TYP` (Typzählung) | Graph mit einer Bindung (`BEGONNEN`) |
| `steering-snapshot` | `typeCounts(og.elements)` | `snap.og` |
| `readiness.completeness` | TEST / Blatt-FUNC ohne Bindung → TRR unvollständig | Fixture trägt ein SYS mit Bauplan-Stempel; dazu `total > 0` |
| `readiness.completeness` | gebundene TEST → TRR grün | Fixture trug den Alt-Namen `testRef` (kein Leser) — der Fall wäre mit 0/0 still grün geblieben; jetzt `testRefs` + `total > 0` |
| `readiness.completeness` | **neu** | Entwurf: TRR-Beine 0/0; Positivkontrolle mit Stempel |
| `mcp.realize` | Bindung schließt R-20/R-19/R-26 | Seed trägt eine bereits gebundene FUNC (`FN-begonnen`) |
| `mcp.realize` | **neu** | erste Bindung in einem Entwurf: `resolved: []`, `introduced` = die übrigen Ungebundenen |
| `mcp.occ` | Bindung unter OCC, `refs.resolved` | Seed trägt eine gebundene FUNC |
| `mutate.formate-binding` | „R-20 feuert weiterhin ohne Bindung" (Kontrast) | läuft im selben Graphen wie der gebundene Batch |
| `security.path-containment` | traversierende Testbindung → kein Stub, R-19 meldet | Fixture trug `testRef` (Alt-Name): R-19 meldete „fehlt", nicht die Traversierung. Jetzt `testRefs` mit dem `..`-Pfad — eine ungültige Bindung zählt als begonnen |
| `bootstrap` | Template durchs Gate | Erwartung gedreht: im Entwurf **kein** R-19 (Verhaltensänderung, kein Fixture-Mangel) |
| `executor.bestofn` | Trace-Zahlen | `total` +1.63 → +1.79 (TEST-login ohne R-19 im Entwurf); Fokus-Deltas und Pick unverändert |
| `claims.conformance` | Kanarienvogel | `engine rules=67` |

## Geprüft, nichts geändert

- **Task `realisierung` / `realizationBegun`:** graphcode trägt keine zweite Definition von „Realisierung
  begonnen" (`src/loop`, `rig/`, `auswertung/` gelesen) — nichts zu ersetzen.
- **Offen, nicht Teil dieses CR:** `graph_generate {task: 'realisierung'}` auf einem Entwurf meldet „Task
  realisierung fertig … kein offener Fund" (`phase: handoff`), weil sein Regelset schweigt und der Task keinen
  Eintrittspunkt hat (`TASK_ENTRY.realisierung === null`). Mit Bauplan-Stempel am selben Graphen: Fokus
  `arch:R-20:FUNC-a`. Das liest sich als „alles gebunden".
- **Die erste Bindung ist eine Klippe, auch am Bindungsreport:** `graph_mutate.refs` rechnet das Delta der
  R-19/R-20/R-26-Befunde. Die erste Bindung eines Entwurfs meldet deshalb `resolved: []` und führt alle übrigen
  ungebundenen Elemente als `introduced` (als Test festgehalten, nicht geändert).
- Item-Text „danach ruleApplies-Import in graphcode lösen": überholt durch CR-SM-392 — der Import bleibt, mit
  neuer Signatur.

## Umfang laut `graph_impact`

Nicht gelaufen: der laufende Host (pid aus `owner.lock`, Stand contracts 10.13) war für diesen Nachzug tabu.
Umfang aus `grep` über `ruleApplies|RULE_PRECONDITION|typeCounts|computePhaseReadiness` (3 Quelldateien, 3 Rufer-
Tests). Testspur: `verify:code` fiel wegen `package.json` auf die volle Spur.

## Verifikation

- `npm run build` / `type-check` grün gegen die verlinkte Arbeitskopie (contracts 10.15.0, `RULES_VERSION` 37.0.0).
- `npm run verify:full CR-GC-743` (2026-10-05): 202 Dateien, 1769 Tests grün, 2 rot — `tests/lockfile-sync.test.ts`
  (Lock nennt noch die alten Floors) und `tests/distribution.test.ts` (Tarball-Install findet 10.15 nicht in der
  Registry); beide im Link-Modus erwartet. Spur VOLL (`package.json` im Diff), Schlupf 0, Folge 4/10 unverändert.
- CR von Hand angelegt, nicht über `aise dispatch prepare`: das Item hat zwei Targets (graphcode, sigloch-modules)
  und prepare hätte über den laufenden Host einen CR-Knoten geschrieben. `crRefs` im Item und der CR-Knoten im
  Modell fehlen — nachzuziehen.
