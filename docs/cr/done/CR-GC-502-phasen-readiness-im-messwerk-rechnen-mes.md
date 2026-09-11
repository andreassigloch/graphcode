# CR-GC-502: Phasen-Readiness im Messwerk rechnen, Messwerk-Zuordnung an den Code angleichen

**Status:** ✅ Done (2026-09-11)
**Typ:** aus Item ITEM-2026-034 (finding)
**Erstellt:** 2026-09-11
**Item:** bok/items/ITEM-2026-034.json (Lane: code)

---

BEFUND: computePhaseReadiness (src/kernel/measure) wird in src/loop/generate.ts:185 aus snapshot.violations aufgerufen. Die Verdichtung passiert damit in loop statt im Messwerk. compute-readiness und arch-fitness (se-engine) sind MOD-projections zugeordnet, integriert werden sie in src/kernel/measure (steering-snapshot.ts, fit-advisory.ts).
AENDERUNG: SteeringSnapshot traegt phaseReadiness, generationStep liest es. Modell und allocate mitziehen, Kongruenz ueber RC.

---

## Umsetzung (2026-09-11)

Code:
- `src/kernel/measure/steering-snapshot.ts`: `SteeringSnapshot.phaseReadiness`, gerechnet in `takeSteeringSnapshot` aus denselben `violations`.
- `src/loop/generate.ts`: liest `phaseReadiness` aus dem Snapshot, der eigene `computePhaseReadiness`-Aufruf entfällt.
- `tests/steering-snapshot.test.ts`: neuer Test — ohne die Änderung rot (`TypeError`), mit grün. `generationStep` deckt `tests/generate.test.ts` weiter ab.

Modell (Graph-Version 249 → 250):
- `phase-readiness` → `take-steering-snapshot` statt `generation-step`; `compute-phase-readiness` liest nicht mehr `steering-snapshot` (sonst ein Kreis).
- `compute-readiness` und `arch-fitness`: allocate `MOD-projections` → `MOD-kernel-measure`. Belegt: `metrics()` wird nur in `kernel/measure/fit-advisory.ts` aufgerufen, `computeReadiness` in `kernel/measure/steering-snapshot.ts` und `kernel/evaluation.ts`.

Messwerk → Führung jetzt 5 Flüsse: `steering-snapshot` (generation-step, next-step), `measurement-vector`, `dimension-readiness` (Skills), `fit-advisory` und `steering-delta` (rank-candidates parst beide).

## Bewusst offen

- Der workOrder nennt zwei se-engine-Dateien als „mitwandern“: externe Realisierung, dort wandert keine Datei.
- `report.ts:332` rechnet `phaseReadiness` weiter selbst — aus `evaluateAll` inklusive Konformanz, also aus einem anderen Regelstrom als der Snapshot. Keine zweite Rechnung derselben Messung.
- `compute-phase-readiness`: der Eingang „Regelstrom des Steuerungskatalogs“ (`evaluateAllRules` im Snapshot) ist kein FLOW; der `completeness`-Eingang stammt aus einem früheren Stand.

## Tests

- Build grün.
- Auswahl (`graph_tests` plus Snapshot-, Generate-, Readiness- und Messpfad-Tests): 104 Tests, 2 rot.
- Ganze Suite: 1071 von 1077 grün, 6 rot in 5 Dateien. **Alle 6 sind auch ohne diese Änderung rot** (Gegenprobe mit zurückgestelltem Code). Die Tests arbeiten mit Fixtures oder Zeitmessung, nicht mit dem Modell:
  - `steering.artifact-coupling`, `steering.test`, `steering.process-ratchet`: IO-02 aus contracts 20 (Lokal-Modus) feuert auf die Fixtures → ITEM-2026-036.
  - `claims.conformance` (2×): die veröffentlichten Zählwerte kennen contracts 20 noch nicht (Kanarienvogel für den Bump).
  - `perf.advisory-roundtrip.spike`: Skalierung 500 → 2000 Knoten ergibt 5,3 ohne und 5,1 mit der Änderung, Schwelle 3 → ITEM-2026-037.
