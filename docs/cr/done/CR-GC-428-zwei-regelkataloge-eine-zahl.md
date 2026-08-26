# CR-GC-428 — Zwei Regelkataloge, eine Zahl: `skipped: []` behauptet Vollständigkeit, die es nicht gibt

**Status:** done (2026-08-26) · **Angelegt:** 2026-08-26
**Herkunft:** Trigger-Analyse 2026-08-25/26. `graph_next_step` nennt als Fokus-Treiber
`BQ-06 ×129` und `BQ-02 ×117`; `rules_evaluate` meldet zur selben Zeit **29** Verstöße und
kennt keine einzige BQ-Regel.

## Befund — gemessen, nicht vermutet

Es laufen **zwei Regelkataloge** nebeneinander:

| Pfad | Katalog | Regeln |
|---|---|---|
| **Gate / Diagnose** — `harness.engine` ← `SE_DESCRIPTOR.rules` (graph-api-core) | 66 | blockt, erscheint in `rules_evaluate` |
| **Steering** — `evaluateAllRules` ← `ALL_RULE_DEFS` (`@sigloch/contracts/se`) | 73 | priorisiert `graph_next_step` / `dimension_readiness` |

Die Differenz sind exakt **7 Regeln**, die **nur** der Steering-Pfad auswertet:

| Regel | Severity | Domäne |
|---|---|---|
| BQ-01, BQ-02, BQ-04, BQ-06, BQ-07 | warning | REQ |
| **ND-01** | **error** | FUNC |
| **ND-02** | **error** | SCHEMA |

Umgekehrt gibt es keine Regel, die nur das Gate kennt.

## Was NICHT der Fehler ist

Die unterschiedliche **Blockier**-Semantik ist bewusst und dokumentiert:
`src/nd-similarity.ts:14–18` (CR-GC-287) — die ND-Regeln erwarten eine injizierte
Similarity-Matrix, die Injektion läuft nur vor Full-Katalog-Evals, und der Satz steht
wörtlich da: *„ND bleibt Steering, nie Gate-Blocker (Delta-Semantik unberührt)."*
Das ist eine Entscheidung, kein Versehen — dieser CR dreht sie **nicht** um.

## Was der Fehler ist

**`rules_evaluate` liefert `skipped: []` und behauptet damit Vollständigkeit, die nicht
besteht.** `skipped` kennt heute nur die Quellen `rules` / `conformance`
(`src/evaluation.ts:46–74`); dass innerhalb der Quelle `rules` sieben Regeln des
contracts-Katalogs gar nicht erst geladen sind, sagt niemand.

Die Folge ist genau die Klasse, die **CR-GC-398** schon einmal behoben hat: *eine
Compliance-Zahl ohne ihre Grundgesamtheit ist nicht interpretierbar* — dort war es
`skipped`, in CR-SM-268 die stumme `unassigned`-Liste, hier der halbe Regelkatalog.

