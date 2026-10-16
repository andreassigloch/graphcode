# CR-GC-819: Uebergaben ohne Kette (R-21): ownKuzu bekommt den Harness von createHarness, nicht die Sperre; export->Datei->seed ohne eigene Kette

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-976 (finding)
**Erstellt:** 2026-10-16
**Item:** bok/items/ITEM-2026-976.json (Lane: graph)

---

**Art:** Modellzug, kein Code

---

## Befund

Nach CR-GC-814 standen zwei Übergaben ohne gemeinsame Kette (R-21):

1. `claim-store-lock → store-ownership → ownKuzu` — **gibt es im Code nicht.** `ownKuzu` fasst die Sperre nicht an
   (`src/kernel/own-kuzu.ts`, Kopf: „keine Sperre angefasst"); es ruft `opts.open` (`own-kuzu.ts:70`), also
   `createHarness`, und bekommt den Harness zurück. Die Sperre nimmt der `GraphStore`. Einziger Aufrufer von `ownKuzu`
   ist der SSE-Host (`src/surface/host.ts:116`).
2. `graph_export → graph-snapshot-file → seedFromJson` — **gibt es wirklich**, über die committete Datei, zeitversetzt.
   Ein Integrationstest dafür existiert (`tests/harness.import.test.ts`, TEST-graph-is-ssot: „loads the full SSOT
   graph into disk Kuzu and round-trips"), war aber keiner Kette zugeordnet.

## Umfang (Entscheidung Auftraggeber 2026-10-16: Variante a)

1. `− store-ownership → ownKuzu`, `+ harness-handle → ownKuzu`, `+ live-update ∋ createHarness`.
2. Neue Kette `FCHAIN-snapshot-roundtrip` „Snapshot-Rundreise": Ablaufsteuerung → `graph_export` → Datei →
   `seedFromJson` → `importGraph` → GraphStore; unter UC-graph-time-travel; erfüllt `REQ-graph-is-ssot`
   (non-functional), verifiziert durch TEST-graph-is-ssot.

## Abnahme

Probelauf ohne neue Fehler, beide R-21 weg; `npm run verify:model` grün.

## Umsetzung (2026-10-16)

Ein Zug durchs Gate (v781 → v782), beide R-21 weg (Stufe Test 27 → 25 Befunde), keine neuen Fehler; `verify:model`
grün. Der Modellstand ging technisch mit dem Abschluss-Commit von CR-GC-818 (cb61133c) ins Repo — der Pre-Commit-Hook
stagt die SSOT-Datei mit.
