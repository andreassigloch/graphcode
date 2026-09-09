# CR-GC-492 — Default-Budgets dort, wo wirklich geurteilt wird

**Status:** erledigt · **Angelegt:** 2026-09-09 · **Geschlossen:** 2026-09-09 · **Ring:** 2 (Werkzeug)
**Hängt an:** `CR-GC-496` (`openMeasured({ repoRoot })` — echte Wurzel, Wegwerf-Store)
**Grundlage:** Nachmessung über `tests/`, `packages/graph-api-core/src/kuzu/*`, 2026-09-09

---

## 0. Korrektur — die erste Fassung war ein 106-Dateien-Sweep gegen einen Nicht-Defekt

Die erste Fassung behauptete: *„103 von 103 Store-Konstruktionen übergeben den
unparametrisierten `SE_DESCRIPTOR`. Der Tag, an dem eine Schwelle wandert, ist der Tag, an dem
103 Tests etwas anderes prüfen als die Produktion — grün, und falsch."*

**Die Zahl stimmt (heute 106/106), die Folgerung nicht.** Nachgemessen:

| | |
|---|---|
| `createSeDescriptor(policy)` vs. `SE_DESCRIPTOR` | unterscheiden sich **nur** in `rules: seRules(policy)` — `nodeTypes`, `edgeTypes`, `patterns`, `version` sind identisch |
| Was `KuzuAdapter` mit dem Descriptor tut | `engine.init(ontology)` → `generateSchema(...)` → **DDL**. `grep '\.rules'` im ganzen `kuzu/`-Verzeichnis: **kein Treffer** |
| Wer die Regeln registriert | der Harness selbst, aus **seinem** `createSeDescriptor(this.metricPolicy)` |

`create-harness.ts:58` sagt es wörtlich: *„die Policy ändert nur die MT-Urteile, das DDL bleibt
davon unberührt."* **Der Descriptor am Store urteilt nicht.** 106/106 ist eine wahre Zahl über
eine harmlose Sache — und ein Sweep darüber hätte 106 Dateien angefasst, ohne ein einziges
Verhalten zu ändern.

## 1. Root Cause — der Defekt sitzt woanders und ist klein

Was wirklich still passiert: `new GraphCodeHarness(cfg, storage)` ohne `opts.graphcodeConfig`
fällt auf `DEFAULT_CONFIG` zurück (`harness.ts:142`). **Für ein Wegwerf-Repo ist das die richtige
Antwort** — dort liegt keine Config, `createHarness` läse dieselben Startwerte.

Es beißt genau dort, wo die Wurzel ein **echtes** Repo mit Config ist. Gezählt:

| Merkmal | Dateien |
|---|---|
| Testdateien gesamt | 133 |
| mit `new GraphCodeHarness` | 89 |
| davon mit **echter** Repo-Wurzel (`join(__dirname,'..')` / `process.cwd()`) | 20 |
| davon, die auch **urteilen** (Readiness, `evaluateAll`, Metriken, Advisories) | **4** |

```
tests/conformance.test.ts
tests/readiness.model.test.ts
tests/evaluation.reconciliation.test.ts
tests/readiness.ontology-sync.test.ts
```

Die übrigen 16 benutzen die echte Wurzel nur für Dateizugriff — Export, Import, Reseed,
Schema-Guard. Die Policy geht in keine ihrer Zusicherungen ein.

**Aus 106 werden 4.** Nicht durch Nachlassen, sondern weil die erste Zählung das falsche Merkmal
zählte.

## 2. Impact

**Heute null.** `graphcode.config.jsonc` ist zeichengleich mit `DEFAULT_METRIC_POLICY`
(`CR-GC-491` §2) — die vier Tests messen dieselben Zahlen, die `createHarness` ihnen gäbe.

**Es beißt, sobald ein Budget wandert.** `CR-SM-303` will `boundaryWidth` senken, `CR-GC-484`
T-S3 hat das Budget als **die** Stellgröße nachgewiesen. An dem Tag urteilen diese vier Tests
über das graphcode-Selbstmodell mit Startwerten statt mit der Config des Repos — grün, und über
etwas anderes als die Produktion. Vier Fake-Coverage-Stellen, alle an der Readiness-Fläche.

**Alle vier reichen zusätzlich `lockDir` durch** — sie sind exakt der Fall „echte Wurzel,
Wegwerf-Store", den `CR-GC-496` in `openMeasured` verfügbar gemacht hat. Sie sind der Grund,
warum es diesen Fall gibt.

## 3. Fix

1. Die vier auf **`openMeasured({ repoRoot, graph? })`** — Config und `realRef`-Auflösung am
   echten Repo, Store im Wegwerf-Verzeichnis, wie bisher.
2. **Ein Wächter statt einer Erinnerung:** ein Test scannt `tests/` nach der Kombination
   *`new GraphCodeHarness` + echte Repo-Wurzel + urteilende Fläche* und schlägt fehl, sobald
   eine dazukommt. Ohne ihn ist der Fix in vier Wochen zur Hälfte zurückgedreht.
3. **Die 16 nicht-urteilenden bleiben, wie sie sind.** Sie umzustellen wäre Kosmetik mit
   Regressionsrisiko — und `new GraphCodeHarness` bleibt für Adapter-Injektion ausdrücklich
   erlaubt (`harness.ts:116`).

