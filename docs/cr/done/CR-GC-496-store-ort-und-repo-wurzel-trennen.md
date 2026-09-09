# CR-GC-496 — Der Store-Ort ist nicht die Repo-Wurzel

**Status:** erledigt 2026-09-09 · **Angelegt:** 2026-09-09 · **Ring:** 2 (Werkzeug)
**Hängt an:** `CR-GC-491` (`openMeasured`), `CR-GC-493` (Greenfield-Fall)
**Grundlage:** Lesung `src/surface/create-harness.ts`, `rig/dummy-slicer/scripts/armB.mjs`,
`tests/conformance.test.ts`, 2026-09-09

---

## 1. Root Cause

`createHarness` leitet den Store-Ort **aus** der Repo-Wurzel ab:

```ts
const kuzuPath = join(cfg.repoRoot, KUZU_DIR);   // create-harness.ts
```

Damit sind zwei Dinge aneinandergebunden, die es nicht sein müssen:

| | wofür `repoRoot` steht |
|---|---|
| **Urteilsquelle** | `graphcode.config.jsonc` — die Budgets, mit denen geurteilt wird |
| **Auflösungsbasis** | `realRef`/`testRefs` gegen den echten Quellbaum (RC-*, `graph_context.missingRefs`) |
| **Store-Ort** | wo Kuzu und `owner.lock` liegen |

Die ersten beiden gehören zusammen und zeigen auf ein **echtes** Repo. Der dritte ist eine
Betriebsentscheidung und muss in ein Wegwerf-Verzeichnis zeigen können, wenn ein Rig oder Test
den Live-Store des Repos nicht anfassen darf (`REQ-single-kuzu-owner`, CR-GC-218).

**Wer das heute braucht, baut von Hand.** Zwei Stellen, beide mit demselben Ausweg:

- `rig/dummy-slicer/scripts/armB.mjs:17` — `repoRoot: RIG`, Store unter `<tmp>/kuzu`. Der
  einzige verbliebene `new GraphCodeHarness` in `rig/`.
- `tests/conformance.test.ts:38` — `makeConfig(REPO_ROOT)` mit `{ lockDir: tmp }`; der Kommentar
  dort benennt den Grund wörtlich: *„lockDir = temp store dir, not repoRoot/.graphcode (a live
  dev server owns that, CR-GC-218)"*.

Der Konstruktor kann es (über `opts.lockDir`/`opts.storePath`), die **Composition Root** nicht —
und damit fällt jeder, der es braucht, aus `createHarness` heraus und verliert still die
Config-Ladung und den policy-gebauten Descriptor (`CR-GC-491` §1).

## 2. Impact

**Bricht heute nichts** — beide Stellen funktionieren, und die Budgets stehen auf Default.

**Bricht `CR-GC-492`.** Der Sweep will 103 Testdateien auf den einen Aufbau stellen. Ein
nennenswerter Teil davon braucht genau diese Kombination: **echte Repo-Wurzel für die
Auflösung, Wegwerf-Store für die Isolation.** Ohne diesen CR endet der Sweep entweder in einer
Ausnahmeliste — oder er verschiebt still die Auflösungsbasis von Testdateien nach `/tmp`, und
`missingRefs`/RC-Befunde ändern sich, ohne dass jemand es gewollt hat.

**Das ist die Nebenwirkung, gegen die diese CR-Familie angetreten ist**, deshalb steht dieser CR
**vor** `CR-GC-492` und nicht daneben.

## 3. Fix

1. **`createHarness(config, opts)` bekommt `opts.storeRoot`**, Vorgabe `config.repoRoot`.
   Store, `owner.lock` und Audit-Log ziehen gemeinsam dorthin — sie gehören zusammen
   (`getStoreDir`, CR-GC-449), und der Lock bewacht damit weiterhin den Store, den er meint
   (CR-GC-218).
2. **`openMeasured({ repoRoot })`** reicht es durch: Wurzel echt, Store im Wegwerf-Verzeichnis.
   Ohne `repoRoot` bleibt es wie heute (beides im Temp-Repo).
