# CR-GC-949: Skills nennen den Parameter skill an graph_mutate

**Typ:** aus Item ITEM-2026-1377 (idea)
**Erstellt:** 2026-11-15
**Item:** bok/items/ITEM-2026-1377.json (Lane: code)

---

**Status:** Umgesetzt 2026-11-15. Folge aus CR-GC-943, Schritt 4.

## Anlass

`graph_mutate` nimmt seit CR-GC-943 den Parameter `skill`, und `audit_stats` zählt je Skill. Kein Skill nennt
den Parameter. Bis dahin steht jeder Zug unter `skill: null` („nicht erfasst"), und die Ablehnungsquote je
Skill bleibt leer.

## Zielbild

Jeder Skill, dessen Text `graph_mutate` nennt, sagt dem Agenten, den Parameter zu setzen, mit seinem eigenen
Namen als Beispiel: `graph_mutate({ formatE: …, skill: "se-fmea" })`. Am 2026-11-15 sind das 17 Dateien unter
`.claude/commands`.

## Vorgehen

1. Ein Satz mit Beispiel je Skill, an der Stelle, an der der Skill den ersten Schreibzug beschreibt.
2. `version:` im Kopf jeder geänderten Datei um 1 erhöhen (FAQ `skill-ablage-und-version`).
3. Ein Test liest `.claude/commands`: jede Datei, die `graph_mutate` nennt, nennt `skill: "<eigener Name>"`.
4. Modell: TEST-Knoten mit `testRefs`.

## Umfang gegen die Dateigrenze

17 Skill-Dateien und ein Test, also 18 Dateien statt 10. Die 17 Änderungen sind dieselbe, je Datei ein Satz
und eine Versionszeile (`git diff --numstat` zeigt je Datei `2 1`). Ein Schnitt ließe den Test rot oder
prüfte nur die Hälfte der Skills (FAQ `cr-dateigrenze-ausnahme`, Punkt 2).

## Abnahme

- [x] Der Test ist rot vor der Änderung und nennt die 17 Dateien; danach grün.
- [x] Ein Zug aus einem Skill-Lauf steht in `audit_stats` unter `bySkill` mit dem Namen des Skills. Beleg: Probelauf über den Host-Socket (`graph_mutate`, `skill: "se-fmea"`, `dryRun: true`), danach `bySkill: [{"skill":"se-fmea","applied":1,"rejected":0,"topBlockingRule":null}]`; die graphVersion blieb 1221. Ein echter Skill-Lauf steht aus.
- [x] `npm run verify:full CR-GC-949` grün: 230 Dateien, 1897 Tests, rot 0, Schlupf 0.

---

## Ergebnis

`git diff --numstat` der 17 Skill-Dateien: je Datei `2 1` (Versionszeile und ein Satz). Fünf Test-Pins auf die
alte Version nachgezogen: `tests/skill-faq-angleich.test.ts`, `tests/skill-se-plan-dateigrenze.test.ts`,
`tests/skill-top-level-ausloeser.test.ts` (drei Stellen). In `se/import-doc.md` steht der Satz als
Kommentar über dem Aufruf im Treiber-Skript, weil der Skill an dieser Stelle Code zeigt. Neuer Test:
`tests/skill-nennt-parameter.test.ts`, Modell: `TEST-skill-nennt-parameter` verifiziert `REQ-rule-calibration`.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

keine. Der CR setzt die Festlegung aus CR-GC-943 um.

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1202, Tiefe 1, Wurzeln: `FUNC-graph-mutate-tool`._

Reichweite: 14 Elemente (FLOW 12, FUNC 2); Blackbox-Rand 12, nicht geoeffnet.

Dateien (realRef, 4):
- src/kernel/hooks.ts
- src/surface/host-shim.ts
- src/surface/import-code-verb.ts
- src/surface/write.ts

Tests (`graph_tests`, 11):
- tests/bootstrap.test.ts
- tests/contracts.surface.test.ts
- tests/gate.urteilt-und-speichert.test.ts
- tests/harness.import-invariant.test.ts
- tests/mcp.help.test.ts
- tests/mcp.mutate-input.test.ts
- tests/mcp.readiness.test.ts
- tests/mcp.stdio-server.test.ts
- tests/mutate.formate-ops.test.ts
- tests/mutate.schema-guard.test.ts
- tests/schema-parse-at-interface.test.ts

TEST ohne Bindung (keine testRefs, laeuft in keiner Auswahl): TEST-capture

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
