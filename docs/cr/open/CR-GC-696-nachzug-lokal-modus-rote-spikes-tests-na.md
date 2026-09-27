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

---

## Schnitt (10-Dateien-Grenze)

Der Befund hat acht unabhaengige Teile; ein CR fuer alle sprengt die Grenze. Aufgeteilt:

| CR | Teile | Inhalt |
|---|---|---|
| CR-GC-696 (dieser) | (5), (3) | neue Regeln im Katalog-Waechter, Regelzahl 66 → 68, CR-R05-Ausnahme |
| CR-GC-696B | (6) | Rig-Korpora auf die zwei REQ-kinds migriert |
| CR-GC-696C | (7), (4 teilweise) | channel-rank; noteTemplateEdits kennt add-node und retires |
| CR-GC-696D | (1), (2), (8) | Spikes: Reichweite statt Schrittzahl, Deckel Lauf A, Perf-Befund |

(4) executor-prompt.ts und alles unter „NICHT hier" bleibt bei CR-GC-672.

## Umsetzung (5), (3)

**(5) Regelkatalog.** Gegen die verlinkte Arbeitskopie gezaehlt, nicht gegen die 68 im Item:
`ALL_RULE_DEFS` der readiness-scorenden Profile = **68** (66 + CR-R05 + FC-05, beide `profile: se`);
RC-10 ist `profile: conformance` und zaehlt dort nicht mit.

- `tests/evaluation.rule-catalog.test.ts`: RC-10 in `NOT_IN_GATE`. Invariante unveraendert — RC-10
  hat die Signatur `(graph, CodeFacts)` wie RC-01..09, der Gate-Katalog fuehrt sie nicht aus; die
  Konformanz faehrt sie generisch ueber `CODE_CONFORMANCE_RULES` (keine lokale RC-Liste in `src/`).
- `docs/articles/03`, `04`: „66 engine rules" → „68"; `tests/claims.conformance.test.ts` Kanarie
  mitgezogen. README nennt keine Regelzahl.
- **Rest rot, Eigentuemer SM:** `tests/readiness.model.test.ts` (A/B) — RC-10 fehlt in
  `RC_PRESENCE_PARTNER` von `@sigloch/graphcode-client` (`packages/graphcode-client/src/readiness.ts`),
  darum liegt RC-10 auf keinem Phasen-Gate, `PHASE_GATE_RULES ∪ IMPL_GATE_RULES` (70) ≠
  `getFamilyRuleIds()` (71). Kein graphcode-Fix moeglich: `src/kernel/measure/readiness.ts` re-exportiert
  nur. Vorschlag fuers SM-Item: `'RC-10': 'R-23'` — RC-10 meldet, dass RC-05 (Partner R-23) an diesem
  MOD blind ist, also dieselbe Modul-Kopplungs-Kategorie.

**(3) CR-R05.** Befund-Dimension `req` (→ se:author-req), Hilfe-Prompt `se-plan`. Der Prompt ist
richtig: der Fix fuer eine Blatt-REQ ohne Bauauftrag ist eine `CR -relation->`-Kante aus dem Bauplan,
kein REQ-Text. Das ist genau die Klasse, fuer die der Test die benannte Ausnahmeliste fuehrt
(UC-01, RD-01, R-04) — CR-R05 dort mit Grund eingetragen; keine SM-Aenderung noetig.

## VOLL-Lauf im Worktree (2026-09-27, `npx vitest run`, Link-Modus)

188 Dateien, 1662 Tests: **11 rot in 8 Dateien**, 1647 gruen, 4 skipped. Vorher (nur die hier
genannten Dateien) 20+ rot.

| Datei | Tests | Ursache | Eigentuemer |
|---|---|---|---|
| `distribution.test.ts` | 1 | Link-Modus (erwartet) | — |
| `executor.preflight.test.ts` | 2 | kinds-Meldung | CR-GC-672 |
| `skill-kinds-werte.test.ts` | 1 | executor SYSTEM nennt pre/postcondition | CR-GC-672 |
| `generate.test.ts` | 1 | Phasen/done | CR-GC-672 |
| `generate.statemachine.test.ts` | 3 | CR-R05 im Kern-Fokus am Golden (CR-GC-696B) | CR-GC-672 |
| `readiness.model.test.ts` | 1 | RC-10 ohne Gate in graphcode-client | SM (Item vorschlagen) |
| `perf.advisory-roundtrip.spike.test.ts` | 1 | `bestBySteer` O(Kandidaten × n²), CR-SM-356 | SM (Item vorschlagen) |
| `rig-measured.test.ts` | 1 | `statSync(.graphcode/kuzu)` — ein frischer Checkout hat keinen Store; Klasse „saubere Maschine", vorbestehend, nicht aus diesem Zug | eigener Befund |

Graph-Knoten fuer CR-GC-696B/C/D sind NICHT angelegt (kein graph_mutate am Repo-Store in dieser
Lane) — beim Integrieren per Werkzeug nachziehen.
