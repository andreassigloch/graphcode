# CR-GC-285 — Runden-Prompt-Injektion: Guide-Slice + Element-Index

**Status:** done (2026-08-01, Vergleichslauf gemessen — GEMISCHTES Ergebnis,
dokumentiert im Nachtrag `docs/executor-abschlussbericht.md`): Turn-Ziel klar
erreicht (devstral 24 Rd.: 40 statt 121 Turns, Lese-Quote 7,5 % statt 62 %,
Wall 51,7 statt 77,4 min; Opus 12 Rd.: 60 El in 6,5 min). ABER lokale
Element-Ausbeute 22 vs. 38 (v9) — ohne Explorations-Turns verfallen devstrals
Batches auf Minimalcompliance. Kriterium „mindestens gleiche Ausbeute": Frontier
✅, Local ❌. Folge-Entscheidung offen: Injektion als Backend-Config.
**Datum:** 2026-08-01
**Kontext:** Turn-Analyse der Testläufe: 41–59 % aller Modell-Turns waren reine
Lese-Turns; `graph_authoring_guide` wurde 72–107× pro Lauf für dieselben paar
Elementtypen geholt (History resettet pro Runde → jedes Modell holt den Guide
jede Runde neu). Jeder Turn = volles Input-Replay — lokal der größte
Wall-Zeit-Fresser (16 tok/s decode), bei Anthropic ein Kosten-Fresser.
CR-282-Lektion gilt weiter: die INSTRUKTION nicht kürzen — hier werden nur
redundante Tool-Roundtrips durch deterministische Vorab-Injektion ersetzt.

## Ziel

Der Executor injiziert deterministisch berechenbare Lese-Inhalte direkt in den
Runden-Prompt, statt das Modell sie erfragen zu lassen:

1. **Guide-Slice:** aus der Fokus-Dimension des generate-Schritts folgen die
   relevanten Elementtypen (z. B. ver → TEST, REQ); deren
   `graph_authoring_guide`-Slices (legale Kanten) in den Runden-Prompt.
2. **Element-Index:** kompakter Index des Graph-Zustands (uid · type · name,
   eine Zeile pro Element) in den Runden-Prompt — ersetzt die
   `graph_elements`-Erkundungs-Turns und reduziert nebenbei R-08-Fehler
   (Modell sieht die existierenden uids) und Beinahe-Duplikate (Modell sieht
   die existierenden Namen).

Die Lese-Tools bleiben verfügbar (Detail-Nachfragen via `graph_get_node`);
nur der Standard-Rundenstart braucht sie nicht mehr.

## Nicht-Ziele

- Kein Prompt-Caching (anthropic `cache_control`) — separater Hebel, bereits
  im Abschlussbericht als offene Optimierung dokumentiert.
- Keine Kürzung der generate-Instruktion (CR-282 negativ validiert).

## Messung (Akzeptanz nicht nur funktional)

Ein devstral- oder Haiku-Vergleichslauf (24 Runden reichen): Erwartung ist
deutlich weniger Modell-Turns/Runde bei mindestens gleicher Element-Ausbeute.
Auch ein Negativ-Ergebnis wird dokumentiert (Muster CR-282).

## Dateien (≤6)

- `src/executor.ts` (Injektion beim Rundenstart)
- `src/generate.ts` (Fokus-Dimension → Elementtypen-Mapping exportieren)
- `tests/executor.test.ts`

## Akzeptanzkriterien

- [ ] Unit-Test: Runden-Prompt enthält Guide-Slice der Fokus-Typen + Element-Index
- [ ] Index bleibt kompakt (Budget-Grenze, z. B. ≤2k Tokens; bei Überschreitung
      deterministisch auf Fokus-relevante Typen filtern)
- [ ] Vergleichslauf dokumentiert (Turns/Runde, Elemente, Wall-Zeit)
- [ ] `npm run build` + Tests grün
