# CR-GC-392 — Boot aus der committeten SSOT, statt Store und Datei abzugleichen

**Status:** open · **Angelegt:** 2026-08-22 · **Ersetzt** die erste Fassung dieses CR
(„Snapshot-Drift wird bemerkt"), deren Prämisse falsch war — siehe unten.

## Korrektur der ersten Fassung

Die erste Fassung behauptete, es gebe keine Drift-Prüfung. **Es gibt sie**, in
`src/mcp-server.ts:106-122`: der Host vergleicht beim Boot `exportGraphJson(store)` gegen die
kanonisierte committete Datei und warnt auf stderr. Sie hat im Vorfall vom 2026-08-22 nur nichts
gemeldet, weil sie **einmal beim Boot** läuft und die Divergenz Stunden später entstand.

Ein Abgleich, der einen Laufzeit-Zustand einmalig beim Start prüft, ist die falsche Bauform. Die
Frage ist nicht, wie man ihn häufiger laufen lässt, sondern warum es zwei Stände gibt, die
auseinanderlaufen können.

## Vorschlag

**Der Host seedet bei jedem Boot aus `docs/graph/*.graph.json`, statt einen vorhandenen Store zu
übernehmen.** Damit gibt es keinen Abgleich mehr, weil es keine zwei Stände mehr gibt: die
committete Datei ist die Quelle, Kuzu ist der daraus gebaute Abfrage-Index.

Heute ist es umgekehrt (`REQ-graph-is-ssot`: der Store ist Laufzeit-SSOT), und der Code nennt
seinen Grund direkt an der Stelle:

> *We do NOT auto-reseed here (that would clobber un-exported gate mutations)*

**Dieser Grund ist seit CR-GC-323 überholt.** Seitdem folgt der Export der Mutation: ein
`post-apply`-Hook exportiert nach jedem erfolgreichen Batch mit Mutationen, entprellt und
single-flight. Das Fenster, in dem der Store etwas trägt, das die Datei nicht hat, ist damit die
Entprellzeit — nicht mehr unbegrenzt.

## Drei gemessene Zahlen (nicht geschätzt)

| Frage | Messung |
|---|---|
| Was kostet der Seed bei jedem Boot? | **1626 ms** für 636 Knoten + 1510 Kanten (das ganze Selbstmodell) |
| Ist der Round-Trip verlustfrei? | **byte-identisch**: Datei → Store → Re-Export = 575758 / 575758 Bytes, 636/636 Knoten, 1510/1510 Kanten |
| Wie groß ist das Absturzfenster? | **250 ms** (`AUTO_EXPORT_DEBOUNCE_MS`) |

Der Round-Trip ist die eigentliche Voraussetzung, nicht die Kosten — und er hält. Ein Vorbehalt
bleibt: gemessen wurde am bereits normalisierten Selbstmodell. Eine SSOT, die noch redundante
`level`/`tool` in `testRefs` trägt (CR-GC-338), konvergiert erst nach dem ersten Durchlauf statt
sofort identisch zu sein. Das ist Konvergenz, kein Verlust — muss aber im Test stehen.

## Was vorher repariert werden muss

**`flush()` wird nie gerufen.** `registerAutoExport` liefert es zurück, `src/mcp-server.ts:130`
verwirft den Rückgabewert. Heute ist das folgenlos, weil der Store die letzte Mutation hält.
Unter „Boot aus der Datei" wäre es **Datenverlust**: ein harter Kill innerhalb von 250 ms nach
einem Batch verlöre ihn endgültig. Das ist die Vorbedingung, nicht ein Nice-to-have.

## Was das umdreht — eine Entscheidung, keine Umsetzungsfrage

`REQ-graph-is-ssot` sagt heute, der Store sei die Laufzeit-Quelle. Der Vorschlag dreht das:
Datei = Quelle, Store = Index. Zwei Folgen, die dafür sprechen:

- Ein `git checkout` eines älteren Stands tut danach das Naheliegende — man bootet diesen Stand,
  statt einen Warnhinweis zu bekommen und weiter auf dem alten Store zu arbeiten.
- Das dokumentierte Wiederherstellungsrezept („stop, `rm .graphcode/kuzu*`, restart") entfällt.
  Es ist heute der einzige Weg, eine neuere committete Datei zu übernehmen.

Dagegen spricht: es ist eine Änderung an einer modellierten REQ und berührt die verriegelte
Aussage „ein Store = Kuzu". Nicht lokal zu entscheiden.

## Definition of Done

- [ ] `flush()` läuft beim Shutdown — mit Test, der ohne ihn rot ist
- [ ] Entscheidung zu `REQ-graph-is-ssot` getroffen und im Graphen nachgezogen
- [ ] Boot seedet aus der committeten Datei; der Boot-Abgleich in `mcp-server.ts` entfällt ersatzlos
- [ ] Round-Trip-Test über die echte SSOT: Datei → Store → Export ist byte-identisch, und eine
      nicht normalisierte Eingabe konvergiert nach einem Durchlauf
- [ ] Boot-Zeit gemessen und im CR notiert (Referenz heute: 1626 ms)

**Dateien:** `src/mcp-server.ts` · `src/auto-export.ts` · ein Testfile · `docs/graph/graphcode.graph.json` · dieses CR
