# CR-GC-591: Claude-Code-Kanaele modellieren und in die Rangfolge aufnehmen: CR-573/575 kennen nur die Executor-Kanaele; Gate-Antwortfelder, Werkzeuge auf Abruf, Skills, Doku und Freigabe fehlen mit Rang und Zeitpunkt (vor/nach der Entscheidung)

**Status:** 🟠 Open — Body ausgearbeitet
**Typ:** aus Item ITEM-2026-441 (idea)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-441.json (Lane: graph)

---

**Reihenfolge:** nach CR-GC-590.

## 1 Befund

CR-GC-573 modellierte neun Steuerungskanaele als Knoten, CR-GC-575 gab sechs davon eine Rangfolge
— beides die Kanaele des **Executor-Rundenprompts**. Die Kanaele, ueber die Claude Code gesteuert
wird, fehlen: Gate-Antwortfelder (violations, tier, Advisories, kuenftig `next`), Werkzeuge auf
Abruf (`graph_authoring_guide`, `graph_help`, `graph_readiness`, `graph_suggest`), Skills,
`GRAPHCODE.md`, die Freigabe. Genau die toten darunter (suggest, STEERING.md, Freigabe) fielen
deshalb erst im Bericht auf. Und die Rangfolge kennt keinen **Zeitpunkt**: ob ein Kanal VOR der
Entscheidung ankommt (Guide, Probe) oder danach (Advisories an der angewandten Mutation).

## 2 Zielbild

- Die Claude-Code-Kanaele als FLOW-Knoten wie in CR-GC-573, je mit Rang aus `CHANNEL_ORDER` und
  einem Attribut `zeitpunkt: vor | nach` der Entscheidung.
- Der Test „kein Kanal niedrigeren Ranges ueberschreibt einen hoeheren“ (CR-GC-575 §1, offen)
  ueber beide Treiber.

## 3 Umfang

Modellzug (graph_mutate) + `src/loop/channel-rank.ts` (Zeitpunkt) + Test; Graph-Export.

## 4 Kriterien

1. Jede Zeile der Bericht-Tabelle „Kanaele“ hat einen Knoten mit Rang und Zeitpunkt.
2. RC-* kongruent fuer die neuen Knoten, oder benannte Abweichung.
