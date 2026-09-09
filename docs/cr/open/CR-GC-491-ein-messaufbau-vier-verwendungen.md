# CR-GC-491 — Ein Messaufbau, vier Verwendungen

**Status:** offen · **Angelegt:** 2026-09-09 · **Ring:** 2 (Werkzeug)
**Grundlage:** Lesung `rig/*/`, `scripts/spike-lexikographisch.mjs`,
`src/surface/create-harness.ts`, `src/kernel/harness.ts`, `graphcode.config.jsonc`, 2026-09-09
**Zieht nach:** `CR-GC-492` (derselbe Befund über die Testbasis)

---

## 1. Root Cause

**Es gibt keinen Messaufbau, es gibt vier — und kein Ergebnis sagt, welcher gelaufen ist.**

| Aufbau | Bootstrap | Store-Pfad | Repo-Config |
|---|---|---|---|
| `rig/greenfield-systemtest/run.mjs` | `createHarness()` | `.graphcode/kuzu` | geladen |
| `rig/minimal-whitebox/measure.mjs` | `new GraphCodeHarness(…)` | `<tmp>/.graphcode/kuzu` | **DEFAULT** |
| `rig/moneyflow-struktur/driver.mjs` | `new GraphCodeHarness(…)` | `<tmp>/kuzu` | **DEFAULT** |
| `scripts/spike-lexikographisch.mjs` | keiner — liest `docs/graph/*.json` | — | `DEFAULT_METRIC_POLICY` |

`createHarness` (`src/surface/create-harness.ts:38`) ist die Composition Root und tut fünf Dinge,
die der Konstruktor **still** überspringt (`harness.ts:142` — Fallback ohne Warnung):

1. `HarnessConfigSchema.parse` — Config-Validierung
2. `loadGraphcodeConfig(repoRoot)` — die **Urteilsschwellen des Repos**; fehlt sie, gilt
   `DEFAULT_CONFIG` mit `source: 'default'`, und niemand erfährt es
3. `createSeDescriptor(policy)` — der Descriptor wird **mit** der Policy gebaut. Beide Rigs
   übergeben stattdessen den unparametrisierten `SE_DESCRIPTOR` → **zwei Descriptoren in einem
   Rig**: DDL aus dem einen, Regeln aus dem anderen
4. `HookSystem` + `registerEmitters` — ohne sie läuft kein Pre-Commit-Hook
5. `lockDir`/`storePath` — bei `driver.mjs` liegt der Store unter `<tmp>/kuzu`, der `owner.lock`
   aber unter `<tmp>/.graphcode/`: **das Schloss bewacht den Store nicht** (gegen CR-GC-218)

Ausgerechnet `rig/moneyflow-struktur`, dessen README sagt *„Hier läuft derselbe Code wie in
Produktion"*, tut es nicht.

## 2. Impact — heute latent, mit dem nächsten Schritt invertierend

**Gemessen:** `graphcode.config.jsonc` ist **zeichengleich mit `DEFAULT_METRIC_POLICY`**
(`instability: null`, `lcom4 4/6`, `crossingFlows 3`, `decompositionBreadth 9`,
`boundaryWidth 5`, `moduleSize 9/7/2`, `focusThreshold 0.8`). Alle vier Aufbauten liefern
**heute dieselben Zahlen.** Der Defekt ist latent, nicht aktiv — das ist die ehrliche Lage.

**Er wird scharf mit dem Schritt, der ohnehin ansteht.** CR-GC-484 T-S3 hat bewiesen: *das Budget
ist die Stellgröße* (Arme 11 vs. 2). CR-SM-303 will genau daran drehen. Sobald jemand
`boundaryWidth` in `graphcode.config.jsonc` senkt, messen zwei von vier Aufbauten weiter auf
Default — und das Experiment liest sich als **„keine Wirkung"**. Das ist kein Rauschen, das ist
ein invertiertes Ergebnis.

Vier von fünf Familien-Repos haben gar keine Config; `moneyflow` bekommt in seinem Rig also nie
moneyflows Budget zu sehen. **Das Rig isoliert richtig den Store — und falsch die Config gleich mit.**

Zweitens, `spike-lexikographisch.mjs`: er ist Korpus-Klasse (reine Rangfrage), liest aber die
**lebenden** `docs/graph/*.graph.json` von fünf Repos. Ein Benchmark, dessen Eingabe weiterläuft,
misst nichts — das schreibt `rig/graphs/README.md` selbst. Damit ist die Evidenz für **CR-SM-292**
(Chebyshev statt ℝ⁶) heute nicht reproduzierbar, und nichts im Ergebnis sagt es.

## 3. Fix

Ein Kern, vier Verwendungen — Rig, **Spike**, **Alternativenvergleich**, **Test** unterscheiden
sich in der Frage, nicht im Aufbau.

```
openMeasured({ graph, repoRoot?, config?, class: 'gate' | 'korpus' })
  → { harness, tools, graph, policy, provenance, close }
```

1. **Ein Bootstrap.** Immer `createHarness`. `new GraphCodeHarness` bleibt nur für
   Adapter-Injektions-Unittests zulässig, und dort benannt.