**Impact:** Der Mensch liest 29 Verstöße und hält den Graphen für nahezu sauber. Der Agent
wird zur selben Zeit von 246 BQ-Funden auf die Dimension `req` gelenkt. Beide Zahlen sind
richtig, keine ist falsch berechnet — aber sie beantworten dieselbe Frage („wie steht der
Graph da?") verschieden, ohne dass die Differenz irgendwo benannt ist. Wer den Fokus des
Agenten verstehen will, findet die Ursache in keiner Oberfläche.

Zusätzlich: **ND-01/ND-02 sind als `error` deklariert** und tauchen in keiner Fehlerliste
auf. Ein Betrachter, der `blocking.errors: 0` liest, schließt daraus „keine Fehler" — richtig
wäre „keine Fehler unter den 66 geladenen Regeln".

## Änderung

1. **Die Lücke benennen, wo die Zahl steht.** `rules_evaluate` (und `rules_get_violations`)
   weisen die nicht geladenen Regel-IDs aus — als eigenes Feld oder als Erweiterung von
   `skipped` um die Regel-Ebene. Die Liste wird **abgeleitet** (Differenz
   `ALL_RULE_DEFS` \ geladene Regeln), nicht als Konstante gepflegt — eine Handtabelle
   driftet, genau wie die aus CR-SM-235.
2. **`graph_readiness` sagt, aus welchem Katalog seine Zahlen kommen** — `dimension_readiness`
   und `violationsByRule` stammen aus verschiedenen Pfaden; heute steht das nur im
   Tool-Beschreibungstext (`report.ts:268` „never BQ-*"), nicht am Ergebnis.
3. **Tool-Beschreibungen korrigieren.** `rules_evaluate` behauptet heute „Identical
   population to rules_get_violations and graph_readiness.violationsByRule" — für
   `dimension_readiness` gilt das nachweislich nicht.

## Ausdrücklich nicht

- ND/BQ werden **nicht** ins Gate gehoben — das wäre die Umkehr von CR-GC-287 und eine
  eigene Entscheidung (Kosten: Similarity-Matrix bei jeder Mutation).
- Keine Änderung an der Delta-Semantik, keine neue Regel, keine Katalog-Zusammenführung.
- Kein Fork: die Regelquelle bleibt contracts.

## Akzeptanzkriterien

- [x] `rules_evaluate` nennt die 7 nicht ausgewerteten Regel-IDs; die Liste ist **abgeleitet**
      (Test: eine Regel künstlich aus dem Descriptor entfernen → sie erscheint, ohne dass
      jemand eine Tabelle pflegt — vorher rot gesehen).
- [x] `skipped: []` bedeutet danach beweisbar „nichts ausgelassen".
- [x] `graph_readiness` weist die Katalog-Herkunft je Zahlenblock aus.
- [x] Die Beschreibung von `rules_evaluate` behauptet keine identische Grundgesamtheit mehr,
      wo keine ist.
- [x] Ein Test pinnt die Differenz der beiden Kataloge — wächst sie, schlägt er fehl
      (Drift-Wächter, kein Zahlen-Snapshot).

## Dateien (≤ 5)

1. `src/evaluation.ts`
2. `src/tools/report.ts`
3. ggf. `src/harness.ts` (Zugriff auf den geladenen Katalog)
4. Test
5. dieser CR

## Umsetzung (2026-08-26)

**Eine Liste, zwei Ebenen.** `skipped` nennt ab jetzt QUELLEN (`conformance`) **und**
Regeln (`rule:ND-01`) — nicht zwei Felder, damit die Frage „was wurde ausgelassen?"
eine Antwort hat und `skipped: []` beweisbar „nichts" heißt. Sichtbar in
`rules_evaluate`, `rules_get_violations` und `graph_readiness` (dieselbe Liste,
`evaluateAll` erhebt sie einmal).

**Abgeleitet, nicht gepflegt.** `unevaluatedRuleIds(loaded)` = `ALL_RULE_DEFS` minus
dem geladenen Katalog; der geladene Katalog kommt live aus
`GraphCodeHarness.getLoadedRuleIds()` (dem registrierten Descriptor DIESER Harness,
nicht dem Default-Descriptor). Nirgends steht eine Regel-ID als Konstante — außer im
Drift-Wächter des Tests, und genau dort soll sie stehen.

**Katalog-Herkunft am Ergebnis:** `graph_readiness.catalogs` = `{gate, steering,
notInGate}` mit gezählten `ruleCount` und den Feldern, die aus dem jeweiligen Katalog
entstehen (`gate`: compliance/violations/violationsByRule/phaseGates/implGates/
`phase_readiness` · `steering`: `dimension_readiness`).

**Nicht angefasst:** Blockier-Semantik, Delta-Semantik, Regelquelle, Katalogschnitt.
ND/BQ bleiben Steering (CR-GC-287). Kein Modell-Schreibvorgang.

**Test:** `tests/evaluation.rule-catalog.test.ts` (8 Fälle, realer Disk-Kuzu, echte
Harness). Ohne die Quelländerung 7 von 8 rot gesehen. Enthält den Drift-Wächter
(Differenz == die sieben akzeptierten Regeln, ND-01/ND-02 als `error` gepinnt) und den
Ableitungs-Nachweis: eine ECHTE geladene Regel aus dem Katalog genommen → sie erscheint
von selbst in `skipped`.

**Umfang:** 3 Quelldateien + 1 neuer Test; zusätzlich drei erzwungene Einzeiler
(`tests/conformance.test.ts` und `tests/evaluation.reconciliation.test.ts` reichen den
Katalog an ihre Duck-Ports durch, `scripts/model-test-set.mjs` nimmt den neuen Test in
die Modell-Spur).

**Vorbestehend rot (nicht Gegenstand dieses CR, hier nur protokolliert):** das Repo
läuft gerade auf verlinkten Arbeitskopien der `@sigloch/*`-Pakete
(`node_modules/@sigloch/* → sigloch-modules/packages/*`). Deren Meta-Modell weist beim
Import der committeten SSOT die Kante `ACTOR-claude-code → UC-code-quality` ab
(„Expected labels are FLOW, ACTOR, FUNC"), weshalb jede Suite, die den Repo-Graphen
lädt, schon auf `master` ohne diese Änderung in `beforeAll` scheitert — u. a.
`tests/evaluation.reconciliation.test.ts` und `tests/conformance.test.ts`. Ebenso
vorbestehend: 13 `tsc`-Fehler in `generate.ts`/`steering*.ts`/`report.ts`
(`score: number | null`, fehlendes `coreApplicable`) aus derselben Paket-Drift, sowie
`distribution` / `lockfile-sync` (ETARGET `@sigloch/graphcode-client@^1.3.0` noch nicht
publiziert). Auf `master` gestasht gegengeprüft: identische Fehlermenge.
