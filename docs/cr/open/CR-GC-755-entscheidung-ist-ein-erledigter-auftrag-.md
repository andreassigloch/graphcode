# CR-GC-755: Entscheidung ist ein erledigter Auftrag - Skills und Nachzug Regelkatalog 43

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-765 (idea)
**Erstellt:** 2026-10-07
**Item:** bok/items/ITEM-2026-765.json (Lane: code)

---

## Entscheidung des Autors (2026-10-07)

1. **Eine Entscheidung ist ein erledigter Auftrag.** Jede Analyse und jede Optimierung hält sich fest wie ein
   Change: Text in `docs/cr/done/`, schlanker CR-Knoten (`status: done`), `relation`-Kanten auf das Erzeugte und
   Geänderte. Ein erledigter Auftrag eröffnet keinen Bau. Verworfene Optionen stehen im Text, nicht als Knoten.
2. **Die Regel „erledigter Auftrag braucht Commit-Verweis" (CR-R02), `commitRef` und `architectureOnly` entfallen.**
   Der Commit steht in Git und ist über die Auftragsnummer auffindbar.

Der Katalog dazu: CR-SM-400 (sigloch-modules). Dieser Auftrag zieht graphcode nach — und mit ihm den noch offenen
Nachzug aus CR-SM-399 (IR-01, `reqRefs`, `READINESS_SCORED_PROFILES`, R-34).

## Was gestrichen wird

- Die Protokolldateien unter `docs/records/` als Schreibziel der Skills (`irr-<commit>.md`,
  `failure-mode-analysis.md`) — der Text steht im Auftrag.
- In `se-trade`: Optionsknoten, die Etiketten `decides` und `superseded-by` an Kanten.
- In `se-irr`/`se-fmea`: der Satz „kein Auftrag" (er stammte aus der Zeit, als ein offener Auftrag den Bau eröffnete).
- Im Code: `reqRefs` in `src/loop/task-artifact.ts`, das Vorbild mit `decides`-Kante in `src/loop/task-clause.ts`,
  der Satz mit `commitRef` in `src/loop/generate.ts`.

## Umfang

| Datei | Änderung |
|---|---|
| `.claude/commands/se-trade.md`, `se-irr.md`, `se-fmea.md`, `se-conops.md`, `se/optimize.md` | Abschluss: erledigter Auftrag mit Text, Knoten, Kanten |
| `tests/task-analysen.test.ts` | Test: jeder der fünf Skills nennt `docs/cr/done/`, `status: "done"`, `relation`; keiner die gestrichenen Wörter |
| `src/loop/task-artifact.ts`, `src/loop/task-clause.ts`, `src/loop/generate.ts` | Nachzug Katalog (nach CR-SM-400) |
| `tests/generate.task.test.ts`, `tests/claims.conformance.test.ts` | Nachzug Katalog |
| `package.json`, `package-lock.json` | Peer-Floor auf die neuen Majors |

## Nicht in diesem Auftrag — wartet auf den Autor

- Die Sicht „Variantenvergleich" (`renderTrade`) liest weiter die Etiketten `decides`/`alternative`/`superseded-by`.
  Ob sie entfällt oder künftig erledigte Aufträge aus Analysen zeigt, ist offen.
- Wer im Betrieb über den Executor (lokales Modell) die Textdatei schreibt.
- TR-01 und `crRefs` bleiben (ohne die `decides`-Bedingung), bis der Autor über ihren Entfall entscheidet.

## Abnahme

- `verify:code` und `verify:full CR-GC-755` grün.
- Der neue Test in `tests/task-analysen.test.ts` schlägt fehl, wenn ein Skill wieder nach `docs/records/` schreibt.
