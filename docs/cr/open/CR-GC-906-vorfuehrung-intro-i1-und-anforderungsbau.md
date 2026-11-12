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

---

## Ergebnis (2026-11-12)

Artefakt `docs/project/systemmodell-in-bildern.html`, veröffentlicht als Version 14
(https://claude.ai/artifact/UBXkGN6Pb6nddA7rgzFWrT).

- **I1 „Das Ziel: Abstraktion statt Abbild“:** die vier Fragen Warum · Wie · Womit · Worüber
  mit je einem Beispiel aus der Paketstation, dazu ein Satz je Zielgruppe.
- **E2 „Der Anforderungsbaum der Paketstation“:** Systemanforderung → 2 Anwendungsfälle →
  9 Anforderungen (A1–A9). Jede Anforderung steht im Satzmuster Wenn · dann · innerhalb · nur wenn,
  rechts „erfüllt von“ und „Test“.

Abnahme:
1. ✓ In der Ansicht „Alle“ steht I1 vor den Bausteinen. E2 steht vor der Landkarte (Kapitel
   Verbindungen) und vor dem Netz der Paketstation.
2. ✓ 9 Anforderungen plus die Systemanforderung, also 10; jede mit den vier Teilen.
3. ✓ Namen, die E2 festlegt und Kapitel 3 und 6 verwenden:
   - System Paketstation; Akteure Empfänger, Zusteller, Versand-Server
   - Anwendungsfälle Paket abholen, Paket einlegen; Wirkketten Abholung, Einlage
   - Funktionen Code lesen, Code prüfen, Fach entriegeln, Abholung melden, Fach zuteilen,
     Abholcode erzeugen
   - Module Bedienfeld (Code lesen), Steuerung (Code prüfen, Abholung melden, Fach zuteilen,
     Abholcode erzeugen), Schließmechanik (Fach entriegeln)
   - Datenflüsse Abholcode, Öffnungsbefehl, Fach offen; Datenformat Abholcode = 6 Ziffern
   Angeglichen: Die Treppe in Kapitel 6 legte „Code lesen“ in die Steuerung. Jetzt liegt sie im
   Bedienfeld, wie in Kapitel 5 (Änderbarkeit) und im Regelbeispiel der Stufe 12.
4. ✓ Veröffentlicht. Hell und dunkel geprüft (Screenshots im Lauf, nicht eingecheckt): E2 bei
   1000 px hell und dunkel, bei 390 px ohne waagrechten Bildlauf (scrollWidth 390).

Nebenbefund behoben: Ein nicht geschlossenes `<details>` in Kapitel 5 hatte Kapitel 6 seit der
ersten Fassung in die aufklappbaren Details der Methode gezogen.

**Offen (aus dem CR):** Ob „Requirement Review“ im Viewer für D1 reicht: Die Ansicht ist eine
Liste, E2 ist ein Baum. Entscheidung des Auftraggebers am fertigen E2; reicht sie nicht, folgt ein
CR im Viewer-Repo. Der Abschnitt D1 nennt die Lücke.
