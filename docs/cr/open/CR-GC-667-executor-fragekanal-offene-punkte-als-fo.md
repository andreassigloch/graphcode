# CR-GC-667: Executor: Fragekanal — offene Punkte als Format-E-Fragezeile (manuell: anhalten, headless: Annahme) statt erfundener Zahlen

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-577 (idea)
**Erstellt:** 2026-09-25
**Item:** bok/items/ITEM-2026-577.json (Lane: code)

---

## 1 Befund

Blindgutachten Runde 20 (Review 2026-09-25): Die Executor-Läufe füllen offene Punkte des Auftrags
mit erfundenen Zahlen (10 s, „zweimal“, 24-h-Fenster). Das hat eine strukturelle Ursache: Der
Executor kennt die Regel `openQuestions` (CR-GC-592, `src/loop/decisions.ts:78`) nicht, weil sie
nur in `GRAPHCODE.md` und `se:generate` eingesetzt ist, und er hat keinen Kanal zum Menschen. Dem
lokalen Modell bleibt nur, selbst eine Zahl festzulegen. Readiness misst diesen Fehler nicht,
weil sie die Form prüft und nicht den Inhalt.

## 2 Zielbild

Eine offene Entscheidung des Auftraggebers wird im Executor zur **Fragezeile** statt zu einer
Zahl, in derselben Sprache wie der Batch (Format-E, ITEM-571), ohne neues Tool-Schema:

    ? <Frage an den Auftraggeber>

- **Manuell** (`GRAPHCODE_LLM_INTERACTIVE=1`): Der Lauf hält nach dem Turn an, die Frage steht
  auf der Konsole, und die Antwort geht als nächste User-Nachricht an das Modell. Ohne TTY bricht
  der Start mit einer Fehlermeldung ab. Es gibt keinen stillen Rückfall auf headless.
- **Headless** (Default): Die Antwort kommt sofort und ist der Registertext `openQuestions`:
  niemand antwortet, lege den Punkt als Annahme ins Modell (REQ mit offenem Zielwert, ACTOR mit
  offenem Kanal) und nenne ihn in der Schlussmeldung.
- Beide Modi erfassen die Frage in den Laufstatistiken (`questions: string[]`). Die
  Schlussmeldung von `graphcode run` listet sie auf.
- Der Executor-Prompt setzt den Registertext `openQuestions` ein und nennt die Fragezeile als
  Weg, statt eine Zahl zu erfinden.
- Fragezeilen werden vor dem Gate aus dem Batch entfernt. Der Codec sieht sie nie.

Nicht im Umfang: die Güte einer Frage messen. Das beurteilt der Mensch in der manuellen Session
(nicht deterministisch, Stufe „Empfehlen“).

## 3 Umfang (8 Dateien + dieser CR)

| Datei | Änderung |
|---|---|
| `src/loop/executor-parse.ts` | `extractQuestions(text)`, `takeQuestionsFromInput(input)` |
| `src/loop/executor-gate.ts` | Fragezeilen verlassen den Batch in `runPreflight`, der einen Stelle beider Pfade (Ein-Kandidat, Best-of-N); `recordQuestions`; `questionOnly`-Verdict ohne Gate-Call |
| `src/loop/executor.ts` | Config `interactive`, Typ `AskOwner`, `stats.questions`, Antwort je Turn (Feedback) oder mit der nächsten Runde (nach Apply); manuell ohne `ask` oder mit `candidates>1` bricht ab |
| `src/loop/executor-prompt.ts` | Vorbild Fragezeile + REQ mit offenem Wert im SYSTEM; `headlessAnswer` (Registertext `openQuestions`), `ownerAnswer` |
| `src/surface/run-verb.ts` | `GRAPHCODE_LLM_INTERACTIVE=1`, Terminal-Rückkanal über stderr/stdin, ohne TTY Abbruch |
| `tests/executor.question-channel.test.ts` | neu: Parser, headless (Batch + Frage, reine Frage in Prosa), manuell, Abbruch ohne Rückkanal |
| `tests/executor-config-contract.test.ts` | `interactive` Default false |
| `tests/decision-texts.test.ts` | Headless-Antwort trägt den Registersatz |
| `tests/executor-gate.duplicate-index.test.ts` | Zähler in der neuen Form (`questions`) |

Best-of-N: Fragen werden erfasst, aber nicht beantwortet — der Registersatz steht ohnehin im
Prompt; manuell ist Best-of-N ausgeschlossen.

**Modell-Zug (graphVersion 483):** `SCHEMA-ask-owner` (realRef `AskOwner`), `FLOW-open-question`
(FUNC-run-executor → ACTOR-owner), `FLOW-owner-answer` (ACTOR-owner → FUNC-run-executor),
`REQ-open-point-asked` (satisfy durch FUNC-run-executor), `TEST-executor-question-channel`
(verify REQ und SCHEMA).

## 4 Umfang laut `graph_impact`

`graph_impact(FUNC-run-executor)`: 31 Knoten, whitebox FCHAIN-steering-loop plus 9 FLOW
(model-answer, recovered-batch, round-prompt, channel-system-prompt …). ACTOR-owner steht schon am
Rand (idle-nudge, system-prompt), der neue FLOW hängt also an einem bestehenden Aktor.
Testspur (`graph_tests`): `vitest run tests/anthropic-stream.test.ts tests/cli.run.test.ts
tests/executor-config-contract.test.ts tests/executor.bestofn.test.ts tests/executor.test.ts
tests/fund-kontext.test.ts tests/openai-stream.test.ts`, dazu `tests/decision-texts.test.ts`.

## 5 Kriterien

1. Red-first: Der Test „headless-Frage → Registertext“ ist vor der Änderung rot, weil die Zeile
   ans Gate geht und dort als Format-E-Fehler abgelehnt wird.
2. Testspur aus §4 grün, `npm run build` grün.
3. Smoke: `graphcode run` mit `GRAPHCODE_LLM_INTERACTIVE=1` gegen ein lokales Modell. Eine
   Frage erscheint auf der Konsole, und die Antwort wirkt sich im nächsten Batch sichtbar aus
   (manuelle Session des Auftraggebers).
4. Headless-Lauf S2 (N = 1 reicht zum Nachweis des Kanals): Anzahl der Fragen > 0, und jede
   Frage hat eine Annahme im Graphen (REQ mit offenem Zielwert oder ACTOR mit offenem Kanal).
   Wenn das Modell nie fragt, ist das ein Befund für den Prompt, kein Fehler dieses CR.
5. RC-* kongruent für die neuen FLOW.
