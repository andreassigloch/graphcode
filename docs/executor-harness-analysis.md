# Executor & Harness — braucht graphcode den vollen Coding-Agent-Prompt?

*Analyse aus dem Greenfield-System-Test (2026-07-31). Empirische Befunde zu
opencode vs. Claude Code, Frontier vs. lokalem LLM, und die Kernfrage:
muss der volle opencode/Claude-Code-Harness geladen werden, wenn graphcode sein
eigenes Betriebssystem mitbringt?*

## Kernaussage

**Nein — für reines Graph-Authoring brauchst du den vollen Coding-Agent-Harness
nicht.** graphcode liefert die *Methode* (`graph_next_step` = was tun,
`graph_authoring_guide` = legale Form, das Gate = Korrektheit, `graph_readiness` =
Zustand) bereits selbst. Ein genereller Coding-Agent (opencode, Claude Code)
liefert dieselbe Methoden-Schicht *generisch* — und schleppt dafür ~16k Token
Harness + ~15 eingebaute Tools mit, die beim Graph-Authoring fast alle tot sind.

Der Hebel ist am größten dort, wo er am meisten weh tut: **beim lokalen Modell.**
Ein minimaler Harness senkt die Kontext-Grundlast von ~16k auf ~2–3k Token —
genau das Fenster, an dem qwen im Spike scheiterte ("@22k overflow, @40k ok").

## Was diese Session empirisch gezeigt hat

### Die Executor-Schicht
| Fakt | Messung |
|---|---|
| opencode Kontext-Grundlast (Trivial-Prompt) | **input ~16.4–17.2k Token** — Harness + eingebaute Tool-Schemas, bevor irgendwas passiert |
| graphcode MCP-Tools | **22** (`graph_*`, `rules_*`, `audit_*`) |
| opencode eigene Tools obendrauf | ~10–15 (Read/Write/Edit/Bash/Glob/Grep/…) |
| MCP-Tool-Calls brauchen Permission-Bypass | ja — `--dangerously-skip-permissions` in **beiden** (Claude Codes `--permission-mode acceptEdits` grantet MCP-Tools **nicht**) |
| externe Reads (Material außerhalb cwd) | opencode blockt sie selbst mit Skip-Permissions → Material muss in den Workspace |

### Frontier vs. lokal (je 1 Lauf, gleicher Prompt, SYS vorgeseedet)
| | Opus 5 (Claude Code) | qwen3.6-35b-a3b (opencode + LM Studio) |
|---|---|---|
| Ergebnis | **117 Elemente, compliance 1.0, 0 gate-rejections** | im Aufbau / an LM-Studio-Serverstate gehangen |
| Dauer / Kosten | 873s, $4.31, 71.9k out-Token | lokal $0, aber zäh |
| Material gelesen | wenig (input nur ~8k über den ganzen Lauf) | — |
| Kaltstart ohne Seed | floundert (`next_step: null` auf leerem Graph) | floundert stärker |

**Zwei harte Lehren:**
1. **Leerer Graph = kein Halt.** `next_step` berät einen *existierenden* Graphen;
   auf leerem Grund gibt es keine Richtung. Ein einziger vorgeseedeter `SYS`-Knoten
   schaltet `next_step` scharf ("add use cases → …"). Kleine Modelle brauchen dieses
   Gerüst; Frontier kommt auch ohne aus, profitiert aber.
2. **LM Studio verträgt die Last.** Direkter `/v1/messages`-Test: **22 graphcode-Tools
   + ~15k Kontext → 200 OK, `tool_use`.** Der zwischenzeitliche "Unexpected server
   error" war transienter Server-State, keine strukturelle Grenze. → Ein direkter,
   minimaler Treiber gegen LM Studio ist technisch tragfähig.

## Die eigentliche Frage: graphcode *ist* ein Betriebssystem

