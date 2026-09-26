# CR-GC-669: Migrationswerkzeug REQ-kinds auf zwei Werte

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-580 (idea)
**Erstellt:** 2026-09-25
**Item:** bok/items/ITEM-2026-580.json (Lane: code)

---

ZIELBILD (ITEM-2026-575, Diskussion 2026-09-25): REQ.kinds = genau EIN Wert aus {functional, non-functional}. functional -> FUNC; non-functional -> MOD (lokales Budget) | SYS (Systemebene) | FCHAIN (Ende-zu-Ende). Ohne kinds kein Erfueller (BQ-07). pre-/postcondition entfallen (Vorbedingung = Eingangs-FLOW der Kette, Nachbedingung = UC-Ziel, geprueft ueber R-21). risk/mitigation werden ein Rollen-Attribut (FM-01..03), satisfy-neutral. Gemischtes functional+non-functional = falsch zerlegt -> teilen.

BEFUND (gezaehlt 2026-09-25 ueber 20 Graph-SSOTs, 1129 REQ): pre/postcondition 75 REQ (graphcode 32, bok 15, graphcodedemo 14, test_karp 6, sigllm 6, sigloch-modules 2); functional an FCHAIN 40 Kanten (graphcode 14, gc_test-graphview 7, test_karp 6, testconcept(-gaps) je 5, bok 3); pre/post an FCHAIN 22; ohne kinds an FCHAIN 7 (greenfield-trial 5, siconizer 2); risk/mitigation 125 REQ; gemischt 0. Nach dem Ontologie-Major bootet kein Host mehr auf diesen SSOTs (R-18 an den nun illegalen Kanten).

ZIEL: ein Werkzeug, das je Graph einen Migrationsvorschlag erzeugt und ueber den Tool-Layer (graph_mutate, nie Hand-Edit) anwendet:
- mechanisch: risk/mitigation -> Rollen-Attribut; pre/post an FUNC -> functional.
- Entscheidung je REQ (Liste, kein Pauschalzug, wie negative in CR-SM-266a): functional an FCHAIN -> an eine FUNC haengen oder als non-functional umklassifizieren (Stichprobe graphcode: REQ-no-extraction/-code-governed-quality/-graph-snapshot-per-commit eher NFR; REQ-doc-export/-graph-state-recall an eine FUNC); pre/post an FCHAIN -> Eingangs-FLOW/UC-Ziel oder NFR; ohne kinds an FCHAIN -> kinds setzen.
Mechanik: Grammatik-Major (alte contracts unterschieben, dann migrieren; Memory grammar-major-migration-mechanik). Abgleich mit CR-DRAFT-GC-437 (graphcode migrate), falls es bis dahin steht.

UMFANG (<= 10 Dateien): scripts/migrate-req-kinds.mjs (oder Verb im CLI, im CR entscheiden), Test mit Vorher/Nachher-Graph, Doku-Abschnitt.

ABNAHME: Probelauf auf Kopien aller 20 SSOTs; die Zaehlung oben wird reproduziert; nach Anwendung meldet R-18 unter den neuen contracts 0 kinds-Verstoesse; Entscheidungsliste je Repo als Datei.

REIHENFOLGE der Kette (9 CRs): [1] GC Regel-Matrix + Smeagol-Wertebereich -> [2] SM Rollen-Attribut risk/mitigation -> [3] SM kinds auf zwei Werte + FCHAIN nur NFR (mit [2] EIN Ontologie-Major, Publish durch den Auftraggeber) -> [4] GC Migrationswerkzeug (vor dem Publish baubar) -> [5] GC Eigenmodell migrieren (graph-Lane) -> [6] GC Kern + Peer-Floor -> [7] GC Loop/Executor -> [8] GC Projektionen -> [9] GC Skills + Help. Danach Datenmigration je Familien-Repo (eigene Items, sobald [4] steht). Dies ist [4].

---

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
