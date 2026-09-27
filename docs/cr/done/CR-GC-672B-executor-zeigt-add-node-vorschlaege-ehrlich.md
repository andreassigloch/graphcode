# CR-GC-672B: Executor zeigt add-node-Vorschlaege ehrlich

**Status:** ✅ Done 2026-09-27
**Typ:** Folge-CR aus CR-GC-672 (Grenze 10 Dateien), Quelle ITEM-2026-614 Punkt 4
**Erstellt:** 2026-09-27

---

BEFUND: Der Vorschlags-Block der Rundeninjektion (`src/loop/executor-prompt.ts`, `buildRoundChannels`,
Abschnitt (c)) rendert jeden Vorschlag als EINE Kante `source -type-> target`. Fuer `op: 'add-node'`
(CR-GC-684, se-engine CR-SM-367/356) ist das die gespiegelte `edges[0]` — eine Kante auf einen Knoten,
den es noch nicht gibt. Das Modell uebernimmt sie, das Gate weist sie ab (R-08); Knoten, weitere
Kanten und `retires` sieht es nie. Die Form des ausgelieferten Zugs steht in `batchFor`
(`src/loop/suggest.ts`): `[add-node(node), ...delete-edge(retires), ...add-edge(edges)]`.

ZIEL: Der Block zeigt einen add-node-Vorschlag als Format-E-Batch, genau wie `batchFor` ihn anwendet —
`### <TYP>` / `+ uid|Beschreibung [__name:Name]`, die `edges` als `+ A -t-> B`, die `retires` als
`- A -t-> B`. Einzelkanten-Vorschlaege (`add-trace`, ggf. mit `retire`) unveraendert, mit `retire` als
Loeschzeile. `merge-nodes`: pruefen, ob Format-E ihn ausdrueckt — sonst draussen lassen und das im Block benennen.

UMFANG: `src/loop/executor-prompt.ts` (SuggestRow um `op/node/edges/retires/retire`, Renderer aus
`batchFor` abgeleitet — keine zweite Form), `tests/executor.round-injection-suggest-skill.test.ts`
(rot zuerst: ein add-node-Vorschlag im Block als Knotenzeile + alle Kanten; der gerenderte Batch geht
so durchs Gate).

ABNAHME: Unit-Test rot → gruen; der gerenderte Batch eines echten add-node-Vorschlags (RD-04 oder
RD-01 add-node am Fixture) besteht den Gate-dryRun.

---

## Umsetzung (2026-09-27)

- `src/loop/format-e-commands.ts`: `commandsToFormatE(commands)` — die Rueckrichtung zu
  `formatEToCommands`. Knoten und angelegte Kanten schreibt `SE_FORMAT_E_CODEC.serialize` (Knoten mit
  `roundTrip` samt `[__name:…]`; Kanten ohne, weil dessen Validierung jeden Endpunkt im selben Graphen
  verlangt). Was ein Zustand nicht ausdrueckt, steht als Sprachzeile: `- A -t-> B`, `M a + b`.
  Andere Ops werfen — kein stilles Weglassen.
- `src/loop/executor-prompt.ts`: `SuggestRow.edit` ist `SuggestedEdit`; jeder Vorschlag wird als
  `commandsToFormatE(batchFor(edit))` gerendert. Eine einzelne angelegte Kante bleibt Einzeile, alles
  andere steht als ```format-e-Block (delta im Kopf). Der Fokus-Filter liest alle beruehrten uids
  (node, edges, retires, retire, merges).
- `merge-nodes`: Format-E drueckt ihn aus (`## Merges` / `M source + target`) — er steht jetzt als Merge
  da statt als `relation`-Kante.

ABNAHME: `tests/executor.round-injection-suggest-skill.test.ts`, describe CR-GC-672B — rot vorher
(`RD-04 @ FUNC-P: FUNC-P -compose-> FUNC-P-ebene`, Kante auf einen nicht existierenden Knoten), gruen
nachher: Knoten-/Loesch-/Kantenzeilen; Rundlauf `formatEToCommands(block)` = `batchFor(edit)`;
RD-04 am Fixture (Disk-Kuzu) — der injizierte Block besteht `graph_mutate({formatE, dryRun:true})`.

NICHT ENTHALTEN: der Block filtert nicht auf `applicable` — ein am dryRun gescheiterter Vorschlag mit
`edit` wuerde weiter gezeigt. Vorbestehend, nicht Teil dieses CR.

## Nachtrag 2026-09-27

Vorschlaege mit `applicable: false` (vom Gate-Probelauf in graph_suggest verworfen) werden nicht mehr injiziert — Test in `tests/executor.round-injection-suggest-skill.test.ts`, rot vor dem Filter.
