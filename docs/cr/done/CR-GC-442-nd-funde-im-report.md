# CR-GC-442 — ND-Funde im Report-/Dashboard-Pfad sichtbar

**Status:** done (2026-08-27)
**Vorgänger:** CR-GC-287 (ND-Matrix-Injektion), CR-GC-398/428 (eine Auswertungsfläche, `skipped`)

## Problem

`ND-01 FuncNearDuplicate` und `ND-02 SchemaNearDuplicate` leben in `@sigloch/contracts/se`
(`near-duplicate-rules.ts`, severity `error`, Schwelle 0.85). Sie brauchen eine per
`setND01SimilarityMatrix` / `setND02SimilarityMatrix` injizierte Similarity-Matrix — ohne
Injektion liefern sie still `[]`.

Injiziert hat sie genau ein Aufrufer: `src/steering/steering-snapshot.ts` (Steering-Pfad,
`generationStep` / `nextStep`). Der Report-Pfad — `evaluateAll()` in
`src/conformance/evaluation.ts`, die Grundgesamtheit von `rules_evaluate`,
`rules_get_violations`, `graph_readiness` und damit des Dashboards — injizierte nicht und
wertete ND auch gar nicht aus: `SE_DESCRIPTOR.rules` (der Katalog hinter
`harness.evaluateRules()`) trägt ND absichtlich nicht, BQ/ND sind das CODING-Profil.

Ergebnis: ein Beinahe-Duplikat war in Verstoßliste, Report und Dashboard strukturell
unsichtbar. `skipped` wies das zwar aus (`rule:ND-02`), aber niemand holte es nach — eine
blinde Stelle genau in der Schicht, in der Wildwuchs entsteht (neu relevant durch
`FLOW -relation-> SCHEMA` 1..1 aus CR-SM-271 Teil 2).

## Änderung

1. **`src/conformance/evaluation.ts`** — `evaluateAll()` wertet die ND-Regeln lokal mit aus
   (`nearDuplicateFindings`): `toOntologyGraph` → Matrizen injizieren → `evaluateNDRules`
   (die contracts-Regel selbst, kein Nachbau) → Mapping auf `Finding` mit `source: 'rules'`.
   `LOCALLY_EVALUATED_RULE_IDS` ist aus `ND_RULES` **abgeleitet**, keine gepflegte Liste;
   die dort genannten Regeln fallen automatisch aus `skipped`.
2. **`src/steering/nd-similarity.ts`** — neu `clearNDMatrices()` und `withNDMatrices(og, run)`:
   injizieren, laufen lassen, im `finally` zurücksetzen. Modulkopf nachgezogen.
3. **`src/steering/steering-snapshot.ts`** — benutzt dieselbe Klammer statt des blanken
   `injectNDMatrices` (keine parallelen Pfade).
4. **`src/tools/report.ts`** — Beschreibungstexte von `rules_evaluate` und `graph_readiness`:
   ND ist ausgewertet, `skipped` nennt jetzt BQ, und ND bleibt trotzdem in
   `catalogs.notInGate`.

## Abgrenzung: das Gate bleibt ND-frei

Verriegelt und getestet: ND-01/ND-02 stehen **nicht** in `SE_DESCRIPTOR.rules`. `mutate()`
fährt weiter nur `harness.evaluateRules()`, sieht ND also gar nicht — ein Near-Duplicate
blockiert keine Mutation, die Delta-Semantik des Apply-Gates ist unberührt (CR-GC-287).

„Ausgewertet" und „gate-relevant" sind ab hier **zwei getrennte Aussagen**:
`ruleCatalogs().notInGate` führt ND weiter (Gate kennt sie nicht), `skipped` nicht mehr
(sie werden ausgewertet). Die Schnittmenge ist genau `LOCALLY_EVALUATED_RULE_IDS`.

## Modul-State: das Leck ist real, aber nicht über ND

`setND0xSimilarityMatrix` setzt **globalen** Zustand in contracts. Geprüft statt geglaubt:

- **Über die ND-Regeln kann nichts ins Gate lecken** — sie sind im Gate-Katalog nicht
  registriert (Test: `SE_DESCRIPTOR.rules` enthält kein `ND-*`).
