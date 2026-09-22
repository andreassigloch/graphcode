# CR-GC-591: Claude-Code-Kanaele modellieren und in die Rangfolge aufnehmen: CR-573/575 kennen nur die Executor-Kanaele; Gate-Antwortfelder, Werkzeuge auf Abruf, Skills, Doku und Freigabe fehlen mit Rang und Zeitpunkt (vor/nach der Entscheidung)

**Status:** ✅ Done (2026-09-22)
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

## 5 Ergebnis (2026-09-22)

- Sieben Host-Kanaele als FLOW-Knoten (`gate-verdict`, `next-step`, `skill-reference`, `guardrails`,
  `steer-advisory`, `fit-advisory`, `handoff`), je mit `channelRank`, `zeitpunkt` (prompt | probe |
  antwort, definiert in `channel-rank.ts` als `CHANNEL_TIMINGS`) und `treiber` (host | executor |
  beide); die neun Executor-Kanaele tragen die beiden Attribute nach. Erzeuger sind die FUNCs, die
  den Kanal wirklich fuellen (`FUNC-block-gate`, `FUNC-generation-step`, `FUNC-fit-advisory`,
  `FUNC-harness-cli`), Konsument `ACTOR-agent`, Vertrag `SCHEMA-steering-channel` (CR-GC-573).
- Durchs echte Gate auf dem echten Store (37 Mutationen, `auto-apply`, keine Warnung); kein Host
  hielt den Store. Die graphcode-Session muss ihren Host neu starten, damit er den Stand sieht.
- Abnahme `tests/channel-model.test.ts` (liest die SSOT): jeder Kanal hat Rang, Zeitpunkt, Treiber
  und den Vertrag; die Bericht-Tabelle ist vollstaendig abgebildet; was nach der Entscheidung
  kommt, traegt keinen Imperativ-Rang — ausser Gate-Wahrheit und `next`, beide begruendet.

**Kongruenz:** die neuen Knoten sind `concept: true` (Kanaele, kein Code) — RC-* nicht betroffen;
Gesamt-RC aus dieser Session nicht geprueft, benannte Ausnahme.