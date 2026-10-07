# CR-GC-758: Rang ohne Gesamt-Delta, Stufen im Bericht wie die Marken, lesender Schritt

**Status:** ✅ Done (2026-10-07)
**Typ:** aus Item ITEM-2026-768 (idea)
**Erstellt:** 2026-10-07

---

## Entscheidung des Autors (2026-10-07)

„1-4 wie vorgeschlagen" — hier die Punkte 1 bis 3:

1. **Das Gesamt-Delta fällt aus der Rangfolge der Kandidaten.** Gemessen am echten Gate (CR-GC-757): eine
   Reparatur (Anforderung mit Test an einem Anwendungsfall) steht in der Fokus-Stufe bei ±0 und insgesamt bei drei
   Befunden mehr, weil jedes neue Element erst eigene Befunde mitbringt; ein Zug, der nichts tut, steht bei ±0/±0
   und lag damit vorn.
2. **`graph_readiness.stages` zählt dieselben Befunde wie die Marken** (`report.violations`). Gemessen am
   Viewer-Modell: Stufe Anforderung 140 (Steuerkatalog) gegen 1 (Marken), Abgleich 0 gegen 80.
3. **`graph_generate {peek:true}`** — der nächste Schritt der Sitzung, gelesen ohne sie zu ändern. Das Dashboard
   fragte bisher im Treiber-Modus und konnte einen anderen Schritt nennen als der Chat.

4. **Die Compliance-Prozentzahl entfällt** (Katalog: CR-SM-402). Wörtlich: „ist nur ein aggregierte trend aussage,
   aber da wir dem kunden nichts zeigen sollten, was der agent nicht auch sieht und nutzt wäre ich für weglassen".
   Gemessen: 25 von 38 Modellen trugen genau 100 %, und an allen 25 ist mindestens eine Marke offen.

## Was gestrichen wird

- `ReadinessReport.compliance` samt `totalElements`/`elementsWithErrors`, ihre Hilfe-Einträge, der Graph-Parameter
  von `readinessOf`; in den Skills `se-status`, `se-review`, `se-retro`, `se-view:fmea` der Bezug auf
  `compliance.score` (Retro misst stattdessen die Zahl der Befunde, Start gegen Ende).

- `totalDelta` (Funktion, Rangstufe, Spurspalte `total=`, Zeile in `VERDICT_ORDER`).
- Die zweite Zählung je Stufe im Bericht (aus dem Steering-Snapshot).

## Umfang

| Datei | Änderung |
|---|---|
| `src/loop/executor-rank.ts`, `src/loop/executor-bestofn.ts`, `src/loop/decisions.ts` | Gesamt-Delta entfernt |
| `src/projections/report.ts`, `src/kernel/evaluation.ts` | `stages` aus `countByStage(report.violations)`; Herkunftsblock |
| `src/loop/suggest.ts` | Eingang `peek` |
| `tests/executor.bestofn.test.ts`, `schema-parse-at-interface.test.ts`, `evaluation.rule-catalog.test.ts`, `mcp.readiness.test.ts` + Test für `peek` | Nachzug und neue Prüfungen |

## Bleibt

Die Schrittwahl (`graph_generate.readiness`, Fokus) zählt weiter im Steuerkatalog — dort stehen die Regeln zur
Textqualität der Anforderungen, die das Gate nicht lädt.

## Abnahme

`verify:full CR-GC-758`; im Link-Modus bleibt `distribution` bis zum Publish rot.
