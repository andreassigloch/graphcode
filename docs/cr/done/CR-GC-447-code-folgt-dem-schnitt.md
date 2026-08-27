# CR-GC-447 — Der Code folgt dem Schnitt (Schritt 3, letzter der Zielbild-Kette)

**Status:** **ABGESCHLOSSEN** (2026-08-27) · **Angelegt:** 2026-08-27 · **Typ:** Code-Nachzug (Verzeichnisse) + Modell-Nachzug
(`realRef` / `MOD.path`)
**Ausgangs-Commit:** `f4cb67b` (CR-GC-446, SSOT 658 Knoten / 1794 Kanten, sauberer Arbeitsbaum bis
auf untracked `_a.html`).

**Herkunft:**
- **Schritt 1** = [CR-GC-445](../done/CR-GC-445-vertragskonsolidierung.md) (die Kanten),
  **Schritt 2** = [CR-GC-446](../done/CR-GC-446-fuenfer-modulschnitt.md) (die Partition am Modell).
  Dieser CR ist der dritte: **die Platte stimmt dem Modell zu.**
- **Arbeitsliste:** CR-GC-446 §„`MOD.path` und `importCoverage`" — die 28 Dateien ohne `realRef`
  nach Zielverzeichnis plus die realRef-gebundenen. **Abnahme dort definiert:** `importCoverage`
  wieder `unassigned: []`.
- **Muster:** [CR-GC-429](../done/CR-GC-429-contracts-nachzug-grammatik-und-abdeckung.md) §4 —
  `git mv` + automatischer Spezifizierer-Nachzug + `realRef`/`MOD.path` übers Gate.

## Was gemacht wurde

**73 Dateien per `git mv`** aus 13 Modulverzeichnissen in vier: `src/kernel/` (14) ·
`src/projections/` (20) · `src/loop/` (12) · `src/surface/` (27). **447 Import-Spezifizierer in
156 Dateien** automatisch nachgezogen (Auflösung am ALTEN Ort, Neuberechnung am NEUEN — dieselbe
Mechanik wie CR-GC-429 §4). Die Entry-Points `src/index.ts` und `src/cli.ts` bleiben in der Wurzel;
sie hängen an `realRef`, nicht am Pfad. `MOD-agent-surface` (`.claude/commands`) lag schon richtig.

`packageRootDir()` (CR-GC-429 §4, Aufwärtssuche nach der nächsten `package.json`) hat den Umzug
ohne Änderung überstanden — genau der Zweck, für den es die fest verdrahtete Ebenenzahl abgelöst
hat. Keine zweite Paketwurzel-Auflösung im Baum.

### Wohin — je Verzeichnis, nach Rolle

| alt | neu | Grund |
|---|---|---|
| `harness/` (8), `conformance/conformance.ts` + `evaluation.ts`, `element-slice/`, `schema-migration/` (2), `hooks/hooks.ts` | **`kernel/`** | Store ∘ Gate ∘ Regeln ∘ OpLog. `hooks.ts` folgt CR-GC-446: die Extension-Points hängen am Gate (ein pre-commit-Hook kann eine Mutation blocken). |
| `codec/`, `views/` (5), `completeness/`, `conformance/testreport.ts`, `steering/{fit-advisory,nd-similarity,readiness,steering-snapshot}`, `tools/{export,report,metrics,test-selection,test-selection-audit,testreport,se-author-uc}` | **`projections/`** | Graph → X, ohne Zug und ohne Transport. |
| `executor/` (6), `steering/{generate,steering,se-plan,target-profile,target-profile-contract}`, `tools/suggest.ts` | **`loop/`** | Autopilot + Executor. |
| `cli/` (13), `viewer/` (6), `tools/{mcp-server,mcp-tools,tool-context,audit,authoring-example,read,write}`, `hooks/emit.ts` | **`surface/`** | Adapter: MCP-Verben, CLI, Host-Socket, SSE. |

### Die nicht-mechanischen Fälle — je Datei entschieden

