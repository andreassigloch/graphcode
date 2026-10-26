# CR-GC-857: se-vorbereitung Abschnitt 2: Constraints herunterdeklinieren mit constraintCarriers (contracts 12.8.0)

**Status:** ✅ Done (2026-10-26)
**Typ:** aus Item ITEM-2026-1080 (idea)
**Erstellt:** 2026-10-26
**Item:** bok/items/ITEM-2026-1080.json (Lane: code)

---

Abgespalten aus CR-GC-852 am 2026-10-26 (Konzept vom Auftraggeber freigegeben). Herkunft: CR-GC-804,
Abschnitt „Herunterdeklinieren" und Entscheidung 6.

## Ziel

`se-vorbereitung` §2 bekommt den zweiten Eingang: neben der Gegenmaßnahme jede nicht-funktionale
Anforderung an Modul, Kette oder System ohne Rolle, also jeden Constraint. Der Skill ordnet ihn in die vier
Klassen aus CR-GC-804 ein (Tieferlegen, Zerlegen, Funktion fehlt, Gilt quer) und liest seine Träger aus
`constraintCarriers` statt sie über Kette und Allokation selbst zu sammeln.

## Voraussetzung

`constraintCarriers` aus `@sigloch/contracts/se` 12.8.0 (CR-SM-418, ITEM-2026-1057) ist veröffentlicht und
in graphcode eingezogen. Erfüllt am 2026-10-26: 12.8.0 ist veröffentlicht und installiert.

## Nachtrag (2026-10-26): der Umfang war lückenhaft

Ein Skill kann eine contracts-Funktion nicht direkt aufrufen. Er liest nur, was ein Werkzeug liefert.
Deshalb liefert `graph_metrics` die Träger: als Option wie `scope`, nur auf Anfrage
(`constraintCarriers: true`). Immer mitgeliefert wären es am eigenen Modell 54 Zeilen und 25.574 Zeichen
je Aufruf (gemessen 2026-10-26, graphVersion 923; contracts nennt rund 33 KB).
Gerechnet wird in contracts (`constraintCarriers`, 12.8.0); das Werkzeug reicht durch.

Der Floor der contracts-Abhängigkeit steigt auf `>=12.8 <13`. Installiert war 12.8.0 schon (Rollout);
`npm ls` zeigt eine Instanz.

## Umfang (Dateien)

1. `.claude/commands/se-vorbereitung.md` §2 (Version 5): zweiter Eingang, die Constraints. Liest
   `reqId`, `carriers` und `by` und ordnet in die vier Klassen aus CR-GC-804 ein. Bericht und
   Prüfliste nennen die Constraints mit.
2. `tests/skill-vorbereitung-felder.test.ts`: bindet die Felder an `ConstraintCarriers`. Rot, wenn §2
   ein Feld nennt, das `graph_metrics` nicht liefert (Positivkontrolle: ein erfundenes `budgetMs` in
   §2 macht ihn rot).
3. `src/projections/metrics.ts`: Eingabe `constraintCarriers`, Block `constraintCarriers` im
   Antwortvertrag (`GraphMetricsAnswerSchema`).
4. `tests/metrics.test.ts`: der Block fehlt ohne Anfrage; mit Anfrage gleich dem direkten Aufruf.
5. `src/projections/tool-help.ts`: `graph_help` erklärt den Block.
6. `package.json` + `package-lock.json`: contracts `>=12.8 <13`.
7. dieser CR

Modell per `graph_mutate` (graphVersion 920): `REQ-metrics-constraint-carriers` an
`FUNC-graph-metrics` (verifiziert von `TEST-graph-metrics`), `REQ-vorbereitung-constraints` an
`FUNC-se-vorbereitung` (verifiziert von `TEST-vorbereitung-reads-metrics`). Beschreibungen von
`FUNC-se-vorbereitung`, `FUNC-graph-metrics` und `SCHEMA-metrics-answer` nachgezogen.

## Akzeptanzkriterien

- §2 ordnet einen Constraint ohne Rolle in die vier Klassen ein und liest seine Träger aus `constraintCarriers`.
- Der Text-Test ist rot, wenn §2 ein Feld nennt, das `graph_metrics` nicht liefert.
- `graph_metrics` liefert `constraintCarriers` nur mit `constraintCarriers: true`.

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 904, Tiefe 1, Wurzeln: `FUNC-se-vorbereitung`._

Reichweite: 3 Elemente (FLOW 1, FUNC 2); Blackbox-Rand 1, nicht geoeffnet.

Dateien (realRef, 1):
- .claude/commands/se-vorbereitung.md

Tests (`graph_tests`, 2):
- tests/skill-authoring-gate.test.ts
- tests/skill-vorbereitung-felder.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.

## Nachweis (2026-10-26)

- Rot zuerst: `tests/metrics.test.ts` (Block `undefined`), `tests/skill-vorbereitung-felder.test.ts`
  (Version 4, `constraintCarriers` fehlt in §2).
- `verify:code`: Spur VOLL (Auslöser `package.json`), zuerst 1 rot: `tests/mcp.agent-agnostic.test.ts` (d),
  die Werkzeugliste lag mit der neuen Beschreibung 18 Zeichen über der Ratsche 28.300. Beschreibung gekürzt.
- `verify:full CR-GC-857`: 198/198 Dateien, 1647 Tests grün, Schlupf 0.
- Smoke am eigenen Modell (`dist`, SSOT): ohne Anfrage kein Block; mit Anfrage 54 Zeilen, darunter
  `REQ-ein-schreibweg` mit `by: ["FCHAIN-apply-gate"]` und 11 Trägern.
