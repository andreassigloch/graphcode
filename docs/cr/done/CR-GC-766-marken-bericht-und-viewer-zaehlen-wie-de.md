# CR-GC-766: Marken, Bericht und Viewer zaehlen wie der Schritt (eine Regelmenge)

**Status:** ✅ Done (2026-10-08)
**Typ:** aus Item ITEM-2026-790 (finding)
**Erstellt:** 2026-10-08
**Item:** bok/items/ITEM-2026-790.json (Lane: code)

---

## Entscheidung des Autors (2026-10-08)

„Agent führt, Viewer folgt (A)" — eine Zahl je Stufe für Schritt, Marken, Bericht und Viewer.

## Befund

Der Schritt (`graph_generate`) zählte seine Stufen über alle Regeln des Katalogs, Marken, Bericht und Viewer über
den Gate-Katalog. Gemessen an zwei Modellen besteht der Unterschied vollständig aus zwei der fünf Textregeln zur
Anforderungsqualität (BQ-02, BQ-06): 140 Befunde am Viewer-Modell, 267 am graphcode-Modell.

Diese Regeln gehören dem Arbeitsschritt „Anforderungsqualität". Im normalen Schritt sieht der Agent ihre Befunde
nicht (`focusViolations`); gezählt wurden sie trotzdem — in der Stufenzahl des Schritts und im Fokus-Delta der
Kandidatenwahl. Eine neue Anforderung ohne messbares Kriterium galt dort als Verschlechterung der Stufe.

Auf die Marken wirkten sie nie: eine Warnung der Stufe 3 hält keine Marke.

## Änderung

Der Schritt zählt dieselbe Regelmenge wie die Anzeige: Gate-Katalog und ND (`zaehlt` in `focus-set.ts`, dieselbe
Bedingung, die die Fokusmenge schon trug). Kein neues Attribut, keine Liste.

- `src/kernel/measure/focus-set.ts` — `zaehlt(ruleId)`, von der Fokusmenge mitbenutzt.
- `src/kernel/measure/steering-snapshot.ts` — `stages` aus den gezählten Regeln.
- `tests/mcp.readiness.test.ts` — Schritt und Bericht nennen je Stufe dieselbe Zahl.

## Bewusst offen

Der Bericht zählt zusätzlich den Code-Abgleich (RC, Stufen Plan und Abgleich), wenn der Quellbaum lesbar ist. Der
Schritt kann ihn nicht je Batch fahren. Der Unterschied ist im Test benannt.

## Umfang laut Modell

`CR-GC-766 → FUNC-take-steering-snapshot`.
