# CR-GC-631: GraphCodeCodec faellt — ein Codec, kein Wrapper

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-511 (finding)
**Erstellt:** 2026-09-23
**Item:** bok/items/ITEM-2026-511.json (Lane: code)

---

## Befund

`ctx.codec` ist `new FormatECodec(SE_DESCRIPTOR)`. `ctx.gcCodec` ist `new GraphCodeCodec()`, und
dessen `inner` ist — `new FormatECodec(SE_DESCRIPTOR)`. Zwei Instanzen desselben Codecs im selben
Kontext, gemessen an `tool-context.ts:200/203`.

Was die Klasse darueber hinaus traegt:

| Element | Zustand |
|---|---|
| `encode()` | eine Delegationszeile, **ein** Aufrufer (`graph_elements` mit `format:'formatE'`) |
| `validate()` | eine Delegationszeile, Aufrufer nur in zwei Tests |
| `project` | Feld-Alias auf `projectToOntologyGraph`, **null** Aufrufer |
| `decode()` | ~140 Zeilen, die einzige Eigenleistung — nach CR-GC-630 **null** Produktionsaufrufer |
| `inner` | oeffentlich, damit Aufrufer den Wrapper umgehen koennen — das tut `write.ts` seit CR-GC-627 |

Ein Wrapper, dessen einziges Feld oeffentlich ist, damit man an ihm vorbeigreifen kann, ist kein
Wrapper mehr.

## Zielbild

Die Klasse `GraphCodeCodec` existiert nicht mehr. Es gibt **eine** `FormatECodec`-Instanz im
Prozess — `FORMAT_E_CODEC` aus `format-e-commands.ts` (CR-GC-630) —, und `ctx.codec` ist sie.

- **Schreibweg** (Text → Kommandos): `formatEToCommands`, ein Aufrufpfad, zwei Aufrufer.
- **Leseweg** (Graph → Text): `codec.serialize(...)`, wie in allen Schnitt-Werkzeugen schon heute.
  `graph_elements` bekommt `{ roundTrip: true }` statt des Wrappers — dieselbe Ausgabe, gemessen
  byte-gleich.
- **Graph-Rekonstruktion aus Text**: existiert nicht mehr. Sie war nie eine Eigenschaft der
  Sprache, sondern graphcodes Zweitmodell daneben.

## Umfang

**Design — die echten Entscheidungen (4 Dateien):**

| Datei | Zug |
|---|---|
| `src/projections/codec.ts` | **geloescht** (270 Zeilen) |
| `src/surface/tool-context.ts` + `tool-context-contract.ts` | `gcCodec` faellt aus Kontext und Vertrag; `codec` ist `FORMAT_E_CODEC` |
| `src/surface/read.ts` | `gcCodec.encode(g)` → `codec.serialize(g, { roundTrip: true })` |
| `tests/codec.roundtrip.test.ts` | Neufassung: der Rundlauf wird ueber die Parser-Operationen geprueft, nicht ueber einen zweiten Graphen |

**Fan-out — mechanisch, nicht splittbar (11 Dateien):** `grep -rl GraphCodeCodec` = 11 weitere
Stellen. Ein Teilumbau liesse genau den parallelen Pfad stehen, den dieser CR schliesst.

- 13 Aufrufe `new GraphCodeCodec().decode(text)` in 6 Testdateien fragen dasselbe: *was sagt dieser
  Text?* Sie bekommen einen Entkopplungsschritt statt 13 Einzelfassungen —
  `tests/helpers/format-e.ts` mit `knotenAus(text)` / `kantenAus(text)` ueber
  `FORMAT_E_CODEC.parse`. **Das ist kein verschobenes `decode()`:** der Helfer liest die
  Operationen aus, rekonstruiert keinen Graphen, prueft keine Typen, loest keine Endpunkte auf und
  kennt keine Merges — ~25 Zeilen gegen 140. Er liegt in `tests/helpers/`, wie
  `tests/helpers/store.ts`, und ist aus `src/` nicht erreichbar.
- 2 Aufrufe `validate()` → `FORMAT_E_CODEC.validate` (`codec.validation.test.ts`,
  `graph-integrity.test.ts`).
- `src/index.ts` (Export weg), `tests/contract.tool-context.test.ts` (Feld weg),
  `src/projections/authoring-example.ts` und `scripts/spike-nd-known-answer.mjs` (nur Prosa, die
  eine geloeschte Klasse nennt).

## Abnahme

1. `grep -rn "GraphCodeCodec" src tests scripts` ist leer.
2. `graph_elements({format:'formatE'})` liefert **byte-gleiche** Ausgabe wie vorher — gemessen an
   einem Schnitt aus dem eigenen Graphen, vorher/nachher diffed.
3. Der Rundlauf bleibt geprueft: `parse(serialize(g))` nennt dieselben Knoten, Kanten und
   Attribute wie `g`, und `serialize` ist zweimal byte-gleich.
4. VOLL gruen.
5. **Ausgeworfene Zeilen im Bericht** — `git diff --shortstat` fuer `src/`, getrennt von den Tests.

## Abgrenzung

`FormatECodec.decode` gibt es in `@sigloch/graph-api-core` nicht und soll es nicht geben: der
Parser liefert Operationen, und Operationen sind die Wahrheit. Wer einen Graphen aus Text will,
schickt ihn durchs Gate.