3. `armB.mjs` geht darauf — der letzte Handaufbau in `rig/` fällt.

**Ausdrücklich nicht:** `opts.lockDir`/`opts.storePath` am Konstruktor entfernen. Sie sind der
Mechanismus, `storeRoot` ist die Fassade davor — der Sweep in `CR-GC-492` braucht die Fassade,
die Adapter-Injektions-Tests weiter den Mechanismus.

### Dateien (6)

| # | Datei | Was |
|---|---|---|
| 1 | `src/surface/create-harness.ts` | `opts.storeRoot` |
| 2 | `src/surface/measured.ts` | `repoRoot` durchreichen, `importGraph` statt Kopie |
| 3 | `tests/rig-measured.test.ts` | s. AC |
| 4 | `rig/dummy-slicer/scripts/armB.mjs` | auf `openMeasured` |
| 5 | `rig/dummy-slicer/model/dummy-slicer.graph.json` | eine illegale Kante — s. §3.1 |
| 6 | `rig/README.md` | die Regel „ein Bootstrap" gilt ohne Ausnahme |

### 3.1 Zwei Funde, die erst der Lauf zeigte

**(a) `armB.mjs` war nicht lauffähig.** Die Importe zeigten auf `dist/harness.js` und
`dist/mcp-tools.js` — beides gibt es nach dem dist-Umbau nicht mehr. Das Rig brach beim ersten
Import ab. `minimal-whitebox/measure.mjs` trug dieselben toten Importe und wurde bei `CR-GC-491`
mit umgestellt, ohne dass es auffiel. **Zwei von sechs Rigs konnten nicht starten, und keins hat
es gemeldet:** ein Rig ohne Lauf schweigt, es meldet keinen Fehler.

**(b) Das Fixture verletzte das Meta-Modell.** Nach dem Reparieren der Importe brach der Seed am
Gate: `FN-slice -satisfy-> UC-structure-doc`. `satisfy` kennt nur `FUNC|FCHAIN|MOD|SYS -> REQ`;
die Kante zum UC gibt es nicht mehr. Migriert zur legalen Ausdrucksform derselben Aussage —
`UC-structure-doc -compose-> REQ` für die drei REQs, die `FN-slice` ohnehin `satisfy`-t. Danach
**`ARM B VERDICT: PASS`**, zum ersten Mal seit dem dist-Umbau.

Beides gehört sachlich nicht zu „Store-Ort trennen". Es steht hier, weil die AC unten sonst
nicht erfüllbar wäre: **ohne Lauf kein Nachweis.**

## 4. Akzeptanzkriterien

- [ ] **Rot zuerst:** ein Test öffnet über `openMeasured({ repoRoot: <echtes Repo> })` und
      erwartet `harness.getStoreDir()` im Temp-Verzeichnis **und** `policy.source === 'file'`
      aus dem echten Repo. Vor der Änderung nicht ausdrückbar.
- [ ] Store und `owner.lock` liegen im **selben** Verzeichnis (CR-GC-218) — mit Test.
- [ ] Der Live-Store des echten Repos wird nachweislich nicht angefasst: `.graphcode/kuzu` dort
      ist nach dem Lauf unverändert (mtime).
- [ ] `armB.mjs` **läuft** und meldet `PASS`. Ein Zeichenvergleich mit „vorher" ist nicht
      möglich — es war nicht lauffähig (§3.1a); der Nachweis für die Auflösungsbasis ist
      stattdessen `missingRefs: ["FN-slice"]`, das nur gegen den **echten** Rig-Quellbaum so
      ausfällt.
- [ ] `grep -rn "new GraphCodeHarness" rig/ scripts/` findet **nichts** mehr.

## 5. Nicht im Scope

- Die Testbasis — 103 Stellen: **`CR-GC-492`**, und der hängt an diesem hier.
- Das Einfrieren der Spike-Korpusgraphen (aus `CR-GC-493` §5 offen geblieben).
