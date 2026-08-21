# CR-GC-389 — Die echten Löcher im Modell schließen

**Status:** teilweise umgesetzt · **Angelegt:** 2026-08-21 · **Umgesetzt:** 2026-08-21 (graphVersion 136 → 145) · **Basis:** `rules_evaluate` @ graphVersion 136 (370 Violations)

## Problem

370 Violations, aber nur ein kleiner Teil beschreibt einen Mangel am *aktuellen* System. Dieser CR
nimmt genau den Teil: Elemente, die im Graph stehen und dort unvollständig verdrahtet sind. Alles
reine Gate-Mutationen, keine Code-Änderung.

Nicht in diesem CR: die CR-History (→ offene Entscheidung) und die Skills ohne REQ (→ CR-GC-390).

## Scope

**A — 2 Errors (die einzigen mit aktuellem Bezug)**

| Regel | Element | Befund | Fix |
|---|---|---|---|
| CR-R02 | `CR-GC-257` | done, kein `commitRef`; kein CR-Dokument vorhanden | `commitRef: ad6151b` (*feat: R-21 integration-test coverage per FUNC↔FUNC connection*) |
| CR-R01 | `CR-GC-321` | einziger **offener** CR ohne `relation`-Trace | `relation` → die vom Codec-Namensfallback betroffenen FUNC |

**B — 3× R-22: FUNC ohne Modul**

`FUNC-arch-fitness`, `FUNC-compute-readiness`, `FUNC-module-metrics` sind keinem MOD zugeteilt.
Alle drei rechnen Kenngrößen → `allocate` → `MOD-steering`. Vor dem Setzen prüfen, ob
`FUNC-compute-readiness` nicht doch nach `MOD-harness` gehört (es wird von `graph_readiness`
aufgerufen); die Zuteilung entscheidet mit über LCOM4 von `MOD-steering` (heute 4).

**C — 4× IO-01: io-verdrahtet, aber ohne FLOW-Pfad in der eigenen FCHAIN**

| FUNC | FCHAIN | fehlender Pfad nach |
|---|---|---|
| `FUNC-import` (MOD-harness) | `FCHAIN-capture` | `FUNC-decode` |
| `FUNC-merge-nodes` (MOD-codec) | `FCHAIN-codec-roundtrip` | `FUNC-decode` |
| `FUNC-mutate` (MOD-harness) | `FCHAIN-interface-escalation` | `FUNC-graph-impact` |
| `FUNC-mutate` (MOD-harness) | `FCHAIN-snapshot-freshness` | `FUNC-graph-export-snapshot` |

Pro Fall die Frage stellen: fehlt der FLOW, oder gehört die FUNC nicht in die Kette? Beides ist ein
gültiges Ergebnis — der zweite Fall heißt `compose`-Kante löschen, nicht FLOW erfinden.

**D — 3× SC-04: FLOW ohne SCHEMA**

`FLOW-round-findings`, `FLOW-round-scope`, `FLOW-suggested-edit` — alle drei aus dem Executor-Rundenlauf.
Ein SCHEMA je FLOW; die Struktur steht in den Zod-Typen des Executors, wird also abgelesen, nicht erfunden.

**E — 10× RD-01: Leaf-REQ ohne Satisfier**

Geprüft an den Beschreibungen: **alle zehn beschreiben Verhalten des Steuerungskerns bzw. des Gates,
das Code erfüllt** — kein Skill-Thema. Es fehlt der `satisfy`-Trace, nicht die Implementierung; für
mehrere existiert der Erfüller bereits und ist nur nicht verdrahtet.

