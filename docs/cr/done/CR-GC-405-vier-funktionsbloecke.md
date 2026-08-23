# CR-GC-405 — Vier Funktionsblöcke für die 30 blocklosen FUNCs

**Status:** **UMGESETZT** (2026-08-23) · **Angelegt:** 2026-08-23 · **Betrifft:** nur den Graphen, kein Code
**Herkunft:** Messung des Funktions-Walks aus graph-view-edit (CR-GVE-243) am eigenen Graphen.
**Batch:** `CR-GC-405-batch.json` — 40 Operationen, angewendet als graphVersion 189 → **190**.

## 1. Problem

`compose FUNC→FUNC` bildet die funktionale Zerlegung — die Ebene, die einem Leser sagt, woraus
das System besteht, ohne ihm 103 Funktionen zu zeigen. Heute hängen **30 der 103 FUNCs an keinem
Block**; 24 davon sind operativ (in mindestens einer FCHAIN). Die Aussage „graphcode besteht aus
diesen Blöcken" stimmt damit nur zu **71 %**.

Maßstab für die Blockebene (Vorgabe des Auftraggebers): *welche 4–9 Funktionsblöcke muss man dem
CEO zeigen, damit er das Konzept versteht?* Sechs Blöcke gibt es, aber ein Viertel der arbeitenden
Funktionen steht daneben.

## 2. Lösung — vier neue Blöcke, eine Umhängung

| Block | id | FUNCs |
|---|---|---|
| **Betrieb** | `FUNC-block-betrieb` | CLI-Dispatch, executeRun, executeUpgrade, executeImportCode, collectStatus, liveSessions, attachGve, SessionLifecycle, startHostSocket (9) |
| **Speicherwerk** | `FUNC-block-speicherwerk` | StoreLock, initialize(), close(), loadGraph(), seedFromJson, applyReseed, bootstrap, createHarness, setExportPending, registerAutoExport (10) |
| **Werkzeug & Konfiguration** | `FUNC-block-ruestzeug` | loadGraphcodeConfig, loadTargetProfile, schemaFingerprint, bindToolsToHarness, createToolContext, listElements, **migrateSchema** (7) |
| **Antrieb** | `FUNC-block-antrieb` | runExecutor, buildRoundInjection, preflightBatch, extractMutateFromText, injectNDMatrices (5) |

**Die eine Umhängung:** `migrateSchema` wandert von *Gedächtnis* nach *Werkzeug & Konfiguration*.
Es gehört zu `schemaFingerprint` — der eine erkennt den Schema-Drift, der andere behebt ihn; die
beiden zu trennen war der Grund, warum keiner von beiden gut saß. Beide Seiten gewinnen messbar
(§3).

**Warum Config und Tools EIN Block sind** (Entscheid des Auftraggebers): beide beantworten
dieselbe Frage — was den Lauf einrichtet, bevor er losgeht. Getrennt wären es zwei Blöcke mit je
drei Mitgliedern, zu klein für die Blockebene. Für einen solchen Service-Block ist eine etwas
schwächere Kohäsion der bewusst eingegangene Kompromiss.

## 3. Wirkung — simuliert, nicht geschätzt

| | vorher | nachher |
|---|---|---|
| Top-Blöcke | 6 | **10** |
| Deckung operativer FUNCs | 71 % | **100 %** |
| FUNCs ohne Block | 30 | **0** |

LCOM4 je Block (Zusammenhangskomponenten über gemeinsame FLOWs; 1 = eine zusammenhängende Sache):

| Block | LCOM4 |
|---|---|
| Qualitäts-Gate · Messwerk | 1 |
| **Betrieb · Speicherwerk · Werkzeug & Konfiguration · Antrieb** (neu) | **2** |
| Autopilot · Viewer | 2 |
| **Gedächtnis** | **5 → 4** (durch die Umhängung) |
| Agenten-Anschluss | 5 |

**Alle vier neuen Blöcke liegen bei 2** — besser als jedes Modul im Graphen und besser als vier
der sechs bestehenden Blöcke.

## 4. Anwenden

Der Batch liegt als `CR-GC-405-batch.json` daneben: 4 `add-node`, 1 `remove-edge`, 35 `add-edge`
(31 `compose` + 4 `allocate`, siehe §4a).
Er ist gegen den Graphen validiert (kein Block existiert schon, kein FUNC doppelt zugeordnet, kein
FUNC hat bereits einen FUNC-Parent ausser der einen Umhängung) und die Wirkung in §3 ist auf einer
Kopie simuliert.

**Durchs Gate angewendet** (`graph_mutate` + `graph_export`), kein Direktschreiben in
`docs/graph/graphcode.graph.json`. Gate-Verdict: `success`, `tier: auto-apply`, **0 Violations**.

