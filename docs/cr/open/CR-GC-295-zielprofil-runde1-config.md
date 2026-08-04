# CR-GC-295 — Zielprofil (ℝ⁶) als Runde-1-Frage + Config + Konflikt-Check

**Status:** open
**Datum:** 2026-08-04
**Kontext:** CR-GC-289 (Ranking Ziel-Delta) hat das Zielprofil bewusst ausgeklammert: *"Kein
Zielprofil in diesem CR … Zielprofil = eigener CR."* CR-GC-283 listet es unverändert als offenen
Design-Punkt ("Zielprofil als Runde-1-Input — beeinflusst den Plan"). Dieser CR füllt die Lücke.

## Ausgangslage

- Das ℝ⁶-Zielprofil (Gewichte je `MetricVector`-Dimension — `modifiability`, `faultTolerance`,
  `flowEfficiency`, `coherence`, `viability`, `scalability`, s. `@sigloch/se-optimizer/metrics.ts`)
  wird heute erst bei **handoff** verlangt (`generate.ts:183`): der Prompt bittet das generierende
  Modell, sich selbst spontan ein Profil auszudenken (Beispiel im Prompt-Text: `{"scalability":1}`)
  — nicht der Mensch, der die Intention gibt, entscheidet, sondern das Modell rät nachträglich.
- Kein Config-Mechanismus persistiert ein Zielprofil über eine Session hinaus: `graph_suggest`
  braucht `target` explizit im Input (`src/tools/suggest.ts:32-45`); ohne Angabe bleibt es leer
  (richtungslos — exakt die in CR-289 benannte Schwäche außerhalb der Best-of-N-Auswahl selbst).
- `targetFor(weights)` (`@sigloch/se-optimizer`) nimmt jede Gewichtskombination ohne
  Plausibilitätsprüfung an. Aus den Metrik-Formeln lassen sich mindestens zwei strukturell
  gegenläufige Paare herleiten (kein geraten, aus der Formel-Doku
  `node_modules/@sigloch/se-optimizer/dist/metrics.d.ts`):
  - **`modifiability`/`coherence` vs. `flowEfficiency`** — hohe Modularität/Kohäsion lebt von
    wenigen community-übergreifenden Kanten; kurze mittlere I/O-Pfadlänge lebt von mehr
    Querverbindungen. Beide gleichzeitig hoch gewichten zieht in Gegenrichtungen.
  - **`coherence`/`modifiability` vs. `scalability`** — ein straff kohärentes Modul braucht meist
    einen Gateway-Knoten, der die Communities verbindet; dessen Betweenness steigt genau dann,
    wenn `scalability` (= 1 − maxBetweenness) sinken soll.
  Ein blind hoch gewichtetes Konfliktpaar kann sich am Gate gegenseitig neutralisieren, ohne dass
  der Operator das je erfährt — kein Fehler, aber ein unsichtbarer Zielkonflikt.

## Ziel

