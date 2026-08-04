# CR-GC-290 — Runden-Prompt-Vollständigkeit (arch-Batches, Fund-Fenster, Score-Ballast)

**Status:** done (2026-08-04, inkl. Nachtrag: Messlauf deckte einen zweiten, schwereren
Befund auf — R-15/uc-Template-Lücke — mitgefixt und live verifiziert, s.u.)
**Datum:** 2026-08-03
**Kontext:** CR-GC-283-Folgechat, Audit-Analyse über alle Greenfield-Systemtest-Läufe
(`rig/greenfield-systemtest/results/audit/*.jsonl`, ~20 Läufe inkl. dem CR-289-validierten
`v18-bo3`). CR-289 hat die Best-of-N-Auswahl selbst schon auf Readiness-Delta umgestellt
(kein Volumen-Bias mehr) — dieser CR behebt einen davon unabhängigen, in JEDEM Lauf
sichtbaren Rest: Rundeninhalte, die das Modell nicht zur Batch-Vollständigkeit anleiten.

## Ausgangslage (gemessen, nicht spekuliert)

- **R-02/R-20/R-22-Triade** (FUNC erfüllt keine REQ / kein realRef / nicht alloziert):
  aggregiert 170/251/266 Treffer über alle Läufe — **auch im saubersten bisherigen Lauf**
  (`v18-bo3`, CR-289-validiert, 0 Gate-Rejections) noch je 13×. Root Cause: das
  `'req'`-Template (`GENERATION_TEMPLATE.req`) verlangt explizit "REQ **zusammen mit**
  einem TEST im selben Batch" — das `'arch'`-Template verlangt nur "Zerlege die
  FCHAIN/FUNC-Ebene", ohne die satisfy-/allocate-Kante im selben Atemzug zu verlangen.
  Anders als R-01 (REQ ohne TEST) ist das NICHT durch CR-284-Preflight auto-reparierbar:
  welche REQ ein FUNC erfüllen soll, ist keine deterministisch erratbare Ergänzung wie
  ein generischer TEST-Stub — das muss die Runden-Instruktion selbst verlangen.
- **R-15** (FCHAIN ohne FUNC-Mitglieder): jetzt der dominante Rest-Befund — 34 Treffer
  allein in `v18-bo3` (mehr als alle anderen Regeln dort zusammen). Ein Fund-Fenster der
  `'uc'`-Dimension kann heute gleichzeitig ein R-15-Finding (leere FCHAIN) und ein
  UC-01-Finding (UC ohne REQ) enthalten (real reproduziert, `gc-run-haiku45`, Batch
  `audit-1785579447396-8092tv`) — die Fund-Fenster werden nicht nach `rule_id` sortiert,
  bevor sie in 3er-Blöcke geschnitten werden, wodurch FCHAIN-Erzeugung und
  FUNC-Population sich über Runden hinweg verschränken statt sich sauber abzuschließen.
- **`(Score X, N Funde)`**: reine Telemetrie im Runden-Prompt (`generationStep`,
  `expand`-Phase) — die Fokus-Wahl ist zum Zeitpunkt der Prompt-Erzeugung bereits im
  Treiber-Code entschieden; das Modell kann mit der Zahl nichts anfangen außer den 3
  konkret gelisteten Funden. Kein Beleg, dass sie hilft; jedes Zeichen Prompt kostet.

## Ziel

Drei lokal isolierte Änderungen in `src/generate.ts`, keine an Rules/Preflight/ΔM/ℝ⁶:

1. **`GENERATION_TEMPLATE.arch`** erweitern: "Schlage je Fund 2 alternative FUNC/FCHAIN-
   Zerlegungen vor — **jede neue FUNC zusammen mit satisfy→REQ und allocate→MOD im
   selben Batch** (fehlt die REQ oder das MOD im Graphen, zuerst anlegen)." Spiegelt das
   bereits funktionierende req-Muster.
2. **Fund-Fenster-Bildung** (`violationsOf(dimension)` in `generationStep`): vor dem
   3er-Fenster-Schnitt zusätzlich nach `rule_id` gruppieren (stabil, `rule_id` dann
   `element_id` wie bisher) — ein Fenster enthält damit nur EINE Regelsorte, nie FCHAIN-
   und UC-Level-Funde gemischt.
3. **`(Score X, N Funde)`** aus dem `expand`-Prompt-String streichen; die "Funde:
   ..."-Liste bleibt (das ist die tatsächlich actionable Information).

## Abgrenzung

- `RULE_TO_DIMENSION`, `evaluateAllRules`, `computeReadiness`, `steeringDelta` (CR-289),
  Preflight (`src/preflight.ts`) — alle unverändert. Reine Prompt-Text- und
  Windowing-Änderung in `generate.ts`.
- Kein Zielprofil, kein ℝ⁶-Bezug.
- `GENERATION_TEMPLATE.alloc` bleibt unverändert (verlangt bereits allocate-Kanten als
  Kern der Dimension selbst) — nur `arch` bekommt die satisfy/allocate-Ergänzung, weil
  dort FUNCs neu entstehen, die noch keine Bindung haben.

## Nachtrag 2026-08-04 — Messlauf deckte einen zweiten Befund auf (R-15/uc), mitgefixt

