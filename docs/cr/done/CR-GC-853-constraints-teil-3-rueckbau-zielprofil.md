# CR-GC-853: Constraints Teil 3: Rueckbau Zielprofil

**Status:** ✅ Done (2026-10-26)
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

## Entschieden (Auftraggeber, 2026-10-26): Option A

`hatZielrichtung` steuerte nur `fitAdvisory`, nicht `steerAdvisory`. Es erschien nur im Probelauf und nur
mit einem Gewicht ≠ 0. Alle drei Profildateien (graphcode, bok, gc_test-graphview) trugen Gewichte.
Drei Optionen lagen vor: A nie zeigen, B immer zeigen (nimmt CR-GC-590 zurück), C nur auf Anfrage.

Gewählt: **A, `fitAdvisory` erscheint nie mehr im Ergebnis von `graph_mutate`.** Begründung aus CR-GC-804:
Kennzahlen finden, Constraints steuern. Eine schlechtere ℝ⁶-Kennzahl verletzt nichts, was der Autor will.
`se:optimize` nimmt als Beleg für „verletzt" den Steuerwert (`steerAdvisory`: neue schlimmste Stelle
`worstAt`, negatives `improvement`), der im Probelauf weiter erscheint. `graph_suggest` liest den ℝ⁶ weiter
direkt aus `mitBericht` (`delta`).

Geprüft vor dem Bau: `graph_impact` auf `FLOW-channel-fit-advisory` zeigt als einzigen Erzeuger
`FUNC-graph-mutate-tool`, als Abnehmer `FUNC-agent-loop`. grep nach `fitAdvisory` und `regressions`: kein
Agent-Treiber in graphcode liest das Feld aus der Antwort von `graph_mutate`; `graph_suggest` rechnet es
selbst. Außerhalb: das private Rig `graphanalyze/rig/moneyflow-struktur/driver.mjs` druckt
`res.fitAdvisory?.delta` nur aus und entscheidet nichts damit; es zeigt danach `null`.

Befund dabei: der Audit-Trail hat `fitAdvisory` nie gespeichert (`recordPreview` schreibt Verstöße,
Kommandos und `rulesPassed`, kein Advisory). Der Satz „der Audit-Trail behält sie" in `write.ts` stimmte
nicht. Seit Option A rechnet der Probelauf von `graph_mutate` den ℝ⁶ mit, ohne ihn auszugeben:
`mitBericht` bündelt `fitAdvisory` und `metricsAfter` unter einer Option (`fit`). Diese Mehrrechnung bleibt
bewusst offen (eigener Schritt in `zug-bericht.ts` samt `tests/gate.urteilt-und-speichert.test.ts`).

## Schnitt (2026-10-26)

Der Rückbau braucht mehr als 10 Dateien. Reihenfolge nach Abhängigkeit: erst lesen die Verbraucher keine
Gewichte mehr, dann fällt der Vertrag.

| Teil | CR | Inhalt |
|---|---|---|
| 1 | dieser CR | `fitAdvisory` nie im Ergebnis, `graph_generate` liest keine Gewichte, Modell und gemessene Tests dazu |
| 2 | CR-GC-862 | Skill-Texte nach Option A: `se:optimize` belegt „verletzt" mit `steerAdvisory`, `se:generate` ohne `fitAdvisory` |
| 3 | CR-GC-861 | `weights`/`values` aus `TargetProfileSchema`, Loader ohne Zielkonflikte, `graph_metrics` ohne `fit.target`, Profildateien in drei Repos, Skill-Abschnitte 1, 2, 4, Messskripte mit festen Gewichten |
| 4 | CR-GC-852 | Skill wird `se:constraints`; dazu `se:top-level` und `suggest.ts` |

Bis CR-GC-862 geschlossen ist, sagen `se:optimize` und `se:generate` noch, `fitAdvisory` komme mit
Zielprofil. Das ist eine benannte Differenz für einen Commit; der Text-Test von `se:optimize` bleibt grün.

## Umfang dieses CR (Dateien)

1. `src/surface/write.ts` — `hatZielrichtung` gelöscht, `fitAdvisory` fällt immer weg; kein Profil-Import mehr
2. `src/kernel/measure/fit-advisory.ts` — `fitAdvisoryIsSilent` gelöscht (kein Aufrufer mehr)
3. `src/loop/generate.ts` — Seed fragt nicht mehr nach Gewichten; Handoff als `handoffPrompt` ohne
   `graph_suggest {target}`, ohne Zielprofil, mit `steerAdvisory` statt `fitAdvisory`
4. `src/loop/decisions.ts` — Rangfolge ohne den Satz zum `fitAdvisory`
5. `src/projections/tool-help.ts` — `graph_mutate` ohne `fitAdvisory`, `graph_suggest` rankt nach dem Steuerwert
6. `tests/mcp.silent-advisories.test.ts` — nie `fitAdvisory`, auch mit Gewichtsdatei im Probelauf
7. `tests/mcp.mutate-input.test.ts` — Architekturzug trägt `metricsAfter`, nie `fitAdvisory`
8. `tests/generate.test.ts` — Seed und Handoff ohne Gewichte, Prompt ohne `fitAdvisory`
9. `tests/channel-model.test.ts` — der Kanal Fit-Advisory ist entfallen (10 statt 11 Kanäle)
10. `tests/arch.optimization-dry-run.spike.test.ts` — neu gemessen: vier Züge statt drei am Engpass,
    danach BW-02 @ `FUNC-block-grounding` (zwei Verträge weniger an der Grenze von Bedienung)

Modell per `graph_mutate` (graphVersion 928): `FLOW-channel-fit-advisory` gelöscht samt Kanten;
`FLOW-target-profile -io-> FUNC-graph-mutate-tool` gelöscht.

## Akzeptanzkriterien

- Kein Code, kein Skill und kein Test liest oder schreibt Gewichte oder Zielwerte.
- `.graphcode/target-profile.json` trägt nur noch Themen; `graph_generate` liest sie wie bisher.
- `graph_metrics` liefert kein `fit.target`; `graph_generate` nennt `graph_suggest {target}` nicht mehr.
- `fitAdvisory` steht nie im Ergebnis von `graph_mutate` (Option A); `tests/mcp.silent-advisories.test.ts`
  hält das fest. Erfüllt in diesem CR.
- `graph_generate` nennt `graph_suggest {target}` nicht mehr und fragt nicht nach Gewichten. Erfüllt in diesem CR.
- Die übrigen Kriterien erfüllt CR-GC-861.
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

## Nachweis (2026-10-26)

- Rot zuerst: `tests/generate.test.ts` (4 rot: Seed fragt nach Gewichten, `handoffPrompt` fehlt, Prompt nennt
  `fitAdvisory`), `tests/mcp.silent-advisories.test.ts` (fitAdvisory im Probelauf mit Gewichtsdatei).
- `verify:code`: Spur CODE, 110 Dateien. Erster Lauf 4 rot: `channel-model` (Kanal entfallen),
  `arch.optimization-dry-run.spike` (neu gemessen), `skills.mcp-conformance` (Verweis in `se:optimize`). Der
  dritte gehört zu CR-GC-862: `se:optimize` bleibt hier unverändert. Zweiter Lauf grün.
- `verify:full CR-GC-853`: erster Lauf 1 rot in `tests/repository-style.spike.test.ts`, einzeln und im
  zweiten Volllauf grün (198/198 Dateien, 1643 Tests, Schlupf 0). Den Grund des einen roten Laufs habe ich
  nicht festgehalten; offen.
