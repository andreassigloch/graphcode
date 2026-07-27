# CR-GC-262: Registry-Deps statt esbuild-Inlining

**Status:** Done (2026-07-26) · **Max Files:** 6
**Dependency:** CR-214 (sigloch-modules) — die fünf `@sigloch/*`-Pakete liegen seit heute auf npm.

## Problem (Why)

Weil ein publiziertes Manifest mit `file:`-Range nicht installierbar ist, inlined
`esbuild.config.mjs` alle `@sigloch/*`-Module in `dist/cli.js` + `dist/index.js`. Drei Kosten:

1. **Kaputte Subpath-Exports.** Gebündelt werden nur die zwei Entrypoints. `dist/harness.js`
   (Export `./harness`) importiert weiter bare `@sigloch/graph-api-core` und
   `@sigloch/contracts/harness` — im ver­öffentlichten Tarball nicht auflösbar. `./mcp` erbt das
   über seine Importkette. Beide Subpaths sind seit dem ersten Publish tot.
2. **Bundle-Staleness.** Die Ontologie friert im Bundle ein; nur ein erneutes `npm run bundle`
   löst das. CR-GC-244 hat den Versuch, `contracts` extern zu lassen, wieder zurückgerollt —
   mit Registry-Deps entfällt das Dilemma.
3. **Keine öffentliche CI möglich.** `publish.yml` checkt das **private** `sigloch-modules` mit
   einem PAT aus, nur um die `file:`-Deps bauen zu können. Ein öffentliches Repo hätte damit
   weder Build noch Test für Beitragende.

## Design

1. Die fünf `@sigloch/*` wandern von `devDependencies` (`file:../…`) nach `dependencies` mit
   Registry-Range (`^0.7.0` etc.).
2. `esbuild.config.mjs` **löschen**, `bundle`-Script und der `prepack`-Bundle-Schritt entfallen —
   `prepack` ist wieder `npm run build`. Kein zweiter Build-Pfad (keine parallelen Pfade).
3. `scripts/ensure-siblings-built.sh` + `pretest` **löschen**: es gibt keine Siblings mehr zu bauen.
   Für die Familien-Arbeitsschleife (contracts ändern → in graphcode sehen) tritt ein
   `link:siblings`-Script an die Stelle, das die fünf per `npm link` auf die Arbeitskopie zeigt —
   explizit und umkehrbar, statt implizit über einen Manifest-Pfad.
4. `publish.yml`: privater Checkout + `SIBLINGS_REPO_TOKEN` raus, `npm ci` statt `npm install`.
5. Neue `ci.yml`: Build + Test bei Push/PR — jetzt möglich, weil alle Deps öffentlich sind.
6. Subpath-Exports `./harness` + `./mcp` **bleiben** und funktionieren dadurch von selbst; sie zu
   entfernen wäre nur solange richtig gewesen, wie sie ohnehin kaputt waren.

## Akzeptanzkriterien

- [ ] `npm pack` + Installation des Tarballs in einem leeren Repo: `npx graphcode init` läuft,
      `import { … } from '@sigloch/graphcode/harness'` löst auf.
- [ ] Kein `file:`-Range und kein `esbuild` mehr in `package.json`; `esbuild.config.mjs` weg.
- [ ] `npm test` grün gegen die Registry-Pakete (kein Sibling-Build im Vorlauf).
- [ ] `publish.yml` ohne privaten Checkout; `ci.yml` läuft build + test.

## Nicht in diesem CR

Versions-Bump auf 0.5.0 + Tag · Repo-Sichtbarkeit.
