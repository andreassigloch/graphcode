# CR-GC-294 — Skill-Spektrum für Treiber-Fähigkeit (Bestandsaufnahme, kein Bau)

**Status:** open — Bestandsaufnahme, bewusst nicht scharf geschaltet
**Datum:** 2026-08-04
**Kontext:** CR-GC-283-Folgechat. Der eingebettete Executor (Treiber) deckt heute ausschließlich die
8 generativen Readiness-Dimensionen ab (`GENERATION_TEMPLATE` in `src/generate.ts`). Der restliche
Skill-Katalog (`.claude/commands/se/*.md`, `se-view:*`) läuft ausschließlich im Host-Modus
(Claude Code/OpenCode) — ein lokales/schwaches Modell kann sie heute nicht fahren.

## Ausgangslage

Frage im Folgechat: "muss ich alle Skills als Local-Breakdown-Variante bauen, oder kann ich mit
local gar keine Skills fahren?" — Antwort ist weder "alle" noch "keine". Die Skills liegen auf
einem echten Aufwand-/Unsicherheits-Spektrum, abhängig davon, ob ein klares Regel-Violation-Signal
existiert (wie bei den 8 Dimensionen), das eine Runden-Instruktion tragen könnte.

## Bestandsaufnahme (vier Buckets)

1. **Bereits abgedeckt** — `se:author-uc`, `se:author-req`, `se:generate`: sind der Treiber, keine
   weitere Arbeit.
2. **Praktisch kostenlos** — `se-view:*` (12 Views), `se-status`, `se-review`, `se:help`, `se-retro`:
   schon deterministische Reports/Renderer (CR-GC-220-Exporter bzw. reine Lookups), kaum
   LLM-Urteil nötig. Ein Treiber-Pfad wäre größtenteils Verkabelung, kein neues Verfahren.
3. **Günstig, weil schon algorithmisch** — `se-plan` (Kern ist ein topologischer Sort über
   depends-on-Kanten, CR-Zuschnitt danach größtenteils mechanisch), `se:close-violations`
   (Kandidaten ranken + Gate — strukturell nah am Best-of-N-Muster aus CR-GC-288/289, plausibel
   wiederverwendbar).
4. **Echtes offenes Problem** — `se-fmea`, `se-irr`, `se-trade`: brauchen echtes Domänen-Urteil
   (Risikobewertung, unbewiesene Annahmen erkennen, Tradeoffs abwägen), kein Regel-Violation-Signal
   in der Form, die eine Runden-Instruktion tragen könnte. Unsicher, ob eine Zerlegung überhaupt
   sinnvoll ist, bevor nicht am echten Modell probiert wurde.

**Nicht Treiber-tauglich, strukturell** — `se-test`, `se-test-ui`: Denk-Anleitungen für Testdesign,
keine Graph-Content-Erzeugung. Kein Kandidat für dieses Muster, unabhängig vom Aufwand.

## Ziel dieses CRs

Nur die Bucket-Einteilung festhalten, priorisiert für einen möglichen Folge-CR:
1. Bucket 2 zuerst (praktisch kostenlos, klärt ob das Verkabelungs-Muster trägt)
2. Bucket 3 danach (`se-plan`, `se:close-violations` — algorithmischer Kern vorhanden)
3. Bucket 4 nur nach einem gezielten Spike, nicht blind gebaut

**Kein Code in diesem CR.** Umsetzung jedes Buckets wäre ein eigener, kleiner CR (≤5 Dateien je
Skill/Bucket), nicht hier gebündelt.

## Nachtrag 2026-08-04: Bucket-4-Spike konkretisiert (Testfälle aus dem Semantik-Review)

Das semantische Review der Top-Graphen liefert vier REALE Defekte als messbare
Spike-Testfälle — der Bucket-4-Spike ist damit ein Experiment statt einer vagen
Frage. Setup: bestes Local-Modell (qwen3.6-35b-a3b, s. results-README), je
Skill EINE Runden-Instruktion im Treiber-Stil, Erfolg = Defekt wird ohne
Vorsage gefunden:

| # | Testfall (real, aus results/) | Skill | Erfolgskriterium |
|---|---|---|---|
| 1 | devstral-v20: REQ verlangt „JSON, XML, CSV", UC sagt JSON/Format-E | se-irr | Modell benennt die XML/CSV-Behauptung als unbelegte Annahme + den UC↔REQ-Widerspruch |
| 2 | devstral-v18: „Login Requirements Missing Requirement" als UC | se-irr (oder author-uc-Nachprüfung) | Modell erkennt Meta-Artefakt (kein Actor/Verb/Ergebnis) |
| 3 | qwen35a3b: „gemeinsam autorieren" ohne Concurrency/OCC-REQ | se-fmea | Failure Mode „konkurrierende Writes" wird gefunden + Mitigations-REQ vorgeschlagen |
| 4 | qwen35a3b: Apply-Gate nur als FUNC, keine Governance-REQs | se-fmea | Failure „ungültiger Batch persistiert" → abgeleitete REQ |

Auch ein Teilergebnis ist ein Ergebnis (z.B. „irr findet 1+2, fmea braucht
Frontier") — es entscheidet, welcher Teil von Bucket 4 treiber-fähig wird und
welcher Host-only bleibt.

## Abgrenzung

- Keine Änderung an Rules/Preflight/ΔM/ℝ⁶ — reine Scope-/Priorisierungs-Entscheidung.
- Kein Zeitdruck — nächster Schritt erst nach der aktuellen Optimierungsrunde (siehe
  CR-GC-283-Folgechat: "nach Abschluss dieser Runde normale Durchläufe mit human-in-the-loop").

## Akzeptanzkriterien

- [x] Vier Buckets benannt und begründet
- [ ] Priorisierung bestätigt oder korrigiert (User-Entscheidung, vor jedem Folge-CR)
- [ ] Bucket 2 als erster Folge-CR angelegt, wenn freigegeben