1. **Runde-1-Frage:** `generationStep`-Phase `seed`, Zweig ohne SYS/Intention (`generate.ts:143-157`)
   um einen zweiten, optionalen Satz erweitern: den Menschen nach dem Zielprofil fragen (Gewicht je
   Dimension, `-1`..`1`, Default „unentschieden" = alle 0), analog zur bestehenden Intentions-Frage.
   Nicht blockierend — ein leeres Profil ist weiterhin gültig (Gleichgewichtung, CR-289-Verhalten).
2. **Config-Datei:** `.graphcode/target-profile.json`, Zod-validiert (`weight = z.number().min(-1).max(1)`,
   identisch zu `suggest.ts:30`) — außerhalb des Graph-SSOT (kein `mutate()`-Zwang; das Profil ist
   Steuer-Config wie `ExecutorConfig`/`.mcp.json`, kein Graph-Content). `graph_suggest` liest sie als
   Default, wenn `target` im Input fehlt; der handoff-Prompt in `generate.ts` verweist auf die Config
   statt das Modell ein Profil frei erfinden zu lassen.
3. **Konflikt-Check, EIN Pfad:** der Loader selbst prüft bei **jedem Read** (nicht nur beim Schreiben)
   gegen eine feste Liste bekannter Gegenpaare (die zwei oben, erweiterbar) und gibt eine
   `conflicts`-Warnung zurück — **Warning, kein Block** (Analogie R-19/R-20: Bindungs-Vollständigkeit
   ist auch Warning, kein Gate-Error). Dadurch läuft ein manueller Datei-Edit durch denselben Check
   wie ein Skill-Schreibzugriff — kein zweiter, separat gepflegter Validierungspfad.
4. **Skill `se:target-profile`** (`.claude/commands/se-target-profile.md`, Pendant zu `se-trade`):
   führt den Menschen durch die 6 Dimensionen, schreibt die Config über denselben validierten Loader,
   macht eine Konflikt-Warnung sichtbar statt sie stillschweigend zu schlucken.

## Nachtrag 2026-08-04: Intent-Coverage als vierter Baustein

Motivation aus dem semantischen Review der Top-Graphen (Haiku/devstral/qwen, s.
Chat-Befund): technisch fehlerfreie Graphen tragen Inhaltsfehler (devstral v20
erfindet XML/CSV-Export, v18 modelliert Fehlermeldungen als UCs, qwen lässt die
Gate-Governance requirements-los) — **keine Metrik im System misst
Intentionstreue**. Regeln/Readiness/Ziel-Delta messen Struktur; ein Graph aus
wohlgeformtem Unsinn passiert alle Gates.

Die Runde-1-Frage wird deshalb ZWEITEILIG: (a) das ℝ⁶-Zielprofil (Qualitäts-
Richtung, wie oben), (b) die **Intentions-Anker** — die 3–7 inhaltlichen
Kernthemen der Prosa-Intention, vom Menschen bestätigt (Default: deterministisch
aus der Intention extrahierte Nomen-/Verbphrasen). Persistiert in derselben
Config (`.graphcode/target-profile.json`, Feld `intentAnchors`).

Daraus ein **Intent-Coverage-Read-out** (KPI, nie ein Veto): je Anker, ob und
wo er im Graphen adressiert ist (Namens-/Beschreibungs-Match über UC/REQ/FUNC —
deterministisch, dieselbe Normalisierung wie der ND-Preflight-Hint aus
CR-GC-287). Sichtbar in `graph_readiness` und als Zeile im generate-Prompt
(„unadressierte Anker: …") — damit steuert die Intention jede Runde, nicht nur
Runde 1. Optional (Folgearbeit, nicht hier): Anker-Abdeckung als Judge-Stufe im
Best-of-N. Erfundene Inhalte (XML/CSV-Klasse) fängt der Read-out nur indirekt —
das bleibt Sache der Analyse-Ebene (se-irr, s. CR-GC-294-Spike).

## Abgrenzung

- Kein neuer ElementType/Gate-Objekt — das Profil ist Config, nicht Graph-SSOT; „kein Hand-Edit des
  SSOT" gilt hier nicht, weil es nicht das SSOT ist.
- Intent-Coverage ist ein Read-out/KPI, NIE ein Gate-Blocker — Abdeckung sagt „adressiert",
  nicht „gut gelöst"; das Urteil bleibt bei Mensch/Analyse-Skills.
- Konflikt-Check bleibt Warnung, kein Block — ein Zielkonflikt kann eine bewusste Operator-Entscheidung
  sein (z.B. beide Seiten leicht anheben); nur unsichtbar darf er nicht bleiben.
- Kein Auto-`graph_suggest`-Aufruf bei fehlendem Profil — ohne Profil bleibt das Verhalten wie heute
  (leerer/richtungsloser Aufruf ist Consumer-Sache); die Runde-1-Frage erhöht nur die Wahrscheinlichkeit,
  dass eins existiert.
- `targetFor()`/`suggestEdits()` (`@sigloch/se-optimizer`) unverändert — reiner Consumer-seitiger
  Loader + Check in graphcode, kein Fork der Metrik-Bibliothek.
- Konfliktpaar-Liste startet mit den zwei formelmäßig hergeleiteten Paaren, kein Anspruch auf
  Vollständigkeit — Erweiterung ist ein späterer, kleiner Nachtrag, kein eigener CR nötig.

## Validierung

- Unit (`tests/generate.test.ts`): Runde-1-Prompt (kein SYS, keine Intention) enthält die
  Zielprofil-Frage.
- Unit (`tests/target-profile.test.ts`): Schema akzeptiert ein gültiges Profil, lehnt Werte außerhalb
  `[-1,1]` ab.
- Unit: bekanntes Konfliktpaar (z.B. `modifiability:1, flowEfficiency:1`) → Loader liefert eine
  `conflicts`-Warnung, das Profil bleibt trotzdem gültig/ladbar (kein Block).
- Unit: derselbe Konflikt-Check feuert unabhängig davon, ob die Datei über die Skill-Route oder direkt
  (z.B. `fs.writeFileSync` im Test) geschrieben wurde — EIN Check-Pfad, kein zweiter für Hand-Edits.
- Unit: `graph_suggest` ohne `target` im Input liest die Config, wenn vorhanden; Verhalten unverändert
  (leeres target), wenn die Datei fehlt — Regression-AC gegen bestehende Aufrufer.
- `npm run build` + Tests grün.

## Dateien (≤6)

1. `docs/cr/open/CR-GC-295-zielprofil-runde1-config.md` (dieses Dokument)
2. `src/target-profile.ts` (Schema, Loader, Konflikt-Check)
3. `src/generate.ts` (Runde-1-Frage; handoff liest Config statt Modell-Erfindung)
4. `src/tools/suggest.ts` (`graph_suggest`: Default aus Config, wenn `target` fehlt)
5. `.claude/commands/se-target-profile.md` (Skill)
6. `tests/target-profile.test.ts`

## Akzeptanzkriterien

- [ ] Runde-1-Prompt fragt optional nach dem Zielprofil, bleibt ohne Antwort gültig (Gleichgewichtung)
- [ ] `.graphcode/target-profile.json` Zod-validiert, Gewichte `[-1,1]` je der 6 `MetricVector`-Dimensionen
- [ ] `graph_suggest` nutzt die Config als Default, wenn `target` im Input fehlt; unverändert ohne Config
- [ ] Konflikt-Check läuft bei jedem Load (Skill-Schreibzugriff UND manueller Datei-Edit identisch),
      liefert Warnung, blockiert nicht
- [ ] Mindestens die zwei formelmäßig hergeleiteten Konfliktpaare erkannt (modifiability/coherence ↔
      flowEfficiency; coherence/modifiability ↔ scalability)
- [ ] Skill `se:target-profile` angelegt, führt durch die 6 Dimensionen, macht Konflikte sichtbar
- [ ] `npm run build` + Tests grün, N=1/`generationStep`-Determinismus für Graphen ohne Profil unverändert
