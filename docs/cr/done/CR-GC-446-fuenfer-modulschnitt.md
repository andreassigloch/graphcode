# CR-GC-446 — Der 5er-Modulschnitt am produktiven Modell (Schritt 2 der Zielbild-Kette)

**Status:** **ABGESCHLOSSEN** (2026-08-27) · **Angelegt:** 2026-08-27 · **Typ:** Modellumbau (SSOT)
+ Nachzug der modell-pinnenden Tests
**Ausgangs-Commit:** `4f450c4` (SSOT `docs/graph/graphcode.graph.json`, 669 Knoten / 1807 Kanten /
39 FLOW, sauberer Arbeitsbaum bis auf untracked `_a.html`) — der Rückweg ist
`git checkout 4f450c4 -- docs/graph docs/views` + `graph_reseed`.

**Herkunft:**
- **Schritt 1** = [CR-GC-445](../done/CR-GC-445-vertragskonsolidierung.md): „erst werden die Kanten
  geändert, dann wird geschnitten". Dieser CR ist der zweite Halbsatz.
- **Fachliche Referenz:** [CR-GC-436](../done/CR-GC-436-spike-architektur-optimierung-graphcode.md)
  Nachtrag 2, Lauf B (der 8er-Handschnitt) — hier abgelöst, s. Abschnitt „Nachzug".
- **Muster für MOD-Zuordnung + realRef + `MOD.path` in einem Zug:**
  [CR-GC-429](../done/CR-GC-429-contracts-nachzug-grammatik-und-abdeckung.md) §4.

## Der Zielschnitt (Auftraggeber, verbindlich als Absicht — nicht als Zahlenzwang)

| Modul | Rolle | FUNC Zielbild | FUNC erreicht |
|---|---|---|---|
| `kernel` | Store ∘ Gate ∘ Regeln ∘ OpLog — einziger Kuzu-Owner; `apply(Command[]) → Verdict`, `query(TypedQuery) → Slice` | 25 | **26** |
| `projections` | Messung · Readiness · Codec · Export · Views · Trajectory — pure Graph → X | 21 | **19** |
| `loop` | Autopilot + Executor — ein Client wie jeder andere | 13 | **14** |
| `surface` | MCP-stdio · CLI · Host-Socket · Viewer/SSE — Adapter, keine Logik | 23 | **23** |
| `agent-surface` | Skill-Treiber (.claude) — Bedienschicht des Menschen | 25 | **26** |

108 FUNC, alle alloziert, keine unallozierte übrig. Die drei Abweichungen sind unten begründet.

## Durchführung

- **Alles durch das Gate:** 10 × `graph_mutate` über den **Tool-Layer**
  (`tools.graph_mutate.handler`, nicht `harness.mutate()` roh — sonst schreibt `recordAudit` keine
  Provenienz und `graph_export` verweigert die eigene Löschung als Fremd-Clobber). 492 Kommandos:
  5 `add-node` + 5 `add-edge` (SYS-compose) · 216 `delete-edge`/`add-edge` (108 Umhängungen) ·
  73 (satisfy) · 159 (CR-relation) · 18 (MOD-repo-root entkoppeln) · 16 `delete-node`.
- **Umhängen = eine Kardinalität `0..1`:** alte `allocate`-Kante weg, neue hin, **in EINEM Batch**
  (Muster CR-GC-435 `retire`). Der persist-Fallstrick greift nur bei DERSELBEN Kante.
- **Kein fremder MCP-Host benutzt.** Der Repo-Store gehört PID 6226 (`dist/cli.js mcp`, gebootet
  2026-08-26 **13:25** — also vor der contracts-10.0.0-Installation um 17:25; sein Regelkatalog ist
  9.x und liefert z. B. **0** CR-01-Befunde statt 79). Verdrahtung deshalb wie CR-GC-445:
  **echter `repoRoot`** (damit `realRef`/`testRefs` auflösen und `importCoverage`/RC ehrlich sind)
  + **Disk-Kuzu im Temp** + `lockDir` = Temp. Danach `graph_reseed` auf dem laufenden Host
  (658/1794), damit er nichts zurückschreibt.
