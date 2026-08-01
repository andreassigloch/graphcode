# Executor Big Picture — dieselbe Pipeline, zwei Welten

*2026-08-01. Antwort auf drei Fragen: (1) Was geben Claude Code und unser
Treiber jeweils WIRKLICH an die LLM? (2) Sind unsere Zerlegungen/Prüfungen/
Feedbacks minimal genug für lokal? (3) Was lehren aise/graphengine dazu?
Quellen: Payload-Messung am Treiber (heute), Greenfield-Läufe v1–v11,
aise/graphengine-Code-Recherche (Pfade unten).*

## 1. Das Big Picture: die Schritte sind immer dieselben — nur der ORT wechselt

Jede Graph-Autorierung durchläuft dieselben sechs Schritte. Der einzige
Unterschied zwischen „Claude Code als Executor" und „unser Treiber": **wer**
jeden Schritt ausführt — die LLM oder deterministischer Code.

| Schritt | Claude Code (Frontier-Modus) | Unser Treiber (`graphcode run`) |
|---|---|---|
| 1. Nächsten Schritt bestimmen | **LLM** überlegt selbst (Planung im 16k-Harness; darf `graph_next_step` befragen, muss aber nicht) | **deterministisch**: Treiber ruft `graph_generate` — readiness-getrieben, schwächste Dimension |
| 2. Legale Form beschaffen | **LLM** entscheidet, ob/wann sie `graph_authoring_guide` ruft | Kanten-Grammatik steckt **im injizierten Prompt**; Guide-Tool optional dazu |
| 3. Batch formulieren | **LLM** | **LLM** ← der EINZIGE echte LLM-Job |
| 4. Prüfen | Gate (deterministisch) — plus LLM-Selbstreview obendrauf | Gate (deterministisch), sonst nichts |
| 5. Fehler-Reaktion | **LLM** liest Gate-Result, entscheidet selbst Retry-Strategie | **deterministisch**: Repair-Loop (violations+fixHint zurück), Idle-Nudge, Lese-Budget, Stagnations-Defer |
| 6. Wiederholen bis fertig | **LLM** entscheidet, wann Schluss ist | **deterministisch**: Runden-Loop bis `done` oder Cap |

