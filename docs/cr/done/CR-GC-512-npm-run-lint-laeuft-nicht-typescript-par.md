# CR-GC-512: npm run lint laeuft nicht: TypeScript-Parser und flat config fehlen

**Status:** ✅ Done (2026-09-11)
**Typ:** aus Item ITEM-2026-048 (finding)
**Erstellt:** 2026-09-11
**Item:** bok/items/ITEM-2026-048.json (Lane: code)

---

## Problem

`npm run lint` brach mit exit 2 ab, bevor eine Datei gelintet wurde (Befund aus CR-GC-509 Punkt e):
eslint 9.39.4 installiert, aber kein TypeScript-Parser, keine flat config, und das Skript nutzte `--ext`,
das ESLint 9 im flat-Modus nicht mehr kennt. Eine `.eslintrc` gab es in der Git-History nie.
Entscheidung Auftraggeber 2026-09-11: richten.

## Umsetzung

- `package.json`: devDependency `typescript-eslint` ^8 (installiert 8.70.0, Peers eslint ^9 / TS <6.1 erfuellt);
  Skript `lint` = `eslint src`. `package-lock.json` entsprechend.
- `eslint.config.js` (neu): `typescript-eslint` recommended, `dist/**` ausgenommen.
- Erster Lauf: 14 Befunde, alle `no-unused-vars`.
  - 10 folgen der Konvention des Codes — fuehrender Unterstrich fuer bewusst ungenutzte Namen
    (Signatur-Parameter, per Rest-Destrukturierung verworfene Schluessel). In der Config als
    `argsIgnorePattern`/`varsIgnorePattern` `^_` plus `ignoreRestSiblings` festgeschrieben.
  - 4 sind toter Code und geloescht: Import `TargetWeightsSchema` (`src/loop/suggest.ts`), Import
    `RuleViolation` und destrukturiertes `auditLog` (`src/projections/report.ts`), Typ-Import `MCPTool`
    (`src/surface/mcp-tools.ts`).
- Lokal-Modus: `npm install` ersetzte die 7 Geschwister-Links in `node_modules/@sigloch` durch Registry-Pakete;
  die Links sind danach wiederhergestellt (contracts, graph-api-core, graph-view-edit, graphcode-client,
  graphify, learning-core, se-engine).

## Tests

- `npm run lint`: 0 Befunde, exit 0.
- `npm run type-check` und `npm run build` gruen.
- Volle Suite 1087/1088, rot nur der Perf-Spike (ITEM-2026-037), wie vor der Aenderung.
- Kongruenz: geloescht wurden nur ungenutzte Imports/Bindungen, kein Symbol mit realRef.

## Bewusst offen

- Lint haengt weder am pre-commit-Hook noch an einer CI — nicht beauftragt.