**1. `src/steering/` gespalten (9 Dateien → 4 projections / 5 loop).** Die Trennlinie ist die
FUNC-Zuordnung aus CR-GC-446, nicht das Verzeichnis: `fit-advisory` · `nd-similarity` · `readiness`
· `steering-snapshot` **rechnen** eine Zahl aus dem Graphen (projections); `generate` · `steering`
(`next-step`) · `target-profile` (+ sein Contract) · `se-plan` **schlagen einen Zug vor** oder lesen
die Loop-Konfiguration (loop). `se-plan.ts` trägt keinen `realRef` und folgt seinem Nachbarn
`generate.ts` — es ist der Plan-Treiber des Autopiloten.

**2. `src/tools/` gespalten (14 Dateien → 7 surface / 6 projections / 1 loop).** Je Datei gegen den
Graphen geprüft: `mcp-server`/`mcp-tools`/`tool-context` tragen `FUNC-serve-stdio`/`-bind-tools`/
`-tool-context` (alle surface), `export`/`report` tragen `FUNC-graph-export-snapshot`/`-deduce-tests`
(projections), `suggest` trägt `FUNC-graph-suggest` (loop — CR-GC-446 hat den Fall einzeln
begründet). Die sechs ohne `realRef` folgen der CR-GC-446-Liste: `audit`/`authoring-example`/`read`/
`write` sind MCP-Verben (surface), `metrics`/`test-selection`/`test-selection-audit`/`testreport`
sind Rechnung bzw. Report (projections).

