# CR-GC-816: Block-Umverteilung nach CR-GC-813: graph_export ins Speicherwerk

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-967 (idea)
**Erstellt:** 2026-10-16
**Item:** bok/items/ITEM-2026-967.json (Lane: graph)

---

**Art:** Modellzug, kein Code

---

## Befund

Nach CR-GC-813 (v761) neu gerechnet: Leaf-FUNCs gierig zwischen Blöcken umgehängt (3–9 Kinder je Block,
Ablaufsteuerung fest als Wurzel), jeder Zug einzeln im ELK-Nachbau gemessen (Blöcke als Rahmen, 8 Seeds).

| Zug | Kreuzungen (Band) | fachlich |
|---|---|---|
| heute | 2802 (2405–3325) | — |
| `graph_export` Gedächtnis → Speicherwerk | 2462 (2318–2770) | passt: Speicherwerk „stößt den Export an", `auto-export` liegt dort |
| `own-kuzu-host` → Live-Kanal | 2393 (2037–2731) | falsch: Store-Besitz ist kein Live-Transport |
| `formatEToCommands` → Qualitäts-Gate | 2553 (2065–2833) | vertretbar; zusammen mit dem ersten Zug kein Zusatznutzen (2527) |
| `bootstrap` → Qualitäts-Gate | 2595 (2162–3199) | falsch: Erstbefüllen gehört zum Speicherwerk |
| sechs weitere | 2676–2874 | im Rauschen |

Die Block-Umverteilung ist nach CR-GC-813 bis auf diesen einen Zug ausgeschöpft.

## Umfang

- `- FUNC-block-gedaechtnis -compose-> FUNC-graph-export-snapshot`
- `+ FUNC-block-speicherwerk -compose-> FUNC-graph-export-snapshot`

Beide Blöcke liegen unter Grounding; der Wertbaum oben bleibt unverändert. `graph_impact`: keine `satisfy`/`io`
ändert sich; Ketten `doc-export` und `snapshot-freshness` unberührt.

## Benannte Abweichung

- RD-04 am Speicherwerk: 10 Kinder (> 9). Entscheidung Auftraggeber 2026-10-16: verschieben und benennen.

## Abnahme

Probelauf ohne neue Fehler; Kreuzungen am Export nachgemessen; `npm run verify:model` grün.

## Umsetzung (2026-10-16)

Ein Zug durchs Gate (v768 → v769), nur RD-04 wie benannt; die Vertragsgrenze von Gedächtnis sinkt 9 → 7.
Am Export v769 nachgemessen: 2436 (2173–3113) Kreuzungen mit Blöcken als Rahmen (enthält auch die parallelen Züge
aus CR-GC-815).
