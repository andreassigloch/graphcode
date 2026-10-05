# Messung: Zusammenarbeit Client, Executor, Modell am Testobjekt Todo-Liste

Stempel: graphcode `f4e806d` (CR-GC-726, CR-GC-727), contracts-Arbeitskopie, OpenCode 1.18.34, ein Rechner
(M4 Pro, 64 GB, eine GPU), sigllm-Gateway · 2026-10-02 · je Aufbau **ein** Lauf.
Test-Repo `~/Developer/dev/todo-local` (`1df8f55`), Kopien `todo-probe-*`. Daten: `runs/todo-{b,a,b3,a3}/`
(Audit, Spur der Delegation, Client-Verlauf).

Start-Prompt (fest):

```
Wir modellieren mit graphcode eine Todo-Liste für die Kommandozeile.

Befehle:  add "<text>", list, done <nr>.
Speicher: eine JSON-Datei im Arbeitsverzeichnis.
Fehler:   done mit unbekannter Nummer -> Fehlermeldung, Exit-Code 1.
Nutzer:   eine Person am Terminal.

Erst das Modell, noch kein Code.
```

Gefahren mit `opencode serve` und `opencode run --attach --format json`; Rückfragen hätte ich als
Stellvertreter beantwortet — es kam in keinem Lauf eine.

## Aufbauten

| | Client (OpenCode) | Executor (`graph_delegate`) | Warte-Budget je Aufruf |
|---|---|---|---|
| B1 | qwen3.8 medium | qwen3-coder | 45 s |
| A1 | qwen3-coder | qwen3.8 medium | 45 s |
| B3 | qwen3.8 medium | qwen3-coder | 600 s |
| A3 | qwen3-coder | qwen3.8 medium | 600 s |

B3 und A3 zusätzlich: `AGENTS.md` nennt die Werkzeuge mit dem Namen aus der Werkzeugliste des Clients
(`graphcode_graph_delegate`).

## Ergebnis

| | B1 | A1 | B3 | A3 |
|---|---:|---:|---:|---:|
| Laufzeit der Delegation | 36 min, abgebrochen | 14 min, abgebrochen | 35 min, `fertig` | 36 min, abgebrochen |
| Executor-Runden | 18 | 6 | 40 (Rundenbudget) | 16 |
| Batches angenommen · abgelehnt (Audit) | 14 · 17 | 4 · 0 | 36 · 19 | 14 · 0 |
| Abfragen des Clients (`graph_delegate`) | 17 | 6 | 4 | 3 |
| Zeit bis 40 Elemente | 19 min | nicht erreicht | 2 min | 20 min |
| Elemente am Ende | 43 | 18 | 106 | 52 |
| davon Dubletten (uid endet auf `-N`) | 0 | 0 | 23 | 0 |
| Regelverstöße mit Schweregrad Fehler | 0 | 0 | 0 | 0 |

## Befunde

1. **Die Leitung steht.** In allen vier Läufen kam `graph_delegate` vor jeder Code-Datei, kein
   `Request timed out`, der Client wartete mit `graph_delegate({})`. In B3 las der Client nach `fertig`
   den Bestand und berichtete: drei Abläufe, Anforderungen je Befehl, der fehlende Test am Fehlerpfad,
   die Dubletten — mit drei Vorschlägen an den Nutzer und ohne Code.
2. **Kurzes Warten bremst den Coder im Executor um den Faktor 8.** B1 gegen B3: 19 gegen 2 Minuten bis zum
   Kern. Jede Abfrage des Clients ist eine Inferenz über 14–19 k Token ohne Cache, auf derselben GPU.
3. **Der Denker im Executor ist davon unabhängig langsam.** A1 und A3: je rund 2,3 Minuten je Runde, mit
   kurzem wie mit langem Warten. Je Lauf riss eine Runde den Aufruf-Timeout von 300 s.
4. **Der Coder im Executor ist schnell und beschädigt danach das Modell.** B3: Kern (43 Elemente) nach Runde 6,
   75 Elemente nach Runde 20, ab Runde 31 nur noch Dubletten (`FUNC-todo-done-file-update-1-1`,
   `MOD-todo-file-storage-2`); 43 Hinweise auf Beinahe-Dubletten. Der Lauf endet erst am Rundenbudget.
