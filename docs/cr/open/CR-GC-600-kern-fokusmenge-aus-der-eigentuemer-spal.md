# CR-GC-600: Kern-Fokusmenge aus der Eigentuemer-Spalte statt aus vier Sonderlisten (ABNEHMBARE_REGELN, FOCUS_EXCLUDED_WHEN_UNBOUND, ARTEFAKT_EIGENE_REGELN, ND-Ausnahme): Kern = Kern-Regeln + Task-Eintrittspunkte; Abnahme im Kern nur an Eintrittspunkten

**Status:** ✅ Umgesetzt
**Typ:** aus Item ITEM-2026-453 (idea)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-453.json (Lane: graph)

---

## Umsetzung (2026-09-22)

`focus-set.ts` leitet die Fokusmenge aus der Eigentuemer-Spalte ab (contracts `taskOf`, CR-SM-350):
Kern = Kern-Regeln des Gate-Katalogs + ND (CR-GC-287) + die Eintrittspunkte AF-01..05 (selbst
Kern-Regeln); ein Task sieht sein Regelset als Warnung. Entfallen: `ABNEHMBARE_REGELN`,
`FOCUS_EXCLUDED_WHEN_UNBOUND`, `ARTEFAKT_EIGENE_REGELN` — ersetzt durch EINE Tabelle
`ABNEHMBAR_JE_TASK` (Kern: nur Eintrittspunkte; fmea FM-03, plan MS-01/CR-R01, conops CL-01,
realisierung R-19/20/26/32). Registersatz und Guide daraus abgeleitet; `se:generate` beschreibt Tasks
als Blackboxen.

**Messbar:** der Kern kann 41 der 74 Regeln in den Fokus stellen (vorher 60 Gate-Regeln + ND, ohne
Task-Grenze). Das Golden hat im Kern noch {AF-05, BW-02, RD-05} offen (MS-01 gehoert dem Bauplan).

Tests: `focus-set.test.ts` (Task sieht sein Regelset als Warnung, Kern nur Eintrittspunkte
abnehmbar), `generate.statemachine.test.ts`, `decision-texts.test.ts`. Die lesbare Tabelle erzeugt
`scripts/regel-matrix.mjs` → `docs/research/regel-matrix.{csv,md}`. **Kongruenz:** benannte Ausnahme.
