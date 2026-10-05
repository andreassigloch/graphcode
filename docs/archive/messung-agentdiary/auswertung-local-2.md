# Standard-Auswertung AgentDiary, lokaler Arm (`local-2`)

Stempel: Graph leer (0 Elemente, graphVersion 0) · policy `agentdiary-local/graphcode.config.jsonc` · rules 34.0.0 ·
code **graphcode 0.27.0 aus der Registry** (`agentdiary-local/node_modules/@sigloch/graphcode/dist`, contracts 10.13.0) ·
2026-10-01.
Quellen: OpenCode-Datenbank `~/.local/share/opencode/opencode.db` (Sitzung `ses_f09354f2…`, keine Subagenten), Kopien von
`.graphcode/audit.jsonl` und `trajectory.jsonl`, `owner.lock`, Read-only-Brücke `:4727/health`. Der Live-Store wurde nicht
geöffnet (Host pid 46331 und OpenCode liefen noch). Daten: `runs/local-2/`.

## Ergebnis vorab

- **Der Lauf fuhr auf dem falschen Build.** `owner.lock` nennt als Code-Wurzel das Registry-Paket 0.27.0 im Test-Repo, nicht
  den Dev-Build. Ursache: beim Aufsetzen schrieb `graphcode init` den Host-Befehl in `opencode.json` vom absoluten Dev-Pfad
  auf `node_modules/@sigloch/graphcode/dist/cli.js` um (Commit `69491d7`). Die Probe davor startete den Dev-Build direkt und
  sah das nicht. Folge: CR-GC-722 (gekürzte Werkzeugtexte), CR-GC-723 (lokales Profil, vier Werkzeuge) und die Code-Seite von
  CR-GC-721/CR-SM-382 (Task-Prompt, Regelhinweise) waren **nicht aktiv**. Aktiv war von den Änderungen nur, was als Datei im
  Repo liegt: die Skills unter `.opencode/skills/` und der Stempel-Schritt in den Skill-Texten (Befund 1).
- **Das Modell ist leer.** 12 Modellzüge, 12 abgelehnt, 0 Elemente (`local-1`: 23 Züge, 7 abgelehnt, 43 Elemente). Es gibt
  keinen Export, keinen Code, keinen Test.
- **Gleiche Kette wie `local-1`, anderes Ergebnis.** Wieder Kette B: `graph_delegate` 0-mal, `graph_mutate` 12-mal, gegen
  `AGENTS.md`. Der Unterschied 43 gegen 0 Elemente entsteht bei praktisch gleichem graphcode-Stand — ein Lauf je Stand trägt
  keine Aussage (Befund 6).
- **Keine erfundenen Belege.** Kein Stempel, kein `passed` ohne Lauf. Die Zusammenfassung beim Kompaktieren nennt den Zustand
  richtig („Blocked … Failed to create complete model“). In den Antworten an den Nutzer steht aber viermal, das Modell
  existiere (Befund 4). Eine Rückfrage an den Nutzer gab es nicht.
- **Skills: einmal geladen, nicht befolgt.** `se-fmea` wurde über das Skill-Werkzeug geladen; die FMEA danach ist Prosa ohne
  Graph. Für die IRR wurde kein Skill geladen (Befund 3).
- **Blindurteil entfällt:** es gibt keine Spezifikation, die ein Gutachter lesen könnte. Am Raster gemessen sind alle 14
  Anforderungspunkte ✗.

## 1. Kennzahlen

| Größe | `local-2` | `local-1` |
|---|---:|---:|
| Elemente im Graphen | 0 | 43 |
| Modellzüge · abgelehnt | 12 · 12 | 23 · 7 |
| `graph_delegate` · `graph_generate` | 0 · 0 | 0 · 4 |
| Skill geladen | 1 (`se-fmea`) | 0 (keiner verfügbar) |
| Stempel ohne Artefakt | 0 | 5 |
| `passed` ohne Lauf | 0 | 5 |
| Code-Dateien | 0 | 1 (nach drei Nachfragen) |
| Nutzereingaben | 9 (+ 2 Kompaktierungen) | 17 |

