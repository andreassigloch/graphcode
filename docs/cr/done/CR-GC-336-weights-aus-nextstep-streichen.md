# CR-GC-336 — `weights` fällt aus `NextStepResult` und aus `graph_next_step`

**Status:** done · **Angelegt:** 2026-08-14 · **Abgeschlossen:** 2026-08-15 · **Max Files:** 6
(dieser CR: 6 — vier mehr als geplant, Begründung unten)
**Herkunft:** CR-SM-237 (sigloch-modules) §4.5 — dieser CR ist die dort geforderte Folge.
**Blockiert:** den Umstieg auf die nächste `@sigloch/se-steering`-Version.

## Problem

`@sigloch/se-steering` streicht `computeWeightVector`, `PromptDimension`, `WeightVectorType`
und `ProjectSlot` (CR-SM-237). Begründung dort: der D1–D6-Vektor wird gerechnet und ausgegeben,
aber **niemand handelt auf ihm** — er gewichtet keinen Kandidaten und verschiebt keine Auswahl.
Ein Rest des aimprove-Prompt-Scorers.

`graphcode` ist der einzige lebende Konsument:

| Ort | Nutzung |
|---|---|
| `src/steering.ts:15` | `import { computeWeightVector, type WeightVectorType }` |
| `src/steering.ts:44` | `weights: WeightVectorType` im `NextStepResult` |
| `src/steering.ts:68` | `const weights = computeWeightVector(report)` |
| `src/steering.ts:101` | `return { blocking, nextStep: step, advisory, weights }` |

**Ohne diesen CR bricht der Build von graphcode**, sobald die neue se-steering-Version
installiert ist.

### Nicht betroffen: die Zielprofil-`weights`

`src/generate.ts:249`, `src/target-profile.ts` und `src/tools/suggest.ts:90` führen ebenfalls
ein `weights` — das ist das **Zielprofil** aus `.graphcode/target-profile.json`
(`TargetWeightsSchema`), eine andere Größe mit eigenem Konsumenten (`graph_suggest`). Sie bleibt
unangetastet. Vor dem Streichen prüfen, dass nicht versehentlich beides getroffen wird.

## Lösung

1. **`weights` aus `NextStepResult`** (`src/steering.ts`) — Feld, Berechnung und Import weg.
   Die Fokus-Dimension wird aus dem Readiness-Report bereits direkt bestimmt; der Vektor war
   nur eine zweite Darstellung derselben Information.
2. **`graph_next_step`-Ausgabe** zieht nach — das Feld verschwindet aus dem Tool-Ergebnis und
   aus dessen Beschreibung.
3. **Tests** ziehen nach, nicht umgekehrt: Fälle, die `weights` prüfen, entfallen; Fälle über
   Blocker, Fokus-Dimension und Advisory bleiben unverändert grün — sie sind der Nachweis, dass
   der Messpfad nicht angefasst wurde.

## Akzeptanzkriterien

- [x] `grep -rn "computeWeightVector\|WeightVectorType\|PromptDimension" src/` ist leer.
- [x] Das Zielprofil-`weights` (`target-profile.ts`, `suggest.ts`, `generate.ts`) ist
      **unverändert** — eigener Grep als Gegenprobe.
- [x] `npx tsc --noEmit` sauber gegen die neue `@sigloch/se-steering`-Version.
- [x] `graph_next_step` liefert weiter Blocker, Fokus-Dimension und Advisory; die Suite ist grün.

## Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/steering.ts` | Import, Feld, Berechnung, Rückgabe |
| `src/tools/report.ts` (oder wo `graph_next_step` rendert) | Ausgabe + Beschreibung |
| zugehörige Testdatei(en) | Fälle nachziehen |

## Reihenfolge

Dieser CR muss **vor** dem Update der `@sigloch/se-steering`-Dependency gemerged sein — sonst
ist der Build zwischen beiden Schritten rot.

## Zweiter Sachverhalt, der mitmusste: die Ready-Schwelle

Beim Bauen zeigte sich ein zweiter Bruch, den dieser CR nicht kannte: **`computeReadiness`
verlangt seit contracts 4.0.0 (CR-SM-235) die Schwelle als dritten Parameter** — ohne Default,
damit es nicht zwei Antworten auf „ist diese Dimension zu schwach?" gibt.

In graphcode gab es davon **drei**:

| Ort | Wert | jetzt |
|---|---|---|
| `config.ts` `focusThreshold` | 0.8 (CR-GC-329) | **die eine Quelle** |
| `generate.ts` `threshold = 0.8` | Default-Parameter | Pflichtparameter, vom Aufrufer |
| `suggest.ts` Tool-Schema `.default(0.8)` | Zod-Default | `.optional()`, Host füllt |

Neu ist `harness.getFocusThreshold()` — analog zu `getMetricPolicy()`, aus derselben Config.
`takeSteeringSnapshot` und `nextStep` reichen sie durch. Ein Tool-Default wäre eine zweite
Antwort gewesen, die der Aufrufer nicht als solche erkennen kann.

## Abweichung: 6 Dateien statt 3–4

`steering.ts`, `report.ts` und die Tests waren geplant. Dazu kamen `harness.ts` (Accessor),
`steering-snapshot.ts`, `generate.ts`, `suggest.ts` und `write.ts` — alle als Folge **einer**
Signaturänderung in contracts, nicht als zweiter Sachverhalt.

Die Zielprofil-`weights` (`target-profile.ts`, `suggest.ts`, `generate.ts:249`) sind wie
angekündigt **unangetastet** — andere Größe, eigener Konsument.
