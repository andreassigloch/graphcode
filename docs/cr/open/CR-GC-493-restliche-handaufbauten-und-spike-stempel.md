# CR-GC-493 — Die restlichen Handaufbauten und der Spike-Stempel

**Status:** offen · **Angelegt:** 2026-09-09 · **Ring:** 2 (Werkzeug)
**Hängt an:** `CR-GC-491` (liefert `openMeasured` — hier wird es nur angewandt)
**Grundlage:** `grep -rn "new GraphCodeHarness" rig/ scripts/` nach CR-GC-491, 2026-09-09

---

## 1. Root Cause

`CR-GC-491` hat den Messaufbau gebaut und zwei Rigs umgestellt. **Drei Fundstellen blieben** —
sie waren beim Schneiden des CRs nicht gezählt, und sie nachzuziehen hätte das 6-Dateien-Limit
auf 9 gesprengt:

| Datei | Muster |
|---|---|
| `rig/minimal-whitebox/run-armC.mjs:41` | `new GraphCodeHarness(cfg, storage)`, `SE_DESCRIPTOR` |
| `rig/minimal-whitebox/run-armC-pull.mjs:63` | identisch |
| `rig/dummy-slicer/scripts/armB.mjs:17` | identisch, **zusätzlich** Store unter `<tmp>/kuzu` bei `repoRoot: RIG` — Schloss und Store liegen auseinander (wie `driver.mjs` vor CR-GC-491) |

Dazu die vierte Stelle, die `CR-GC-491` §5 ausdrücklich vertagt hat:
`scripts/spike-lexikographisch.mjs` ist Korpus-Klasse, liest aber die **lebenden**
`docs/graph/*.graph.json` von fünf Repos.

## 2. Impact

**Die drei Rig-Skripte:** dieselbe Klasse wie `CR-GC-491` — Default-Budgets statt der
Repo-Config, unparametrisierter Descriptor. Heute folgenlos, invertierend sobald ein Budget
wandert.

**Der Spike ist der schwerere Fall.** Er ist das Instrument, mit dem **CR-SM-292** entschieden
wurde (Chebyshev statt ℝ⁶). Ein Benchmark, dessen Eingabe weiterläuft, misst nichts — das
schreibt `rig/graphs/README.md` selbst. Zwei Läufe auf verschiedenen Ständen liefern heute zwei
Zahlen ohne Erklärung. **Die Evidenz für die zentrale Steuerungsentscheidung ist damit nicht
reproduzierbar.**

## 3. Fix

1. Die drei Skripte auf `openMeasured` — eine mechanische Ersetzung, dasselbe Muster dreimal.
2. `spike-lexikographisch.mjs` gibt **je Eingabegraph** Pfad, sha256, `graphVersion` und Umfang
   aus, plus `RULES_VERSION` und Code-SHA für den Lauf (`stampLine` aus `CR-GC-491`).
3. **Der Spike bleibt Korpus-Klasse** — er baut keinen Harness. Der Stempel macht die Drift
   *sichtbar*; das Einfrieren der Graphen nach `rig/graphs/` ist eine Datenentscheidung je Graph
   und bleibt ausdrücklich draußen (s. §5).

### Dateien (4)

| # | Datei |
|---|---|
| 1 | `rig/minimal-whitebox/run-armC.mjs` |
| 2 | `rig/minimal-whitebox/run-armC-pull.mjs` |
| 3 | `rig/dummy-slicer/scripts/armB.mjs` |
| 4 | `scripts/spike-lexikographisch.mjs` |

## 4. Akzeptanzkriterien

- [ ] `grep -rn "new GraphCodeHarness" rig/ scripts/` findet **nichts** mehr (ausser der
      Regel-Zeile in `rig/README.md`, die den Verzicht benennt).
- [ ] Jedes der drei Skripte gibt vor der ersten Zahl seinen Stempel aus.
- [ ] **Kein Zahlenversatz:** Ausgabe vor und nach der Umstellung ist zeichengleich, bis auf
      Stempel- und Pfadzeilen — derselbe Nachweis wie in `CR-GC-491` für `driver.mjs`.
- [ ] `spike-lexikographisch.mjs` nennt je Eingabegraph sha256 und `graphVersion`; zwei Läufe
      auf demselben Stand sind zeichengleich.
- [ ] `armB.mjs`: Store und `owner.lock` liegen im selben Verzeichnis (CR-GC-218).

## 5. Nicht im Scope

- Die Korpusgraphen des Spikes **einfrieren**. Der Stempel macht die Drift sichtbar; welcher
  Stand eingefroren wird, ist je Graph zu entscheiden und braucht einen eigenen Vorgang.
- Die Testbasis — 103 Stellen, `CR-GC-492`.
