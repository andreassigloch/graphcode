# CR-GC-730: Vorschlag je Dimension zu grob: ein Vorschlag soll einen Schritt benennen, daher je Regel formulieren (Probe G Zug 3: 38 min, zwei Plan-Schritte in einem Zug)

**Status:** ✅ Done (2026-10-03)
**Typ:** aus Item ITEM-2026-713 (finding)
**Erstellt:** 2026-10-03
**Item:** bok/items/ITEM-2026-713.json (Lane: code)

---

## Befund

Probe G (2026-10-03, nach CR-GC-729): Zug 3 schickte den vorbefüllten Vorschlag „Arbeite die Abläufe Todo
hinzufügen, Todo abschließen, Todos anzeigen weiter aus.“ ab. Der Satz stammte aus der Dimension `uc` und deckte
damit zwei Regeln ab (UC-01 ohne Anforderungen, UC-02 ohne Nutzer-Anbindung). Er entsprach keinem Plan-Schritt
des Agenten. Folge: Schritte 2 und 3 in einem Zug, Batches bis 136 Zeilen, 5 Ablehnungen, 38,5 min.

## Zielbild

Ein Vorschlag nennt genau einen Schritt. Da ein Fund-Fenster genau einer Regel gehört, gibt es den Satz je
Kern-Regel (`VORSCHLAG_REGEL`, 38 Regeln) statt je Dimension. `VORSCHLAG_DIMENSION` entfällt. Ein Test hält die
Liste gleich mit den Kern-Regeln der contracts (`taskOf = kern`, nicht info, ohne Eintrittspunkte AF-01..05).

## Umfang

| Datei | Änderung |
|---|---|
| `src/loop/next-step.ts` | `VORSCHLAG_REGEL` statt `VORSCHLAG_DIMENSION`; Regel aus dem `focusKey` |
| `tests/mcp.mutate-next-step.test.ts` | Vollständigkeit gegen die contracts; Satz = Regel des Fensters |

## Abnahme

- Jede fokusfähige Kern-Regel hat einen Satz ohne Werkzeug, Fix, Regel-ID oder Abnahme.
- Der Vorschlag nach einem Zug ist der Satz der Regel, die `graph_generate` im selben Zustand fokussiert.
- Probe G Zug 3 erneut: ein Plan-Schritt je Zug.
