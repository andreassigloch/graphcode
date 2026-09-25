# Code-Test — der Beweis im Code (Leitlinie Satz 7)

> „Der Beweis muss im Code ankommen: sichtbar bessere Architektur und Effizienz gegenüber frei laufendem
> Claude Code, nicht bessere Zahlen im Modell.“ — `bok/docs/governance/Aise_Leitlinie.md`

Bis hierher hat das Rig nur Phase 1 gemessen, das Autorieren des Modells. Alle Code-Urteile waren
„nicht prüfbar“, weil kein Lauf Code erzeugte. Dieser Test schließt die Lücke an einer kleinen,
deterministisch prüfbaren Scheibe.

## Die Frage

Baut Claude Code **mit** graphcode und Systemmodell dieselbe Aufgabe mit besserer Code-Architektur
und vertretbarer Effizienz als Claude Code **ohne**? Funktion allein reicht nicht; die muss in beiden
Armen stimmen.

## Die Scheibe

Der Scheduler der Nachtaufträge von SIG Local (`MOD-scheduler` im sigllm-Golden): Termine,
Nachholregel (`all`/`latest`/`none`), nie zweimal, Neustart, Schlaf, Umzug, Prüfen mit Wiederholung
und Ablage, Nachweis, Netzbedingung. Die Scheibe ist klein genug für einen Lauf und reich genug, dass
die Zerlegung zählt: Zeitrechnung, Zustand, Ausführung, Prüfung und Nachweis sind getrennte Anliegen.

| Datei | Wer sieht sie |
|---|---|
| `aufgabe.md` | beide Arme, wortgleich |
| `vertrag/contract.ts` | beide Arme, wortgleich — die einzige feste Grenze (Ports + Fabrik) |
| `material/auftrag.md` | beide Arme (der sigllm-Prosa-Auftrag als Hintergrund) |
| sigllm-Golden im Store | nur `gefuehrt` |
| `abnahme/scheduler.abnahme.test.ts` | **kein Arm** — verdeckte Abnahme, 15 Tests zu aufgabe.md Punkt 1–10 |
| `referenz/` | kein Arm — belegt, dass die Abnahme erfüllbar ist (15/15) und trennt (ohne Persistenz 11/15) |

## Die Arme

| Arm | Harness | Modell | Unterschied |
|---|---|---|---|
| `gefuehrt` | Claude Code + graphcode-MCP + se-Skills | Opus 5 | Golden im Store; baut entlang der FUNCs/SCHEMAs, bindet mit `graph_realize`, RC-Kongruenz am Ende |
| `frei` | Claude Code ohne graphcode | Opus 5 | nur Aufgabe, Vertrag, Auftrag |

Genau eine Achse unterscheidet die Arme: Modell und Werkzeug. Gleich sind das Modell, der Text, die
Obergrenze (60 min) und die Paket-Ausstattung (TypeScript, vitest).

## Die Messung (`messen.mjs`, beide Arme mit denselben Werkzeugen)

1. **Funktion** — verdeckte Abnahme: bestanden / 15.
2. **Eigene Tests** — `vitest run` im Arbeitsbereich.
3. **Code** — Dateien, Module (Verzeichnisse), Zeilen, größte Datei, Exporte, relative Importe,
   Importzyklen. Tests und unveränderte graphcode-Stubs (CR-GC-205) zählen nicht.
4. **Architektur** — `graphcode import-code` auf einer Kopie des Codes, deterministisch und ohne LLM,
   für beide Arme gleich: MOD/FUNC/FLOW/SCHEMA und der Steuerwert (RD-04, BW-02, R-04, CR-01, MT-02).
   Damit misst derselbe Regelkatalog den Code beider Arme — auch den, der nie ein Modell hatte.
5. **Kongruenz** — nur `gefuehrt`: RC-Urteil (kongruent / gedriftet / nicht prüfbar) und Bindungsquote.
6. **Effizienz** — Kosten, Turns, Sekunden, dazu die **Turn-Bilanz** aus `claude-stream.jsonl`: wie viele
   API-Turns nach einer graphcode-Antwort, nach Datei-/Code-Arbeit oder nach ToolSearch kamen und wie viel
   Cache-Lesung sie kosteten. Gegen den freien Arm zerlegt `deltaZerlegung` die Mehrkosten in Posten, die
   zusammen das Delta ergeben. Preise (Opus 5) werden gegen die gemeldete `costUSD` geprüft; weicht der
   Strom von der result-Zeile ab oder passen die Preise nicht, steht der Bericht als nicht belastbar da.
7. **Bedarf** — je Informationsaufruf: schon da, teilweise da, bündelbar, ToolSearch, Graph hätte, neu
   (`bedarfsAnalyse` aus `turn-analyse.mjs`). Der freie Arm wird gegen das Golden gelesen: was hätte
   ein Graph ihm geliefert? Je Aufruf mit Grund: `node rig/greenfield-systemtest/turn-analyse.mjs <lauf> [modell]`.

Was **nicht** gemessen wird: ob die Architektur „schön“ ist. Die Kennzahlen oben sind der Ersatz;
die Beurteilung des Schnitts bleibt eine menschliche Durchsicht (Code beider Arme nebeneinander).

## Ablauf

```bash
cd graphcode
npm run build                                               # dist ist die graphcode-Version des Arms
NUR_AUFBAU=1 ARMS=gefuehrt,frei node rig/code-test/run-code.mjs   # Probe ohne Modell (Arbeitsbereiche unter ~/.graphcode-code-test/runs, RUNS_DIR)
ARMS=gefuehrt,frei node rig/code-test/run-code.mjs               # der Lauf (~2 × 10–20 $)
node rig/code-test/messen.mjs ~/.graphcode-code-test/runs/gefuehrt-0 ~/.graphcode-code-test/runs/frei-0
IMPL=$PWD/rig/code-test/referenz npx vitest run --config rig/code-test/vitest.config.ts  # Abnahme selbst prüfen
```

Die Arbeitsbereiche liegen bewusst **ausserhalb** des Repos: unter `rig/code-test/` saehe der Agent die
verdeckte Abnahme und die Referenz im Elternverzeichnis (Lauf 0: der freie Arm hat das Verzeichnis gelistet,
die Abnahme aber nach eigener Aussage und laut Stream nicht gelesen).

## Grenzen (mit den Zahlen nennen)

- n = 1 je Arm zuerst: eine Spanne, kein Konfidenzintervall. Für eine Aussage mindestens 3 je Arm.
- Eine Scheibe, eine Domäne, ein Modell.
- `gefuehrt` bekommt ein von Hand verfeinertes Modell (das Golden). Gemessen wird „modellgeführt gegen
  frei“, nicht „Auto-Spezifikation plus Code gegen frei“. Die zweite Frage wäre ein dritter Arm, der das
  Modell selbst autoriert (Phase 1 + 2 in einem Lauf).
- `import-code` erkennt FUNCs an Exporten; ein Arm, der alles in einer Closure hält, erscheint als ein
  Modul ohne FUNCs. Die Code-Kennzahlen (Block 3) fangen das auf.
