# CR-GC-519: skipped ohne notInGate auf den rules_*-Flaechen; bok faehrt Pre-489-Release

**Status:** erledigt 2026-09-13
**Typ:** aus Item ITEM-2026-110 (finding)
**Erstellt:** 2026-09-13
**Item:** bok/items/ITEM-2026-110.json (Lane: code)
**Baut auf:** CR-GC-442 (`notInGate`), CR-GC-489 (RC regelfein in `skipped`)

---

## Root Cause

Zwei Lagen, eine Beobachtung. Gemessen 2026-09-13 am bok-Graphen: RC-02 feuert
(`severity: error`) UND `skipped` nennt `rule:RC-02` — in derselben Antwort.

1. **Release-Drift.** bok faehrt `@sigloch/graphcode@0.20.1` aus der Registry,
   publiziert aus `e25f5c1` — VOR `62bc323` (CR-GC-489 geschlossen). Der Stand hat
   keinen `conformanceRan`-Zweig: `skipped` = `ALL_RULE_DEFS` minus Gate-Katalog,
   RC-* steht also immer drin, ob die Konformanz lief oder nicht. 38 Commits seit
   dem Release, keine Versionsanhebung. Die npx-Cache-„0.20.1" mit dem Fix ist ein
   `npm link` auf den Dev-Checkout, nicht das, was bok installiert hat.
2. **Vokabular je Flaeche gespalten (main).** CR-GC-442/489 unterscheiden „nicht
   ausgewertet" (`skipped`) von „nicht im Gate" (`notInGate`). Beides fuehrte nur
   `graph_readiness` (`catalogs.notInGate`); `rules_evaluate` und
   `rules_get_violations` gaben `skipped` allein, und die Beschreibung von
   `rules_get_violations` behauptete noch die seit CR-GC-489 abgeschaffte
   „two-level" Quellen-Liste. Nichts erzwang, dass eine gefeuerte Regel nie in
   `skipped` steht — die Ableitung galt nur, solange `getLoadedRuleIds()` und
   `evaluateRules()` der Harness uebereinstimmen.

## Impact

**Bricht:** An `rules_get_violations` ist „RC-02 nie gefahren" von „RC-02 gefahren,
blockiert nur nicht" nicht unterscheidbar; ein Leser kann drei `error`-Regeln
weder als geprueft noch als offen einordnen.

**Bricht nicht:** die Erhebung in main (`evaluateAll` gegen bok: RC nicht in
`skipped`, `importCoverage` da), das Gate. Dass `mutate()` RC nicht faehrt, ist
Entscheidung (CR-GC-489 §5 → CR-GC-490), kein Befund dieses CRs.

## Fix

1. `Evaluation` traegt `notInGate` — abgeleitet aus `unevaluatedRuleIds`, dieselbe
   Funktion wie `ruleCatalogs`. `skipped` ist stets Teilmenge davon.
2. `rules_evaluate` und `rules_get_violations` geben `notInGate` neben `skipped`;
   Beschreibungen benennen beide Lagen, „two-level" ist weg.
3. Vertrag der Ableitung: feuert eine Regel, die in der Luecke steht, wirft
   `evaluateAll` einen Fehler, der die Regel nennt — nie eine Antwort mit beidem.
4. Rot zuerst: Duck-Typ-Harness, die eine ungeladene Regel feuert (vorher: beides
   in einer Antwort); Invariante `skipped ∩ gefeuert = ∅` auf allen drei Flaechen
   gegen die echte Repo-Wurzel; `notInGate` auf allen dreien gleich.

Die Release-Drift (Lage 1) behebt kein Code — der Owner faehrt den Release-Zug.

## Dateien

| # | Datei | Was |
|---|---|---|
| 1 | `src/kernel/evaluation.ts` | `notInGate` am Ergebnis, Vertragsfehler bei Widerspruch |
| 2 | `src/projections/report.ts` | `notInGate` an beiden rules_*-Flaechen, Beschreibungen |
| 3 | `tests/readiness-conformance-skip.test.ts` | rot zuerst + Invariante auf drei Flaechen |
| 4 | `tests/evaluation.rule-catalog.test.ts` | `notInGate` auf drei Flaechen gleich, Beschreibung |
| 5 | diese CR | |

## Akzeptanzkriterien

- [x] Rot zuerst: Harness feuert Regel, die sie nicht geladen hat → vor dem Fix
      Antwort mit Befund UND `rule:<id>` in `skipped`; danach Fehler, der die Regel nennt.
- [x] `rules_evaluate.notInGate` = `rules_get_violations.notInGate` =
      `graph_readiness.catalogs.notInGate`.
- [x] Auf allen drei Flaechen gegen die echte Repo-Wurzel: kein `rule:<id>` in
      `skipped`, dessen `<id>` in den Verstoessen vorkommt.
- [x] Ohne Wurzel: RC-* in `skipped` UND in `notInGate`; mit Wurzel: nur in `notInGate`.
- [x] `rules_get_violations.description` enthaelt `notInGate`, nicht „two-level".
- [x] `npm run build`, `npm test` gruen.
