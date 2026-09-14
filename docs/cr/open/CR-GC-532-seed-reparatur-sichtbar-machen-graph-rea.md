# CR-GC-532: Zurückgehaltene Kanten stehen in graph_readiness und in der Export-Verweigerung

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-145 (finding)
**Erstellt:** 2026-09-14
**Item:** bok/items/ITEM-2026-145.json (Lane: code)
**Auftrag:** Auftraggeber 2026-09-14 — „beide Items per CR richten“
**Folge von:** CR-GC-530 (Seed hält musterfremde Kanten zurück) · **Nicht Teil:** Reparatur des Altbestands in anderen Repos (ITEM-2026-150)

---

## 1. Root Cause

CR-GC-530 nennt die zurückgehaltenen Kanten nur einmal: als stderr-Warnung beim Seed. Zwei Lücken:

1. `graph_readiness` — dort, wo jemand fragt „wie fertig bin ich?“ — zeigt sie nicht. R-18 kann sie nicht
   melden, weil sie nie im Graphen stehen.
2. Die Export-Verweigerung (projections/export.ts:224) nennt fehlende Elemente, aber keine Kanten, und
   keinen Reparaturweg. Nach einem Neustart läuft kein Seed (der Store ist nicht leer): die Warnung ist
   weg, die Kanten fehlen weiter.

## 2. Impact

Wer den Boot-Log nicht liest, sieht nur „graph_export refused … Dropped elements: .“ — ohne Hinweis,
welche Kanten und was zu tun ist.

## 3. Fix

`heldBackTraces(repoRoot, systemId, live)` in harness-import.ts: Kanten der committeten Graph-Datei, die
im Live-Graphen fehlen und die `traceRejection` mit `no-pattern` ablehnt — dieselbe Prüfung wie der Seed.
**Abgeleitet, nicht gemerkt:** die Liste überlebt jeden Neustart und leert sich mit dem Export, der die
Reparatur abschließt.

- `graph_readiness.heldBackTraces` führt sie.
- Die Export-Verweigerung nennt die fehlenden Kanten und — wenn zurückgehaltene darunter sind — den Weg:
  `delete-edge` durch `graph_mutate`, dann `graph_export`.

## 4. Akzeptanzkriterien

- [x] Test rot gegen heute (`undefined`): `graph_readiness.heldBackTraces` nennt die Kante nach dem Seed und nach einem Neustart ohne Seed.
- [x] Test rot gegen heute: die Export-Verweigerung nennt `ACTOR-op -io-> UC-use` und `delete-edge`.
- [x] Nach Reparatur und Export ist `heldBackTraces` leer.
- [x] Suite 1127/1127 und tsc grün; Smoke am gebauten Host.

Seed und `heldBackTraces` urteilen über dieselbe Funktion (`noPatternFor`) und dieselbe Abbildung (`traceToEdge`) — kein zweiter Prüfpfad.

## 5. Dateien

`src/kernel/harness-import.ts` · `src/projections/report.ts` · `src/projections/export.ts` · `tests/harness.import-rejected-traces.test.ts` · dieser CR
