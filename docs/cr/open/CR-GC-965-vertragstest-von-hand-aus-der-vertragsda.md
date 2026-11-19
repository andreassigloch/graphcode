# CR-GC-965: Vertragstest von Hand aus der Vertragsdatei erzeugen (Folge 2 aus CR-GC-961)

**Typ:** aus Item ITEM-2026-1480 (idea)
**Erstellt:** 2026-11-19
**Item:** bok/items/ITEM-2026-1480.json (Lane: graph)

---

## Befund

CR-GC-961 F3d legt fest: Ein physischer Vertrag steht in einer Vertragsdatei (Markdown-Tabelle Größe, Einheit, Min, Nenn, Max, Quelle), auf die `realRef {file}` des SCHEMA ohne Symbol zeigt. Folge 2 verlangt, dass der Generator aus dieser Tabelle das Gerüst des Tests von Hand erzeugt. CR-GC-962 kann nur ein SCHEMA mit Zod-Symbol; ein SCHEMA mit Vertragsdatei fällt heute still aus dem Satz.

## Zielbild

`graphcode vertragstest <SCHEMA-uid …>` nimmt auch ein SCHEMA, dessen `realRef` auf eine `.md`-Datei ohne Symbol zeigt.

- Die Vertragsdatei trägt eine Tabelle mit den Spalten `Größe`, `Einheit`, `Min`, `Nenn`, `Max`, `Messpunkt`, `Quelle`. `Messpunkt` und `Quelle` sind optional, die übrigen Pflicht.
- Das Verb schreibt `tests/vertrag/<uid>.vertrag.md`: Kopf „erzeugt aus dem Modell“, Überschrift `# Vertragstest <SCHEMA-uid>`, je Zeile mit mindestens einem Grenzwert ein Prüfpunkt „Miss <Größe> an <Messpunkt>; bestanden, wenn Min ≤ Wert ≤ Max <Einheit>“, und der Ablauf des Ergebnisses (Protokoll ablegen, `graph_test_ingest` mit `tool: "manuell"` und `evidence`).
- Eine Zeile ohne Min und Max ist nicht prüfbar: Sie steht unter `verworfen` im Bericht. Eine Datei ohne passende Tabelle oder ohne prüfbare Zeile endet als `fehler` (Exit 1).
- Die Datei wird wie der Code-Vertragstest neu erzeugt, wenn sich der Vertrag ändert; ihr Diff zeigt die Änderung. Das Protokoll eines Laufs liegt getrennt (`evidence`).
- `se-bau` Punkt 7 nennt den Fall: TEST mit `verify` auf das SCHEMA, `testRefs {file, tool: "manuell"}`.

Abgrenzung: Je Zeile ein Prüfpunkt mit allen genannten Grenzen, nicht je Grenzwert einer (CR-GC-961 schrieb „je Grenzwert“): Eine Messung prüft Min und Max zugleich.

## Akzeptanz

1. Ein SCHEMA mit Vertragsdatei ergibt `<uid>.vertrag.md` mit einem Prüfpunkt je prüfbarer Zeile (Test, rot gesehen).
2. Eine Zeile ohne Grenzwert steht unter `verworfen`; eine Datei ohne Tabelle unter `fehler`.
3. `se-bau` Version 3 nennt den Fall; `tests/skill-bau.test.ts` prüft es.
4. Ohne uids nimmt das Verb auch SCHEMA mit Vertragsdatei im Repo.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| Form der Vertragsdatei | Markdown-Tabelle mit `Größe`, `Einheit`, `Min`, `Nenn`, `Max`, optional `Messpunkt`, `Quelle` | CR-GC-961 F3d nannte die Spalten; `Messpunkt` kommt dazu, damit der erzeugte Test ohne Platzhalter auskommt. |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1331, Tiefe 1, Wurzeln: `FUNC-erzeuge-vertragstests`._

Reichweite: 3 Elemente (FLOW 1, FUNC 2); Blackbox-Rand 1, nicht geoeffnet.

Dateien (realRef, 2):
- src/projections/vertragstest.ts
- src/surface/vertragstest-verb.ts

Tests (`graph_tests`, 3):
- tests/vertrag/SCHEMA-vertragstest-bericht.vertrag.test.ts
- tests/vertrag/SCHEMA-vertragstest-satz.vertrag.test.ts
- tests/vertragstest.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
