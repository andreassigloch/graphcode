# CR-GC-428 — Zwei Regelkataloge, eine Zahl: `skipped: []` behauptet Vollständigkeit, die es nicht gibt

**Status:** open · **Angelegt:** 2026-08-26
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

- [ ] `rules_evaluate` nennt die 7 nicht ausgewerteten Regel-IDs; die Liste ist **abgeleitet**
      (Test: eine Regel künstlich aus dem Descriptor entfernen → sie erscheint, ohne dass
      jemand eine Tabelle pflegt — vorher rot gesehen).
- [ ] `skipped: []` bedeutet danach beweisbar „nichts ausgelassen".
- [ ] `graph_readiness` weist die Katalog-Herkunft je Zahlenblock aus.
- [ ] Die Beschreibung von `rules_evaluate` behauptet keine identische Grundgesamtheit mehr,
      wo keine ist.
- [ ] Ein Test pinnt die Differenz der beiden Kataloge — wächst sie, schlägt er fehl
      (Drift-Wächter, kein Zahlen-Snapshot).

## Dateien (≤ 5)

1. `src/evaluation.ts`
2. `src/tools/report.ts`
3. ggf. `src/harness.ts` (Zugriff auf den geladenen Katalog)
4. Test
5. dieser CR
