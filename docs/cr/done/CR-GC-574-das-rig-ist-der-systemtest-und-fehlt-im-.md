# CR-GC-574: Das Rig modellieren — es ist der Systemtest, nicht ein Nebenwerkzeug

**Status:** ✅ Done (2026-09-21)
**Typ:** aus Item ITEM-2026-416 (finding)
**Erstellt:** 2026-09-21
**Item:** bok/items/ITEM-2026-416.json (Lane: graph)

---

## 1 Befund und Korrektur

CR-GC-569 hat zunaechst behauptet, das Rig gehoere nicht in den Produktgraphen ("es misst, es
ist kein Teil des Produkts"). **Das war falsch.** Das Rig ist der **Systemtest**: es fuettert
den Audit-Log, und seine verbose-Auswertung (`turn-analyse.mjs`, CR-GC-567) ist die
Voraussetzung fuer Optimierungsschleifen wie die dieser Sitzung. Ohne sie waere weder der
Dry-Run-Befund noch die 70-%-Kontextmessung entstanden.

Heute hat nichts davon einen Knoten: nicht der Lauf, nicht die Metrik, nicht die Pruefliste,
nicht die Turn-Analyse. Ein Systemtest ohne Bindung ist genau die Luecke, die RC-* aufdecken
soll — und die Bindungsquote, die "so weit reicht diese Aussage" beziffert, zaehlt ihn nicht.

## 2 Zielbild

Das Rig als eigene Kette: Lauf → Artefakte → Auswertung → Befund. Mindestens
- ein `FCHAIN` fuer den Systemtest-Durchlauf,
- `TEST`-Knoten fuer die Auswertungen, die eine Zusage pruefen (Metrik, Pruefliste,
  Turn-Analyse, Dry-Run-Wirkung),
- die `SCHEMA` der Artefakte, die zwischen den Schritten fliessen (`results-*.json`,
  `claude-stream.jsonl`, `audit.jsonl`).

**Nicht** modelliert werden einzelne Arme, Modelle und Laufnummern — das ist Konfiguration.

## 3 Abhaengigkeit

Nach CR-GC-569: der Systemtest misst ueber die Betriebsmodi, also muss zuerst definiert sein,
was ein Lauf ist.

## 4 Akzeptanzkriterien

1. Aus dem Graphen beantwortbar: welche Zusage prueft der Systemtest, und womit.
2. Die Turn-Analyse ist ein TEST-Knoten mit `realRef`, kein namenloses Skript.
3. Keine Arm-/Modell-/Laufnummern-Knoten.
