# Rig: Minimal-Whitebox

Messaufbau zu [`docs/spikes/SPIKE-GC-minimal-whitebox.md`](../../docs/spikes/SPIKE-GC-minimal-whitebox.md).
Ergebnisse: [`SPIKE-GC-minimal-whitebox-RESULTS.md`](../../docs/spikes/SPIKE-GC-minimal-whitebox-RESULTS.md).

Nichts hier baut Graph-Logik nach: jede Zahl kommt aus den gebundenen MCP-Tools
(`graph_impact`, `graph_context`, `graph_generate`) bzw. aus `buildRoundInjection` — importiert
aus `dist/`, nicht kopiert. Jede Fixture bekommt ein **Wegwerf-Repo im Temp-Verzeichnis**
(Store *und* Owner-Lock); der Live-Store des Repos wird nie angefasst.

| Datei | Zweck |
|---|---|
| `measure.mjs` | Kern: `B` (Blast), `W` (Spec-Closure), Ring, Slice-Artefakt mit Rollenspalte |
| `jobs.mjs` | Job-Set §6 — Seeds aus dem offenen CR, Ground Truth aus dem git-Diff des Schluss-Commits |
| `run-phase1.mjs` | Arme A0/A/B, Implementier-Jobs (kein LLM) |
| `run-phase1-authoring.mjs` | H4, Autorier-Loop gegen den echten `graph_generate`-Schritt |
| `run-armC.mjs` | Arm C: eine Executor-Runde mit `W` statt `graph_elements({})` |
| `run-armC-ab.sh` | Arm C als A/B/C (`full` / `whitebox` / `off`) auf **einem** Modell |
| `run-armC-pull.mjs` | Arm **pull**: keine Injektion **+** Präzisions-Trias im Tool-Angebot |
| `tally-toolcalls.mjs` | Modell-Tool-Calls aus den `*.run.log` auszählen (Trace = exakte Quelle) |

```bash
npm run build
node rig/minimal-whitebox/run-phase1.mjs
node rig/minimal-whitebox/run-phase1-authoring.mjs
LMSTUDIO=http://localhost:1234 ./rig/minimal-whitebox/run-armC-ab.sh   # braucht ein lokales Modell
```

Arm C verändert den Executor **nicht**: der Rig wrappt das Registry, das
`buildRoundInjection` liest. Ein Einmal-Fenster je Runde trennt den Injektions-Aufruf von
`graph_elements`-Aufrufen des Modells; letztere werden gezählt (`modelUnfilteredCalls`),
nie ersetzt — sonst wäre die Messung konfundiert.

## Arm `pull` — gibt man dem Modell den präzisen Pfad, nimmt es ihn?

**Was der Arm variiert.** Bedingung = der `off`-Arm (`injection=false`) **plus**
`graph_context` / `graph_impact` / `graph_expand` im Tool-Angebot. Alles andere ist identisch
zu den Armen aus `run-armC.mjs`: gleicher Intent, `maxRounds` 12, `candidates` 3,
`maxTokens` 8192, `temperature` 0.15, `judge` `gate`, `toolset` `authoring`.

```bash
# Verdrahtungs-Nachweis, KEIN Modell, ~5 s
ARM_PULL_STUB=1 ARM_C_ROUNDS=3 ARM_C_N=2 ARM_C_TAG=armC-pull-stub \
  node rig/minimal-whitebox/run-armC-pull.mjs

# echter Lauf (Modell muss in LM Studio geladen sein)
LMSTUDIO=http://localhost:1234 ARM_C_MODEL=mistralai/devstral-small-2-2512 \
ARM_C_ROUNDS=12 ARM_C_N=3 ARM_C_MAX_TOKENS=8192 ARM_C_EFFORT=low ARM_C_TIMEOUT=900000 \
ARM_C_TAG=armC-pull node rig/minimal-whitebox/run-armC-pull.mjs
```

