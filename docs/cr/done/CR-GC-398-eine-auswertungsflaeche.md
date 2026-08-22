# CR-GC-398 — Zwei Antworten auf dieselbe Frage

**Status:** done · **Angelegt:** 2026-08-22 · **Umgesetzt:** 2026-08-22 · **Basis:** graphVersion 181
**Umsetzung:** dieses Repo · **Dateien:** `src/tools/read.ts`, `src/readiness.ts`, `src/conformance.ts`,
ein neuer Test

## Problem — gemessen

Dieselbe Frage an denselben Graphen liefert zwei verschiedene Summen:

| Fläche | Findings |
|---|---|
| `rules_get_violations` (alle Severities) | **128** |
| `graph_readiness.violationsByRule` (Summe) | **137** |

Die Differenz sind exakt die 9 Konformanz-Findings `RC-04` (6) und `RC-05` (3). Ursache ist eine
Trennung nach Ein-/Ausgabe: `evaluateAllRules` arbeitet rein auf dem Graphen im Speicher,
`evaluateConformanceRules` braucht `extractCodeFacts(graph, repoRoot)` und damit das Dateisystem.
`rules_get_violations` und `rules_evaluate` rufen nur den ersten Pfad.

Die Trennung selbst ist begründet. **Falsch ist, dass die Abwesenheit unsichtbar bleibt.** Wer eine
Compliance-Zahl in einen Bericht schreibt, kann nicht erkennen, welche Fläche er gefragt hat — und
`jq` auf `rules_evaluate` nach `RC-05` liefert stumm `0`, nicht „nicht ausgewertet".

Belegt in dieser Sitzung: ich habe die Lücke durch Ausprobieren gefunden, nachdem eine `jq`-Abfrage
null Treffer lieferte, obwohl `graph_readiness` sechs meldete.

## Änderung

Ein Einstieg, eine Ergebnisliste, jedes Finding trägt seine Herkunft:

```
evaluateAll(graph, { facts? })
  → { findings: [{ …, source: 'rules' | 'conformance' }], skipped: ['conformance'] }
```

`skipped` ist gefüllt, wenn die CodeFacts nicht beschaffbar waren. Die Tools werden zu
**Projektionen derselben Liste** — sie unterscheiden sich im Filter, nie in der Grundgesamtheit:

- `rules_get_violations` filtert nach Severity, gibt `skipped` im Ergebnis mit.
- `rules_evaluate` gibt die ungefilterte Liste, ebenfalls mit `skipped`.
- `graph_readiness` aggregiert dieselbe Liste zu `violationsByRule`.

Keine Fläche darf künftig eine eigene Auswertung starten.

## Verankerung — der Versöhnungs-Test

Ohne Zwang driftet das zurück. Ein Test hält beide Summen zusammen:

```
Σ rules_get_violations(alle Severities)  +  Σ übersprungene Quellen
  ===  Σ graph_readiness.violationsByRule
```

Das ist dasselbe Muster wie `tests/skills.mcp-conformance.test.ts`, der repo-weit ausschließt, dass
noch jemand den stillgelegten Endpunkt anspricht: eine Assertion statt eines Absatzes Prosa.

## Nebenbefund, der mitgelöst werden sollte

Sechsmal in einer Sitzung ist ein Tool-Result übergelaufen — `rules_get_violations` 3×,
`rules_evaluate` 1×, `graph_readiness detail:true` 2×, jeweils 750–850 KB. Bei **667 Knoten**.
`graph_mutate` hat mit `violations: "summary"` längst die passende Projektion; den Lese-Tools fehlt
sie. Ein `detail: 'summary' | 'full'` an denselben Stellen kostet wenig und macht die Flächen erst
benutzbar.

## Akzeptanzkriterien

- [ ] Genau eine Funktion wertet aus; die drei Tools rufen sie und filtern nur.
- [ ] Jedes Finding trägt `source`; jedes Ergebnis trägt `skipped`.
- [ ] Der Versöhnungs-Test ist grün und war **rot gesehen** (durch Entfernen der Konformanz-Quelle).
- [ ] Die Lese-Tools tragen dieselbe `summary`/`full`-Projektion wie `graph_mutate`.
- [ ] Keine der drei Flächen ruft `evaluateConformanceRules` noch selbst — kein Parallelpfad.

