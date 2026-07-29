# CR-GC-274 — Fit-Gate Härtegrad 1: Δm-Advisory am Apply-Gate

**Status:** ✅ Done (2026-07-29)
**Typ:** Feature (aimpro-Fahrplan-Schritt 4)

## Beschreibung

Jede **erfolgreiche** Mutation (auch dryRun-Verdicts) trägt jetzt ein
`fitAdvisory` am MutateResult: der ℝ⁶-Topologievektor vor/nach der Mutation auf
`layer:'arch'` (FUNC/FLOW/MOD/SCHEMA/ACTOR, via `@sigloch/se-optimizer`
`metrics`), das Δ je Dimension und die benannten `regressions` (Δ < 0).
Geblockte Mutationen tragen kein Advisory (kein Nachher-Zustand).
`graph_mutate` reicht das Feld unverändert durch (Result-Spread).

**Gate-Philosophie (hiermit entschieden, dokumentierte Tendenz):** das Advisory
ist eine **Messung, kein Gate** — es beeinflusst weder `tier` noch `success`;
geblockt wird ausschließlich über Regeln (analog CR-SM-223 „allocation cohesion
is a measurement, not a gate"). Härtegrad 2+ (Kompensations-Operatoren,
A-Stern/Beam) ist Fahrplan-Schritt 5 und braucht das Merge-Fixture.

`FitAdvisory` lebt vorerst als graphcode-Typ (`src/fit-advisory.ts`);
Schema-Promotion nach `@sigloch/contracts/harness` ist Contracts-CR-Kandidat
(gleicher Weg wie `GraphVersionSchema`, CR-GC-243).

## Akzeptanzkriterien

- [x] Erfolgreiche Arch-Mutation: `fitAdvisory` mit konsistentem Δ (after − before, ℝ⁶); Brückenkante hebt viability nachweislich
- [x] Doku-Mutation außerhalb des Arch-Layers → Δ = 0 auf allen Dimensionen
- [x] Regression wird in `regressions` benannt, `tier`/`success` bleiben regelbestimmt
- [x] Geblockte Mutation → kein `fitAdvisory`
- [x] dryRun trägt das Advisory; `loadGraph()` restauriert
- [x] `npm run build` grün; volle Suite 326/326 grün (inkl. distribution)

**Dateien:** `src/fit-advisory.ts` (neu), `src/harness.ts` (Gate-Anbindung +
Signatur), `tests/harness.fit-advisory.test.ts`, dieses Doc.
