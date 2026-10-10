# CR-GC-780: Entwurfsregel am geteilten Glied, Gesamt-Impact ohne Baubefunde

**Status:** ✅ Done (2026-10-10)
**Typ:** Modell und Konzept (kein Code)
**Erstellt:** 2026-10-10
**Herkunft:** ITEM-2026-815, Spike Gesamt-Impact (graphanalyze `docs/messung/gesamt-impact-2026-10-10/`)
**Bezug:** `docs/graphcode_analyse_optimierungskonzept.md` — Sicht Anforderung und Wirkkette, Optimierung (6b),
Ergebnis d (Konflikt am Kreuzungspunkt)

## Anlass

Im Spike ordnete die feste Rangfolge drei Entwürfe für Rundenprotokoll und Entdeckung über Runden C vor A vor B.
Analyse (CR-GC-779) und Blindurteil ordnen A vor B vor C. C lässt das Gate das Protokoll schreiben und bricht
damit die Regel „das Gate urteilt und speichert, sonst nichts". Diese Regel stand in `CLAUDE.md` und im Test,
aber nicht als Anforderung am Gate im Modell.

## Umfang

1. **Modell:** `REQ-gate-judges-and-stores` an `FUNC-mutate` (erfüllt), geprüft von
   `TEST-gate-urteilt-und-speichert` (gebunden, grün), unter `UC-code-quality`.
2. **Konzept, Konventionen für Optimierung 7 und 8:** eine Entwurfsregel an einer geteilten Funktion steht als
   Anforderung an ihr; der Vergleich zählt keine Befunde aus dem Bau (R-20, R-26, R-32).
3. **Konzept, „Offen":** die Frage, wo ein Konflikt (Ergebnis d) steht, ist damit beantwortet.

## Ergebnis

Lauf 2 des Spikes (graphVersion 677): A vor B vor C. C fällt auf der Stufe Invarianten, B auf der Stufe Zweck
der Kette (Kreislauf 10 auf 12).

## Grenzen

- Kein unabhängiger Nachweis: die Anforderung ist in Kenntnis von Lauf 1 angelegt, ihre Verletzung am Text
  beurteilt.
- Keine Regel rechnet die Stufe Invarianten. Eine solche Regel wäre eine Änderung in contracts
  (Familien-Review).
- RC: kein Code geändert, die Kongruenz ist von diesem CR nicht berührt.
