# CR-GC-842: Arch-Spike gehoert in die Modell-Spur

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1025 (finding)
**Erstellt:** 2026-10-22
**Item:** bok/items/ITEM-2026-1025.json (Lane: code)

---

## Befund

`tests/arch.optimization-dry-run.spike.test.ts` stand unter `EXCLUDED` in `scripts/model-test-set.mjs`. Der Grund dort: „kein Modellinhalt, den die Modell-Spur decken müsste". Das stimmt nicht. Der Test pinnt zwei Werte, die aus der committeten SSOT folgen:

- den Zug am Engpass: `FUNC-block-bedienung -compose-> FUNC-test-ingest (retire FUNC-test-ingest)`,
- den Engpass danach: BW-02 an `FUNC-block-grounding`.

In CR-GC-840 machte eine reine Modelländerung ihn rot. `verify:model` meldete grün, erst `verify:full` sah es.

## Änderung

- Der Test steht jetzt in `INCLUDED`, mit dem Grund am Eintrag.
- Kosten: 12 s je Lauf der Modell-Spur (gemessen 2026-10-22).

## Umfang

- `FUNC-verify-lane-model`, `REQ-model-lane-fixed-set` (relation-Kanten am CR-Knoten).
- Datei: `scripts/model-test-set.mjs`.

## Prüfung

- `tests/verify-model.completeness.test.ts` grün.
- Spike-Test allein grün (12 s).
