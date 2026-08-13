# CR-GC-334 — `@`-Attribute im Format-E-Schreibpfad verlieren ihre Objektform

**Status:** open · **Datum:** 2026-08-13
**Ziel:** graphcode 0.12.x
**Ontologie:** v4.0.0 — **unverändert**
**Herkunft:** Modellierung der Steuerungsschleife (CR-GC-332). Der erste Batch lief als Format-E
und kam mit R-19/R-20 für **jeden** Knoten zurück, obwohl jeder eine Bindung mitbrachte.

---

## 1. Problem

`graph_mutate({formatE})` liefert strukturierte Attribute als **String** statt als Objekt.
Reproduzierbar ohne Gate, direkt am Codec:

```
+ FUNC-x|Eine Beschreibung. [__name:x(a),status:done]
@realRef {"file":"src/steering.ts","symbol":"nextStep","lang":"ts"}
```
→ `attributes.realRef === '{"file":"src/steering.ts",…}'` (String, nicht Objekt).

Der contracts-Parser ist **nicht** die Fehlerquelle: `hydrateAttrValue`
(`packages/contracts/src/se/format-e-parser.ts:92`) parst `{…}` korrekt zu einem Objekt. Verloren
geht die Form danach, im graphcode-Pfad (`src/codec.ts`, `GraphCodeCodec.decode` →
`formatEToCommands` in `src/tools/write.ts:178`).

**Was das kostet:** R-19 (`testRef`) und R-20 (`realRef`) prüfen auf `{file, …}`. Ein String
erfüllt das nie — also meldet das Gate „Bindung fehlt" für Knoten, die eine Bindung tragen. Damit
ist **Format-E als Autoring-Pfad für gebundene Elemente unbenutzbar**, und genau dafür ist er da
(die Tool-Beschreibung empfiehlt ihn ausdrücklich: „~2–3× weniger Tokens"). Wer eine Bindung setzen
will, muss auf `commands` ausweichen — ein zweiter Pfad mit anderem Ergebnis, nicht anderer Form.

Der Export ist davon **nicht** betroffen: `graph_export` schreibt die `@realRef`-Zeilen korrekt.
Der Round-Trip ist also asymmetrisch — was herausgeschrieben wird, kommt nicht gleichwertig zurück.

---

## 2. Ziel

`decode(encode(g)) == g` auch für strukturierte Attribute: was der Export als `@key {json}`
schreibt, liest der Schreibpfad als Objekt zurück.

---

## 3. Nicht-Ziele

- **Kein neues Attribut-Format.** `@key {json}` bleibt die Schreibweise; sie funktioniert bereits
  auf der Export-Seite.
- **Keine Regeländerung.** R-19/R-20 verlangen zu Recht ein Objekt.

---

## 4. Anforderungen

1. Ein `@key`-Wert, der als JSON-Objekt oder -Array geschrieben ist, kommt als Objekt/Array im
   `attributes`-Feld des `add-node`-Kommandos an.
2. Ein Wert, der **kein** JSON ist, bleibt unverändert String (`@contract Boundary-validiert …`
   existiert im Graphen und darf nicht zu einem Parse-Fehler werden).
3. **Round-Trip-Test als Beweis, nicht als Kommentar:** ein Knoten mit `realRef` + `testRef` wird
   exportiert, wieder eingelesen und muss attributgleich sein — und `evaluateRules` darf danach
   für ihn kein R-19/R-20 melden. Genau dieser Test fehlt heute, sonst wäre der Defekt nicht
   monatelang unbemerkt geblieben.
4. Klären und im CR notieren, ob der Verlust in `GraphCodeCodec.decode` oder im
   `FormatECodec.parse` von graph-api-core passiert — der Fix gehört an genau eine Stelle.

---

## 5. Betroffene Dateien (Schätzung)

| Datei | Änderung |
|---|---|
| `src/codec.ts` | Attribut-Hydrierung erhalten (oder: Ursache in graph-api-core, dann dort) |
| `tests/codec.roundtrip.test.ts` | Round-Trip über strukturierte Attribute + Regel-Nachweis |

2 Dateien, wenn die Ursache in graphcode liegt; sonst ein Paar-CR in `sigloch-modules`.

---

## 6. Akzeptanzkriterien

- [ ] `graph_mutate({formatE})` mit `@realRef {...}` erzeugt einen Knoten, für den R-20 **nicht** feuert.
- [ ] `@contract <freier Text>` bleibt ein String.
- [ ] Round-Trip-Test grün: Export → Import → attributgleich.
- [ ] `npm run build` + Suite grün.

@author andreas@siglochconsulting
