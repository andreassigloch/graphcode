# CR-GC-358 — Denk-Budget als Config (`reasoning_effort`) für Reasoning-Modelle

**Status:** open
**Datum:** 2026-08-16
**Kontext:** `rig/greenfield-systemtest/results/README.md` (Ergebnisreihe), Baseline-Arm
`qwen35a3b` (12 Rd., N=3, ohne Injektion, maxTokens 8192 → 53 El / 69 Tr, 28 min).

## Ausgangslage

Der erste Benchmark-Versuch mit **qwen3.8-27b-mlx@4bit** ist gescheitert: **32 von 33
Kandidaten-Calls** brachen mit `The operation was aborted due to timeout` ab, genau
1 Batch kam durch (Runde 1, 21 Mutationen). 11 der 12 Runden liefen leer, inkl. 2×
Stagnations-Defer. Kein verwertbarer Messwert — der Lauf wird NICHT in die
Ergebnisreihe eingetragen.

## Root Cause (gemessen, nicht vermutet)

Zwei Effekte, die sich multiplizieren:

1. **Decode-Rate.** qwen3.8-27b ist **dense**; die Baseline qwen3.6-35b-**a3b** ist ein
   MoE mit ~3B aktiven Parametern. Gemessen auf M4 Pro / 48 GB: **14,8 tok/s**. Der
   `callTimeoutMs`-Default von 180 s (`executor.ts`) war für die MoE-Rate dimensioniert.
2. **Denk-Länge.** Qwen3.8 hat Thinking per Default an. Ohne Budget-Schalter denkt es
   pro Call ein Vielfaches dessen, was es an Antwort produziert.