Readiness meldet auf dem leeren Graphen SRR, PDR, CDR und TRR als bestanden (Score 1, 0 von 0) — dieselbe Lücke wie in
`local-1` (ITEM-2026-685).

## 2. Werkzeuge

| Werkzeug | Aufrufe |
|---|---:|
| graph_mutate | 12 (alle abgelehnt) |
| graph_elements | 5 |
| graph_export | 4 (alle verweigert: leerer Graph) |
| graph_readiness · graph_authoring_guide · graph_help | 2 · 2 · 1 (Fehler: Token `se-fmea`) |
| skill | 1 |
| bash · read | 7 · 3 |
| **graph_delegate · graph_generate** | **0 · 0** |

## 3. Chronologie

| Zeit | Nutzer | Agent |
|---|---|---|
| 11:27 | Eröffnungsprompt | liest README, GRAPHCODE.md, Spike-Datei; 7 Züge ohne SYS/UC, direkt MOD/FUNC/FLOW; alle abgelehnt (IO-02, R-18, 2× Parse-Fehler bei `@realRef`). Schlägt Notes MCP vor, keine Alternative, keine Rückfrage. Meldet drei Elemente als „definiert“ |
| 11:34 | „detailliere die Anforderungen und dekomponiere die Hauptfunktionen“ | 2 Züge mit 4 REQ + 6 FUNC; erst fehlende `kinds`, dann R-01 (REQ ohne TEST). Antwort: Liste in Prosa |
| 11:37 | „Liste der Repos, alles unter Developer/“ | `find … \| head -10` → 11 Repos |
| 11:39 | „Das sind aber nicht alle“ | `find` ohne `head` → 39 Repos |
| 11:42 | „Pfad als Config-Parameter, mit Requirement“ | derselbe Batch plus 1 REQ/1 FUNC, wieder R-01. Meldet „vollständige Anforderungsstruktur definiert“ |
| 14:07 | „IRR entsprechend der Skill“ | sendet denselben Batch noch zweimal (R-01, dann zusätzlich MOD-compose-FUNC), kein Skill geladen; Annahmenliste in Prosa, kein Record, kein CR |
| 14:11 | (Kompaktierung 1) | „Blocked: Format-E parse errors“ |
| 14:12 | „FMEA according to skill“ | `graph_help se-fmea` (Fehler), dann Skill `se-fmea` geladen; 0 FCHAIN im Graphen → FMEA in Prosa, drei Fehlermodi mit geschätzten S/O/D |
| 14:16 | „Implementierungsplan“ | Prosaplan, 5 Wochen |
| 14:16 | „nope. auf Basis des Modelles“ | liest Readiness (0 Elemente), schreibt „gemäß Modell“ einen zweiten Prosaplan, „80 Stunden“ |
| 14:17 | (Kompaktierung 2) | „Failed to create complete model due to validation errors“ |

## 4. Befunde

1. **Falscher Build (Aufsetzfehler, nicht Modell).** Beleg: `owner.lock` → `codeRoot …/agentdiary-local/node_modules/@sigloch/graphcode/dist`,
   Prozess `node node_modules/@sigloch/graphcode/dist/cli.js mcp`; `git show 69491d7 -- opencode.json`. Die Umgebung trug
   `GRAPHCODE_CLIENT_LLM=local`, aber 0.27.0 kennt die Variable nicht — der Client bekam die volle Werkzeugliste.
2. **Die Gate-Rückmeldung wird nur verarbeitet, wo sie die Reparatur wörtlich nennt** — Einzelheiten in 4a. Das stützt die
   Entscheidung vom 2026-09-28 (das lokale Modell schreibt nicht selbst); die Kette, die das abfängt, lief nicht.
3. **Skills verfügbar ≠ Skills befolgt.** `se-fmea` (5,4 k Tokens) wurde geladen. Schritt 2 verlangt eine FCHAIN; der Graph
   hatte keine. Der Skill sagt für diesen Fall „ask, do not guess“; das Modell schrieb stattdessen eine FMEA über eine
   Kette, die es nicht gibt, mit Wörtern aus dem Skill-Beispiel („Firmware“, „Linearität ~1.0“). Für die IRR wurde kein
   Skill geladen, obwohl der Nutzer ihn nannte.
