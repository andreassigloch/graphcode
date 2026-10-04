# CR-GC-736: Vorschlag 'Den Variantenvergleich ... ist noch nicht abgeschlossen' — Satz 2 aus CR-GC-734 nimmt den Akkusativ der Analyse (Rig interaktiv frontier-1/3)

**Status:** ✅ Done (2026-10-04)
**Typ:** aus Item ITEM-2026-728 (bug)
**Erstellt:** 2026-10-04
**Item:** bok/items/ITEM-2026-728.json (Lane: code)

---

## Befund

Rig interaktiv frontier-1/3 (2026-10-04): „Den Variantenvergleich (Trade-off) ist noch nicht abgeschlossen — was fehlt
dafür?" — Satz 2 aus CR-GC-734 übernahm die Analyse-Namen im Akkusativ (`ANALYSE`, für „Führe … durch").

## Änderung

| Datei | Änderung |
|---|---|
| `src/loop/next-step.ts` | `vorschlagOffeneAnalyse`: Nominativ — nur der maskuline Artikel unterscheidet sich (`den` → `der`) |
| `tests/mcp.mutate-next-step.test.ts` | trade, plan (maskulin) und fmea (feminin) im Wortlaut |

Eingespielt erst nach den Rig-Läufen lokal/nvfp4 (gleicher Code über die ganze Messreihe).

## Ergebnis

`verify:full`: 202/203 grün; rot nur `distribution` (Link-Modus, contracts 10.14.0 unpubliziert — benannte Ausnahme wie
CR-GC-733..735), als Schlupf gezählt, nicht durch diese Änderung.