5. **Der Denker im Executor schreibt sauberer.** A3: keine Ablehnung in 14 Batches (eine in der Spur, im selben
   Schritt korrigiert), keine Dubletten, Anforderungen nah am Auftrag. Zwei Zutaten ohne Auftrag: „Keine Todos
   vorhanden“ bei leerer Liste, eine Bestätigungsmeldung nach `done`. Nach 36 Minuten fehlten noch die Module.
   Der Coder erfand in B1 Zeitgrenzen (100 ms, 50 ms) trotz „Erfinde nichts dazu“ im Auftrag.
6. **Ablehnungen beim Coder (Spur, je Gate-Ablehnung):** B3: 24 von 32 nennen R-18 — eine Wirkkette als
   Erfüller einer funktionalen Anforderung (ITEM-2026-683). B1: 10 von 19 sind Format-E-Fehler (Kante auf
   eine uid, die es noch nicht gibt), 7 nennen R-18.
7. **Der Denker als Client erkundet.** B1: drei Minuten Lesen von Config, `aise --help`, `graphcode --help`, erst
   dann die Delegation. Ein Zwischenlauf (B2, `AGENTS.md` noch mit `graph_delegate` ohne Präfix) endete ohne
   Delegation: der Denker hielt die Werkzeuge für „nicht verdrahtet“, kopierte den Gateway-Schlüssel nach
   `/tmp/gc_key.txt` und wollte `graphcode run` über die Kommandozeile starten; OpenCode wies den Aufruf ab.
   Die Datei ist gelöscht. Mit dem Namen aus der Werkzeugliste (B3) delegierte er nach einem Lese-Aufruf.
   Der Coder als Client delegierte in A1 und A3 ohne Umweg, mit dem Prompt fast wörtlich als Auftrag.
8. **Global geladen:** ein `apple-notes`-MCP aus `~/.config/opencode` hängt an jeder OpenCode-Sitzung, auch an
   diesen Proben.

## Nicht gemessen

N > 1 je Aufbau; ein Stopp des Coder-Executors am Kern; der Denker im Executor mit `low` statt `medium`;
Rückfragen (kamen nicht vor); dasselbe Modell in beiden Rollen.

---

# Zweite Messung: ein Modell oder zwei, Delegation als Etappe

Stempel: graphcode `cf29f2d` plus Arbeitsstand CR-GC-728, contracts `ff1af28` (CR-SM-383) · 2026-10-02, abends ·
je Aufbau **ein** Lauf. Test-Repo `todo-local` (`1fcff0c`): `executor.maxRounds` 10, Warte-Budget 600 s.
Zwei Züge des Nutzers: der Start-Prompt, dann „Weiter am Modell: behebe die offenen Hinweise. Noch kein Code.“
Daten: `runs/todo-{c,b4,d}/`. Auswertung je Etappe im Wegwerf-Store nachgespielt (Skript im Scratchpad).

Vorher behoben, weil es die erste Messung verfälschte: die Regeln UC-04 und BQ-07 hielten das Wort „Todo“ für
einen Platzhalter (`todo` ohne Groß-/Kleinschreibung). Der Hinweis stand an jedem Ablauf und war nicht behebbar.

| | C | B4 | D |
|---|---:|---:|---:|
| Client | qwen3-coder | qwen3.8 medium | qwen3.8 medium |
| Executor | qwen3-coder | qwen3-coder | qwen3.8 medium |
| Etappe 1: Dauer der Delegation | 2,6 min | 2,8 min | 14,4 min |
| Etappe 1: Ende | keine bearbeitbaren Hinweise | Rundenbudget | keine bearbeitbaren Hinweise |
| Etappe 1: Batches angenommen · abgelehnt | 11 · 3 | 12 · 0 | 9 · 0 |
| Etappe 1: Elemente | 44 | 54 | 36 |
| Etappe 1: offene Hinweise, im Modell lösbar | 0 | 12 | 0 |
| Etappe 2: Dauer · Elemente · offene Hinweise | 0 min · 44 · 0 | 2,3 min · 61 · 1 | 0 min · 36 · 0 |
| Beinahe-Dubletten (ND-01) am Ende | 0 | 0 | 0 |
| Elemente mit gleichem Typ und Namen | 2 | 8 | 0 |
| Anforderungen · davon nicht im Auftrag (meine Lesart) | 10 · 6 | 15 · 10 | 6 · 1 |
| Zug 1 des Nutzers, gesamt | 3,1 min | 5,6 min | 16,5 min |
| Code vor dem Modell | nein | nein | nein |

