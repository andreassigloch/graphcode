# Plan: Sprung für den lokalen Arm (nach `local-1`)

Stand 2026-09-30. Grundlage: `auswertung-local.md`, Transcript `ses_f0ce46d4…`, Runde 20
(`rig/greenfield-systemtest/auswertung-runde20.md`), `auswertung-cr682.md`. Jede Aussage unten ist geprüft
(Spalte „Beleg“); was nicht geprüft ist, steht unter „Offen“.

## These

`local-1` scheiterte nicht an einer Stelle, sondern am Aufbau: Das schwächste Glied (qwen3-coder-30b, Profil
fast) traf **jede** Entscheidung, die das Ergebnis trägt — welches Werkzeug schreibt, welche Methode gilt, wann
etwas fertig ist, ob Tests bestanden sind — und graphcode nahm seine Behauptungen als Nachweis. Kleine Hebel
(AGENTS.md, Prompt-Hinweise) bewegen das nicht: `AGENTS.md` verbot `graph_mutate` ausdrücklich und wurde
ignoriert; gemessen gilt seit 2026-09-25 „Verbote wirken nicht“.

**Der Sprung:** dem Modell die tragenden Entscheidungen strukturell entziehen, das richtige Modell je Rolle
einsetzen und die Methode ins Werkzeug legen, wo das lokale Modell sie nicht selbst findet.

## Hebel

| # | Hebel | Beleg aus `local-1` / Messung | Umsetzung | Abnahme |
|---|---|---|---|---|
| H1 | **Nachweis statt Behauptung** im Werkzeug | 20:08 `graph_test_ingest` 5× `passed` für `it.todo`-Stubs, nie gelaufen. 19:02 fünf Stempel ohne Artefakt, 19:41 „Task fmea fertig“. Gegenprobe: SRR/PDR/CDR sind mit **und ohne** Stempel grün | (a) Ingest nur mit Laufbeleg (Vitest-JSON des Laufs; `todo`/`skipped` ≠ `passed`). (b) Task-`done` nur mit Artefakt (Records-Datei bzw. typische Knoten: Risiko-REQ bei FMEA, MS/CR bei plan). (c) Phasen-Gate zählt die Analyse erst mit Artefakt | Nachspielen des `local-1`-Audits: dieselben Züge enden **rot** statt `done`/`passed` |
| H2 | **Ein Schreiber** | Frischer Host mit derselben Config bietet 24 Werkzeuge, `graph_delegate` neben `graph_mutate`; qwen rief `graph_delegate` 0×, `graph_mutate` 22× | Ist `executor` konfiguriert, sieht der Client keine Schreibwerkzeuge (`graph_mutate`, `graph_merge`, Stempel), nur Lesen + `graph_delegate` + `graph_test_ingest` (mit Beleg, H1) | `listTools` im D2-Setting ohne `graph_mutate`; Lauf mit `graph_delegate` > 0 |
| H3 | **Executor fährt die Analysen** | `task` kommt in `src/loop/executor*.ts` nicht vor; D2 hätte nur den Kern gebaut. Der Client versuchte „IRL“ als Elementtyp und `implplan` als Task | Tasks conops/irr/fmea/plan im Executor, als Vorbild-Prompts (gemessen wirksam), Artefakt-Pflicht aus H1 | Lauf erzeugt je Task Artefakt + Stempel; Blindurteil-Punkte, die aus Analysen stammen (P16 Spike) ✓ |
| H4 | **Modell je Rolle** | Runde 20, gleicher Executor: qwen3.8-27b reasoning 10 · 5 · 11, „treu, lückenhaft“; qwen3-coder 1 · 7 · 18, „unbrauchbar“. `auswertung-cr682`: „für die Spezifikation taugt qwen3.8, nicht der Coder“ | Executor (Spec) = `qwen3.8-27b-lms` (reasoning), Client (Code) bleibt qwen3-coder. Preis: 23 Runden in 6 h (Runde 20) → Delegation asynchron (Warte-Budget `laeuft`) | Blindurteil D2+qwen3.8 gegen `local-1` und Runde-20-Wert |
| H5 | **Methode für den Client** | `opencode debug skill` listet 5 Skills, keinen se-Skill — die liegen als `.claude/commands`. Frontier arbeitete mit allen se-Skills | Die Skills der Code-Phase (se-test, se-umbau, se-plan-Umsetzung) als Skills bereitstellen, im Vorbild-Stil und kurz (64-k-Fenster) | `opencode debug skill` zeigt sie; Code-Phase ruft sie |
| H6 | **Messen ohne 3,5 h Nutzerzeit** | `local-1`: 3 h 37 min Wanduhr für 29 min Modellzeit; 17 Nutzereingriffe | Nutzer-Simulator beantwortet Rückfragen aus dem Kern (Antworten wie im Frontier-Dialog), Autolauf D2, N = 3 | Drei Läufe ohne Handeingriff, Blindurteil je Lauf |

