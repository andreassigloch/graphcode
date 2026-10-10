# CR-GC-774: FMEA-Skill nimmt die Orte der Kettenkennzahlen als Eingang; Reichweite einer Funktion ordnet die Arbeit

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-805 (idea)
**Erstellt:** 2026-10-09 · **Umgeschrieben:** 2026-10-10 (Entscheidungen des Autors, unten)
**Item:** bok/items/ITEM-2026-805.json (Lane: code)

---

## Grundlage (Autor, 2026-10-10)

- **Die Wirkkette steht für die Kundenfunktion** und ist der Aufhänger der FMEA. Die Fehlerfolge wird am
  Ergebnis der Kette formuliert (am Akteur), die Fehlerart an einer Einzelfunktion, die Ursache darunter oder
  in einem Zufluss von außen.
- **Die Kette ist das Zusammenspiel ihrer Funktionen, nicht ihre Summe.** Sie kann ihr Ergebnis verfehlen,
  ohne dass eine Einzelfunktion ausfällt — an einer Übergabe, in einem Kreislauf.
- **Die Kennzahlen finden die Orte, die für die Kette kritisch sind. Sie bewerten nicht.**

| Ort | Warum kritisch für die Kette |
|---|---|
| Eingang, Ausgang | hier beginnt und endet die Wirkung am Akteur |
| Import | eine fremde Kette liefert zu; ihre Fehler kommen hier herein |
| Übergabe | die Folge tritt in einer anderen Kette auf |
| Verzweiger, Zulauf | ein Fehler hat mehrere Folgen oder mehrere Ursachen |
| Kreislauf | ein Fehler klingt nicht ab; Ursache und Folge sind nicht mehr gerichtet |
| Geteilte Funktion | ein Fehler trifft mehrere Ketten zugleich |
| Modulgrenze | die Verantwortung wechselt; je Vertrag eine Fehlerquelle |

Nicht aus der Struktur findbar: das Innere einer Blatt-Funktion und die Betriebserfahrung.

## Entscheidungen des Autors (2026-10-10)

1. **Eine Rechnung, nicht zwei.** Das Kettenprofil rechnet `chainMetrics` (contracts, CR-SM-406); der Skill
   liest es über `graph_metrics` und rechnet nichts.
2. **Die Linearität entfällt**, ersetzt durch Verzweigung und Zulauf.
3. **Der Import zählt nur an Funktionen, die allein dieser Kette gehören.** Die Zuflüsse einer geteilten
   Funktion stehen an ihr selbst.
4. **Die Reichweite geht nicht in die Schwere.** Die Schwere bewertet die schwerste Folge einer Fehlerart,
   nicht die Zahl der Betroffenen. Die Reichweite bestimmt, welche Folgen aufzuzählen sind (eine je betroffener
   Kette) und in welcher Reihenfolge gearbeitet wird.

## Ist-Stand

- Der Skill `se-fmea` (Version 7) rechnet in Schritt 2 **selbst** ein Kettenprofil — Linearität, Importgrad,
  Übergaben, Akteursgrenze — von Hand aus `graph_get_edges`. Schritt 4 nimmt Importe und Übergaben als
  Pflichtquellen A und B.
- `graph_metrics` liefert je Funktion die Zahl der Ketten und Anwendungsfälle und je Kette die Kennzahlen als
  Zahlen (CR-GC-767). Die Orte dazu kommen mit CR-SM-406.
- Gemessen 2026-10-10 am graphcode-Modell: die beiden Profile widersprechen sich an jeder Kette mit
  Rückkopplung, und der Import in der Fassung des Skills ergibt bis zu 29 Pflichtstellen je Kette
  (Zahlen in CR-SM-406).
- Das graphcode-Modell hat null Risiko-Anforderungen.

## Umfang

**Skill-Text `.claude/commands/se-fmea.md`:**

1. **Schritt 2:** Die Rechenvorschriften für Linearität, Importgrad und Übergaben entfallen. Das Profil je
   Kette kommt aus `graph_metrics`; der Skill legt die Orte der Kette nach der Tabelle oben vor. Die
   Akteursgrenze bleibt bei der Regel FC-04.
2. **Geteilte Funktionen gehören zur Analyse der Kette.** Wer eine Kette analysiert, analysiert ihre geteilten
   Funktionen mit — sonst fehlen deren Zuflüsse, die seit Entscheidung 3 nicht mehr als Import der Kette
   erscheinen. Eine schon analysierte geteilte Funktion wird zitiert, nicht wiederholt.
3. **Schritt 4:** Quelle A (Importe) und B (Übergaben) lesen die Listen aus `graph_metrics`. Neu als Quellen:
   Kreislauf und geteilte Funktion — die Stellen, an denen die Annahme der FMEA „Einzelfehler, voneinander
   unabhängig" nicht gilt.
4. **Reichweite:** Für eine geteilte Funktion zählt der Skill je betroffener Kette eine Fehlerfolge auf; die
   Schwere ist die der schwersten. Die Arbeitsreihenfolge je Kette geht nach Reichweite der Orte, nicht mehr
   nach Importgrad.
5. Eine nicht bewertbare Kette (`measurable: false`) wird nicht analysiert; der Skill nennt den Grund.

**Code:** Hilfetext der neuen Felder in `src/projections/tool-help.ts`; Peer-Floor von `@sigloch/contracts`
auf die Version mit CR-SM-406, im selben Commit wie der erste Leser.

## Nicht im Umfang

- Eine Bewertung, die in `graph_metrics` oder in den Vorschlag der Steuerungsschleife zurückschreibt.
- Auftreten und Entdeckung: dafür trägt keine Strukturkennzahl (synchrone Tiefe und Fehlerpfad-Tiefe sind `null`).

## Abhängigkeit

Braucht CR-SM-406 und dessen Veröffentlichung.

## Akzeptanz

- Der Skill-Text enthält keine Rechenvorschrift für eine Kettenkennzahl mehr (Test über den Text).
- Bekannte Antwort am graphcode-Modell: für die Steuerungsschleife legt der Skill die Mitglieder ihres
  Kreislaufs und ihre geteilten Funktionen vor, darunter das Gate als Funktion mit der größten Reichweite.
  Die Zahlen liest er aus `graph_metrics`; sie stehen nicht in dieser CR, weil sie sich mit dem Modell ändern
  (Gate am 2026-10-10: 13 Ketten).
- Für `advisory-roundtrip` legt der Skill keinen Import vor, aber Gate, Store und Regelauswertung als geteilte
  Funktionen.
- Keine Schwere wird vorbelegt; ohne Bestätigung des Autors wird nichts geschrieben.

---

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(FUNC-se-fmea)`, `graph_impact(FUNC-chain-metrics)`: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
