# Abschlussbericht: Embedded Executor — Local & Frontier auf einer Methode

*2026-08-01. Abschluss des Programms aus `docs/executor-harness-analysis.md` und
`docs/executor-bigpicture.md`: CR-GC-278…282, Läufe v1–v14 (devstral) plus
Opus 5 und Haiku 4.5 durch DENSELBEN Treiber. Alle Zahlen gemessen, n=1 je Arm
sofern nicht anders vermerkt.*

## Die vier Kernthesen — Status

| These | Status | Beleg |
|---|---|---|
| **Local kann den kompletten Graphen** | ✅ | devstral v14: 85 Elemente / 148 Traces, ALLE Dimensionen inkl. MS/CR, $0 |
| **Auswahl-/Steuerungs-Algo ist OK** | ✅ | Defer kappte Stagnation x31→x3; readiness-getriebener Fokus erreichte jede Dimension; Gate wies 23–81 illegale Batches je Lauf ab, ohne den Fortschritt zu stoppen |
| **Treiber funktioniert local & frontier** | ✅ | identischer Loop fuhr devstral (LM Studio), Opus 5 und Haiku 4.5 (Anthropic API) ohne Code-Verzweigung |
| **Minimal-Instruktion schlägt Frontier-Text** | ❌ widerlegt | CR-282 negativ: 22 vs. 82 Elemente — der „Ballast" (Multi-Kandidaten, Gate-Protokoll) trägt |

## Endstand aller Arme (48 Runden, gleicher Intent, gleicher Treiber)

| | devstral v12 | devstral v14 | **Haiku 4.5** | Opus 5 | Referenz: Opus im Claude-Code-Harness |
|---|---|---|---|---|---|
| Elemente / Traces | 82 / 104 | 85 / 148 | **86 / 154** | 57 / 81 | 117–143 / — |
| Error-Violations im Endgraph | 14 | 19 | **5** | 3 | 0 |
| Dimensionen (Readiness) | alloc 0.00 | inkl. **cr 0.75, ms 1.00** | uc .80 arch .90 **ver .77** | uc .83 arch .84 ver .50 | compliance 1.0 |
| Applies / Rejections | 37 / 25 | 36 / 23 | 42 / 33 | 33 / **81** | 6–10 / 0 |
| dryRun-Protokoll befolgt | 0× | 8× | **29×** | 0× | 0× |
| Token in / out | 555k / 52k | 553k / 63k | 1,00M / 116k | 1,33M / 209k | ~72k out |
| Kosten | $0 | $0 | **≈$1,58** | ≈$11,85 | $4,31–6,64 |
| Wall-Zeit | ~61 min | ~72 min | **~15 min** | ~36 min | ~15 min |

*(Kosten: $1/$5 bzw. $5/$25 pro MTok; Treiber cached nicht — s. Optimierungen.)*

## Semantische Bewertung (Hand-Audit der Elementnamen)

