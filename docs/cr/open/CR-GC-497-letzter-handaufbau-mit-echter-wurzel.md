# CR-GC-497 — der letzte Handaufbau mit echter Repo-Wurzel

**Status:** offen · **Angelegt:** 2026-09-09 · **Ring:** 2 (Werkzeug)
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
| 2 | `tests/no-default-policy-when-judging.test.ts` — `OFFEN` leeren |

## 4. Akzeptanzkriterien

- [ ] **Rot zuerst:** `OFFEN` geleert → der Wächter nennt die Datei. Erst dann umstellen.
- [ ] `policy.source === 'file'` im umgestellten Block.
- [ ] Die 8 Tests der Datei bleiben 8 (+1 für die Provenance-Assertion) — keiner verschwindet.
- [ ] `npm test` grün.
- [ ] `OFFEN` ist leer, `ERLAUBT` unverändert bei zwei Einträgen.

## 5. Nicht im Scope

- `claims.conformance`, `perf.advisory-roundtrip.spike`, `steering.convergence-witness.spike`:
  **kein Defekt.** Die erste Fassung des Wächters hat sie falsch angeschuldigt, weil sie
  Anwesenheit statt Position prüfte — alle drei wurzeln im Wegwerf-Verzeichnis
  (`CR-GC-492` §6). Sie brauchen keine Umstellung.
- Das Einfrieren der Spike-Korpus-Graphen nach `rig/graphs/` (`CR-GC-493` §5) — eigener Vorgang.
