# CR-GC-681: Neue Artikelserie über Konzept, Aufbau und Stand — aus Leitlinie und stand.md

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-594 (idea)
**Erstellt:** 2026-09-26
**Item:** bok/items/ITEM-2026-594.json (Lane: code)

---

## Befund

Die Artikelserie (`docs/articles/`, öffentlich im README verlinkt) behauptet als erreicht, was
die Leitlinie offen oder als No-Go führt: lokal ≈ Frontier (T-E3), ℝ⁶ als brauchbares Ranking
(T-O4), Kontext-/Token-Ersparnis (T-E5: geführt ≈ 3,5× teurer). `06-claims` ist archiviert —
die Leitlinie ersetzt es.

## Zielbild

Die Serie berichtet über **Konzept, Aufbau und Stand** des Projekts — ehrlich, belegt, in
derselben Struktur wie die Leitlinie (Verstehen, Managen, Effizienz, Optimieren, Code-Beweis).
Jede Zahl kommt aus `docs/messung/stand.md` (CR-GC-679), keine aus dem Gedächtnis.

## Umfang

- Neuschnitt der Serie (Vorschlag): Intro · Konzept (Kern-Claim, vier Fragen, Blackbox) ·
  Aufbau (Gate, Graph, Werkzeuge, Rigs) · Stand (was bestanden ist, was nicht, warum) ·
  Glossar. Bestehende Artikel: 01, 04, 05, 07, 09 entschärfen oder aufgehen lassen; 02 archivieren.
- `tests/claims.conformance.test.ts` auf die neue Serie umstellen: prüft die Ontologie-Zahlen
  **und** dass keine Status-Aussage einem Urteil in `stand.md` widerspricht.
- README-Abschnitt „Model & docs" auf die neue Serie.

## Abnahme

- Keine Aussage der Serie widerspricht einem Test-Urteil in `stand.md`.
- `claims.conformance` grün und prüft die neue Serie (rot gesehen bei einer eingebauten Falschaussage).
- Abhängigkeit: nach CR-GC-679 und CR-GC-680. Größe: je Artikel-Paket ≤ 10 Dateien, sonst teilen.
