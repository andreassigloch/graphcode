# CR-GC-682: Executor-Inventar als Mess-Schalter: Befund-Kontext, voller ID-Index, Compose-Faltung

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-599 (idea)
**Erstellt:** 2026-09-26
**Item:** bok/items/ITEM-2026-599.json (Lane: code)

---

## Befund

Nachspiel `SPIKE-GC-compose-faltung` über die aufgezeichneten Rig-Läufe (846 Mutationen, deren Saat
ein Gate-Befund war): der heutige Inventar-Kanal — der Kontext des Funds aus CR-GC-652 — zeigt in
**53 %** der Mutationen einen Knoten **nicht**, den die Mutation dann anfasst. Das Modell muss ihn
nachlesen; das kostet Runden. Er ist dafür winzig (1 % des vollen Graphen).

| Sicht | Ziel nicht sichtbar | Größe / voller Graph |
|---|---|---|
| Befund-Kontext (heute) | 53 % | 1 % |
| voller Identitätsindex (uid · type · name) | 0 % | 24 % |
| Compose-Faltung + uid-Index | 0 % | 26 % |

CR-GC-652 hatte die Liste auf den Befund-Kontext geschnitten, als 8 000 Zeichen Kappe und ein
32k-Fenster die Grenze waren. Seit CR-SL-091 fährt die lokale Runtime 64k.

## Zielbild

Der Zuschnitt ist ein **Mess-Schalter** wie `injection` (CR-GC-293), kein neuer Betriebsmodus:
`ExecutorConfig.inventory: 'fund' | 'index' | 'faltung'`, Default `fund`, per
`GRAPHCODE_LLM_INVENTORY` und im Rig per `GCRUN_INVENTORY` gesetzt. Welcher Zuschnitt Default wird,
entscheidet der Lauf, nicht dieser CR.

## Umfang

| Datei | Änderung |
|---|---|
| `src/loop/faltung.ts` (neu) | Baum aus `compose` + Eigner, Faltung um eine Saat, uid-Index — rein |
| `src/loop/executor-inventory.ts` | `InventarModus`; `index` = voller Identitätsindex, `faltung` = gefaltete Sicht |
| `src/loop/executor-prompt.ts` | Modus durch `buildRoundInjection` / `buildRoundChannels` gereicht (optional, Default `fund`) |
| `src/loop/executor.ts` | `ExecutorConfigSchema.inventory` |
| `src/surface/run-verb.ts` | `GRAPHCODE_LLM_INVENTORY` |
| `rig/greenfield-systemtest/run.mjs` | `GCRUN_INVENTORY` an den Executor |
| `rig/greenfield-systemtest/faltung.mjs` | Nachspiel importiert die Faltung aus `dist/` — keine zweite Kopie |
| `tests/faltung.test.ts` (neu) | Baum, Eigner, Faltung, Zyklus, unbekannte Saat |
| `tests/executor-inventory.modes.test.ts` (neu) | drei Zuschnitte gegen einen Disk-Store; Schalter wirkt bis in den Prompt |
| `tests/executor-config-contract.test.ts` | Default `fund` |

## Modell-Zug (graphVersion 494)

`FUNC-compose-faltung` (realRef `faltung` in `src/loop/faltung.ts`) unter `FCHAIN-steering-loop`,
allocate `MOD-loop`, Eingang `FLOW-round-prompt`. `REQ-inventory-switch` (functional) unter
`UC-reduced-llm`, erfüllt von `FUNC-inventory-channel` und `FUNC-compose-faltung`, verifiziert von
`TEST-inventory-modes`. **Bewusst offen:** R-31 (kein Ausgangs-FLOW) an `FUNC-compose-faltung` — sie
ist wie `FUNC-fund-kontext` ein reiner Zulieferer des Inventar-Kanals; ein zweiter Erzeuger an
`FLOW-channel-inventory` verletzt IO-02, ein eigener FLOW samt SCHEMA für eine interne Hilfsfunktion
wäre Modell ohne Aussage.

## Kriterien

1. Build grün, Testspur grün (`verify:code`: 21 Dateien, 256 Tests) — ✅
2. Nachspiel mit dem Produktmodul liefert dieselben Zahlen wie mit der Spike-Kopie — ✅
3. Echter Lauf: drei Arme je 3× (qwen3-coder über sigllm, Korpus `sigllm-gcrun`, 40 Runden),
   verglichen an Elementen, Gate-Ablehnungen, Lese-Turns und Tokens — ✅ (Ergebnis unten)
4. Volle Suite vor dem Schließen — ✅ 186 Dateien, 1 643 Tests

## Ergebnis (2026-09-26, Läufe `gcrun-300..302` · `-310..312` · `-320..322`)

Median über je 3 Läufe; in Klammern die Spanne. Ergebnisdateien
`rig/greenfield-systemtest/results-cr682-{fund,index,faltung}.json`.

| Zuschnitt | Elemente | davon REQ | Ablehnungen | Lese-Aufrufe | Modell-Turns | Tokens ein |
|---|---|---|---|---|---|---|
| fund (heute) | 112 (109–133) | 23 | 11 (3–21) | 1 259 (494–1 281) | 148 | 0,98 M |
| **index** | **126 (89–193)** | **31** | **6 (4–11)** | **861 (791–999)** | 138 | 0,99 M |
| faltung | 83 (64–97) | 22 | 8 (3–9) | 1 614 (1 325–1 664) | 124 | 0,85 M |

- **Index schlägt den Befund-Kontext** in allen drei Zählern, bei gleichen Tokens: mehr Elemente,
  halb so viele Ablehnungen, ein Drittel weniger Lese-Aufrufe.
- **Die Faltung verliert** — und zwar genau an der Grenze, die das Nachspiel benannt hatte: eine
  nackte uid im Index reicht dem Modell nicht, es schlägt sie nach (meiste Lese-Aufrufe, wenigste
  Elemente). Der Index mit `type · name` trägt, weil er das Nachschlagen erspart.
- Die Readiness-Dimensionen liegen in allen Armen bei ~0,85–0,95 und trennen nicht; über die
  Qualität der Spec sagt dieser Lauf nichts (Runde 20: Readiness ist kein Qualitätsmaß).
- **Grenzen:** n = 3 je Arm bei großer Streuung (index 89–193). Ab 20:49 lief parallel eine fremde
  Rig-Serie (`gcrun-30..32`) auf derselben GPU — Laufzeiten deshalb nicht verglichen.

**Empfehlung (Entscheidung beim Auftraggeber):** `index` als Default für den lokalen Executor, als
eigener CR — dieser CR liefert den Schalter und die Messung, er stellt keinen Default um.
