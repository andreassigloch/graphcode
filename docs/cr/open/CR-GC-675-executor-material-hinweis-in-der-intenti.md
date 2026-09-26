# CR-GC-675: Executor: Material-Hinweis in der Intention loest das Nachlesen des Auftrags in jeder Runde aus

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-576 (finding)
**Erstellt:** 2026-09-26
**Item:** bok/items/ITEM-2026-576.json (Lane: code)
**Nach:** CR-GC-667 (offen, aendert dieselbe Datei `src/loop/executor.ts` — erst dessen Stand committet)

---

## Befund

Der lokale Executor liest `material/auftrag.md` in 11–12 von 12 Runden neu. Das sind 36–57 % aller
gelesenen Zeichen eines Laufs, im 200-Runden-Lauf 78 % (Bedarfsanalyse `je-runde`, Leitlinie T-E9).

Ursache: `runExecutor` gibt den Intent bei **jedem** `graph_generate`-Aufruf mit
(`src/loop/executor.ts`, Kommentar „Nach dem Seed ist er redundant, nie falsch"), und
`generationStep` setzt ihn in jeden Rundenprompt als `Intention: "…"` (`src/loop/generate.ts`).
Der Rig-Intent endet mit dem Material-Hinweis „Der Auftrag liegt im Workspace unter
./material/auftrag.md. Er ist der einzige Input" — das Modell folgt ihm jede Runde.

Belegt in Runde 21 (`results-runde21-hinweis-*.json`, gcrun-190..192 gegen gcrun-200..202):

| | Basis (Verweis) | Auftragstext statt Verweis |
|---|--:|--:|
| `read_file material/auftrag.md` je Lauf | 12 / 12 / 12 | 1 / 1 / 1 |
| Laufzeit | 115–246 s | 589 s (n = 1 sauber) |
| Elemente | 45–58 | 23 (n = 1 sauber) |

Nur Lauf 200 ist sauber; 201/202 liefen mit einem fremden Build (CR-GC-667, Feld `questions` im Log).
Der Nachlese-Befund haelt in allen drei. CR-GC-663/664 hatten Text **und** Verweis im Prompt —
deshalb blieb das Nachlesen dort (35 → 32).

## Zielbild

„Nach dem Seed ist er redundant, nie falsch" ist widerlegt: nach dem Seed ist der Intent schaedlich,
weil er einen Lese-Auftrag in jede Runde traegt. `runExecutor` gibt `intent` nur, solange die
Seed-Phase laeuft (kein SYS im Graphen oder `gen.phase === 'seed'`). Danach faellt
`generationStep` auf die SYS-Beschreibung zurueck (`effectiveIntent = intent || sys.description`),
die keinen Dateiverweis traegt. Die Absicherung aus dem Kommentar bleibt: scheitert der Seed, laeuft
die Folgerunde weiter mit Intent.

Nicht Teil dieses CR: den Auftragstext in den Prompt legen (gemessen teurer, s. o.) und ein
Material-Gedaechtnis ueber Runden (CR-GC-663, zurueckgenommen).

## Umfang laut `graph_impact` (graphVersion 486)

- `FUNC-run-executor` — geaendert. 33 Knoten im Blast-Radius; relevant: `FLOW-run-request` (traegt die
  Intention), `FLOW-round-prompt`, `FUNC-generation-step` (Blackbox, bleibt unveraendert),
  `CR-GC-667` (offen, dieselbe Datei).
- `FUNC-generation-step` — unveraendert; sein Rueckfall auf die SYS-Beschreibung ist der Mechanismus.
- `graph_tests({changeSet:[FUNC-run-executor]})`: `tests/executor.test.ts`, `tests/executor.bestofn.test.ts`,
  `tests/cli.run.test.ts`, `tests/executor-config-contract.test.ts`, `tests/executor.question-channel.test.ts`,
  `tests/fund-kontext.test.ts`, `tests/openai-stream.test.ts`, `tests/anthropic-stream.test.ts`.

## Dateien (3)

`src/loop/executor.ts`, `tests/executor.test.ts`, diese Datei.

## Akzeptanzkriterien

- [ ] Rot zuerst: Test am echten Loop — ab der ersten Runde nach dem Seed enthaelt der
      `graph_generate`-Aufruf keinen `intent` mehr; scheitert der Seed, traegt die Folgerunde ihn weiter.
- [ ] `graph_tests`-Auswahl (oben) gruen, Type-Check sauber.
- [ ] Rig S2 auf **festem Build** (`dist/` vor der Serie gebaut, waehrend der Serie kein fremder Build),
      gcrun, sigllm-prosa, N = 3, 12 Runden, gegen gcrun-190..192:
      - `read_file material/auftrag.md` ≤ 1 je Lauf (Bedarfsanalyse `je-runde` fuer den Auftrag ≈ 0),
      - Elemente, Readiness req/uc und Laufzeit innerhalb der Basis-Spanne (45–58 El., 115–246 s).
      Faellt die Ausbeute, braucht das Modell den Auftrag je Runde — dann zurueck und Befund im Item.
- [ ] VOLL-Spur vor dem Schliessen.
