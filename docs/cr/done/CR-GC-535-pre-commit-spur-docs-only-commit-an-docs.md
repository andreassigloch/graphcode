# CR-GC-535: Pre-Commit-Spur: docs-only-Commit an docs/graph/*.json umgeht codec.roundtrip — Modellaenderung muss den Roundtrip fahren

**Status:** ✅ Done (2026-09-15)
**Typ:** aus Item ITEM-2026-184 (finding)
**Erstellt:** 2026-09-15
**Item:** bok/items/ITEM-2026-184.json (Lane: code)

---

## Befund

73a7b31 committete einen Snapshot mit einer 43-zeiligen `description` (Leitlinie im
SYS-Knoten). Format-E ist zeilenbasiert: `codec.roundtrip` machte daraus 35 Phantom-SYS-Knoten.
Der Test liegt in `verify:model`, der Hook hat ihn angesagt, niemand hat ihn gefahren. CI war
zeitgleich an `npm ci` rot (Lock-Drift: contracts 10.1.0 im Lock, ^10.4 im Manifest, seit
mindestens 08:13) — die Roundtrip-Roete war darunter unsichtbar. Aufgefallen beim Release-Zug
2026-09-15 als `test fehlgeschlagen` im prepare von graphcode 0.21.0.

## Root Cause

CR-GC-399 hat den Hook bewusst auf Ansage gestellt, weil die volle Suite 6,5 min kostet und
Clean-Machine-Fehler lokal ohnehin nicht sichtbar sind. Das Argument traegt fuer die volle
Spur, nicht fuer die Modell-Spur: die ist deterministisch, lokal und ~45 s. Ein Snapshot, der
seinen eigenen Codec nicht ueberlebt, ist dieselbe Klasse wie der leere Snapshot, den der Hook
schon blockt (Pruefung 2).

## Aenderung

`scripts/githooks/pre-commit`: liegt ein `docs/graph/*.graph.json` im Diff, laeuft
`npm run verify:model`; rot blockt (`BLOCKED (CR-GC-535)`). Reine Doku-/CR-Commits bleiben
bei der Ansage. `VERIFY_MODEL_CMD` ist ausschliesslich der Testhaken.

## Nachweis

`tests/flow-contracts.test.ts`, drei Faelle gegen den ECHTEN Hook in einem Wegwerf-Repo:
Snapshot + rot -> exit 1 mit Blockmeldung; Snapshot + gruen -> exit 0; nur docs/cr -> Ansage,
kein Lauf. 17/17 gruen.

## Offen (nicht in diesem CR)

Lock-Drift zwischen Manifest und Lockfile wird weder vom Hook noch vom Doctor gemeldet;
CI faellt dann bei `npm ci`, bevor ein Test laeuft. Gehoert zu ITEM-2026-182-Nachbarschaft
(Doctor-Befundklasse), nicht in diesen Hook.