Frontier verträgt es, Schritte 1, 2, 5, 6 der LLM zu überlassen — lokal stirbt
genau daran. Der Treiber verschiebt alles außer Schritt 3 in Code. **Das ist
dieselbe Bewegung, die aise damals machte** (CR-043: „classify → extract →
connect deterministic") — und deren Messung H3 bestätigte: *„Guided+Local
(devstral) erreicht 99 % Readiness in 1 Runde vs. Blind 7 Runden; Guided+Local
0.98 = Guided+Claude 0.98"* (aimpro CR-164). Deine Erinnerung „devstral hat
munter Graphen erzeugt" stammt exakt aus diesem Guided-Regime.

## 2. Konkretes Beispiel: was geht über den Draht?

### 2a. Claude Code → LLM (ein Turn im Greenfield-Lauf)

```
[System-Prompt]        ~13–16k Token   Agent-Regeln: Tools, Git, Hooks, Todo-
                                       Verhalten, Sicherheit, Stil, Env, …
[Built-in-Tools]       ~15 Schemas     Read/Write/Edit/Bash/Glob/Grep/Task/…
[MCP-Tools graphcode]  22 Schemas      ~4,8k Token (gemessen: 17.182 chars)
[CLAUDE.md etc.]       projektabhängig
[User-Prompt]          1 Zeile         „Baue die Architektur…"
[Session-History]      WÄCHST          jedes Tool-Result bleibt bis Session-Ende
──────────────────────────────────────
Grundlast vor dem ersten eigenen Wort: ~16,4–17,2k Token (Rig-Messung),
History on top — Turn 50 sieht alles von Turn 1–49.
```

### 2b. Unser Treiber → LLM (ein Turn, real gemessen, authoring-Toolset)

```
[System-Prompt]   1.109 chars ≈ 300 tok   Rolle, exakte graph_mutate-Form,
                                          Repair-Regel, Handlungs-Zwang
[Tools]           4.823 chars ≈ 1.340 tok 8 Schemas: mutate, authoring_guide,
                                          get_node, elements, readiness,
                                          list_dir, read_file, grep
[Instruktion]       ~830–1.000 chars      ↓ der komplette User-Turn:
──────────────────────────────────────
„Kaltstart aus der Intention: '…' — Schlage EINEN Seed-Batch vor: 1 SYS-Wurzel
(description = die Intention wörtlich), 1–3 ACTORs (…) und 3–7 UCs (je
Actor–Verb–Objekt–Ergebnis, ≤25 Wörter, ACTOR io→UC, SYS compose UC). Keine
FUNC/MOD-Ebene im Seed. [Gate-Protokoll: dryRun-Verdicts vergleichen, …]
Emittiere GENAU diesen Schritt als EINEN graph_mutate-Aufruf im commands-Format
({"commands":[{"op":"add-node",…}]})."
──────────────────────────────────────
Total Turn 1 eines Steps: ~2k Token. History: NUR innerhalb des Steps
(Guide-Results, Gate-Feedback) — jede generate-Runde beginnt frisch.
```

Der Faktor ist ~8× Grundlast — aber der strukturell wichtigere Unterschied ist
die **History-Politik**: Claude Code akkumuliert die ganze Session (und
Frontier navigiert das souverän), der Treiber resettet pro Runde. Lokal ist das
kein Nice-to-have: die v8-Timeouts entstanden schon durch Step-interne History.

## 3. Minimalitäts-Audit: wo wir noch NICHT minimal sind

Der Verdacht stimmt — drei Stellen tragen Frontier-Gepäck, das lokal Rauschen
oder aktiv schädlich ist:

1. **Das Gate-Protokoll im generate-Prompt** (~450 Zeichen, in JEDER Runde):
   „Alternativen als dryRun einreichen, tier/fitAdvisory vergleichen, besten
   Batch anwenden". devstral hat das über alle Läufe **0-mal** befolgt
   (`dryRunProbes: 0`) — für lokal ist es totes Gewicht mit Ablenkungsrisiko.
   Für Frontier (das es wirklich nutzt) ist es wertvoll. → **Empfänger-abhängig
   rendern**: lokal ersetzen durch eine Kurzform im aise-Stil „CRITICAL ERRORS
   TO AVOID" (CR-054-Muster: je harter Regel ein falsch/richtig-Paar, generiert
   aus den Rules — nicht von Hand gepflegt).
2. **Widersprüchliche Batch-Größen-Instruktionen**: das expand-Template sagt
   „Schlage je Fund 2–3 Kandidaten vor", unser EXPAND_FOCUS-Overlay sagt „NUR
   den ERSTEN Fund, ≤6 Commands". Frontier geht drüber weg, lokal gehorcht
   zufällig einer der beiden Stimmen. → Template parametrisieren statt
   überstimmen.
3. **Keine Temperatur gesetzt**: der Treiber sendet keine `temperature` — LM
   Studio nimmt den Modell-Default. aise hat für Graph-/Strukturarbeit lokal
   durchgängig **0.1–0.3** gefahren (t5: 0.3; aimpro-Tier: 0.1; grphzr-pdf:
   0.1). Die UID-Halluzinationen (`TEST-export-audit-verify` vs.
   `TEST-verify-export-audit`, 31 verlorene Runden in v11) sind genau die
   Fehlerklasse, die niedrige Temperatur dämpft. → billigster offener Hebel.

Was dagegen schon minimal/richtig ist (mit aise-Beleg):

- **Kein Voll-Graph im Prompt** — nur die 1–3 fokussierten Violations. Das ist
  aise' ContextManager-Prinzip („~3K statt ~15K Token pro Call") in schärferer
  Form.
