# CR-GC-862: Skill-Texte nach Option A (CR-GC-853): se:optimize belegt verletzt mit steerAdvisory statt fitAdvisory/regressions, se:generate ohne fitAdvisory

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1089 (idea)
**Erstellt:** 2026-10-26
**Item:** bok/items/ITEM-2026-1089.json (Lane: code)

---

Teil 2 des Rückbaus aus CR-GC-853 (Schnitt dort). Seit CR-GC-853 steht `fitAdvisory` nie im Ergebnis von
`graph_mutate` (Option A des Auftraggebers). Die Skill-Texte sagen noch, es komme mit Zielprofil.

## Ziel

`se:optimize` belegt „verletzt" mit dem Steuerwert: `steerAdvisory` mit neuer schlimmster Stelle `worstAt`
oder negativem `improvement`. `fitAdvisory` und `regressions` nennt kein Skill mehr.

## Umfang (Dateien)

1. `.claude/commands/se/optimize.md` (Version 6) — Tabelle des Urteils ohne `fitAdvisory`, Beleg „verletzt"
   aus `steerAdvisory`, Vorlage ohne `fitAdvisory`; kein Verweis auf `se:target-profile` mehr
2. `tests/skill-optimize-vorlage.test.ts` — rot, wenn der Skill `fitAdvisory` oder `regressions` nennt
3. `tests/skills.mcp-conformance.test.ts` — `se:optimize` verweist nicht mehr auf `se:target-profile`;
   es erhebt weiter keine Gewichte selbst
4. `.claude/commands/se/generate.md` — Rangfolge ohne den Satz zum `fitAdvisory`
5. `tests/decision-texts.test.ts` — rot, wenn `se:generate` `fitAdvisory` nennt
6. dieser CR

Modell: Beschreibung von `FUNC-se-optimize` auf Version 6 (graphVersion 937), `relation` auf
`FUNC-se-optimize` und `FUNC-se-generate`.

## Akzeptanzkriterien

- Kein Skill nennt `fitAdvisory` als Teil der Antwort von `graph_mutate`.
- `se:optimize` belegt „verletzt" nur mit Feldern, die der Probelauf liefert.

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 929, Tiefe 1, Wurzeln: `FUNC-se-optimize`._

Reichweite: 3 Elemente (FLOW 1, FUNC 2); Blackbox-Rand 1, nicht geoeffnet.

Dateien (realRef, 1):
- .claude/commands/se/optimize.md

Tests (`graph_tests`, 2):
- tests/skill-authoring-gate.test.ts
- tests/skill-optimize-vorlage.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.

## Nachweis (2026-10-26)

- Rot zuerst: `skill-optimize-vorlage` (2 rot), `skills.mcp-conformance` (1 rot), `decision-texts` (1 rot).
- `verify:code`: Spur CODE, 56 Dateien grün. `verify:full CR-GC-862`: 198/198 Dateien, 1644 Tests, Schlupf 0.
- Offen: `se:top-level` nennt `fitAdvisory` und `se:target-profile` noch (Z. 62, 165); das zieht CR-GC-852 nach.