| REQ | erfüllt vermutlich durch |
|---|---|
| `REQ-graph-context-replaces-reading` | `FUNC-graph-context` (existiert) |
| `REQ-single-write-door` | `FUNC-mutate` (existiert) |
| `REQ-published-counts-match-code` | `FUNC-check-code-conformance` (existiert, prüfen) |
| `REQ-single-measurement-path` | `FUNC-compute-steering-delta` / `FUNC-graph-next-step` |
| `REQ-target-shifts-ranking` | Ranking in `executor-rank.ts` — FUNC-Knoten prüfen |
| `REQ-thresholds-from-config` | MetricPolicy-Pfad in `MOD-steering` |
| `REQ-phase-gate-not-skippable` | `FUNC-compute-phase-readiness` |
| `REQ-monotone-convergence` | Runden-Loop im Executor |
| `REQ-applied-suggestion-moves-target` | `FUNC-graph-suggest` + Gate |
| `REQ-one-driver-local-and-frontier` | Executor-Backend-Auswahl |

Die rechte Spalte ist **Kandidat, nicht Befund** — vor dem Setzen je REQ den Erfüller belegen. Wo
kein Erfüller existiert, ist die REQ unerfüllt und das ist das Ergebnis: dann bleibt `RD-01` stehen
und wird zum Backlog-Eintrag, nicht zu einer erfundenen Kante.

**F — 4 Einzelfälle Kettenschluss**

- `UC-loop-closure` hat keine FCHAIN (`UC-03` + `FC-02`, dieselbe Sache doppelt gemeldet)
- `FCHAIN-doc-export` dient keinem UC (`R-15`) — Kandidat ist `UC-live-graph-view` oder ein eigener Doku-UC
- `FCHAIN-live-update` ist nicht actor-bounded (`FC-04`) — es fehlt ACTOR rein **und** raus

## Nicht enthalten, weil kein Modellfehler

`AF-01`…`AF-05` (5 Views ohne Freshness-Stamp: conops, trade, assumption-review, fmea, implplan).
Das ist kein fehlender Knoten, sondern „die View wurde nie mit Stamp gerendert" — ein Lauf der fünf
`se-view:*`-Skills, kein CR. Erledigt sich nebenbei, schreibt aber `docs/views/*.md` und würde die
Dateigrenze dieses CR sprengen.

## Definition of Done

- [ ] `rules_evaluate`: 0 Errors außer den CR-History-Errors aus dem noch offenen Punkt
- [ ] `R-22` = 0, `IO-01` = 0, `SC-04` = 0, `R-15`/`FC-04`/`UC-03`/`FC-02` = 0
- [ ] `RD-01`: jede verbleibende Meldung ist eine belegt unerfüllte REQ, keine offene Verdrahtung
- [ ] Alle Änderungen durch `mutate()` mit `baseVersion`, kein Hand-Edit
- [ ] `scripts/export-graph.mjs` danach (nicht das `graph_export` des laufenden Servers)
- [ ] `npm test` grün

**Dateien:** `docs/graph/graphcode.graph.json`, dieses CR-Dokument.

---

## Ergebnis (2026-08-21, graphVersion 136 → 145)

`rules_evaluate`: **370 → 358**. Zwölf Violations geschlossen, **keine neue erzeugt** (Regel-Delta
gegen den Ausgangslauf gerechnet, nicht geschätzt):

| Regel | vorher → nachher | |
|---|---|---|
| CR-R02 | 1 → 0 | `CR-GC-257` commitRef `ad6151b` |
| CR-R01 | 25 → 24 | `CR-GC-321` (war fälschlich `open`, liegt in `done/`) → status+commitRef `e2882cf` + 3 relation |
| CR-R04 | 69 → 68 | dito |
| R-22 | 3 → 0 | neues `MOD-metrics-engine` |
| IO-01 | 4 → 2 | Fälle merge-nodes + snapshot-freshness |
| SC-04 | 3 → 1 | die zwei belegbaren SCHEMA-Bindungen |
| RD-01 | 10 → 8 | die zwei belegbaren Satisfier |
| FC-04 | 1 → 0 | `FCHAIN-live-update` actor-gebunden |

**Abweichungen vom Plan, jeweils mit Grund:**

