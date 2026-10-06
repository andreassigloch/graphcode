# CR-GC-750: Regelmatrix mit Stufe, Rolle und Marke statt Phase; Skilltexte und README ohne Gates

**Status:** ✅ Done (2026-10-06)
**Typ:** aus Item ITEM-2026-762 (idea)
**Erstellt:** 2026-10-06
**Item:** bok/items/ITEM-2026-762.json (Lane: code)
**Deckt:** sigloch-modules CR-SM-395 §6/§12 (Nachzug graphcode), Entwurf `docs/graphcode_regelmatrix_entwurf.md` §3.
**Schnitt:** Teil 3 von 3 des Nachzugs, hier 3a (Sicht und Texte). 3b: CR-GC-751 (Reihenfolge in `rules_evaluate`,
Skill `se:close-violations`, Rig-Aufgaben). 3c: CR-GC-752 (Bauplan ohne Stempel). 7 Dateien.

---

## Befund

`scripts/regel-matrix.mjs` las `RULE_TO_PHASE` und `ABNEHMBAR_JE_TASK` — beide gibt es seit CR-GC-748 nicht mehr,
das Skript lief nicht. Die erzeugte Sicht stand auf 78 Regeln und acht Arbeitsschritten. Vier Texte sprachen von
Gates, Bau-Gates oder „creation blockern".

## Umsetzung

**`scripts/regel-matrix.mjs`**
- Spalten **Stufe** (`2 Anwendungsfall`, `immer`), **Rolle** (`existence` | `analysis` | leer), **Marke** — alle
  drei aus `ALL_RULE_DEFS`. Die Spalte „Phase" entfällt.
- Die bisherige Spalte „Stufe" (info/warning/error) heißt **Schwere** — der Name war sonst doppelt belegt.
- **abnehmbar** (eine Spalte statt „abnehmbar in <Task>"), aus `ABNEHMBAR`; bei CL-01 und FM-03 steht der Grund
  (`ABNEHMBAR_BEGRUENDET`).
- **Skill** wie der Schritt ihn nennt: an einer Regel einer Analyse deren Skill (`analyseSkill`).
- Zeilen in der Reihenfolge des Schritts: Stufe, darin die Existenz-Regel vorn (`stufenRang` aus `generate.ts`).
  `Regel` bleibt die erste Spalte — `scripts/messung.mjs` (T-H2) liest die IDs dort.
- Neuer Abschnitt „Stufen und Marken": je Stufe Menge, Existenz-Regeln, Marke danach, Zahl der Regeln.
- Abschnitt „Tasks" ohne die Spalte „abnehmbar im Task"; sieben Arbeitsschritte, nur noch
  `anforderungsqualitaet` trägt eigene Regeln (5), der Kern 74.

**`docs/views/regel-matrix.{md,csv}`** neu erzeugt: 79 Regeln, 12 Existenz-Regeln, 6 Analysen, 9 abnehmbar.

**Texte**
- `.claude/commands/se/help.md`: Marke statt Gate (ohne SAR/FCA/SVR/FRR); `graph_help` ohne Token liefert eine
  Maßnahme je Regel — eine nie durchgeführte Analyse ist der Befund ihrer Regel, kein eigener Blocker-Typ.
- `.claude/commands/se-review.md`: der Stand kommt aus `graph_readiness.marks` (der Text sagte, das Phasenmodell
  sei nicht definiert, und ließ eine Phase aus Meilensteinen schätzen).
- `.claude/commands/se-irr.md`: „Marke erreicht, Analyse-Regel offen oder abgenommen" statt „Gate grün, creations
  fehlen".
- `README.md`: zwei Stellen (Werkzeugtabelle, `se:help`).

## Geprüft, nichts geändert

- `GRAPHCODE.md` und `src/surface/scaffold-docs.ts` (Vorspann): nennen keine Gates.
- `scripts/messung.mjs`, `scripts/whitebox-messung.mjs`: lesen weder Gates noch Marken. T-H2 an der neuen Sicht:
  „Matrix = Katalog".
- `docs/views/README.md`: beschreibt die Sicht nur als erzeugt — nicht angefasst.

## Tests

Kein Test liest die Sicht. `tests/messung.test.ts` (Leser T-H2), `skill-rule-ids`, `skills.mcp-conformance`,
`cli.scaffold`, `claims.conformance`, `vorspann` grün.

## Verifikation

- `node scripts/regel-matrix.mjs` → `79 Regeln → docs/views/regel-matrix.{csv,md}`.
- `npm run verify:full CR-GC-750` (Zeile in `docs/messung/testauswahl.jsonl`): Spur CODE, Auswahl 44/203, 3 rot —
  `tests/lockfile-sync.test.ts`, `tests/distribution.test.ts` (Link-Modus, erwartet), `tests/conformance.test.ts`
  (1 Fall, Modell-Zug aus CR-GC-748). Alle drei liegen außerhalb der Auswahl und zählen als **Schlupf**; keiner
  rührt von diesem CR her (dieselben drei waren vor ihm rot). Der Lauf fuhr den Arbeitsbaum, in dem die
  Änderungen von CR-GC-751 schon lagen. Folge ohne Schlupf: 0/10.