Ein genereller Coding-Agent muss dem LLM generisch beibringen: was ist zu tun,
wie plane ich, wie halte ich Korrektheit. Das steckt in seinem ~16k-Prompt.
**graphcode kodiert genau diese Methode schon — domänenspezifisch und
deterministisch:**

| Was ein Coding-Harness generisch liefert | graphcodes Äquivalent |
|---|---|
| "überlege den nächsten Schritt" | `graph_next_step` (deterministisch, aus schwächster Dimension) |
| "rate die richtige Form, sonst Fehler" | `graph_authoring_guide` (legale Kanten je Typ, vorab) |
| "prüfe dein Ergebnis / Review" | das Gate (rule-checked, author-logged, blockt neue Errors) |
| "wo stehe ich" | `graph_readiness` / `rules_evaluate` |

Das ist exakt der Artikel-Claim *"the tool and the method are the LLM's problem,
not the user's"* — nur zieht der volle Coding-Harness die Methode ein **zweites
Mal** generisch drüber. Für Graph-Arbeit ist das Duplikat.

## Was der volle Harness liefert, das du ersetzen müsstest

Nicht alles ist Ballast — drei Dinge bräuchtest du weiter:
1. **Datei-Lesen für Discovery** (Read/Glob/Grep über `./material`) — reine
   `graph_*`-Tools können kein Repo lesen. Das sind **3–4 Tools**, nicht der ganze Apparat.
2. **Der Agent-Loop** — Modell aufrufen, `tool_use` ausführen, Ergebnis zurück,
   wiederholen bis `next_step` "fertig" sagt. ~50 Zeilen gegen `/v1/messages`.
3. **Fehler-/Retry-Handling** — bescheiden; das Gate liefert schon strukturierte
   Fehler mit Fix-Hinweisen zurück.

## Drei Wege (aufsteigende Radikalität)

- **(A) Harness runterkonfigurieren.** Bei bestehendem Executor bleiben, aber
  eindampfen: Claude Code `--allowedTools` (nur `mcp__graphcode__*` + Read/Glob) +
  `--append-system-prompt`; opencode via Custom-`--agent` mit reduziertem Toolset.
  *Billigster Test, aber die Grund-System-Prompts sind oft nicht voll strippbar.*