- **Delta-Prüfung nach jedem Batch:** **0 neue error-Violations, 0 abgewiesene Batches.** Endstand
  aus dem Store zurückgelesen (`loadGraph()`).
- SSOT + Views über `graph_export`, danach `scripts/export-graph.mjs` — Round-Trip-Wache grün.

## Der Schnitt — jede FUNC nach ihrer Rolle

**kernel (26)** — Lifecycle/Sperre (`open-store` · `close-store` · `claim-store-lock` ·
`own-kuzu-host` · `create-harness` · `load-graph` · `save-graph` · `export-marker`), Gate + Regeln +
OpLog (`mutate` · `evaluate-rules` · `check-code-conformance` · `load-config`), Bestand hinein/heraus
(`import` · `seed-from-json` · `reseed` · `apply-reseed` · `merge-nodes` · `migrate-schema` ·
`schema-guard`), `query(TypedQuery) → Slice` (`list-elements` · `graph-impact` · `graph-expand` ·
`resolve-tests-from-code`), Blöcke `block-gate` · `block-speicherwerk` · `block-ruestzeug`.

**projections (19)** — Codec (`decode` · `encode`), Export/Views (`export-markdown` · `auto-export` ·
`graph-export-snapshot`), Trajektorie (`emit-trajectory`), Messung/Readiness (`score-completeness` ·
`compute-readiness` · `compute-phase-readiness` · `arch-fitness` · `module-metrics` ·
`take-steering-snapshot` · `compute-steering-delta` · `fit-advisory` · `nd-similarity` ·
`deduce-tests`), Blöcke `block-messwerk` · `block-dokumentenwerk` · `block-gedaechtnis`.

**loop (14)** — Executor (`run-executor` · `build-round-injection` · `extract-mutate` ·
`rank-candidates` · `preflight`), Schleifen-Entscheidung (`generation-step` · `goal-steerer` ·
`target-profile-load` · `next-step` · `graph-suggest`), Blöcke `block-antrieb` ·
`block-arch-optimierung` · `block-q-improvement` · `block-se-steuerung`.

**surface (23)** — MCP-stdio (`serve-stdio` · `bind-tools` · `tool-context`), CLI (`cli-dispatch` ·
`harness-cli` · `bootstrap` · `collect-status` · `upgrade` · `rewind` · `run-verb` ·
`import-code-verb` · `session-shutdown` · `gve-sessions` · `gve-supervise`), Host-Socket/SSE
(`host-socket` · `serve-sse` · `broadcast-diff` · `health-endpoint` · `emit-update-event`),
Blöcke `block-anschluss` · `block-betrieb` · `block-schaufenster` · `block-live-dashboard`.

**agent-surface (26)** — die 26 Skill-Treiber unverändert aus `MOD-skills`.

### Die sechs strittigen Zuordnungen — und wie entschieden wurde

| FUNC | Kandidaten | Entscheidung + Grund |
|---|---|---|
| `FUNC-own-kuzu-host` | surface (Code liegt in `src/viewer/host.ts`) ↔ **kernel** | **kernel.** Der Knoten sagt wörtlich „Der Host-Prozess ist der einzige Kuzu-Owner pro Repo" — das IST die kernel-Invariante. Zugeordnet wird die **Rolle**, nicht das heutige Verzeichnis (der Code-Nachzug folgt im Folge-CR). |
| `FUNC-emit-update-event` ↔ `FUNC-emit-trajectory` | beide in `MOD-hooks` | **gespalten:** `emit-update-event` („SSE invalidate bei jeder Mutation, Basis des read-only Dashboards") → **surface**; `emit-trajectory` („reine Projektion des Operations-Logs") → **projections**. Das Modul `hooks` war eine Ablage, keine Rolle. |
| `FUNC-block-gedaechtnis` | kernel (4 Kinder) ↔ **projections** (4 Kinder) | **projections.** Der Block heißt „das Modell als Text-Artefakt — versioniert, wiederherstellbar" — das ist Codec/Export, nicht der Store. Kinder-Mehrheit war unentschieden, die Beschreibung nicht. |
| `FUNC-block-se-steuerung` | agent-surface (9 von 11 Kindern sind Skills) ↔ **loop** | **loop.** Der Knoten sagt „Ebene-1-Block **im Autopilot**". Der Autopilot-Baum (`goal-steerer` → drei Ebene-1-Blöcke) bleibt damit in EINEM Modul; ein Block, dessen Kinder woanders liegen, ist normal (Blöcke sind eine Sicht, keine Ablage). |
| `FUNC-next-step`, `FUNC-graph-suggest` | projections (beide sind pure Graph→X) ↔ **loop** | **loop.** Beide hängen als Kinder unter `goal-steerer`; beide **schlagen einen Zug vor**, statt den Graphen nur zu beschreiben, und beide lesen die Loop-Konfiguration (Policy bzw. Zielprofil). Hätten sie nach projections gehört, wäre projections auf 21 = die Zielbild-Zahl gekommen — genau deshalb wurde nach Rolle und nicht nach Zahl entschieden. |
| `FUNC-deduce-tests` | surface (ist das MCP-Tool `graph_tests`) ↔ **projections** | **projections.** Die Rechnung Graph→Testauswahl ist eine Projektion; die Tool-Registrierung ist `bind-tools` und liegt in surface. |