Zwei Messläufe (devstral, `v18-bo3`-Konfiguration: 24 Runden, Best-of-3, judge=gate,
MIT den drei obigen Änderungen aktiv) liefen gegen `http://localhost:1234`
(mistralai/devstral-small-2-2512). **Beide stagnierten alle 24 Runden lang in der
`uc`-Dimension** (`focus(uc)` in 52/55 Kandidaten-Zeilen) und produzierten NUR
ACTOR/UC/FCHAIN (44 UC / 35 FCHAIN / 10 ACTOR / 1 SYS, **0 REQ/TEST/FUNC/MOD**,
44 UC-01-Errors) — ein Regression gegenüber dem `v18-bo3`-Referenzlauf (40 El./78 Tr.,
voller Typ-Mix, 2 Errors). R-12 (Ziel der Nachzähl-Frage von CR-GC-292) kam dadurch nie
zur Auswertung, weil die `arch`-Ebene nie erreicht wurde.

**Root Cause (verifiziert, nicht spekuliert):** `R-15` ("FCHAIN must have compose",
`fix_hint`: "Add FUNC elements via compose trace") lebt laut `RULE_TO_DIMENSION` in der
Dimension `uc` — aber DREI Stellen in `generate.ts` verschwiegen dem Modell genau diesen
Fix, sobald `focus === 'uc'`:

1. `GENERATION_TEMPLATE.uc` nannte nur ACTOR/FCHAIN-Szenario/UC als Kandidaten — nie FUNC.
2. `DIMENSION_FOCUS_TYPES.uc` enthielt kein `FUNC` — die Runden-Injektion (CR-285) gab dem
   Modell nie die `FUNC`-Kantengrammatik, solange der Fokus `uc` war.
3. Die Funde-Zeile rendert nur `rule_id: message`, nie `fix_hint` — R-15s eigener Hinweis
   ("Add FUNC elements via compose trace") ging verloren, obwohl er im Violation-Objekt
   längst vorlag.

Das Modell befolgte das Template wörtlich (mehr ACTOR/FCHAIN/UC) — und erzeugte dadurch
IMMER MEHR R-15-Funde, statt die leere FCHAIN mit FUNC zu befüllen: ein sich selbst
verstärkender Loop. Dieser Bug existierte VOR CR-290, wurde aber durch die reine
Rule-ID-Fensterbildung (Änderung 2 oben) sichtbar/fatal: bei 35 R-15-Treffern liefert
das ~12 Runden AM STÜCK reines R-15, ohne dass je eine andere `uc`-Regel (die
zufällig eine funktionierende Mischung geliefert hätte) dazwischenkommt.

**Fix** (gleiche zwei Dateien, `src/generate.ts` + `tests/generate.test.ts`, kein
neuer CR nötig — direkte Folge der Fund-Fenster-Änderung in diesem CR):

- `GENERATION_TEMPLATE.uc`: explizite Anweisung "Für FCHAIN ohne Compose-Kante (R-15):
  KEINE neue FCHAIN/UC anlegen — stattdessen 3±2 FUNC-Elemente an die BESTEHENDE FCHAIN
  hängen (FCHAIN compose→FUNC)."
- `DIMENSION_FOCUS_TYPES.uc`: `FUNC` ergänzt.
- Funde-Zeile rendert jetzt `fix_hint`, wenn vorhanden (`... — Fix: <fix_hint>`).

**Verifikation:**
- 3 neue Unit-Tests (deterministische Prompt-Assertions gegen das reproduzierte
  Fund-Szenario) — grün.
- Live-Spotcheck: derselbe festgefahrene Graph (18 leere FCHAINs) mit dem Fix,
  6 Runden/candidates=1 (LM-Studio-Box unter Last, 5/8 Calls Timeout — Infra, nicht
  Code) — die EINE erfolgreiche Runde fügte 9 FUNC-Knoten compose→3 bestehende FCHAINs
  hinzu (exakt die neue Instruktion), R-15 fiel 35→15, und die R-02/R-20/R-22-Triade
  (das ursprüngliche Ziel dieses CRs) erschien zum ersten Mal, weil jetzt überhaupt
  FUNCs existieren.
- Volle Suite: 68 Dateien / 427 Tests grün, `npm run build` grün.
- R-12-Nachzählung (CR-GC-292s eigentliche Frage) bleibt dadurch weiterhin offen — ein
  sauberer Recount braucht einen vollständigen Lauf, der jetzt erst die `arch`-Ebene
  erreichen kann. Siehe CR-GC-292 (offen gehalten, nicht geschlossen).

## Dateien (≤6)

- `src/generate.ts`
- `tests/generate.test.ts`

## Akzeptanzkriterien

- [x] `arch`-Template verlangt FUNC+satisfy+allocate im selben Batch
- [x] Fund-Fenster nach `rule_id` sortiert, keine Regel-Mischung mehr im selben Fenster
- [x] Score/Funde-Zahl aus dem Prompt entfernt, "Funde:"-Liste unverändert
- [x] Unit-Tests grün, `npm run build` grün
- [x] Messlauf gegen v18-bo3-Baseline dokumentiert — Negativ-Ergebnis (uc-Stagnation)
      gefunden, Root-Cause (R-15/uc-Template-Lücke) gefixt und live spot-verifiziert;
      R-12-Zieländerung selbst bleibt für CR-GC-292 offen (braucht sauberen Re-Lauf)
