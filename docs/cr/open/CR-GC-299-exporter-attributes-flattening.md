# CR-GC-299 — exporter.ts flacht attributes ab, TRR/CDR über generate/steering strukturell blockiert

**Status:** open
**Datum:** 2026-08-04
**Kontext:** Fund während der Implementierung von CR-GC-296 (phase_readiness-Konsum),
nicht dort behoben — orthogonal zum eigentlichen CR-296-Scope, aber mit direkter
Konsequenz für dessen neue Handoff-Bedingung.

## Befund

`src/exporter.ts`s `exportGraphJson` hebt `node.attributes` auf die
Top-Level-Struktur jedes Elements ("flattening"). Mehrere Regeln aus
`@sigloch/contracts/se` lesen jedoch verschachtelt (`element.attributes?.x`):
R-19 (`testRef`), R-20 (`realRef`/`codeRef`), VR-01, SC-04 (`FLOW→SCHEMA`).

Betroffen ist die Pipeline `evaluateAllRules(exportGraphJson(graph))`, die
`generate.ts`/`steering.ts` nutzen (NICHT der L2-Gate-Pfad — `graph_readiness`
über `harness.evaluateRules()` liest direkt vom Graph und ist unbetroffen).
In dieser Pipeline feuern R-19/R-20/VR-01/SC-04 auf jedem Graphen mit ≥1
TEST/FUNC unbedingt, weil sie das (durch das Flattening) leere
`attributes`-Objekt sehen statt der echten Bindung.

## Impact

CR-GC-296 macht `generationStep`s Handoff neu von „aktuelles Phase-Gate
vollständig" abhängig (SRR→PDR→CDR→TRR). TRR hängt strukturell an R-19/R-20
(TRR-Dimension in `RULE_TO_PHASE`), CDR teilweise an SC-04. Solange das
Flattening besteht, kann TRR über `generate.ts`/`steering.ts` vermutlich NIE
vollständig werden, unabhängig vom tatsächlichen Bindungsstand des Graphen —
`graph_generate`s Handoff bliebe in echten Läufen bei TRR hängen.

`graph_readiness` (Dashboard/direkter Tool-Call) ist NICHT betroffen — nur der
generate/steering-interne Regel-Lauf auf dem exportierten JSON.

## Ziel

Eine der beiden Optionen (Entscheidung bei Umsetzung, nicht hier vorentschieden):

1. `exportGraphJson` verschachtelt `attributes` korrekt (kein Flattening mehr) —
   Konsumenten von `exportGraphJson`, die sich auf die geflachte Form verlassen,
   müssen geprüft werden (grep alle Aufrufer).
2. `evaluateAllRules` in `generate.ts`/`steering.ts` bekommt den Graphen
   UN-exportiert (nativen `OntologyGraph`, nicht den JSON-Export-Roundtrip) —
   falls der Export-Schritt dort nur aus historischen Gründen existiert und
   kein Format-E- oder Wire-Format-Zwang vorliegt.

## Dateien (≤6, grobe Schätzung — bei Umsetzung prüfen)

- `src/exporter.ts`
- `src/generate.ts`
- `src/steering.ts` (falls vorhanden/betroffen)
- Tests (bestehende `tests/generate.test.ts`, `tests/readiness.model.test.ts` +
  neuer Regressionstest: Graph mit gebundenem TEST.testRef/FUNC.realRef ⇒ R-19/
  R-20 feuern NICHT über die generate/steering-Pipeline)

## Akzeptanzkriterien

- [ ] Regressionstest: ein Graph mit echten testRef/realRef-Bindungen zeigt über
      `generate.ts`/`steering.ts`s Regel-Lauf 0 R-19/R-20-Violations (aktuell:
      feuert unbedingt)
- [ ] `graph_readiness`s Ergebnis bleibt unverändert (kein Regressions-Test-Fail
      dort — der L2-Pfad war nie betroffen)
- [ ] Ein reales Handoff-Szenario (Graph mit vollständigem TRR-Bindungsstand)
      erreicht `done:true` über `generationStep`
- [ ] `npm run build` + Tests grün
