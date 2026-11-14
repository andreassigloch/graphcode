# CR-GC-932: graphcode liest die Definitionen der Elemente und Kanten aus contracts (ELEMENT_DEFINITIONS, TRACE_DEFINITIONS)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1354 (idea)
**Erstellt:** 2026-11-14
**Item:** bok/items/ITEM-2026-1354.json (Lane: graph)

---

## Befund

CR-SM-439 hat die Definitionen der 12 Elementarten und die Bedeutung der 6 Kantenarten nach contracts gelegt
(`ELEMENT_DEFINITIONS`, `TRACE_DEFINITIONS`, Ontologie 12.0.0) und `ELEMENT_DESCRIPTIONS` gelöscht.
graphcode las davon nichts:

- `graph_help` antwortete auf `REQ` oder `satisfy` aus einer eigenen englischen Tabelle (`HELP_VOCAB`).
- Die Seite „Das Systemmodell in Bildern“ trug Tabelle, Kartenbeispiele und Kantentexte als Abschrift.
  Sie wich in vier Stellen ab, etwa beim Test („unter 2 s“ statt „höchstens 2 s“).
- `tests/claims.conformance.test.ts` las das gelöschte `ELEMENT_DESCRIPTIONS`.

## Root Cause

Die Texte lebten an drei Orten ohne Kopplung; keiner las die Quelle in contracts.

## Zielbild

- `graph_help` liefert je Elementart Name, Satz, Beispiele, Gegenbeispiel und Quelle aus `ELEMENT_DEFINITIONS`
  (Art `element`), je Kantenart Name, Bedeutung und die erlaubten Paare aus `TRACE_DEFINITIONS` und
  `TRACE_PATTERNS` (Art `trace`). `HELP_VOCAB` behält nur `depends-on`.
- Die Seite übernimmt die Texte wortgleich; ein Test prüft Tabelle, Karten und Kanten gegen contracts.
- Mehrere Beispiele trennt „ · “, weil einzelne Beispiele selbst Kommas enthalten.

## Abnahme

- `graph_help({token:"FCHAIN"})` liefert `kind: element`, Titel „Wirkkette“ und die Beispiele aus contracts.
- `graph_help({token:"satisfy"})` liefert `kind: trace` mit `erlaubt` = die Paare aus `TRACE_PATTERNS`.
- Weicht ein Text der Seite ab, wird `tests/systemmodell-in-bildern.katalog.test.ts` rot (Gegenprobe: drei
  Änderungen, drei rote Fälle).
- Stand-Zeile der Seite: Ontologie 12.0.0.

## Voraussetzung

graphcode läuft im Link-Modus gegen die Arbeitskopie von contracts (CR-SM-439, unveröffentlicht). Bis zum
Release-Zug sind `distribution` und `lockfile-sync` rot; das ist im Link-Modus erwartet.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| keine | – | Der CR wendet CR-SM-439 an. |

---

## Umfang laut `graph_impact`

- `FUNC-graph-help` (Kante `relation` vom CR). `graph_tests` wählt `mcp.help`, `mcp.readiness`,
  `mcp.stdio-server`, `mutate.formate-ops` — grün.
- Dazu die direkt betroffenen Tests: `help.test`, `help-content.test`, `claims.conformance.test`,
  `systemmodell-in-bildern.katalog.test` — grün.

## Dateien

1. `src/projections/help.ts`
2. `src/projections/help-content.ts`
3. `src/projections/report.ts`
4. `tests/help.test.ts`
5. `tests/help-content.test.ts`
6. `tests/claims.conformance.test.ts`
7. `tests/systemmodell-in-bildern.katalog.test.ts`
8. `docs/project/systemmodell-in-bildern.html`
