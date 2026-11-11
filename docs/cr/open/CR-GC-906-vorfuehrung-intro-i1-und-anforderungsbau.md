# CR-GC-906: Vorfuehrung: Intro I1 und Anforderungsbaum E2 im Artefakt Systemmodell in Bildern

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1291 (idea)
**Erstellt:** 2026-11-11
**Item:** bok/items/ITEM-2026-1291.json (Lane: graph)

---

## Ziel

Zwei neue Bausteine im Artefakt `docs/project/systemmodell-in-bildern.html` nach `docs/project/vorfuehrung-bausteinkonzept.md`:

- **I1 Ziel:** Abstraktion statt 1:1-Abbild; die vier Fragen Warum · Wie · Womit · Worüber
  (Leitlinie §2). Ein Satz je Zielgruppe.
- **E2 Anforderungsbaum der Paketstation:** links der Baum Systemanforderung → Anwendungsfall →
  Anforderung, rechts je Zeile der Verweis auf Funktion und Test. Jede Anforderung mit Auslöser,
  Ergebnis, Quantifizierung und Ausführungsbedingung.

## Festlegung, die Folge-CRs binden

E2 legt die Namen der Paketstation fest (Anwendungsfälle, Anforderungen, Funktionen, Module). Sie
übernehmen die Namen aus Kapitel 3 und der Treppe in Kapitel 6. Das Modell der Paketstation
(eigener CR) verwendet genau diese Namen.

## Abnahmekriterien

1. I1 steht vor Kapitel 1, E2 steht vor jedem Netzbild.
2. E2 zeigt ≤ 10 Anforderungen, jede mit den vier Teilen.
3. Namen in E2, Kapitel 3 und Kapitel 6 stimmen überein (Liste im CR-Ergebnis).
4. Artefakt neu veröffentlicht, Darstellung hell und dunkel geprüft (Screenshot).

## Offen

Ob die Ansicht „Requirement Review" im Viewer für Demo D1 als Baum reicht, wird am fertigen E2
entschieden. Reicht sie nicht: CR im Viewer-Repo.

## Umfang

1 Datei: `docs/project/systemmodell-in-bildern.html`. Kein Modell, kein Code.

## Kette

Erster CR der Vorführung. Danach CR-GC-907 (Schalter) und das Modell der Paketstation.

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
