# CR-GC-310 — Format-E-Kantenbatches verlangen Neu-Deklaration vorhandener Knoten

**Status:** done · **Angelegt:** 2026-08-07 · **Abgeschlossen:** 2026-08-08 · **Max Files:** 3 (→ 4)
**Herkunft:** graphcode-Feldtest Graphview (`docs/GC_test-graphview-results.md` §6.4/§6.5),
Code-Audit 2026-08-07. Unabhängig von den übrigen offenen CRs.

## Problem

Ein `formatE`-Batch, der nur Kanten zwischen **bestehenden** Knoten hinzufügt, scheitert mit

```
Cannot resolve type of source "…" — not declared under a "### <TYPE>" section
and no resolveType provided
```

Der Codec unterstützt `options.resolveType` (`@sigloch/graph-api-core`, `format-e-codec.d.ts:14-19`),
das MCP-Tool reicht es nicht durch: `formatEToCommands` ruft `ctx.gcCodec.decode(text)` ohne
Options (`src/tools/write.ts:135`). Der Store kennt die Typen — die Pflicht, sie zu wiederholen,
ist vermeidbar. Kostete im Feldtest einen verlorenen Durchlauf.

Betrifft beide Schreibwege gleichermaßen, weil Host und eingebetteter Executor durch dieselbe
Funktion laufen.

### Zweiter Punkt: das Kommando-Schema ist nur per Fehler-Probe auffindbar

Die kanonischen Shapes (`{op:'add-node', node:{uid,type,name,…}}`) stehen ausschließlich im
`SCHEMA-01`-Fehlertext. Die Tool-Description (`src/tools/write.ts:170-177`) nennt kein Beispiel,
also kostet der erste `commands`-Aufruf einer Sitzung einen Probe-Round-Trip.

Der Fehlertext selbst ist gut — er listet alle sieben Operationen mit vollständiger Signatur. Es
fehlt nur der Weg, ihn zu lesen, ohne ihn auszulösen.

## Architektur-Entscheidung

`resolveType` wird aus dem geladenen Graphen bedient — dieselbe Quelle, aus der das Gate ohnehin
liest, kein zweiter Index:

```ts
const idx = new Map(harness.getGraph().nodes.map((n) => [n.uid, n.type]))
ctx.gcCodec.decode(text, { resolveType: (uid) => idx.get(uid) })
```

Unbekannte uids liefern weiterhin `undefined` und damit die bisherige Codec-Meldung — ein Tippfehler
in einer uid bleibt ein Fehler und wird nicht stillschweigend zu einem neuen Knoten. Das ist die
Grenze: **auflösen, was existiert; nichts erfinden.**

Für den zweiten Punkt genügt ein Minimalbeispiel je Operationsklasse in der Description
(add-node / add-edge / update-node / delete). Kein Duplikat der Signaturliste — die bleibt im
Fehlertext, sonst driften beide auseinander.

## Scope (tatsächlich 4 Dateien)

1. `src/codec.ts` — **nicht geplant, aber zwingend.** Der CR nahm an, `GraphCodeCodec.decode`
   reiche Options durch; es nahm gar keine. Zwei weitere Sperren lagen dahinter: der
   `implicit-add`-Guard warf, bevor der Parser überhaupt zum Zug kam, und `validate()`
   typisierte Kanten-Endpunkte ausschließlich aus den mitgelieferten Knoten. Alle drei
   Stellen kennen jetzt den Resolver — `decode(text, {resolveType})`, Endpunkt gilt als
   vorhanden wenn deklariert **oder** auflösbar, `validate(graph, resolveType)`.
   Zusätzlich der Konflikt-Check: deklarierter Typ ≠ Store-Typ → Fehler, kein Silent-Retype.
2. `src/tools/write.ts` — `resolveType` aus `harness.getGraph()` durchgereicht;
   Kommando-Beispiele in der `graph_mutate`-Description, Kanten-only-Hinweis am `formatE`-Feld
3. `tests/mutate.edge-only-batch.test.ts` (neu) — beide geplanten Testdateien existierten
   nicht; die Grenzfälle gehören ohnehin an den Gate-Pfad, an dem sie auftreten. Sechs Tests:
   Happy Path, unbekannte uid, Typ-Konflikt, Pair-Legalität, plus Codec direkt (ohne Resolver
   unverändert streng, mit Resolver nur die Kante)
4. — (`tests/codec.test.ts` entfällt, in 3 aufgegangen)

## Nachweis

Red-First: mit gestashtem `src/` scheitern genau die zwei Positiv-Tests an der im CR
zitierten Meldung („Cannot resolve type of source … and no resolveType provided"); die vier
Grenzfall-Tests sind vorher wie nachher grün — sie sichern unverändertes Verhalten.
Volle Suite: 79 Dateien / 560 Tests grün.

## Akzeptanzkriterien

- [ ] Ein `formatE`-Batch, der ausschließlich Kanten zwischen bestehenden Knoten enthält, läuft
      ohne `### <TYPE>`-Sektionen durch
- [ ] Derselbe Batch mit einer **unbekannten** uid wird weiterhin abgelehnt, mit der bisherigen
      Codec-Meldung als Block-Verdict (auditiert, kein Handler-Throw)
- [ ] Der Typ mitgelieferter Knoten gewinnt gegen den Store-Typ nicht stillschweigend — ein
      Konflikt ist ein Fehler, kein Silent-Update
- [ ] Die `graph_mutate`-Description enthält je ein Minimalbeispiel für add-node und add-edge
- [ ] `npm test && npm run build` grün