„Offene Hinweise, im Modell lösbar“: alle Regelhinweise außer Code-Bindung (R-19, R-20, R-26, RC-10) und den
Eintrittspunkten der Analysen (AF-01..05). Fehler-Schweregrad: in keinem Lauf.

## Befunde

1. **Der Regelfehler war ein Hauptgrund für die langen Läufe.** Mit der Korrektur endet der Coder im Executor
   nach 10 Runden in unter 3 Minuten ohne offenen Hinweis (C). In B3 lief derselbe Aufbau 35 Minuten bis zum
   Rundenbudget und schrieb 23 Dubletten.
2. **Ein Modell in beiden Rollen ist schneller als zwei.** qwen3.8 im Executor: 1,4 Minuten je Runde, wenn auch
   der Client qwen3.8 ist (D), gegen 2,3 Minuten mit qwen3-coder als Client (A1, A3).
3. **Das Executor-Modell bestimmt, was im Modell steht.** qwen3.8: sechs Anforderungen, eine ohne Auftrag
   („Leere Liste melden“). qwen3-coder: 10 bis 15 Anforderungen, mehr als die Hälfte ohne Auftrag
   (Eingabe validieren, Datei existiert, Zeitgrenzen), darunter wortgleiche Paare.
4. **Der Client bestimmt, was der Nutzer erfährt.** qwen3-coder (C): „Das Modell ist vollständig und bereit für
   die Code-Generierung.“ qwen3.8 (B4, D): nennt eine konkrete Lücke (D: die Struktur der JSON-Datei ist nicht
   als Vertrag modelliert) und fragt den Nutzer.
5. **Der Client kann dem Executor nach dem Start nichts auftragen.** In B4 und D schickte der Denker auf
   „Weiter“ fünf beziehungsweise vier Aufträge mit genauen Anweisungen. Der Executor liest einen Auftragstext nur,
   solange das Modell entsteht; danach arbeitet er Regelhinweise ab. Jeder Aufruf kam mit `stalled`, 0 Zügen,
   0 Token zurück. Beide Male schloss der Client auf einen Ausfall des Modells, las Config und Prozesse und wollte
   das Gateway mit dem Schlüssel abfragen (von OpenCode abgewiesen). CR-GC-728 lässt das Ergebnis jetzt den Grund
   nennen; die Fähigkeit selbst fehlt (ITEM-2026-711).
6. **`graph_context` an einem Ablauf führt irre.** Das Werkzeug liefert für einen UC nur den Knoten; der Denker
   las das in B4 als „UC hat 0 Kanten“ und beauftragte eine Verdrahtung, die es schon gab.

## Nicht gemessen

N > 1; der Aufbau A (Coder als Client, Denker im Executor) mit Etappen; ein größeres Testobjekt; die Analysen;
die Wirkung von CR-GC-728 auf den Client (gebaut nach den Läufen).

---

# Dritte Messung: der Client schreibt selbst (ohne Executor), interaktiv

Stempel: graphcode `c164673`, OpenCode 1.18.34, qwen3.8 `reasoning_effort: medium`, Kontext 65 536 · 2026-10-03 ·
je Aufbau **ein** Lauf. Profil `cloud`, Werkzeuge über OpenCode-Config gefiltert (`graph_mutate` + 6 Leser).
Zug 1 = Start-Prompt; Zug 2 = Erweiterung „delete <nr>, Nummern der übrigen bleiben“ (E: plus Antworten auf Zug 1).
Erster Prompt mitgeschnitten: `erster-prompt/` (E).

| | E | F |
|---|---:|---:|
| Anweisung | `AGENTS.md` mit Schrittfolge als Beispiel | eigener Agent `modellieren`, Prompt ohne Beispiel; `OPENCODE_DISABLE_CLAUDE_CODE=1`; ohne edit/write/bash |
| erste Anfrage (Zeichen) | 61 552 | ~17 800 |
| Kontext erster Schritt · max (Token) | 15 324 · 36 851 | 4 475 · 24 084 |
| Zug 1: Dauer | 22,3 min | 22,4 min |
| Zug 1: Schritte · `graph_mutate` · abgelehnt | 16 · 10 · 3 | 9 · 5 · 4 |
| Zug 1: Denkanteil der Ausgabe | 79 % | 64 % |
| Zug 1: vorher gefragt · nach Schritt angehalten | nein · nein | nein · nein |
| Zug 2: Rückfragen vor dem Bauen · Dauer | 2 · 52 s | 1 · 65 s |

