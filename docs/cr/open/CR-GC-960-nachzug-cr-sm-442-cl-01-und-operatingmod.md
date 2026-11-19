# CR-GC-960: Nachzug CR-SM-442: CL-01 und operatingMode entfernen – focus-set.ts, generate.ts, Tests, Regelmatrix-Entwurf, 4 operatingMode-Werte an FUNC im Modell

**Typ:** aus Item ITEM-2026-1471 (idea)
**Erstellt:** 2026-11-19
**Item:** bok/items/ITEM-2026-1471.json (Lane: code)

---

## Anlass

CR-SM-442 (sigloch-modules) streicht die Regel CL-01 und das Attribut `operatingMode` am UC: Kein Werkzeug und kein
Skill setzt das Attribut, CL-01 schlug nie an. Der Auftraggeber will alle Reste entfernt haben (2026-11-19: „alles
aufräumen, sonst gibt es wieder Risiken“).

## Zielbild

- `src/kernel/measure/focus-set.ts`: Eintrag CL-01 (Abnahmetext) entfällt.
- `src/loop/generate.ts`: Kommentar zu CL-01 und dem Einsatzkonzept angepasst.
- `tests/exporter.test.ts`, `tests/skill-rule-ids.test.ts`: kein Verweis auf CL-01 oder `operatingMode`.
- `docs/graphcode_regelmatrix_entwurf.md`: CL-01 entfernt.
- Modell: `operatingMode` an FUNC-export-markdown, FUNC-harness-cli, FUNC-import und FUNC-merge-nodes per update-node
  auf null (FAQ `attribut-aendern-entfernen`); danach steht das Feld nicht mehr im Snapshot.
- Erst nach dem Release von CR-SM-442; Peer-Floor von `@sigloch/contracts` im selben Commit heben.

## Abnahme

- [ ] `grep -rn "CL-01\|operatingMode" src tests docs/graph docs/graphcode_regelmatrix_entwurf.md` findet nichts.
- [ ] `npm run verify:code` grün; vor dem Schließen `npm run verify:full CR-GC-960`.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

keine. Die Entscheidung steht in CR-SM-442 (sigloch-modules).

---

## Umfang laut `graph_impact`

Dateien laut Suche: `src/kernel/measure/focus-set.ts`, `src/loop/generate.ts`, `tests/exporter.test.ts`, `tests/skill-rule-ids.test.ts`, `docs/graphcode_regelmatrix_entwurf.md`, `docs/graph/graphcode.graph.json`, `package.json`, `package-lock.json`.