**3. `src/viewer/host.ts` aufgeteilt, nicht verschoben.** `FUNC-own-kuzu-host` („der Host-Prozess ist
der einzige Kuzu-Owner pro Repo") ist seit CR-GC-446 kernel, die drei anderen FUNCs der Datei
(`serve-sse` · `broadcast-diff` · `health-endpoint`) sind surface. **Befund beim Umsetzen:** eine
Funktion `ownKuzu()` gab es nicht — `FUNC-own-kuzu-host` und `FUNC-serve-sse` zeigten auf
**dasselbe** Symbol `serveHost`. Der Split war also erst herzustellen: die OWN/ATTACH-Entscheidung
(„öffne genau EINEN Store — oder übernimm den bereits gewählten") ist als `ownKuzu()` nach
`src/kernel/own-kuzu.ts` gewandert; `surface/host.ts` ruft sie und behält Server, Routing, SSE,
Health. Bewusst **ohne** Transport-Wissen im kernel: der `scope` kommt fertig herein (die
Member-Ableitung bleibt Sache der Oberfläche), sonst hätte der kernel `mcp-server.ts` importiert und
der Split wäre eine Umbenennung geblieben.

**4. `src/hooks/emit.ts` ebenfalls aufgeteilt — ein vierter Fall, den CR-GC-446 §5 nicht als solchen
gelistet hatte.** Die Datei trug `FUNC-emit-update-event` (surface) **und** `FUNC-emit-trajectory`
(projections); CR-GC-446 hat die beiden ausdrücklich getrennt alloziert („das Modul `hooks` war eine
Ablage, keine Rolle"), die Datei aber blieb eine. Sie erschien nicht in der 28er-Liste, weil die nur
Dateien **ohne** `realRef` aufzählt. Getrennt: `surface/emit.ts` (Live-Update-Event, ResponseCache,
`registerEmitters`) und `projections/trajectory.ts` (Stamps + `materializeTrajectory`, die reine
Projektion des Operations-Logs). Kein gemeinsamer Zustand — der Schnitt ging ohne Rest auf.

### Modell-Nachzug — Reihenfolge zwingend

Zwei Batches durch das **Apply-Gate über den Tool-Layer** (`tools.graph_mutate`, nie
`harness.mutate()` roh — CR-GC-446 Befund 6: ohne `recordAudit`-Provenienz verweigert `graph_export`
die eigene Änderung als Fremd-Clobber). Verdrahtung wie CR-GC-445/446: **echter `repoRoot`**
(sonst lösen `realRef`/`testRefs` nicht auf und `importCoverage` misst Unsinn) + **Disk-Kuzu im
Temp** + `lockDir` = Temp. **Kein fremder MCP-Host benutzt** (PID 6226 bootet contracts 9.x).

1. **76 `update-node`** — `realRef.file` aller gebundenen Elemente (FUNC + SCHEMA), inklusive der
   zwei Split-Fälle mit **neuem Symbol**: `FUNC-own-kuzu-host` → `src/kernel/own-kuzu.ts#ownKuzu`,
   `FUNC-emit-trajectory` → `src/projections/trajectory.ts#materializeTrajectory`.
2. **4 `update-node`** — `MOD.path` auf `src/kernel` · `src/projections` · `src/loop` ·
   `src/surface`. **Erst danach**, denn erst danach ist der Pfad keine Behauptung; CR-GC-446 hatte
   sie deshalb bewusst leer gelassen (kein Phantom-Pfad).

Beide Batches `success: true`, `tier: auto-apply`, `violations: []`. **error-Violations 1 → 1** —
dieselbe Vorlast (UC-02 `UC-loop-closure`), keine neue.

## Messung

| Kennzahl | vorher (CR-GC-446) | nachher |
|---|---|---|
| `importCoverage` | **45/73**, 28 unassigned | **75/75, `unassigned: []`** |
| RC-05 (Cross-Module-Drift) | 0 | **0** |
| RC-Befunde gesamt | 2 (RC-04 warning ×2) | **2 (RC-04 warning ×2)** — unverändert |
| error-Violations | 1 | **1** |
| Knoten / Kanten | 658 / 1794 | **658 / 1794** |
| `src/`-Verzeichnisse | 13 | **4** |

`75/75` statt der geforderten `73/73`: die Endpunktzahl ist gestiegen, weil die zwei
**Datei-Splits** zwei neue Dateien in den Import-Graphen gebracht haben (`kernel/own-kuzu.ts`,
`projections/trajectory.ts`). Isoliert bleiben — wie vorher — genau zwei Quelldateien, die niemand
importiert und die nichts relativ importieren (`projections/se-author-uc.ts`,
`projections/readiness-completeness.ts`); sie sind deshalb keine Endpunkte und waren es auch vor dem
Umbau nicht.

## Was sonst dem Schnitt folgen musste

- **`package.json` `exports`** — `./harness` zeigte auf `./dist/harness.js`, `./mcp` auf
  `./dist/mcp-tools.js`. **Beide waren seit CR-GC-429 §4 tot** (die Dateien liegen seither in
  Unterverzeichnissen); der Fehler ist hier aufgefallen, weil die Pfade ein zweites Mal wanderten.
  Jetzt `./dist/kernel/harness.js` bzw. `./dist/surface/mcp-tools.js`. Der Tarball-Test prüft den
  Subpath-Import — er ist bis zum nächsten Publish aus einem anderen Grund rot (s. Testnachweis).
- **`src/README.md`** — die Verzeichnistabelle auf die vier Module, plus die Herkunftstabelle
  „welches alte Verzeichnis wurde was" und die beiden Datei-Splits.
- **`scripts/test-selection-audit.mjs`** (`dist/tools/…` → `dist/projections/…`) und der
  Pfadkommentar in `scripts/export-graph.mjs`. Alle übrigen `scripts/*.mjs` gehen über
  `dist/index.js` und blieben unberührt.
- **`.claude/commands/se/author-uc.md`** — verwies noch auf `src/se-author-uc.ts` (Pfad von **vor**
  CR-GC-429 §4).

## Die drei `scripts/spike-arch-*.mjs` — gelöscht, nicht archiviert

`spike-arch-handschnitt.mjs` · `spike-arch-regelkreis.mjs` · `spike-arch-top-views.mjs` (CR-GC-436)
sind **gelöscht**. Begründung:

1. **Ihr Subjekt existiert nicht mehr.** Sie rechnen über die alten MOD-IDs (`MOD-harness`,
   `-docs`, `-skills`, `-hooks`, `-host-bridge` …) und die sieben FLOW-Quellen, die CR-GC-445
   zusammengelegt und CR-GC-446 gelöscht hat. Gegen den heutigen SSOT liefern sie leere Mengen —
   sie „laufen", ohne etwas zu messen, und das ist schlimmer als ein Fehler.
2. **Sie waren zusätzlich am Verzeichnis gebrochen** (`../dist/conformance/conformance.js`), also
   ohnehin in diesem CR anzufassen.
3. **Der Nachweis liegt nicht in ihnen.** Die Ergebnisse stehen in den geschlossenen CRs
   (CR-GC-436 + Nachtrag 2, CR-GC-445, CR-GC-446); die Zahl, die Lauf B liefern sollte, ist durch
   CR-GC-446 am produktiven Modell abgelöst. Die Skripte sind Werkzeug, kein Beweisstück — und ein
   Werkzeug, das nicht mehr arbeitet, ist zu löschen, nicht auszukommentieren (CLAUDE.md).
4. Die Git-Historie hält sie fest (`git show 38fb8cf:scripts/spike-arch-handschnitt.mjs`); der
   inhaltliche Auszug der beiden Partitionen lebt in `scripts/spike-archetype-eigenvector.mjs`
   weiter, dessen Kommentare hier auf die CRs statt auf die gelöschten Dateien zeigen.

`tests/arch.optimization-dry-run.spike.test.ts` (Lauf A, von CR-GC-446 behalten) verweist nicht mehr
auf die Dateinamen, sondern auf den CR.

## Testnachweis

**Vorlast (CR-GC-446, Stash-gegengeprüft): 20 rote** = 2 Publish-Pending (`distribution`-Tarball,
`lockfile-sync`) + 18 contracts-10-Fixture-Kollateral (`config` ×3, `metrics` ×5,
`claims.conformance` ×2, `generate` ×2, `executor.bestofn` ×1, `steering.architecture-causality` ×3,
`steering.divergence-two-profiles` ×1, `suggest.ranks-the-delivered-edit` ×1).

**Erster Lauf nach dem Umbau: 979 passed / 24 failed** — **vier** davon durch diesen Umbau echt
gebrochen, alle vier pfad-pinnend, alle vier nachgezogen:

| Datei | pinnte | jetzt |
|---|---|---|
| `tests/views.no-fork.test.ts` | `join(SRC, 'harness', 'harness.ts')` | `join(SRC, 'kernel', …)` |
| `tests/auto-export.shutdown-flush.test.ts` (2 Fälle) | `src/tools/mcp-server.ts` | `src/surface/mcp-server.ts` |
| `tests/distribution.test.ts` | `dist/tools/mcp-server.js` | `dist/surface/mcp-server.js` |

Vorab (vor dem ersten Lauf) bereits nachgezogen, weil sie Pfade als **Zeichenkette** pinnen:
`tests/views.conformance.test.ts` (`src/views/*` → `src/projections/*`),
`tests/hooks.inject-graph-slice.test.ts` (Ground-Truth-`realRef` `src/tools/read.ts` →
`src/surface/read.ts`), `tests/conformance.test.ts` (`src/harness/harness.ts` → `src/kernel/…`),
`tests/intent-anchors-internal.test.ts` (`src/steering/generate.ts`, `src/tools/report.ts`),
`tests/trajectory-stamps.test.ts` (Import des `TrajectoryStamps`-Typs auf
`src/projections/trajectory.js`).

**Endstand: 983 passed / 20 failed** (1003 Tests) — **exakt die Vorlast**, Datei für Datei
(`distribution` 1 · `lockfile-sync` 1 · `config` 3 · `metrics` 5 · `claims.conformance` 2 ·
`generate` 2 · `executor.bestofn` 1 · `steering.architecture-causality` 3 ·
`steering.divergence-two-profiles` 1 · `suggest.ranks-the-delivered-edit` 1). **Keine neue Rote.**
`npm run build` grün.

## Akzeptanzkriterien

- [x] Reihenfolge eingehalten: Dateien + Importe → `realRef` übers Gate → **danach** `MOD.path`.
- [x] `importCoverage` `unassigned: []`.
- [x] Keine neuen error-Violations; beide Batches über `tools.graph_mutate`, kein fremder Host.
- [x] `npm run build` grün, volle Suite ohne neue Rote gegenüber der Vorlast.
- [x] Views neu exportiert (`graph_export` + `scripts/export-graph.mjs`, Round-Trip-Wache grün).
- [x] Die drei `spike-arch-*.mjs` aufgelöst und die Entscheidung begründet.

## Befunde

1. **Ein `realRef` auf ein Symbol, das es nicht gibt, fällt erst beim Umzug auf.**
   `FUNC-own-kuzu-host` und `FUNC-serve-sse` zeigten **beide** auf `serveHost` — das Modell behauptete
   eine Trennung, die der Code nie hatte, und RC-01/RC-02 konnten sie nicht bemerken, weil Datei und
   Symbol ja existierten. Sichtbar wurde es erst, als die Rolle ein eigenes Verzeichnis verlangte.
   Kandidat für eine Regel: **zwei FUNC verschiedener MODs auf demselben `realRef`-Symbol** ist ein
   Widerspruch, den heute niemand prüft. (`emit.ts` war derselbe Fall, nur mit zwei Symbolen — und
   deshalb reparabel, ohne Code zu schreiben.)
2. **Die 28er-Liste aus CR-GC-446 war notwendig, aber nicht hinreichend.** Sie zählt die Dateien
   ohne `realRef`; die Dateien MIT `realRef`, deren FUNCs in **verschiedene** Module gingen, standen
   nicht darin (`hooks/emit.ts`). Wer aus `importCoverage` eine Arbeitsliste ableitet, bekommt die
   nicht zugeordneten Dateien — nicht die widersprüchlich zugeordneten.
3. **Zwei tote `exports`-Subpaths lagen seit CR-GC-429 §4 unbemerkt im Manifest** (`./harness`,
   `./mcp`). Kein Test greift sie im Dev-Baum, und der eine, der es täte — der Tarball-Test — ist
   seit dem Publish-Stau rot. Ein roter Test verdeckt, was er prüfen sollte.
4. **`importCoverage` steigt beim Splitten von Dateien, ohne dass sich die Abdeckung verbessert**
   (73 → 75 Endpunkte). Die Zahl ist ein Verhältnis über den Import-Graphen, kein Bestand — sie ist
   nur gegen `unassigned: []` zu lesen, nie als Absolutwert im Zeitvergleich.
5. **Der 5er-Schnitt ist auf der Platte nicht gleich verteilt:** 27 / 20 / 14 / 12 Dateien. Das
   spiegelt CR-GC-446 Befund 3 (der Schnitt kauft Kohäsion mit Modulgröße) auf Dateiebene — die
   R-04/RD-04/MT-02-Befunde auf allen fünf Modulen bleiben unverändert offen und sind dort als
   Nachzugspunkt 3 („zweite Modulebene oder bewusst angepasste Schwellen") notiert.

## Nachzuziehen (nicht in diesem CR erledigt)

1. **Regel „ein `realRef`-Symbol, zwei Module"** (Befund 1) — contracts-Kandidat, RC-Familie.
2. **CR-GC-446 Nachzugspunkte 3–5 bleiben offen:** zweite Modulebene gegen R-04/RD-04/MT-02,
   `RD-03` auf `REQ-graph-is-ssot`, contracts-Modulgrenze „fremdes Paket".
3. **Publish-Stau** (`@sigloch/se-engine@1.4.0` / `graph-api-core@5.4.0` unpubliziert) hält
   `distribution` + `lockfile-sync` rot — und damit die einzige Prüfung der `exports`-Subpaths.
4. **PID 6226 bootet weiterhin contracts 9.x.** Per `graph_reseed` auf den neuen SSOT gebracht
   (658/1794), damit er nichts zurückschreibt; sein Regelkatalog bleibt vom Boot. Neu starten.
