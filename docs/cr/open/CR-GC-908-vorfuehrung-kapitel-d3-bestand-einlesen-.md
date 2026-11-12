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

---

## Ergebnis (2026-11-12)

Kapitel „Bestand einlesen und Anforderungen zusammenführen“ (Baustein D3, nur in den Ansichten
Spezifikation und Alle). Inhalt:
- Ausgangslage: zwei Dokumente zur Paketstation mit einer Dublette (Sperre nach drei Fehlversuchen)
  und einem Widerspruch („sofort“ gegen „3 s“).
- Fünf Schritte: Gliederung zeigen → Typen entscheiden → Auszug durch das Gate → Code einlesen →
  Zusammenführen.
- Tabelle „Was heute geht und was offen ist“.

Abnahme:
1. ✓ Der Ablauf folgt `UC-consolidate-requirements`: Dokumente und Code erschließen, zu einem Baum
   zusammenführen, jede Anforderung einmal, mit Quelle, Widersprüche als Fragen. Schritt 4 folgt
   `FCHAIN-model-import` und `FCHAIN-skill-import-code` (gesicherter Vorzustand, Stempel der
   Modellversion, `REQ-model-exchange-post`). Die Schritte 1–3 folgen dem Skill se:import-doc.
2. ✓ Das Beispiel endet im Anforderungsbaum aus E2. Die sechs Sätze der beiden Dokumente werden zu
   A1, A4, A6 und A7.
3. ✓ Als offen benannt, nicht als Fähigkeit:
   - die fehlende Einlese-Kette für Dokumente (CR-GC-910)
   - das Zusammenführen ohne eigenen Schritt im Modell
   - „mit Quelle“ als Anforderung ohne Test
   - Widersprüche ohne Prüfung auf Vollständigkeit
   - T-N3 nicht gemessen
   Die ersten drei Punkte sind die offenen Punkte 1–3 aus CR-GC-905.
