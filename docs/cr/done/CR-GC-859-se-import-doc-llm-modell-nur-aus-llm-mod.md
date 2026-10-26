# CR-GC-859: se:import-doc: LLM-Modell nur aus LLM_MODEL, kein Modellname im Skill

**Status:** ✅ Done (2026-10-26)
**Typ:** aus Item ITEM-2026-1082 (finding)
**Erstellt:** 2026-10-26
**Item:** bok/items/ITEM-2026-1082.json (Lane: code)

---

Befund aus CR-GC-858: graphify 0.6 holt das LLM-Modell nur noch aus der Konfiguration (CR-GF-153). Der Skill
`se:import-doc` rief in Stufe 2 `new LMStudioClient()` ohne Modell und nannte in den Voraussetzungen
`LLM_MODEL` mit einem Modellnamen als Default.

Regel des Auftraggebers (2026-10-26): ein Modellname steht nie im Code oder Skill, auch nicht als Default. Er
kommt nur aus der Konfiguration; fehlt sie, bricht der Lauf mit klarer Meldung ab.

Konfiguration heißt in graphify 0.6: die Client-Option `model` oder die Umgebung `LLM_MODEL`. Eine
Konfigurationsdatei hat graphify nicht (CR-GF-153, Abschnitt Umsetzung).

## Ziel

- Der Skill nennt keinen Modellnamen. Stufe 2 liest `LLM_MODEL` und übergibt es als `new LMStudioClient({ model })`.
- Fehlt `LLM_MODEL`, hält der Skill vor Stufe 2 an und sagt dem Nutzer, was er setzen muss. Das Skript bricht
  selbst ab (Exit 2), bevor es den Store öffnet.
- Die Voraussetzung „Registry-Version 0.5.2 hat beides noch nicht" ist mit graphify 0.6 veraltet und fällt.
- Skill-Version 1 → 2, damit `graphcode update` die Änderung in die Member-Repos bringt.

## Andere Fundstellen (grep `qwen`, `LMStudioClient(`, `model:`)

Kein weiterer Aufruf eines LLM-Clients in graphcode. Die übrigen Treffer sind keine Modellwahl:

- Kommentare mit Messherkunft in `src/loop/generate.ts`, `tests/generate.test.ts`, `src/surface/audit.ts`;
- Testdaten für das Audit-Feld `model` (`tests/audit.*.test.ts`, `tests/hooks.prompt-relay.test.ts`,
  `tests/trajectory-stamps.test.ts`);
- `tests/cli.scaffold.test.ts`: eine Nutzer-`opencode.json`, die `init` unverändert lassen muss;
- `tests/fixtures/perf-basis.graph.json` und `docs/project/steuerungsschleife.md`: Beschreibungen.

## Umfang (Dateien)

1. `.claude/commands/se/import-doc.md`
2. `tests/skill-import-doc-modell.test.ts` (neu)
3. dieser CR

Modell: `REQ-llm-modell-aus-konfiguration` an `FUNC-import-doc` (satisfy), `TEST-import-doc-modell` (verify).

## Akzeptanzkriterien

- Der Text-Test ist rot, wenn der Skill einen Modellnamen nennt oder einen `LMStudioClient` ohne `model` baut.
- Das Skript der Stufe 2 bricht ohne `LLM_MODEL` mit der Meldung ab und öffnet keinen Store.
- Mit `LLM_MODEL` gesetzt erreicht Stufe 2 den LLM-Endpunkt (Smoke gegen Ollama).

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 915, Tiefe 1, Wurzeln: `FUNC-import-doc`._

Reichweite: 3 Elemente (FLOW 1, FUNC 2); Blackbox-Rand 2, nicht geoeffnet.

Dateien (realRef, 1):
- .claude/commands/se/import-doc.md

Tests (`graph_tests`, 0):
- (keine)

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
