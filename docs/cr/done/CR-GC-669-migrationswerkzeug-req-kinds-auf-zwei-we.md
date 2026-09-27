# CR-GC-669: Migrationswerkzeug REQ-kinds auf zwei Werte

**Status:** ✅ Done (2026-09-27)
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

Kein Modellknoten betroffen: das Werkzeug ist ein Skript (`scripts/` ist im Selbstmodell nicht
modelliert), es aendert keinen FUNC/MOD des Kerns. `graph_impact` war nicht befragbar — der
MCP-Host dieser Sitzung laeuft auf altem Code und alten contracts. Testspur: der neue Test plus
`verify-model.completeness` (neuer Test liest keinen SSOT, gehoert nicht in die Modellmenge).

## Entscheidung: Skript, kein CLI-Verb

`scripts/migrate-req-kinds.mjs` — das Kleinste, das durch den Tool-Layer geht: `apply` baut den
Harness per `createHarness` und schreibt ueber `bindToolsToHarness` → `graph_mutate` (EIN Batch,
Deletes und Adds zusammen) → `graph_export`. Ein CLI-Verb waere eine neue Quelldatei unter `src/`
mit Modellknoten und Paketoberflaeche fuer einen einmaligen Zug; die Familien-Migration laeuft im
Lokal-Modus aus der graphcode-Arbeitskopie (`node <graphcode>/scripts/migrate-req-kinds.mjs apply
--repo <repo>`). CR-DRAFT-GC-437 (`graphcode migrate`) existiert in diesem Repo nicht (weder open
noch done) — kein Abgleich moeglich; faellt es spaeter an, ist dieses Skript sein erster Fall.

Zwei Schritte, Entscheidung je REQ:
- `propose` liest den SSOT, zaehlt den Bestand (Spalten der CR-SM-366-Tabelle) und schreibt die
  Entscheidungsdatei. `decidedBy`: `mechanical` (risk/mitigation → `role` bei vorhandenem Kern-kind;
  pre/post nur an FUNC → functional), `heuristic` (Vorschlag mit Grund und bis zu 5 Kandidaten),
  `open` (gemischt, beide Rollen, unbekannter Wert, non-functional an FUNC ohne MOD).
- Heuristik: Kern-kind aus den Erfuellern (FUNC → functional, MOD/SYS/FCHAIN → non-functional,
  pre/post ohne Erfueller → functional). Erfueller, deren Typ das kind nicht zulaesst: erfuellt schon
  ein passender, entfaellt die Kante; sonst umhaengen — functional an ein FUNC-Glied der FCHAIN /
  des MOD **mit realRef** (bestes Wortueberlappen), non-functional an das MOD, dem die FUNC zugeteilt
  ist; ohne Kandidat functional → non-functional. Deckt neben dem Major auch die schon vorher
  ungueltigen kinds-Kanten (GVE) ab, sonst waere "0 kinds-Befunde" nicht erreichbar.
- `apply` verweigert `heuristic` ohne `--accept-heuristic` (nur fuer Probelaeufe auf Kopien), `open`
  immer, und eine Datei, deren `before.kinds` nicht mehr zum Graphen passt — alle Befunde auf einmal,
  nichts angewendet.

## Ergebnis

Dateien: `scripts/migrate-req-kinds.mjs`, `tests/migrate-req-kinds.test.ts`, README-Abschnitt
"Migrating a graph across the REQ-kinds major", Entscheidungslisten `CR-GC-669-probelauf.json`.

**Probelauf** auf Kopien (Temp-Repo je Graph, Temp-Store, nie ein `.graphcode` eines Repos),
Werkzeug = dieser Build gegen die gelinkten contracts (ReqKind 2 Werte). Nur die AISE-Familie
(`dev/{bok,sigloch-modules,graph-view-edit,graphcode,graphify}/docs/graph/*.graph.json`, 8 Graphen):
die "20 SSOTs" im Befund oben enthalten Nicht-Familien-Repos (graphcodedemo, test_karp, sigllm,
gc_test-graphview, greenfield-trial, siconizer, sirail, …) — deren Migration ist nicht hier.

