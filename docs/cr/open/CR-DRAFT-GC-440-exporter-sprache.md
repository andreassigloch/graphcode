# CR-GC-440 — Deutsche Sätze in generierten Dokumenten eines englischen Modells

**Status:** Draft
**Datum:** 2026-08-27
**Herkunft:** Anhangsbefund 2 aus CR-GC-402 (`docs/cr/done/CR-DRAFT-GC-402-dashboard-zweite-wahrheit.md`),
dort bewusst NICHT mitumgesetzt.

## Problem

`exportMarkdown` schreibt Fußzeilen und Spaltenköpfe teils deutsch, obwohl das Modell
englisch ist. Belegt in `src/views/graphcode.ts`:

- Z. 108 — „Render-Form von REQ kind=risk (severity/occurrence/detection nach FM-01)."
- Z. 113 — Spaltenkopf „verifiziert" in der FMEA-Tabelle
- Z. 164 — Legendentext „Mitigation über `compose` … ‚verifiziert' nur …"

Betroffen sind `fmea.md`, dazu `conops.md`, `rtm.md`, `testmatrix.md`. In einem
englischsprachigen Modell steht das mitten im Dokument, das der Kunde in die Hand
bekommt.

## Soll

Exporter-Prosa durchgängig englisch — **oder** die Sprache aus Modell/Config ableiten.
Die Element-Inhalte bleiben unberührt: geändert wird nur der vom Exporter erzeugte
Rahmen (Überschriften, Spaltenköpfe, Legenden, Fußzeilen).

## Dateien (Kandidaten, vor Umsetzung schneiden)

| Repo | Datei | Änderung |
|---|---|---|
| graphcode | `src/views/graphcode.ts` | Rahmenprosa englisch (fmea, changelog, …) |
| graphcode | `src/views/incose.ts` | dito (conops, rtm, testmatrix) |
| graphcode | `src/views/srs.ts` | dito |
| graphcode | `src/views/helpers.ts` | gemeinsame Fußzeilen/Legenden an einer Stelle |
| graphcode | `tests/views-*.test.ts` | Regression auf die geänderten Kopf-/Fußzeilen |

## Offene Entscheidung

**Hart englisch** (eine Sprache, kein Schalter, keine Übersetzungstabelle) oder
**aus dem Modell abgeleitet** (Config-Feld + zwei Textsätze, damit auch ein deutsches
Modell stimmige Dokumente bekommt). Erst entscheiden — die zweite Variante zieht eine
Textkatalog-Struktur nach sich, die die erste nicht braucht.
