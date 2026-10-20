# CR-GC-820: CR-Regel für Graph-Repos fehlt seit Kürzung der globalen CLAUDE.md — gehört in GRAPHCODE.md

**Status:** ✅ Done (2026-10-20)
**Typ:** aus Item ITEM-2026-980 (finding)
**Erstellt:** 2026-10-20
**Item:** bok/items/ITEM-2026-980.json (Lane: graph)

---

## Problem

Die globale CLAUDE.md wurde auf < 100 Zeilen gekürzt und enthält nichts mehr zu graphcode. Damit fiel die
Regel „CR-Verwaltung in Graph-Repos" samt Fertig-Kriterium „RC-* kongruent" (BOK-CR-033) weg. bok,
graph-view-edit, sigloch-modules und sigllm verwiesen genau darauf.

## Entscheidung

Die Regel steht einmal in `bok/docs/governance/CR-GRAPH-REPOS.md`, neben `aise`, das sie umsetzt. Die Repos
verweisen dorthin, keines kopiert den Text.

**Verworfen: `GRAPHCODE.md`** (die Vorlage, die graphcode in jedes Member-Repo schreibt). Ihr Wächter
`tests/vorspann.test.ts` (CR-GC-612) verlangt < 6.000 Zeichen, keine Werkzeugnamen, keine Regel-IDs; die
Datei hatte schon 5.983 Zeichen, der Abschnitt brachte 1.040 dazu und verletzte alle drei Prüfungen.
Außerdem geht `GRAPHCODE.md` an jeden npm-Nutzer, die Regel hängt an `aise` und `bok/items` — nur Familie.

## Umfang

- `bok/docs/governance/CR-GRAPH-REPOS.md` (neu)
- `CLAUDE.md` in bok, graph-view-edit, sigloch-modules, sigllm, graphcode: Verweiszeile
- `graphcode/CLAUDE.local.md` (nicht versioniert): Block durch Verweis ersetzt
- Graph: `CR-GC-820 -relation-> FUNC-graph-readiness` (das Werkzeug, dessen Urteil das Fertig-Kriterium liest)

Kein Code geändert, keine Testspur betroffen.