2. **Die Config reist mit dem Graphen.** Wer den Graphen eines fremden Repos in ein Temp-Repo
   kopiert, kopiert `graphcode.config.jsonc` mit — oder das Ergebnis trägt sichtbar
   `policy.source: 'default'`.
3. **Herkunftsstempel als Pflicht-Rückgabe**, in jedem Ergebnis, nicht im Logfile:

   | Feld | Warum |
   |---|---|
   | `graph`: Pfad, sha256, `graphVersion` | ein Benchmark mit wandernder Eingabe misst nichts |
   | `policy` + `source: 'default' \| 'file'` | die einzige verbliebene Stellgröße |
   | `rulesVersion`, `ontologyVersion` | ohne sie ist kein Lauf mit einem anderen vergleichbar |
   | `codeSha`, `repoRoot` | fängt den Lauf im falschen cwd |

   **Ohne Stempel keine Zahl.**
4. **Zwei Klassen, und die Wahl ist Teil der Messung.**

   | Klasse | Frage | Aufbau |
   |---|---|---|
   | `gate` | „was tut das System?" | Temp-Store, echtes `harness.mutate()`, Verdict/Tier/Advisories |
   | `korpus` | „wie rankt diese Funktion?" | eingefrorener Snapshot, reine Funktion, kein Store |

   Eine Gate-Frage an einem Korpus-Aufbau (und umgekehrt) ist der Fehler, nicht das Ergebnis.
5. **Blindheitsausgang statt Rang.** Jede Messung benennt ihre **unterscheidende Größe** und
   bricht laut ab, wenn deren Spreizung über die Kandidaten `0` ist — kein Tiebreak, kein
   „bestanden", kein grüner Test. Das ist die Verallgemeinerung des Wächters, den
   `spike-lexikographisch.mjs` §6 nach dem Satz-F-Nulltest bereits lokal hat: er gehört in den
   Kern, nicht in ein Skript.

### Warum Punkt 5 die vier Fehlmessungen dieser Runde deckt

| Fall | Was grün war | Woran es lag |
|---|---|---|
| Satz F (CR-SM-291) | 5 Lesarten „bestanden" | alle 4 Kandidaten Δ0, Rang aus dem Namens-Tiebreak |
| T-S2 (CR-GC-484) | Test grün mit `improvement := 0` | lief auf dem Budget, wo die Größe vorher **und** nachher 0 ist |
| ND an gegateten Graphen | 0 Befunde | zählte Überlebende statt Grundgesamtheit |
| Zeilen vs. Verträge (GVE) | „2 Größenordnungen" | zwei verschiedene FLOW-Mengen |

Eine Ursache: **die messende Größe hatte keine Streuung, und nichts hat es gesagt.**

### Dateien (6, hart)

| # | Datei | Was |
|---|---|---|
| 1 | `rig/measured.mjs` (neu) | `openMeasured`, Stempel, Blindheitsausgang |
| 2 | `rig/README.md` (neu) | Index der Rigs, Klassenwahl, Regel „ein Bootstrap" |
| 3 | `rig/moneyflow-struktur/driver.mjs` | auf `openMeasured`, Config mitkopieren |
| 4 | `rig/minimal-whitebox/measure.mjs` | dito |
| 5 | `scripts/spike-lexikographisch.mjs` | Korpus-Klasse + Stempel je Eingabegraph |
| 6 | `tests/rig-measured.test.ts` (neu) | s. AC |

`rig/greenfield-systemtest/run.mjs` wird **nicht** angefasst — es benutzt `createHarness` bereits
richtig und ist der Beleg, dass der Weg gangbar ist.

## 4. Akzeptanzkriterien

- [ ] **Rot zuerst:** ein Test setzt `boundaryWidth.warning` in einer Temp-`graphcode.config.jsonc`
      auf 2 und erwartet vom Rig-Harness `policy.boundaryWidth.warning === 2`. Vor der Änderung
      liefert `driver.mjs` **5** (Default) — der Test trifft nachweislich die geänderte Stelle.
- [ ] `provenance.policy.source` ist `'file'`, wenn eine Config da ist, sonst `'default'` —
      und steht in **jedem** Ergebnis, nicht nur im Log.
- [ ] Eine Messung mit vier Kandidaten identischen Profils liefert `blind: true` und **keinen
      Rang**. Regressionsfall aus CR-SM-291 Satz F, namentlich als solcher benannt.
- [ ] `grep -rn "new GraphCodeHarness" rig/ scripts/` findet **nichts**.
- [ ] Store und `owner.lock` liegen im selben Verzeichnis (CR-GC-218) — mit Test.
- [ ] `spike-lexikographisch.mjs` gibt je Eingabegraph sha256 + `graphVersion` aus; zwei Läufe
      auf demselben Stand sind zeichengleich.

## 5. Nicht im Scope

- **Die Testbasis** — 103 Stellen, reiner Fan-out: **`CR-GC-492`**.
- Die Korpusgraphen für den Spike wirklich **einfrieren** (Kopie nach `rig/graphs/`). Dieser CR
  macht die Drift nur *sichtbar* (Stempel); das Einfrieren ist eine Datenentscheidung je Graph
  und braucht einen eigenen Vorgang.
- Rigs an einen automatischen Lauf hängen. Ein Messbefehl, der blockiert, wird umgangen.
