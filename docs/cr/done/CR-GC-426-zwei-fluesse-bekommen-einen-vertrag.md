# CR-GC-426 — Zwei Flüsse bekommen einen Vertrag

**Status:** **done** — 2026-08-25 (graphVersion 205 → 206) · **Angelegt:** 2026-08-25
**Herkunft:** Entscheidung des Auftraggebers zu [CR-GC-422](../open/CR-GC-422-drei-funcs-ohne-ehrlichen-flow.md)
§2 und §3. §1 (`FUNC-bind-tools`) bleibt dort offen — Familie-Frage, wandert als
contracts-CR nach sigloch-modules.

## 1 · Das Prinzip, das beide Fälle entscheidet

CR-GC-422 hatte zwei Flüsse offengelassen, weil ihr Inhalt kein Wire-Format hat: die
Antwort einer LLM ist Freitext, die Existenz einer Datei ist ein Signal ohne Daten. Die
Entscheidung lautet anders herum:

> graphcode modelliert auch mechanische und elektrische Systeme. Wenn ein Kunde auf einen
> Bildschirm tippt, brauchen wir ebenfalls etwas, das den Fluss **so gut es geht prüfbar**
> beschreibt.

Ein Fluss ohne Wire-Format ist also kein Grund, gar keinen Vertrag zu haben. Der Inhalt
mag unstrukturiert sein — die **Hülle** ist es nie. Beide Fälle hier hatten eine prüfbare
Hülle, die schlicht ungeprüft blieb.

## 2 · `FUNC-extract-mutate` — der Eingang bekommt eine geprüfte Hülle (§3)

**Root Cause:** `buildCallModel` las beide Backend-Antworten per Cast
(`(await r.json()) as { choices?: … }`). Ein Cast prüft nichts. Wandert ein Feld — anderer
Anbieter, neue API-Version, lokaler Server mit eigener Auslegung von „OpenAI-kompatibel" —
dann ist `msg.tool_calls` einfach `undefined`, die Antwort gilt als tool-call-los und läuft
als „das Modell hat nichts gesagt" weiter. **Rot gesehen:** eine Antwort ohne `choices`
lieferte `{ text: '', toolCalls: [] }` statt zu scheitern.

**Fix:** `src/model-answer-contract.ts` (neu) trägt drei Zod-Symbole:

| Symbol | Rolle |
|---|---|
| `AnthropicWireAnswer` / `OpenAiWireAnswer` | die Draht-Form je Backend — **hier** fällt Drift auf, mit Feldnamen im Fehlertext |
| `ModelAnswer` | die normalisierte Antwort: Text, Tool-Calls, **Stop-Grund**, Verbrauch |
| `BackendFailure` | die Fehlerhülle, vor dem Antwortvertrag geprüft (ein Fehlerkörper muss die Antwortform nicht erfüllen) |

`stopReason` ist nicht Beiwerk: ohne ihn ist eine am Token-Budget **abgeschnittene** Antwort
von einer geschwätzigen nicht zu unterscheiden — beide kommen ohne Tool-Call an. Genau für
den ersten Fall existiert der Salvage-Pfad in `executor-parse.ts`. Die Spur des Executors
sagt jetzt `(no calls, stop=length)` statt `(no calls)`.

Kein Parallelpfad: die alten `interface ModelResponse` / `interface ModelToolCall` sind
**gelöscht**; `ModelResponse` ist der Name, unter dem die Treiberschleife denselben Typ
führt (ein Typ, zwei Namen — keine zweite Definition).

Modell: `FLOW-model-answer` mit `SCHEMA-model-answer`, Erzeuger `FUNC-run-executor`
(derselbe Datei-Satz, in dem der Parse sitzt — RC-04), Verbraucher `FUNC-extract-mutate`.

## 3 · `FUNC-export-marker` — die Marke zählt (§2, Variante b)

**Root Cause:** die Marke `.graphcode/EXPORT_PENDING` trug einen Prosasatz; der pre-commit-Hook
konnte nur sagen **DASS** der Snapshot zurückhängt, nie **WIE WEIT**. „Irgendwas ist offen"
ist die Sorte Meldung, die man nach dem dritten Mal wegklickt.

**Fix:** `src/export-pending-contract.ts` (neu) definiert `ExportPending`:

- `since` — Zeitpunkt der **ersten** un-exportierten Mutation, nicht der letzten;
- `versionsBehind` — angewandte Mutations-Batches seit dem letzten Export.

`setExportPending` liest die eigene Marke, trägt `since` weiter und zählt hoch;
`readExportPending` ist der eine Leser (`safeParse`, kein Cast).

**Abweichung vom Wortlaut in CR-GC-422 (`{ since, graphVersion }`):** die absolute
`graphVersion` lebt in der Werkzeugschicht (`tool-context.ts`), nicht im Gate, das die Marke
schreibt. Sie zu übergeben hieße entweder einen Parameter für eine Logzeile durch `mutate()`
zu fädeln oder einen **zweiten Schreiber** der Marke zuzulassen. `versionsBehind` ist dieselbe
Information aus dem Wissen des Schreibers: der Zähler in `tool-context.ts` bewegt sich um
genau 1 pro erfolgreichem Batch, das Delta ist also die Zahl der `graphVersion`-Schritte —
und beantwortet „wie weit" direkt, statt den Leser gegen den `graphVersion`-Trailer des
Snapshots rechnen zu lassen.

