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

## Stand 2026-09-27 — mechanischer Teil erledigt, Leitlinie wartet auf den Autor

**Erledigt (10 Dateien mit diesem CR):**
- `docs/KPI.md` + `docs/MESSGROESSEN.md` → `docs/messung/kennzahlen.md`, auf Leitlinie-Stand:
  KPI 1 ohne Schwelle (T-E1); Datei-Bindung „100 % aller Dateien" ersetzt durch Grenzmenge 100 %
  (T-V4, neu KPI 7); ℝ⁶ als **Anzeige/Nebenbedingung** — war im Dokument noch Treiber-Tiebreaker,
  ist es aber auch im Code seit CR-GC-483 nicht mehr (Ranking nach Chebyshev, `fitAdvisory` nur
  berichtet); neu: Zeilen Steuerwert, Empfehlen (§3) und Kettenkennzahlen (§5, Spike).
- **Code widersprach der Leitlinie:** `retro-kpi.mjs` druckte fuer KPI 1 das Ziel „> 1" —
  jetzt „— (keine Schwelle, T-E1)"; Test rot gesehen, dann gruen (10/10). `se-retro` liest
  KPI 1 als Potenzial statt als Urteil.
- Leser umgestellt: `retro-kpi.mjs`, `tests/retro-kpi.test.ts`, `.claude/commands/se-retro.md`,
  `rig/referenz-change/{messen.mjs,README.md}`, `docs/articles/07-…`. Nicht umgestellt:
  `docs/spikes/SPIKE-GC-selective-tests.md` (historischer Befund, zitiert den damaligen Stand).

**Offen — Vorschlaege an den Autor fuer die Leitlinie** (erst danach `analysecase-kaltstart.md` ins Archiv):
1. §9.1: „eine Definition, ein Rechenort, ein Handelnder" als Regel fuer jede Kennzahl.
2. §9.1: zwei Schwellen-Ebenen (Verfahren vs. Zielarchitektur); `null` = messen, nicht urteilen.
3. §9.1: „verdiente Null" auch bei leerer Population (Regeln sehen keine Abwesenheit).
4. §9.1: Form der benannten Ausnahme — Grund + Ausstiegsbedingung + `decides`-Relation.
5. §4: Begriffsleiter Anfrage → Turn → Runde → Kandidat → Batch → Mutation.
6. §5: Kohaesion LCOM4 vs. ℝ⁶-coherence — zwei Fragen, ein Wort.
7. §4: Der Graph ist nicht schneller als grep — der Gewinn ist Praezision.
8. §9.1: Pruefregeln G1–G4 aus `docs/spikes/analysecase-kaltstart.md`.

## Abschluss 2026-09-27 — Entscheid des Autors

Von den acht Vorschlaegen: 1, 2, 3, 6, 7 stehen als Mechanik in `docs/messung/kennzahlen.md`
(gehoeren laut Zielbild nicht in die Leitlinie); 4 (benannte Ausnahme) steht in der globalen
CLAUDE.md; 5 (Begriffsleiter) gehoert ins Glossar, nicht in die Leitlinie. **G1–G4 uebernommen**
als allgemeine Regel in Leitlinie §9.1 („Vier Gegenproben vor jedem Befund").
`docs/spikes/analysecase-kaltstart.md` → `docs/archive/`.
