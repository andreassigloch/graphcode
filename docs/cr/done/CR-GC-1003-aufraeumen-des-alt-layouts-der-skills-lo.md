# CR-GC-1003: Aufraeumen des Alt-Layouts der Skills loeschen

**Typ:** aus Item ITEM-2026-1584 (finding)
**Erstellt:** 2026-11-22
**Item:** bok/items/ITEM-2026-1584.json (Lane: code)

---

removeLegacySkills (src/surface/scaffold.ts) raeumt Skills aus dem Layout bis 0.9.0 (.claude/skills/se-*.md) auf. Dafuer gibt es keine Anforderung, und es kommt keine (Entscheidung des Autors). Der Code ist ein Rest und wird mit Aufrufern, Test und Erwaehnungen geloescht. removeStaleSkills (CR-GC-879) bleibt.

---

## Entscheidungen

| Frage | Festlegung | Begründung |
|---|---|---|
| Braucht das Aufräumen des Skill-Layouts bis 0.9.0 (`.claude/skills/se-*.md`) eine Anforderung? | Nein, und es kommt keine. Der Code entfällt. `removeStaleSkills` (CR-GC-879, Reste älterer Pakete) bleibt. | Entscheidung des Autors am 2026-11-22. |

---|---|---|

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1504, Tiefe 1, Wurzeln: `FUNC-harness-cli`, `FUNC-sync-skills`._

Reichweite: 4 Elemente (FLOW 1, FUNC 3); Blackbox-Rand 2, nicht geoeffnet.

Dateien (realRef, 1):
- src/surface/scaffold.ts

Tests (`graph_tests`, 5):
- tests/cli.scaffold.test.ts
- tests/knowledge-binding.test.ts
- tests/sitzung-kpi.test.ts
- tests/vertrag/SCHEMA-install-result.vertrag.test.ts
- tests/vertrag/SCHEMA-skill-sync-result.vertrag.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.

## Vor dem Löschzug (se-umbau)

`graph_impact(FUNC-sync-skills)`: Kanten nur `compose` (`FCHAIN-repo-lifecycle`), `io` (`FLOW-cli-command`) und CR-Relationen. `FUNC-harness-cli` trägt `satisfy` auf sechs REQ; keine nennt das Alt-Layout (Beschreibungen von REQ, FUNC, SCHEMA und der Fluss-Texte im Modell per Suche geprüft: keine Erwähnung). `REQ-remove-loescht-eigene-pfade` („jede Datei, die `init` angelegt hat") fordert es nicht: das heutige `init` legt nichts unter `.claude/skills/` an. `graph_tests` für `scaffold.ts`, `scaffold-templates.ts`, `cli.scaffold.test.ts` meldet keine gebundene Auswahl (`unresolved` leer, Auswahl leer); gefahren wurde die Vollsuite.

Der Code leistet nichts anderes: `removeLegacySkills` entfernte nur `se-*.md` unter `.claude/skills/` und den leeren Ordner. Es lief in `installSkills` (init, update), in `syncSkills` (nur im Ernstfall) und in `removeSkills` (remove).

## Änderung

**Gelöscht.** `removeLegacySkills` und seine drei Aufrufe in `src/surface/scaffold.ts`; die Konstante `LEGACY_SKILLS_DIR` in `src/surface/scaffold-templates.ts` und ihr Import. Der Test `update migrates legacy flat .claude/skills/se-*.md copies away (CR-GC-277)` entfällt mit (er prüfte nur das Alt-Layout); im Init-Test entfällt die Zeile, die den leeren Alt-Ordner erwartet (das Übrige bleibt). Die Konstante im Test entfällt.

**Nachgezogen.** Veraltete Pfadangaben `.claude/skills/` zu `.claude/commands/` in den Kommentaren von `scaffold.ts` (`syncSkills`, `removeSkills`), `scaffold-templates.ts` (`COMMANDS_DIR`, `packagedSkillsDir`), `src/loop/se-plan.ts` und in drei Texten von `tests/cli.scaffold.test.ts`. Der Satz zum flachen Alt-Layout im Kommentar von `COMMANDS_DIR` entfällt. Nicht angefasst: der Test, der prüft, dass `GRAPHCODE.md` den Pfad `.claude/skills/` nicht nennt; ein Kommentar in `tests/skills.mcp-conformance.test.ts` (Rückblick auf 9 alte Skills); `LEGACY_WORKSPACE_DIR` (Trajektorie von `.aimprove`, ein anderer Rest).

**Verhaltensänderung.** Ein Repo, das noch flache `se-*.md` unter `.claude/skills/` aus ≤ 0.9.0 trägt, behält sie: weder `update` noch `skills sync` noch `remove` räumt sie mehr ab.

## Messung

`rules_evaluate` unverändert, nur `MS-03` +1 (neuer CR-Knoten). Kein Modellzug außer den CR-Kanten.
