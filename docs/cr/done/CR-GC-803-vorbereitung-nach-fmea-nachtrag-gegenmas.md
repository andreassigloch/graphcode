# CR-GC-803: Vorbereitung nach FMEA-Nachtrag: Gegenmassnahmen an Modul oder Kette tieferlegen, Zusagen mit mehreren Erfuellern zerlegen (Flaeche 30 Funktionen)

**Status:** ✅ Done (2026-10-12)
**Typ:** aus Item ITEM-2026-875 (finding)
**Erstellt:** 2026-10-12
**Item:** bok/items/ITEM-2026-875.json (Lane: graph)

**Freigabe:** Autor, 2026-10-12 („go"). Reine Modellarbeit. Skill `se-vorbereitung` (Version 2), Schritt 2.
Die Züge sind Vorschlag des Skills, am Code gelesen und im Trockenlauf geprüft; jeder ist umkehrbar.

---

## Befund

Der FMEA-Nachtrag (CR-GC-802) machte sieben bestehende Zusagen zu Gegenmaßnahmen. Drei hingen an einem
Modul oder einer Kette, zwei haben vier und fünf Erfüller. Die Fläche (`riskCarriers.surface`) stieg von
5 auf 30 Funktionen.

## Züge (graphVersion 740 auf 743)

| # | Klasse | Gegenmaßnahme | vorher | nachher | Bindung am Code |
|---|---|---|---|---|---|
| 1 | Tieferlegen | `REQ-single-measurement-path` | `MOD-projections`, 15 Träger | funktional, `FUNC-take-steering-snapshot` | `takeSteeringSnapshot` ist der eine Messpfad: gerufen vom Probelauf (`src/surface/write.ts:375`, `:398`), vom nächsten Schritt (`src/projections/report.ts:315`) und vom Generierungsschritt (`src/loop/generate.ts:513`) |
| 2 | Tieferlegen | `REQ-export-no-clobber` | `MOD-projections`, 15 Träger | funktional, `FUNC-graph-export-snapshot` | beide Wächter liegen in `graph_export` (`src/projections/export.ts:191`, `:224`) |
| 3 | Zerlegen | `REQ-graph-snapshot-per-commit` | `FCHAIN-snapshot-freshness`, 8 Träger | neu `REQ-export-marker-tracks-drift` an `FUNC-export-marker` als Gegenmaßnahme von `REQ-risk-auto-export-fails-silently`; die Zusage an der Kette bleibt | `setExportPending` in `src/kernel/export-marker.ts`; Nachweis `TEST-graph-time-travel` (`tests/graph-timetravel.test.ts` prüft die Marke) |

Zug 3 schließt nebenbei einen Befund: `FUNC-export-marker` erfüllte keine Anforderung (R-02).

## Ergebnis (aus `graph_metrics`)

- Fläche 30 auf 19 Funktionen; die drei Risiken haben je einen Träger.
- `FUNC-take-steering-snapshot` trägt jetzt drei Risiken, `FUNC-generation-step`, `FUNC-graph-store` und
  `FUNC-graph-export-snapshot` je zwei.

## Benannt offen

- **Zwei Zusagen mit mehreren Erfüllern,** Klasse Zerlegen, Wortlaut ist Sache des Autors:
  `REQ-held-back-traces-named` (vier Erfüller; das Risiko „Kante verschwindet still" trägt eigentlich
  `FUNC-held-back-traces`) und `REQ-store-owner-lifecycle` (fünf Erfüller; das Risiko „Besitzer endet bei
  angedockten Sitzungen" trägt eigentlich `FUNC-host-socket`).
- **`REQ-graph-snapshot-per-commit` trägt weiter `role: mitigation`,** hängt aber an keinem Risiko mehr.
  Eine Rolle lässt sich durch das Gate nicht zurücknehmen (`role: null` fällt an R-08). Als Item notiert.
- **`REQ-audit-trail`** hat zwei Erfüller (Verlauf und Statistik); zwei Aussagen in einer Anforderung.
