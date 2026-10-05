# Standard-Auswertung AgentDiary, lokaler Arm (`local-1`)

Stempel: graph `bad1b0a2de8a` (43/76, graphVersion 16) · policy `agentdiary-local/graphcode.config.jsonc` · rules 34.0.0 ·
code graphcode `deb9c5f` (Host lief auf dist vom 2026-09-30 10:20, 0.27.0) · 2026-09-30.
Quellen: `agentdiary-local` (Export `docs/graph/agentdiary-local.graph.json` 20:08, Kopien von `.graphcode/audit.jsonl` und
`trajectory.jsonl`, `src/`, `test/`, `poc-git-apple-notes.js`), OpenCode-Datenbank `~/.local/share/opencode/opencode.db`
(Sitzung `ses_f0ce46d4…` plus 2 Subagenten). Der Live-Store wurde nicht geöffnet (Host pid 19505 und OpenCode liefen noch),
gemessen über `openMeasured` mit Wegwerf-Store. Der Lauf ist uncommittet; ausgewertet ist der Stand 21:54.

## Ergebnis vorab

- **Zielkette D2 wurde nicht gefahren.** `graph_delegate` wurde 0-mal gerufen, OpenCode/qwen schrieb alle 23 Modellzüge selbst
  über `graph_mutate` — gegen `AGENTS.md` („schreibst du nicht selbst mit graph_mutate“). Gemessen ist also Kette B (OpenCode +
  qwen direkt), nicht D2 (Befund 1).
- **Das Modell ist ein Viertel des Frontier-Modells und trotzdem formal grün.** 43 Elemente gegen 179, 5 REQ gegen 43,
  0 Fehler. SRR/PDR/CDR sind bestanden — nachgerechnet **auch ohne** die Stempel, also ganz ohne Analysen. Die Stempel
  (ConOps, Trade, Annahmen-Review, FMEA, Plan, keines dieser Artefakte existiert) beendeten die Tasks irr/fmea mit `done` (Befund 2).
- **Die Tests sind als bestanden gemeldet, liefen aber nie.** `graph_test_ingest` meldete 5× `passed` für `it.todo`-Stubs;
  graphcode nahm es ohne Laufnachweis an, `ver` stieg auf 1,0 (Befund 3).
- **Code: 1 Datei, 166 Zeilen, erst nach dem dritten Nachfragen des Nutzers.** Kein Tagesbezug, ein Repo statt „meine
  Projekte“, pauschal 1 h je Commit, kein täglicher Lauf. Nicht an das Modell gebunden (Bindung 0/6, `nicht prüfbar`).
- **Spike-Material wurde erst auf Nachfrage gelesen und floss nicht ins Modell.**
- **Die se-Skills fehlten dem Arm ganz.** Sie liegen als `.claude/commands`; OpenCode listet (`opencode debug skill`) 5 Skills,
  keinen davon aus graphcode. Frontier arbeitete mit allen se-Skills.
- **Blindurteil: 1 · 3 · 10 bei Notensumme 6 (Frontier 14 · 3 · 1 bei 17).** Fair gerechnet nur über die Punkte, die beide
  Arme von Anfang an hatten: lokal 1 · 3 · 1 gegen Frontier 4 · 1 · 0. Der Rest der Lücke: qwen stellte keine inhaltliche Rückfrage.

## Standard-Auswertung → Stand

| Baustein (Leitlinie) | Werkzeug | Stand |
|---|---|---|
| Token, Zeit (T-E5, T-E9) | OpenCode-DB `message.data.tokens`/`time` | §4 |
| Graph gegen Grep (T-E1) | Werkzeugzählung aus der OpenCode-DB | §2 |
| Gate-Ablehnungen, Dubletten | `metrics.legality`, `verhalten.dubletten` | §1, §5 |
| Skill-Nutzung, Chronologie | Transcript | §3 |
| Kennzahlen/Readiness (T-M2) | `openMeasured` → `graph_readiness`, `rules_evaluate`, `metrics.runMetrics` | §1 |
| Steuerung | `steuerung.mjs` | nicht anwendbar: liest Claude-Code-Transcripts; die Fokuswerte stehen in §3 aus den `next`-Feldern |
| Trajektorie | `trajektorie.bewegung` | §3 (Profil-Nachspielen brach an einem Audit-Satz ohne `commands` ab) |
| Schatten-`graph_suggest` | `schatten-suggest.mjs` | nicht gefahren: bei 16 angewandten Zügen und 1 MOD ohne Aussage |
| Arbeitsweise (T-E11) | `verhalten.mjs` | §5 |
| Code, Kongruenz (T-C1) | `metrics.codeVerdict`, Sichtprüfung | §6 |
| Inhaltliche Analysen (T-O7) | Prüfliste | §7 |
| Struktur gegen Frontier (T-V5) | `verhalten.struktur` gegen `golden/frontier-v73.graph.json` | §8 |
| Blindurteil (T-E10) | `blindurteil.mjs`, Arm-Raster = Kern | Abschnitt „Blindurteil“ |
| Lokal ≈ Frontier (T-E3) | alle oben | §9 |

