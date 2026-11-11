# CR-GC-914: se-retro: Verlauf der Verstöße über alle committeten Graph-Stände

**Status:** ✅ Done (2026-11-11)
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
- `tests/retro-verlauf.test.ts` (neu, an `TEST-retro-kpi` gebunden): Verlauf an einem echten Git-Repo mit drei
  Ständen, ein Sprung; Sprungliste mit festen Zahlen.
- `package.json`, `package-lock.json`: Untergrenze `>=0.21` von `@sigloch/graph-view-edit` — im Release-Zug
  von graphcode 0.38 mitgenommen (0827fead, 859d4a6e), hier keine Änderung mehr.

Modell: `relation` auf `FUNC-se-retro`.

## Abnahme

- Test: drei committete Stände ergeben drei Zeilen in Commit-Reihenfolge und genau einen Sprung.
- Lauf gegen graphcode selbst: alle committeten Stände, Laufzeit notiert.
- `se-retro` beschreibt Aufruf und Lesart; build, Testspur grün.

## Validierung (2026-11-11)

`node scripts/retro-kpi.mjs --verlauf` gegen graphcode selbst: 515 committete Stände, Messung 41,5 s, Lauf
43,6 s. 10 Sprünge über 10 %; jeder trägt seinen Commit-Betreff, z. B. `f4cb67b` 5er-Modulschnitt (CR-GC-446),
`4f450c4` Vertragskonsolidierung (CR-GC-445), `f6a66dc` Migration auf zwei REQ-kinds (CR-GC-670) — also
Umbauten, wie die Lesart in `se-retro` es erwartet.

Tests: `tests/retro-verlauf.test.ts` (rot gesehen: Funktionen fehlten), `retro-kpi`, `verify-model.completeness`
grün; CODE-Spur 54 Dateien, 456 Tests grün. Der volle Lauf je CR entfällt (CLAUDE.md: 10 CODE-CRs ohne Schlupf
erreicht).

Befund am Rand: Die CODE-Spur zählte `scripts/retro-kpi.mjs` nicht als Quelldatei („0 Quelldatei(en)") und wählte
`tests/retro-kpi.test.ts` deshalb nicht aus; er lief von Hand grün.
