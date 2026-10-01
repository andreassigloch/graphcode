# CR-GC-721: Fehlleitende Hinweise an das Modell (local-1): AF-01..05 fix_hint und Task-Prompt generate.ts nennen den Stempel als Handlung statt der Analysearbeit; Artefakt-id implplan/assumption-review weicht vom Task-Namen plan/irr ab (Fehlaufruf task implplan); die im Prompt genannten se-Skills liegen nur als .claude/commands vor, OpenCode findet sie nicht (liest .opencode/skills/<name>/SKILL.md, geprueft mit opencode debug skill 1.18.33). Hinweise nennen Task, Skill und ersten Arbeitsschritt als Vorbild; Skills zusaetzlich fuer OpenCode ausliefern. Erzwingung (684/685) bleibt eigener Schritt

**Status:** ✅ Done (2026-10-01)
**Typ:** aus Item ITEM-2026-686 (finding)
**Erstellt:** 2026-10-01
**Item:** bok/items/ITEM-2026-686.json (Lane: code)

---

## Befund

Lokaler AgentDiary-Lauf `local-1` (2026-09-30, OpenCode 1.18.33 + qwen3-coder-30b): fünf Analyse-Stempel
in einem Zug, kein einziges Artefakt, danach „Task fmea fertig“. Drei Ursachen liegen in dem, was graphcode
dem Modell sagt — nicht im Modell:

1. Der Task-Prompt (`src/loop/generate.ts`) nannte als einzige greifbare Handlung „setze am Ende seinen
   Frischestempel am SYS (analysisFreshness)“.
2. Die Skills `se-conops`, `se-fmea`, `se-plan` enthielten den Stempel-Schritt gar nicht — wer den Skill
   befolgte, schloss den Task nie; wer den Stempel setzte, brauchte den Skill nicht.
3. Die im Prompt genannten Skills lagen nur unter `.claude/commands/`. OpenCode liest das nicht; es sucht
   `<name>/SKILL.md` unter `.opencode/skills/`. `opencode debug skill` zeigte 0 se-Skills.

Der Regelhinweis selbst (AF-01..05 `fix_hint`, „Set attributes.analysisFreshness…“) ist CR-SM-382.

## Umsetzung

- `generate.ts`: der Satz zum fehlenden Artefakt nennt den Skill und seine Schritte; kein Stempel, kein
  Attributname.
- `se-conops` (v3), `se-fmea` (v3), `se-plan` (+1): schließender Schritt „Stamp the task“ nach dem Muster
  von `se-trade`/`se-irr`, mit der Bedingung, wann nicht gestempelt wird. `se-plan` nennt die Abweichung
  Artefakt-id `implplan` / Task `plan`.
- Scaffold (`init`/`update`/`skills sync`/`remove`): jeder ausgelieferte Skill zusätzlich als
  `.opencode/skills/<name>/SKILL.md`, abgeleitet aus derselben Paketdatei (`opencodeSkill`). `:` im Namen
  wird `-` (`se:author-req` → `se-author-req`), der Originalname steht in der Beschreibung. Dieselbe
  Versionsregel wie für die Commands.
- `GRAPHCODE.md` nennt beide Orte.

## Nicht in diesem CR

Der Stempel bleibt vom Modell setzbar; ein Task mit Stempel ohne Artefakt gilt weiter als fertig, und
`graph_test_ingest` nimmt `passed` ohne Laufbeleg. Das sind ITEM-2026-684 und ITEM-2026-685. Dieser CR nimmt
die Einladung zum Shortcut weg, nicht die Möglichkeit.

## Abnahme

- `tests/cli.scaffold.test.ts`: init schreibt je Skill den OpenCode-Ordner (Name = Ordner, klein mit
  Bindestrich, Rumpf identisch), sync ersetzt eine veraltete Kopie, remove räumt restlos und lässt fremde
  Skills stehen.
- `tests/generate.task.test.ts`: der Prompt nennt `Lade den Skill se-trade`, nicht den Stempel.
- Am echten Client: `graphcode init` in einem leeren Repo, danach listet `opencode debug skill` 34 se-Skills
  (vorher 0), darunter se-conops, se-trade, se-irr, se-fmea, se-plan, se-author-req.
- Wirkung auf das Modell: misst der nächste lokale Lauf (rig/agentdiary), nicht dieser CR.

## Abhängigkeit

Der neue Regelhinweis kommt mit der nächsten `@sigloch/contracts`-Version (CR-SM-382). Bis dahin zeigt der
Fund im Prompt den alten Hinweis; graphcode importiert nichts Neues, der Peer-Floor bleibt.

## Umfang laut `graph_impact`

CR-Kanten: `FUNC-generation-step`, `FUNC-harness-cli`, `FUNC-se-conops`, `FUNC-se-fmea`, `FUNC-se-plan`.
`graph_tests` über diese fünf: 11 TESTs, alle auf Dateien aufgelöst, `unresolved` leer.
