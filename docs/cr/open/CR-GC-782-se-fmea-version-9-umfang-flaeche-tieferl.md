# CR-GC-782: se-fmea Version 9: Umfang, Flaeche, Tieferlegen

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-818 (idea)
**Erstellt:** 2026-10-11
**Item:** bok/items/ITEM-2026-818.json (Lane: code)

---

**Bezug:** `docs/graphcode_analyse_optimierungskonzept.md`, Abschnitt 10, Schritt Kettenanalyse (Stufe 8 der Regelmatrix). Sicht Wirkkette und Anforderung, Dimension Sicherheit und Verfügbarkeit,
Ergebnisse a bis d. **Wartet auf CR-SM-407 und CR-GC-784.**
**Entscheidungen des Autors (2026-10-11):** die Vorbereitung des Modells ist nicht Teil der FMEA (CR-GC-784). Eine Analyse ist
eine Schleife; ihr Ergebnis ist ein gewöhnlicher CR.

## Anlass

Der Skill liest seit Version 8 die Orte der Kette. Nach den Spikes fehlen ihm vier Dinge: die Vorbedingung, der
Betrachtungsumfang, die Fläche im Bericht und eine feste Form für Vorschläge.

## Umfang

`.claude/commands/se-fmea.md`, Version 9:

1. **Vorbedingung.** Der Skill liest den Stand der Kette (bewertbar, Träger je Risiko). Ist die Kette nicht
   geschlossen, endet er mit dem Verweis auf `se-vorbereitung`. Hängt eine Gegenmaßnahme an Modul oder System,
   ohne als quer geltend benannt zu sein, nennt er das und verweist ebenfalls dorthin; er legt nicht selbst
   tiefer.
2. **Betrachtungsumfang** aus `graph_metrics`: der Skill nennt die Anforderungen, die er für die Kette liest.
3. **Bewertung** unverändert (AIAG-VDA, Schwere, Auftreten, Entdeckung an den Orten).
4. **Regel:** einer geteilten Funktion wird kein weiteres Risiko aufgeladen, ohne dass der Bericht nennt, welche
   Risiken sie schon trägt und wie viele Ketten durch sie laufen (`riskCarriers`, `functionCriticality`).
5. **Bericht** nennt für die Kette die Träger je Risiko und die Funktionen, die mindestens ein Risiko tragen.
   Eine Gegenmaßnahme am System gilt als quer geltend und zählt nicht in die Träger.
5a. **Ergebnis ist ein CR.** Neue Risiken und Gegenmaßnahmen gehen durchs Gate; eine neue Gegenmaßnahme wird als
   funktionale Anforderung der Funktion zugeordnet, die sie trägt. Das ist das Schreiben des Ergebnisses. Alten
   Bestand am Modul räumt die FMEA nicht auf.
6. **Vorschläge (Ergebnis c) in fester Form** für den Optimierer (CR-GC-785): Zweck, Kette, Ort,
   Handlungsklasse, Prognose (was besser wird, was gleich bleibt), Preis. Die FMEA wendet keinen Umbau an.

Dazu `tests/skill-fmea-orte.test.ts`, `src/projections/tool-help.ts`, die Fassung unter
`.opencode/skills/se-fmea/`, Anforderung und Test am Knoten `FUNC-se-fmea`.

## Umfang laut `graph_impact` (graphVersion 681)

`FUNC-se-fmea`: zwei Flüsse (`FLOW-skill-request`, `FLOW-chain-metrics`), eine Kette (`FCHAIN-skill-authoring`),
ein Block (`FUNC-block-urteilsarbeit`). Kein weiterer Abnehmer.

## Abnahme

- Der Skilltext nennt keine Rechnung und legt keinen alten Bestand tiefer; der Test hält beides fest.
- Ein Lauf an einer Kette mit einer Gegenmaßnahme am Modul endet mit dem Verweis auf `se-vorbereitung`.
- Ein Lauf an `FCHAIN-steering-loop` nennt Umfang und Fläche und liefert den Vorschlag aus CR-GC-779 in der
  festen Form.

## Grenzen

Auftreten und Entdeckung bleiben Schätzungen. Kongruenz: kein Laufzeitcode, der Skill ist ein Prompt.
