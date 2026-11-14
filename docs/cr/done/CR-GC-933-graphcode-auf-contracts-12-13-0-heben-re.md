# CR-GC-933: graphcode auf contracts 12.13.0 heben: Regelzahl 81→80 bzw. 68→67, Ontologie 13.0.0, architectureOnly ohne Leser (Folgen von CR-SM-440)

**Typ:** aus Item ITEM-2026-1357 (finding)
**Erstellt:** 2026-11-14
**Item:** bok/items/ITEM-2026-1357.json (Lane: code)

---

## Befund

Der Release-Zug vom 2026-11-14 hat contracts 12.13.0 veröffentlicht (CR-SM-439 und CR-SM-440). graphcode hing an
`>=12.12 <13` und lief für CR-GC-932 im Link-Modus. Gegen 12.13.0 waren vier Tests rot:

- `distribution`: das Registry-Paket 12.12.0 hat kein `ELEMENT_DEFINITIONS` (CR-GC-932 braucht es).
- `claims.conformance`: zwei Artikel nennen 68 Engine-Regeln, CR-R02 entfällt, es sind 67.
- `live-feed` (Rundreise): `architectureOnly` hat keinen Leser mehr; drei alte CR-Knoten tragen es.
- `systemmodell-in-bildern.katalog`: die Seite nennt 81 Regeln, Ontologie 12.0.0, Regelkatalog 50.0.0.

## Root Cause

CR-SM-440 entfernt CR-R02 und das Attribut `architectureOnly`; die Zahlen und die Rundreise in graphcode
spiegeln den alten Katalog.

## Änderung

- `package.json`: contracts `>=12.13 <13`; `package-lock.json` folgt.
- Seite: 80 Regeln, Ontologie 13.0.0, Regelkatalog 50.1.0.
- `claims.conformance`: 'engine rules=67'; Artikel 03 und 04 nennen 67.
- `live-feed.test.ts`: `architectureOnly` steht wie `concept` und `deferred` in der Menge der bewussten Verluste.
  Das Attribut am Modell zu löschen geht nicht durchs Gate (Attribute sind nur mergebar); es wirkt nicht mehr.

## Abnahme

- `npm run verify:full CR-GC-933` grün, auch `distribution` und `lockfile-sync`.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| keine | – | Der CR zieht einen Versionssprung nach. |

---

## Umfang laut `graph_impact`

Kein Modellknoten ändert sich; betroffen sind Abhängigkeit, Zahlen in Texten und zwei Tests.

## Dateien

1. `package.json`
2. `package-lock.json`
3. `docs/project/systemmodell-in-bildern.html`
4. `tests/claims.conformance.test.ts`
5. `docs/articles/03-graphcode-harness-goal-and-concept.md`
6. `docs/articles/04-the-graphcode-story.md`
7. `tests/live-feed.test.ts`

## Ergebnis

`npm run verify:full CR-GC-933` am 2026-11-14 gegen contracts 12.13.0 aus der Registry: 219 von 219 Dateien,
1788 von 1788 Tests grün, Schlupf 0. Ein erster Lauf (unter CR-GC-932) hatte einen roten Spike
(`arch.optimization-dry-run`, Hash der Graph-Datei vorher = nachher); während dieses Laufs hat `aise dispatch
prepare` den Knoten CR-GC-933 angelegt und der Host die Graph-Datei neu exportiert. Auf ruhigem Baum grün.
