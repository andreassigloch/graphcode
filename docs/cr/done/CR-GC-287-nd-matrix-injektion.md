# CR-GC-287 — Near-Duplicate-Erkennung scharf schalten (ND-Matrix-Injektion)

**Status:** done (2026-08-01). Teilabweichung: ND erscheint auf den
Steering-Flächen (`graph_generate`/`graph_next_step` via `injectNDMatrices`
vor `evaluateAllRules`), NICHT in `rules_evaluate`/`graph_readiness` — die
laufen über die Gate-Engine (V3+MT), und ND dort einzuhängen hätte ND zum
Gate-Blocker gemacht (vom CR verboten). Advisory-Schiene für die beiden
Harness-Tools = möglicher Folge-CR. Duplikat-Hinweis-Schwelle 0.55 lokal.
**Datum:** 2026-08-01
**Kontext:** Alle drei Endgraphen des Greenfield-Vergleichs enthalten sichtbare
Duplikate (Haiku: Duplikat-REQs; devstral: EN-Paare wie zweimal „User generates
custom reports") — aber `evaluateAllRules` meldet 0 ND-Funde. Ursache: ND-01/02
(contracts) brauchen eine per `setND01SimilarityMatrix` /
`setND02SimilarityMatrix` INJIZIERTE Similarity-Matrix; in graphcode wird sie
nirgends injiziert (0 Referenzen) — die Regeln sind leere Hüllen. Zudem decken
sie nur FUNC/SCHEMA ab; die realen Duplikate waren REQs und UCs.

## Ziel

1. **Matrix-Injektion in graphcode:** deterministische Berechnung der
   Similarity-Matrizen (Formeln stehen in den contracts-Kommentaren:
   ND-01 = 0.35·descr_jaccard + 0.25·verb_match + 0.25·io_topology +
   0.15·req_overlap; ND-02 analog) vor jedem Regel-Lauf, der ND sehen soll
   (rules_evaluate, readiness, generate-Fokus). Injektionspunkt so wählen,
   dass Gate-Läufe (V3_RULES+MT) unberührt bleiben — ND bleibt Steering, kein
   Gate-Blocker (sonst Delta-Semantik-Kollateral).
2. **REQ/UC-Duplikate ohne Contracts-Fork:** ein graphcode-LOKALER
   Preflight-Hinweis im Executor (keine Regel!): Namens-/Beschreibungs-
   Ähnlichkeit neuer REQ/UC-add-nodes gegen den Element-Index; bei Treffer
   Feedback „ähnlich vorhanden: X — mergen oder differenzieren" VOR dem
   Gate-Call. Baut auf dem Element-Index aus CR-GC-285 auf.

## Abgrenzung (Verriegelung beachten)

Echte ND-Regeln für REQ/UC gehören nach `@sigloch/contracts/se` — das ist ein
Familie-Review + Version-Bump, NICHT dieser CR. Wenn der lokale Preflight sich
bewährt, Folge-CR im contracts-Repo vorschlagen.

## Dateien (≤6)

- `src/` neues Modul `nd-similarity.ts` (Matrix-Berechnung, pure functions)
- `src/tool-context.ts` oder `src/readiness.ts` (Injektionspunkt)
- `src/executor.ts` (REQ/UC-Preflight-Hinweis)
- `tests/nd-similarity.test.ts`
- `tests/executor.test.ts`

## Akzeptanzkriterien

- [ ] Unit-Test mit den REALEN Duplikaten aus `results/gc-run-haiku45.graph.json`
      bzw. v14: ND bzw. Preflight schlägt an
- [ ] Gate-Verhalten unverändert (kein neuer Blocker; Regressionstest)
- [ ] rules_evaluate/readiness zeigen ND-Funde, generate-Fokus kann sie rotieren
- [ ] `npm run build` + Tests grün
