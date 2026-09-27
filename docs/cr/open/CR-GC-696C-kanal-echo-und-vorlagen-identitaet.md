# CR-GC-696C: Kanal-Echo ohne Format-E-Syntax, Vorlagen-Identitaet kennt add-node und retires

**Status:** 🟠 Open
**Typ:** Teil von CR-GC-696 (Teile 7 und 4-teilweise), aus Item ITEM-2026-614
**Erstellt:** 2026-09-27

---

## (7) tests/channel-rank.test.ts — „an einer ECHTEN Runde"

**Root Cause.** `duplicateChannels` zerlegt jeden Block in „Saetze" (Trenner `.;:\n`, Mindestlaenge
25) und vergleicht Wortmengen. Seit CR-GC-673/674 fuehren das Vorbild der Runde (`step.prompt`) und
das Skill-Template (`se:author-req`, Kanal `guidance`) beide eine REQ mit `@kinds ["non-functional"]`
vor. Die Zeile ist genau 25 Zeichen lang, also ein „Satz"; ihre Wortmenge {kinds, functional} ist
in beiden Kanaelen gleich → Ueberlappung 1,0 → Fund. `@kinds ["functional"]` (21 Zeichen) fiel
nur zufaellig unter die Mindestlaenge.

Das ist kein zweiter Imperativ: eine Format-E-Zeile ist Syntax eines Vorbilds, keine verlangte
Arbeit. Invariante des Tests unveraendert („der Imperativ steht genau einmal").

**Fix.** `src/loop/channel-rank.ts`: Format-E-Zeilen (`@attr`, `+ `, `~ `, `## `/`### `) zaehlen
nicht als Saetze. Neuer Test mit Positivkontrolle (dieselbe Aussage als Prosa bleibt ein Fund);
rot vor dem Fix gesehen.

## (4, teilweise) noteTemplateEdits kennt add-node und retires

**Root Cause.** Der Stempel `editSource` (CR-GC-434) merkte sich je Vorschlag nur die gespiegelte
Kante `source/target/type` und erkannte nur `add-edge`. Seit CR-GC-684 ist die gelieferte Vorlage
ein BATCH (`batchFor`: `add-node`, `delete-edge` je `retires`/`retire`, `add-edge` je `edges`,
`merge-nodes`). Wer den gelieferten RD-04-Zug exakt anwandte, bekam `authored` — die
Zirkularitaets-Messung zaehlte Vorlagen-Nutzung als eigene Formulierung.

**Fix.**
- `src/surface/mcp-tools.ts`: merkt sich `batchFor(edit)` — derselbe Batch, den der dryRun beurteilt hat.
- `src/surface/tool-context.ts`: Identitaet je Kommando (`add-node` = uid+type, Kanten = drei Enden,
  `merge-nodes` = beide uids); `TemplateEdit` entfaellt, keine zweite Form. `update-*`/`delete-node`
  sind nie Vorlage.
- `src/surface/tool-context-contract.ts`: Signatur `noteTemplateEdits(commands: MutateCommand[])`.
- `tests/suggest.add-node.test.ts`: RD-04-Zug am echten Gate ueber die Werkzeugschicht angewandt →
  `suggestion-template`; eigene Formulierung danach → `authored`. Rot vor dem Fix gesehen.

`src/loop/executor-prompt.ts` (Vorschlag als eine Kante gezeigt) bleibt bei CR-GC-672.

## Tests

`tests/channel-rank.test.ts`, `tests/suggest.add-node.test.ts`, `tests/trajectory-stamps.test.ts`,
`tests/import-boundaries.test.ts`, `tests/mcp.symmetry.test.ts` gruen; `tsc --noEmit` sauber.