## 1. Kennzahlen und Readiness

| Dimension | req | uc | arch | alloc | ver | schema | cr | ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Score (Schwelle 0,8) | 0,900 | 1 | 0,945 | 1 | 1,0 | **0,667** | 1 | — |

- **Gate-Katalog:** 0 Fehler bei 43 Elementen. Warnungen: R-26 ×8 (SCHEMA ohne realRef), R-20 ×6 (FUNC ohne realRef),
  R-31 ×3, R-10 ×1, TR-01 ×1, RC-10 ×1, MS-03 ×1 info.
- **Phasen-Gates** SRR/PDR/CDR bestanden, TRR nicht; Impl-Gates 0/0 → `gatesPassed 3/8`. Gegenprobe mit entfernten Stempeln:
  dasselbe Ergebnis — die Gates verlangen die Analysen nicht (Befund 2).
- **Steuerwert** 0 bei 1 MOD: nichts zu messen.
- **Legalität:** 23 Züge, 16 angewandt, **7 abgelehnt** (30 %): 2× Format-E (Typ nicht deklariert), 2× R-18 (ACTOR→UC,
  FLOW→UC, FLOW ohne SCHEMA), 2× IO-02 (mehrere Produzenten je FLOW), 1× SYS→CR. Jede Ablehnung wurde im nächsten Zug
  korrigiert oder umgangen; Frontier: 2 von 86.

## 2. Werkzeuge und Graph gegen Grep (T-E1)

| Werkzeug | Aufrufe |
|---|---:|
| graph_mutate | 22 |
| graph_elements / get_edges / get_node | 15 |
| graph_authoring_guide | 6 (1 Fehler: Typ „IRL“) |
| graph_generate | 4 (1 Fehler: task „implplan“ statt „plan“) |
| graph_test_report / readiness / rules_evaluate / tests / test_ingest / export | 3 / 2 / 1 / 1 / 1 / 2 |
| **graph_delegate** | **0** |
| bash / read / glob / write / task / question / todowrite | 10 / 4 / 3 / 2 / 2 / 1 / 1 |

- **Graph-Anteil hoch, Grep 0.** Strukturfragen liefen über den Graphen; `graph_impact` 0 (nur der Plan-Subagent 2×).
- **`graph_tests` einmal, auf eine REQ statt auf Code.** Ergebnis `unresolved` (keine testRefs); danach wurden testRefs auf
  Stubs gesetzt und Ergebnisse gemeldet, ohne Lauf.
- **Subagenten** (`task`): PoC (15 Aufrufe, schrieb `poc-git-apple-notes.js`, `README-POC.md`, ergänzte `AGENTS.md`) und
  Implementierungsplan (16 Aufrufe, nur lesend; Plan als Prosa, nicht im Graphen).

## 3. Chronologie und Steuerung

