# CR-GC-497 — der letzte Handaufbau mit echter Repo-Wurzel

**Status:** erledigt · **Angelegt:** 2026-09-09 · **Geschlossen:** 2026-09-09 · **Ring:** 2 (Werkzeug)
**Hängt an:** `CR-GC-492` (der Wächter, der ihn nennt) · `CR-GC-496` (`openMeasured({ repoRoot })`)
**Grundlage:** `tests/no-default-policy-when-judging.test.ts`, `OFFEN`-Liste

---

## 1. Root Cause

`tests/readiness-conformance-skip.test.ts:97` baut den Harness von Hand mit
`repoRoot: join(__dirname, '..')` — der **echten** Repo-Wurzel — und urteilt darauf
(`evaluateAll`, `importCoverage`, `skipped`). Ohne `opts.graphcodeConfig` fällt der Konstruktor
still auf `DEFAULT_CONFIG` (`harness.ts:142`): geurteilt wird mit Startwerten, nicht mit
`graphcode.config.jsonc`.

Die Datei ist **in `CR-GC-489` entstanden** — also in dem CR, der diese Fehlerklasse abstellen
sollte. Sie ist der einzige verbliebene Eintrag in der `OFFEN`-Liste des Wächters.

## 2. Impact

**Heute null** — die Config ist zeichengleich mit `DEFAULT_METRIC_POLICY` (`CR-GC-491` §2).

**Es beißt, sobald ein Budget wandert.** `CR-SM-303` will `boundaryWidth` senken. Ab dann prüft
dieser Test die Kongruenz-Fläche des graphcode-Selbstmodells gegen andere Schwellen als die
Produktion — grün, und über etwas anderes.

Der zweite `describe`-Block derselben Datei (Wurzel `join(tmp,'gibt-es-nicht')`) ist **korrekt**
und bleibt: er stellt absichtlich die Lage „keine CodeFacts" her.

## 3. Fix

1. Den urteilenden `describe`-Block auf `openMeasured({ repoRoot, graph, systemId, workspaceId })`.
   Der Block mit der Leerwurzel bleibt Handaufbau — dort ist die fehlende Wurzel der Gegenstand.
2. `expect(measured.provenance.policy.source).toBe('file')` — der Nachweis, dass die Config
   ankommt, nicht nur dass es kompiliert.
3. Den Eintrag aus `OFFEN` **entfernen**. Damit ist die Liste leer, und der Wächter prüft die
   Datei ab sofort mit.

### Dateien (2)

| # | Datei |
|---|---|
| 1 | `tests/readiness-conformance-skip.test.ts` |
| 2 | `tests/no-default-policy-when-judging.test.ts` — `OFFEN` leeren **und den Melder nachziehen** (§6) |

## 4. Akzeptanzkriterien

- [x] **Rot zuerst:** `OFFEN` geleert → der Wächter nannte genau
      `tests/readiness-conformance-skip.test.ts`, sonst nichts.
- [x] **Rot gegen den FINALEN Melder:** die Maskierung (§6) entstand nach dem ersten Rot-Lauf,
      also mit der alten Fassung der Datei nachgestellt — `1 failed | 4 passed`, mit der neuen
      `5 passed`. Ohne diese Gegenprobe wäre offen, ob der geänderte Melder überhaupt noch fängt.
- [x] `policy.source === 'file'` im umgestellten Block.
- [x] Die 8 Tests der Datei bleiben 8 (+1 für die Provenance-Assertion) — gemessen **9**.
- [x] `npm test` grün: 134 Dateien / **1076** Tests, 1075 → 1076 (die eine neue Assertion).
- [x] `OFFEN` ist leer, `ERLAUBT` unverändert bei zwei Einträgen.

## 5. Nicht im Scope

- `claims.conformance`, `perf.advisory-roundtrip.spike`, `steering.convergence-witness.spike`:
  **kein Defekt.** Die erste Fassung des Wächters hat sie falsch angeschuldigt, weil sie
  Anwesenheit statt Position prüfte — alle drei wurzeln im Wegwerf-Verzeichnis
  (`CR-GC-492` §6). Sie brauchen keine Umstellung.
- Das Einfrieren der Spike-Korpus-Graphen nach `rig/graphs/` (`CR-GC-493` §5) — eigener Vorgang.

---

## 6. Nachschrift — der Wächter meldete die Korrektur, die er verlangt

Nach der Umstellung war die Datei **immer noch rot**. Grund: `zeigtAufEchtesRepo` suchte
`repoRoot:` mit echter Wurzel — und `openMeasured({ repoRoot: join(__dirname,'..') })` trägt
genau dieses Feld. Der Melder unterschied das Feld, nicht **wessen** Feld.

Derselbe Fehlertyp wie in `CR-GC-492` §6, eine Ebene tiefer: dort war es Anwesenheit statt
Position, hier Position statt Zugehörigkeit.

**Fix:** `maskiere(text, ['openMeasured', 'createHarness'])` blendet die Argumentlisten der
Composition Root und des Messaufbaus aus, bevor gesucht wird — mit **Klammerzählung**, nicht mit
einem Zeichenfenster, sonst schließt ein verschachteltes `join(...)` den Block zu früh. Beide
Aufrufe nehmen eine echte Wurzel *bestimmungsgemäß* entgegen; sie sind die Lösung, nicht der
Befund.

Der Blindheits-Test trägt den Fall jetzt namentlich (`openMeasured({ repoRoot })` → `false`).

**Was das über den Wächter sagt:** er hat in zwei aufeinanderfolgenden CRs je einen Fehlalarm
produziert und beide Male war die Ursache dieselbe — ein Textmuster steht für eine Semantik, die
es nicht trägt. Er bleibt nützlich (er fand `readiness-conformance-skip.test.ts`, das meine
Handzählung nicht hatte), aber jede Verschärfung braucht die Gegenprobe gegen die alte Fassung.
Deshalb steht sie ab jetzt als eigenes Akzeptanzkriterium in §4.

**`OFFEN` ist leer.** Der Wächter prüft ab sofort jede Testdatei ohne Ausnahme, bis auf die zwei
begründeten `ERLAUBT`-Einträge.
