# CR-GC-424 — Sechs Dateien, die keiner MOD gehörten

**Status:** done · **Angelegt:** 2026-08-25 · **Geschlossen:** 2026-08-25 (graphVersion 204)
**Herkunft:** CR-DRAFT-GC-409 §C, zweiter Teil. CR-GC-423 hat die drei RC-05-Befunde geschlossen —
und damit die Liste der **17 nicht zugeordneten Dateien** mit verschwinden lassen, die nur als
Anhang jener Meldung existierte.

## Problem

RC-05 bildet Quelldateien auf MODs ab über (1) die `realRef` einer allozierten FUNC und (2) das
`path`-Präfix einer MOD. Eine Datei, die weder das eine noch das andere trifft, wird von der
Regel **nicht geprüft** — ihre Importe können jede Modulgrenze überqueren, ohne dass es auffällt.
17 von 176 Import-Endpunkten lagen so.

Sechs davon sind ohne jede Erfindung zuordenbar:

| Datei | Zuordnung | Warum |
|---|---|---|
| `src/viewer/health.ts`, `help.ts`, `help-content.ts`, `panels.ts` | `MOD-host-bridge.path = src/viewer` | Der Host-Prozess ist der Eigentümer von `src/viewer/`; seine eigene FUNC-Bindung (`host.ts`) liegt schon dort. `MOD-dashboard` hatte diesen Pfad früher und hat ihn mit CR-GC-401 verloren — er gehört seither dem Modul, das die Dateien wirklich hält. |
| `src/hooks.ts` | `MOD-hooks.path = src/hooks.ts` | Das Modul heißt „hooks.ts — HookSystem"; die Klasse steht in genau dieser Datei, während seine beiden FUNC in `emit.ts` gebunden sind. |
| `src/merge.ts` | `FUNC-merge-nodes.realRef` | siehe unten. |

## FUNC-merge-nodes war als Konzept markiert — der Merge ist seit CR-GC-234 gebaut

`FUNC-merge-nodes` trug `concept: true` und die Beschreibung „Conflict-free Merge via merge_nodes
+ deterministischer Serialisierung", allokiert auf **MOD-codec**. Beides ist Vor-CR-234-Stand:
der Merge ist seither ein **Replay des Branch-Kommando-Logs durch dasselbe Apply-Gate**
(`src/merge.ts`, `replayBranchLog`), ausgeliefert als MCP-Tool `graph_merge`. Mit dem Codec hat
er nichts zu tun; er treibt `harness.mutate()`.

Korrigiert wird deshalb dreierlei in einem Zug: `realRef` auf `src/merge.ts#replayBranchLog`,
`concept` gelöscht (Grabstein `null`), Allokation **MOD-codec → MOD-harness**.

## Gemessen (dryRun vor jedem Batch, 2026-08-25, graphVersion 202)

- Pfad-Zuordnungen: keine Violation, `auto-apply`.
- `FUNC-merge-nodes` realisiert: keine Violation, `auto-apply`.
- Re-Allokation: **keine neue Regel-ID** — nur die bestehenden Befunde `R-04`/`RD-04` an
  MOD-harness zählen 15 statt 14 FUNC. Das ist derselbe offene Architektur-Schnitt aus §D.
- RC-05 bleibt 0 (nachgerechnet gegen die 176 realen Import-Kanten, keine neue Modulgrenze wird
  durch die Zuordnung sichtbar).

## Akzeptanzkriterien

- [x] `MOD-host-bridge.path = src/viewer`, `MOD-hooks.path = src/hooks.ts` gesetzt.
- [x] `FUNC-merge-nodes`: realRef gesetzt, `concept` weg (Grabstein `null`), auf MOD-harness
      alloziert; kein zweiter allocate-Pfad übrig.
- [x] Nicht zugeordnete Dateien 17 → 11; RC-05 bleibt 0.
- [x] Gesamtzahl der Violations bleibt 32, keine neue Regel-ID.
- [x] `npm test` grün (118 Dateien / 928 Tests, 2026-08-25).

## Was offen bleibt

Die restlichen **11** Dateien sind nicht ohne eine Regel- oder Codeänderung zuordenbar —
Befund und Vorschlag in **CR-GC-425**.
