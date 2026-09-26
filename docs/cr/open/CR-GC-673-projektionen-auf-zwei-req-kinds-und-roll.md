# CR-GC-673: Projektionen auf zwei REQ-kinds und Rollen-Attribut

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-584 (idea)
**Erstellt:** 2026-09-25
**Item:** bok/items/ITEM-2026-584.json (Lane: code)

---

ZIELBILD (ITEM-2026-575, Diskussion 2026-09-25): REQ.kinds = genau EIN Wert aus {functional, non-functional}. functional -> FUNC; non-functional -> MOD (lokales Budget) | SYS (Systemebene) | FCHAIN (Ende-zu-Ende). Ohne kinds kein Erfueller (BQ-07). pre-/postcondition entfallen (Vorbedingung = Eingangs-FLOW der Kette, Nachbedingung = UC-Ziel, geprueft ueber R-21). risk/mitigation werden ein Rollen-Attribut (FM-01..03), satisfy-neutral. Gemischtes functional+non-functional = falsch zerlegt -> teilen.

ZIEL: Projektionen und Authoring-Beispiel zeigen nur noch functional/non-functional und die Rolle risk/mitigation als eigenes Feld; die Beschreibung des kinds-Attributs im Authoring-Guide nennt die Erfueller-Tabelle.

UMFANG (laut grep, <= 10 Dateien): src/projections/graphcode.ts, exporter.ts, authoring-example.ts, incose.ts, srs.ts, helpers.ts; Tests views.conformance, exporter.

ABNAHME: Views regeneriert (npm run verify:model), conformance gruen; Smeagol-Check aus [1] gruen fuer authoring-example.

REIHENFOLGE der Kette (9 CRs): [1] GC Regel-Matrix + Smeagol-Wertebereich -> [2] SM Rollen-Attribut risk/mitigation -> [3] SM kinds auf zwei Werte + FCHAIN nur NFR (mit [2] EIN Ontologie-Major, Publish durch den Auftraggeber) -> [4] GC Migrationswerkzeug (vor dem Publish baubar) -> [5] GC Eigenmodell migrieren (graph-Lane) -> [6] GC Kern + Peer-Floor -> [7] GC Loop/Executor -> [8] GC Projektionen -> [9] GC Skills + Help. Danach Datenmigration je Familien-Repo (eigene Items, sobald [4] steht). Dies ist [8].

---

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