1. **Haiku 4.5 — Sieger.** Spricht die Domäne wörtlich: „Apply-Gate Verdicts
   deterministisch und reproduzierbar", „Batch-Validierung gegen V3_RULES",
   „Batch-Mutation atomar (All-or-Nothing)", WebSocket-Broadcast, REQs mit
   messbaren Kriterien (200ms). Schwäche: Duplikat-REQs (gleiche Anforderung
   mit/ohne „messbarem Kriterium").
2. **Opus 5 — sauber, aber flach.** Kohärent, deutsch, on-domain (Gate-Verdikt
   persistiert, Live-Update-Sitzungskonsistenz), aber weniger spezifisch und
   mit Wortschöpfungs-Ausrutschern („Kontorolle zuweisen").
3. **devstral v14 — breit, aber generisch + Duplikate.** On-domain, als
   einziger bis MS/CR-Ebene, aber Standard-Vokabular (Authenticate/Export) und
   sichtbare EN-Duplikatpaare (zwei „User generates custom reports").

**Top-Graph nach Algo UND Semantik: Haiku 4.5** (86/154, 5 Errors, beste
Scores, tiefste Domänensprache). → Input für den Planungs-Step (CR-GC-283).

## Die zwei überraschenden Befunde

1. **Opus 5 durch den Treiber ist der schwächste Arm — und das ist informativ.**
   Derselbe Opus, der im vollen Claude-Code-Harness compliance 1.0 / 0
   Rejections lieferte, produzierte durch den Emissions-Treiber 81 Rejections
   und den kleinsten Graphen. Lesart: Opus' Greenfield-Exzellenz kam wesentlich
   aus seiner *eigenen Arbeitsweise* im großen Harness (erst explorieren, dann
   bauen, eigenes Urteil über Reihenfolge) — das enge Emissions-Regime nimmt
   ihm genau das. Der Treiber isoliert das Modell; für Opus ist das eine
   Beschneidung, für kleine Modelle ein Gerüst.
2. **Haiku befolgt als einziges Modell das Gate-Protokoll** (29 dryRun-Proben,
   Verdict-Vergleich vor dem Apply) — und liefert damit das beste
   Preis/Leistungs/Qualitäts-Paket des gesamten Experiments: ~86 Elemente,
   5 Errors, 15 Minuten, $1,58.

## Erkenntnis-Destillat (was übertragbar ist)

- **Guided schlägt Modellgröße** (bestätigt aise-H3): Methode im Code
  (`graph_generate`-Fokus, Gate, Defer, Recovery) hebt ein 24B-Modell auf
  Frontier-Menge — aber die *Passung* Regime↔Modell entscheidet: Emission
  hilft kleinen Modellen und schadet großen.
- **Die teuersten Fehler waren Infrastruktur, nicht Modell:** LM-Studio-
  Kontextfenster 4755 (stille Truncation = „Dither"), Decode 16 tok/s ×
  max_tokens 8000 (= Timeouts), Mistral-Jinja-Rollenzwang, undici-300s.
- **„applied ≠ Fortschritt":** ohne Stagnations-Defer frisst ein unlösbarer
  Fund den ganzen Lauf (v11: 31 Runden). Deterministische Rotation ist Pflicht.
- **Robustheit > Format-Zwang:** die Recovery-Kaskade (Tool-Call → Prosa-JSON →
  `[ARGS]`-Text → Salvage aus gekapptem JSON) trug einen Großteil der lokalen
  Applies. `response_format`/Grammar wurden (wie schon in aise) zu Recht nicht
  verwendet.
- **Token-Ökonomie:** local 553k in für 85 Elemente ($0) vs. Haiku 1M ($1,58)
  vs. Opus 1,33M ($11,85). Der Treiber sendet System+Tools jede Runde neu —
  **ohne Caching**; mit `cache_control` auf System+Tools wäre der
  Frontier-Input-Preis grob um den Cache-Faktor (~0,1× für Reads) zu drücken.

## Offene Optimierungen (nicht blockierend)

Prompt-Caching im anthropic-Backend (System+Tools stabil je Lauf); Duplikat-
Erkennung vor add-node (alle Modelle erzeugen Beinahe-Duplikate); Best-of-N mit
Gate-Judge + Judge-Vergleichs-Logging (Design fixiert in
`executor-bigpicture.md` §6, Judge-Config Default `gate`); Zielprofil als
Runde-1-Input (Billion-User vs. Banking — heute erst im Handoff); Fund-Familien-
Defer (v13b: Nachbar-Funde derselben Familie stagnieren nacheinander).

## Was ursprünglich noch fehlt → Folgechat (CR-GC-283)

Der Ursprungsplan endet nicht beim Graphen: **(1) Planungs-Step** auf dem
Top-Graphen (se-plan: CR-Zuschnitt aus dem depends-on-DAG, ≤5 Dateien je CR,
graph_context als CR-Inhalt) und **(2) autonomes Coding** auf Graph-Basis
(graph_realize: FUNC→codeRef, TEST→testRef), jeweils Opus 5 vs. local über
denselben Treiber. Input: der Haiku-Graph
(`scratchpad/gc-run-haiku45/docs/graph/gc-run-haiku45.graph.json` — vor dem
Folgechat in ein Arbeits-Repo committen). CR-Dokument:
`docs/cr/open/CR-GC-283-plan-step-top-graph.md`.
