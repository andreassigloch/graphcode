# CR-GC-734: Vorschlag wiederholt einen Analyse-Eintrittspunkt (AF-01..05) endlos, auch nachdem der Nutzer ihn beauftragt hat und der Zug ihn nicht schliessen konnte; Eintrittspunkte sind von der Zurueckstellung ausgenommen (CR-GC-604) — Handlauf todo-local 2026-10-03

**Status:** ✅ Done (2026-10-04)
**Typ:** aus Item ITEM-2026-722 (bug)
**Erstellt:** 2026-10-04
**Item:** bok/items/ITEM-2026-722.json (Lane: code)

---

## Befund

Handlauf todo-local (2026-10-03, nachgespielt aus den 13 Mutationen der Sitzung): ab dem fertigen Kern (v3) lautete
der Vorschlag nach jedem der sieben angewandten Züge „Führe das Einsatzkonzept (ConOps) durch.“ — auch nach dem Zug,
mit dem der Nutzer ConOps beauftragt hatte, und während er Module, Trade Study und IRR bearbeiten ließ. Ursache:
AF-01..05 schließt nur der Freshness-Stempel des Analyse-Skills, und Eintrittspunkte sind von der Zurückstellung
ausgenommen (CR-GC-604). Für den Autopiloten ist das richtig — dort startet der nächste Schritt den Task. Für den
Nutzer ist ein Satz, der nach jedem Zug gleich bleibt, Rauschen: er hat den Vorschlag ab v3 nicht mehr benutzt.

## Änderung

Nur der Kanal an den Nutzer (`vorschlag`); `graph_generate` und das Sitzungsgedächtnis bleiben unverändert. Die Regel
ist modellunabhängig — sie zählt Züge, nicht Agentenverhalten:

1. Erster Vorschlag zu einem offenen Eintrittspunkt: „Führe <Analyse> durch.“ (wie bisher).
2. Ist er nach dem nächsten angewandten Zug noch offen: einmal „<Analyse> ist noch nicht abgeschlossen — was fehlt
   dafür?“ — der Nutzer fragt den Agenten nach dem Stand, statt denselben Auftrag zu wiederholen.
3. Danach gilt er für den Vorschlag dieser Sitzung als genannt: der Vorschlag nennt den nächsten Schritt ohne ihn.
   Bleiben nur genannte Eintrittspunkte offen, wiederholt er Satz 2.

| Datei | Änderung |
|---|---|
| `src/loop/next-step.ts` | Zählung je Eintrittspunkt in der Sitzung (am `FocusMemory`, WeakMap), Satz 2, Folgeschritt ohne genannte Eintrittspunkte (reiner `generationStep`, Gedächtnis unberührt) |
| `tests/mcp.mutate-next-step.test.ts` | Ablauf 1 → 2 → weiter an echtem Graphen (todo-local v9) |
| `tests/fixtures/todo-local-v9.graph.json` | Fixture: Modell des Handlaufs, Kern fertig, AF-01..05 offen |
| `scripts/model-test-set.mjs` | Testdatei mit Grund aus der Modell-Spur ausgeschlossen (liest ein Fremdmodell, nie die SSOT) |

## Umfang laut `graph_impact`

`FLOW-channel-next-step` (Kanal an den Nutzer) ← `FUNC-generation-step`. Keine weiteren Kanten berührt; der
Autopilot-Kanal (`FLOW-channel-rule-clause`, `graph_generate`) bleibt gleich.

## Akzeptanz

- Ablauf 1 → 2 → anderer Schritt am Fixture, je Aufruf eine höhere Graph-Version.
- `graph_generate` liefert am selben Gedächtnis weiter AF-01 (CR-GC-604 unverändert).
- Kein Satz enthält Werkzeugnamen, Regel-IDs oder Abnahme-Angebot (bestehende KEIN_AUFTRAG-Prüfung).

## Ergebnis

Am Fixture: „Führe das Einsatzkonzept (ConOps) durch.“ → „Das Einsatzkonzept (ConOps) ist noch nicht abgeschlossen —
was fehlt dafür?“ → „Führe das Annahmen-Review durch.“; `generationStep` am selben Gedächtnis bleibt bei AF-01.
`verify:full`: 201/202 grün; rot nur `distribution` (Link-Modus, contracts 10.14.0 unpubliziert — benannte Ausnahme
wie CR-GC-733), daher als Schlupf gezählt, nicht durch diese Änderung.
