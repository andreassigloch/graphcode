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

*Quelle: Greenfield-System-Test, `rig/greenfield-systemtest/` (`driver.mjs`,
`run.mjs`, `metrics.mjs`, `report.mjs`). Verwandt:
[`SPIKE-GC-loop-executor-benchmark`](spikes/SPIKE-GC-loop-executor-benchmark.md)
(dort schon: "opencodes schlanker Harness ist der lokale Pfad" — dieses Doc geht
zwei Schritte weiter: kein fremder Harness, und der `graph_generate`-Pfad ist Pflicht).*