---

## Ergebnis (2026-08-22)

**Dateien (6, nicht die drei geplanten):** `src/evaluation.ts` (neu) · `src/conformance.ts` ·
`src/tools/report.ts` · `src/tools/write.ts` · `tests/evaluation.reconciliation.test.ts` (neu) ·
`tests/conformance.test.ts` (nur Import).

Zwei Abweichungen von der Dateiliste des CR, beide mit Grund:

- **`src/readiness.ts` wurde nicht angefasst** — es ist seit CR-GC-265 ein reiner Re-Export-Shim;
  `computeReadiness` liegt in `@sigloch/graphcode-client`. Dort ist nichts zu ändern: die Funktion
  bekommt eine Violation-Liste und aggregiert sie. Der Fehler lag darin, WELCHE Liste sie bekam.
- **Stattdessen `src/evaluation.ts`** als eigene Fläche. `scoreReadinessWithConformance` ist von
  `conformance.ts` dorthin gewandert (kein Re-Export, kein Parallelpfad); `conformance.ts` liefert
  nur noch die Konformanz-QUELLE. `src/tools/write.ts` kam dazu, weil `summarizeViolations` sonst
  ein zweites Mal entstanden wäre — jetzt teilen sich Gate und Lese-Tools `stripViolationContext`.

| AK | Beleg |
|---|---|
| Genau eine Funktion wertet aus | `evaluateAll(harness)`. `rules_evaluate`, `rules_get_violations`, `graph_readiness` **und** `graph_help` rufen sie; keiner erhebt selbst. `graph_help` lief vorher mit ZWEI Auswertungen nebeneinander — das war ein dritter, im CR nicht bemerkter Drift-Kandidat. |
| `source` je Finding, `skipped` je Ergebnis | `Finding = RuleViolation & { source: 'rules' \| 'conformance' }`; `skipped` in allen drei Ergebnissen. |
| Versöhnungs-Test **rot gesehen** | Konformanz-Quelle aus `evaluateAll` entfernt → 2 von 6 fallen: *„expected 0 to be greater than 0"* und *„expected 108 to be less than 108"*. |
| `summary`/`full`-Projektion an den Lese-Tools | `detail`-Parameter an `rules_evaluate` + `rules_get_violations`, gleiche Enum-Semantik wie `graph_mutate.violations`. **Default abweichend: `full`** — siehe unten. |
| Kein Parallelpfad zu `evaluateConformanceRules` | Nur `conformanceViolations` ruft es, nur `evaluateAll` ruft `conformanceViolations`. |

**Abweichung, bewusst: der Default der Lese-Tools bleibt `full`.** Der Nebenbefund legt `summary`
als Default nahe (sechs übergelaufene Results). Dagegen steht eine benannte, getestete Zusage aus
CR-GC-309: `tests/mcp.mutate-violations.test.ts` → *„rules_get_violations still returns full depth —
the diagnosis tool is untouched"*. `graph_mutate` darf nur deshalb kürzen, WEIL die Diagnose-Tools
voll liefern. Den Default zu drehen hieße, diese verankerte Invariante still zu brechen. Die
Projektion existiert jetzt an beiden Lese-Tools und ist bei drohendem Überlauf mit
`detail:'summary'` abrufbar. **Ehrliche Einschränkung: das löst den Überlauf nur, wenn der Aufrufer
sie kennt.** Den Default zu drehen ist eine eigene Entscheidung samt Rücknahme jener Zusage — sie
gehört nicht in diesen CR.

**Zur Form des Versöhnungs-Tests.** Die Formel des CR (`Σ violations + Σ skipped == Σ
violationsByRule`) geht nicht auf, und zwar weil die Änderung wirkt: fällt die Konformanz-Quelle
aus, verlieren **beide** Flächen sie gemeinsam, die Summen bleiben gleich, der Zusatzterm ist
immer 0. Genau deshalb steht vor der Versöhnung ein **Guard-Test** („die Konformanz-Quelle ist hier
wirklich aktiv"): ohne ihn wäre die Gleichung trivial erfüllt und blind — er ist auch der Test, der
beim Rot-Sehen als erster fällt.

**Verifikation:** `npm run build` grün · `npx vitest run` **888/888 grün, 113 Dateien**.