## Stand 2026-10-01

| Hebel | Stand |
|---|---|
| H1 Nachweis statt Behauptung | (b) für den Executor-Weg erledigt: der Executor stempelt nur mit Artefakt (CR-GC-724), Modell-Stempel werden verworfen (CR-GC-725). Offen: Ingest mit Laufbeleg, Phasen-Gate, Client-Weg (ITEM-2026-684/685) |
| H2 Ein Schreiber | erledigt durch das lokale Profil (CR-GC-723, andere Sitzung): Client hat `graph_delegate` + drei Leser |
| H3 Executor fährt die Analysen | erledigt (CR-GC-724): `graph_delegate({task})`, Vorbild je Analyse, am echten Modell geprüft (`messung-executor-fmea.md`) |
| H4 Modell je Rolle | gemessen an einer FMEA: qwen3.8 `medium` liefert Inhalt, qwen3-coder füllt das Vorbild aus; Umstellung des Executors offen (Entscheid Autor) |
| H5 Methode für den Client | Skills liegen für OpenCode vor (CR-GC-721); in `local-2` einmal geladen, nicht befolgt |
| H6 Messen ohne Nutzerzeit | offen. `local-2` zeigt die Streuung: 43 gegen 0 Elemente auf praktisch gleichem Stand |

`local-2` lief auf dem falschen Build (`auswertung-local-2.md`) — die Kette D2 mit lokalem Profil ist noch nicht gemessen.

## Reihenfolge

1. **H1** zuerst — ohne ihn misst jeder weitere Lauf Behauptungen. Abnahme am vorhandenen `local-1`-Audit.
2. **H2 + H3** zusammen — erst dann ist D2 überhaupt die gemessene Kette.
3. **H4** ist Konfiguration (`graphcode.config.jsonc` → `executor.model`), kein Code.
4. **H6** fährt D2 dreimal mit H1–H4.
5. **H5** erst mit der Code-Phase — die Spec muss vorher stehen.

## Abnahme des Sprungs

- Blindurteil lokal ≥ 10 ✓ von 14 P-Punkten (Frontier 14, `local-1` 1, Runde-20-qwen3.8 ≈ 10/26 anteilig).
- 0 „fertig“/„bestanden“ ohne Werkzeugbeleg (Zählung: Behauptungen im Transcript gegen Audit/Vitest-Ergebnis).
- Spec: `kongruent` oder benannt offen; Code: eigene Tests laufen mit `npm test` und landen per Beleg im Graphen.

## Offen (nicht geprüft)

- Durchsatz von qwen3.8 heute am Gateway (Runde 20 war 6 h / 23 Runden; ob das noch gilt, zeigt ein kurzer Lauf).
- Ob OpenCode projektlokale `.claude/skills/*/SKILL.md` lädt (global wird `~/.claude/skills` gelesen, belegt).
- Warum keine Notiz sichtbar ist, obwohl die Skripte Notiz-IDs melden — Voraussetzung dafür, dass H3/Spike-Punkte
  überhaupt auf einen echten Notes-Beleg bauen können.
- Ob der Coder für die Code-Phase reicht — dafür gibt es keine lokale Messung, nur `local-1` (1 Datei nach drei Nachfragen).

## Stand 2026-10-01, abends — Lauf 3 aufgesetzt

- Verzeichnis `~/Developer/dev/agentdiary-local-3` (Commits `f564bc7`, `3eb6564`), leerer Store, Host-Port 4728.
  `agentdiary-local` trägt weiter den Stand von local-2 (Sitzung lief beim Aufsetzen noch).
- Host: Dev-Build `da289e2` (CR-GC-721..725), geprüft über den Befehl aus `opencode.json`:
  `boot.codeRoot` = `graphcode/dist`, vier Werkzeuge, `graph_delegate` mit `task`.
- Executor: `qwen3.8-27b-lms`, `reasoningEffort: medium`, `maxTokens` 4096, `callTimeoutMs` 300 000
  (4096 Token bei 14,8 Token/s = 277 s). Client: `qwen3-coder-30b-lms`.
- Gewollte Abweichungen zu Lauf 2: `.opencode/skills` entfernt und `AGENTS.md` ohne Verweis auf `GRAPHCODE.md`
  (beide setzen `graph_mutate` voraus, ITEM-2026-703); `AGENTS.md` nennt die fünf Tasks mit Aufruf-Vorbild.
- Nicht gemessen vor dem Lauf: Kernaufbau mit qwen3.8 medium; Analysen außer FMEA am echten Modell.
