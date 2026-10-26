# CR-GC-853: Constraints Teil 3: Rueckbau Zielprofil

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1060 (idea)
**Erstellt:** 2026-10-25, umgeschrieben 2026-10-26 (Konzept vom Auftraggeber freigegeben)
**Item:** bok/items/ITEM-2026-1060.json (Lane: code)

---

Teil 3 von CR-GC-804, Entscheidung 4. **Vorgezogen am 2026-10-26:** der Rückbau wartet nicht mehr auf
CR-GC-851 und CR-GC-852. Grund: `graph_suggest` liest die Gewichte seit CR-GC-483 nicht mehr; sie steuern
nichts. CR-GC-852 baut danach auf dem zurückgebauten Skill auf.

## Ziel

Gewichte und Zielwerte des Zielprofils fallen weg. Die Themen (`intentAnchors`) bleiben in
`.graphcode/target-profile.json`; `graph_generate` liest sie weiter.

| Stelle | heute | danach |
|---|---|---|
| `TargetWeightsSchema`, `TargetValuesSchema` (`src/loop/target-profile-contract.ts`) | Gewichte und Zielwerte je Dimension | entfallen; der Vertrag trägt nur noch die Themen |
| `src/loop/target-profile.ts` | lädt Gewichte, Zielwerte, prüft Zielkonflikte | lädt nur die Themen |
| `src/loop/generate.ts:856` | Hinweis „rufe graph_suggest {target: …}" bzw. „erhebe es über se:target-profile" | entfällt; `graph_suggest` hat kein Feld `target` mehr |
| `src/surface/write.ts:173` `hatZielrichtung` | entscheidet, ob fit- und steer-Hinweise im `graph_mutate`-Ergebnis erscheinen | entfällt; was ihn ersetzt, klärt der Bau per `graph_impact` (s. u.) |
| `graph_metrics` `fit.target` (`src/projections/metrics.ts`) | Gewichte, Zielwerte, Quelle, Widersprüche | entfällt; `fit.metrics` bleibt |
| Skill `se:target-profile` | Abschnitte 1 (Gewichte), 2 (Zielwerte), 3 (Themen), 4 (Zielkonflikte), 5 (Speichern) | Abschnitte 1, 2 und 4 fallen; CR-GC-852 schreibt den Rest zu `se:constraints` um |

## Offen vor dem Bau: der Ersatz für `hatZielrichtung`

Heute erscheinen fit- und steer-Hinweise nur, wenn ein Gewicht ungleich 0 gesetzt ist. Ohne Gewichte gibt es
drei Möglichkeiten: immer zeigen, nie zeigen, oder an einer anderen Bedingung festmachen. Der Bau beginnt mit
`graph_impact` auf die Knoten der fit- und steer-Hinweise und auf `FUNC-target-profile-load`, zählt die Leser
und legt die Wahl dem Auftraggeber vor.

## Umfang laut Suche (vor dem Bau mit `graph_impact` auf `FUNC-target-profile`, `FUNC-target-profile-load`,
`SCHEMA-target-profile` prüfen)

`src/loop/target-profile-contract.ts`, `src/loop/target-profile.ts`, `src/loop/generate.ts`,
`src/surface/write.ts`, `src/projections/metrics.ts`, `.claude/commands/se/target-profile.md`, die Tests
`tests/target-profile.test.ts`, `tests/generate.test.ts`, `tests/metrics.test.ts` und die Tests der
fit/steer-Hinweise. Weitere Verweise: `src/projections/help.ts`, `src/surface/scaffold-docs.ts`,
`.claude/commands/se/top-level.md`, `.claude/commands/se/optimize.md`. Das sind mehr als 10 Dateien: vor dem
Bau schneiden (`/se-umbau` führt die Reihenfolge).

## Akzeptanzkriterien

- Kein Code, kein Skill und kein Test liest oder schreibt Gewichte oder Zielwerte.
- `.graphcode/target-profile.json` trägt nur noch Themen; `graph_generate` liest sie wie bisher.
- `graph_metrics` liefert kein `fit.target`; `graph_generate` nennt `graph_suggest {target}` nicht mehr.
- Die fit- und steer-Hinweise im `graph_mutate`-Ergebnis folgen der Regel, die der Auftraggeber gewählt hat;
  ein Test hält sie fest.
- Die Modellknoten der Gewichte sind per `graph_mutate` gelöscht oder auf die Themen eingeschränkt.

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 891, Tiefe 1, Wurzeln: `FUNC-target-profile`, `FUNC-target-profile-load`, `SCHEMA-target-profile`._

Reichweite: 7 Elemente (FLOW 3, FUNC 4); Blackbox-Rand 2, nicht geoeffnet.

Dateien (realRef, 3):
- .claude/commands/se/target-profile.md
- src/loop/target-profile-contract.ts
- src/loop/target-profile.ts

Tests (`graph_tests`, 3):
- tests/mcp.suggest.test.ts
- tests/skill-authoring-gate.test.ts
- tests/target-profile.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
