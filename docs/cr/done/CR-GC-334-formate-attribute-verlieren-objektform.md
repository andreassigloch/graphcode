# CR-GC-334 — `@`-Attribute im Format-E-Schreibpfad verlieren ihre Objektform

**Status:** done · **Datum:** 2026-08-13 · **Abgeschlossen:** 2026-08-13
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

- [x] `graph_mutate({formatE})` mit `@realRef {...}` erzeugt einen Knoten, für den R-20 **nicht** feuert
      (`tests/mutate.formate-binding.test.ts`, am echten Gate, mit Kontrastfall).
- [x] `@contract <freier Text>` bleibt ein String.
- [x] Round-Trip-Test grün: Export → Import → attributgleich.
- [x] `npm run build` + Suite grün (678/680 — die zwei bekannten Roten aus CR-GC-329).

---

## 7. Abschluss 2026-08-13

**Der Defekt war doppelt, nicht einfach** (§4.4 wollte die Stelle geklärt haben — hier ist sie):

| Richtung | Was passierte | Fix |
|---|---|---|
| **Schreiben** | `FormatECodec.serializeAttrs` schob Objekte über `String(v)` in den Inline-Block `[k:v]` → der literale Text `[object Object]`. Die Bindung starb, bevor sie eine Datei erreichte. | `structuredAttrLines`: Objekte/Arrays als `@key {json}`-Folgezeilen |
| **Lesen** | `FormatECodec.parse` reichte den `@key`-Wert als String durch. `RealRefSchema` weist einen String ab ⇒ Element „unbound" ⇒ R-19/R-20. | `hydrateAttrValue` aus contracts (4.1.0 exportiert sie) — **importiert, nicht nachgebaut** |

Beides in **graph-api-core** (`src/format-e-codec.ts`), nicht in `GraphCodeCodec` — graphcodes
Codec delegiert das Parsen dorthin. Damit ist der Fix an genau einer Stelle.

**Warum das monatelang unbemerkt blieb — der eigentliche Befund.** `tests/codec.roundtrip.test.ts`
baute seine Erwartung mit `String(v)`/`JSON.stringify(kinds)` und verglich dann gegen den
dekodierten Graphen: **beide Seiten waren stringifiziert**, also war `[object Object] ==
[object Object]` grün. Ein Round-Trip-Test, der per Konstruktion nicht scheitern konnte —
Fake-Coverage in Reinform. Die Fixture kommt jetzt aus `elementToNode` (derselben Abbildung, die
`harness.importGraph` benutzt); Skalare werden beidseitig auf String normalisiert (der
Inline-Block ist untypisiert, `maxFiles:4` kommt als `"4"` zurück — Formatgrenze, kein
Bindungsverlust), **Objekte und Arrays nicht**.

**Ein echter Datenfehler fiel dabei auf und wurde durchs Gate repariert:**
`REQ-greenfield-systemtest-dod` trug `kinds` als **String** `"[\"functional\"]"` statt als Array —
Rest eines früheren verlustbehafteten Pfades. Jetzt Array (v76). Es ist derselbe Knoten, den
CR-GC-333 wegen dreier Elternteile anfasst.

**Nicht behoben, benannt:** strukturierte Attribute an **Kanten**. Der Inline-Block muss
einzeilig bleiben, JSON darin bricht am Komma. Objekte an Kanten werden jetzt als JSON
geschrieben statt als `[object Object]` — round-trip-fest nur ohne Komma. Keine Kante der
SE-Ontologie trägt heute so ein Attribut; wenn eine es täte, wäre der Inline-Block zu ersetzen,
nicht diese Notlösung.

**Versionen:** contracts 4.1.0 (Export), graph-api-core 2.3.0 (Fix). Beide **unpubliziert** —
graphcode arbeitet weiter über `link:siblings`.

@author andreas@siglochconsulting
