# CR-GC-774: FMEA-Skill nimmt die Orte der Kettenkennzahlen als Eingang; Reichweite einer Funktion geht in die Bewertung

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-805 (idea)
**Erstellt:** 2026-10-09
**Item:** bok/items/ITEM-2026-805.json (Lane: code)

---

## Auftrag (Autor, 2026-10-09)

Die Kettenkennzahlen finden den Ort, die FMEA bewertet ihn. Zwei Dinge:

1. **Die Orte sind Eingang für den FMEA-Skill.** Wer eine Wirkkette auf Risiken durchgeht, bekommt die
   strukturell auffälligen Stellen dieser Kette vorgelegt, statt sie selbst zu suchen. Das erhöht die
   Chance, die richtigen Stellen zu treffen; es ersetzt das Urteil nicht.
2. **Die Reichweite einer Funktion geht in die Bewertung ein.** Eine Funktion, deren Ausfall viele Ketten
   und Anwendungsfälle trifft, ist bei gleicher Fehlerart schwerer zu bewerten als eine mit einem Abnehmer.

## Was es heute gibt

- `graph_metrics` liefert je Funktion, in wie vielen Ketten und Anwendungsfällen sie liegt, und je Kette
  die Kennzahlen (CR-GC-767). Mitglieder der Rückkopplungen und Modulgrenzen je Paar kommen mit CR-SM-406.
- Der Skill `se-fmea` schreibt Risiko-Anforderungen mit Schwere, Auftreten und Entdeckung durchs Gate
  (Regeln FM-01 bis FM-03). Er bekommt heute keinen Hinweis, wo er suchen soll.
- Das graphcode-Modell hat null Risiko-Anforderungen.

## Zu klären, bevor gebaut wird

1. **Welche Orte werden vorgelegt?** Vorschlag, je Kette: Glieder einer Rückkopplung; Glieder, die in
   mehreren Ketten liegen und Ein- und Ausgang haben; Verzweiger; Modulgrenzen mit mehreren Verträgen.
2. **Wie geht die Reichweite in die Bewertung ein?** Vorschlag: als Vorbelegung der Schwere, die der Autor
   bestätigt oder ändert — nicht als Rechnung, die die Schwere setzt. Offen: aus Ketten, aus
   Anwendungsfällen oder aus der Zahl der Abnehmer des Ausgangsflusses.
3. **Wo sitzt das?** Im Skill-Text allein (er ruft `graph_metrics`) oder als eigener Abschnitt in der Antwort
   eines Werkzeugs. Der Skill-Text allein braucht keinen Code.
4. **Schreibt die Bewertung zurück in die Kennzahl?** Eine Funktion mit Risiko und großer Reichweite könnte
   in `graph_metrics` oder im Vorschlag der Steuerungsschleife auftauchen. Nicht Teil des ersten Schritts.

## Abhängigkeit

Braucht CR-SM-406 (Orte je Kette als Ausgabe der Kennzahl) und dessen Veröffentlichung.

## Akzeptanz

- Bekannte Antwort am graphcode-Modell: für die Steuerungsschleife legt der Skill die sieben Funktionen
  ihrer Rückkopplung vor, darunter das Gate mit der größten Reichweite (14 Ketten).
- Die Vorbelegung der Schwere ist als solche gekennzeichnet; ohne Bestätigung des Autors wird nichts
  geschrieben.