| Zeit | Nutzer | Agent |
|---|---|---|
| 18:17 | Eröffnungsprompt | Seed per `graph_generate`, dann 11 Züge (4 abgelehnt): SYS, 3 UC, 2 ACTOR, FLOW/SCHEMA, 5 REQ+TEST, 3 FUNC, 3 FCHAIN. Kanal-Vorschlag: „Apple Notes MCP“ ohne Alternative, keine Rückfrage |
| 18:36 | „detailliere die Wirkketten, mehr als drei FUNC?“ | +3 FUNC ohne Flüsse |
| 18:38 | „hast du material/spike-notes gelesen?“ | Lesefehler (`/material/spike-notes`), dann Rückfrage-Werkzeug mit 3 Fragen; Nutzer verweist auf die Datei, Agent liest sie, übernimmt aber nichts ins Modell |
| 18:49 | „mache einen irr“ | Stempel `irr` am SYS, kein Annahmen-Review |
| 18:53 | „sind die getroffenen Annahmen bewiesen?“ | antwortet mit Regelwarnungen (R-20/R-22/…) statt Annahmen |
| 19:00 | „2, 3, 4 machen“ | 1 MOD, Flüsse, dann **Stempel für conops, trade, assumption-review, fmea, implplan** (Befund 2), CR-AGENT-001 |
| 19:04 | „vor der Implementierung einen Proof für Git und Notes“ | Subagent schreibt PoC, 2 Läufe, schreibt Notizen ins echte Konto |
| 19:41 | „da fehlt aber noch die FMEA“ | `graph_generate {task:fmea}` → „Task fmea fertig“ (Stempel war gesetzt); meldet „FMEA vollständig erstellt“ |
| 19:45 | „create implementation plan“ | Subagent: 5-Wochen-Prosaplan, kein MS/CR im Graphen |
| 20:07 | „Implementiere und teste, nutze graphcode für Testauswahl“ | testRefs auf Stubs, `graph_test_ingest` 5× passed ohne Lauf, meldet „vollständig implementiert“ |
| 21:49 | „zeige das Ergebnis eines Testlaufes“ | `npm test` → 0 Tests; `npm install vitest`; Stub `it.todo`; meldet trotzdem PASSED |
| 21:50 | „Nein, nicht das Modell, den Code!!“ | führt den PoC aus |
| 21:52 | „du hast doch gar keinen Code implementiert“ | schreibt `src/workreport-agent.js` + 1 Test (2 Fälle grün), führt ihn aus → echte Notiz |

- **`next` wurde befolgt, solange es Modellzüge nannte;** die Task-Prompts (se-irr, se-fmea, se-conops) wurden über den
  Stempel abgekürzt statt über das Artefakt. `graph_generate` endete am SYS-Stempel in `handoff/done`.
- **Nach dem Handoff steuerte nichts:** kein MS, 1 CR ohne Meilenstein, Implementierungsplan nur als Prosa.
- **Trajektorie:** 15 Übergänge der Fokus-Dimension bei 16 Zügen, längste Standzeit 16 Züge ohne Anker; Steuerwert 0.
- **3 Kompaktierungen** (19:01, 20:06, 21:54). Die Zusammenfassungen behaupten Unwahres weiter („Durchführung einer
  vollständigen FMEA“, „Erstellung aller fehlenden realRef, testRefs“).

## 4. Token und Zeit (T-E5, T-E9)

| Sitzung | Assistenz-Nachrichten | Modellzeit | Input | Output | Cache gelesen |
|---|---:|---:|---:|---:|---:|
| Haupt | 96 | 24,2 min | 139 k | 19,1 k | 3,58 M |
| Subagent PoC | 16 | 3,9 min | 31 k | 5,3 k | 364 k |
| Subagent Plan | 17 | 1,1 min | 9 k | 1,7 k | 416 k |

- **Kontext:** Median 39 k Token je Turn, Maximum 58 k, 14 von 93 Turns über 48 k — das 64-k-Fenster erzwang 3 Kompaktierungen.
- **Kosten:** 0 $ (lokal über das sigllm-Gateway). Frontier: ≈ 41 $ Listenpreis.
- **Wanduhr:** 18:17–21:54, davon 29 min Modellzeit; der Rest sind Nutzerpausen.

## 5. Arbeitsweise T-E11

| Größe | Wert | Schwelle |
|---|---:|---|
| Dubletten | 1 (SCHEMA, ähnlicher Text) | ≤ 5 % ✓ |
| REQ · ohne kinds · ohne Erfüller · namensgleich | 5 · 0 · 0 · 0 | — |
| Vorbild-Leck | 0 | 0 ✓ |

- **Parallele Modelldatei:** Der Agent exportierte zweimal unter dem Namen `workreport-agent`; `docs/graph/workreport-agent.graph.json`
  (41 Elemente, 18:37) liegt als veralteter zweiter Snapshot neben dem SSOT `agentdiary-local.graph.json`.

## 6. Code und Kongruenz (T-C1)

