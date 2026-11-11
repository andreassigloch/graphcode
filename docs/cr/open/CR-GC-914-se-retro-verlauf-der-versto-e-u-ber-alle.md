# CR-GC-914: se-retro: Verlauf der Verstöße über alle committeten Graph-Stände

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1307 (idea)
**Erstellt:** 2026-11-11
**Item:** bok/items/ITEM-2026-1307.json (Lane: code)

---

Die Kurve über alle Graph-Stände fällt im GVE-Dashboard weg (nur noch 24 Stände). Sie gehört in die Retro nach Projektende: je committetem Stand Elemente, Fehler, Warnungen, Hinweise, gemessen mit dem heutigen Regelwerk; Sprünge gegen Umbauten und Regelwechsel lesen. Entscheidung des Auftraggebers 2026-11-11.

---

## Hintergrund

CR-GVE-402 kürzt die Graph-Historie im Dashboard auf die letzten 24 Stände und streicht die Kurve über alle
Stände (Entscheidung des Auftraggebers, 2026-11-11). Der Verlauf über das ganze Projekt beantwortet eine
Retro-Frage, keine Frage der laufenden Arbeit: Wo kamen Verstöße hinzu, wo gingen sie weg, und welcher Sprung
war ein Umbau oder ein Regelwechsel statt Arbeit?

## Zielbild

- `node scripts/retro-kpi.mjs --verlauf [<repo>]` druckt je committetem Stand von `docs/graph/*.graph.json`
  eine Zeile: Datum, Commit, Elemente, Fehler, Warnungen, Hinweise. Darunter die Sprünge: jede Änderung der
  offenen Verstöße um mehr als 10 % gegen den Vorstand, mit Commit-Betreff.
- Gemessen wird mit `measureGraphHistory(repo, { window: null })` aus dem installierten
  `@sigloch/graph-view-edit` (ab der Version mit CR-GVE-402). Kein zweiter Messpfad in graphcode.
- `se-retro` nennt den Aufruf und die Lesart: jeder Stand ist mit dem heutigen Regelwerk bewertet; ein Sprung
  ist erst Arbeit, wenn er weder mit einem Umbau noch mit einem Wechsel der Regelversion zusammenfällt. Der
  Verlauf zählt ohne Code-Abgleich (RC-Regeln) — die Readiness zählt sie mit.

## Abhängigkeit

Release von graph-view-edit mit CR-GVE-402 (Parameter `window`). Die Range in `package.json` hebt die
Untergrenze auf diese Version.

## Umfang

- `scripts/retro-kpi.mjs`: Modus `--verlauf`.
- `.claude/commands/se-retro.md`: Schritt und Lesart.
- `tests/retro-kpi.test.ts`: Verlauf an einem echten Git-Repo mit drei Ständen, ein Sprung.
- `package.json`, `package-lock.json`: Untergrenze von `@sigloch/graph-view-edit`.

Modell: `relation` auf `FUNC-se-retro`.

## Abnahme

- Test: drei committete Stände ergeben drei Zeilen in Commit-Reihenfolge und genau einen Sprung.
- Lauf gegen graphcode selbst: alle committeten Stände, Laufzeit notiert.
- `se-retro` beschreibt Aufruf und Lesart; build, Testspur grün.
