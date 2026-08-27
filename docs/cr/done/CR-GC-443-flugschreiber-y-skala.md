# CR-GC-443 — Flugschreiber: y-Skala folgt den Daten, Referenzlinie sichtbar gekappt

**Status:** DONE 2026-08-27 — umgesetzt als gve-Änderung (graph-view-edit,
`fix: flugschreiber y-skala folgt den daten (CR-GC-443)`); graphcode-seitig 0 Dateien
(die Karte lebt komplett in gves `vite.config.js` + `src/dashboard/`, wie bei beiden Vorgängern)
**Angelegt:** 2026-08-27
**Vorgänger:** CR-GC-410 (Karte „Wirkt die Arbeit?" — Herkunft der Skalierung) ·
CR-GC-441 (Severity-Nebenlinien; hat die Skala bewusst nicht angefasst) — beide bleiben geschlossen
**Herkunft:** Auftraggeber-Befund beim Abschluss von CR-GC-441: die Kurven liegen im unteren
Drittel, der Verlauf ist nicht ablesbar.

## Problem

Die y-Achse skalierte auf die **Referenzlinie** („wenn jedes neue Element seine Verstöße
mitbrächte"), nicht auf die Daten:

```js
const maxY = Math.max(1, refYatMax, ...states.map((s) => s.open));
```

Am graphcode-Repo (79 Stände, 692 Elemente, Verstoß-Dichte des ersten Standes 1.12) ergibt das
ein Achsen-Maximum von **777**, während die Daten zwischen **29 und 515** offenen Verstößen
liegen. Der Hauptpfad und die drei Severity-Nebenlinien aus CR-GC-441 nutzten damit 62 % der
Plot-Höhe, das obere Drittel blieb leer — und die Nebenlinien klebten aufeinander.

## Änderung

Drei Dateien in graph-view-edit (+2 Testdateien), kein zweiter Messpfad:

1. **`vite.config.js` / `frAxisTop(dataMax)`** (neu, exportiert) — kleinste runde **ganze** Zahl
   über dem Daten-Maximum mit ~5 % Luft. Ganzzahlig, weil die Achse genau diese Zahl anschreibt;
   unter 10 gilt `dataMax + 1`, darüber die Leiter 1/1.2/1.5/2/2.5/3/3.5/4/5/6/8/10 · 10ᵏ
   (verschenkt nie mehr als ~25 % Höhe). Keine Log-Skala.
2. **`vite.config.js` / `flightRecorderPayload`** — neu `scale: { maxElements, dataMax, yMax }`
   und `reference: { slope, atMaxElements, capped }`. Das Daten-Maximum ist `max(open)`: weil
   `errors + warnings + infos === open` (CR-GC-441), ist `open` die obere Schranke **aller**
   gezeichneten Serien. Die Skala gehört in diese Präsentations-Aggregation (wie `slope` und
   `errorFree`), nicht in die Zeichenschicht — dort bleibt reine Pixel-Geometrie, es gibt keine
   zweite Skalenrechnung.
3. **`src/dashboard/Dashboard.jsx`** — zeichnet gegen `scale.yMax`. Die Referenzlinie endet
   **auf** der Oberkante (`data-capped`), und der **Kappungs-Marker** (Pfeilspitze am
   Austrittspunkt + Beschriftung im freien Band über dem Plot) nennt ihren Zielwert:
   *„Referenz läuft hier raus ↑ 776 bei 692"*. Kein stummes Clipping, keine zweite Achse. Die
   Legende schreibt die Skala an („y-Achse 0 bis 600: skaliert auf das Daten-Maximum (515 offene
   Verstöße), nicht auf die Referenzlinie"). Achsen-Linien und Achsen-Maximum haben jetzt
   `data-testid` — der Test liest den Plot-Rahmen aus dem Render, statt Layout-Konstanten zu
   kopieren.

Die Aussage der Karte bleibt: nach rechts = gebaut, nach unten = gebunden, gestrichelte Linie =
Vergleichsgerade.

## Ergebnis

- Vertikale Ausnutzung am graphcode-Repo (Daten-Maximum gegen Achsen-Maximum): **66 % → 86 %**
  (Achse 777 → 600 bei 515 offenen Verstößen im Maximum). Der Peak des Hauptpfads lag bei 34 %
  der Plot-Höhe unter der Oberkante, jetzt bei 14 %; die drei
  Severity-Nebenlinien sind auseinandergezogen und einzeln lesbar.
- Die Referenzlinie bleibt über **77 % der x-Breite** sichtbar (sie verlässt die Skala erst bei
  535 von 692 Elementen) — sie verliert ihren Sinn bei diesen Größenordnungen **nicht** und
  bleibt drin. Entscheidungspunkt für den Auftraggeber: wenn eine spätere Historie die Linie so
  früh aus dem Bild schiebt, dass nur noch ein Stummel am Ursprung steht, ist „Referenzlinie
  ganz raus" die bessere Antwort als ein Marker bei x ≈ 0.
- Tests: 791/791 grün (`npm test -- --no-ingest`), davon **9 neue** — red-first, die
  Skalen-Assertion ist erst am alten Verhalten gescheitert (Peak bei 0.67 der Plot-Höhe statt
  < 0.25). `npm run build` grün. Pixel-Verifikation vorher/nachher gegen
  `GVE_REPO_ROOT=…/graphcode` auf einem freien Port.
- Offen, nicht in diesem CR: die **x**-Achse startet bei 0, die Daten beginnen aber bei 369
  Elementen — die linke Hälfte des Plots ist leer. Eigener Zug, weil er den Ursprungsbezug der
  Referenzlinie berührt.
