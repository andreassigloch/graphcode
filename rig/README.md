# rig/ — Messaufbauten

Ein Rig beantwortet **eine** Frage an einem echten Graphen. Es ist kein Test (der prüft eine
Zusage) und kein Skript (das etwas erledigt): es **misst**, und sein Ergebnis muss morgen noch
dasselbe bedeuten.

## Die eine Regel

**Ein Bootstrap: `openMeasured` aus `dist/index.js`.** Nie `new GraphCodeHarness(cfg, storage)` —
seit CR-GC-496 ohne Ausnahme, `grep` findet keinen mehr.

Der Konstruktor fällt bei fehlendem `opts.graphcodeConfig` **still** auf `DEFAULT_CONFIG` zurück
und bekommt den unparametrisierten `SE_DESCRIPTOR` statt `createSeDescriptor(policy)` — ein Rig,
das so baut, misst auf Startwerten statt auf den Urteilsschwellen des Repos. Bis CR-GC-491 taten
zwei von vier Aufbauten genau das. Folgenlos, solange die Budgets auf Default stehen;
**invertierend**, sobald eines wandert — und das Budget ist die Stellgröße (CR-GC-484 T-S3).

```js
import { openMeasured, stampLine } from '../../dist/index.js';

const m = await openMeasured({ graph: ABS_PFAD, systemId: 'moneyflow' });
console.log(stampLine(m.provenance));
try { /* m.harness, m.tools, m.graph(), m.policy */ } finally { await m.close(); }
```

`openMeasured` legt ein Wegwerf-Verzeichnis für den Store an, öffnet über `createHarness` und
löscht es beim `close()`. Das Quell-Repo wird **nur gelesen**.

Drei Formen, je nach Frage:

| Aufruf | Wurzel (Config + `realRef`-Auflösung) | Store |
|---|---|---|
| `openMeasured({ graph })` | Wegwerf-Repo, Config reist mit dem Graphen | Wegwerf |
| `openMeasured({ graph, repoRoot })` | **das echte Repo** (CR-GC-496) | Wegwerf |
| `openMeasured({ systemId })` | Wegwerf-Repo, leerer Start (Greenfield, CR-GC-493) | Wegwerf |

Die mittlere Form ist die, für die es sich lohnte: wer `realRef`/`missingRefs` gegen den echten
Quellbaum auflösen will, aber den Live-Store des Repos nicht anfassen darf
(`REQ-single-kuzu-owner`), fiel bis dahin aus `createHarness` heraus — und verlor still die
Config-Ladung und den policy-gebauten Descriptor.

## Zwei Klassen — und die Wahl ist Teil der Messung

| Klasse | Frage | Aufbau |
|---|---|---|
| **gate** | „was tut das System?" | `openMeasured`, echtes `harness.mutate()` — Verdict, `tier`, Advisories, Rollback |
| **korpus** | „wie rankt diese Funktion?" | **eingefrorener** Snapshot (`rig/graphs/`), reine Funktion, kein Store |

Eine Gate-Frage an einem Korpus-Aufbau ist der Fehler, nicht das Ergebnis — und umgekehrt.
Ein Benchmark, dessen Eingabe weiterläuft, misst nichts; deshalb sind die Graphen unter
[`graphs/`](graphs/README.md) eingefrorene Kopien und keine Zeiger auf `docs/graph/`.

## Ohne Stempel keine Zahl

`m.provenance` trägt Graph (Pfad, sha256, Umfang), Policy **mit Herkunft**
(`file` / `inline` / `default`), Regel- und Ontologie-Version und den Code-Stand. `stampLine()`
macht daraus die Kopfzeile jedes Berichts. Zwei Läufe, die sich unterscheiden, unterscheiden sich
dann **sichtbar** — statt als zwei Zahlen ohne Erklärung.

Beispiel aus `moneyflow-struktur`:

```
Stempel: graph e1d8a6cf3944 (1229/966) · policy default · rules 19.2.0 · code 6a94186+dirty
```

`policy default` ist hier die ehrliche Aussage: moneyflow hat keine `graphcode.config.jsonc`,
also gelten die Startwerte — vorher stand dieselbe Tatsache nirgends.

## Blindheitsausgang statt Rang

`discriminate(kandidaten, größe, { name })` gibt **keinen Rang** zurück, wenn die unterscheidende
Größe nicht streut, sondern `blind: true` mit Begründung. Der Regressionsfall ist CR-SM-291
Satz F: vier Kandidaten mit Δ0, und fünf Lesarten meldeten „bestanden" — der Rang kam aus dem
alphabetischen Tiebreak. **Eine Messung ohne Streuung hat kein Ergebnis, sondern eine Blindstelle.**

## Der Bestand

| Rig | Klasse | Frage | Aufbau |
|---|---|---|---|
| [`moneyflow-struktur/`](moneyflow-struktur/README.md) | gate | Wie sieht moneyflow durch das echte Gate aus? | `openMeasured` |
| [`minimal-whitebox/`](minimal-whitebox/README.md) | gate | Wie groß ist die Whitebox gegen den Blast-Radius? | `openMeasured` |
| [`greenfield-systemtest/`](greenfield-systemtest/README.md) | gate | Kommt ein lokales Modell an ein Frontier-Modell heran? | `createHarness` (Subprozess, Kuzu-Binding) |
| [`dummy-slicer/`](dummy-slicer/README.md) | gate | Serviert `graph_context` die Definition of Done? | `openMeasured` (echte Wurzel, CR-GC-496) |
| [`plan-step/`](plan-step/) | — | dito | — |
| [`graphs/`](graphs/README.md) | korpus | eingefrorene Beispielgraphen | — |

`greenfield-systemtest` baut den Harness in einem **eigenen Prozess**, weil Kuzus natives
Binding sonst zweimal im selben Prozess lädt. Es benutzt `createHarness` direkt und ist damit
korrekt — der Beleg, dass der Weg gangbar ist, noch bevor es `openMeasured` gab.

## Was ein Rig sonst still tut: nichts

`armB.mjs` importierte `dist/harness.js` und `dist/mcp-tools.js` — beides gibt es nach dem
dist-Umbau nicht mehr. Das Rig war **nicht lauffähig**, und niemand hat es gemerkt: ein Rig ohne
Lauf meldet sich nicht, es schweigt. `minimal-whitebox/measure.mjs` trug dieselben Importe und
wurde bei CR-GC-491 mit umgestellt.

Ein Rig, das nicht läuft, ist schlimmer als keins — es steht im Verzeichnis und suggeriert eine
Messung. **Wer ein Rig anfasst, führt es aus.**

## Offen

`scripts/spike-lexikographisch.mjs` liest die **lebenden** `docs/graph/*.graph.json` von vier
Repos. Seit `CR-GC-493` sagt der Stempel je Eingabegraph sha256 und `graphVersion`, die Drift ist
also sichtbar — das **Einfrieren** nach `graphs/` ist eine Datenentscheidung je Graph und steht
noch aus.
