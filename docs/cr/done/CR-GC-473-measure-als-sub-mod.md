# CR-GC-473 — `measure` als Sub-MOD: die Ebene im Kern, jetzt auch im Modell

**Status:** done · **Angelegt:** 2026-09-03 · **Abgeschlossen:** 2026-09-03 · **Herkunft:** CR-GC-467 Entscheidung 1; nach den
fünf Moves CR-GC-468–472 liegt `src/kernel/measure/` auf der Platte, im Modell nicht

## Root Cause

Fünf FUNCs (`nd-similarity`, `fit-advisory`, `compute-phase-readiness`, `take-steering-snapshot`,
`compute-steering-delta`) sind seit den Moves an `MOD-kernel` alloziert — 31 direkte Kinder, R-04
und RD-04 feuern. Die Doktrin (`se:top-level`): *„the answer to 'too big' is a level, not more
modules."* Die Ebene existiert im Verzeichnis; das Modell muss sie tragen, sonst sagt der Graph
„ein Modul mit 31 Funktionen", der Code „ein Modul mit einer Messungs-Ebene". Erster
`MOD -compose-> MOD` dieses Graphen; das Pattern ist Grammatik (`0..*`).

## Änderung (nur Modell, durchs Gate)

- `MOD-kernel-measure` (Name: *measure — Messung: Readiness, Fit-Advisory, Testauswahl,
  Ähnlichkeit, Steuerungs-Snapshot*), `MOD-kernel -compose-> MOD-kernel-measure`.
- Die fünf FUNCs: `allocate` von `MOD-kernel` nach `MOD-kernel-measure`. SCHEMAs tragen kein
  `allocate`, nichts zu tun. Kein eigenes `satisfy`: keine Regel verlangt es, der Stack ist der des
  Elternmoduls (Klasse B).

## Befunde aus dem Dry-Run — ehrlich, nicht wegdiskutiert

- **R-04/RD-04 an `MOD-kernel` bleiben** (26 direkte FUNCs > 11). Die Doktrin verlangt weitere
  Ebenen — Speicher, Gate — das ist Entwurfsarbeit, nicht dieser CR.
- **CR-01 zählt Eltern↔Kind als Grenze:** `MOD-kernel ↔ MOD-kernel-measure` 4 Verträge, Warnung.
  Die Regel kennt keine Verschachtelung; ein Fluss, der eine Sub-MOD-Grenze innerhalb desselben
  Moduls kreuzt, ist kein Kopplungsbefund. Gehört als Frage zu CR-SM-279 (Regel-Semantik, L2).
- **Die Messung wird sichtbar konsumiert:** `kernel-measure ↔ loop` **7** Verträge, `↔ projections`
  3, `↔ surface` 3. Das ist die Aussage von CR-GC-467 im Modell: Steuerung und Projektion lesen die
  Messung; sie besitzen sie nicht.
- Fit-Advisory: `modifiability +0,044`, `scalability −0,046`, `flowEfficiency −0,003`.

## Akzeptanzkriterien

- [x] Gate: dryRun 0 Blocker, apply (graphVersion 237 → 238), Export — Diff = ein MOD-Knoten, eine
      `compose`, fünf `allocate` umgehängt, sonst nichts.
- [x] `graph_metrics`: `MOD-kernel-measure` 5 FUNCs, **LCOM4 = 1** (eine zusammenhängende Einheit),
      fanIn 30 / fanOut 14; `MOD-kernel` 31 → 26 direkte FUNCs, LCOM4 4.
- [x] Viewer (gve): `nestingHierarchy` löst `MOD-kernel-measure → MOD-kernel` und die fünf Kinder auf (headless geprüft).
- [x] Docs-Lane grün (`verify:model`).

## Dateien

1. `docs/graph/graphcode.graph.json` + Views (Export)
2. dieser CR