- **(B) Minimaler graphcode-Treiber.** Eigener ~50–100-Zeilen-Loop: `/v1/messages`
  (oder Anthropic-SDK Tool-Runner) mit **nur** den 22 graphcode-Tools + 3 Read-Tools
  + ~1-Seiten-System-Prompt ("autoriere entlang `next_step`, frage
  `graph_authoring_guide` vor jedem Knoten"). Grundlast ~2–3k statt 16k. *Das ist
  "graphcodes eigenes OS" wörtlich genommen — und der stärkste Hebel fürs lokale
  Modell.*
- **(C) `graph mcp` bleibt, Treiber wird Teil von graphcode.** Der Loop aus (B) als
  `graphcode run "<intent>"`-Verb — dann ist der Executor kein Fremd-Tool mehr,
  sondern gehört zur Familie. Größter Bau, sauberste Story.

## Empfehlung

Für die **These "lokal ≈ frontier"** ist **(B)** der ehrliche Test: der volle
Coding-Harness benachteiligt das lokale Modell (Kontext-Grundlast frisst sein
Fenster), und er verwässert die Aussage ("liegt es am Modell oder am 16k-Harness?").
Ein minimaler Treiber isoliert das Modell als einzige Variable — und ist zugleich
der Betriebsmodus, für den graphcode konzipiert ist.

**Reihenfolge:** erst (A) als 1-Stunden-Sanity (schafft ein reduziertes Toolset
den Authoring-Loop überhaupt?), dann (B) als das eigentliche Instrument.

## Offene Punkte / ehrliche Grenzen

- **n=1 pro Arm bisher** — alle Aussagen sind Indizien, keine Verteilungen.
- Der aktuelle Benchmark misst **Executor + Modell verschränkt** (opencode/qwen vs.
  Claude-Code/Opus). "opencode vs. Claude Code" und "Frontier vs. lokal" sind noch
  nicht entflochten — ein minimaler Treiber (B) für *beide* Modelle würde genau das lösen.
- Discovery-Qualität hängt an den Read-Tools — zu wenige und das Modell erfindet
  Module (Opus las nur ~8k Token Material und paraphrasierte trotzdem die echten Module).
- Ob ein 27B/35B-Modell den Authoring-Loop **ohne** die Robustheit des vollen
  Harness stabil durchhält, ist die eigentliche Wette von (B) — offen bis gemessen.

---

# Nachtrag: gebaut & gemessen (2026-07-31)

Weg B wurde als `rig/greenfield-systemtest/driver.mjs` gebaut und gefahren. Was
oben Hypothese war, ist jetzt Messung.

## Was der Treiber IST (Klartext)

Er ersetzt den kompletten Coding-Agent-Harness durch die **direkte Modell-API**:

```
Normal:      Modell ←→ opencode/Claude Code (~16k-Prompt, 15+ Tools, Loop, Permissions) ←→ graphcode-MCP
Treiber (B): Modell ←→ ~250-Zeilen-Skript, das die Modell-API direkt ruft         ←→ graphcode-Funktionen (in-process)
```

Kein Fremd-Harness. Der Loop: (1) Treiber fragt `graph_generate` „nächster Schritt?"
→ (2) schickt dessen Instruktion an die HTTP-API des Modells (LM Studio
`/v1/chat/completions` oder Anthropic `/v1/messages`) mit nur den graphcode-Tools +
3 Read-Tools + ~15-Zeilen-Prompt → (3) Modell antwortet mit einem `graph_mutate` →
(4) Treiber führt es gegen den Store aus → zurück zu (1), bis `done`. Die *Methode*
(was tun, welche Kanten) liefert graphcode; das Modell muss nur **emittieren**.

## Der entscheidende Pfad-Fund

Zwei Wege, das Modell autoren zu lassen — sie sind NICHT gleichwertig:
- **Roh** (`graph_next_step` + freies `graph_mutate`-`commands`-JSON): das kleine
  Modell rät die Call-Shape falsch, rät die Kanten-Grammatik falsch → thrasht.
  qwen so: **39 Knoten, 0 Kanten** (loser Haufen).
- **`graph_generate`-getrieben** (der Treiber ruft es deterministisch, injiziert
  dessen Per-Schritt-Prompt *inkl. Kanten-Grammatik*; das Modell emittiert nur):
  qwen so: **20 Knoten, 31 Kanten** (verbunden). devstral: sauberer Seed.

→ Die anfängliche Fehldiagnose „lokal kann keine verbundenen Graphen" war der
**falsche Pfad**, nicht das Modell. Der designte generative Loop (`graph_generate`
+ die `se:*`-Skills) ist Pflicht, nicht Kür.

## Coder schlägt Denker im generativen Regime

Weil `graph_generate` das „was" schon deterministisch löst, ist die Modell-Aufgabe
reine strukturierte **Emission** — eine Coder-Stärke, kein Reasoning-Job:

| | qwen3.6-35b (Reasoning) | devstral-small (Coder) |
|---|---|---|
| On-Domain (Intent „Aise") | ✗ driftete zu Zeiterfassung | ✅ Login/Import Prosa/Generate/Export |
| Seed verbunden | ✓ (aber wirr) | ✅ sauber (6–9 Kanten) |
| Dither | massiv (6× guide/Runde) | Seed in 1 Mutate |

Das Reasoning ist hier **Last, nicht Nutzen** — die verschärfte Antwort auf „brauche
ich Reasoning?": im generativen Regime nein.

## Die Grenze: Seed ✓, Expand-Wand

Über 3 devstral-Läufe konsistent:
- **Seed (SYS + ACTORs + UCs): sitzt** — on-domain, verbunden, zuverlässig (mit dem
  Mutate-aus-Text-Recovery, das devstrals Prosa-Mutates abfängt).
- **Expand (UC → FUNC/FCHAIN/MOD-Zerlegung): Wand** — churnt viele Runden, emittiert
  sogar große Decomposition-Batches (ein recoverter 14-Command-Batch), aber die
  verletzen die Grammatik (R-1x) und rollen atomar zurück → durable bleibt ~Seed-Größe.

| Phase | Lokaler Coder | Frontier (Opus) |
|---|---|---|
| Seed | ✅ zuverlässig | ✅ |
| Expand/volle Zerlegung | ✗ | ✅ (117–143 Elemente) |

## Frontier-Läufe (Opus 5 via Claude Code, n=3)

Referenz — voller Harness, EINE Prompt-Zeile, KEIN Scaffolding:

| Run | Elemente (UC/FN/MOD/REQ/TEST) | compliance | gate-rej. | out-tok | Kosten | Wall |
|---|---|---|---|---|---|---|
| #0 | 117 (8/24/16/17/17) | 1.0 | 0 | 71.9k | $4.31 | 873s |
| #1 | 143 (10/34/17/30/16) | 1.0 | 0 | 74.0k | $6.25 | 958s |
| #2 | 130 (8/35/16/23/8) | 1.0 | 0 | 72.3k | $6.64 | 969s |
| **Spanne** | **117–143** | **1.0** | **0** | ~72–74k | $4.31–6.64 | ~15 min |

Bemerkenswert **stabil in Qualität** (compliance immer 1.0, 0 rejections, Element-Zahl
±11%), **variabel in Gestalt** (jedes Mal eine andere valide Architektur, #2 sogar auf
Deutsch). Modul-Reuse per Hand-Audit: alle drei konvergieren semantisch auf die echten
sigloch-Module (paraphrasiert). Reuse als exakter Name-Match ist untauglich (0% trotz
realer Überlappung) — daher human-audit, keine Zahl.

## Erkenntnis: lokale Modelle = GANZ TIEF einsteigen

Der ehrliche Preis, ein lokales Modell zum Autoren zu bringen, war Handarbeit auf
**jeder** Ebene: Schema-Normalisierung (LM Studios strikter OpenAI-Validator),
Handlungs-Zwang-Prompt, ausbuchstabierte Call-Shape, ausbuchstabierte Kanten-Grammatik,
Node-vor-Edge-Batching, `graph_generate`-Pfad statt roh, Mutate-aus-Text-Recovery — und
*selbst dann* trägt nur der Seed, nicht Expand. **Opus brauchte davon null.** Die These
„lokal ≈ frontier" gilt nur in einem **engen, tief hand-verdrahteten Regime** (bounded
Seed/UC-Schritt); für offene Zerlegung ist der Abstand nicht Grad, sondern Art.

## Confound, ehrlich

Opus lief über den *vollen* Claude-Code-Harness, die lokalen Modelle über den
*minimalen* Treiber. „Frontier vs. lokal" und „Harness vs. Treiber" sind noch
verschränkt. Sauber wäre: Opus auch über den Treiber (Anthropic-Backend ist gebaut,
braucht nur `ANTHROPIC_API_KEY`). Offen.

---

# Nachtrag 2: Weg C gebaut — `graphcode run` + Repair-Loop (2026-07-31, Branch feat/embedded-executor)

## Korrektur des Nachtrag-1-Fazits

Nachtrag 1 schloss: „Expand-Wand — für offene Zerlegung ist der Abstand nicht Grad,
sondern Art." Diese Messung war **verfälscht**: der Rig-Treiber brach jeden Step nach
dem ersten `graph_mutate` ab — auch bei Gate-Rejection — und gab dem Modell die
violations **nie** zu sehen. Gemessen wurde Near-Miss × atomares Gate ohne
Repair-Loop, nicht Modell-Fähigkeit.

## Was gebaut wurde (CR-GC-278/279)

`src/executor.ts` + `graphcode run "<intent>"` — der Executor als Produkt-Verb,
kein opencode/Claude Code im Pfad. Auf dem Weg dahin deckten die devstral-Läufe
**sechs** reale Fallen auf, jede als Unit-Test fixiert:

1. **Repair-Loop** — Rejection beendet den Step nicht mehr; violations + fixHint
   gehen als Feedback zurück (der Rig-Denkfehler).
2. **dryRun-Falle** — das Gate-Protokoll instruiert dryRun-Proben; der Treiber
   wertete das Verdict als „applied" und beendete den Step ohne Persistenz
   (Baseline v1: **0 Elemente, exit=1**).
3. **Idle-Nudge** — devstral dithert in Prosa/Text-Tool-Calls
   (`tool[ARGS]{…}`); EIN Nachfassen pro Step statt stillem Aufgeben.
4. **Intent bei jedem generate-Call** — sonst läuft nach einem gescheiterten
   Seed-Step jede Folgerunde in die „Erfrage die Intention"-Sackgasse (headless
   unbeantwortbar) bzw. seedet off-intent.
