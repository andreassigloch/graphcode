# CR-GC-584: workOrder bei Bindungsquote 0 % ist reines Rauschen: in allen Greenfield-Laeufen 100 % nur 'blind' (jede FUNC ohne realRef), 4-21 Bloecke je Lauf — CR-576 laesst ihn durch, weil blind nicht leer ist

**Status:** ✅ Done (2026-09-21)
**Typ:** aus Item ITEM-2026-432 (finding)
**Erstellt:** 2026-09-21
**Item:** bok/items/ITEM-2026-432.json (Lane: graph)

---

## 1 Befund (Runde 7)

In allen Greenfield-Laeufen war `workOrder` zu 100 % "blind": jede FUNC ohne `realRef`, nie eine
Datei — 4 bis 21 Bloecke je Lauf, jeder mit der vollen FUNC-Liste. CR-GC-576 laesst ihn durch,
weil `blind` nicht leer ist.

## 2 Die Grenze

`blind` steht gegen die Fail-open-Luege: leere `moves` **neben** Code. Ein Modell ohne eine einzige
gebundene FUNC hat keine Luecken, es hat keinen Code — und das sagt `graph_readiness` einmal
(Code-Urteil "nicht pruefbar", Bindung 0 %), nicht jeder Zug.

## 3 Umsetzung

`congruenceWorkOrder`: ist weder vor noch nach dem Zug irgendeine FUNC gebunden, ist der Auftrag
leer und faellt ueber `workOrderIsSilent` aus der Antwort. Eine einzige Bindung genuegt, und jede
ungebundene FUNC steht wieder in `blind`. Faellt die letzte Bindung mit dem Zug weg, gilt der
Vor-Stand. Abnahme `tests/work-order.test.ts` (der bestehende blind-Test steht jetzt neben einer
gebundenen FUNC — erst dort ist Schweigen eine Luege).

## 4 Kriterien

| # | Kriterium | Ergebnis |
|---|---|---|
| 1 | Greenfield: kein workOrder; gemischt: blind vollstaendig | erfuellt |
| 2 | Bestaetigungslauf: kein workOrder-Block in der Antwort | erfuellt — 0 statt 4–21 |

## 5 Bestaetigung

Bestaetigungslauf `opus5-9` (2026-09-21, sigllm-Prosa, Claude Code, 1 Lauf): 265 Elemente, Konformitaet 1,0, 10,85 $, 22 min.

**Kongruenz:** RC-* nicht aus dieser Session geprueft — benannte Ausnahme wie bei CR-GC-570.
