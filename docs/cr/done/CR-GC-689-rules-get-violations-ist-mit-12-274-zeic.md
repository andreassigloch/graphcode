# CR-GC-689: rules_get_violations ist mit 12.274 Zeichen je Aufruf der groesste Einzelposten des Prosa-Laufs opus5-17 (opus5-16 bei gleicher Eingabe: 2.042) — der Arbeitsmengen-Schnitt aus CR-GC-613 beisst nicht, wenn die Sitzung ueberall geschrieben hat, und genau das tut ein Spezifikationslauf

**Status:** ✅ Done (2026-09-26)
**Typ:** aus Item ITEM-2026-507 (finding)
**Erstellt:** 2026-09-26
**Item:** bok/items/ITEM-2026-507.json (Lane: code)

---

## Befund

Gemessen im Prosa-Lauf `opus5-17` (runde18, `rig/greenfield-systemtest/runs/opus5-17/claude-stream.jsonl`),
beide Aufrufe `rules_get_violations {severity:'warning', detail:'grouped'}`:

| Aufruf | Antwort | davon `umfang` | `umfang.uids` | `ausserhalb` | `violations` |
|---|---:|---:|---:|---:|---:|
| opus5-17 #1 | 12.509 | **8.418** | 299 | 0 | 3.876 |
| opus5-17 #2 | 12.039 | **9.557** | 339 | 0 | 2.273 |
| opus5-16 (vor CR-GC-613, kein `umfang`) | 1.846 | – | – | – | 1.642 |

**Root Cause:** der Umfang-Ausweis aus CR-GC-613 (`Umfang.uids`, `src/kernel/measure/working-set.ts:97`,
gesetzt in `schneide()` :124) wiederholt die GANZE Arbeitsmenge als uid-Liste. Ein Spezifikationslauf
schreibt ueberall — die Arbeitsmenge ist das Modell, der Schnitt nimmt nichts weg (`ausserhalb: 0`) —
und der Ausweis ueber diesen Nicht-Schnitt wird mit 67–79 % zum groessten Teil der Antwort. Die Liste
sagt dem Agenten nichts Neues: es sind seine eigenen Schreibzuege. Derselbe Ausweis steht in
`graph_test_report` und `graph_readiness` (`src/projections/testreport.ts:178`, `report.ts:366`).

Der Schnitt selbst ist korrekt: dass er bei einem Lauf, der alles geschrieben hat, alles liefert, ist
die Zusage aus CR-GC-613, kein Fehler. Die Differenz der `violations` (3.876 statt 1.642) ist ein
anderer Modellstand (400 statt 287 Knoten), keine Antwortform.

## Zielbild

`umfang` ist ein Ausweis konstanter Groesse: `{ art, elemente, ausserhalb }` — die Scheibe als ZAHL wie
der Rest. Kein neues Argument, kein Kuerzen der Befunde.

## Umfang

- `src/kernel/measure/working-set.ts` — `Umfang.uids` → `Umfang.elemente` (Anzahl)
- `src/projections/report.ts`, `src/projections/testreport.ts` — Werkzeugtext "names" → "sizes"
- `tests/working-set.spezlauf.test.ts` (neu) — Spezifikationslauf nachgefahren: EIN Zug fasst alle
  255 Knoten des sigllm-Golden v98 an, echter Kuzu-Store
- `tests/working-set.test.ts`, `tests/read-tools.scope.test.ts` — Erwartung auf `elemente`
- `scripts/model-test-set.mjs` — neue Testdatei begruendet aus der Modell-Spur ausgeschlossen (Rig-Golden, nicht die SSOT)

Kein weiterer Leser von `umfang.uids` in `src/`, `skills/`, `.claude/` (grep); der Typ ist lokal, nicht
in `@sigloch/contracts`.

## Akzeptanz

- [x] Rot zuerst: `tests/working-set.spezlauf.test.ts` scheiterte vor dem Fix mit
      `umfang: 8.505 Zeichen` (Grenze 100) bzw. `elemente` undefined.
- [x] `umfang` < 100 Zeichen bei jeder Arbeitsmengengroesse, in allen drei Werkzeugen.
- [x] `umfang.elemente` = Zahl der angefassten uids; `ausserhalb` unveraendert.
- [x] `npm run build` gruen; selektierte Tests gruen; volle Suite (bis auf `tests/rig-measured.test.ts`).

## Ergebnis

Nachgefahren am sigllm-Golden v98 (255 Knoten, ein Zug ueber alle), `rules_get_violations
{severity:'warning', detail:'grouped'}`:

| | Antwort | davon `umfang` |
|---|---:|---:|
| vorher | 14.044 | 8.505 |
| nachher | **5.591** | **52** |

Hochgerechnet auf opus5-17: 12.509 → ~4.100 und 12.039 → ~2.530 Zeichen je Aufruf (Antwort minus
Liste plus 52). Befunde, `total`, `ausserhalb` unveraendert.

Volle Suite: 179/180 Dateien gruen; rot nur das vorbestehende `tests/rig-measured.test.ts`.