4. **Vier Aussagen ohne Deckung** (Graph durchgehend 0 Elemente): 11:30 „Diese Elemente wurden in Ihrem graphcode-Modell
   definiert“; 11:42 „vollständige Anforderungsstruktur … definiert“; 14:14 „Basierend auf Ihrem Funktionsmodell: FCHAIN …“;
   14:16 „Implementierungsplan … gemäß Modell“. Gegenüber `local-1` fehlen die schweren Fälle (Stempel, `passed`).
5. **Inhaltlich gegen den Auftrag:** Zeitwerte je Commit-Typ erfunden (fix 30 min, feature 60 min …); „Notes MCP“ als
   gegeben behandelt, obwohl die Spike-Datei `osascript` misst; täglicher Lauf als Cron-Job statt im sigllm-Kontext;
   keine Rückfrage an den Nutzer. Richtig: alle Repos unter `Developer/` (nach einer Korrektur), Konfiguration als
   eigene Anforderung.
6. **Streuung.** `local-1` begann mit `graph_generate` (Seed: SYS, UC, ACTOR) und kam auf 43 Elemente; `local-2` begann mit
   `graph_readiness` und schrieb sofort MOD/FUNC. Der erste Werkzeugaufruf entschied den Lauf. Auf demselben Stand sind
   mindestens drei Läufe nötig, bevor eine Änderung als wirksam gilt.

## 4a. Verlaufsanalyse: woran die zwölf Züge scheiterten

| Zug | Zeit | Blockiert durch | Reaktion des Modells |
|---|---|---|---|
| 1–3 | 11:29–11:30 | IO-02 (FLOW mit zwei Erzeugern), R-18 (MOD-compose-FUNC, FUNC-satisfy-FUNC, MOD-allocate-FUNC, FLOW ohne SCHEMA) | lässt MOD und SCHEMA weg, statt die Richtung zu drehen |
| 4 | 11:30 | R-18 (FUNC-io-FUNC) | — |
| 5–6 | 11:30 | **Parse-Fehler** (`@realRef` unter `## Edges`, dann auf der Knotenzeile) | gibt `realRef` auf |
| 7 | 11:30 | R-18 (ACTOR-io-FUNC, FLOW ohne SCHEMA) | Prosa-Antwort |
| 8 | 11:34 | R-01, R-18 (`kinds` fehlen, FUNC-io-FUNC) | setzt `@kinds` richtig, streicht die io-Kanten |
| 9–11 | 11:35, 11:42, 14:10 | **nur noch R-01** (4 bzw. 5 REQ ohne TEST) | derselbe Batch, dreimal |
| 12 | 14:10 | R-01, R-18 (MOD-compose-FUNC wieder) | Prosa-Antwort |

Was daraus folgt:

1. **Es fehlte nicht die Format-E-Grammatik, sondern das Metamodell.** 10 von 12 Batches waren syntaktisch gültig
   (Sektionen, Kanten, Fan-out, `@kinds` als Folgezeile). Nur zwei scheiterten am Parser, beide an derselben Stelle
   (`@realRef`). Die Selbstdiagnose in den Kompaktierungen („Format-E parse errors“, „invalid realRef attribute syntax“)
   beschreibt die Züge 5–6 und übergeht, dass die Züge 9–11 an genau einer Regel hingen.
2. **Ab 11:35 war der Batch eine Regel vom Erfolg entfernt.** Zug 9 hatte 4 REQ mit `kinds`, 6 FUNC, 6 satisfy-Kanten, eine
   compose-Kante — einziger Fehler R-01. Vier TEST-Zeilen und eine verify-Zeile hätten ihn durchgebracht.