- **Über `AO-D01` aber schon.** `ao-rules.ts` liest die ND-02-Matrix per
  `getND02SimilarityMatrix()` und überspringt seine Overlap-Prüfung, wenn keine da ist
  („no matrix → assume pass"). AO-D01 **ist** im Gate-Katalog. Eine liegengebliebene
  Matrix — womöglich aus einer älteren Graph-Version — änderte damit, was der nächste
  Gate-/Report-Lauf meldet: dasselbe Regelwerk, derselbe Graph, zwei Ergebnisse, allein
  abhängig von der Reihenfolge der Läufe im Prozess. Das galt **schon vor dieser CR** für
  den Steering-Pfad.
- **Praktische Reichweite heute: null.** AO-D01 verlangt `FUNC -io-> FUNC`, und dieses
  Trace-Paar ist grammatisch illegal (`io` gibt es nur FUNC↔FLOW / ACTOR↔FLOW). Auf einem
  musterlegalen Graphen kann AO-D01 gar nicht feuern. Severity ist ohnehin `info`, und
  `AO-` steht nicht in `GATING_PREFIXES` — blockiert hätte es also nie.
- **Fix:** `withNDMatrices` als Klammer in beiden Pfaden. Nach jedem Lauf steht der
  contracts-Modul-State wieder auf `null` — der definierte Ausgangszustand, nicht ein Rest
  eines fremden Laufs. Auch im Fehlerfall (`finally`).

## Wirkung auf Compliance / Readiness

ND-01/ND-02 sind in contracts `severity: 'error'`. Die Severity wurde **nicht** angefasst
(das wäre Familie-Review). Wirkung, wenn ein Fund auftritt:

| Kennzahl | Wirkung |
|---|---|
| `compliance.score` | sinkt: `computeReadiness` zählt das Element in `elementsWithErrors` |
| `violationsByRule` | neuer Schlüssel `ND-01`/`ND-02` |
| `phaseGates` (SRR..TRR) | **unverändert** — `PHASE_GATE_RULES` filtert das CODING-Profil (`BQ-`/`ND-`) explizit heraus |
| `phase_readiness` | betroffen: `computePhaseReadiness` liest `RULE_TO_PHASE` ungefiltert, dort steht `ND-01 → PDR`, `ND-02 → CDR`. Ein Fund nimmt die Regel aus `covered` |
| `implGates` (SAR..FRR) | betroffen: `scoreImplGate` liest `elementsWithError` für „scope error-clean" |
| `dimension_readiness` | unverändert — der Steering-Pfad wertete ND schon vorher aus |
| Apply-Gate | unverändert — ND ist nicht im Gate-Katalog |

**Am eigenen Modell gemessen (2026-08-27, `docs/graph/graphcode.graph.json`):** 108 FUNC,
32 SCHEMA, höchste ND-01-Ähnlichkeit 0.800, höchste ND-02-Ähnlichkeit 0.250 → **0 Funde**,
keine Zahl bewegt sich. Für andere Repos ist es eine echte Verhaltensänderung: dort können
ab dem nächsten Release error-Befunde in Report und Dashboard auftauchen, die vorher nur
der Steering-Pfad sah.

## Akzeptanz

- [x] Rot zuerst: zwei feld-identische SCHEMAs liefern über `rules_evaluate` einen
      ND-02-Fund (vor der Änderung 6 von 8 Tests rot, u. a. genau dieser).
- [x] Derselbe Fund auf allen Lese-Flächen (`rules_get_violations`,
      `graph_readiness.violationsByRule`), `skipped` nennt ND nicht mehr.
- [x] Das Duplikat kommt durchs Gate (`mutate` erfolgreich, `tier != block`), und
      `harness.evaluateRules()` kennt kein `ND-*`.
- [x] Nach Report- **und** Steering-Lauf ist `getND02SimilarityMatrix()` wieder `null`;
      zwei Gate-Läufe um einen Report-Lauf herum liefern identische Verstöße.
- [x] Nachweis, dass der Zustand nicht gate-neutral ist: AO-D01 meldet ohne Matrix 1, mit
      Matrix 0 Funde (deshalb die Klammer, nicht das blanke `inject`).
- [x] `npm run build` grün; volle Suite: **20 rote = exakt die dokumentierten
      vorbestehenden** (2 Publish-Pending + 18 contracts-10-Fixture), per Stash-Gegenprobe
      bestätigt. Keine neuen.

## Ergebnis

ND-Funde sind im Report-/Dashboard-Pfad sichtbar, das Apply-Gate bleibt ND-frei, und der
globale contracts-Modul-State ist in beiden Pfaden geklammert statt liegengelassen.

## Offene Frage (Folge-CR-Kandidat)

**ND-02 kann auf einem musterlegalen Graphen fast nie feuern.** Die Formel ist
`0.50·field_jaccard + 0.30·descr_jaccard + 0.20·usage_overlap`. graphcode definiert
`usage` als die direkten `relation`/`io`/`compose`-Partner des SCHEMA — das sind wegen
`FLOW -relation-> SCHEMA` (1..1, CR-SM-271 Teil 2) genau die FLOWs, und jeder FLOW hat
**genau ein** SCHEMA. Zwei verschiedene SCHEMAs haben damit strukturell **disjunkte**
Usage-Mengen ⇒ `usage_overlap = 0` ⇒ Maximalscore **0.80 < 0.85**. Es feuert nur der
Sonderfall „beide SCHEMAs ganz ohne FLOW" (∅/∅ = 1), also frisch angelegte, noch nicht
verdrahtete Duplikate.

Genau der gemeinte Fall — zwei **verdrahtete**, feldgleiche SCHEMAs — bleibt also weiter
stumm. Sinnvolle Definition wäre die transitive Nutzung (`SCHEMA ← FLOW ← FUNC`: welche
FUNCs lesen/schreiben dieses SCHEMA). Das ändert aber, was als Duplikat **gilt**, und wirkt
auf jedes Repo — deshalb hier bewusst **nicht** mitgemacht, sondern zur Entscheidung
vorgelegt.