Befunde:
1. Die Dauer kommt aus der Ausgabe (~20 k Token bei ~17 tok/s), nicht aus der Prompt-Größe — F hat ein Viertel
   des Prompts und ist gleich lang.
2. Zug 1 baut in beiden Aufbauten das ganze Modell in einem Zug; „zeigen und warten“ wird ignoriert. Bei der
   Erweiterung in Zug 2 fragen beide vor dem Bauen — und das in rund einer Minute.
3. Mit Schrittfolge als Beispiel (E) baut der Client in Schritten; ohne (F) schickt er einen großen Batch, der
   viermal abgelehnt wird und dabei wächst (23 → 75 Zeilen, letzter Schritt 8,4 min). Vorbild wirkt, Satzregel nicht.
4. F nahm AF-01..05 eigenmächtig als `acceptedFindings` ab („Konzeptphase“) — trotz „Regelhinweise sind
   Information, kein Auftrag“. Auslöser: der AF-Hinweis bietet die Abnahme selbst an.
5. Das Feld `next` an jeder angenommenen Mutation (CR-GC-588) trägt in E 7 von 10 Antworten einen Arbeitsauftrag.
6. `opencode run` ohne `< /dev/null` hängt an der Standardeingabe (Probe-Falle, kein Produktbefund).

# Vierte Messung: Vorschlag an den Nutzer statt `next`, Prompt mit Beispielen (G)

Stempel: graphcode `887a206` (CR-GC-729), sonst wie F · 2026-10-03 · ein Lauf. Prompt `modellieren.md` mit zwei
Vorbildern (erster Zug = Fragen + Schrittfolge, Bau-Zug = ein Batch + drei Zeilen Bericht; Domäne Notiz-App,
Format-E am Gate geprüft). Plugin `.opencode/plugin/vorschlag.js` nimmt `vorschlag` aus der Antwort und legt ihn
ins Eingabefeld. Nutzer = ich: Zug 2 Antworten + „Ja, Schritt 1“, Zug 3 der vorbefüllte Vorschlag unverändert.

| Zug | Eingabe | Dauer | Schritte · `graph_mutate` · abgelehnt | Ergebnis |
|---|---|---:|---|---|
| 1 | Start-Prompt | 2,8 min | 4 · 0 · 0 | 3 Fragen + 4-Schritte-Plan, kein Schreibzug, Ende |
| 2 | Antworten, „Ja, Schritt 1“ | 2,9 min | 2 · 1 · 0 | SYS + ACTOR + 3 UC, Antworten in den UC-Beschreibungen, 3-Zeilen-Bericht, Ende |
| 3 | Vorschlag „Arbeite die Abläufe … weiter aus.“ | 38,5 min | 11 · 8 · 5 | Plan-Schritte 2+3 in einem Zug (REQ, TEST, FCHAIN, 9 FUNC, FLOW, SCHEMA, MOD) |

Befunde:
1. Die Vorbilder wirken: Zug 1 fragt und endet (F: 22 min, ganzes Modell), Zug 2 baut genau einen Schritt.
2. Das Plugin trägt: der Agent sah in keinem Ergebnis ein `vorschlag`-Feld; ohne TUI lief der Aufruf fehlerfrei ins Leere.
3. Der Vorschlag war zu grob. „Arbeite die Abläufe weiter aus“ (Dimension `uc`, Regeln UC-01 + UC-02) ist keiner
   der Plan-Schritte des Agenten; er las ihn als „alles Offene“ und baute Schritt 2 und 3 zusammen — Batches bis
   136 Zeilen, 5 Ablehnungen (R-01, R-18 FLOW ohne SCHEMA, 2× Format-E-Syntax, IO-02).
4. Ein Abschnitt lief 9,5 min mit 0 gemeldeten Token (Gateway: 200). Vermutung, nicht belegt: das Ausgabelimit
   8 192 ging im Denken auf. Danach Neuversuch.
5. Abnahme der Analysen AF-01..05 schlägt der Agent dem Nutzer vor („bewusst akzeptieren buchen“), setzt sie aber
   nicht selbst (F: selbst gesetzt).

# Fünfte Messung: Vorschlag je Regel, Ausgabelimit 32k (H)

Stempel: graphcode `3ace5c1` (CR-GC-730), `limit.output` 32 768, sonst wie G · 2026-10-03 · ein Lauf.
Nutzer = ich: Zug 2 „Ja, Schritt 1.“, Züge 3 und 4 je der vorbefüllte Vorschlag unverändert.

