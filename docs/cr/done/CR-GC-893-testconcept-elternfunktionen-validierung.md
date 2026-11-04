# CR-GC-893: testconcept: Elternfunktionen, Validierung am UC, Zeile ohne Lage

**Status:** ✅ Done (2026-11-04)
**Typ:** aus Item ITEM-2026-1252 (finding)
**Erstellt:** 2026-11-04
**Item:** bok/items/ITEM-2026-1252.json (Lane: code)

---

Ansicht testconcept (src/projections/incose.ts) zählt falsch, gemessen in immo-infra am 2026-11-04. (1) Die Zeile Function teilt durch alle FUNC; 6 Elternfunktionen ohne eigene REQ stehen als ⚠. Unit-Verifikation gilt für Blattfunktionen und für FUNC mit eigener satisfy-REQ. (2) Die Zeile validation meldet 'no position in the model'. Die Lage ist der UC: ein UC gilt als validiert, wenn eine von ihm komponierte REQ vom SYS getragen und verifiziert ist (Durchspielen am ganzen System als Nutzer). (3) Die Zeile support zählt Tests nach dem Attribut testRef.level='conformance' mit festem Text 'codec round-trip'. Gezählt werden sollen nur Tests ohne Lage im Graphen (verify auf nichts), ohne festen Text.

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1004, Tiefe 1, Wurzeln: `FUNC-export-markdown`._

Reichweite: 3 Elemente (FLOW 1, FUNC 2); Blackbox-Rand 1, nicht geoeffnet.

Dateien (realRef, 1):
- src/projections/exporter.ts

Tests (`graph_tests`, 7):
- tests/auto-export.test.ts
- tests/exporter.test.ts
- tests/mcp.export.test.ts
- tests/mcp.member-name.test.ts
- tests/view-fmea.test.ts
- tests/views.auditor.test.ts
- tests/views.conformance.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.

## Änderung

Dateien: `src/projections/incose.ts`, `src/projections/helpers.ts`, `tests/exporter.test.ts`, `docs/views/testconcept.md` (neu erzeugt).

1. **Unit-Zeile:** Nenner sind Einheiten, also FUNC ohne FUNC-Kind oder mit eigener satisfy-REQ. Eine Elternfunktion ohne eigene REQ zählt nicht; die Fußnote nennt ihre Zahl. immo-infra: vorher 26 / 32 ⚠, jetzt 26 / 26 ✓ (6 Elternfunktionen).
2. **Validierung (VAL.1):** neue oberste Zeile. Ein UC gilt als durchgespielt, wenn er eine REQ komponiert, die das SYS trägt (`satisfy`) und ein TEST verifiziert. Ob die Nutzer das Ergebnis annehmen, ist eine Freigabe außerhalb des Graphen; die Fußnote sagt es. immo-infra: 12 / 12. graphcode selbst: 1 / 9 ⚠.
3. **Zeile ohne Lage** statt „(support) … codec round-trip“: zählt Tests, denen `levelsOfTest` keine Ebene gibt, nach der Lage im Graphen statt nach `testRef.level`. Der feste Text ist entfernt.
4. **Mitgefunden:** `levelsOfTest` kannte das SYS nur über `compose`. RD-01 lässt das SYS eine REQ auch per `satisfy` tragen; das zählt jetzt als Systemebene, auch in der Deckung der Systemzeile. immo-infra: `TEST-kundendaten-ablage` hatte deshalb keine Lage; Systemzeile vorher 39 / 39, jetzt 72 / 72.

## Prüfung

Rot zuerst: die vier neuen Fälle in `tests/exporter.test.ts` (CR-GC-893) schlugen vor der Änderung aus dem erwarteten Grund fehl. Der Fall CR-GC-240 prüfte den alten Text „no position in the model“ und prüft jetzt die neue Zeile.

## Offen

Der laufende MCP-Server von graphcode rendert bis zu seinem Neustart noch die alte Ansicht. Die Ansicht in immo-infra ist mit dem neuen Build erzeugt.
