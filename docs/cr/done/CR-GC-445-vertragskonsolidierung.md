# CR-GC-445 — Vertragskonsolidierung am produktiven Modell (Schritt 1 der Zielbild-Kette)

**Status:** **ABGESCHLOSSEN** (2026-08-27) · **Angelegt:** 2026-08-27 · **Typ:** Modellumbau (SSOT),
kein Code-Change
**Ausgangs-Commit:** `af0d1c0` (SSOT `docs/graph/graphcode.graph.json`, graphVersion 212, sauberer
Arbeitsbaum bis auf untracked `_a.html`) — der Rückweg ist `git checkout af0d1c0 --
docs/graph docs/views` + `graph_reseed`.

**Herkunft:**
- **Zielbild** (Auftraggeber): FLOWs 62 → 27 · SCHEMAs 30 → 22 · Modul-Paare 47 → 10 ·
  Randverkehr über die Top-5-Verträge 66 % → 94 %. „Erst werden die Kanten geändert, dann wird
  geschnitten" — dieser CR ist der erste Halbsatz. **Der Modulschnitt ist NICHT Teil dieses CR.**
- **Werkzeug:** [CR-GC-444](../done/CR-GC-444-konsolidierungs-operator.md) — `graph_suggest`
  liefert Merge-Vorschläge als Gate-Batch `[merge-nodes(source→target), ...coupledMerges]`,
  Kandidatenfilter „teilt einen Vertrag" = **identischer SCHEMA-Knoten**.
- **Fachliche Referenz:** [CR-GC-436](../done/CR-GC-436-spike-architektur-optimierung-graphcode.md)
  Nachtrag 2 + `scripts/spike-arch-regelkreis.mjs` (die 35-FLOW-/8-SCHEMA-Liste, 62 → 27).

## Auflage: kein blinder Gruppenkollaps

„Trägt denselben SCHEMA" ist ein **Kandidatenfilter**, kein Beweis. Jeder Merge wurde einzeln an
Name, Beschreibung und den io-Nachbarn geprüft (Dossier: alle 8 Gruppen mit Produzenten/Konsumenten
je FLOW). Das angewandte Kriterium — **eines**, damit es nachprüfbar bleibt:

> Zusammengelegt wird, wo zwei FLOWs **denselben Wert an derselben Stelle der Kette** tragen: der
> Vertrag ist bereits identisch (contracts-Kardinalität `FLOW -relation-> SCHEMA` = 1..1, also
> deklariert das Modell die Gleichheit schon) **und** der Unterschied ist eine Zustands- oder
> Weitergabe-Variante, kein Rechenschritt. **Nicht** zusammengelegt wird, wo einer der beiden aus
> dem anderen **berechnet** wird (dann ist der Vertrag nur zufällig gleich getauft), wo der eine
> eine **Anfrage** und der andere ihre **Antwort** ist, oder wo die Knotenbeschreibung selbst den
> Zweck der Trennung benennt.

## Durchführung

- **Alles durch das Gate:** 23 × `graph_mutate({commands:[{op:'merge-nodes',…}]})` + 1 ×
  `graph_mutate` mit 9 `update-node` (die Beschreibungen der Überlebenden, s. u.). Kein Hand-Edit
  des SSOT. SSOT + Views geschrieben durch `graph_export` (kanonischer Sync-Pfad), danach
  `scripts/export-graph.mjs` — dessen Round-Trip-Wache (byte-identisches Re-Export) ist grün, der
  SSOT ist also in kanonischer Form.
- **Greedy über den Vorschlagspfad:** 23 Runden, je Runde neu `graph_suggest({target:{coherence:1},
  k:20, layer:'arch'})`. In **11** Runden stand der ausgeführte Zug wörtlich in der Vorschlagsliste
  (`via: operator`, angewandt über das exportierte `batchFor`), in **12** Runden nicht — dann wurde der
  geprüfte Zug direkt als derselbe Batch gefahren (`via: hand`). Grund s. Befund 2.
- **Kein fremder MCP-Host benutzt.** Der Repo-Store gehört PID 6226 (`dist/cli.js mcp`, gebootet
  2026-08-26, also **vor** dem heutigen `dist`); `kill` ist in dieser Session nicht erlaubt.
  Verdrahtung deshalb wie in `harness.ts` für genau diesen Fall dokumentiert: **echter `repoRoot`**
  (damit `realRef`/`testRefs` auflösen und die RC-Zahlen ehrlich sind) + **Disk-Kuzu im Temp** +
  `lockDir` = Temp, also kein zweiter Schreiber auf `.graphcode/kuzu`. Dieselbe Bauart wie CR-GC-436
  Lauf B, nur dass hier exportiert wird. **Folge:** der Live-Store ist jetzt hinter dem SSOT —
  s. „Nachzuziehen", Punkt 1.
