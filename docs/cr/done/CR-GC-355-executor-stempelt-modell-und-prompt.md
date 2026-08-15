# CR-GC-355 — Der Executor stempelt Modell und Prompt

**Status:** done 2026-08-15 · **Angelegt:** 2026-08-15 · **Max Files:** 6 (dieser CR: **3**)
**Vorbedingung:** CR-GC-354 (`AuditEntry.sessionId/model/intent`, graph-api-core 3.1.0).
**Ziel:** der Pfad **ohne** Fremd-Transkript beantwortet „wer, mit welchem Prompt" von selbst.

---

## 1. Problem

`graphcode run` (CR-GC-278/279) ist der Pfad, für den es kein Client-Transkript gibt. Der Harness
hält beides im Prozess und wirft beides weg:

| Was | Wo | Wohin |
|---|---|---|
| `config.model` | [executor.ts:61](../../../src/executor.ts), im ganzen Lauf konstant | nirgends |
| die Prosa-Intention des Menschen | `opts.intent`, [run-verb.ts:81](../../../src/run-verb.ts) | nur in den ersten `graph_generate`-Call |

Bei `registry['graph_mutate'].handler(input)` ([executor.ts:542](../../../src/executor.ts) und
[:1074](../../../src/executor.ts)) landet ein Record im Trail, der `consumerId: 'mcp-client'` trägt —
den Default, den das Modell selbst nicht gesetzt hat — und sonst nichts über seine Herkunft.

Genau hier entsteht die Evidenz, aus der kalibriert wird: die Modell-Aufschlüsselung, auf der
CR-GC-284 ruht (*„R-01 dominierte die Rejections aller Modelle: Haiku 26/29, Opus 17/18, devstral
10/23"*), ist heute nur rekonstruierbar, weil ein Mensch wusste, welcher Lauf zu welchem Modell
gehörte.

---

## 2. Entscheidung: `intent` = die **menschliche** Prosa, nicht die Runden-Instruktion

Zwei Kandidaten, und sie schließen sich aus:

| | Runden-Instruktion (`gen.prompt`) | Prosa-Intention (`opts.intent`) |
|---|---|---|
| wiederherstellbar? | **ja** — deterministisch aus Graph-Zustand + den Templates in diesem Repo | **nein** — nach Prozessende aus nichts mehr |
| Größe | ~4 KB gerendertes Template je Record | 288 B im Mittel (gemessen, CR-GC-354 §3) |
| variiert je Record | ja | nein — konstant über den Lauf, dafür ist `sessionId` da |

Aufgezeichnet wird das **nicht Rekonstruierbare**. Die Runden-Instruktion auf jeden Record zu
stempeln kostete mehr als der gesamte bisherige Trail und dupliziert Template-Text, der im Repo
steht.

Der Stempel sitzt deshalb in `run-verb.ts`, **einmal pro Lauf**, nicht in der Runden-Schleife: er
gilt für jeden Record des Laufs, auch für Writes vor der ersten und nach der letzten Runde.

---

## 3. Umfang

1. `run-verb.ts` nimmt `bindToolsWithContext` statt `bindToolsToHarness` und setzt
   `ctx.setOrigin({ model: opts.config.model, intent: opts.intent })` vor `runExecutor`.
2. Test am **Produktions-Pfad** (`executeRun`, kein Parallelweg): jeder Record eines Laufs trägt
   Modell und Prosa, alle Records teilen **eine** `sessionId`.

**Nicht-Ziele:** keine Änderung an der Runden-Schleife, keine Änderung an `executor.ts`, keine
neue Env-Variable.

---

## 4. Akzeptanzkriterien

- [x] Jeder `mutate`/`validate`-Record eines Laufs trägt `model` = `config.model`.
- [x] `intent` ist die Prosa **wörtlich** — kein Präfix, keine Normalisierung.
- [x] Alle Records eines Laufs teilen **eine** `sessionId`.
- [x] Der Test läuft über `executeRun`, nicht über eine nachgebaute Verdrahtung.
- [x] Red-first nachgewiesen: ohne `setOrigin` schlägt er mit *expected undefined to be
      'devstral-small:24b'* fehl.
- [x] `npm run build` + `npm test` grün (Ausnahme: die vorbestehende CR-GC-346-F3-Rotfärbung).

---

## 5. Was dieser CR **nicht** löst

`REQ-prompt-provenance` (CR-GC-354 §7) ist damit für den Executor-Pfad erfüllt, für den MCP-Pfad
nicht — dort sieht der Harness den Prompt prinzipiell nicht. Das ist CR-GC-356.

Die Runden-Instruktion bleibt unaufgezeichnet (§2). Sollte sich Prompt-Template-Kalibrierung je auf
die *gerenderte* Instruktion stützen müssen statt auf das Template im Repo, ist das ein eigener CR
mit eigener Größenrechnung — nicht ein stiller Zusatz hier.

---

## 6. Betroffene Dateien (3)

| Datei | Änderung |
|---|---|
| `src/run-verb.ts` | `bindToolsWithContext` + `setOrigin` einmal pro Lauf |
| `tests/cli.run.test.ts` | Fall „stamps model and the human prompt onto every record of the run" |
| `docs/cr/open/CR-GC-355-executor-stempelt-modell-und-prompt.md` | dieser CR |

@author andreas@siglochconsulting
