# CR-GC-511: graphcode-Tests unter contracts 20: Fixtures verletzen IO-02

**Status:** ✅ Done (2026-09-11)
**Typ:** aus Item ITEM-2026-036 (finding)
**Erstellt:** 2026-09-11
**Item:** bok/items/ITEM-2026-036.json (Lane: code)

---

## Problem

Unter contracts 20 (Lokal-Modus, IO-02 aus CR-SM-307) waren 5 Tests in 4 Dateien rot — das Item nannte zwei:

| Test | Meldung |
|---|---|
| `claims.conformance` — Zahl je Fundstelle | Artikel sagen „63 engine rules", Quelle sagt 64 |
| `claims.conformance` — Kanarie | `engine rules=63` erwartet |
| `steering.test` — next_step | `expected 3 to be 2` (Sperrfehler) |
| `steering.artifact-coupling` — T-B1 follow-up | `PDR gained new open rules from the repairs: [IO-02]` |
| `steering.process-ratchet` — T-B3 | `blocking errors rose at round 4: 4 > 3` |

## Ursachen (Producer, nicht Consumer)

1. **Regelzahl.** IO-02 ist eine scorende Regel (arch/PDR): 63 → 64. Die Katalogzahl ist 70, die Artikel nennen
   bewusst die scorenden (CR-SM-305). `docs/articles/03`, `04`, `06` und die Kanarie nachgezogen.
2. **Fixture `steering.test`.** `OrderData.FL.001` hatte zwei Produzenten (`Customer.AC.001`, `Validate.FN.001`).
   Jetzt sendet der Kunde seinen eigenen FLOW `OrderInput.FL.002` an Validate, gleiches SCHEMA (n FLOW → 1 SCHEMA).
3. **Skriptierter Aktor** (`tests/fixtures/steering-graphs.ts`). Zwei kanonische Reparaturen machten einen ACTOR
   zum ZWEITEN Sender eines FLOW:
   - R-16: `ACTOR-auditor → FLOW-document` (Sender schon `ACTOR-operator`) → jetzt liest der Auditor
     `FLOW-result`; ein weiterer Leser ist kein weiterer Produzent.
   - UC-02: `ACTOR-auditor → FLOW-result` (Sender schon `FUNC-parse`) → jetzt eigener FLOW
     `FLOW-review-request-<seq>` → `FUNC-render` mit `SCHEMA-result`, genau der fix_hint von IO-02.
   Das Gate liess beide Batches durch, weil graph-api-core IO-02 nicht gated (`GATING_PREFIXES = R-/RD-/MT-`,
   `se-descriptor.ts:171`); readiness zaehlte den neuen Fehler trotzdem — daher T-B1 und T-B3.

## Tests

- Die 4 Dateien: 25/25 gruen (vorher 5 rot).
- Volle Suite: 1087/1088 — rot nur `tests/perf.advisory-roundtrip.spike.test.ts` (ITEM-2026-037, nicht Teil dieser CR).
- `npm run type-check` und `npm run build` gruen, `dist/cli.js --help` antwortet.
- Kongruenz: kein Modellzug, kein `src/`-Symbol mit realRef beruehrt — Stand wie nach CR-GC-510 (importCoverage 88/89).

## Bewusst offen

- IO-02 blockt am Gate nicht → ITEM-2026-047 Punkt 2 (Befoerderung in graph-api-core, Familien-Entscheidung).
- Perf-Spike rot → ITEM-2026-037.
