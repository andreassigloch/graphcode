# CR-GC-908: Vorfuehrung: Kapitel D3 Bestand einlesen und Anforderungen zusammenfuehren

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1293 (idea)
**Erstellt:** 2026-11-11
**Item:** bok/items/ITEM-2026-1293.json (Lane: graph)

---

## Ziel

Ein Kapitel im Artefakt `docs/project/systemmodell-in-bildern.html` für Demo D3 aus `docs/project/vorfuehrung-bausteinkonzept.md`:
Bestand einlesen (Dokumente, Code) und verstreute Anforderungen zu einem Anforderungsbaum
zusammenführen. Zielgruppe Spezifikation.

Inhalt: der Ablauf in Schritten am Beispiel der Paketstation: zwei Quelldokumente mit doppelten und
widersprüchlichen Anforderungen → Skelett zeigen → Typen entscheiden → zusammengeführter Baum aus E2.
Dazu die Grenzen: was heute geht, was offen ist (Leitlinie T-N3: nicht gemessen).

## Abnahmekriterien

1. Das Kapitel beschreibt den Ablauf so, wie ihn der UC aus CR-GC-905 und seine Ketten festlegen.
2. Das Ergebnis des Beispiels ist der Anforderungsbaum aus E2 (CR-GC-906).
3. Offene Punkte sind als offen benannt, nicht als Fähigkeit dargestellt.

## Umfang

1 Datei: `docs/project/systemmodell-in-bildern.html`. Kein Modell, kein Code.

## Kette

Hängt an CR-GC-905 (UC und Ketten im Modell) und CR-GC-906 (Anforderungsbaum E2).

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
