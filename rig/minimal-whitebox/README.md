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

Die Executor-Arme (`run-phase1-authoring`, `run-armC*`, `run-pull-*`, `run-typediet`, `tally-toolcalls`) und
`results/` sind mit CR-GC-740 gefallen: ihr Eingang (`buildRoundInjection`, Executor-Runden) entsteht nicht
mehr; das Ergebnis steht in den RESULTS. Phase 1 wird `scripts/whitebox-messung.mjs` in `npm run messung`
(ITEM-2026-744, T-E2).

```bash
npm run build
node rig/minimal-whitebox/run-phase1.mjs
```

Die Arme C und `pull` (Executor-Runden mit und ohne Whitebox-Injektion, Präzisions-Trias im Tool-Angebot,
Verdrahtungs-Nachweis, Zählung aus dem Trace) sind mit ihrem Code gefallen; die Beschreibung steht in
[`docs/archive/messung-executor/minimal-whitebox-README.md`](../../docs/archive/messung-executor/minimal-whitebox-README.md),
die Zahlen in den RESULTS.
