# CR-GC-566: Der Fokus deckt, was die Anweisung verlangt

**Status:** ✅ Done (2026-09-20)
**Typ:** aus Item ITEM-2026-392 (bug)
**Erstellt:** 2026-09-20
**Item:** bok/items/ITEM-2026-392.json (Lane: graph)

---

## 1 Befund

`focusTypes` steuert zwei Injektionen: den `graph_authoring_guide`-Slice (welche Kanten
sind legal) und den Element-Index (was existiert schon). Beides ist auf die Fokus-Typen
gefiltert — seit CR-GC-539 ab Runde 1, nicht erst beim Zeichenüberlauf.

Fünf Anweisungen verlangen Typen, die dieser Filter nicht durchlässt:

| Anweisung | Fokus-Typen | verlangt zusätzlich |
|---|---|---|
| `uc`-Template | ACTOR, UC, FCHAIN, FUNC | **FLOW** |
| `req`-Template | UC, REQ | **TEST** |
| `arch`-Template | FCHAIN, FUNC, FLOW, REQ | **MOD** |
| UC-01-Klausel | ACTOR, UC, FCHAIN, FUNC | **REQ, TEST** |
| UC-02-Klausel | ACTOR, UC, FCHAIN, FUNC | **FLOW** |

Die UC-01-Klausel stammt aus CR-GC-564 und verlangt *„jede neue REQ zusammen mit einem
TEST (TEST verify→REQ) im selben Batch"* — und liefert die Grammatik für keinen der beiden
Typen mit. Das Modell **muss** danach fragen.

Das ist die Vorbedingung für ITEM-2026-388/390. Gemessen liegt der Leseanteil stabil bei
81–88 %, und die naheliegende Antwort wäre, dem Modell die Lese-Werkzeuge zu entziehen —
der Host injiziert beides ja. Solange dieser Befund steht, nähme man ihm damit den einzigen
Weg zu Information, die die Anweisung einfordert.

## 2 Zielbild

**Dieselbe Präzedenz wie beim Imperativ (CR-GC-564): die Regel gewinnt vor der Dimension.**
Wo eine Regel-Klausel die Anweisung stellt, bestimmt sie auch die Fokus-Typen. Sonst die
Dimension.

Damit die beiden nicht auseinanderlaufen können, stehen Text und Typen in **einem**
Eintrag — nicht in zwei Tabellen, die man getrennt pflegen müsste:

```ts
const RULE_CLAUSE: Record<string, { types: string[]; text: (uids: string[]) => string }>
```

Und die drei Lücken der Dimensions-Templates werden geschlossen: `uc` +FLOW, `req` +TEST,
`arch` +MOD.

## 3 Umfang

- `src/loop/generate.ts` — `RULE_CLAUSE` trägt Typen; drei Dimensionen ergänzt
- `tests/generate.test.ts` — Abnahme
- `tests/steering.process-ratchet.test.ts` — T-B5 kennt die Klausel-Präzedenz
- `tests/steering.artifact-coupling.test.ts` — dieselbe Zusicherung

Vier Dateien.

## 4 Abnahme

1. Ein UC-01-Fenster trägt REQ und TEST in `focusTypes` — die Grammatik beider Typen steht
   damit im Rundeninhalt.
2. Ein UC-02-Fenster trägt FLOW.
3. Eine Regel ohne Klausel bekommt weiterhin die Typen ihrer Dimension.
4. **Kein Elementtyp, den eine Anweisung nennt, fehlt in ihren `focusTypes`** — als Test
   über ALLE Templates und Klauseln, nicht als Einzelfall. Sonst entsteht dieselbe Lücke
   beim nächsten Eintrag wieder.
5. Suite grün.

## 5 Was bewusst offen bleibt

Ob der Leseanteil dadurch sinkt, ist eine Messung und gehört in den nächsten Lauf gegen die
Basislinie 77–96. Dieses CR stellt nur die Vorbedingung her.
