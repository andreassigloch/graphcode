# CR-GC-271 — SCHEMA-Bindung: `zodDefinition` raus, `realRef`-Stub materialisieren

**Status:** ✅ Done (2026-07-28) — Commit `dd24c32`
**Typ:** Refactoring (Produzenten-Migration) + Feature (Stub)
**Erstellt:** 2026-07-27
**Repo:** graphcode (`src/exporter.ts`, `src/views/incose.ts`, `src/tools/export.ts`)
**Gehört zu:** [[BOK-CR-026]] Schritt 1 + 1b (`EPIC-002`)
**Parallel zu:** `CR-AIM-234` (aimpro-Produzent) — kein gemeinsames File
**Blockiert:** `CR-SM-220` (Regeln retiren)

## Problem A — Legacy-Attribut wird noch verarbeitet

`src/exporter.ts` und `src/views/incose.ts` lesen `zodDefinition` als SCHEMA-Bindung. Das ist
Zod-Quelltext, der als String im Graphen liegt — eine Kopie, die niemand nachzieht. Die aktuelle
Bindung ist `realRef {file, symbol?}` (R-26, RC-03 löst sie auf, RC-04 prüft, dass sie am Interface
geparst wird). Solange die Produzenten-Seite `zodDefinition` bedient, kann `CR-SM-220` SC-01/SC-03
nicht entfernen, ohne die Views zu desynchronisieren.

## Problem B — `realRef` wird nicht materialisiert ([[BOK-CR-026]] §6b)

Die Test-Analogie ist auf der Regel-Seite vollständig (R-19 ↔ R-26 formgleich), auf der
Materialisierungs-Seite **nicht**:

| | TEST | SCHEMA |
|---|---|---|
| Bindung | `testRef {file, tool}` | `realRef {file, symbol?}` |
| Stub bei fehlender Datei | ✅ `it.todo`, `src/tools/export.ts:147-152` (CR-GC-205 Item 4) | ❌ **nichts** |

Der Kommentar an der Test-Stelle nennt den Grund: „so `graph_tests` never resolves a phantom path".
Für SCHEMA gilt derselbe Anspruch und wird nicht eingelöst — eine SCHEMA kann laut Graph gebunden
sein, während die Datei fehlt. Genau der Zwischenstand, den [[BOK-CR-026]] §6 ausschließt.

## Änderung

1. **`exporter.ts` / `incose.ts`:** SCHEMA-Bindung aus `realRef` lesen statt aus `zodDefinition`.
   Wo bisher der Inline-Zod-Text gerendert wurde, steht künftig der Zeiger (`file#symbol`).
   `zodDefinition` wird **nicht** als Fallback gelesen — kein paralleler Pfad.
2. **`tools/export.ts`:** Zod-Stub-Materialisierung analog zur `testRef`-Logik. Für jede SCHEMA mit
   gültigem `realRef`, deren `file` fehlt: Datei anlegen mit einem benannten Export
   (`export const <symbol> = z.unknown(); // TODO: define`), damit RC-03 keinen Phantompfad auflöst.
   **Bestehende Dateien nie überschreiben** — dieselbe Garantie wie bei den Test-Stubs.
   `realRef` ohne `symbol` (CAD-Fall bei physischem MOD) bekommt keinen Stub.

## File List (5)

- `src/exporter.ts` — SCHEMA-Bindung aus `realRef`
- `src/views/incose.ts` — dito
- `src/tools/export.ts` — Zod-Stub-Materialisierung + Tool-Beschreibung ergänzen
- `tests/` — Stub-Test: fehlende Datei → Stub, vorhandene → unberührt
- `docs/graph/graphcode.graph.json` — SSOT-SCHEMAs auf `realRef`, falls dort noch Legacy steht

## Akzeptanzkriterien

- [x] `grep -rn "zodDefinition" src/` — **kein Lesepfad mehr.** Ein einziger Treffer bleibt:
      [`src/views/incose.ts:74`](../../src/views/incose.ts#L74), ein Kommentar, der festhält, dass
      das Attribut weg ist. Bewusst so notiert statt „grep leer" zu behaupten.
- [x] `graph_export` legt für eine gebundene SCHEMA mit fehlender `realRef.file` einen Zod-Stub an
      — `tests/export.realref-materialize.test.ts` Fall (a)
- [x] Vorhandene Datei wird **nicht** überschrieben — Fall (b)
- [x] `realRef` ohne `symbol` erzeugt keinen Stub — Fälle (c)/(d) (concept/external, unbound)
- [x] SRS-/INCOSE-Views rendern die Bindung als Zeiger, nicht als Inline-Text
- [x] Suite grün + `npm run build` grün — **317/317** (die im CR genannten 291 waren der Stand bei
      Erstellung; seither sind Tests dazugekommen)

## Abgrenzung

- SC-01/SC-03 werden hier **nicht** entfernt (`CR-SM-220`, Reihenfolge zwingend).
- Keine Änderung an `codec.ts` — das ist `CR-GC-268`/`CR-GC-269` (`EPIC-001`), anderes File.
- Keine Änderung an der `testRef`-Stub-Logik selbst, nur das SCHEMA-Analogon daneben.