**Rückwärtskompatibel, wie gefordert:** der Hook testete bisher nur Existenz und tut es
weiter. Eine Marke ohne Inhalt (graphcode vor diesem CR) blockt unverändert; nur „wie weit"
ist an ihr nicht abzulesen, und **geraten wird nicht** — der Hook sagt das ausdrücklich.

Modell: Eingang `FLOW-committed-graph -io-> FUNC-export-marker`, Ausgang
`FUNC-export-marker -io-> FLOW-export-pending` mit `SCHEMA-export-pending`; der Fluss endet
bei `ACTOR-developer` (der git-Hook ist keine modellierte FUNC — nur ein ACTOR darf eine
Kette beenden).

## 4 · Violations vorher → nachher

31 → **29**, alle Warnungen, 0 Fehler. Genau die zwei adressierten R-31 sind weg; **keine
Regel gegen eine andere getauscht** (dryRun vor dem Batch: einziger neuer Befund war die
fortgeschriebene R-04-Zahl an `MOD-harness`, 40 → 42 crossing flows — dieselbe bestehende
Warnung, keine neue).

| Regel | vorher | nachher |
|---|---|---|
| R-31 | 3 | **1** (nur `FUNC-bind-tools`, s. CR-GC-422 §1) |
| RC-04 | 2 | 2 (beide neuen SCHEMA werden an ihrem Interface geparst) |
| SC-04 | 2 | 2 (beide neuen FLOW sind gebunden) |
| R-10 / IO-01 | 0 | 0 (jeder neue Fluss hat Erzeuger **und** Verbraucher; jeder Anschluss hängt an einem Kettennachbarn) |
| alle übrigen | unverändert | unverändert |

## 5 · Rot gesehen (2026-08-25, vor dem Fix)

| Hälfte | Verfahren | Rot-Grund |
|---|---|---|
| Modellantwort | `src/executor.ts` gestasht, `tests/flow-contracts.test.ts -t "SCHEMA-model-answer"` | **7 rot**. Die drei Vertragsbruch-Fälle: `promise resolved "{ text: '', toolCalls: [] }" instead of rejecting` — genau der stille leere Turn. Die vier übrigen: `stopReason` existierte nicht. |
| Drift-Marke | `setExportPending` vorübergehend auf den alten Prosasatz zurückgesetzt | **4 rot**: `readExportPending` → `null`, Rückstand `undefined`, und der echte Hook-Ausdruck las `''` statt `'2'`. |

Beide Hälften danach 14/14 grün.

## 6 · Dateien

Umsetzung (6): `src/model-answer-contract.ts` (neu) · `src/executor.ts` ·
`src/export-pending-contract.ts` (neu) · `src/export-marker.ts` ·
`scripts/githooks/pre-commit` · `tests/flow-contracts.test.ts` (neu).

Mechanische Folgeänderung, erzwungen durch das neue Pflichtfeld `stopReason` (je 1 Zeile
pro Fixture, keine Testlogik berührt): `tests/executor.test.ts` ·
`tests/executor.bestofn.test.ts` · `tests/cli.run.test.ts` · `tests/executor.preflight.test.ts`.
Sie sind bewusst **nicht** ausgespart worden: eine Interface-Änderung wird bei allen Nutzern
nachgezogen, sonst steht der Vertrag neben Fixtures, die ihn nicht erfüllen.

## 7 · Akzeptanzkriterien

- [x] Die Provider-Antwort in `src/executor.ts` hat ein Zod-Schema über **Text, Tool-Calls
      und Stop-Grund**; der alte ad-hoc-Lesepfad ist **ersetzt**, nicht ergänzt.
- [x] Das Zod-Symbol liegt in einer eigenen Vertragsdatei (`src/*-contract.ts`) — RC-04
      verlangt Import **und** Parse im Datei-Satz der FUNC (Lehre aus CR-GC-413/420).
- [x] `FLOW-model-answer` mit diesem SCHEMA; `FLOW-model-answer -io-> FUNC-extract-mutate`.
- [x] `.graphcode/EXPORT_PENDING` trägt echten, prüfbaren Inhalt; der Hook sagt, wie weit
      der Snapshot zurückhängt.
- [x] Rückwärtskompatibel: eine alte Marke ohne Inhalt blockt weiter (Test vorhanden).
- [x] `FLOW-committed-graph -io-> FUNC-export-marker` und der Ausgang mit dem neuen SCHEMA.
- [x] Jede Modell-Änderung durch `graph_mutate`, `dryRun` vorher; kein Hand-Edit des SSOT.
- [x] `npm run type-check` grün, `npm test` grün (119 Dateien / 951 Tests), Export via
      `node scripts/export-graph.mjs`.

@author andreas@siglochconsulting