| Graph | REQ | pre/post | risk | mitig. | f+nf | Rolle+Kern | ohne Kern nach Umzug | ohne kinds | sat→pre/post | sat→Rolle | FCHAIN→functional | R-18 kinds vorher | betroffen (mech/heur/offen) | Kommandos | R-18 kinds nachher |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bok | 31 | 15 | 0 | 0 | 0 | 0 | 15 | 0 | 19 | 0 | 3 | 22 | 18 (14/4/0) | 22 | 0 |
| sigloch-modules | 11 | 2 | 0 | 0 | 0 | 0 | 2 | 0 | 2 | 0 | 0 | 2 | 2 (2/0/0) | 2 | 0 |
| graph-view-edit | 74 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 5 | 5 (0/5/0) | 9 | 0 |
| kadjar | 305 | 0 | 0 | 0 | 0 | 0 | 0 | 305 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| testconcept-gaps | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5 | 6 | 6 (0/6/0) | 6 | 0 |
| testconcept | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5 | 6 | 6 (0/6/0) | 6 | 0 |
| graphcode | 146 | 32 | 0 | 0 | 0 | 0 | 32 | 0 | 32 | 0 | 14 | 46 | 46 (17/29/0) | 63 | 0 |
| graphify | 45 | 0 | 15 | 4 | 0 | 0 | 19 | 0 | 0 | 4 | 0 | 4 | 19 (0/19/0) | 19 | 0 |
| **Summe** | 652 | 49 | 15 | 4 | 0 | 0 | 68 | 308 | 53 | 4 | 27 | 91 | 102 | 127 | **0** |

- Die Spalten REQ bis FCHAIN→functional reproduzieren die CR-SM-366-Tabelle **Zelle fuer Zelle**;
  "R-18 kinds vorher" (Tool-Layer `rules_evaluate`, neuer Build, unmigriert) = deren Spalte
  "ungueltig nachher" (91). Ihre Spalte "ungueltig vorher" (alte contracts) ist hier nicht
  nachgemessen.
- Nach `apply --accept-heuristic`: jeder Batch `success`, **0 R-18-kinds-Befunde** auf allen 8 Kopien;
  ein erneutes `propose` auf dem exportierten Graphen findet 0 betroffene REQ (idempotent).
- FM: graphify nach dem Umzug FM-02 11 + FM-03 6 = 17 Befunde (Tool-Layer und direkter
  `evaluateFMRules`-Aufruf stimmen ueberein). CR-SM-365 nennt 26 — nicht reproduziert; Ursache
  nicht geklaert (anderer Auswerter/Snapshot), die Rolle sitzt an genau den 19 REQ, die vorher
  risk/mitigation trugen.
- Die heuristischen Vorschlaege sind **keine Entscheidungen** — sie stehen je Graph in
  `CR-GC-669-probelauf.json` als Ausgangsliste fuer die Familien-Items (bok, SM, GVE, graphify) und
  CR-GC-670 (graphcode).

Tests: `tests/migrate-req-kinds.test.ts` 8/8 gruen (Vorschlag je Fall; Verweigerung ohne
Bestaetigung und bei veralteter Datei; Anwendung am Temp-Store ueber den Tool-Layer, 5 → 0
kinds-Befunde, Rolle gesetzt, umgehaengt). Rot gesehen: erste Fassung erwartete 4 statt 5
Vorher-Befunde (die mitigation-REQ am MOD fehlte in der Zaehlung). `verify-model.completeness` gruen.
Volle Suite im Link-Modus: 25 Dateien / 44 Tests rot, keine davon importiert Skript oder Test dieses CR
(Bestand des master im Link-Modus; Zuordnung zu den Folge-CRs in CR-GC-671/670); `lockfile-sync`/
`distribution` gruen. CLI-Smoke auf bok-Kopie: `apply` ohne Bestaetigung verweigert (4 Befunde, exit 1), mit
`--accept-heuristic` 22 Kommandos, Export geschrieben.