5. **Rollen-Alternierung** — Mistrals Jinja-Template bricht bei User-Message
   nach Tool-Results; Gate-Feedback wandert in den Tool-Result-Content.
6. **Tool-Diät** (`toolset: 'authoring'`, default) — 20 Schemas pro Call trieben
   die LM-Studio-Box über 300s Time-to-first-byte (undici headersTimeout);
   der generative Loop braucht 5 graph-Tools + 3 Read-Tools.

## Messung v6 (devstral-small-2-2512, 12 Runden, authoring-Toolset) — exit 0

| Metrik | Wert |
|---|---|
| Ergebnis-Graph | **14 Elemente / 18 Traces** (1 SYS, 2 ACTOR, 6 UC, 4 FCHAIN, 1 FUNC) |
| Mutates | **5 applied / 3 rejected**, 0 dryRun-Proben |
| Große Batches | Seed R1: 16 Mutationen · **Expand R9: 30 Mutationen** · Expand R12: 6 |
| Aufwand | 12 generate-Runden, 48 Modell-Turns, 112k Token in / 7k out, $0 |
| repairedAfterRejection | **0** — Rejections konvertierten nie im selben Step |

- **Seed: bestätigt und stärker als im Rig** — 16 Mutationen in EINEM Batch,
  Runde 1. Die Tool-Diät löste zugleich die Latenz (Seed in Minuten statt Timeout).
