# CR-GC-781: Konzept Fassung 3: Schluss aus den Spikes und Leitfaden der Optimierung

**Status:** ✅ Done (2026-10-11)
**Typ:** aus Item ITEM-2026-816 (idea)
**Erstellt:** 2026-10-11
**Item:** bok/items/ITEM-2026-816.json (Lane: graph)

---

**Bezug:** graphcode `docs/graphcode_analyse_optimierungskonzept.md`, Abschnitt 10; Sicht Wirkkette und Anforderung, Optimierung (6b). Kein Code.

## Anlass

Zwei Tage Spikes zur Frage, ob Kennzahlen Umbauvorschläge ordnen können: drei Fälle mit neun Entwürfen
(graphcode, energymanager, sigllm), dazu Betrachtungsumfang, Flächenmaße, Tieferlegen und Fluss trennen. Ablage:
graphanalyze `docs/messung/` (Verzeichnisse `gesamt-impact-*` und `flaechen-2026-10-11`).

## Umfang

Eine Datei: `docs/graphcode_analyse_optimierungskonzept.md`, Fassung 3.

1. Kernaussage: die Güte des Modells ist die Grundlage; die Kennzahlen zeigen, die Wahl trifft der Autor.
2. Abschnitt 6b neu: der Gesamt-Impact ist Vorlage für das Urteil. Die feste Rangfolge ist gestrichen.
3. Konvention Optimierung Nr. 4 entsprechend geändert; Analyse-Konvention Nr. 2 um den Betrachtungsumfang ergänzt.
4. Abschnitt 10 neu: Schluss in fünf Punkten, Leitfaden in drei Stufen (Güte des Modells, Sicherheit, Laufzeit)
   mit Maßen und Handlungen, Belege, Grenzen.
5. Abschnitt 8 und „Offen im Konzept" auf den Stand gebracht.

## Folge-CRs

| CR | Repo | Inhalt |
|---|---|---|
| CR-SM-407 | sigloch-modules | die Maße des Leitfadens in der gemeinsamen Rechnung |
| CR-GC-782 | graphcode | `se-fmea` Version 9 |
| CR-GC-783 | graphcode | Skill Laufzeitanalyse |
| CR-SL-096 | sigllm | Gegenmaßnahmen auf die tragende Funktion legen |

## Abnahme

- Das Dokument nennt die feste Rangfolge nur noch als gestrichen.
- Jede Zahl in Abschnitt 10 steht in einer der genannten Notizen.

## Grenzen

Neun Entwürfe, je ein Gutachter. Das Gewicht (Ketten durch den Träger) ist nachgetragen und nicht vorab
festgelegt. Die Leitlinie (`docs/graphcode_leitlinie.md`) ist nicht berührt; ihre Tests T-O2, T-O3 und T-O7
zieht der Autor nach.
