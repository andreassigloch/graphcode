# CR-GC-782: se-fmea Version 9: Umfang, Flaeche, Tieferlegen

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-818 (idea)
**Erstellt:** 2026-10-11
**Item:** bok/items/ITEM-2026-818.json (Lane: code)

---

**Bezug:** graphcode `docs/graphcode_analyse_optimierungskonzept.md`, Abschnitt 10, Stufe 0 und 1. Sicht Wirkkette und Anforderung, Dimension Sicherheit und Verfügbarkeit,
Ergebnisse a bis d. **Wartet auf CR-SM-407** (Teile A und B).

## Anlass

Der Skill liest seit Version 8 die Orte der Kette. Der Leitfaden verlangt davor zwei Schritte und danach eine
Handlung, die der Skill nicht kennt.

## Umfang

`.claude/commands/se-fmea.md`, Version 9:

1. **Schritt Verdrahtung** bleibt der erste.
2. **Schritt Betrachtungsumfang** neu: der Skill liest den Umfang der Kette aus `graph_metrics` und nennt die
   Anforderungen, die er dafür liest. Er rechnet ihn nicht selbst.
3. **Schritt Zuordnung** neu, vor der Bewertung (Stufe 0 des Leitfadens): je Gegenmaßnahme an der Kette
   - passt sie auf genau eine Funktion, schlägt der Skill das Tieferlegen vor (als funktionale Anforderung, der
     Funktion zugeordnet);
   - trägt sie zwei Aussagen, schlägt er das Zerlegen vor;
   - findet sie keine Funktion, ist das ein Befund am Funktionsbaum;
   - gilt sie quer, bleibt sie oben und wird als Sockel genannt.
4. **Bericht** nennt die Fläche davor und danach: Träger je Risiko, Fläche ohne Sockel, Gewicht.
5. **Regel im Skill:** einer geteilten Funktion wird kein weiteres Risiko aufgeladen, ohne dass der Bericht das
   Gewicht davor und danach nennt.

Dazu `tests/skill-fmea-orte.test.ts` (bindet den Skilltext an die Felder von CR-SM-407), der Hilfetext in
`src/projections/tool-help.ts`, die Fassung für OpenCode unter `.opencode/skills/se-fmea/`.

## Umfang laut `graph_impact` (graphVersion 681)

`FUNC-se-fmea`: zwei Flüsse (`FLOW-skill-request`, `FLOW-chain-metrics`), eine Kette (`FCHAIN-skill-authoring`),
ein Block (`FUNC-block-urteilsarbeit`). Kein weiterer Abnehmer. Modell: Anforderung und Test für die drei neuen
Schritte an `FUNC-se-fmea`.

## Abnahme

- Der Skilltext nennt keine Rechnung, nur Felder aus `graph_metrics`; der Test hält das fest.
- Ein Lauf an `FCHAIN-local-agent-execution` des sigllm-Modells liefert die Klassen der Probe (11 tieferlegbar,
  1 zu zerlegen, 2 ohne Funktion, 4 quer) oder begründet jede Abweichung.

## Grenzen

Die Zuordnung Gegenmaßnahme zu Funktion bleibt ein Urteil am Text; der Skill schlägt vor, der Autor wählt,
angewandt wird durchs Gate. Kongruenz: kein Laufzeitcode, der Skill ist ein Prompt.
