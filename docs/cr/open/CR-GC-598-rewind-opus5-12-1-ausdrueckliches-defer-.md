# CR-GC-598: Rewind opus5-12: (1) ausdrueckliches defer des Hosts geht nicht ins Sitzungsgedaechtnis — next bietet das zurueckgestellte Fenster wieder an; (2) blockingErrors zaehlt nicht-blockierende und abnehmbare Fehler (FM-03 gating:false) — die Probe meldete 0->8, der Agent liess FM-01 deshalb offen

**Status:** ✅ Umgesetzt — zweiter Rewind folgt
**Typ:** aus Item ITEM-2026-450 (bug)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-450.json (Lane: graph)

---

## 1 Befund (Rewind opus5-12, ab Zug 18 von Lauf 11)

1. Der Agent rief `graph_generate {defer:[…FM-01-Fenster…]}` — `next` bot eines davon beim naechsten
   Zug wieder an: ein ausdrueckliches defer des Hosts ging nicht ins Sitzungsgedaechtnis.
2. Der Agent liess S/O/D an 16 Risiko-REQs bewusst weg (FM-01 offen), weil seine Probe
   "blockingErrors 0 → 8" meldete. Das waren FM-03-Fehler — abnehmbar, und am Gate nicht blockend.
   Richtig waere gewesen: S/O/D setzen, FM-03 abnehmen. Unsere Zahl hat ihn weggeschoben.
3. Nebenbei: CR-GC-593 hatte ND-01/02 still aus dem Fokus genommen, obwohl CR-GC-287 sie bewusst
   hineingelegt hatte (der Test pruefte nur `blockingErrors`, nicht den Fokus).

## 2 Umsetzung

- `kernel/measure/focus-set.ts`: EINE Fokusmenge fuer Schritt, Probe (`steeringDelta`) und Bericht;
  `ABNEHMBARE_REGELN` wohnt hier (Kernel, weil alle drei lesen), `decisions.ts` re-exportiert.
  ND-01/02 wieder im Fokus.
- `steering-snapshot.ts`: `focus` + `blockingErrors` = Fehler-Funde der Fokusmenge. Bewusst NICHT
  "blockt am Gate": das tun nur R-01/R-08/IO-02/R-18/R-29, deren Funde nie persistieren — die Zahl
  waere immer 0. Die Aenderung: abgenommene Funde und Regeln ausserhalb der Steuerung zaehlen nicht.
- `generate.ts`: Regel-Klausel **FM-01**: "setze S/O/D; ergibt sich hohes Risiko, feuert FM-03 —
  nimm es im selben Batch ab; lass die Bewertung nicht weg" — dort, wo er entscheidet.
- `stagnation.ts`: ein ausdrueckliches defer gilt fuer die Sitzung.

## 3 Tests

`tests/focus-set.test.ts`: FM-03 offen zaehlt, abgenommen nicht; ND im Fokus; FM-01-Klausel nennt
FM-03 und die Abnahme; Architektur-Abnahme wirkt nicht; BQ/info nicht im Fokus; defer via
`graph_generate` gilt auch fuer `next`. Suite 1360/1361 (bekannt: distribution bis contracts 10.9).
**Kongruenz:** benannte Ausnahme. Bestaetigung: zweiter Rewind ab Zug 18.