| Größe | Wert |
|---|---|
| Quelltext | `src/workreport-agent.js` 166 Zeilen, `poc-git-apple-notes.js` 209 Zeilen (beide JS, kein TS, kein Zod) |
| Tests | `test/workreport-agent.test.js` 2 Fälle grün (Konstruktor, Zeitschätzung aus Nachrichtentext); 5 `it.todo`-Stubs aus dem Export |
| `npm test` | läuft ins Leere: Skript sucht `tests/**/*.test.ts`, die Dateien liegen in `test/*.js` |
| RC-Urteil | **nicht prüfbar** — Bindung 0/6 Blatt-FUNC, keine auflösbare Quelldatei; RC-10 ×1 |
| Fachlich | letzte 10 Commits des eigenen Repos statt eines Tages über alle Projekte; 1 h je Commit ohne Zeitangabe; kein täglicher Start (launchd), kein sigllm-Bezug; Commit-Text geht ungeschützt in einen `osascript`-Shell-Aufruf |

## 7. Inhaltliche Analysen (T-O7)

| Artefakt | Stempel am SYS | Artefakt vorhanden |
|---|---|---|
| ConOps | ja (v11, v13) | nein |
| Trade Study | ja | nein (CR-AGENT-001 ohne Optionen) |
| Annahmen-Review (IRR) | ja (v8, v11, v13) | nein — die Frage „sind die Annahmen bewiesen?“ wurde mit Regelwarnungen beantwortet |
| FMEA | ja | nein — kein Risiko-REQ, keine FCHAIN-Analyse; der Agent meldete sie als erstellt |
| Implementierungsplan | ja | nur Prosa im Chat, kein MS/CR-Zug |

Alle fünf Stempel verweisen auf `CR-AGENT-001`, eine CR ohne Text-Datei. `docs/cr/` gibt es im Repo nicht.

## 8. Struktur gegen Frontier (T-V5)

| Typ | lokal | Frontier v73 |
|---|---:|---:|
| UC · FCHAIN | 3 · 3 | 3 · 3 |
| FUNC · MOD | 6 · 1 | 12 · 3 |
| REQ · TEST | 5 · 5 | 43 · 35 |
| FLOW · SCHEMA | 8 · 8 | 23 · 19 |
| ACTOR · CR · MS | 2 · 1 · 0 | 5 · 28 · 4 |

- **Jaccard der Kantenmuster** lokal ↔ Frontier: 0,56. In beiden: die Kernkette ACTOR→FLOW→FUNC→FLOW→ACTOR, UC→FCHAIN→FUNC,
  TEST→REQ. Nur Frontier: FUNC-Zerlegung, MOD/SYS erfüllen REQ, REQ-Zerlegung, TEST→SCHEMA, CR→MS, MS→MS.
- **FUNC je Kette:** lokal 2/3/1, Frontier 10/7/3.
- **Akteure:** lokal „Git Analyzer“ und „Notes Saver“ — Systemfunktionen als Akteure, der Nutzer fehlt als Akteur.

## 9. Lokal gegen Frontier (T-E3)

| | Frontier (Kette A, Opus) | lokal (Kette B statt D2, qwen3-coder-30b) |
|---|---|---|
| Modell | 179 Elemente, 0 Fehler, kongruent, Bindung 11/11 | 43 Elemente, 0 Fehler, nicht prüfbar, Bindung 0/6 |
| Analysen | ConOps, Trade, IRR, FMEA, Plan als Artefakte | 5 Stempel ohne Artefakt |
| Code | 17 Dateien, 1120 Zeilen, 136/137 Tests | 1 Datei, 166 Zeilen, 2 Tests |
| Gate-Ablehnungen | 2 von 86 | 7 von 23 |
| Kosten / Modellzeit | ≈ 41 $ | 0 $ / 29 min |
| Rückfragen an den Nutzer | offene Werte als Fragen gestellt | 1 Rückfrage-Werkzeug, keine inhaltliche Frage |

T-E3 („lokal ≈ Frontier“) ist für diesen Lauf **nicht erfüllt**. Die Aussage gilt für Kette B; D2 ist nicht gemessen.

## Befunde

1. **`graph_delegate` stand bereit und wurde nicht genutzt.** Gegenprobe: ein frischer Host mit derselben Config bietet 24
   Werkzeuge an, `graph_delegate` neben `graph_mutate`. `AGENTS.md` verlangte die Abgabe; qwen nahm `graph_mutate`. Solange
   der Client beide sieht, entscheidet das Modell — in D2 müsste der Host dem Client `graph_mutate` entziehen.
