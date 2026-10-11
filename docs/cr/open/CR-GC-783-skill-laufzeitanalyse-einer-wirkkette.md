# CR-GC-783: Skill Laufzeitanalyse einer Wirkkette

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-819 (idea)
**Erstellt:** 2026-10-11
**Item:** bok/items/ITEM-2026-819.json (Lane: code)

---

**Bezug:** graphcode `docs/graphcode_analyse_optimierungskonzept.md`, Abschnitt 10, Stufe 2. Sicht Wirkkette, Dimension Laufzeit, Ergebnisse a bis d. **Wartet auf CR-SM-407**
(Teil C).

## Anlass

Für die Laufzeit einer Wirkkette gibt es keinen Analyse-Skill. Die Probe am energymanager-Modell zeigt, was er
leisten kann und was nicht: mit dem Merkmal synchron oder asynchron an den Flüssen wird sichtbar, auf welche
Funktionen eine Antwort wartet; ohne es lag bei allen drei Entwürfen genau eine Funktion auf dem Anfragepfad.

## Umfang

Neuer Skill `.claude/commands/se-laufzeit.md` (und die Fassung für OpenCode), Einheit ist eine Wirkkette mit
einer Laufzeitanforderung:

1. **Verdrahtung, Betrachtungsumfang** wie in jeder Analyse.
2. **Vorbedingung Merkmal.** Trägt ein Fluss der Kette `sync` nicht, ist das Setzen das Ergebnis, nicht die
   Analyse. Der Skill fragt je Fluss: wartet die Antwort auf diese Lieferung, oder ist sie vorab geliefert? Wird
   derselbe Inhalt einmal abgerufen und einmal vorab geliefert, schlägt er zwei Flüsse vor.
3. **Orte lesen** aus `graph_metrics`: Antwortweg (Funktionen und die Ketten durch sie), Tiefe der Zulieferer,
   Zulauf, Verzweigung, Kreisläufe auf dem Antwortweg.
4. **Ergebnisse a bis d:** Befunde je Ort; fehlende Anforderungen (zu jeder Laufzeitanforderung die Anforderung
   an das Datenalter); Umbauvorschläge der Klasse Vorverlagern (vorhalten statt beim Aufruf rechnen, mit eigenem
   Fluss) und Entkoppeln (geteilte Funktion vom Antwortweg nehmen); Konflikte an geteilten Funktionen.
5. **Jeder Vorschlag nennt seinen Preis:** Datenalter und die Schnittstelle der Funktion, die speist.

Dazu ein Test wie `tests/skill-fmea-orte.test.ts`, Modell (`FUNC-se-laufzeit` mit Anforderung, Test, Fluss
`FLOW-chain-metrics`, Kette `FCHAIN-skill-authoring`), Eintrag in der Skill-Liste.

## Umfang laut `graph_impact` (graphVersion 681)

`FUNC-chain-metrics` hat heute einen Abnehmer unter den Skills (`FUNC-se-fmea`) und liegt in zwei Ketten
(`FCHAIN-skill-authoring`, `FCHAIN-dashboard-metrics`). Der neue Skill wird ein zweiter Abnehmer von
`FLOW-chain-metrics`; kein bestehender Knoten ändert sich.

## Nicht im Umfang

Menge je Abruf und Takt der Zulieferer. Der Skill sagt, auf wen die Antwort wartet, nicht wie lange. Eine
Schätzung der Zeit kommt erst mit einem Attribut dafür (eigener CR in sigloch-modules, Familien-Review).

## Abnahme

- Ein Lauf an `FCHAIN-energiefluss-ansehen` (energymanager) liefert den Antwortweg der Probe (Dashboard und
  Ablage) und nennt für einen Vorschlag „Momentanstand vorhalten" den eigenen Fluss und das Datenalter.
- Der Skilltext rechnet keine Kennzahl.

## Grenzen

Ein Fall in der Probe. Ob die Reihenfolge der Schritte trägt, zeigt erst der zweite Lauf an einem anderen Modell.