- **Delta-Prüfung nach JEDEM Zug:** `rules_evaluate` gegen die Fehler-Baseline. **0 neue
  error-Violations, 0 abgewiesene Merges.** Endstand aus dem **Store zurückgelesen**
  (`harness.loadGraph()`), nicht aus der Arbeitskopie.

## Was zusammengelegt wurde — 23 Merges

**Der Graph als EIN Wert** (SCHEMA-ontology-graph, 9) → `FLOW-graph-state`:
`committed-graph` · `draft-graph` · `graph-snapshot` · `recalled-state` · `merged-graph` ·
`migrated-graph` · `parsed-graph` · `capture-draft` · `branch-graphs`.
Begründung: geladen / appliziert / persistiert / serialisiert-und-zurückgelesen / migriert /
gemergt / wiederhergestellt sind **Zustände eines OntologyGraph**, kein zweiter Datenvertrag
(`parsed-graph` sagt es selbst: „== Original"). Deckt sich mit CR-GC-436.

**Eine Leseanfrage** (SCHEMA-query-params, 3) → `FLOW-query-request`:
`expand-request` · `export-request` · `view-request`. Begründung: Element+Tiefe, Cursor+Zweig,
View-Auswahl sind Parameterformen **einer** parametrisierten Leseanfrage; die View-Skills **reichen
dieselbe Anfrage weiter** (Mensch → Skill → Exporter), sie transformieren sie nicht.

**Ein Skill-Auftrag** (1) → `FLOW-skill-request`: `authoring-request`. Autoren- und Berichts-Skills
nehmen denselben Auftrag entgegen; die Trennung war eine Sortierung der Konsumenten.

**Das Urteil des Gates** (SCHEMA-mutate-result, 4) → `FLOW-gate-verdict`:
`violations` · `bootstrap-result` · `suggest-result` · `round-findings`. Begründung: `MutateResult`
trägt Violations als Feld — das Modell deklariert die Gleichheit bereits (ein SCHEMA, fünf FLOWs);
`suggest-result` hat sogar denselben Produzenten (`FUNC-mutate`).

**Format-E** (SCHEMA-format-e, 3): `expanded-subgraph` → `FLOW-impact-subgraph` (die vertiefte
Scheibe **ist** die Scheibe); `bulk-formatE` + `formatE-candidates` → `FLOW-formatE-artifact`
(ein vollständiges Format-E-Dokument am Modulrand; wer es verfasst hat, steht an der
Produzenten-Kante, nicht im Vertrag).

**Restgruppen** (3): `rendered-view` → `FLOW-markdown-docs` (wortgleich dasselbe Artefakt) ·
`viewer-stream` → `FLOW-live-event` (der Viewer-Strom IST der Update-Event-Strom) ·
`suggested-edit` → `FLOW-mutate-cmd` (ein dryRun-verifizierter MutateCommand).

**Nachgezogen, weil der Merge sonst lügt:** die Beschreibungen (und zwei Namen) der 9 Überlebenden
— der überlebende Knoten behält bei `merge-nodes` seine alte, jetzt zu enge Fassung
(`FLOW-graph-state` hieß „Aktueller OntologyGraph (in-memory)", nachdem er 9 weitere Zustände
aufgenommen hatte). Ein Zug, 9 `update-node`, durchs Gate.

## Was bewusst NICHT zusammengelegt wurde

**7 Kandidaten innerhalb der 8 Gruppen** (voller Gruppenkollaps wären 30 Merges gewesen):

| ausgelassen | Kandidat wegen | fachlicher Grund |
|---|---|---|
| `FLOW-element-slice` → `graph-state` | SCHEMA-ontology-graph | Eine **gefilterte Antwort an den Agenten**, nicht der Modellzustand. Gehört zur Scheiben-Familie (so auch CR-GC-436) — dorthin unerreichbar, weil sein SCHEMA `ontology-graph` ist und der gekoppelte SCHEMA-Merge 10 fremde FLOWs mitnähme. |
| `FLOW-steering-trigger` → `query-request` | SCHEMA-query-params | Ein **Befehl** („fahre eine Steuerungsrunde"), keine Leseanfrage. |
| `FLOW-version-bump` → `query-request` | SCHEMA-query-params | Eine **Meldung** neuer ONTOLOGY/RULES_VERSION an den Migrationspfad, keine Anfrage. |
| `FLOW-skill-request` ↔ `query-request` | SCHEMA-query-params | Skill-Aufruf und Graph-Leseanfrage haben disjunkte Produzenten UND Konsumenten; ein Vertrag „QueryParams" über beide ist bereits die Übertypisierung, die die Gruppe erst erzeugt hat. |
| `FLOW-formatE-artifact` ↔ `impact-subgraph` | SCHEMA-format-e | **Vollständiges Dokument** gegen **angefragte Scheibe** — Format-E ist die Serialisierung, nicht der Zweck. |
| `FLOW-skill-report` → `markdown-docs` | SCHEMA-markdown-view | Der Skill-**Bericht an den Menschen** ist kein generiertes, eincheckbares View-File mit GENERATED-Header. Der Operator schlug hier zusätzlich die **falsche Richtung** vor (`markdown-docs → skill-report`). |
| `FLOW-install-result` → `cli-command` | SCHEMA-cli-command | **Kommando und Ergebnis** sind entgegengesetzte Richtungen. Das SCHEMA heißt wörtlich „CliCommand + Ergebnis" — es ist zu weit gefasst; der Befund ist ein Kandidat zum **Teilen**, nicht zum Mergen. |

**Alle 8 gekoppelten SCHEMA-Merges der CR-GC-436-Referenz ausgelassen** — und damit jeder
Cross-SCHEMA-FLOW-Merge (die zweite Hälfte des Zielbilds). Geprüft, einzeln, am Knoten:

| Referenz-Merge | fachlicher Grund gegen |
|---|---|
| `SCHEMA-measurement-vector` → `steering-snapshot` | Der Knoten trägt `concept=true` und sagt: „Bewusst spec-only … sein Zweck ist, diese Verstreuung **sichtbar zu halten**." Der Merge löscht genau den Zweck. |
| `SCHEMA-metric-vector` → `steering-snapshot` | `external=true`, `realRef` auf `se-engine/src/metrics.ts#MetricVector`. Und `FLOW-arch-fitness` sagt selbst: „das einzige Signal der Schleife, das **nicht** aus dem Regelstrom stammt" — also ausdrücklich keine Projektion des Snapshots. |
| `SCHEMA-readiness-report` · `phase-readiness` · `completeness` · `module-metrics` → `steering-snapshot` | Jeder dieser FLOWs wird **aus** dem Snapshot bzw. aus den Violations **berechnet** (`compute-readiness`, `compute-phase-readiness`, `score-completeness`, `module-metrics`). Den Rechenschritt einzuklappen macht die Funktion zum Produzenten und Konsumenten desselben Vertrags — die Messkette verliert ihre Richtung. |
| `SCHEMA-fit-advisory` · `steering-delta` → `mutate-result` | Beide haben einen eigenen `realRef` auf ein eigenes Symbol (`src/steering/fit-advisory.ts#FitAdvisory`, `steering-snapshot.ts#SteeringDelta`); `SCHEMA-mutate-result` ist `external=true` (contracts). Ein **Feld von** MutateResult zu sein ist nicht dasselbe wie MutateResult zu sein — der Merge würde eine fremde Vertragsherkunft über eine lokale schreiben. |
| `SCHEMA-impacted-tests` → `test-selection` | `resolve-tests-from-code` liefert `impacted-tests`, `deduce-tests` macht daraus `test-selection` — Rechenschritt (und die Referenz selbst ist hier inkonsistent: sie mergt den FLOW nach `impact-subgraph`, den SCHEMA nach `test-selection`). |
| `SCHEMA-round-scope` · `round-injection` → `generation-step` | Beide Quellen sind ausdrücklich `concept=true`, „**kein festes Wire-Format**"; `generation-step` ist ein echter Vertrag. Informationellen Kontext in einen Wire-Vertrag zu mergen behauptet eine Verbindlichkeit, die es nicht gibt. |

## Messung (contracts 10.0.0, heutige Regelkorrekturen; `layer: arch`)

| Kennzahl | vorher | nachher |
|---|---|---|
| FLOWs | 62 | **39** |
| SCHEMAs | 32 | **32** (unverändert) |
| Modul-Paare (`moduleCrossings.pairs`, ungerichtet) | 47 | **79** |
| gerichtete Kanten zwischen Modulen | 62 | **106** |
| CR-01-Befunde (distinct, seit CR-SM-274) | 47 | **79** |
| R-04-Befunde (seit CR-SM-276) | 5 | **5** |
| Kohäsion gesamt (`moduleMetrics`, intern / (intern+extern)) | 7,1 % | **9,7 %** |
| Module mit 0 internen Verbindungen (von 12 messbaren) | 5 | **3** |
| Modulrand-Vokabular (verschiedene FLOWs queren Grenzen) | 29 | **22** |
| **Randverkehr über die Top-5-Verträge** | **66,9 %** | **91,1 %** |
| Blatt-Verbindungen (FUNC-Paare über gemeinsame FLOWs), davon intern | 207 / 35 = 16,9 % | **655 / 163 = 24,9 %** |
| Violations gesamt (error / warning / info) | 79 (1 / 33 / 45) | **109 (1 / 35 / 73)** |
| readiness `arch` | 0,982 | **0,970** |
| readiness `alloc` | 0,949 | **0,955** |

Kohäsion je Modul (`internal` / `external` / ratio, vorher → nachher):

| MOD | int | ext | ratio |
|---|---|---|---|
| harness | 10 → 58 | 100 → 254 | 0,09 → **0,19** |
| executor | 4 → 5 | 33 → 35 | 0,11 → **0,13** |
| skills | 0 → 21 | 98 → 176 | 0,00 → **0,11** |
| cli | 9 → 9 | 35 → 96 | 0,20 → **0,09** |
| steering | 7 → 7 | 51 → 89 | 0,12 → **0,07** |
| mcp-tools | 2 → 7 | 30 → 120 | 0,06 → **0,06** |
| docs | 1 → 1 | 12 → 39 | 0,08 → **0,03** |
| codec | 1 → 1 | 10 → 47 | 0,09 → **0,02** |
| host-bridge | 0 → 1 | 38 → 60 | 0,00 → **0,02** |
| hooks · metrics-engine · schema-migration | 0 → 0 | 11/21/3 → 39/45/26 | 0,00 → **0,00** |

Regelstrom-Bilanz: **CR-01 +32** (info/warning), **MT-02 −1**, **RC-05 −1**, alles andere
unverändert; **error bleibt bei 1** (dieselbe Vorlast, R-02).

## Befunde

1. **Die Zielbild-Zahl ist mit Verträgen allein fast erreicht: 66,9 % → 91,1 %** (versprochen 93,8 %
   — dort **inklusive** 5er-Modulschnitt). Der Randverkehr läuft danach über
   `graph-state` (273) · `query-request` (63) · `gate-verdict` (58) · `mutate-cmd` (46) ·
   `formatE-artifact` (8). Das Vokabular am Modulrand schrumpft 29 → 22 verschiedene Flüsse.
   **Die Konzentration kommt aus den Kanten, nicht aus der Partition.**
2. **Der Operator findet die Gruppen, nicht die Überlebenden.** In 12 von 23 Runden war der
   höchstbewertete Vorschlag ein Paar aus der **richtigen** Gruppe mit dem **falschen** Ziel
   (`bootstrap-result → violations` statt `→ gate-verdict`) oder in der falschen Richtung
   (`markdown-docs → skill-report`). Δm rankt Topologie; welcher Knoten den Namen und die
   Beschreibung der Familie tragen soll, ist eine fachliche Entscheidung. Der Operator ist damit
   ein **Kandidatenfinder**, kein Autopilot — genau wie CR-GC-444 offengelassen hat.
3. **Hub-Inflation ist gate-hart bestätigt** (CR-GC-436 Befund 3, dort nur in-memory):
   Modul-Paare 47 → 79, Blatt-Verbindungen 207 → 655, CR-01-Befunde 47 → 79. Ein Vertrag, den
   viele teilen, verbindet rechnerisch jeden Produzenten mit jedem Konsumenten. **Beide Zahlen sind
   wahr:** die Zahl der **Verträge** am Rand sinkt (29 → 22), die Zahl der **Paare** steigt. CR-01
   zählt Paare-mit-Verträgen und wird darum schlechter, während die Sache besser wird — die Regel
   misst hier gegen das Ziel. Das ist ein contracts-Kandidat, kein Grund, den Umbau zu drehen.
4. **Das SCHEMA-Ziel (30 → 22) ist mit diesem Kriterium nicht erreichbar** — und der Grund liegt
   nicht am Werkzeug: **alle 8** gekoppelten SCHEMA-Merges der Referenz scheitern an dem, was die
   Knoten selbst über sich sagen (`concept=true` „sichtbar halten", `external=true` + eigener
   `realRef`, oder ein echter Rechenschritt zwischen den beiden). Die In-Memory-Trockenübung konnte
   sie behaupten, weil nichts hinsah. Wer die 22 will, muss vorher eine **Modell-Entscheidung**
   treffen (z. B. `FitAdvisory`/`SteeringDelta` in contracts wirklich zu Feldern von `MutateResult`
   machen und die Knoten entsprechend umschreiben) — das ist ein eigener CR, kein Merge.
5. **Zwei Vorlast-Befunde sind mitgefallen** (MT-02, RC-05), ein bekannter Fehler bleibt (R-02).
6. **Der Merge nimmt die Beschreibung nicht mit.** `merge-nodes` behält die des Ziels; ohne den
   Nachzieh-Zug hätte `FLOW-graph-state` weiter „in-memory" behauptet, während 9 Zustände darin
   stecken. **Jeder Konsolidierungs-CR braucht diesen zweiten Zug** — Kandidat für eine
   `graph_suggest`-Erweiterung (der Vorschlag könnte die Zielbeschreibung mitliefern).

## Nachzuziehen (nicht in diesem CR erledigt)

1. **Der Live-Store ist hinter dem SSOT.** PID 6226 hält den Repo-Kuzu mit dem Stand vor der
   Konsolidierung; sein nächstes `graph_export` würde die 23 FLOWs **still wieder anlegen** (der
   Clobber-Schutz greift nicht, weil sein Graph ein Superset des committeten ist). **Vor der
   nächsten Graph-Arbeit** in dieser Session: `graph_reseed` auf dem laufenden Host (liest die
   committete SSOT in den Store, in-process) **oder** den Host neu starten — dann bootet er
   ohnehin das heutige `dist`.
2. **`FLOW-element-slice`** hängt am falschen Vertrag (`ontology-graph` statt Format-E/Scheibe) —
   Modellpflege, ein `update`-Zug plus SCHEMA-Entscheidung.
3. **`SCHEMA-cli-command`** („CliCommand + Ergebnis") ist zu weit gefasst und erzeugt einen
   Falsch-Positiv-Kandidaten. Teilen, nicht mergen.
4. **CR-01 gegen die Zielrichtung** (Befund 3) — contracts-Frage: soll die Regel Paare zählen,
   wenn Konsolidierung Paare erzeugt?
5. **Der `graphVersion`-Stempel im SSOT ist von 212 auf 24 zurückgefallen** — Nebenwirkung des
   Temp-Stores: `_graphVersion` wird aus dem **durable audit log des Stores** fortgesetzt
   (`tool-context.ts`), und der Temp-Store startete bei 0. Der Stempel ist reine
   Snapshot-Metadatik — **keine** Quelle liest ihn (weder Regeln noch OCC noch
   `computeAnalysisCurrency`, die alle den Live-Zähler nehmen), und der Repo-Host setzt seinen
   Zähler aus `.graphcode/audit.jsonl` (> 212) fort. Trotzdem steht im committeten File eine
   kleinere Zahl als vorher; wer mit einem Temp-Store exportiert, sollte den Zähler vorsetzen
   können (heute geht das nicht).
6. **Der 5er-Modulschnitt** — Entscheidung des Auftraggebers, ausdrücklich nicht angefasst.

## Akzeptanzkriterien

- [x] Jeder Merge einzeln fachlich geprüft (Name, Beschreibung, io-Nachbarn), Auslassungen benannt.
- [x] Alles durch das Apply-Gate (`graph_mutate`), kein Hand-Edit des SSOT, kein fremder MCP-Host.
- [x] 0 neue error-Violations; Endstand aus dem Store zurückgelesen.
- [x] SSOT + Views über `graph_export` + `scripts/export-graph.mjs` synchronisiert (Round-Trip-Wache grün).
- [x] Messtabelle vorher/nachher in EINER Tabelle, gegen contracts 10.0.0.
- [x] Volle Suite: **984 passed / 20 failed** — exakt die dokumentierte Vorlast, Datei für Datei
      (`distribution`, `lockfile-sync` = Publish-Pending; `config`, `metrics`, `claims.conformance`,
      `generate`, `executor.bestofn`, `steering.architecture-causality`,
      `steering.divergence-two-profiles`, `suggest.ranks-…` = contracts-10-Fixture-Kollateral).
      **Keine neue Rote.** Die modell-pinnenden Tests sind grün: `verify:model` 324/324,
      `exporter` 34/34, `export-graph-guard` 9/9, `arch.optimization-dry-run.spike` 2/2.