| Zug | Eingabe | Dauer | Schritte · `graph_mutate` · abgelehnt | Ergebnis |
|---|---|---:|---|---|
| 1 | Start-Prompt | 2,6 min | 2 · 0 · 0 | keine Fragen („alles klar vorgegeben“), 5-Schritte-Plan, Ende |
| 2 | „Ja, Schritt 1.“ | 0,9 min | 2 · 1 · 0 | SYS + 3 UC, Fehlerfall in der UC-Beschreibung |
| 3 | „Lege die Nutzer (Akteure) an und verbinde sie mit den Abläufen.“ | 3,9 min | 6 · 2 · 1 | ACTOR, 3 FLOW, 1 SCHEMA |
| 4 | „Lege für die Abläufe … Anforderungen mit Test an.“ | 1,2 min | 3 · 1 · 0 | 4 REQ + 4 TEST, dann 2 offene Fragen an den Nutzer |

Denken (aus `opencode.db`): 13 Abschnitte, zusammen 24 122 Zeichen, größter 9 846 — kein Abbruch am Limit
(`finish` nur `stop`/`tool-calls`).

Befunde:
1. Ein Vorschlag je Regel = ein Schritt je Zug: 8,6 min für vier Züge statt 38,5 min für einen (G Zug 3).
2. Die Lücken (leerer Text, Darstellung erledigter Einträge) fragte der Agent erst in Zug 4, nicht in Zug 1 —
   in G kamen sie in Zug 1. Ein Lauf; ob das Streuung ist, zeigt erst eine Wiederholung.
3. Vorschlag nach Zug 4 nennt wieder UC-02 („über Datenflüsse mit ihrem Nutzer“), obwohl der Akteur seit Zug 3
   angebunden ist: UC-02 verlangt den Weg ACTOR → FLOW → FUNC, und FUNC gibt es noch nicht. Der Satz stimmt
   zur Regel, liest sich aber wie schon erledigt.

## Wiederholung I und J (wie H, graphcode `71e8f3c` mit CR-GC-731)

| Zug | H | I | J |
|---|---:|---:|---:|
| 1 Start-Prompt | 2,6 min · 0 Fragen | 4,1 min · 5 Fragen | 2,0 min · 3 Fragen |
| 2 „Ja, Schritt 1.“ | 0,9 · 0 abgelehnt | 1,0 · 0 | 0,9 · 0 |
| 3 Vorschlag (Akteure) | 3,9 · 1 | 8,1 · 1 | 1,8 · 0 |
| 4 Vorschlag (REQ mit Test) | 1,2 · 0 | 7,7 · 0 | 2,7 · 0 |

Befunde:
1. Fragen in Zug 1: 3 von 4 Läufen (G, I, J) fragen, H nicht — H war Streuung, nicht Regel.
2. Züge 2–4: Median 1,8 min (0,9–8,1), 2 Ablehnungen in 9 Zügen. I ist der langsame Lauf: sein Zug 3 baute
   mehr als den Vorschlag (Akteur **und** Funktionen, Ketten, Verträge), weil sein eigener Plan-Schritt 2 die
   Ein-/Ausgabe als Datenfluss enthielt.
3. Zwei Vorschlagende: der Agent („Soll ich mit Schritt X …“) und graphcode (`vorschlag`). Meist deckungsgleich;
   I Zug 4: graphcode schlug ConOps vor (AF-01), der Agent Module. Der Vorschlag kennt die offenen Fragen des
   Agenten nicht — wer Enter drückt, überspringt sie. J hat die unbeantworteten Fragen als Annahmen benannt.
4. Mein Nutzer-Simulator hat die Fragen nie beantwortet (Zug 2 fest „Ja, Schritt 1.“) — eine Schwäche der Probe.

# Frontier-Arm A: Claude Code (Opus, `--model opus` → claude-opus-4-8) headless, Standard-Auslieferung von `init`

Repo `todo-frontier`: `graphcode init` (GRAPHCODE.md, se-Skills, Hooks inkl. `deny-headless-question`), `.mcp.json` auf den
Dev-Build `8b345e2`+ (CR-GC-732). `claude -p --output-format stream-json --allowedTools mcp__graphcode__*`, derselbe
Start-Prompt. 2026-10-03, ein Lauf.

