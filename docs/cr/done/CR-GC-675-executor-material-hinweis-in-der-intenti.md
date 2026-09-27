# CR-GC-675: Executor: Material-Hinweis in der Intention loest das Nachlesen des Auftrags in jeder Runde aus

**Status:** ✅ Done (2026-09-27)
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

- [x] Rot zuerst: Test am echten Loop — ab der ersten Runde nach dem Seed enthaelt der
      `graph_generate`-Aufruf keinen `intent` mehr; scheitert der Seed, traegt die Folgerunde ihn weiter.
- [x] `graph_tests`-Auswahl (oben) gruen, Type-Check sauber.
- [x] Rig S2 auf **festem Build** (`dist/` vor der Serie gebaut, waehrend der Serie kein fremder Build),
      gcrun, sigllm-prosa, N = 3, 12 Runden, gegen gcrun-190..192:
      - `read_file material/auftrag.md` ≤ Seed-Stufen + 1 je Lauf (angepasst, s. Erwartung unten; vorher ≤ 1),
      - Elemente, Readiness req/uc und Laufzeit innerhalb der Basis-Spanne (45–58 El., 115–246 s).
      Faellt die Ausbeute, braucht das Modell den Auftrag je Runde — dann zurueck und Befund im Item.
- [x] VOLL-Spur (2026-09-27, Stand zug-exec nach CR-GC-694): 185/186 Dateien gruen; rot nur `tests/rig-measured.test.ts` (vorbestehend).

## Stand (2026-09-27)

**Code fertig, Rig-Kriterium offen (Messwelle).**

- `src/loop/executor.ts`: `seedPhase` — die erste Runde traegt den Intent, jede weitere nur, wenn
  `graph_generate` zuletzt `phase === 'seed'` meldete. Die Phase kennt der Treiber erst aus der
  Antwort; die erste Runde nach dem Seed traegt ihn deshalb noch (eine Runde Nachlauf).
- Verworfen: „Intent nur, solange kein SYS im Store steht". Das Rig saet `SYS-sig-local` vor dem
  Lauf (`run.mjs` `seedSystem`) — der Intent (Auftragstext aus `prompt-prosa.txt` + Material-Hinweis)
  waere nie beim Modell angekommen, die Seed-Stufen `seed:uc`/`seed:actor` haetten aus der
  Ein-Satz-SEED_DESC destilliert.
- Tests (`tests/executor.test.ts`, „intent nur in der Seed-Phase"): Rig-Start mit fertigem Seed →
  `[intent, –, –]`; gescheiterter Seed → `[intent, intent, intent, –]`. Vorher rot (Intent in jeder
  Runde). 17 Testdateien, die `executor` importieren, gruen; `npm run build` gruen.

**Erwartung fuer die Messwelle:** mit vorgesaetem SYS laufen im Rig `seed:uc`, `seed:actor` und eine
Nachlauf-Runde mit Intent — erwartet ≈ 3 `read_file material/auftrag.md` je Lauf statt 12, nicht
≤ 1. Das Kriterium „≤ 1" setzt voraus, dass nur der SYS-Seed den Intent braucht; die Seed-Stufen
UC/ACTOR destillieren aus ihm. Offen: Rig S2 (N = 3, 12 Runden, gegen gcrun-190..192) — Lesezahl,
Elemente, Readiness req/uc, Laufzeit; bei ≈ 3 Lesungen und gehaltener Ausbeute das Kriterium auf
„≤ Seed-Stufen + 1" anpassen.

## Ergebnis Messwelle (2026-09-27, Build f5bbc2b, N = 6: gcrun-0..5)

- **Lesungen `material/auftrag.md`: 3 je Lauf in 6/6** (Basis 12/12/12) — `seed:uc`, `seed:actor`, eine
  Nachlauf-Runde. Kriterium auf „≤ Seed-Stufen + 1" angepasst, wie oben vorgesehen.
- **Ausbeute bei gleicher Seed-Groesse gehalten.** Laeufe mit 3 Seed-UCs (wie die Basis und das Golden):
  gcrun-1/2/3 — 45/47/41 Elemente (Basis 45–58), readiness req 0.88/0.84/0.89 (Basis 0.83–0.87),
  uc 0.74/0.77/0.86 (Basis mit heutigen Regeln nachgerechnet 0.85–0.89), Laufzeit 260/221/152 s
  (Basis 115–246 s; gcrun-1 teilweise unter Ollama-Konkurrenz mit einem zweiten Modell).
- **Benannte Abweichung:** gcrun-0/4/5 saeten 7 UCs statt 3 (Seed-Klausel „3–7 UCs", unveraendert seit
  2026-09-20; die Seed-Runden tragen den Intent weiter, 675 beruehrt sie nicht). Mit 7 UCs reichen
  12 Runden nicht: uc 0.49–0.68, 52–80 Elemente, bis 1723 s (gcrun-0 unter Konkurrenz). Befund
  ITEM-2026-619, nicht hier.
- Messweg: readiness der Basislaeufe mit den heutigen Regeln nachgerechnet (Migration im Speicher
  wie `tests/generate.statemachine.test.ts`, `takeSteeringSnapshot`); die neuen Laeufe reproduzieren
  die Rig-Werte exakt. Golden-Hash wechselte (a2d01827f4a9) — Vergleich nur ueber graph-interne Zaehler.
