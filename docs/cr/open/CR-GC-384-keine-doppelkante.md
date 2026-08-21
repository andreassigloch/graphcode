# CR-GC-384 — Eine Kante existiert einmal: Doppelkante nach `merge-nodes`

**Status:** open · **Angelegt:** 2026-08-21 · **Auslöser:** CR-GC-383

## Root Cause

`mergeNodes` aus `@sigloch/graph-api-core` dedupliziert eine umgehängte Kante nur gegen das, was es
**bereits gesammelt** hat:

```js
for (const e of graph.edges) {
  if (!touchesSource) { edges.push(e); continue }   // vorhandene Kante: ungeprüft
  ...
  if (!edges.some(sameEdge)) edges.push(rewired);    // umgehängte Kante: geprüft
}
```

Damit entscheidet die **Reihenfolge**. Reproduziert:

| Kantenreihenfolge | Ergebnis |
|---|---|
| Quelle vor Ziel | `B-verify->R` **zweimal** |
| Ziel vor Quelle | einmal |

In CR-GC-383 traf genau das zu: `TEST-efficient-testing` und `TEST-mvp-e2e` verifizierten beide
`REQ-impact-based-testing`, der Merge erzeugte die Kante doppelt.

## Impact

Kuzu schlüsselt auf `(source, type, target)` und behält still **eine**. Der In-Memory-Graph behauptet
danach eine Kante, die der Store nicht hat — Speicher 1238, Disk 1237. Sichtbar wurde es an
`tests/mcp.reseed.test.ts`: der Reseed-Roundtrip meldete einen Verlust, den es nie gab. Betroffen ist
jede Auswertung auf dem Speicher-Graphen (Regeln, Metriken, Export), weil eine Kante doppelt zählt.

## Fix

| Datei | Was |
|---|---|
| `src/harness.ts` | `merge-nodes` dedupliziert Graph **und** Delta über das Store-Tripel — der In-Memory-Graph kann die Divergenz gar nicht erst tragen |
| `src/exporter.ts` | `exportGraphJson` schreibt jedes Tripel einmal — der kanonische Snapshot behauptet nie mehr Kanten, als der Store halten kann |
| `tests/mutate.merge-dedupe.test.ts` | **neu** — 3 Fälle: Merge in der kritischen Reihenfolge, Speicher **gegen Disk**, Serializer |
| diese CR-Datei | |

Zwei Stellen bewusst: der Harness schützt seine eigene Invariante (wie R-08 die referenzielle
Integrität), der Exporter die Kanonizität des Artefakts. Der eigentliche Fix gehört **upstream** nach
`graph-api-core` — solange `mergeNodes` reihenfolgeabhängig bleibt, ist jeder Konsument der Familie
betroffen, nicht nur graphcode. Meldung offen, siehe unten.

## Einmalige Kanonisierung des Snapshots

Der committete Snapshot trug die Doppelkante bereits (geschrieben vom alten Build). Er wurde einmalig
mit dem korrigierten `exportGraphJson` neu serialisiert — 1238 → 1237 traces, `graphVersion` 120
erhalten. Das ist keine Modell-Änderung: der Store sagte die ganze Zeit 1237; die Datei war eine
veraltete Serialisierung davon. Beleg: `node scripts/export-graph.mjs` läuft danach ohne den
Kanonizitäts-Abbruch durch, und `tests/mcp.reseed.test.ts` ist wieder grün.

## Offen / nicht in diesem CR

- **Upstream-Meldung an `@sigloch/graph-api-core`** (`mergeNodes` reihenfolgeabhängig) — eigener CR im
  sigloch-modules-Repo, mit Publish-Zyklus.
- **Der laufende MCP-Server hält weiter den alten Build UND den alten Speicher-Graphen.** Sein
  nächstes `graph_export` würde die Doppelkante erneut schreiben. Vor der nächsten Modell-Arbeit:
  Server neu starten (`graphcode mcp`), damit Build und Speicher zum Store passen.

## Akzeptanzkriterien

- [x] Merge in der kritischen Reihenfolge erzeugt genau eine Kante (rot-zuerst per Mutation belegt: 3/3)
- [x] Speicher und Disk zählen nach dem Merge dasselbe
- [x] Kanonischer Snapshot ohne Doppel-Trace; `scripts/export-graph.mjs` läuft durch
- [x] `tests/mcp.reseed.test.ts` grün
- [x] Gesamtsuite 849/850 — einzige Rotstelle ist der Vorbestand `tests/distribution.test.ts`
      (`@sigloch/graph-view-edit@^0.6.0` ist nicht publiziert, npm kennt nur bis 0.5.0)

@author andreas@siglochconsulting
