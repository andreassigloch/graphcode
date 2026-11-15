# CR-GC-948: Messdokumente trennen: kennzahlen.md beschreibt zwoelf Groessen, stand.md traegt Wert und Verlauf je Release

**Typ:** aus Item ITEM-2026-1376 (idea)
**Erstellt:** 2026-11-15
**Item:** bok/items/ITEM-2026-1376.json (Lane: code)

---

**Status:** Freigegeben 2026-11-15; nicht umgesetzt. Baut auf CR-GC-946 und CR-GC-947.

## Anlass

Derselbe Messwert steht an drei Orten mit drei Zahlen:

| Test | Leitlinie §9.3 | `stand.md` (2026-10-09) | Host am 2026-11-15 |
|---|---|---|---|
| T-V3 | SRR ja, PDR nein | fehlt | SRR, PDR, CDR |
| T-V4 Bindung | 114/115 | 108/109 | nicht neu gemessen |
| T-E8 | 4041 ms | 2708 ms | nicht neu gemessen |
| T-O1 | 24 von 25 | 49 von 79 (Korpus) | 33 von 33 |

`docs/messung/stand.md` erzeugt kein Ablauf; 4 von 12 Zeilen sind „nicht erhoben" mit Verweis auf einen CR,
den es nie gab (CR-GC-679B). `docs/messung/kennzahlen.md` führt vier Größen, die der Code nur noch in
Kommentaren kennt: `completeness`, `phase_readiness`, `dimension_readiness`, `compliance`.

## Zielbild

Zwei Dateien, getrennte Rollen (Autor, 2026-11-15). Keine Zahl steht in beiden.

**`kennzahlen.md`, von Hand:** je Größe die Frage des Nutzers, Definition, Rechenstelle, wer handelt, Quelle
des Verlaufs. Dreizehn Größen: zwölf aus dem Vorschlag, dazu die Ablehnungsquote aus CR-GC-943:

| Nr. | Größe | Frage des Nutzers | Verlauf aus |
|---|---|---|---|
| 1 | Marken SRR bis Bau | Wie reif ist mein Modell? | Git-Historie (CR-GC-946) |
| 2 | Befunde je Stufe, Plan getrennt | Kommt die Arbeit voran? | Git-Historie |
| 3 | Steuerwert, Überschreitungen je Steuerregel | Wo ist der Schnitt am schlechtesten? | Git-Historie |
| 4 | Testergebnis je Anforderung | Ist belegt, was gefordert ist? | Git-Historie |
| 5 | Ketten bewertbar | Sind die Kettenanalysen möglich? | Git-Historie |
| 6 | Schlupf, bereinigt | Spart der Graph Testzeit? | Zeile je CR (CR-GC-947) |
| 7 | Bindung der Blackbox- und Schnittstellen-Tests | Trägt die Zusage hinter der Auswahl? | Zeile je CR |
| 8 | Grenzmenge | Passt das Modell zum Code? | Zeile je CR |
| 9 | Abgleich Modell und Code | Passt das Modell zum Code? | Zeile je CR |
| 10 | Dauer Auswahl gegen Volllauf | Spart der Graph Testzeit? | Zeile je CR |
| 11 | Werkzeuglatenz | Ist das Werkzeug schnell genug? | `stand.md`, je Release |
| 12 | Ablehnungsquote je Regel und je Skill, Feuerbild je Regel | Helfen Regeln und Skills? | `audit_stats` mit `since` (CR-GC-943) |
| 13 | `graph_impact` bei CRs mit Löschung | Führt der Graph den Agenten? | `.graphcode/cr-messung.jsonl` |

**`stand.md`, generiert von `npm run messung`:** je Größe Wert, Vorwert, seit wann unverändert, Stempel; dazu
die Tabelle „ein Stand je Woche" aus dem Verlauf.

**Entfällt:** KPI 1 als Verhältnis (keine Schwelle, kein Handelnder; Nr. 13 liest dieselben Daten mit dem
Kriterium aus T-C3); „Verstöße je Element" und die Summe „offen"; die Zeilen T-O4 und T-O6 in `stand.md`
(einmalige Versuche, ihr Ergebnis steht in ihren CRs); die vier toten Größen in `kennzahlen.md`;
`.graphcode/cr-messung.log`; jeder Verweis auf CR-GC-679B.

**Takt:** `stand.md` entsteht je Release (Autor, 2026-11-15).

## Vorgehen

1. `kennzahlen.md` auf die dreizehn Größen umschreiben; Schwellen und die Lesarten bleiben.
2. `scripts/messung.mjs`: Zeilen je Größe, Vorwert aus der committeten `stand.md`, Wochentabelle aus dem
   Verlauf, T-M3 nach dem neuen Kriterium. Jede Zeile ist erhoben oder gestrichen; „nicht erhoben" gibt es nicht.
3. Takt: prüfen, wie `aise release prepare` die Version setzt. Läuft dabei ein npm-Skript von graphcode,
   hängt `npm run messung` dort. Braucht es eine Änderung an aise, geht ein Item an bok.
4. `scripts/cr-messung.mjs`: die Größe Nr. 13 je CR festhalten, `cr-messung.log` streichen.
5. Leitlinie: der Diff unten geht an den Autor. Die Datei ändert nur er.

## Abnahme

- [ ] `npm run messung` schreibt `stand.md` ohne eine Zeile „nicht erhoben" und mit der Wochentabelle.
- [ ] Ein zweiter Lauf nennt je Größe den Vorwert des ersten (Test auf der reinen Funktion).
- [ ] `kennzahlen.md` nennt keine Größe, die `grep` im Quelltext nur in Kommentaren findet (Test oder Liste im CR).
- [ ] `npm run verify:full CR-GC-948` grün.

## Diff an der Leitlinie, für den Autor

`docs/graphcode_leitlinie.md`, vier Stellen:

1. **§9.3, Tabelle der Tests:** die Spalte „Stand" entfällt. Unter die Tabelle kommt der Satz:
   „Den Stand je Test nennt `docs/messung/stand.md`, erzeugt von `npm run messung`."
2. **§9.3, Zeile T-M3:** Frage „Kommt die Arbeit am Modell voran?"; Messaufbau „Verlauf aus
   `graph_readiness`"; Kriterium „Fehler bleiben 0; eine erreichte Marke fällt nicht zurück; die Befunde je
   Stufe ohne Plan fallen oder sind abgenommen".
3. **§9.4, Zeile S1:** T-O4 und T-O6 aus der Liste nehmen; sie sind einmalige Versuche, keine Dauermessung.
4. **§9.5 „Bestand der Messaufbauten":** entfällt. Der Messaufbau je Test steht in §9.3, sein Stand in `stand.md`.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| Eine Datei oder zwei? | Zwei: `kennzahlen.md` von Hand (Definition), `stand.md` generiert (Wert und Verlauf) (Autor, 2026-11-15). | Eine Textänderung an der Definition soll keine Codeänderung sein. |
| Wann entsteht `stand.md`? | Je Release (Autor, 2026-11-15). | Leitlinie §9.4. Je CR änderte jede Sitzung dieselbe Datei. |
| Trägt die Leitlinie den Stand? | Nein. Spalte „Stand" und §9.5 entfallen (Autor, 2026-11-15). | Der Stand stand an drei Orten mit drei Zahlen. |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1201, Tiefe 1, Wurzeln: `FUNC-block-messwerk`._

Reichweite: 2 Elemente (FUNC 2); Blackbox-Rand 0, nicht geoeffnet.

Dateien (realRef, 0):
- (keine)

Tests (`graph_tests`, 0):
- (keine)

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