### Die drei Abweichungen von den Zielzahlen

1. **kernel 26 statt 25** und **agent-surface 26 statt 25** — Rundungsdifferenz des Schaubilds:
   die Zielzahlen summieren sich auf 107, der Graph hat 108 FUNC.
2. **projections 19 statt 21 / loop 14 statt 13** — die eine echte Abweichung, und sie ist die
   Entscheidung aus der Tabelle oben (`next-step` + `graph-suggest`). Verschöbe man sie, träfe man
   projections=21 und loop=12 — dann läge die Abweichung bei loop. Die Zahl ist in beide Richtungen
   nicht zu treffen; die Rolle ist eindeutig.

## Wie die 12 wegfallenden MODs aufgelöst wurden — je Kante begründet

**16 MOD gelöscht, 5 neu, 1 bleibt** → 17 → **6**. Alle Kanten wurden vor dem `delete-node`
umgehängt; die Endprüfung meldet **0 Kanten auf gelöschte Knoten** und **0 MOD ohne Eltern-compose**.

**`MOD-dashboard` bleibt — der eine bewusste Verstoß gegen „17 − 5 = 12".**
Der Knoten ist kein graphcode-Modul, sondern der modellierte **Rand zum Nachbarsystem**
`@sigloch/graph-view-edit` (`external: true`, 0 allozierte FUNC, eigenes Repo, eigener Release).
Seine fünf `satisfy`-Kanten (`REQ-dashboard-readonly`, `-dashboard-ontology-sync`,
`-shared-views-no-fork`, `-readiness-transparent`, `-artifact-freshness`) sind Anforderungen an
**das fremde Paket**. Sie auf `surface` umzuhängen behauptete, graphcodes Adapterschicht erfülle
sie — falsch; sie zu löschen machte fünf REQs unversorgt (RD-01). Beides wäre schlechter als die
Zahl 6 statt 5. Neuer Elternteil: `SYS-graphcode -compose-> MOD-dashboard` (vorher
`MOD-repo-root -compose->`, also dieselbe Tiefe). Der bekannte R-23-Befund („MOD-dashboard has no
allocated FUNC") bleibt Vorlast, unverändert.

| Kantenart | Zahl | Behandlung |
|---|---|---|
| `FUNC -allocate-> MOD` | 108 | **umgehängt**, alle. Alte Kante + neue Kante je Batch zusammen. |
| `MOD -satisfy-> REQ` | 37 → **36** | **umgehängt, je REQ einzeln entschieden** (s. u.). Eine Dublette aufgelöst: `REQ-testref-materialized` wurde von `MOD-docs` **und** `MOD-mcp-tools` getragen — beide landen in projections, also EINE Kante statt zwei. |
| `CR -relation-> MOD` | 82 → **77** | **mechanisch umgehängt** über die dominante Nachfolge, dedupliziert (fünf CRs berührten zwei alte MODs mit demselben Nachfolger, z. B. CR-GC-306 → cli + host-bridge → beide surface). `CR-GC-265` (npm-Manifest/Dependency-Drift) hing an `MOD-repo-root` → **surface**, weil dort die Distribution wohnt; `CR -relation-> SYS` ist kein legales Paar. |
| `MOD-repo-root -compose-> MOD` | 16 | **ersatzlos**, ersetzt durch `SYS-graphcode -compose->` auf die 5 neuen + `MOD-dashboard` (6 Kanten). |
| `SYS-graphcode -compose-> MOD-repo-root` | 1 | **ersatzlos** — der Container ist aufgelöst. |

**Die `satisfy`-Kanten, bei denen die Aufteilung eine Entscheidung war** (die übrigen folgen ihrem
Modul unverändert):

| REQ | von | nach | Grund |
|---|---|---|---|
| `REQ-hook-extension-points` · `-hook-order-deterministic` · `-precommit-timeout` | hooks | **kernel** | Die Extension-Points hängen am Gate: ein pre-commit-Hook kann eine Mutation **blocken**. |
| `REQ-live-event-in-contracts` · `REQ-versioned-cache` | hooks | **surface** | LiveUpdateEvent-Vertrag und version-keyed Response-Cache sind der Live-Kanal, nicht das Gate. |
| `REQ-prompt-provenance` · `REQ-rule-calibration` | mcp-tools | **kernel** | Beide fordern eine **Aufzeichnung** je Gate-Entscheidung — das ist der OpLog, nicht die Transport-Oberfläche. |
| `REQ-export-no-clobber` · `REQ-testref-materialized` | mcp-tools | **projections** | Beide beschreiben das Verhalten des **Exports**, der jetzt in projections liegt. |
| `REQ-single-measurement-path` | steering | **projections** | „dieselbe Violation-Menge, dieselben Dimensions-Scores" — eine Aussage über die **Messkette**. |
| `REQ-monotone-convergence` · `REQ-phase-gate-not-skippable` | steering | **loop** | Beide sprechen über **aufeinanderfolgende Runden** und den Handoff — das ist die Schleife. |

**`MOD-metrics-engine` (3 FUNC, extern realisiert in `@sigloch/se-engine` / `@sigloch/contracts`)
ist in projections aufgegangen** — bewusst, aber mit Verlust: das Modul kodierte „außerhalb dieses
Repos". Diese Information reist jetzt nur noch am `realRef` der drei FUNCs
(`packages/se-engine/src/metrics.ts`, `readiness-compute.ts`, `packages/contracts/src/se/metric-rules.ts`),
nicht mehr an der Modulgrenze. Anders als `MOD-dashboard` hat es allozierte FUNCs und ist **nicht**
`external: true` markiert — deshalb die andere Entscheidung. Als Befund notiert (Punkt 4).

## Messung (contracts 10.0.0 mit den heute korrigierten CR-01/R-04; `layer: arch`)

| Kennzahl | vorher (nach Schritt 1) | nachher | Zielbild |
|---|---|---|---|
| MOD | 17 | **6** | 5 (+1 Nachbarsystem, s. o.) |
| FUNC je MOD | 26/15/12/11/9/9/6/5/3/3/2/2/1/1/1/0 | **26 / 26 / 23 / 19 / 14 / 0** | 25/23/25/21/13 |
| Modul-Paare (`moduleCrossings.pairs`, ungerichtet) | 79 | **10** | **10** ✔ |
| gerichtete Kanten zwischen Modulen | 106 | **18** | 19 ✔ |
| Querungen gesamt (Instanzen) | 492 | **407** | — |
| **Randverkehr über die Top-5-Verträge** | **91,1 %** | **93,1 %** | 93,8 % |
| Modulrand-Vokabular (verschiedene querende FLOWs) | 22 | **20** | — |
| Kohäsion gesamt (`moduleMetrics`, intern/(intern+extern)) | **9,7 %** | **17,2 %** | — |
| Module mit 0 internen Verbindungen | 3 (von 12 messbaren) | **0** (von 5) | **0** ✔ |
| CR-01-Befunde (distinct) | 79 | **10** | — |
| R-04-Befunde | 5 | **5** | — |
| MT-02-Befunde | 2 | **4** | — |
| Violations gesamt (error / warning / info) | 109 (1 / 35 / 73) | **44 (1 / 36 / 7)** | — |
| readiness `arch` | 0,970 | **0,994** | — |
| readiness `alloc` | 0,955 | **0,924** | — |
| `importCoverage` | 73/73, `unassigned: []` | **45/73, 28 unassigned** | — |
| Knoten / Kanten | 669 / 1807 | **658 / 1794** | — |

Der Randverkehr läuft danach über `graph-state` (207) · `query-request` (66) · `gate-verdict` (53)
· `mutate-cmd` (45) · `formatE-artifact` (8) — dieselben fünf Verträge wie nach Schritt 1.

**Kohäsion je Modul** (intern / extern / ratio):

| vorher | | nachher | |
|---|---|---|---|
| harness | 58/254 = 18,6 % | **kernel** | **107/302 = 26,2 %** |
| executor | 5/35 = 12,5 % | **loop** | **14/65 = 17,7 %** |
| skills | 21/176 = 10,7 % | **surface** | **21/153 = 12,1 %** |
| cli | 9/96 = 8,6 % | **projections** | **30/235 = 11,3 %** |
| steering | 7/89 = 7,3 % | **agent-surface** | **21/176 = 10,7 %** |
| mcp-tools | 7/120 = 5,5 % | dashboard | n/a (0 FUNC) |
| docs | 1/39 = 2,5 % | | |
| codec | 1/47 = 2,1 % | | |
| host-bridge | 1/60 = 1,6 % | | |
| hooks · metrics-engine · schema-migration | 0/39 · 0/45 · 0/26 = **0,0 %** | | |
| completeness · conformance · dashboard · element-slice · repo-root | n/a | | |

**Regelstrom-Bilanz** — 21 neu, 13 geschlossen, **alle neuen warning/info**, error bleibt bei 1
(dieselbe Vorlast, UC-02 `UC-loop-closure`):

| neu | | geschlossen | |
|---|---|---|---|
| R-04 ×5 | auf den fünf neuen Modulen | R-04 ×5 | cli · harness · mcp-tools · skills · steering |
| RD-04 ×5 | „N allozierte FUNC auf einer Ebene (>11)" auf allen fünf | RD-04 ×4 | harness · skills · steering · repo-root (16 Sub-MODs) |
| MT-02 ×4 | LCOM4 4/4/5/6 auf kernel/projections/loop/surface | MT-02 ×2 | host-bridge · steering |
| CR-01 ×4 | die vier neuen Paare | CR-01 ×73 | die alten Paare |
| RD-03 ×1 | `REQ-graph-is-ssot`: Kinder haben jetzt **dasselbe** satisfy-Ziel | | |
| CR-R03 ×2 | MS-9-generation · MOD-surface | CR-R03 ×2 | FUNC-graph-suggest · MOD-cli |

## `MOD.path` und `importCoverage` — die bewusst ausgewiesene Degradierung

Der Code liegt weiterhin in den **13 Verzeichnissen aus CR-GC-429 §4**; er wird erst im Folge-CR
nachgezogen. Es gibt heute kein `src/kernel`, `src/projections`, `src/loop`, `src/surface`.

**Entscheidung: kein Phantom-Pfad.** Vier der fünf neuen Module bekommen **kein `path`**.
`MOD-agent-surface` bekommt `path: .claude/commands` — der einzige Pfad, der heute schon wahr ist
und nach dem Code-Nachzug wahr bleibt (und der `importCoverage` nicht berührt, weil dort keine
TS-Import-Endpunkte liegen).

**Die Folge, ehrlich beziffert:** `importCoverage` fällt von **73/73 (`unassigned: []`)** auf
**45/73**. Die 28 Dateien sind genau die, die **keinen** `realRef` einer allozierten FUNC tragen und
deshalb bisher über das `MOD.path`-Präfix zugeordnet wurden. **Kein RC-05-Befund ist dadurch
entstanden oder verschwunden** (RC-05 = 0 vorher wie nachher) — was fehlt, ist die **Prüfbarkeit**:
für diese 28 Dateien kann RC-05 einen Cross-Module-Drift nicht mehr beurteilen. Das ist eine
**bekannte, temporäre Folge bis zum Code-Nachzug**, kein akzeptierter Endzustand.

**Der Folge-CR muss genau das tun** (Datei → Zielverzeichnis; die Liste ist die Abnahme):

| nach `src/kernel/` | nach `src/projections/` | nach `src/loop/` | nach `src/surface/` |
|---|---|---|---|
| `conformance/evaluation.ts` · `harness/export-pending-contract.ts` · `harness/lock-owner-contract.ts` · `hooks/hooks.ts` · `schema-migration/schema-fingerprint-contract.ts` | `conformance/testreport.ts` · `tools/metrics.ts` · `tools/test-selection.ts` · `tools/test-selection-audit.ts` · `tools/testreport.ts` · `views/graphcode.ts` · `views/helpers.ts` · `views/incose.ts` · `views/srs.ts` | `executor/model-answer-contract.ts` · `steering/se-plan.ts` · `steering/target-profile-contract.ts` | `cli/gve-session-contract.ts` · `cli/package-version.ts` · `cli/scaffold-templates.ts` · `tools/audit.ts` · `tools/authoring-example.ts` · `tools/read.ts` · `tools/write.ts` · `viewer/health.ts` · `viewer/help-content.ts` · `viewer/help.ts` · `viewer/panels.ts` |

Dazu die 70 `realRef`-gebundenen Dateien (die heute weiter auflösen, weil `realRef` vor `MOD.path`
greift) und danach `MOD.path` auf die vier neuen Verzeichnisse — **erst dann**, denn erst dann ist
der Pfad keine Behauptung. Abnahme des Folge-CRs: `importCoverage` wieder **73/73**, `unassigned: []`.

Nicht mechanisch ist dabei nur `src/steering/` und `src/tools/`: beide Verzeichnisse werden
**gespalten** (steering → projections + loop, tools → surface + projections + loop). Und
`src/viewer/host.ts` trägt mit `ownKuzu()` eine kernel-Funktion neben drei surface-Funktionen — der
eine echte Datei-Split des Nachzugs.

## Nachzug der modell-pinnenden Tests

Vorlast vor dem Umbau: **20 rote** (2 Publish-Pending + 18 contracts-10-Fixture-Kollateral), per
`git stash` gegengeprüft — dabei war `arch.optimization-dry-run.spike` **grün (2/2)**, ist also
keine Vorlast, sondern von diesem Umbau gebrochen.

| Datei | war gepinnt auf | jetzt |
|---|---|---|
| `tests/skill-authoring-gate.test.ts` | `allocate → MOD-skills` | `MOD-agent-surface` |
| `tests/skill-report-measured.test.ts` | `allocate → MOD-skills` | `MOD-agent-surface` |
| `tests/exporter.test.ts` | `MOD-docs.status` | `MOD-projections.status` |
| `tests/mcp.impact.test.ts` | `MOD-harness` (7 Stellen) | `MOD-kernel` |
| `tests/smoke.create-harness.test.ts` | `MOD-harness` | `MOD-kernel` |
| `tests/mcp.tests-operational.test.ts` | changeSet `[MOD-codec, MOD-harness]` | `[MOD-projections, MOD-kernel]` |
| `tests/hooks.inject-graph-slice.test.ts` | Ground-Truth-Scheibe CR-GC-114 mit `MOD-host-bridge` | `MOD-surface` |
| `tests/arch.optimization-dry-run.spike.test.ts` | **Lauf B zurückgebaut** | s. u. |

**Lauf B des CR-GC-436-Spikes ist zurückgebaut, nicht repariert.** Sein Subjekt — der 17-MOD-SSOT —
existiert nicht mehr: `MOD-harness`/`-docs`/`-skills`/`-hooks`/`-conformance`/`-element-slice`/
`-completeness`/`-host-bridge` sind weg, die sieben FLOW-Quellen hat CR-GC-445 bereits
zusammengelegt, und sein Ziel-Modulname `MOD-agent-surface` kollidiert jetzt mit einem echten Modul.
Ein zweiter, **simulierter** Schnitt neben dem echten wäre genau der parallele Pfad, den CLAUDE.md
verbietet — und die Zahl, die er liefern sollte (Obergrenze des Umhängens), ist durch diesen CR am
produktiven Modell abgelöst: 9,7 % → 17,2 % statt der simulierten 17,2 % → 19,6 %.
**Lauf A (Reichweite des Autopiloten) bleibt** — er misst den Vorschlagspfad, nicht eine Partition.

**Endstand: 983 passed / 20 failed** (1003 statt 1004 Tests — Lauf B ist zurückgebaut) — exakt die
dokumentierte Vorlast, Datei für Datei
(`distribution`, `lockfile-sync` = Publish-Pending; `config` ×3, `metrics` ×5, `claims.conformance`
×2, `generate` ×2, `executor.bestofn` ×1, `steering.architecture-causality` ×3,
`steering.divergence-two-profiles` ×1, `suggest.ranks-the-delivered-edit` ×1 =
contracts-10-Fixture-Kollateral). **Keine neue Rote.**

## Befunde

1. **Die Partition liefert, was die Verträge nicht mehr konnten.** Schritt 1 hat den Randverkehr
   auf 91,1 % konzentriert, aber die **Kohäsion** nur von 7,1 % auf 9,7 % bewegt und drei Module bei
   0 stehen lassen. Schritt 2 hebt die Kohäsion auf **17,2 %** und die Nullen auf **0**, während der
   Randverkehr nur noch von 91,1 % auf 93,1 % steigt. **Die Konzentration kam aus den Kanten, die
   Kohäsion kommt aus der Partition** — die beiden Halbsätze des Zielbilds messen verschiedene
   Dinge, und beide waren nötig.
2. **Die Hub-Inflations-Warnung aus CR-GC-445 ist bestätigt und dreht sich hier um.** Dort stiegen
   die Modul-Paare durch ehrliche Bündelung von 47 auf 79 und CR-01 mit ihnen; hier fallen sie auf
   **10** und CR-01 auf **10**. Beide Bewegungen sind wahr und keine ist ein Erfolgsmaß: die
   Paarzahl misst, wie fein die Partition ist, nicht wie gut. Das Urteil steht auf **Kohäsion**
   (9,7 % → 17,2 %) und **Randverkehr** (91,1 % → 93,1 %).
3. **Der Schnitt kauft Kohäsion mit Modulgröße.** R-04 feuert nach dem Umbau auf **allen fünf**
   Modulen statt auf fünf von siebzehn, RD-04 auf allen fünf, MT-02 auf vier. Das ist kein
   Regressionsbefund, sondern der Preis: fünf Module à 14–26 FUNC reißen jede Größenschwelle, die
   siebzehn Module à 1–26 FUNC nur teilweise rissen. **Netto Arch-Befunde: 14 neu / 11 zu = +3.**
   Wer die Schwellen ernst nimmt, braucht eine **zweite Ebene** (Sub-MODs) — nicht mehr Module.
4. **`external` ist heute keine belastbare Modulgrenze.** `MOD-dashboard` (`external: true`,
   0 FUNC) musste stehenbleiben, `MOD-metrics-engine` (3 FUNC in Schwesterpaketen, **nicht**
   `external` markiert) konnte aufgelöst werden — obwohl beide dasselbe sagen wollen: „hier endet
   dieses Repo". Nach der Auflösung reist diese Information nur noch am `realRef`. Kandidat für
   contracts: eine Modulgrenze, die „fremdes Paket" trägt, statt es der Realisierung zu überlassen
   (deckt sich mit dem Merk-Eintrag „external = Realisierung, nicht Struktur").
5. **`RD-03` ist ein echter neuer Befund, kein Kollateral.** `REQ-graph-is-ssot` hatte Kinder, die
   von **verschiedenen** Modulen erfüllt wurden; nach dem Schnitt erfüllt sie **ein** Modul. Die
   Regel sagt zu Recht: dann war die Zerlegung des REQ vielleicht überflüssig. Modellpflege,
   eigener CR-Kandidat.
6. **Roher `harness.mutate()` bricht den eigenen Export.** Der erste Anlauf lief über
   `harness.mutate()` und `graph_export` verweigerte danach mit „would delete 16 element(s) +
   242 trace(s) … likely a stale process": die Export-nach-eigener-Mutation-Ausnahme (CR-GC-296)
   liest die **Provenienz aus dem Audit-Log**, und das schreibt `recordAudit` im **Tool-Layer**,
   nicht im Harness. Derselbe Fallstrick wie bei `trajectory.jsonl` (CR-GC-252). **Jedes Skript,
   das exportieren will, muss über `tools.graph_mutate` fahren.**
7. **Der `graphVersion`-Stempel fällt erneut zurück** (Temp-Store, CR-GC-445 Punkt 5, unverändert):
   der Stempel ist Snapshot-Metadatik, keine Quelle liest ihn, der Repo-Host setzt seinen Zähler
   aus `.graphcode/audit.jsonl` fort. Bleibt offen.

## Nachzuziehen (nicht in diesem CR erledigt)

1. **Der Code-Nachzug** — die Verzeichnis-Abbildung des 5er-Schnitts inkl. `MOD.path` und der
   Rückkehr auf `importCoverage` 73/73. Die Dateiliste oben ist die Vorlage; sie überschreitet die
   6-Dateien-Regel deutlich und ist in Zielverzeichnis-CRs zu schneiden (vier bis fünf CRs).
2. **`src/viewer/host.ts` splitten** — `ownKuzu()` gehört nach kernel, die drei anderen bleiben
   surface. Der eine echte Verantwortungs-Split des Nachzugs.
3. **Zweite Modulebene** gegen R-04/RD-04/MT-02 auf allen fünf Modulen (Befund 3) — oder die
   Schwellen in `graphcode.config.jsonc` bewusst auf die neue Modulgröße stellen. Eine Entscheidung,
   kein Fix.
4. **`RD-03` auf `REQ-graph-is-ssot`** (Befund 5) — Zerlegung prüfen.
5. **contracts: Modulgrenze „fremdes Paket"** (Befund 4).
6. **Die drei `scripts/spike-arch-*.mjs`** (CR-GC-436/445-Beweisstücke) referenzieren die alten
   MOD-/FLOW-IDs und laufen gegen den heutigen SSOT ins Leere. Sie sind datierte Nachweise
   geschlossener Spikes, keine Werkzeuge — als solche stehengelassen, aber sie sind nicht mehr
   ausführbar. Entweder archivieren oder löschen.
7. **PID 6226 bootet weiterhin contracts 9.x.** Der Host wurde per `graph_reseed` auf den neuen
   SSOT gebracht (658/1794), sein **Regelkatalog** bleibt aber vom Boot. Wer die Zahlen dieses CRs
   über den Live-Host nachrechnet, bekommt andere (u. a. CR-01 = 0). Neu starten.

## Akzeptanzkriterien

- [x] Jede der 108 FUNC nach ihrer **Rolle** zugeordnet; die sechs strittigen Fälle einzeln
      begründet, die drei Zahlabweichungen benannt statt weggeschoben.
- [x] Alles durch das Apply-Gate (`graph_mutate`, Tool-Layer), kein Hand-Edit des SSOT, kein
      fremder MCP-Host; Host danach reseedet.
- [x] Umhängen als `[delete-edge, add-edge]` in EINEM Batch (Kardinalität `0..1`).
- [x] Alle Kanten der 16 aufgelösten MODs einzeln entschieden; **0 verwaiste Kanten, 0 MOD ohne
      Eltern-compose, 0 Karteileichen** (aus dem Store zurückgelesen).
- [x] 0 neue error-Violations in jedem Batch; kein Batch zurückgenommen.
- [x] SSOT + Views über `graph_export` + `scripts/export-graph.mjs` (Round-Trip-Wache grün).
- [x] Messtabelle vorher/nachher in EINER Tabelle, gegen contracts 10.0.0.
- [x] `MOD.path`/`importCoverage`-Degradierung explizit ausgewiesen, mit der Dateiliste als
      Arbeitsauftrag für den Code-Nachzug — kein Phantom-Pfad gesetzt.
- [x] Volle Suite: **983 passed / 20 failed** = exakt die Vorlast (Stash-Gegenprobe), keine neue
      Rote; die acht modell-pinnenden Tests nachgezogen.
