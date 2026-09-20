# CR-GC-561: `graph_next_step` von der Werkzeug-Oberfläche nehmen

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-381 (idea)
**Erstellt:** 2026-09-20
**Item:** bok/items/ITEM-2026-381.json (Lane: graph)

---

## 1 Befund

Zweiter Schritt des Schnitts aus CR-GC-560. Nach dem ersten hat `graph_next_step` keinen
Konsumenten mehr — weder im Rig, noch in einem Skill, noch in einem Test, der es als
Vehikel benutzt hat. Es steht nur noch in der Registry.

Ein Werkzeug ohne Nutzer, das dieselbe Frage beantwortet wie `graph_generate` und
schlechter, ist der parallele Pfad, den die Guardrails verbieten: die drei Kaltstart-Stufen
aus CR-GC-559 und die Fund-Rotation gibt es nur im einen der beiden.

## 2 Zielbild

Genau EIN Steuerungswerkzeug auf der Oberfläche: `graph_generate`.

`WITHHELD_TOOLS` verliert den Namen mit — die Menge sagt „diese ruft der Executor
deterministisch"; ein Name darin, den es nicht mehr gibt, ist eine Behauptung ohne Gegenstück.

## 3 Umfang

- `src/projections/report.ts` — Tool + `NextStepResult`-Import raus
- `src/surface/mcp-tools.ts` — Modul-Kommentar
- `src/loop/executor-prompt.ts` — `WITHHELD_TOOLS`
- `tests/mcp.agent-agnostic.test.ts` — erwartete Werkzeugliste
- `tests/executor.test.ts` — die Withheld-Zusicherung

Fünf Dateien. `src/loop/steering.ts` bleibt in diesem Schritt liegen: danach ist es toter
Code, aber es bricht nichts — das Löschen ist CR-GC-562.

## 4 Abnahme

1. `graph_next_step` ist über MCP nicht mehr aufrufbar.
2. Die Werkzeugliste, die ein Agent sieht, kennt den Namen nicht mehr.
3. `WITHHELD_TOOLS` nennt nur noch Werkzeuge, die es gibt.
4. Suite grün.
