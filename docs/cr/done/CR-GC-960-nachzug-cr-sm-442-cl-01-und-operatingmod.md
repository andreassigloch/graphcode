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
- `src/kernel/element-node.ts`: Kommentar nennt `operatingMode` nicht mehr.
- Fixture `perf-basis.graph.json`: `operatingMode` entfernt.
- Modell: `operatingMode` an FUNC-export-markdown, FUNC-harness-cli, FUNC-import und FUNC-merge-nodes per update-node
  auf null (FAQ `attribut-aendern-entfernen`); danach steht das Feld nicht mehr im Snapshot.
- Erst nach dem Release von CR-SM-442; Peer-Floor von `@sigloch/contracts` im selben Commit heben.

## Abnahme

- [x] Nach dem Publish in sigloch-modules die Einträge `operatingMode` und `CL-01` aus `SWEEP_ALLOWLIST` streichen, sobald kein Konsument sie mehr nennt (graph-view-edit siehe eigener CR).
  Nachtrag 2026-11-20: gestrichen in sigloch-modules 15fe046; der Sweep findet ohne die Einträge keinen Treffer. Fixtures in graph-view-edit und Doku in bok nennen sie noch, das räumen CR-GVE-404 und BOK-CR-094 ab.

- [x] `grep -rn "CL-01\|operatingMode" src tests docs/graphcode_regelmatrix_entwurf.md` findet nichts.
  Nachtrag 2026-11-20: In `docs/graph` bleiben drei Arten von Treffern, gewollt: die vier null-Grabsteine
  `"operatingMode": null` (FAQ `attribut-aendern-entfernen`), der Name dieses CR-Knotens und die Beschreibung des
  geschlossenen CR-GC-219 (Historie).
- [x] `operatingMode` an den vier FUNC ist null. Format-E schrieb vorher den String `"null"`; der Parser-Fix steht in
  CR-SM-444 (contracts 12.16.0) und fährt im selben Zug.
- [x] Die Zähltests (Artikel, Bildseite) sind nach CR-GC-967 abgespalten, damit dieser CR bei 10 Dateien bleibt.
- [x] `npm run verify:code` grün; vor dem Schließen `npm run verify:full CR-GC-960`.
  Nachtrag 2026-11-20: verify:code fiel wegen package.json auf die volle Suite (2121 grün, rot nur `distribution` vor dem Publish). Der Volllauf lief in `aise release prepare` gegen die Tarballs des Zugs grün; nach dem Publish sind `distribution` und `lockfile-sync` grün.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

keine. Die Entscheidung steht in CR-SM-442 (sigloch-modules).

---

## Umfang laut `graph_impact`

Dateien laut Suche: `src/kernel/measure/focus-set.ts`, `src/loop/generate.ts`, `tests/exporter.test.ts`, `tests/skill-rule-ids.test.ts`, `docs/graphcode_regelmatrix_entwurf.md`, `docs/graph/graphcode.graph.json`, `src/kernel/element-node.ts`, Fixture `perf-basis.graph.json`, `package.json`, `package-lock.json`.