Nicht die Ursache — geprüft und verworfen: die Qwen-Doku warnt vor Greedy-Decoding
(„performance degradation and endless repetitions"), unser `temperature 0.15` liegt
nahe daran. In einem Tool-Call-Setting mit Schema tritt der Effekt aber **nicht** auf;
die Sampling-Matrix unten zeigt das Gegenteil.

## Messung — Sampling-Matrix, identischer Prompt + `graph_mutate`-Schema

| Config | Wall | Completion | davon Reasoning | finish | Batch |
|---|---|---|---|---|---|
| A `temp 0.15` (Ist-Zustand) | 39 s | 504 | 229 | `tool_calls` | 5/5 Commands |
| B Qwen-offiziell `t1.0/p.95/k20/minp0` | 68 s | 1015 | 815 | `tool_calls` | 5/5 Commands |
| C = B + `presence_penalty 1.5` | 47 s | 698 | 367 | `tool_calls` | 5/5 Commands |
| **D = B + `reasoning_effort=low`** | **25 s** | 376 | **175** | `tool_calls` | 5/5 Commands |
| E `enable_thinking:false`, `t.7/p.8/pp1.5` | 26 s | 383 | 147 | `tool_calls` | **defekt** |

Drei Befunde:

- **`reasoning_effort` ist der Hebel**: 2,7× schneller als die offiziellen Parameter bei
  identischem Batch. Der LM-Studio-Bugtracker-Eintrag #988 („API-Wert wird ignoriert,
  nur die UI zählt") ist für diese Version **veraltet** — der Parameter wirkt.
- **Die offiziellen Qwen-Sampling-Empfehlungen sind für Chat, nicht für Agenten-Loops**:
  B kostet 3,5× Reasoning gegenüber A ohne besseres Ergebnis. `temp 0.15` bleibt richtig.
- **Thinking abschalten (E) zerstört die Tool-Call-Struktur**: `commands` kam als
  JSON-String statt als Array. Kein gangbarer Weg.

## Änderung

`reasoningEffort` als **optionaler** Config-Wert (`none|minimal|low|medium|high|xhigh`),
der nur dann in den openai-Request-Body geht, wenn er gesetzt ist — Backends ohne das
Feld dürfen den Request nicht wegen eines unbekannten Feldes ablehnen.

- `src/executor.ts` — Schema-Feld + `reasoning_effort` im `/v1/chat/completions`-Body
- `src/run-verb.ts` — `GRAPHCODE_LLM_REASONING_EFFORT`
- `tests/cli.run.test.ts` — Env-Parsing (inkl. ungültiger Wert wirft) **und** ein Test,
  der `buildCallModel` mit gestubbtem `fetch` fährt: Feld im Body wenn gesetzt, Feld
  ABWESEND wenn nicht

Bewusst **nicht** geändert: `temperature`, `top_p`/`top_k`/`min_p`/`presence_penalty`.
Die Matrix zeigt keinen Nutzen für unseren Fall; ein Passthrough ohne Messbeleg wäre
ein Parallelpfad ohne Anforderung.

## Akzeptanzkriterien

- [x] `npm run build` grün, `tests/cli.run.test.ts` grün
- [x] Test verifiziert, dass das Feld unkonfiguriert NICHT gesendet wird
- [ ] Benchmark-Lauf qwen3.8 mit `reasoning_effort=low` liefert einen verwertbaren
      Endgraphen; Zeile in `rig/greenfield-systemtest/results/README.md` ergänzt
- [ ] Timeout-Empfehlung für dense-Modelle dokumentiert (`GRAPHCODE_LLM_TIMEOUT_MS`,
      Faustregel `maxTokens / Decode-Rate` + Prefill-Reserve)

## Nachtrag — der Verifikationslauf deckte ZWEI tiefere Ursachen auf

Lauf v2 (12 Rd., N=3, `injection=false`, `reasoning_effort=low`, `TIMEOUT_MS=600000`)
wurde nach 26 min abgebrochen: Runde 1 applied 18 Mutationen (**0 Timeouts** — die
Änderung oben wirkt), Runde 2 verlor alle 3 Kandidaten, Endstand **8 Elemente**
(1 SYS, 5 UC, 2 ACTOR). Zwei Ursachen, beide NICHT durch `reasoning_effort` behebbar:

**(a) Der Executor-Prompt widerspricht sich bei `injection=false`.** Aus dem
LM-Studio-Log, wörtlich aus dem Reasoning des Modells: *„this is a direct conflict"*,
*„this is getting circular"* — danach `tool_calls: []` nach **4347 Reasoning-Token**.

- `executor-prompt.ts` (`SYSTEM`, konstanter String) behauptet **unbedingt**:
  Kanten-Grammatik steht „BEREITS in der Instruktion — rufe `graph_authoring_guide`
  NICHT dafür auf".
- `generate.ts:65` fordert das Gegenteil: „Gate-Protokoll: (1) vor dem Schreiben
  `graph_authoring_guide` für jeden Elementtyp aufrufen".
- Aufgelöst wird das **nur** durch `buildRoundInjection`, die den Satz „Gate-Protokoll
  Schritt 1 ist damit erledigt" mitliefert — die läuft aber nur bei `injection=true`.
- Zweiter Widerspruch derselben Klasse: R-14-Fund („FCHAIN via compose ergänzen") neben
  R-15-Hinweis („KEINE neue FCHAIN/UC anlegen").

Tragweite über qwen3.8 hinaus: `injection=false` ist die Konfiguration **aller lokalen
Bestlaufe** (v20-noinject, qwen35a3b) und der Local-Default-Vorschlag aus CR-GC-297.
devstral und qwen3.6-35b-a3b haben den Widerspruch nie bemerkt. Die Ergebnisreihe misst
insoweit mit, wie gut ein Modell eine inkonsistente Instruktion **ignoriert** — das ist
kein gewolltes Messkriterium.

**(b) `callTimeoutMs` ist unterhalb von 300 s wirkungslos.** Node/undici erzwingt ein
eigenes `headersTimeout` von 300 s, das unabhängig vom `AbortSignal` feuert und als
nacktes `fetch failed` durchschlägt (in `docs/executor-harness-analysis.md` Punkt 6
bereits 2026 belegt: „über 300s Time-to-first-byte (undici headersTimeout)"). Der
Executor setzt keinen `dispatcher`, also gilt der Default: **300 s harte Obergrenze pro
Call**, egal was `GRAPHCODE_LLM_TIMEOUT_MS` sagt. Ein Config-Wert, den eine tiefere
Schicht still überstimmt, ist eine Lüge im Schema.

Beides gehört gefixt, BEVOR eine qwen3.8-Zahl in die Ergebnisreihe geschrieben wird.
Vorschlag (eigener CR bzw. Erweiterung dieses):
1. `SYSTEM` von Konstante auf `buildSystem(injection: boolean)` — die
   „steht-BEREITS-in-der-Instruktion"-Zusage nur bei `injection=true`.
2. R-15-Hinweis nur rendern, wenn tatsächlich eine leere FCHAIN existiert.
3. `undici.Agent` mit `headersTimeout`/`bodyTimeout` aus `callTimeoutMs` ableiten.

## Offen / nicht in diesem CR

Der `callTimeoutMs`-Default bleibt bei 180 s. Er ist für die lokale MoE-Rate richtig;
ein dense-Modell braucht ihn größer, aber ein Default kann nicht beide Klassen treffen.
Ob der Executor die Decode-Rate messen und den Timeout selbst dimensionieren sollte,
ist eine eigene Frage (Folge-CR, nicht hier entschieden).
