# CR-GC-590: Tote Kanaele streichen oder verlegen, je mit Messung: steeringDelta (6-8/Lauf, nie erwaehnt), tier/confidence, fitAdvisory.regressions ohne Zielprofil (widerspricht 'nur Bericht'), GRAPHCODE-STEERING.md (0 Zugriffe in 5 Laeufen) in GRAPHCODE.md

**Status:** 🟠 Open — Body ausgearbeitet
**Typ:** aus Item ITEM-2026-440 (idea)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-440.json (Lane: graph)

---

**Reihenfolge:** nach CR-GC-587, vor CR-GC-591 (erst streichen, dann modellieren — die Lehre aus 575 → 573).

## 1 Befund (Bericht „Kanaele“, 5 Claude-Code-Laeufe)

| Kanal | geliefert je Lauf | erwaehnt |
|---|---|---|
| `steeringDelta` | 6–8 | 0 |
| `tier`, `confidence` | jede Antwort | nie |
| `fitAdvisory.regressions` | 8–15, fast immer mit Regression | 1–5 — und seit CR-GC-583 ausdruecklich „nur Bericht“: der Satz und das Feld widersprechen sich |
| `GRAPHCODE-STEERING.md` | liegt in jedem Workspace | 0 Zugriffe |

## 2 Zielbild — je Kanal mit Messung, nicht nach Geschmack

- `steeringDelta`, `confidence`: aus der Host-Antwort (bleiben im In-Process-Pfad des Executors, der sie rankt).
- `fitAdvisory`: ohne Zielprofil keine `regressions`-Liste an den Host; mit Zielprofil unveraendert (dort ist Δm die Richtung, `se:top-level`).
- `tier`: bleibt — es traegt `block` (Gate-Wahrheit, Rang 1); geprueft wird nur, ob `suggest`/`auto-apply` je gelesen wird.
- `GRAPHCODE-STEERING.md` in `GRAPHCODE.md` aufgehen lassen (Scaffold), Datei entfaellt.

## 3 Umfang

`src/surface/write.ts`, Scaffold-Templates, Tests der Antwortform, dieser CR (≤ 6).

## 4 Kriterien

1. Gemessen wird mit dem Standardbericht (`report.mjs`, Abschnitte CR-GC-585 „Steuerung“ und CR-GC-586 „Auto gegen Hand“), Claude-Code-Arm, sigllm-Prosa-Korpus, n ≥ 2. Fokus-Befolgung und Ausbeute nicht schlechter; `graph_mutate`-Antwort kleiner.
2. Kein Kanal verschwindet ohne Zeile in der Tabelle oben.
