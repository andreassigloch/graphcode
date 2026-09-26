# CR-GC-670: graphcode-Eigenmodell auf zwei REQ-kinds migrieren

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-581 (idea)
**Erstellt:** 2026-09-25
**Item:** bok/items/ITEM-2026-581.json (Lane: graph)

---

ZIELBILD (ITEM-2026-575, Diskussion 2026-09-25): REQ.kinds = genau EIN Wert aus {functional, non-functional}. functional -> FUNC; non-functional -> MOD (lokales Budget) | SYS (Systemebene) | FCHAIN (Ende-zu-Ende). Ohne kinds kein Erfueller (BQ-07). pre-/postcondition entfallen (Vorbedingung = Eingangs-FLOW der Kette, Nachbedingung = UC-Ziel, geprueft ueber R-21). risk/mitigation werden ein Rollen-Attribut (FM-01..03), satisfy-neutral. Gemischtes functional+non-functional = falsch zerlegt -> teilen.

BEFUND: Im graphcode-Modell tragen 32 REQ pre/postcondition (17 an FUNC, 15 an FCHAIN), 14 functional-REQ haengen an einer FCHAIN, dazu risk/mitigation-REQ. Nach dem Ontologie-Major bootet der Host nicht mehr auf dem Alt-SSOT.

ZIEL: das Eigenmodell mit dem Werkzeug aus [4] migrieren, Entscheidung je REQ (Stichprobe: REQ-no-extraction, REQ-code-governed-quality, REQ-graph-snapshot-per-commit -> non-functional; REQ-doc-export, REQ-graph-state-recall -> an eine FUNC). Nur ueber graph_mutate; danach SSOT und Views re-exportieren.

UMFANG: docs/graph/graphcode.graph.json + Views (Modell-Lane, verify:model).

ABNAHME: rules_evaluate unter den neuen contracts ohne kinds-bedingte R-18/BQ-07; RC-* kongruent oder benannt offen, Bindungsquote ausgewiesen; die umgehaengten functional-REQ haben einen FUNC-Erfueller mit realRef.

REIHENFOLGE der Kette (9 CRs): [1] GC Regel-Matrix + Smeagol-Wertebereich -> [2] SM Rollen-Attribut risk/mitigation -> [3] SM kinds auf zwei Werte + FCHAIN nur NFR (mit [2] EIN Ontologie-Major, Publish durch den Auftraggeber) -> [4] GC Migrationswerkzeug (vor dem Publish baubar) -> [5] GC Eigenmodell migrieren (graph-Lane) -> [6] GC Kern + Peer-Floor -> [7] GC Loop/Executor -> [8] GC Projektionen -> [9] GC Skills + Help. Danach Datenmigration je Familien-Repo (eigene Items, sobald [4] steht). Dies ist [5], graph-Lane; laeuft zwischen Publish von [2]/[3] und [6].

---

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
