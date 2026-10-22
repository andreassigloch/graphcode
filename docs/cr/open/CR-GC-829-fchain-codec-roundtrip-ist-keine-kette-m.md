# CR-GC-829: Format-E-Rundlauf als funktionale Anforderung an den Codec; FCHAIN-codec-roundtrip entfällt

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1008 (finding)
**Erstellt:** 2026-10-22
**Item:** bok/items/ITEM-2026-1008.json (Lane: graph)

---

## Befund

FCHAIN-codec-roundtrip („serialize → parse → Vergleich") hatte nur noch ein Glied, FUNC-decode: die
Schreibhälfte ist seit CR-GC-631 ein direkter Aufruf von `FormatECodec.serialize` aus @sigloch/graph-api-core,
den Vergleich macht nur `tests/codec.roundtrip.test.ts`. Ein- und Ausgang von FUNC-decode liegen außerhalb der
Kette — im Fokus ein einzelner Kasten ohne Linie und Akteur. Drei REQs (Vor-, Nachbedingung, Konformanz)
hingen nur an dieser Kette und sagten dasselbe: decode(encode(g)) == g.

## Änderung (Modell, Entscheidung Auftraggeber: funktionale Anforderung an den En-/Decoder)

- REQ-pre-codec-roundtrip und REQ-post-codec-roundtrip in REQ-roundtrip-conformance gemergt; dieser heißt
  „Format-E-Rundlauf", `kinds: functional`, Text nach dem, was TEST-roundtrip prüft.
- `FUNC-decode -satisfy-> REQ-roundtrip-conformance`.
- FCHAIN-codec-roundtrip gelöscht (graph_impact: nur UC-code-quality hing daran).

## Messung

v811 → v812: keine neuen Befunde; Stufe Datenfluss 3 → 2 Befunde (die Kette ohne Anschluss fällt weg).
Steuerwert unverändert 5,7518.
