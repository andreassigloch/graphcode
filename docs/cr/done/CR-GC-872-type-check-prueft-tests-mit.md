# CR-GC-872: type-check prueft tests/ mit (Teil 5 von ITEM-2026-1094)

**Status:** ✅ Done (2026-10-27)
**Typ:** aus Item ITEM-2026-1100 (idea)
**Erstellt:** 2026-10-27
**Item:** bok/items/ITEM-2026-1100.json (Lane: code)

---

Teil 5 von ITEM-2026-1094: tsconfig.tests.json (src+tests, allowJs fuer scripts/*.mjs, noEmit); npm run type-check prueft damit tests/ mit, CI faehrt es schon.

---

## Änderung

1. `tsconfig.tests.json` (neu): erbt `tsconfig.json`, nimmt `src/` und `tests/` auf, `noEmit`.
   `allowJs` mit `checkJs: false` liefert die Typen der `scripts/*.mjs`, die Tests importieren — statt
   eines `@ts-expect-error` je Import. Geprüft werden die Skripte damit nicht.
2. `package.json`: `type-check` ist `tsc -p tsconfig.tests.json`. CI fährt den Schritt schon
   (`.github/workflows/ci.yml`, „Type-check"); `build` prüft weiter nur `src/`.
3. `tests/kongruenz.test.ts`: der letzte `@ts-expect-error` entfällt.

## Ergebnis über ITEM-2026-1094

| Stand | Fehler in `tsc` über `src` + `tests` |
|---|---|
| vorher (Probe 2026-10-27) | 108 in 26 Dateien |
| nach CR-GC-866 bis 868 (Register) | 105 |
| nach CR-GC-869 | 25 |
| nach CR-GC-870 | 11 |
| nach CR-GC-871 | 1 |
| nach diesem CR | 0 |

## Akzeptanzkriterien

- `npm run type-check` endet vor der Änderung an `kongruenz` mit einem Fehler, danach mit 0.
- Volle Suite grün.

## Nachweis (2026-10-27)

- Rot zuerst: `npm run type-check` mit der neuen Konfiguration meldete `tests/kongruenz.test.ts(8,1) TS2578`.
- Grün: `npm run type-check` (0 Fehler über `src` und `tests`), `verify:code` (Spur VOLL, 202 Dateien).