### Dateien (6)

| # | Datei |
|---|---|
| 1 | `tests/no-default-policy-when-judging.test.ts` (neu) — der Wächter |
| 2 | `tests/conformance.test.ts` |
| 3 | `tests/readiness.model.test.ts` |
| 4 | `tests/evaluation.reconciliation.test.ts` |
| 5 | `tests/readiness.ontology-sync.test.ts` |
| 6 | `scripts/model-test-set.mjs` — Registrierung von (1) |

## 4. Akzeptanzkriterien

- [x] **Rot zuerst:** der Wächter nennt vor der Umstellung die betroffenen Dateien — die vier
      aus §1 plus einen fünften, den meine Handzählung nicht hatte (§6).
- [x] Nach der Umstellung ist seine Liste leer (der eine echte Rest steht benannt in `OFFEN`).
- [x] Jeder der vier Tests liest `policy.source === 'file'` — der Nachweis, dass die Config des
      Repos wirklich ankommt, nicht nur dass es kompiliert.
- [x] `npm test` grün **und die Anzahl ausgeführter Tests unverändert** — eine Umstellung, die
      Tests verschwinden lässt, hat sie nicht umgestellt. Gemessen: 134 Dateien / **1075** Tests,
      alle grün. Kein Test verschwunden — die vier umgestellten Dateien behalten jede ihre Zahl
      (`conformance` 16, `readiness.model` 22, `evaluation.reconciliation` 10,
      `readiness.ontology-sync` 4) und tragen je **eine** Provenance-Assertion dazu; die 5 des
      Wächters kommen neu hinzu. 1069 → 1075.
- [x] Der Live-Store des Repos bleibt unangetastet: `.graphcode/kuzu` mtime **Sep 8 16:59**,
      vor jedem Lauf dieses CR.

## 5. Nicht im Scope

- Die 106 `SE_DESCRIPTOR`-Übergaben: **kein Defekt** (§0). Wer sie vereinheitlichen will,
  braucht dafür ein anderes Argument als Korrektheit.
- Die 16 nicht-urteilenden Tests mit echter Wurzel.

---

## 6. Nachschrift — der Wächter fand acht, davon waren drei Fehlalarme

§1 zählte über `lockDir` und kam auf vier. Die erste Fassung des Wächters kam auf **acht** — und
war damit **zu weit**, nicht genauer. Sie prüfte `join(__dirname,'..')` *irgendwo im Dateitext*;
drei der vier zusätzlichen Treffer benutzen diesen Ausdruck aber nur, um eine Datei zu **lesen**:

| Datei | tatsächliche `repoRoot` der Harness | Urteil |
|---|---|---|
| `claims.conformance.test.ts` | `tmp` | Fehlalarm |
| `perf.advisory-roundtrip.spike.test.ts` | `makeConfig(tmp)` | Fehlalarm |
| `steering.convergence-witness.spike.test.ts` | `makeConfig(tmp)` | Fehlalarm |
| `readiness-conformance-skip.test.ts` | `join(__dirname, '..')` (Zeile 98) | **echter Treffer** |

Aufgefallen ist das erst beim Schreiben der Folge-CR: wer die vier Dateien einzeln aufmacht,
sieht, dass drei längst im Wegwerf-Verzeichnis wurzeln. Ein Wächter, der drei von vier falsch
anschuldigt, wird nach zwei Wochen ignoriert — das ist schlimmer als keiner.

**Der Melder prüft jetzt die Position, nicht die Anwesenheit** (`zeigtAufEchtesRepo`): der
Ausdruck muss als `repoRoot` einer Config ankommen — direkt, über eine Konstante, oder als
einziges Argument einer lokalen Funktion, die eine Config baut. `join(REPO_ROOT, 'docs/…')`
zählt nicht.

Und weil eine Verschärfung einen Melder **stumm** machen kann — leere Liste, grüner Lauf, keine
Aussage —, hält ein eigener Test beide Richtungen fest: drei Positiv-, zwei Negativfälle, plus
der Nachweis, dass jeder `OFFEN`-Eintrag wirklich noch getroffen wird.

`readiness-conformance-skip.test.ts` ist **meine eigene Datei aus CR-GC-489** — in dem CR, der
diesen Defekt beheben soll, habe ich eine neue Instanz davon erzeugt. Genau dafür ist der
Wächter da: eine Erinnerung hätte das nicht gefangen.

Der Wächter trägt **zwei getrennte Listen**, nicht eine Allowlist:

| Liste | Bedeutung | Prüfung |
|---|---|---|
| `ERLAUBT` | bewusste, dauerhafte Ausnahme | Begründung > 40 Zeichen, Datei existiert |
| `OFFEN` | noch nicht umgestellt | nennt eine `CR-GC-\d+`, Datei existiert, **wird noch getroffen** |

Zusätzlich: `ERLAUBT ∩ OFFEN = ∅`. Ein Feld für beides wäre in vier Wochen nicht mehr
unterscheidbar — *entschieden* sähe aus wie *liegengeblieben*. Das ist der Zustand, in dem
CR-SM-300 elf tote Regel-IDs gefunden hat.

`OFFEN` hat damit **einen** Eintrag statt vier; er geht an **`CR-GC-497`**.
