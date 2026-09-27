# CR-GC-672B: Executor zeigt add-node-Vorschlaege ehrlich

**Status:** 🟠 Open
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
