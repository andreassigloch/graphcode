# CR-GC-397 — Der Restcluster, und was er wirklich kostet

**Status:** done 2026-08-22 · **Angelegt:** 2026-08-22 · **Basis:** graphVersion 179 → **181**
**Umsetzung:** dieses Repo (reine Modellarbeit durchs Gate, kein Code)
**Herkunft:** dritter und letzter Cluster aus CR-GC-393

## Zur CR-Größe

Die 6-Dateien-Regel ist eine **Code**-Regel; ihr Grund ist Kontext-Zuverlässigkeit beim Ändern von
Quelltext. Ein reiner Modell-CR hat ein anderes Budget: nicht Dateien, sondern **verifizierbare
Entscheidungen**. Jede Mutation wird einzeln vom Gate geprüft, jedes Symbol vor dem Schreiben im
Code nachgesehen. Dieser CR trägt deshalb 12 Knoten und 22 Kanten in zwei Batches.

## Änderung — 12 FUNC, jedes Symbol im Code verifiziert

| FUNC | Datei · Symbol | MOD |
|---|---|---|
| `FUNC-load-config` | `config.ts` · `loadGraphcodeConfig` | `MOD-harness` |
| `FUNC-export-marker` | `export-marker.ts` · `setExportPending` | `MOD-harness` |
| `FUNC-apply-reseed` | `harness-import.ts` · `applyReseed` | `MOD-harness` |
| `FUNC-create-harness` | `index.ts` · `createHarness` | `MOD-harness` |
| `FUNC-bind-tools` | `mcp-tools.ts` · `bindToolsToHarness` | `MOD-mcp-tools` |
| `FUNC-tool-context` | `tool-context.ts` · `createToolContext` | `MOD-mcp-tools` |
| `FUNC-host-socket` | `host-shim.ts` · `startHostSocket` | `MOD-host-bridge` |
| `FUNC-auto-export` | `auto-export.ts` · `registerAutoExport` | `MOD-docs` |
| `FUNC-preflight` | `preflight.ts` · `preflightBatch` | `MOD-executor` |
| `FUNC-target-profile-load` | `target-profile.ts` · `loadTargetProfile` | `MOD-steering` |
| `FUNC-schema-guard` | `schema-guard.ts` · `schemaFingerprint` | `MOD-schema-migration` |
| `FUNC-collect-status` | `status.ts` · `collectStatus` | `MOD-cli` |

Acht davon hängen in einer bestehenden Wirkkette, wo der Aufruf es belegt: Preflight und Zielprofil
in der Steuerungsschleife, Auto-Export und Export-Marke in der Snapshot-Freshness, Reseed und
Schema-Wächter in der Wiederherstellung, Harness-Fabrik im Apply-Gate, Status im Repo-Lebenszyklus.
`MOD-schema-migration` war bis hierher ein Konzeptmodul ohne eine einzige Funktion — es ist jetzt
realisiert.

Genau **eine** satisfy-Kante: `FUNC-load-config` erfüllt `REQ-thresholds-from-config`. Das ist der
einzige Knoten dieses Clusters, der eine offene Regel schließt.

## Was das kostet — Findings 154 → 191

Das ist der teuerste Cluster der Serie, und er ist es wert, aber nicht aus dem Grund, den die Zahl
nahelegt.

| Regel | Δ | Bedeutung |
|---|---|---|
| `RC-05` | **+7** | Von 6 auf 13. Sieben Modulgrenzen, über die Code importiert wird, ohne dass der Graph die Verbindung dokumentiert — vorher unsichtbar, weil ein Ende der Kante keinem Modul gehörte |
| `R-31` | +12 | Infrastrukturfunktionen ohne modellierten Fluss |
| `R-02` | +11 | Elf Funktionen erfüllen keine Anforderung — dieselbe Lücke wie bei CR-GC-394, eine Ebene tiefer |
| `R-30` | +4 | Konfiguration, Tool-Bindung, Tool-Kontext und Host-Socket dienen jeder Kette und keiner |
| `R-04` `RD-04` `MT-02` | +5 | siehe unten |
| `RD-01` | **−1** | `REQ-thresholds-from-config` hat einen Erfüller |

Fehler bleiben **0**, Compliance 1,000. TRR-Vollständigkeit 223 → 235.

## Der eigentliche Ertrag: drei Module sind zu groß

Das ist neu und war vorher nicht messbar:

- **`MOD-harness`: 14 Funktionen, 30 kreuzende Flüsse.** `R-04` schaltet damit in die schärfere
  Stufe — *„split recommended"* statt *„high coupling"*.
- **`MOD-mcp-tools`: LCOM4=8** — neun Funktionen in acht Gruppen, die einander nicht berühren.
- **`MOD-steering`: 12 Funktionen**, `RD-04` feuert zusätzlich.

Zusammen mit `MOD-cli` (LCOM4=6) sind das vier Module, deren Schnitt nicht mehr trägt. Das ist die
Aussage, für die dieser Cluster bezahlt wurde — sie war nicht formulierbar, solange ein Drittel der
Quelldateien im Modell nicht vorkam.

## Was nicht modelliert wurde, und warum

- `package-version.ts` — wird über Modulgrenzen gerufen, trägt aber keine eigene Verantwortung im
  System. Ein Knoten ohne Aussage.
- `se-plan.ts`, `se-author-uc.ts` — testbare TypeScript-Kerne hinter prompt-realisierten Skills. Es
  gibt kein Modul für sie: `MOD-skills` ist ausdrücklich prompt-realisiert. Bodensatz.
- `test-selection.ts` — `impactedTests` ist die Implementierung hinter
  `FUNC-resolve-tests-from-code`, das bereits auf `harness.ts::testImpact` zeigt. Ein zweiter Knoten
  wäre ein Parallelpfad.
- `authoring-example.ts`, `merge.ts`, `testreport.ts`, `test-selection-audit.ts` — kein Aufrufer
  über eine Modulgrenze. Steht im Bodensatz.

## Akzeptanzkriterien

- [x] Jedes `realRef`-Symbol ist in seiner Datei deklariert — `R-20` und `RC-01` feuern nicht.
- [x] Jede Kettenzuordnung ist durch eine Aufrufstelle oder den Zweck der Kette belegt; vier
      Funktionen bleiben bewusst ohne Kette.
- [x] Genau eine satisfy-Kante, keine passend gebogene.
- [x] Fehler 0, Compliance 1,000.
- [x] Der Anstieg um 37 Findings ist aufgeschlüsselt, nicht weggeschrieben.
