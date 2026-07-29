# CR-GC-277 — SE-Skills als registrierbare Commands ausliefern

**Status:** ✅ Done (2026-07-30)
**Typ:** Bugfix/Refactor (Befund Greenfield-Trial 2: se:*-Skills unsichtbar)

## Befund

Die 27 SE-Skills wurden flach nach `.claude/skills/se-*.md` gescaffoldet — dort
registriert Claude Code **nichts** (Skills brauchen `<name>/SKILL.md`-Verzeichnisse,
Commands den Pfad als Namen). Die Doppelpunkt-Namen der Frontmatter
(`se:generate`, `se-view:arch`) waren immer schon das Commands-Namensschema.
Folge: `/se:generate` existierte in keinem Member-Repo, Agenten fanden die
Skills nicht in ihrer Liste. Betraf alle governten Repos (auch dieses).

## Änderung

- **Paket-Quelle verschoben** (git mv, 27 Dateien): `.claude/commands/<ns>/<rest>.md`
  aus dem Frontmatter-Namen — `se/generate.md` → `/se:generate`,
  `se-view/arch.md` → `/se-view:arch`, `se-conops.md` → `/se-conops`.
  Pfad im Paket = Pfad im Ziel: Scaffold kopiert verbatim, kein Mapping zur
  Laufzeit; das graphcode-Repo selbst hat seine Skills damit ebenfalls registriert.
- `shippedSkillFiles()` läuft den Commands-Baum (nur `se*`-eigene Einträge —
  Member-Commands sind nie unsere), install/sync/remove nutzen die relativen Pfade;
  Versions-Sync-Semantik (CR-GC-208) unverändert.
- **Migration:** install/update/sync/remove räumen verwaiste flache
  `.claude/skills/se-*.md` aus ≤0.9.0 ab (nur das paketeigene Muster; Member-Skills
  und -Verzeichnisse bleiben). Keine parallelen Pfade zwischen Alt und Neu.
- package.json `files`: `.claude/skills` → `.claude/commands`.

## Akzeptanzkriterien

- [x] init schreibt den Commands-Baum byte-identisch; Legacy-Dir entsteht nicht
- [x] update migriert: legacy se-*.md weg (reported als removed), Member-Skill bleibt
- [x] sync arbeitet auf den neuen Pfaden inkl. Versions-Overwrite; räumt Legacy ab
- [x] remove restlos inkl. geleerter Namespace-Unterordner; Member-Commands überleben
- [x] Tarball trägt `.claude/commands/se…`; Fremd-Repo-Install: Commands da, kein skills/-Dir
- [x] Volle Suite 337/337 grün

**Dateien (Code):** `src/scaffold-templates.ts`, `src/scaffold.ts`,
`package.json` (files), `tests/cli.scaffold.test.ts`,
`tests/skills.mcp-conformance.test.ts`, `tests/distribution.test.ts` —
plus 27 mechanische git-mv der Skill-Dateien und dieses Doc.