- **Die Expand-Wand ist gebrochen, aber anders als designed:** devstral landete
  durable FCHAIN/FUNC-Zerlegung ÜBER Seed-Größe (R9: 30 Mutationen). Der Weg
  dahin war aber nicht die In-Step-Reparatur (repairedAfterRejection = 0),
  sondern die **frische Runde**: `graph_generate` re-fokussiert nach jedem
  gescheiterten Step deterministisch, und irgendwann sitzt der Batch. Der
  Repair-Loop stellte das Feedback mechanisch korrekt zu; devstral konnte es im
  Step-Budget (6 Turns) nur nicht verwerten.
- Verbleibende Reibung: Text-Tool-Calls (`tool[ARGS]{…}`, von der Nudge
  abgefangen) und Box-Timeouts bei wachsendem Step-Kontext ab ~Runde 4.

## Ehrliche Einordnung

- **„Lokal kann keine offene Zerlegung" ist widerlegt** — mit dem gebauten
  Executor liefert devstral eine verbundene, on-domain Zerlegung bis auf
  FCHAIN/FUNC-Ebene, $0, headless, kein Fremd-Harness. Aber langsam (Faktor
  ~5–6 Wall-Zeit vs. Opus) und flach (14 Elemente vs. 117–143; MOD/REQ/TEST
  fehlen noch — mehr Runden nötig, n=1).
- Der wirksame Mechanismus ist **Re-Fokus durch frische Runden**, nicht
  In-Step-Repair. Konsequenz für den Executor: Step-Budget klein halten,
  Runden-Budget groß — Runden sind der Konvergenz-Motor.

