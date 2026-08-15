# CR-GC-261: harness.ts — Query-Pfad heraus, Gate-Ausnahme festschreiben

**Status:** open · **neu geschnitten 2026-08-08** · **Max Files:** 6
**Herkunft:** Folge-CR aus CR-GC-260 (Modul-Schnitte). Zweimal nachgemessen und zweimal
verkleinert — was hier steht, ist der gemessene Rest, nicht die Fortschreibung.

## Nachmessung 2026-08-08 (ersetzt die Bestandsaufnahme vom 2026-08-07)

| Modul | im Ur-CR (2026-07-26) | heute | Befund |
|---|---|---|---|
| `src/readiness.ts` | 505 | **100** | **erledigt** — CR-GC-265/296 haben readiness + panels auf `@sigloch/graphcode-client`-Shims umgestellt. Kein `readiness-gates.ts` nötig, der Schnitt hat sich anders aufgelöst. Punkt 1 des Ur-CRs ist **gestrichen**. |
| `src/harness.ts` | 712 | **744** | offen, wächst weiter. Gegenstand dieses CRs. |
| `src/executor.ts` | — | **1503** | **eigenes CR (CR-GC-320)** — 1503 Zeilen sind kein Verschiebe-, sondern ein Umbau-Budget. |
| `src/viewer/help-content.ts` | — | **626** | **bewusst draußen** (Entscheidung 2026-08-08): reiner Content-Katalog, kein Kontrollfluss. Die 500-Grenze zielt auf Lesbarkeit von Logik. |

`executor.ts`, `harness.ts`, `viewer/help-content.ts` sind die einzigen drei Dateien über
500 Zeilen in `src/` (gemessen).

## Problem (Why)

`harness.ts` (744) mischt zwei Verantwortungen: den **Apply-Gate** (L1 — Governance) und
einen **read-only Query-Pfad** (Kuzu-Cypher für `graph_impact`/`graph_expand`/
`graph_elements`/Test-Impact). Der Query-Pfad hat keinen Gate-Bezug, keine Mutex-Beteiligung
und keinen Zugriff auf die In-Memory-Working-Copy — er liest ausschließlich `this.storage`.
Er liegt nur deshalb in derselben Datei, weil er es immer schon tat.

## Decision

1. **`harness.ts` → `harness-queries.ts`**: `impact` / `subgraph` / `testImpact` /
   `listElements` ([harness.ts:209-339](../../../src/harness.ts#L209-L339), ~130 Zeilen).
   Muster wie CR-GC-260: schmaler Port (`QueryTarget` = `{ storage, scope }`) + freie
   Funktionen im neuen Modul, in `harness.ts` bleiben vier **dünne Delegates**. Damit
   ändert sich für **keinen** Aufrufer die Signatur — `src/tools/read.ts`,
   `src/tools/report.ts`, `src/viewer/host.ts` und die vier Tests bleiben unangefasst.
2. **Das Apply-Gate wird NICHT verschoben.** Nach §1 liegt `harness.ts` bei **~615**
   Zeilen. Die verbleibende Masse ist `mutate`/`applyMutation` (168), `applyCommands` (100),
   `persist` (36), `runRules`/`unknownTypeErrors` (32) — durchgehend Gate-Mechanik. Unter
   500 kommt nur ein Gate-Umbau, und ein Fehler im Gate ist ein Governance-Fehler, kein
   Formatierungsfehler.
3. **Die Ausnahme wird festgeschrieben, nicht weitergeschleppt:** ein Absatz in
   `src/README.md` (Modul-Karte) nennt `harness.ts` als bewusste, begründete Ausnahme von
   der 500-Zeilen-Regel. Danach ist dieses CR abgeschlossen — es gibt keinen offenen Rest
   mehr für `harness.ts`.

## Akzeptanz

- [ ] Reines Verschieben: keine Signatur-, Ausgabe- oder Semantik-Änderung.
- [ ] **Keine** Datei außer `src/harness.ts` + `src/harness-queries.ts` + `src/README.md`
      angefasst (die Delegates halten alle Aufrufer stabil) — kein Test geändert.
- [ ] `harness-queries.ts` < 500; `harness.ts` ~615 **mit dokumentierter Ausnahme**.
- [ ] `npm run build` + `npm test` vollständig grün.

## Nicht in diesem CR

- Der Apply-Gate selbst (`applyMutation`), der Store-Lock (O2), der Write-Mutex (O3).
- `src/executor.ts` → **CR-GC-320**.
- `src/viewer/help-content.ts` → bewusst keine Aktion (s. Nachmessung).
- `src/readiness.ts`, `src/mcp-tools.ts`, `src/exporter-views.ts` → mit CR-GC-256 /
  CR-GC-260 / CR-GC-265 / CR-GC-296 erledigt.

**Trigger zum Ziehen:** jederzeit — der Schnitt ist mechanisch und berührt keinen Test.
