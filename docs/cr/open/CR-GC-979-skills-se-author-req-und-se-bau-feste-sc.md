# CR-GC-979: Skills se:author-req und se-bau: feste Schreibweise fuer Definition und Verweis eines Parameters; eine fehlende Angabe ist Designfreiheit, keine Annahme (Autor 2026-11-21)

**Typ:** aus Item ITEM-2026-1529 (idea)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1529.json (Lane: code)

---

## Befund

CR-GC-974 legt fest, dass die Zahl eines Parameters in genau einer Anforderung steht. Die Skills nennen
keine Schreibweise, an der eine Definition von einem Verweis zu unterscheiden ist. Ohne sie kann keine
Regel prüfen, dass ein Parameter nur einmal definiert ist (CR-SM-445, sigloch-modules).

`se-bau` nennt die Wahl des Umsetzers „keine Annahme". Das Wort des Autors dafür fehlt.

## Festlegung des Autors (2026-11-21)

1. Schreibweise ist die Klammer aus CR-SM-419, Punkt 10: `[limit ≤ 100]` definiert, `[limit]` verweist.
2. „Wenn nicht spezifiziert, ist das keine Annahme, sondern Designfreiheit."
3. Die Wahl des Umsetzers bleibt in der Anforderung: Der Koordinator schreibt sie zurück (unverändert
   aus CR-GC-974). Die Frage war als Entweder-oder gestellt, die Antwort war „ja"; gelesen ist sie als
   Ja zum ersten Teil.

## Befund am Codec

`format-e-codec.ts` in `@sigloch/graph-api-core` liest eine eckige Klammer am Ende einer Knotenzeile als
Attributblock (`INLINE_ATTRS_RE = /\[([^\]]+)\]$/`, Zeile 29 und 315). Eine Beschreibung, die mit
`[limit ≤ 100]` endet, verliert die Klammer ohne Meldung. Geprüft am 2026-11-21 mit `SE_FORMAT_E_CODEC.parse`:
aus „… höchstens [limit ≤ 100]" wird „… höchstens", `errors` ist leer. Steht nach der Klammer noch Text, bleibt sie erhalten.

Der Skill schreibt deshalb vor: Kein Text endet mit einer Klammer. Das behebt die Ursache nicht; die
Korrektur am Codec steht in CR-SM-445.

## Umsetzung

| Datei | Änderung |
|---|---|
| `.claude/commands/se/author-req.md` (Version 8) | Schreibweise der Klammer, Beispiele in der Klammer, Satz zur Designfreiheit, Satz zum Zeilenende |
| `.claude/commands/se-bau.md` (Version 5) | „Designfreiheit, keine Annahme"; Schreibweise im Abschnitt Werteklassen |
| `tests/skill-wortlaut-angleich.test.ts` | fünf Tests zu CR-GC-979, vor der Änderung rot |
| `tests/skill-bau.test.ts` | Version 5 |


---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| Wie schreibe ich einen Parameter in der Anforderung? | Die Klammer mit Name und Wert definiert ihn, `[limit ≤ 100]`; die Klammer mit dem Namen allein verweist, `[limit]`. Ein Name hat genau eine Definition. Kein Text endet mit einer Klammer. | Autor, 2026-11-21. Schreibweise aus CR-SM-419, Punkt 10. Das Zeilenende: Befund am Codec, bis CR-SM-445. |
| Ist eine fehlende Klasse oder ein fehlender Ort der Prüfung eine Annahme? | Nein, Designfreiheit. Der Umsetzer wählt, nie die Invariante, und der Koordinator schreibt die Wahl in die Anforderung. | Autor, 2026-11-21. |

---

## Umfang laut `graph_impact`

Kein Schnitt aus dem Modell: Der CR ändert zwei Skill-Texte und zwei Testdateien, keinen Knoten.
Die Kanten des CR-Knotens auf die FUNCs der zwei Skills sind nicht gesetzt: Die Sitzung lief in bok, ohne
Zugang zum Modell von graphcode.
