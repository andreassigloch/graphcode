# CR-GC-409 — Restliche Warnings: was Code, Architektur oder eine Entscheidung braucht

**Status:** draft — Bestandsaufnahme nach dem Modell-Abbau vom 2026-08-25 (graphVersion 193).
**Herkunft:** Warnings-Abbau-Session. Ausgangslage 106 Violations, nach den reinen
Modell-Fixes (satisfy/compose/io-Kanten, 2 neue REQ, 1 neuer FLOW, AF-Stamps) **52**.
Geschlossen: R-02 14→0, R-30 8→1, R-31 26→13, RD-01 2→1, MS-03 1→0, RC-05 11→5
(Nebeneffekt: dokumentierte io-Kanten decken reale Modulimporte), MT-02 5→3.

Dieser CR ist der Plan für die 52 verbleibenden — nichts davon ist mit einer
weiteren Kante ehrlich schließbar. Gruppen nach Fix-Art, jede Gruppe einzeln
CR-fähig (≤6 Dateien).

## A · Braucht neue FLOW+SCHEMA-Verträge (Modell + je 1 Zod-Symbol im Code)

> **Stand 2026-08-25 (graphVersion 201): abgearbeitet.** CR-GC-412 (Test-Selektion),
> 414 (Health), 415 (Repo-Lebenszyklus-Abnahme + cli-dispatch + claim-store-lock),
> 416 (Session-Registry), 417 (Werkzeugkontext), 418 (Urteils-Policy),
> 419 (Zielprofil), 421 (Schema-Migration).
> **R-31 13 → 3, IO-01 1 → 0, R-30 1 → 0.** Kein neues R-21.
> Offen bleiben `bind-tools`, `export-marker`, `extract-mutate` — je ein Befund
> ohne ehrlichen FLOW, festgehalten in **CR-GC-422**.

R-31 ×13, IO-01 ×1, R-30 ×1. Die restlichen unverdrahteten FUNCs haben keinen
existierenden FLOW, an den sie ehrlich anschließen; jeder neue FLOW braucht sein
SCHEMA (sonst tauscht man R-31 gegen SC-04).

| Paket | FUNCs | fehlender Vertrag |
|---|---|---|
| Test-Selektion | deduce-tests, resolve-tests-from-code | FLOW-test-selection + SCHEMA (Zod in src/test-selection.ts) |
| Health | health-endpoint | FLOW-health + SCHEMA (Health-Objekt in src/viewer/host.ts) |
| Session-Registry | gve-supervise, gve-sessions | FLOW-session-registry + SCHEMA (src/gve-sessions.ts) |
| Policy/Profil | load-config, target-profile-load | FLOW-policy + SCHEMA (MetricPolicy aus contracts, TargetProfile) |
| Registry/Kontext | bind-tools, tool-context | FLOW-tool-binding (oder Entscheidung: Infrastruktur-FUNCs ohne io akzeptieren) |
| Einzelfälle | schema-guard (out), export-marker (Drift-Marker-FLOW), extract-mutate (Modell-Antwort-FLOW), cli-dispatch (out) | je 1 FLOW |
| Kette | migrate-schema (R-30: FCHAIN-Zuordnung + Verdrahtung), session-shutdown (IO-01: claim-store-lock in FCHAIN-repo-lifecycle aufnehmen) | — |

Achtung cli-dispatch: sein Output-Anschluss an FLOW-cli-command erzeugt 5 neue
R-21 (Integrationstest-Pflicht der entstehenden Kettenpaare) — gemessen im dryRun
2026-08-25. Erst FCHAIN-repo-lifecycle einen satisfy-REQ mit Integrations-TEST
geben, dann verdrahten. Gleiches Muster bei claim-store-lock/session-shutdown.

## B · Braucht Code: RC-04 ×6 — Schema am Interface nicht geparst

FitAdvisory, GenerationStep, LockOwner, PhaseGateReadiness, SteeringDelta,
SteeringSnapshot: je ein `.parse()`/`.safeParse()` am modellierten Interface
(Producer- oder Consumer-Seite) + Assertion im zugehörigen Test. `external`
markieren wäre falsch — es sind graphcode-eigene Schemas.

## C · Braucht Code oder MOD-Zuordnung: RC-05 ×5 + 13 unassigned files

Restliche undokumentierte Modulimporte (docs↔harness, cli→docs, harness→docs/
element-slice/schema-migration, mcp-tools→codec/conformance/steering) und die 13
keiner MOD zugeordneten Dateien (u.a. merge.ts, hooks.ts, testreport.ts,
viewer/help*.ts). Je Befund: io/FLOW-Dokumentation der echten Abhängigkeit ODER
Import auflösen; für die 13 Dateien FUNC/MOD-Zuordnung nachziehen.

## D · Architektur-Schnitt (eigene CRs, erst messen): R-04 ×5, RD-04 ×5, MT-02 ×3

- MOD-skills: 25 FUNCs/59 crossings + >11-Kinder — Split in Autoren-/Lese-/View-Skills liegt nahe.
- MOD-harness: 14/34 + LCOM4=4 — Kandidat: Store-Lifecycle (open/close/load/seed) ist schon als Speicherwerk-Block geschnitten.
- FUNC-block-anschluss: 15 Kinder → Zwischenebene; MOD-repo-root: 12 sub-MODs.
- graph_metrics liefert Ranking + Policy; Urteil nur mit Zieldiskussion, nicht mechanisch.

## E · Entscheidungen (kein Code, aber nicht meine)

1. **SC-04 ×2** (FLOW-round-scope/-round-injection): beide erklären ausdrücklich
   "kein Code-Datenvertrag". Entweder concept-SCHEMA nach dem Vorbild
   SCHEMA-measurement-vector ODER contracts-Ausnahme für concept-FLOWs (Familie-Review).
2. **R-23 ×1** (MOD-dashboard, external ohne FUNC): bewusste CR-GC-401-Modellierung
   kollidiert mit R-23. Contracts-Frage: R-23 überspringt external-MODs? —
   CR-SM-257-Kontext (external exemptiert nur Realisierung) beachten.
3. **RD-01 ×1** (REQ-published-counts-match-code): kein FUNC realisiert die
   Eigenschaft, der Test erzwingt sie beim Menschen. satisfy von SYS wäre formal
   erlaubt, sachlich leer. Offen lassen oder Doku-Counts generieren (dann FUNC-export-markdown).
4. **AF-02/AF-04**: bleiben offen bis se-fmea/se-trade real laufen (Entscheidung 2026-08-25).

## F · Löst sich von selbst

- **UC-03/UC-05/UC-06/FC-02 ×4** (UC-loop-closure): FCHAIN + pre/post entstehen
  mit der Implementierung von CR-GC-346 (Regel-Kalibrierung) — vorher wäre jede Kette erfunden.
- **CR-R03 ×3**: verschwindet mit dem Schließen der offenen CRs an MS-8 (251/254/261)
  und MS-9 (283/294/297).
