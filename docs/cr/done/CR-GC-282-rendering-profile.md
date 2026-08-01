# CR-GC-282 — Empfänger-abhängiges Instruktions-Rendering (profile)

**Status:** done — **NEGATIV validiert, Ansatz verworfen und zurückgebaut** (2026-08-01)
**Datum:** 2026-08-01

**Ergebnis:** v13 (Minimal-Rendering ohne Grammatik): 6 Applies / 30 Rejections
in 24 Runden — abgebrochen. v13b (+ Kanten-Grammatik je Dimension): 22 Elemente /
30 Traces, 47 Rejections — gegen **82/104 der v12-Baseline** mit vollem
Rendering. Zwei Ursachen: (1) die Multi-Kandidaten-Instruktion des vollen
Templates erzeugt die großen verbundenen Batches (38–43 Mutationen), die den
v12-Durchsatz trugen — das Ein-Fund-Rendering verbietet sie konstruktiv;
(2) Ein-Fund-Batches kollidieren mit Batch-Invarianten (REQ-braucht-TEST im
selben Batch → einzeln nachgereichte REQs werden geblockt). Das
„Frontier-Gepäck" im Instruktions-Text ist tragendes Gerüst, kein Ballast;
die realen Minimalitäts-Gewinne lagen bei Toolset/History/Temperatur.
**Konsequenz:** profile-Parameter, LOCAL_RULES/LOCAL_GRAMMAR und
Executor-Profile-Wiring vollständig entfernt (keine parallelen Pfade für einen
verworfenen Ansatz); der Executor fährt das volle Rendering — ohne das alte
EXPAND_FOCUS-Overlay (dessen Ignorieren v12s große Batches erst zuließ).
**Kontext:** `docs/executor-bigpicture.md` §3/§5-Hebel-2, §6; Folge zu CR-GC-281.

## Ziel

`graph_generate` rendert dieselbe Methode empfänger-abhängig: `profile:
'frontier' | 'local'`. Frontier (Default, MCP-Clients wie Claude Code) behält
den vollen Text inkl. Gate-Protokoll (dryRun-Verdicts, 2–3 Kandidaten).
Lokal (der embedded Executor) bekommt eine minimale, widerspruchsfreie
Instruktion: EIN Fund, EIN Batch, generierte Fehlervermeidungs-Zeilen.

## Root Cause

Gemessen über v1–v12: devstral hat das Gate-Protokoll **0-mal** befolgt
(`dryRunProbes: 0` in allen Läufen) — es ist lokal totes Gewicht mit
Ablenkungsrisiko. Zusätzlich widersprechen sich heute Template („Schlage je
Fund 2–3 Kandidaten vor") und Executor-Overlay EXPAND_FOCUS („NUR den ERSTEN
Fund") — zwei Stimmen, denen ein kleines Modell zufällig gehorcht.
Frontier nutzt(e) das Protokoll in den Greenfield-Läufen zwar auch nicht
(0× dryRun, Audit-Befund), aber es ist dort als Anleitung des
Alternativen-Vergleichs designt und bleibt unverändert — die Entflechtung
Frontier-Verhalten vs. Protokoll ist CR-283-Messung (Judge-Vergleich).

## Design

- `generationStep(graph, intent?, threshold?, defer?, profile = 'frontier')`.
- **frontier-Rendering: unverändert** (kein Verhaltensbruch für MCP-Clients).
- **local-Rendering** (nur expand/seed-Phase betroffen):
  - Seed: gleiche Struktur-Anforderung (1 SYS, 1–3 ACTORs, 3–7 UCs, Kanten),
    OHNE Gate-Protokoll-Absatz.
  - Expand: „Fund: `<element_id>` (`<rule_id>`: `<message>`) — Fix:
    `<fixHint>`. Aufgabe: EIN Batch, der GENAU diesen Fund behebt." — nur der
    ERSTE Fokus-Fund (die Rotation aus CR-281 holt die weiteren deterministisch).
  - Statische REGELN-Zeilen (kurz): uid exakt kopieren, nie umbenennen/neu
    erfinden; add-node und add-edge desselben Elements im SELBEN Batch;
    existierende Knoten nie erneut anlegen; dann STOPP.
  - Fehlervermeidung ist **generiert** (fixHint/message der fokussierten
    Violations aus `@sigloch/contracts`-Regeln), nicht von Hand gepflegt —
    kein Regel-Fork.
- Executor: ruft `graph_generate` mit `profile: 'local'`; das
  EXPAND_FOCUS-Overlay **entfällt** (keine parallele zweite Stimme — der
  Fokus steckt jetzt im local-Rendering). EMIT_SUFFIX (Call-Shape) bleibt.
- MCP-Input-Schema (`graph_generate`): `profile` optional, Default 'frontier'.

## Scope (max 6 Dateien)

1. `docs/cr/open/CR-GC-282-rendering-profile.md` (dieses Dokument)
2. `src/generate.ts`
3. `src/tools/suggest.ts` (graph_generate-Bindung: profile im Input-Schema)
4. `src/executor.ts` (profile:'local' durchreichen, EXPAND_FOCUS entfernen)
5. `tests/generate.test.ts`
6. `tests/executor.test.ts`

## Akzeptanzkriterien

- [ ] `profile:'local'` (expand): kein „Gate-Protokoll"-Text, kein „2–3
      Kandidaten"; enthält element_id + fixHint des ersten Fokus-Funds und die
      REGELN-Zeilen
- [ ] `profile:'frontier'`/Default: Prompt byte-identisch zu vorher
- [ ] Executor sendet keine widersprüchlichen Batch-Größen-Instruktionen mehr
      (EXPAND_FOCUS gelöscht, kein Parallelpfad)
- [ ] `npm run build` + betroffene Tests grün
- [ ] Validierungslauf v13 (48 Runden, devstral): Ergebnis vs. v12
      (82 Elemente / 104 Traces) im Nachtrag dokumentiert — auch ein
      Gleichstand ist ein Ergebnis (Hypothese: weniger Rejections/Idle-Turns
      bei mindestens gleicher Tiefe)

## Out of Scope

- Best-of-N / Judge-Config / Vergleichs-Logging → CR-GC-283
- Zielprofil als Initial-Schritt → CR-GC-284