| Zug | Dauer | Turns | Kosten | Ergebnis |
|---|---:|---:|---:|---|
| 1 | 6,6 min | 40 | 2,26 $ | ganzes Modell: SYS, 3 UC, ACTOR, 6 REQ + 6 TEST, 3 FCHAIN, 3 FUNC, FLOW, 5 SCHEMA, 1 MOD; AF-01..05 selbst abgenommen; `graph_export`; `git add -A && git commit` |
| 2–4 | — | — | — | nicht gefahren (Skriptfehler `--resume`; gegen ein fertiges Modell ohnehin sinnlos) |

Befunde:
1. Opus lud als Erstes den Skill `se:generate` (Autopilot) und baute alles in einem Zug — dasselbe Verhalten wie E/F
   vor dem Vorbild-Prompt, nur in 6,6 statt 22 min. Die Standard-Auslieferung (GRAPHCODE.md + se-Skills) führt
   Frontier in den Automodus, nicht in den interaktiven Pfad.
2. `vorschlag` hat nicht behindert und nicht gesteuert: der Agent rief nach jedem `graph_mutate` `graph_generate`
   (7×) — der Roundtrip, den CR-GC-588 sparen wollte, ist zurück. Die Schrittfolge entspricht den Vorschlägen
   1:1, weil beide denselben Schritt wählen; ob der Agent den Vorschlag gelesen hat, ist nicht unterscheidbar.
3. Abnahme AF-01..05 durch den Agenten: er wollte fragen (`AskUserQuestion`), der Hook `deny-headless-question`
   blockte und verlangte „als Annahme ins Modell“ — ein Artefakt des headless-Betriebs, nicht des Modells.
4. Headless-Vergleich mit lokal (G–J) ist unfair: anderer Prompt (GRAPHCODE.md + Skills gegen Vorbild-Prompt).
   Deshalb Arm B: dieselbe Anweisung als CLAUDE.md.

# Frontier-Arm B: Claude Code (Opus) headless, Vorbild-Anweisung als CLAUDE.md

Repo `todo-frontier-b`: wie A, aber `CLAUDE.md` = `modellieren.md` (Werkzeugnamen `mcp__graphcode__*`), `graph_memory.md`;
se-Skills und Hooks der Standard-Auslieferung bleiben. Dieselben vier Züge wie H–J (Zug 3/4: „Weiter mit Schritt 2/3“,
Claude Code hat kein Plugin, also keine Vorbefüllung). 2026-10-03, ein Lauf.

| Zug | Dauer | Turns | Kosten | Ergebnis |
|---|---:|---:|---:|---|
| 1 | 18 s | 4 | 0,28 $ | 5 Fragen, 4-Schritte-Plan, kein Schreibzug |
| 2 | 22 s | 3 | 0,18 $ | SYS + 3 UC, ein Batch, drei Zeilen Bericht, offene Fragen wiederholt |
| 3 | 19 s | 4 | 0,42 $ | ACTOR; R-16 genannt, bewusst nicht verdrahtet („FLOWs erst in Schritt 4“); fragt erneut nach den Antworten |
| 4 | 69 s | 6 | 0,33 $ | `AskUserQuestion` (vom Hook geblockt) → 4 Annahmen ausgewiesen; 6 REQ + 6 TEST; RD-01 genannt |

Summe 2,1 min, 1,21 $, 0 Ablehnungen. Alle vier `vorschlag`-Felder kamen beim Agenten an (kein Plugin), keines wurde
befolgt: Zug 3 baute den Akteur (Plan-Schritt 2) statt „Anforderungen mit Test“, Zug 4 die Anforderungen statt
„Funktionen“. Der Agent folgte dem Nutzer, der Vorschlag war nur Information.

Befunde:
1. Dieselbe Anweisung erzeugt bei Opus dasselbe Verhalten wie bei qwen3.8: fragen, einen Schritt bauen, berichten,
   enden. Unterschied: 2,1 min gegen 8,6 min (H) für vier Züge, 0 gegen 1–2 Ablehnungen, und Opus hält die
   offenen Fragen über drei Züge und weist Annahmen aus, als der Simulator nicht antwortet.
2. `vorschlag` behindert Frontier nicht: viermal gesehen, nie befolgt, kein zusätzlicher Roundtrip (0× graph_generate).
3. Arm A gegen B: die Standard-Auslieferung (GRAPHCODE.md + se:generate) führt Opus in den Autopilot (2,26 $, alles in
   einem Zug); die Vorbild-Anweisung führt es interaktiv. Was `init` ausliefert, entscheidet das Verhalten — bei
   beiden Modellen.
