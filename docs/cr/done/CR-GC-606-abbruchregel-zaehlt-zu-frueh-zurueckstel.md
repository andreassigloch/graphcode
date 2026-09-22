# CR-GC-606: Abbruchregel zaehlt zu frueh: zurueckstellen erst beim dritten gleichen Feedback (opus5-15, CR-01 nach Folgezug)

**Status:** ✅ Done (2026-09-22)
**Typ:** aus Item ITEM-2026-463 (bug)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-463.json (Lane: graph)

---

## Befund (opus5-15)

Der R-04-Zug erzeugte einen CR-01-Fund; der naechste Zug trug nur die Modulbeschreibungen nach — kein
Versuch an CR-01. Die Abbruchregel (CR-GC-596) stellte CR-01 beim zweiten gleichen Feedback zurueck, der
Agent sah ihn nie; Ende `stalled` ("uebergib an den Menschen") statt `done`.

## Entscheidung (2026-09-22)

Zurueckgestellt wird beim DRITTEN gleichen Feedback: steht derselbe Fokus zwei Zuege nach seiner
Auslieferung noch, kommt der naechste Kandidat. Eintrittspunkte bleiben ausgenommen (CR-GC-604).

## Aenderung

- `stagnation.ts`: Zaehler je Fokus (`repeats`), Schwelle `WIEDERHOLUNGEN_BIS_ZURUECK = 2`; ein
  `graph_generate` ohne Zug dazwischen zaehlt nicht und setzt nicht zurueck.
- `decisions.ts`, `se:generate`, stalled-Prompt in `generate.ts`: Wortlaut nachgezogen.

## Test

`tests/stagnation.test.ts`: nach einem Zug bleibt der Fokus, nach dem zweiten kommt ein anderer; Aufruf
ohne Zug zaehlt nicht.

