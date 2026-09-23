# CR-GC-636: Das CR-Geruest verlangt den Umfang aus dem Graphen

**Status:** ✅ Done (2026-09-23)
**Typ:** aus Item ITEM-2026-520 (idea)
**Erstellt:** 2026-09-23
**Item:** bok/items/ITEM-2026-520.json (Lane: code)
**Analyse:** `docs/research/referenz-change-2026-09-23.md`, Potenzial C

---

## Befund

Die Werkzeugtabelle steht in `CLAUDE.md`, also am Sitzungsanfang. Die Fragen, die sie
beantwortet, entstehen **zweihundert Werkzeugaufrufe spaeter**. Nichts holt sie in dem Moment
hoch, in dem sie gebraucht wird.

Der `pre-commit`-Hook macht es richtig — er nennt die CODE-Spur genau dann, wenn committet wird.
Nur ist das der falsche Moment: da sind die drei Volllaeufe schon gefahren.

Es gibt genau einen Zeitpunkt, an dem der Umfang feststeht und noch nichts getan ist:
`aise dispatch prepare`. Dort entsteht das CR-Geruest.

## Zielbild

Das Geruest traegt zwei Dinge mehr:

1. einen Abschnitt **„Umfang laut `graph_impact`"**, der leer bleibt, bis jemand ihn fuellt —
   ein CR ohne ihn ist einer, der den Umfang geraten hat;
2. eine Zeile in der Ausgabe von `prepare`: bei einem Umbau → `/se-umbau` (CR-GC-635).

## Grenze, offen gesagt

Eine Vorlage, die man ausfuellen muss, wird ausgefuellt — nicht gelesen. Der Abschnitt kann mit
„—" gefuellt werden, und niemand merkt es. Deshalb steht das hier als C und nicht als A: es ist
eine Erinnerung an der richtigen Stelle, keine Durchsetzung.

Was es trotzdem wert ist: die Erinnerung kostet nichts, sie steht am einzigen richtigen
Zeitpunkt, und sie hinterlaesst eine **pruefbare Spur** — RC-07 liest ohnehin `docs/cr/`, und ein
leerer Abschnitt ist zaehlbar.

## Umfang

`bok/scripts/aise/` (dispatch prepare) — **anderes Repo.** Familie-Governance: der Zug gehoert
in bok, nicht hier. Dieser CR ist der Antrag, nicht die Umsetzung.

## Abnahme

1. Ein frisch praepariertes CR traegt den Abschnitt.
2. Die `prepare`-Ausgabe nennt `/se-umbau`.
3. Eine Zaehlung ueber `docs/cr/open/`: wie viele CRs tragen den Abschnitt gefuellt? Die Zahl ist
   die ehrliche Wirkung, nicht die Existenz der Vorlage.

---

## Umsetzung (2026-09-23) — in bok, als BOK-CR-068

Der Antrag ist angenommen und umgesetzt. `scripts/aise/lib/dispatch.mjs` und
`scripts/aise/aise.mjs`:

- `materializeCr(..., { crMode })` haengt im Modus `graph` den Abschnitt „Umfang laut
  `graph_impact`" an — im Modus `docs` nicht, dort gaebe es kein `graph_impact`.
- `prepare` nennt `/se-umbau` in der Ausgabe, ebenfalls nur im Graph-Modus.

**Rot zuerst:** die zwei Zusicherungen fuer den Graph-Modus schlugen vor dem Zug fehl.
`node scripts/aise/test.mjs`: 493 Pruefungen gruen in 12 Dateien.

**Smoke am echten Weg:** `aise dispatch prepare ITEM-2026-521 --lane code` → `CR-GC-638` traegt
den Abschnitt, die Ausgabe nennt den Skill. Der Beleg liegt als Datei im Repo, nicht als Zitat.

Die Zaehlung aus Abnahme 3 (wie viele CRs tragen den Abschnitt gefuellt?) ist erst sinnvoll, wenn
ein paar CRs durch den neuen Weg gegangen sind — heute ist es genau einer.
