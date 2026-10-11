# CR-GC-783: Skill Laufzeitanalyse einer Wirkkette

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-819 (idea)
**Erstellt:** 2026-10-11
**Item:** bok/items/ITEM-2026-819.json (Lane: code)

---

**Bezug:** `docs/graphcode_analyse_optimierungskonzept.md`, Abschnitt 10, Schritt Kettenanalyse (Stufe 8 der Regelmatrix). Sicht Wirkkette, Dimension Laufzeit, Ergebnisse a bis d.
**Wartet auf CR-SM-408 (Antwortweg; Freigabe des Autors erteilt am 2026-10-11) und CR-GC-784 (Merkmal an den
Flüssen).** Das Ergebnis eines Laufs ist ein gewöhnlicher CR.

## Anlass

Für die Laufzeit einer Wirkkette gibt es keinen Analyse-Skill. Die Probe am energymanager-Modell zeigt, was er
leisten kann: mit dem Merkmal synchron oder asynchron an den Flüssen wird sichtbar, auf welche Funktionen eine
Antwort wartet. Ohne es lag bei allen drei Entwürfen genau eine Funktion auf dem Anfragepfad.

## Umfang

Neuer Skill `.claude/commands/se-laufzeit.md` (und die Fassung für OpenCode). Einheit ist eine Wirkkette mit einer
Laufzeitanforderung.

1. **Vorbedingung.** Kette geschlossen, jeder Fluss der Kette trägt das Merkmal. Sonst endet der Skill mit dem
   Verweis auf `se-vorbereitung`; er setzt das Merkmal nicht selbst.
2. **Betrachtungsumfang** aus `graph_metrics`.
3. **Orte lesen:** Antwortweg (Glieder der Kette und die Ketten durch sie; er verlässt die Kette nicht), Zulieferer
   außerhalb des Antwortwegs, Zulauf, Verzweigung, Kreisläufe auf dem Antwortweg.
4. **Ergebnisse a bis d:** Befunde je Ort; fehlende Anforderungen (zu jeder Laufzeitanforderung die Anforderung
   an das Datenalter); Vorschläge der Klassen Vorverlagern (vorhalten statt beim Aufruf rechnen, mit eigenem
   Fluss) und Entkoppeln (geteilte Funktion vom Antwortweg nehmen); Konflikte an geteilten Funktionen.
5. **Vorschläge in derselben festen Form wie in der FMEA** (CR-GC-782, Punkt 6), mit dem Preis: Datenalter und
   die Schnittstelle der Funktion, die speist. Der Skill wendet keinen Umbau an.

Dazu ein Test nach dem Muster `tests/skill-fmea-orte.test.ts`, Modell (`FUNC-se-laufzeit` mit Anforderung und
Test, Abnehmer von `FLOW-chain-metrics`, Glied von `FCHAIN-skill-authoring`), Eintrag in der Skill-Liste.

## Umfang laut `graph_impact` (graphVersion 681)

`FUNC-chain-metrics` hat heute einen Abnehmer unter den Skills und liegt in zwei Ketten. Der neue Skill wird ein
weiterer Abnehmer von `FLOW-chain-metrics`; kein bestehender Knoten ändert sich.

## Nicht im Umfang

Menge je Abruf und Takt der Zulieferer. Der Skill sagt, auf wen die Antwort wartet, nicht wie lange.

## Abnahme

- Ein Lauf an `FCHAIN-energiefluss-ansehen` (energymanager, Merkmal gesetzt) liefert den Antwortweg der Probe
  (Dashboard und Ablage) und einen Vorschlag „Momentanstand vorhalten" mit eigenem Fluss und Datenalter als Preis.
- Ohne Merkmal endet derselbe Lauf mit dem Verweis auf die Vorbereitung.

## Grenzen

Ein Fall in der Probe.