- **Ein MOD statt drei.** Alle drei R-22-FUNCs sind `external: true`; zwei zeigten auf
  `packages/se-optimizer/` und `packages/se-steering/` — **Pakete, die es nicht mehr gibt**
  (zusammengeführt zu `@sigloch/se-engine@1.1.0`, das `metrics` und `computeReadiness` exportiert).
  Die realRefs sind mitkorrigiert. Zwei getrennte MODs hätten `MOD-repo-root` auf 12 Kinder gebracht
  und `RD-04` neu ausgelöst — Warnung gegen Warnung getauscht. Ein MOD ist auch fachlich richtiger:
  alle drei erfüllen `REQ-steering-from-metrics`, die Modulgrenze folgt der Aufgabe, nicht dem Paket.
- **`FUNC-compute-readiness` → `MOD-metrics-engine`**, nicht `MOD-harness` wie im Plan erwogen. Der
  Code liegt in se-engine; der Aufruf durch `graph_readiness` ist Nutzung, nicht Allokation.

## Offen — belegt, nicht vergessen

**IO-01, 2 Fälle.** Beide sind keine fehlende Kante, sondern eine offene Sachfrage:

- `FUNC-import` in `FCHAIN-capture`: der Knoten ist beschrieben als „**Format-E**-Bulk-Import
  **ausschließlich durchs Gate**", aber `importGraph` nimmt `OntologyJson`, und der Code sagt
  ausdrücklich *„the gate stays out of reach from that module by construction"* (CR-GC-260).
  **Beschreibung und realRef widersprechen sich an zwei Punkten.** Welcher gilt? Erst danach ist
  entscheidbar, ob `import` in die Erfassungskette gehört.
- `FUNC-mutate` in `FCHAIN-interface-escalation`: `grep -rn escalat src/` findet **nichts**,
  `TEST-interface-escalation` hat keinen testRef und Status `open`. Die Kette beschreibt einen
  Sollprozess, der nicht implementiert ist. Ein FLOW dafür wäre erfunden.

**RD-01, 8 Fälle.** Für keinen ließ sich ein Erfüller belegen. Zwei geprüfte Gegenbeispiele:
`FUNC-check-code-conformance` prüft **keine** Anzahlen (`REQ-published-counts-match-code`), und
`rankCandidates` nimmt eine `focusDimension` als String, **keinen Zielvektor** — damit erfüllt es
`REQ-target-shifts-ranking` nicht. Diese acht REQ sind unerfüllt, nicht unverdrahtet. Backlog.

**R-15 / UC-03 / FC-02, 3 Fälle.** `FCHAIN-doc-export` braucht einen UC und `UC-loop-closure` eine
FCHAIN — für beide existiert kein Kandidat im Modell, den man belegen könnte. Das sind
Modellentscheidungen, keine Verdrahtung.

**Ein Test angepasst.** `tests/rewind.test.ts:243` verlangte per `toEqual` die exakte Liste
`['FCHAIN-recall','FCHAIN-snapshot-freshness']` unter `UC-graph-time-travel` und brach an
`FCHAIN-merge-branches`. Auf `arrayContaining` umgestellt: die Zusicherung aus CR-GC-311 ist, dass
diese beiden Ketten da sind — nicht, dass nie eine dritte dazukommt.

**Nicht von diesem CR verursacht, aber gefunden:**

- `RC-04` (6) und `RC-05` (5) erscheinen **nur in `graph_readiness`**, nie in `rules_evaluate` —
  die Konformanz-Regeln lesen das Dateisystem und laufen im anderen Werkzeug nicht mit. Durch
  Entfernen und Wiedersetzen der beiden SCHEMA-Kanten gemessen: die Zahlen bewegen sich nicht.
  Wer nur `rules_evaluate` liest, sieht 11 Violations nicht.
- `tests/distribution.test.ts` ist rot: `package.json` fordert `@sigloch/graph-view-edit@^0.6.0`,
  publiziert ist bis `0.5.0` (npm ETARGET). Uncommittete Änderung, älter als dieser CR.

## Verifikation

- `npm run build` grün · `npx vitest run` **856/857**; der eine Fehler ist der ETARGET oben
- Alle Änderungen durch `mutate()` mit `baseVersion`, jeder Batch zuerst als `dryRun`
- `scripts/export-graph.mjs` gelaufen (nicht das `graph_export` des laufenden Servers)
