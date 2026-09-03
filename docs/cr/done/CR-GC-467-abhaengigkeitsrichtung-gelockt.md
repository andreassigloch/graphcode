# CR-GC-467 — Abhängigkeitsrichtung: gelockt und erzwungen

**Status:** done · **Angelegt:** 2026-09-03 · **Abgeschlossen:** 2026-09-03 · **Herkunft:** Bottom-up-Entwurf gegen die Doktrin
(Session 2026-09-03), Entscheidungen des Auftraggebers; Herleitung und Messung in CR-DRAFT-GC-466

## Root Cause

Der Modulschnitt ist richtig (CR-461, bottom-up bestätigt) — die **Richtung** ist es nicht: 129
modulübergreifende Importe, 17 gerichtete Kopplungen auf 10 Paaren, **14 davon in Zyklen**. Der
Kern importiert aus `projections` (5), `surface` (1) und dem Barrel (1). Nichts hat das verhindert,
weil die Richtung nirgends stand: weder als Lock noch als Test. Das Target-Konzept kann sie nicht
tragen — `layer:'arch'` kennt keine Import-Kanten.

## Entscheidungen (2026-09-03)

1. **Messung gehört in den Kern**, unter das Gate — Readiness, Fit-Advisory, Testauswahl,
   Ähnlichkeit. Das Gate urteilt mit ihnen; `projections` zeigt sie nur an.
2. **Erzwingung zuerst als Test im Repo**; eine Familienregel (`layer`-Attribut am MOD) später,
   falls das Muster in anderen Repos gebraucht wird.
3. **`reseed` / `rewind` / `seedFromJson` sind Operations**, keine Edits — sie ersetzen den
   Zustand, kernel-intern. L1 („ein Apply-Gate = `mutate()`") meint Edits; die Operations sind
   weder zweiter Schreibpfad noch Gate-Bypass.

## Änderung

- `CLAUDE.md`, „Locked constraints": die Richtung `kernel ← loop ← projections ← surface ← root`
  und die zwei Bäume (MOD = Abhängigkeitsbaum, FUNC = Wertbaum, spiegeln einander nicht); L1 um
  die Operations-Klarstellung ergänzt. „Enforced, not documented" verweist auf den Test.
- `tests/import-boundaries.test.ts`: statische relative Importe je Schicht, Type-only zählt mit.
  **Ratchet** — die 40 heutigen Inversionen stehen als `DEBT`; neu ⇒ rot, getilgt-aber-gelistet ⇒
  rot. Die Liste kann nur schrumpfen.

Die Ordnung `loop < projections` ist gemessen, nicht gesetzt: alles, was `loop` aus `projections`
zieht, ist Messung (nach Entscheidung 1 im Kern); was `projections` aus `loop` zieht, ist das
Zielprofil (Konfiguration) und `steering` — Projektion rendert Steuerungsergebnisse.

## Abgrenzung

- **Kein Code wird umgezogen.** Die Tilgung der 40 Einträge sind eigene CRs (≤6 Dateien): C1
  Messung → Kern (5 + 10 Importe), C2 Zielprofil → Konfiguration (3), C3 Hilfetexte/Dateinamen
  bleiben Oberfläche (4), A Tool-Interface (16, davon 14 `type`), B Barrel-Importe (7).
- **Kein Fitness-Claim.** Für den ℝ⁶-Vektor ist die Entzyklisierung unsichtbar.
- **Kein Modulumbau** (CR-461 bleibt).

## Akzeptanzkriterien

- [x] Rot gesehen: mit leerer `DEBT`-Liste meldet der Test die 40 Inversionen (Test 2 rot, 1 und 3 grün).
- [x] Grün mit der Liste (3/3). Gegenprobe: ein erfundener Listeneintrag macht Test 3 rot.
- [x] Ein aus der Liste gestrichener, aber noch existierender Eintrag macht Test 2 rot; ein getilgter,
      aber noch gelisteter Test 3 (Gegenprobe oben).
- [x] `CLAUDE.md` trägt die drei Sätze; `npm run build` grün.

## Dateien

1. `CLAUDE.md`
2. `tests/import-boundaries.test.ts`
3. dieser CR
