# CR-GC-974: PARAM als Skill-Konvention: se:author-req, se-conops und se-bau auf einen Wortlaut (Name, Wert, Einschraenkung; fuenf Wege; Pruefort; wer entscheidet), Vorstufe zu CR-SM-419

**Typ:** aus Item ITEM-2026-1522 (idea)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1522.json (Lane: code)

---

## Befund

Drei Skills beschreiben dieselbe Einteilung fester Werte und zählen verschieden. `se-bau` nannte den
Aufrufwert „keine Klasse", `se:author-req` und `se-conops` führten ihn als vierte Klasse. Die Ursache steht
in CR-GC-759: Seine Tabelle sagt „Aufrufwert (keine Klasse)", sein Entscheid „die vier Klassen".
CR-GC-945 glich `se-conops` an vier an; die FAQ-Pflege glich am 2026-11-20 einen Eintrag an `se-bau` an.

Eine Abnahmegrenze wie „Antwort in höchstens 2 s" passte in keine Klasse: Niemand stellt sie ein, und sie
hat keinen Ort im Code.

## Festlegung des Autors (2026-11-21)

Ziel: keine hart kodierte Zahl im Code, und übergreifende Werte werden an einer Stelle verwaltet.

1. Ein Wert mit Einschränkung ist ein Parameter (PARAM): Name, Wert, Einschränkung. Beispiele des Autors:
   „limit ist die Variable, das ist der Parameter (Name); ≤ 100 ist sein Wert" und
   „Response_limit <= 2 s".
2. Ein Wert ohne Einschränkung in einer Anforderung ist kein PARAM. Das gilt für ein Feld eines Vertrags
   und für eine lokale Variable.
3. Fünf Wege, woher der Wert kommt: im Betrieb (Laufzeit-Parameter), beim Start (Start-Konfiguration), im
   Code (Invariante), je Aufruf (Aufrufwert), berechnet.
4. Die Einschränkung wird im Code, im Vertrag oder im Test geprüft, an mindestens einer Stelle.
5. Was die Anforderung nennt, ist bindend. Nennt sie keinen Weg, entscheidet der Umsetzer; der Koordinator
   schreibt die Wahl in die Anforderung. Eine Invariante legt nur die Anforderung fest oder hebt sie auf.
6. Bis zur Umsetzung von CR-SM-419 (sigloch-modules, offen: Elementtyp und Regeln) gilt das nur als Skill
   und FAQ. Kein Elementtyp, keine Regel, kein Attribut.

Aus dem Vergleich mit einem Werkzeug für Anforderungen, das den Wert einmal am Modellelement führt und im
Text nur darauf verweist, übernommen: Die Zahl steht in genau einer Anforderung; jeder andere Text nennt
den Parameter, nicht die Zahl. Diesen Satz hat der Autor nicht einzeln bestätigt.

## Umsetzung

| Datei | Änderung |
|---|---|
| `.claude/commands/se/author-req.md` (Version 7) | Absatz zu festen Werten ersetzt: PARAM, fünf Wege, wo geprüft wird, wer entscheidet |
| `.claude/commands/se-conops.md` (Version 12) | Prüfpunkt „value classes" heißt „parameters", mit berechneten Werten und dem Ort der Prüfung |
| `.claude/commands/se-bau.md` (Version 4) | Umsetzer Punkt 2: berechneter Wert, Wahl bei fehlender Klasse; Koordinator Punkt 6: Wahl in die Anforderung; Tabelle mit fünf Zeilen, Tabelle „Geprüft im" |
| `tests/skill-wortlaut-angleich.test.ts` | acht Tests zu CR-GC-974, vor der Änderung rot |
| `tests/skill-bau.test.ts` | Version 4, fünfte Zeile der Tabelle |

Offen und nicht Teil dieses CR:

- Die Auslieferung an die Repos der Familie folgt im nächsten Zug.
- Keine Regel prüft, dass ein Test die Einschränkung liest. Das trägt CR-SM-419.
- energymanager `REQ-ops-werteklassen` nennt „genau eine von drei Klassen". Das Modell dort ist nicht geändert.


---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| Was ist ein Parameter (PARAM)? | Ein Wert mit Einschränkung: Name, Wert, Einschränkung, genannt in genau einer Anforderung. Ein Wert ohne Einschränkung ist keiner. | Autor, 2026-11-21. Ziel: keine hart kodierte Zahl, eine Stelle für übergreifende Werte. |
| Ist der Aufrufwert eine Klasse? | Ja. Es gibt fünf: Laufzeit-Parameter, Start-Konfiguration, Invariante, Aufrufwert, berechneter Wert. Die Klasse sagt, woher der Wert kommt. | Autor, 2026-11-21. Hebt „Aufrufwert (keine Klasse)" aus der Tabelle von CR-GC-759 auf. |
| Welche Klasse hat eine Abnahmegrenze wie „Antwort ≤ 2 s"? | Berechneter Wert, geprüft im Test. | Autor, 2026-11-21: „Das ist genau ein PARAM." |
| Wo wird die Einschränkung geprüft? | Im Code, im Vertrag oder im Test, an mindestens einer Stelle; die Anforderung oder der Umsetzer nennt die Stelle. | Autor, 2026-11-21. |
| Wer legt die Klasse fest? | Die Anforderung, bindend. Nennt sie keine, wählt der Umsetzer, nie die Invariante; der Koordinator schreibt die Wahl in die Anforderung. | Autor, 2026-11-21, auf Vorschlag. Eine Sicherheitsgrenze darf kein Umsetzer verstellbar machen. |
| Wie gilt das vor einem Elementtyp PARAM? | Nur als Skill und FAQ; der Satz der Anforderung ist der einzige Ort. | Autor, 2026-11-21. Elementtyp und Regeln trägt CR-SM-419. |

---

## Umfang laut `graph_impact`

Kein Schnitt aus dem Modell: Der CR ändert drei Skill-Texte und zwei Testdateien, keinen Knoten.
Die Kanten des CR-Knotens auf `FUNC-author-req`, `FUNC-se-conops` und die FUNC von se-bau sind nicht
gesetzt: Die Sitzung lief in bok, ohne Zugang zum Modell von graphcode.
