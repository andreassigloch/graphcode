# CR-GC-671: graphcode-Kern auf zwei REQ-kinds und neuen contracts-Floor

**Status:** 🟠 Open
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

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
