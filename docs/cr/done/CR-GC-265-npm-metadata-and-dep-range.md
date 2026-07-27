# CR-GC-265: npm-Metadaten + Dependency-Range-Drift

**Status:** Done (2026-07-26) · **Max Files:** 4
**Herkunft:** Publish-Audit 2026-07-26.

## Problem (Why)

1. **Die npm-Seite widerspricht dem Produkt.** `description` lautet „Claude Code Sidecar Harness" —
   das Gegenteil der agent-agnostischen Positionierung, die README, ADR-001 und jetzt auch der
   `opencode.json`-Scaffold (CR-GC-263) tragen. `keywords` kennt weder `opencode` noch `kuzu` oder
   `graph`.
2. **Kein Weg vom Paket zurück zur Quelle.** `repository`, `homepage`, `bugs` fehlen; npmjs.com
   zeigt keinen Repo-Link, `npm repo @sigloch/graphcode` läuft ins Leere. Für ein Paket, dessen
   Verkaufsargument die nachlesbaren Belege sind, ist das die teuerste fehlende Zeile.
3. **Der gescaffoldete Dependency-Range ist eingefroren.** `PACKAGE_RANGE = '^0.1.0'` steht seit
   CR-GC-121 als Literal in `scaffold-templates.ts`. `init` schreibt einem Consumer heute
   `"@sigloch/graphcode": "^0.1.0"` in die package.json, während die publizierte Version 0.4.1 ist —
   ein `npm install` in dem Repo zieht damit die falsche (zu alte) Major-0-Linie. Bei jedem Release
   erneut von Hand nachzuziehen ist genau die Drift, die CR-GC-205 („enforce, don't document") an
   anderer Stelle beseitigt hat.

## Design

1. `package.json`: `description` agent-agnostisch formulieren; `repository` (git+https, GitHub),
   `homepage` (README-Anker), `bugs` (Issues) ergänzen; `keywords` um `opencode`, `kuzu`, `graph`,
   `systems-engineering`, `mcp-server` erweitern; `publishConfig.access = "public"` setzen, damit
   ein lokaler `npm publish` nicht am Scoped-Default `restricted` scheitert (der Workflow gibt
   `--access public` bereits mit — die Wahrheit gehört ins Manifest, nicht in einen CI-Flag).
2. `PACKAGE_RANGE` wird **abgeleitet statt literal**: `packageVersion()` liest die `version` aus der
   eigenen package.json (gleiche Auflösung wie `packagedSkillsDir()`, funktioniert in `src/` wie im
   gebündelten `dist/`), der Range ist `^<version>`. Kein Literal = keine Release-Handarbeit.
   Fällt die Datei aus (unauffindbar/kaputt), bleibt `^0` als weiter Fallback — nie eine
   erfundene Versionsnummer.
3. Test zieht mit: die Assertion vergleicht gegen die gelesene eigene Version, nicht gegen ein
   Literal (sonst wäre der Test der nächste Drift-Ort).

## Akzeptanzkriterien

- [ ] `npm pkg get description repository homepage bugs keywords publishConfig` liefert
      vollständige Werte.
- [ ] `init` schreibt in eine fremde package.json `"@sigloch/graphcode": "^<aktuelle Version>"`.
- [ ] Ein Versions-Bump in package.json ändert den gescaffoldeten Range **ohne** Code-Änderung
      (Test liest beide Seiten aus derselben Quelle).
- [ ] `npm run build` + `npm test` grün.

## Nicht in diesem CR

Versions-Bump auf 0.5.0 + Tag (eigener Release-Schritt) · Registry-Deps statt Inlining (CR-GC-262).