## Nachtest CR-GC-280 (v7b): die Hebel wirken mechanisch, nicht inhaltlich

Drei Hebel gebaut (`[ARGS]`-Text-Recovery, 1-Fund-Fokus im Expand, Lese-Budget-
Nudge ab dem 2. Read-Turn) und mit 24 Runden gefahren:

| | v6 (12 Runden) | v7b (24 Runden, alle Hebel) |
|---|---|---|
| Elemente / Traces | **14 / 18** | 10 / 11 |
| Applies / Rejections | 5 / 3 | **9 / 2** |
| Tiefste Ebene | FCHAIN + 1 FUNC | FCHAIN (kein FUNC/MOD/REQ) |
| Modell-Turns / Token in | 48 / 112k | 75 / 152k |

**Kriterium verfehlt** (Ziel: >14 Elemente + min. 1 MOD/REQ/TEST). Lesart: die
Hebel erhöhen die Apply-*Frequenz* (9 vs 5, weniger Rejections), aber der
1-Fund-Fokus verkleinert die Batches — v6s Tiefe kam aus EINEM 30-Mutationen-
Glückstreffer, den der Fokus konstruktiv verhindert. Beides ist n=1; die Varianz
zwischen Läufen ist hoch. Der limitierende Faktor ist inzwischen klar die
**Decode-Geschwindigkeit der lokalen Box** (Guides/Prompts sind gemessen klein,
0,8–1,3k Zeichen; Turn-Timeouts entstehen beim Schreiben langer Antworten).

- Nächste sinnvolle Hebel (offen): Fokus adaptiv (kleine Batches nur nach
  Rejection, sonst volle Zerlegung zulassen), schnellere lokale Inferenz-Box
  bzw. nur EIN geladenes Modell, Runden 48+, und der saubere Frontier-Vergleich
  über DENSELBEN Executor (`GRAPHCODE_LLM_BACKEND=anthropic`, gebaut, ungetestet).

## Auflösung (v9): das Kontextfenster war der Haupttäter

Messung nach v7b/v8: LM Studio hatte devstral mit **4755 Token Kontext** geladen
(api-Feld `loaded_context_length`; empirisch via Codewort-Test verifiziert).
Jeder Expand-Turn lief über — LM Studio truncated **still**, das Modell verlor
die Emissions-Instruktion mitten im Step. Der „Dither" war nie Modell-Unvermögen,
sondern Instruktionsverlust. Dazu zwei Interface-Fixes: `maxTokens` 8000→2048
(Box dekodiert ~16 tok/s; 8k erlaubte Token ≈ 500s = Timeout) und ein
**Salvage-Parser** (vollständige Commands aus budget-gekappten `[ARGS]`-Batches
bergen; dabei Endlosschleifen-Guard im Text-Scan gefunden/gefixt).

**v9 (16k Kontext, 24 Runden): 38 Elemente / 58 Traces** — 1 SYS, 2 ACTOR,
12 UC, 10 FCHAIN, **12 FUNC, 1 MOD**, mit satisfy/allocate-Traces. Batches bis
41 Mutationen, 8 Applies / 33 Rejections (das Gate arbeitet), erste In-Step-
Reparatur (`repairedAfterRejection: 1`). 437k in / 70k out Token, $0, headless.
Gegenüber v6 (14/18) ist das ×2,7 — das CR-GC-280-Kriterium (>14 Elemente,
≥1 MOD/REQ/TEST) ist mit dem Kontext-Fix nachträglich erfüllt.

**Stand der These:** Kein REQ/TEST nach 24 Runden (`done: false`) — Opus bleibt
bei 117–143 inkl. REQ/TEST vorn. Aber der Abstand ist jetzt messbar **Grad
(Runden, Decode-Speed), nicht Art**. Das Nachtrag-1-Fazit ist damit endgültig
revidiert. Nächster Schritt: 48-Runden-Lauf (REQ/TEST-Dimension erreichen),
danach der Frontier-Vergleich über denselben Executor.

