# CR-GC-680: Mess-Doku konsolidieren: KPI.md, MESSGROESSEN.md, Abschlussbericht, analysecase gegen die Leitlinie

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-593 (finding)
**Erstellt:** 2026-09-26
**Item:** bok/items/ITEM-2026-593.json (Lane: code)

---

## Befund

Vier Dokumente widersprechen der Leitlinie oder stehen quer zu ihr (Docs-Audit 2026-09-25):
- `docs/KPI.md`: Ziel Graph/Grep > 1 (T-E1 sagt „keine Schwelle"), 100 % Dateibindung (T-V4: nur die Grenzmenge).
  Wird von `scripts/retro-kpi.mjs`, `tests/retro-kpi.test.ts` und `se-retro` gelesen.
- `docs/MESSGROESSEN.md`: ℝ⁶ als Treiber (T-O4 No-Go, §5 „Nebenbedingung"), keine Empfehlen-Stufe (§3), keine Kettenkennzahlen (§5).
- ~~`docs/executor-abschlussbericht.md`: nennt ein Top-Ranking ohne Rückzugsvermerk~~ — erledigt 2026-09-26: nach `docs/archive/` verschoben (Folge-CRs 283–289 done).
- `docs/spikes/analysecase-kaltstart.md`: Prüfregeln G1–G4 fehlen in Leitlinie §9.1.

## Zielbild

Eine Stelle je Aussage. Die Kennzahl-Definitionen (was, wo gerechnet, wer handelt danach)
wandern nach `docs/messung/` neben `stand.md` (CR-GC-679); die Leitlinie trägt Claims, DoD und
Testdefinitionen, nicht die Mechanik.

## Umfang

- `KPI.md` + `MESSGROESSEN.md` → `docs/messung/kennzahlen.md` (eine Datei, auf Leitlinie-Stand);
  Leser nachziehen: `retro-kpi.mjs`, `tests/retro-kpi.test.ts`, `.claude/commands/se-retro.md`.
- Echte Ergänzungen in die Leitlinie (Vorschlag an den Autor): „eine Definition, ein Rechenort, ein Handelnder";
  zwei Schwellen-Ebenen (Verfahren vs. Zielarchitektur, `null` = messen, nicht urteilen);
  „verdiente Null" auch bei leerer Population; Form der benannten Ausnahme (Grund + Ausstiegsbedingung + `decides`-Relation);
  Begriffsleiter Anfrage → Turn → Runde → Kandidat → Batch → Mutation; Kohäsion: LCOM4 vs. ℝ⁶-coherence;
  Graph ist nicht schneller als grep — der Gewinn ist Präzision; G1–G4 aus analysecase.
- ~~`executor-abschlussbericht.md`: Rückzugsvermerk oben~~ — entfällt, archiviert.
- `analysecase-kaltstart.md` → Archiv, nachdem G1–G4 übernommen sind.

## Abnahme

- Kein Dokument in `docs/` (außer Archiv) widerspricht der Leitlinie in einer Schwelle oder einem Status.
- `tests/retro-kpi.test.ts` grün gegen die neue Datei.
- Abhängigkeit: nach CR-GC-679 (Zielordner `docs/messung/`).
