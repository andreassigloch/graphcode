# CR-GC-804: Zielprofil: als Anforderungen im Modell statt als Datei, und Bewertung von sechs auf zwei Dimensionen (Diskussion)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-887 (idea)
**Erstellt:** 2026-10-12
**Item:** bok/items/ITEM-2026-887.json (Lane: code)

**Art:** Diskussion vor einer Entscheidung des Autors. Noch kein Bauauftrag.

---

## Anlass

Das Architekturkonzept (`docs/graphcode_architektur_konzept.md`, Abschnitt „Verhältnis zu R⁶") plante zwei
Schritte, die nicht gebaut sind. Seine Checkliste ist am 2026-10-12 aufgelöst; diese zwei Punkte brauchen ein
Urteil, bevor jemand baut.

1. **Zielprofil als Anforderungen im Modell.** Das Profil sollte aus der Konfiguration in den Graphen wandern,
   als nicht-funktionale Anforderungen an Kette oder System, geprüft durch das Gate.
2. **Bewertung von sechs auf zwei Dimensionen.** Die vier Realisierungsdimensionen sollten durch
   Kettenkennzahlen ersetzt werden; es blieben die zwei Dimensionen der Modellgüte.

## Stand heute (am Code gelesen, 2026-10-12)

- Das Profil liegt in `.graphcode/target-profile.json`; der Skill `se:target-profile` (Version 2) erhebt es
  und nennt die Datei ausdrücklich Konfiguration, nicht Modell.
- `TargetWeightsSchema` (`src/loop/target-profile-contract.ts`) führt sechs Dimensionen: `modifiability`,
  `faultTolerance`, `flowEfficiency`, `coherence`, `viability`, `scalability`.
- `graph_suggest` ordnet nicht mehr nach diesen Gewichten allein, sondern danach, wie stark ein Zug die
  schlechteste Stelle des Modells entschärft (CR-SM-292).

## Was sich seit dem Plan geändert hat

- **Die feste Rangfolge aus Kennzahlen ist gestrichen** (CR-GC-781): an drei Fällen mit neun Entwürfen ordnete
  sie Vorschläge nicht so wie das Blindurteil. Der Gesamt-Impact ist Vorlage für das Urteil, kein Urteil.
- **Zwei der Ersatzgrößen fallen weg:** synchrone Tiefe und Fehlerpfad-Tiefe sind nie berechnet und zur
  Streichung vorgeschlagen (ITEM-2026-882). Die Skalierungsklasse ist nicht gebaut. Der Plan wollte
  `flowEfficiency`, `faultTolerance` und `scalability` genau durch diese drei ersetzen.
- **Budgets stehen schon als Anforderung an der Kette** (Regel NFR-01); die Laufzeitanalyse liest den
  Antwortweg.

## Fragen an den Autor

1. Gilt der Plan noch, das Profil ins Modell zu holen? Dafür spricht ein Weg statt zwei und die Prüfung durch
   das Gate; dagegen, dass das Profil eine Richtung des Menschen ist und keine Zusage des Systems.
2. Wenn die vier Realisierungsdimensionen entfallen sollen: wodurch werden sie ersetzt, nachdem drei der
   geplanten Ersatzgrößen wegfallen? Oder entfallen sie ersatzlos?
3. Wie würden Schwellen geeicht, bevor Betriebsdaten vorliegen? (Frage aus dem Architekturkonzept; Vorschlag
   dort: die Verteilung der Kettenkennzahlen über die Modelle der Familie.)
4. Tragen die Kettenkennzahlen Information jenseits der sechs Dimensionen? Der Spike vom 2026-09-25 konnte das
   an sieben Graphen nicht entscheiden.

## Umfang, falls gebaut wird

Nicht geschätzt. Betroffen wären mindestens `src/loop/target-profile*.ts`, `graph_suggest`, der Skill
`se:target-profile`, die Regelkataloge (Familiensache) und jedes Repo mit einer Profildatei.
