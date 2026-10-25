# CR-GC-850: contracts 12.7.0 nachziehen: Mindestversion, Testpins fuer RC-11..13 und R-35, FC-02 aus Tests und Skills

**Status:** ✅ Done (2026-10-25)
**Typ:** aus Item ITEM-2026-1046 (finding)
**Erstellt:** 2026-10-25
**Item:** bok/items/ITEM-2026-1046.json (Lane: code)

---

## Befund

CR-GC-846 braucht contracts 12.7.0 (RC-12, RC-13, `callEdges`, `callCoverage`). 12.7.0 bringt seit 12.6.0 noch vier weitere Änderungen mit: CR-SM-412 (FC-02 geht in UC-03 auf), CR-SM-374, CR-SM-413 (R-35, Block einem Modul zugeordnet) und CR-SM-405 (RC-11). Am alten Stand von graphcode mit 12.7.0 sind 9 Tests rot, und 2 Skills nennen das entfallene FC-02. Zusammen mit CR-GC-846 wären das etwa 16 Dateien; deshalb ein eigener CR vorab.

## Änderung

- `package.json`: Mindestversion `@sigloch/contracts >=12.7 <13`.
- `tests/evaluation.rule-catalog.test.ts`: RC-11, RC-12, RC-13 stehen in der akzeptierten Liste „nicht im Gate".
- `tests/generate.test.ts`: Der blosse Fund an der Stufe von UC-02 ist jetzt R-16 statt FC-02. Dieselbe Frage, Klausel vor Fund.
- `tests/generate.statemachine.test.ts`: Das Golden (sigllm) meldet R-35. Der Autor hat sigllm bewusst nicht gerichtet; das Golden bleibt der gemessene Stand.
- `tests/harness.fit-advisory.test.ts`: Der Zug ordnet das Blatt `FUNC-b` zu statt des Blocks `FUNC-a`, den R-35 jetzt abweist.
- `.claude/commands/se-fmea.md`, `.claude/commands/se/author-uc.md`: UC-03 statt FC-02.

## Akzeptanz

- Die 5 Testdateien sind mit contracts 12.7.0 grün.
- `tests/skill-rule-ids.test.ts` ist grün: kein Skill nennt eine Regel, die es nicht gibt.
- `lockfile-sync` und `distribution` bleiben rot bis zum Publish von contracts 12.7.0 und `npm install`.

## Ergebnis

Umgesetzt am 2026-10-25 gegen die Arbeitskopie von contracts 12.7.0 (nur contracts verlinkt; der volle Link-Modus bringt eine unveröffentlichte Änderung an graphcode-client mit, die `cr-list` entfernt). Die 5 Testdateien und `skill-rule-ids` sind grün, 101 Tests.