## 48-Runden-Läufe (v10/v11): die letzte Wand ist Fund-Rotation, nicht das Modell

- **v10** deckte die Lücke „applied ≠ Fortschritt" auf: devstral addierte
  rundenlang denselben TEST-Knoten OHNE verify-Kante — die Violation blieb,
  `graph_generate` refokussierte denselben Fund endlos. → Executor bekam einen
  **Stagnations-Detektor** (identischer generate-Prompt ⇒ Eskalations-Hinweis).
- **v11 (48 Runden, mit Detektor): 38 Elemente / 48 Traces, davon 9 REQ,
  10 TEST, 10 verify** — die Verifikations-Dimension, die v9 fehlte, trägt
  lokal. 46 Applies / 5 Rejections. ABER: **43 von 48 Runden stagnierten**; ein
  einziger Fund (UID-Verwechslung `TEST-export-audit-verify` vs.
  `TEST-verify-export-audit`) fraß ~31 Runden trotz Eskalation; nur 2 FUNC,
  kein MOD, 1 Duplikat-SYS passierte das Gate.
- Quer über die Läufe: **jede Dimension ist lokal erreichbar** (v9: 12 FUNC +
  1 MOD + allocate; v11: REQ/TEST/verify) — aber noch nicht in EINEM Lauf.

**Die verbleibende strukturelle Lücke ist deterministisch, nicht modellisch:**
`graph_generate` kennt kein Defer — ein Fund, den das Modell N-mal nicht löst,
wird trotzdem endlos refokussiert. Prompt-Druck (Eskalation) durchbricht das
nur stochastisch. Folge-Hebel: **Fund-Rotation/Defer in `graph_generate`**
(nach N erfolglosen Runden den Fund zurückstellen, nächsten fokussieren) —
ein graphcode-CR (generate.ts), kein Executor-Thema. Danach ist der lokale
Pfad rund; dann Frontier-Vergleich über denselben Executor.

## v12 (CR-GC-281: Defer + temperature 0.2): der Durchbruchslauf

| | v9 | v11 | **v12 (48 Runden)** |
|---|---|---|---|
| Elemente / Traces | 38 / 58 | 38 / 48 | **82 / 104** |
| Dimensionen | FUNC+MOD, kein REQ/TEST | REQ/TEST, kaum FUNC | **ALLE: 42 FUNC, 3 MOD, 2 REQ, 3 TEST** |
| Max-Stagnation | — | **x31** | **x3** (Defer kappt deterministisch) |
| repairedAfterRejection | 1 | 1 | **5** |
| Applies / Rejections | 8 / 33 | 46 / 5 | 37 / 25 |
| Token in/out | 437k / 70k | 416k / 16k | 555k / 51k · $0 |

Der Defer wirkt exakt wie designed: 3 Stagnations-Schleifen, jede nach 3 Runden
gekappt statt 31. `done: false` — das Wachstum war bei Rundenende nicht
ausgeschöpft. Abstand zu Opus (117–143, compliance 1.0) ist damit rein
**quantitativ** (Runden × Decode-Speed) — auf derselben Methode, $0, headless.
Offene Hebel jetzt in `docs/executor-bigpicture.md` §5–6 (CR-GC-282:
Rendering-Profile, Best-of-N mit Gate-Judge, Zielprofil als Initial-Schritt).

---

*Quelle: Greenfield-System-Test, `rig/greenfield-systemtest/` (`driver.mjs`,
`run.mjs`, `metrics.mjs`, `report.mjs`). Verwandt:
[`SPIKE-GC-loop-executor-benchmark`](spikes/SPIKE-GC-loop-executor-benchmark.md)
(dort schon: "opencodes schlanker Harness ist der lokale Pfad" — dieses Doc geht
zwei Schritte weiter: kein fremder Harness, und der `graph_generate`-Pfad ist Pflicht).*
