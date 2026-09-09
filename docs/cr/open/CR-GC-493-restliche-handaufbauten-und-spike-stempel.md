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

**Beim Lesen zeigte sich, dass `openMeasured` zwei Fälle nicht kennt** — und beide sind der
Grund, warum diese drei Skripte von Hand bauten:

| Fall | wer braucht ihn | heute |
|---|---|---|
| **Start ohne Graph** (Greenfield-Autorierung) | `run-armC.mjs`, `run-armC-pull.mjs` | `graph` ist Pflichtparameter |
| **Fremde Repo-Wurzel bei Wegwerf-Store** | `armB.mjs` (`repoRoot: RIG`, Store in `/tmp`) | `createHarness` leitet den Store-Ort AUS `repoRoot` ab |

Der erste ist klein und gehört hierher. Der zweite verlangt eine Änderung an `createHarness`
selbst — der Store-Ort müsste vom `repoRoot` trennbar werden — und ist damit ein Eingriff in die
Composition Root, nicht ein Rig-Nachzug. **`armB.mjs` geht deshalb an `CR-GC-496`.**

1. **`openMeasured({ graph })` wird optional.** Ohne Graph startet ein leeres Wegwerf-Repo;
   der Stempel sagt dann `graph —` statt eines Hashes, nie einen erfundenen.
2. Die beiden `run-armC*.mjs` gehen darauf — eine Ersetzung, zweimal dasselbe Muster.
3. `spike-lexikographisch.mjs` gibt **je Eingabegraph** Pfad, sha256, `graphVersion` und Umfang
   aus, plus `RULES_VERSION` und Code-SHA für den Lauf. **Er bleibt Korpus-Klasse** — kein
   Harness; der Stempel macht die Drift *sichtbar*, das Einfrieren bleibt draußen (§5).

### Dateien (5)

| # | Datei |
|---|---|
| 1 | `src/surface/measured.ts` — `graph` optional |
| 2 | `tests/rig-measured.test.ts` — der leere Start als eigener Fall |
| 3 | `rig/minimal-whitebox/run-armC.mjs` |
| 4 | `rig/minimal-whitebox/run-armC-pull.mjs` |
| 5 | `scripts/spike-lexikographisch.mjs` |

## 4. Akzeptanzkriterien

- [ ] `grep -rn "new GraphCodeHarness" rig/ scripts/` findet nur noch `armB.mjs` — benannt und
      an `CR-GC-496` übergeben, nicht vergessen.
- [ ] **Rot zuerst:** ein Test ruft `openMeasured` ohne `graph` und erwartet einen leeren,
      benutzbaren Harness plus einen Stempel, der die Abwesenheit des Graphen sagt.
- [ ] Jedes der beiden armC-Skripte gibt vor der ersten Zahl seinen Stempel aus.
- [ ] **Kein Zahlenversatz:** Ausgabe vor und nach der Umstellung ist zeichengleich, bis auf
      Stempel- und Pfadzeilen — derselbe Nachweis wie in `CR-GC-491` für `driver.mjs`.
- [ ] `spike-lexikographisch.mjs` nennt je Eingabegraph sha256 und `graphVersion`; zwei Läufe
      auf demselben Stand sind zeichengleich.


## 5. Nicht im Scope

- Die Korpusgraphen des Spikes **einfrieren**. Der Stempel macht die Drift sichtbar; welcher
  Stand eingefroren wird, ist je Graph zu entscheiden und braucht einen eigenen Vorgang.
- Die Testbasis — 103 Stellen, `CR-GC-492`.
- `armB.mjs` und die Trennung von Store-Ort und Repo-Wurzel in `createHarness`: **`CR-GC-496`**.