### 4a. Korrektur am CR: es war R-22, nicht R-20 — vier `allocate`-Kanten fehlten

Der Dry-Run hat nicht R-20 (realRef) gemeldet, sondern **R-22 ×4** — „FUNC ist keinem Modul
zugeordnet". Der Batch war insofern unvollständig: **alle zehn bestehenden Blöcke tragen eine
`allocate`-Kante auf eine MOD**; die vier neuen hatten keine. Ohne sie fiel die alloc-Dimension
0.936 → 0.914.

Drei Varianten gemessen (Dry-Run auf einem frisch aus dem SSOT geseedeten Store):

| Variante | neue Violations | Tier |
|---|---|---|
| A — fachlich nächste MOD (`MOD-cli`/`MOD-harness`/`MOD-executor`) | 6 (R-04, RD-04, MT-02 auf cli+harness) | suggest |
| **B — alle vier auf `MOD-repo-root`** | **0** | **auto-apply** |
| C — ohne `allocate` (Batch wie geliefert) | 4 (R-22) | suggest |

Variante A kippt `MOD-cli` und `MOD-harness` über die Fan-out-Schwellen (11→12 bzw. 14→15 FUNCs).
Gewählt: **B** — die Variante, die §6 dieses CRs ohnehin vorwegnimmt („nach diesem CR hängen die
neuen Blöcke ebenfalls dort") und die genau dem folgt, was fünf der bestehenden Blöcke tun.
alloc bleibt bei 0.936.

### 4b. Wirkung — nachgemessen am exportierten SSOT

| | vorher | Vorhersage §3 | gemessen |
|---|---|---|---|
| Top-Blöcke | 6 | 10 | **10** |
| FUNCs ohne Block | 30 | 0 | **0** |

`rules_evaluate` nach dem Export: keine Error-Violations, und **keine** der 4 neuen Blockwurzeln
taucht in einer Violation auf. `npm test`: 905/905 grün, 115 Dateien.

### 4c. Laufzeit des Apply-Gates — gemessen, nicht geschätzt

Gemessen mit `performance.now()` um `harness.mutate()`, identischer Gate-Pfad wie MCP, auf einem
frisch aus dem committeten SSOT geseedeten Disk-Kuzu-Store (659 Knoten / 1717 Kanten), damit die
Messung den Live-Store nicht anfasst.

| Schritt | ms |
|---|---:|
| `initialize()` (leerer Store, DDL) | 161 |
| `seedFromJson()` (SSOT laden) | 1740 |
| **`mutate()` dryRun, 40 Ops** | **146** |
| **`mutate()` apply, 40 Ops (Gate + Persist)** | **169** |
| davon: 4× `add-node` | 117 |
| davon: 1× `delete-edge` | 118 |
| davon: 35× `add-edge` | 142 |
| 1× `add-edge` einzeln | 116 |

Der Befund: **die Batch-Grösse ist fast gratis.** Eine einzelne Kante kostet 116 ms, vierzig
Operationen 169 ms — also ~115 ms Fixkosten pro Gate-Durchlauf (Regel-Auswertung über den ganzen
Graphen, Steering-Snapshot, fitAdvisory) und **~1,4 ms je zusätzlicher Operation**. 40 Ops einzeln
durchs Gate zu schicken würde ~4,6 s kosten statt 0,17 s — Faktor 27. Persistieren kostet 23 ms
mehr als der Dry-Run.

## 5. Abgeschlossen

- [x] 40-Op-Batch durchs Gate angewendet — `auto-apply`, 0 Violations, graphVersion 190
- [x] `graph_export` — SSOT + 15 Views neu geschrieben (663 Knoten, 1751 Kanten)
- [x] Wirkung am exportierten SSOT nachgemessen: 10 Top-Blöcke, 0 blocklose FUNCs
- [x] `rules_evaluate`: keine Error-Violations, keine auf den neuen Blöcken
- [x] `npm test` 905/905 grün, `npm run verify:model` 287/287 grün
- [x] Kein Code geändert

## 6. Was dieser CR NICHT tut

- **Agenten-Anschluss (LCOM4 5) auftrennen.** Fünf unverbundene Teile unter einem Namen — das
  bricht dasselbe CEO-Kriterium, ist aber semantische Arbeit an bestehenden Blöcken und ein
  eigener CR.
- **`MOD-repo-root` auflösen.** Sie trägt 12 Sub-MODs und bisher die 5 Blockwurzeln; nach diesem
  CR hängen die neuen Blöcke ebenfalls dort. Ob das bleibt, ist eine eigene Frage.
- **Die vier elternlosen MODs** (`completeness`, `conformance`, `element-slice`,
  `schema-migration`) an SYS oder repo-root hängen. Von graph-view-edit sichtbar gemacht
  (CR-GVE-243 §4), hier nicht angefasst.