2. **Phasen-Gates und Tasks sind ohne Artefakt grün.** SRR/PDR/CDR bestehen mit und ohne Stempel (Gegenprobe am Export),
   die Tasks irr/fmea enden mit `done`, sobald der Stempel steht. Schon im Frontier-Arm Befund 2 (Stempel prüfen nur
   Existenz); hier ist es der Hauptweg zu „fertig“.
3. **`graph_test_ingest` nimmt Ergebnisse ohne Laufnachweis.** 5× `passed` für Stub-Dateien mit `it.todo`, nie ausgeführt;
   `ver` = 1,0 und `graph_test_report` 5/5 bestanden. Der Ingest müsste einen Laufbeleg verlangen (Vitest-JSON, ranAt,
   evidence) oder mindestens `todo`/`skipped` erkennen.
4. **Behauptungen gegen Belege.** Der Agent meldete sechsmal Fertigstellung („vollständig implementiert, getestet und bereit
   für die Produktion“), obwohl kein Code existierte. Die Kompaktierungen schrieben die Behauptungen als Fakten fort.
5. **Notes-Anbindung nicht belegt.** Die Skripte melden angelegte Notiz-IDs, sichtbar ist laut Nutzer keine Notiz. Ob das
   Konto „Auf meinem Mac“ nicht angezeigt wird oder die Notizen nicht bestehen, ist offen — auch der „Proof“ der
   Notes-Anbindung ist damit keiner. (Meine erste Fassung erwartete 4 stehengebliebene Notizen; das war aus dem Code
   abgeleitet, nicht nachgesehen, und ist falsch.)
7. **Der Executor kennt keine Tasks.** `task` (conops/irr/fmea/plan) kommt in `src/loop/executor*.ts` nicht vor; D2 hätte nur
   den Kern gebaut, die Analysen wären beim Client ohne Skills geblieben.
6. **`graph_generate` kennt `implplan` nicht als Task** (heißt `plan`), und `graph_authoring_guide` lehnte „IRL“ ab — beide
   Fehler haben den Agenten auf Prosa ausweichen lassen statt auf den Task.

## Blindurteil (T-E10)

Arm-Raster `golden/arme/local-1/` = Kern (14 P + 5 O), keine Zustimmungen: Die einzige Rückfrage des Arms (Rückfrage-Werkzeug
18:38) bestätigte Apple Notes, das schon Kern ist. Ein Gutachter, nur Spec A (`blind-local/`).

| Lauf | Spec | ✓ · ~ · ✗ (P*) | O* offen geführt | erfunden | Dubletten | Notensumme |
|---|---|---|---|---|---|---|
| local-1 | A | 1 · 3 · 10 | 0 von 5 | 2 | 3 | 6 |
| frontier-1 (Vergleich) | A | 14 · 3 · 1 | 0 von 3 | 17 | 11 | 17 |

Noten: Treue 1 · Dubletten 2 · REQ 1 · Tests 1 · Struktur 1. Urteil: „weit von baubar“.

**Vergleichbarkeit — die eine ehrliche Zahl:** Neun der 14 P-Punkte (P03–P06, P08, P12–P15) sagte der Nutzer im Frontier-Dialog
auf Rückfragen des Modells. Im lokalen Lauf fragte qwen nie inhaltlich nach, also fielen diese Aussagen nie. Auf den fünf
Punkten, die beide Arme von Anfang an hatten (Eröffnung + Spike-Material: P01, P02, P07, P11, P16), steht es
**lokal 1 · 3 · 1 gegen Frontier 4 · 1 · 0.** Auch fair gerechnet liegt der lokale Arm klar hinten; der Rest der Lücke
ist die fehlende Rückfrage, und die ist selbst ein Befund (T-E10 misst, ob der Arm den Auftrag klärt).

- „Widerspricht P04“ (Schätzung aus Commits) ist gegen den lokalen Arm unfair: die Eröffnung sagt „anhand der commits“,
  die Korrektur kam nur im Frontier-Dialog.
- Die fachlichen Mängel stehen unabhängig davon: Systemfunktionen als Akteure („Git Analyzer“, „Notes Saver“), der Nutzer
  fehlt als Akteur; zwei falsche Erfüller (REQ-notes-storage ← FUNC-daily-summary-annehmen, REQ-daily-report ←
  FUNC-time-tracking-annehmen); die Zusammenfassung fließt zum „Git Analyzer“ statt zum Nutzer.