- **Recovery-Kaskade statt Format-Erzwingung** — aise hat `json_object`/
  response_format gegen lokale Modelle explizit verworfen („not supported, rely
  on prompt instead") und Grammar/GBNF geprüft und abgelehnt; toleranter
  Parser + Validierung danach war deren Antwort. Unsere Kaskade (Tool-Call →
  Prosa-JSON → `[ARGS]` → Salvage) ist dasselbe Muster, weiter ausgebaut.
- **Repair mit Gate-Feedback** — aise: „[VALIDATION FAILED - AUTOMATIC RETRY]
  + ImpactReport, max 2 Retries". Unser Repair-Loop + Stagnations-Defer ist die
  Weiterentwicklung (Defer gab es dort nicht — dafür hatten sie das Problem
  auch: „LM Studio Timeout bei komplexen Prompts → manche Runden scheitern",
  CR-164).

## 4. Die aise/graphengine-Lehren im Überblick

| Lehre (belegt) | Messung dort | Status in graphcode |
|---|---|---|
| **Prompt-Splitting** („chunked"): 1 Task → N kleine sequenzielle Calls (t5: schemas→routes→tests; grphzr-pdf: 2-Pass entities→relations) | Chunked+devstral: 4,2k in/2,7k out vs. Claude-Arme 434k–1.992k in (~100× weniger); Fix-Loop +571 % Testqualität | ✅ strukturell da: generate-Runden + 1-Fund-Fokus |
| **„Streaming" = UI-Latenz, nicht Modell-Entlastung**: SSE-Parser emittiert fertige `<operations>`-Blöcke früh | Latenz-Zahlen nur für Anthropic dokumentiert | Erinnerung korrigiert: die Lokal-Entlastung kam vom Splitting, nicht vom Stream |
| **Format E** (zeilenbasiert statt JSON) für Graph-Kontext | 74 % Token-Reduktion (18,6k→4,8k); Format-Wahl = **17 Punkte Genauigkeit** lokal (91,7 % vs. 75,0 %) | teilrelevant: unser Prompt trägt keinen Voll-Graphen; Kandidat für `graph_elements`-Results (`id\|type\|name`-Zeilen statt JSON) |
| **Kontext-Slicing** (ContextManager: task-klassifiziert, Tiefe schrumpft bis Budget hält) | ~3k statt ~15k Token/Call | ✅ schärfer gelöst (nur Violations) |
| **Preventive Prompting**: „CRITICAL ERRORS TO AVOID" generiert aus ontology-rules | CR-054 | ❌ offen — Ersatz fürs Gate-Protokoll im Lokal-Pfad |
| **Temperatur 0.1–0.3 lokal** | durchgängige Praxis | ❌ offen — Treiber setzt keine |
| **Tier-Fallback** local→Claude bei Fehlschlag, `fallback_used` geloggt | llm-gateway | Zukunftsoption für `graphcode run` |
| **Guided schlägt Modellgröße** (H3) | Guided+Local 0.98 = Guided+Claude 0.98; Blind+Local 0.82 | ✅ ist die Existenzbegründung des Treibers |

*Quellpfade: `dev/aise/graphengine` (ContextManager, Format E, CR-034/053/054),
`dev/aise/PromptCompression` (Local-vs-Claude-Analyse, Structured-Output-
Research), `dev/aise/grphzr-pdf` (2-Pass, LocalProvider), `dev/aimpro`
(t5-Benchmark, CR-043/164/173, llm-gateway, llm-reviewer).*

## 5. Konsequenz — die nächsten Hebel, sortiert nach Kosten/Nutzen

1. **`temperature: 0.2` in den Treiber-Request** (1 Zeile; dämpft die
   UID-Fehlerklasse, die v11 31 Runden kostete).
2. **Lokal-Prompt-Variante**: Gate-Protokoll raus, generierte
   Fehlervermeidungs-Kurzliste rein (CR-054-Muster); Batch-Größen-Widerspruch
   auflösen. Frontier behält den vollen Text — Empfänger-abhängig, kein Fork
   der Methode.
3. **Fund-Rotation/Defer in `graph_generate`** (CR-GC-281, in Arbeit) — die
   deterministische Antwort auf festgefressene Funde.
4. Optional: `graph_elements`-Results als `id|type|name`-Zeilen (Format-E-
   Muster) statt JSON — drückt die Step-interne History.

Danach ist der lokale Pfad methodisch komplett — und der Frontier-Vergleich
über denselben Treiber (`GRAPHCODE_LLM_BACKEND=anthropic`) misst erstmals nur
noch das Modell.