3. **Konkrete Hinweise wurden in einem Zug befolgt, abstrakte nie.** „Declare 'kinds' on REQ-x — … subset of {functional}“
   → im nächsten Zug richtig (1 von 1). „Link a TEST element via verify trace“ → 0 von 4. „Use a trace type whose
   TRACE_PATTERNS allows this source/target pair“ → nie repariert, nur umgangen (die legale Richtung FUNC-allocate-MOD nennt
   der Hinweis nicht). Dasselbe Muster wie am Executor gemessen (Vorbild wirkt, Verweis nicht).
4. **Drei Rückmeldungen von graphcode führen in die Irre** — sie gelten auch im aktuellen Dev-Stand:
   - Ein abgelehnter Batch meldet `success:false, appliedCommands:25, mutations:0`. `appliedCommands` zählt die
     eingereichten Kommandos (`gate.ts`), liest sich aber als „25 angewandt“. Nach vier abgelehnten Zügen rief das Modell
     `graph_export`, und zweimal meldete es dem Nutzer die Elemente als definiert.
   - Der abgelehnte Zug trägt kein `next` — das Feld mit dem Vorbild kommt nur bei Erfolg (`write.ts`). Wer nie einen Zug
     durchbringt, sieht nie eine Anleitung.
   - Der R-20-Hinweis zeigt die Bindung als eine Zeile (`~ FUNC-x @realRef {…}`); der Parser verlangt `@realRef` als
     Folgezeile und lehnt genau diese Schreibweise mit „Uid contains whitespace“ ab.
5. **Wissen und Aussage fallen auseinander.** Das Modell sah dreimal `total: 0` (`graph_elements` 14:10, 14:13, 14:16) und
   viermal „live graph has 0 elements“ beim Export. Die Kompaktierung (eigener Aufruf, `agent=compaction`) schreibt
   „Blocked … Failed to create complete model“. In den Antworten an den Nutzer steht das nie; dort ist das Modell „definiert“.
6. **Rückfragen: keine.** Im ganzen Verlauf steht in keiner Antwort eine Frage an den Nutzer, das Frage-Werkzeug wurde
   nicht gerufen (`local-1`: einmal, drei Fragen). Brauchbar waren die Antworten auf die Nutzer-Fragen: die Repo-Liste
   (nach einer Korrektur vollständig) und die Annahmenliste der IRR, die drei echte unbewiesene Annahmen nennt
   (einheitliche Commit-Muster, Genauigkeit der Zeitwerte, funktionierende Notes-Anbindung).
7. **Inhalt der Prosa gegen das Raster** (nicht blind, nur die fünf Punkte, die der Arm von Anfang an kennen konnte):
   P01 Zeitschätzung je Tag ~ (Werte erfunden), P02 Zusammenfassung aus Commits ~, P07 täglicher Agent in sigllm ✗
   (Cron-Job), P11 Kommunikationsweg ~ (Notes MCP gesetzt, keine Alternative), P16 Spike-Daten ✗ (gelesen, Kontenproblem
   nicht übernommen). `local-1`, im Graphen: 1 ✓ · 3 ~ · 1 ✗.

## 5. Token und Zeit

46 Assistenz-Nachrichten, 12,0 min Modellzeit, Input 137 k, Output 12,2 k, Cache gelesen 1,70 M. Kontext je Anfrage: Median
43 k, Maximum 54 k von 64 k. 2 Kompaktierungen. Wanduhr 11:27–14:17 mit einer Pause von 2 h 25 min.

## 6. Was der Lauf trägt und was nicht

- **Trägt:** eine zweite Stichprobe der Kette B auf 0.27.0, mit verfügbaren Skills. Ergebnis schlechter im Modell, besser in
  der Ehrlichkeit.
- **Trägt nicht:** jede Aussage über CR-GC-721 (Hinweise), 722, 723 und über Kette D2.

## 7. Nächster Schritt

1. `opencode.json` wieder auf den Dev-Build stellen; nach dem Start `owner.lock` → `codeRoot` prüfen, bevor der Prompt geht.
2. Lauf wiederholen. Mit dem lokalen Profil schreibt nur der Executor; die Analysen (IRR, FMEA, Plan) haben dann keinen Weg,
   solange der Executor keine Tasks fährt (`plan-sprung-lokal.md`, H3).
