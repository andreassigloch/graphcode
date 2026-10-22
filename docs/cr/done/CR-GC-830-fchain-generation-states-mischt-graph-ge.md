# CR-GC-830: FCHAIN-generation-states — ein Werkzeug, ein Auslöser

**Status:** ✅ Done (2026-10-22)
**Typ:** aus Item ITEM-2026-1009 (finding)
**Erstellt:** 2026-10-22
**Item:** bok/items/ITEM-2026-1009.json (Lane: graph)

---

## Befund

Im Fokus zeigte die Kette zwei auslösende Akteure (Regelhalter, Learning-Engine), den eigentlichen Auslöser nicht:

- graph_suggest war Glied — ein eigenes Werkzeug mit eigenen Ketten (advisory-roundtrip, steering-loop); die
  Learning-Engine gehört zu ihm.
- FLOW-generation-step-suggest („graph_suggest ruft generationStep", CR-GC-768) gibt es nicht: beide Aufrufe in
  `src/loop/suggest.ts:373/387` liegen im Handler von **graph_generate**. „handoff" ist eine Anweisung an den
  Agenten, graph_suggest als Nächstes zu rufen.
- Die Ablaufsteuerung, die graph_generate ruft und die Anweisung bekommt, war kein Glied.

## Änderung (Modell)

- FLOW-generation-step-suggest gelöscht.
- `FCHAIN-generation-states -compose->` FUNC-graph-suggest entfernt, FUNC-agent-loop neu.
- Beschreibung der Kette nach dem Code.

## Messung

v813 → v814, zwei neue Warnungen:
- R-21 an FUNC-graph-suggest → FUNC-bind-tools: die Werkzeug-Registrierung beim Hoststart (`bindSuggestTools`)
  liegt in keiner gemeinsamen Kette. Die Lücke bestand schon; graph_suggest war in 3 Ketten und damit als
  Infrastruktur von R-21 ausgenommen (`rules.ts`, isInfrastructure), jetzt in 2. Offen gelassen.
- BW-02 an FUNC-block-optimierung (8 Verträge an der Grenze).