**Wie das Tool-Angebot beschnitten wird.** `buildToolSpecs(registry, toolset)` filtert bei
`toolset:'authoring'` gegen das exportierte Set `AUTHORING_TOOLS` (`src/executor-prompt.ts`).
Der Rig **erweitert dieses Set zur Laufzeit** um die drei Präzisions-Tools; `src/` bleibt
unangetastet, das Registry bleibt **vollständig**. Das ist nötig, weil der Executor selbst
Registry-Tools ruft (`grep 'registry\[' src/executor.ts`):

| Tool | wer ruft es |
|---|---|
| `graph_generate` | Executor, je Runde (steht in `WITHHELD_TOOLS`, dem Modell nie angeboten) |
| `graph_elements({limit:100000})` | Executor, `loadGraphSnapshot` je `runMutate` |
| `graph_get_edges({edgeType:'verify'})` | Executor, `loadGraphSnapshot` je `runMutate` |
| `graph_mutate` | Executor, Gate-Call (dryRun je Kandidat + Gewinner-Apply) |
| `graph_authoring_guide` | nur `buildRoundInjection` — hier `injection=false`, also nie |

Der naheliegende Weg „geprunetes Registry + `toolset:'full'`" wäre deshalb **unschärfer**:
`graph_get_edges` muss im Registry bleiben und wäre dem Modell bei `full` zusätzlich
angeboten — ein zweiter Unterschied zum `off`-Arm. Über `AUTHORING_TOOLS` ist die Delta-Menge
exakt `+3`.

**Was das Modell am Ende sieht** (aus `buildToolSpecs`, im Ergebnis als `offeredTools`
festgehalten): `graphcode_graph_mutate`, `graphcode_graph_authoring_guide`,
`graphcode_graph_get_node`, `graphcode_graph_elements`, `graphcode_graph_readiness`,
`graphcode_graph_context`, `graphcode_graph_impact`, `graphcode_graph_expand` — dazu die drei
unveränderten Datei-Tools `list_dir`, `read_file`, `grep`. Also **11 statt 8** Tools.

**Bekannter Confound (CR-GC-282/v5):** ein anderes Tool-Angebot ist auch ein anderer
Prompt-Umfang. Drei zusätzliche Tool-Schemata liegen bei **jedem** Call im Kontext und kosten
Prompt-Eval; der v5-Befund war, dass 20 Schemata die lokale Box über 300 s TTFB trieben. Ein
Unterschied zwischen `off` und `pull` ist deshalb nicht sauber „das Modell nutzt die Trias"
zuzuordnen — er kann auch aus der größeren Grundlast kommen. Der Rig kann das nicht auflösen,
er hält es nur fest.

**Verdrahtungs-Nachweis (`ARM_PULL_STUB=1`).** Ersetzt `callModel` durch einen
deterministischen Stub (Turn 1 = `graph_context`, Turn 2 = `graph_mutate`) und prüft acht
Zusicherungen: Tool-Liste ans Backend == `AUTHORING_TOOLS` ∪ Trias · Trias im Angebot ·
`graph_generate`/`graph_next_step` withheld · Backend bekam genau diese Liste · **kein**
Injektions-Block im Runden-Prompt · `buildRoundInjection` lief nicht · der Trias-Call des
Modells wurde tatsächlich ausgeführt · Lauf terminiert mit angewandten Mutationen. Ergebnis:
`results/<tag>.wiring.json`, Exit-Code 1 bei jedem Fehlschlag.

**Zählung.** Modell-Tool-Calls kommen aus dem `trace` (der Executor protokolliert jeden Turn
als `cand n/m.t: name,name`), nicht aus einer Signatur-Heuristik. `tally-toolcalls.mjs`
rekonstruiert dasselbe nachträglich aus den `*.run.log` bereits gefahrener Arme.

> Der ältere Zähler `modelUnfilteredCalls` aus `run-armC.mjs` ist **nicht trennscharf**: er
> sitzt am Registry-Handler und zählt deshalb die Preflight-Snapshots
> (`graph_elements({limit:100000})` je `runMutate`) und im Modus `full` den Injektions-Aufruf
> selbst mit. Aus dem Trace: `full` = **0** Modell-Aufrufe von `graph_elements` (Zähler sagt
> 39), `whitebox` = **1** (Zähler 28), `off` = **70** (Zähler 30).
