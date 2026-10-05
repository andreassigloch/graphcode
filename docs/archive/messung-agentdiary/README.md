# rig/agentdiary — AgentDiary, Frontier gegen lokal (T-E3, T-E10)

Ein echter Auftrag statt eines Laborkorpus: ein täglicher Arbeitsbericht als Agent in der
sigllm-Umgebung. Zwei Arme, gleicher Eröffnungsprompt, gleiche graphcode-Version:

| Arm | Repo | Kette | Modell |
|---|---|---|---|
| `frontier-1` | `~/Developer/dev/agentdiary-frontier` | A — Claude Code direkt an graphcode | Opus 5.5 |
| `local-<n>` | `~/Developer/dev/agentdiary-local` | D2 — OpenCode → `graph_delegate` → Executor im Host | qwen3-coder-30b über sigllm |

Gewollt verschieden: Modell **und** Treiber (Produktvergleich, Leitlinie §9.4). Gewollt verschieden
außerdem: im lokalen Arm liegen die Spike-Messdaten von Anfang an unter `material/`; der
Frontier-Arm bekam sie erst im Verlauf.

## Bestand

| Datei | Rolle |
|---|---|
| `material/auftrag.md` | Eröffnungsprompt, wörtlich — Eingabe beider Arme |
| `material/spike-notes-automation.md` | Spike-Rohdaten (Notes per Automation), ohne Auswertung |
| `golden/auftrag-gutachter.md` | **Kern**: Eröffnung + Aussagen, die der Nutzer von sich aus machte — gleich für jeden Arm |
| `golden/auftragspunkte.json` | Kern-Raster T-E10 (14 P + 5 O) |
| `golden/arme/<arm>/` | Arm-Raster = Kern + **Zustimmungen** dieses Arms (Frage des Modells → Antwort des Nutzers). Zustimmungen sind Vorgabe, unterscheiden sich aber je Arm — der Gutachter eines Arms bekommt dessen Arm-Raster |
| `golden/frontier-v73.graph.json` | eingefrorener Frontier-Graph (sha256 `cf84e271927d…`) — Referenz für T-V5 des lokalen Arms |
| `runs/<arm>/graph.json` | Endstand je Lauf, Eingabe für `blindurteil.mjs` |
| `blind-<runde>/` | Specs, Zuordnung, Gutachten je Blindurteil-Runde |
| `auswertung-frontier.md` | Standard-Auswertung des Frontier-Arms |
| `auswertung-local.md` | Standard-Auswertung des lokalen Arms (`local-1`) |
| `messung-executor-fmea.md` | FMEA über den Executor: qwen3-coder gegen qwen3.8 medium (je ein Lauf) |
| `auswertung-local-2.md` | Standard-Auswertung `local-2` (lief auf Registry-0.27.0 statt Dev-Build; Daten in `runs/local-2/`) |

Die Sitzungsanalyse des Frontier-Arms (Token, Kosten, Graph gegen Grep, Drehbuch für den lokalen
Lauf) liegt im Arm-Repo: `agentdiary-frontier/docs/records/sitzungsanalyse-2026-09-29.md`.

## Blindurteil

```bash
# je Arm mit dessen Arm-Raster (Kern + Zustimmungen)
node rig/greenfield-systemtest/blindurteil.mjs vorbereiten rig/agentdiary/blind-<runde>-<arm> rig/agentdiary/runs/<arm> \
  --raster=rig/agentdiary/golden/arme/<arm>/auftragspunkte.json --auftrag=rig/agentdiary/golden/arme/<arm>/auftrag-gutachter.md
# je Spec ein Gutachter (Subagent) mit gutachter-<K>.txt, keiner sieht eine zweite Spec
node rig/greenfield-systemtest/blindurteil.mjs auswerten rig/agentdiary/blind-<runde>
```

Nach einem lokalen Lauf: dessen Zustimmungen aus dem Dialog nach `golden/arme/local-<n>/` ziehen (Kern
bleibt), dann blind beurteilen. Vergleichbar über alle Arme sind die Kernpunkte; die PZ-Punkte messen,
ob der Arm umsetzt, was der Nutzer ihm bestätigt hat.
