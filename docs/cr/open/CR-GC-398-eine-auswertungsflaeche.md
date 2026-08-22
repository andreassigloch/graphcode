# CR-GC-398 — Zwei Antworten auf dieselbe Frage

**Status:** open · **Angelegt:** 2026-08-22 · **Basis:** graphVersion 181
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
