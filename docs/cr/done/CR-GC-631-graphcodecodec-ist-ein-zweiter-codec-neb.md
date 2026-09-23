# CR-GC-631: GraphCodeCodec faellt — ein Codec, kein Wrapper

**Status:** ✅ Done (2026-09-23)
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

## Ergebnis (2026-09-23)

| Abnahme | Ergebnis |
|---|---|
| 1. `grep -rn "GraphCodeCodec\|gcCodec" src tests scripts` | leer |
| 2. Ausgabe bytegleich | `gcCodec.encode(g)` vs. `codec.serialize(g, {roundTrip:true})` ueber den eigenen Graphen: 883 Knoten, 2.169 Kanten, **395.018 Zeichen identisch** |
| 3. Rundlauf geprueft | `parse(serialize(g))` nennt Knoten, Kanten, Attribute und die Provenienzfelder von `g`; `serialize` zweimal bytegleich |
| 4. VOLL | 1518/1520. Die zwei roten sind `distribution` und `lockfile-sync` — der haengende Release-Zug (ITEM-2026-490), vor und nach diesem CR dieselben |
| 5. Zeilen | **`src/`: +14 / −290.** Tests: +121 / −106, plus 79 Zeilen Helfer gegen 140 Zeilen `decode()` |

**Modell-Kongruenz (nicht im urspruenglichen Umfang, aber Pflicht).** RC-01 feuerte nach dem
Loeschen dreimal statt einmal: `FUNC-decode` und `FUNC-encode` zeigten auf die geloeschte Datei.
Ueber das Gate korrigiert (graphVersion 399, tier `suggest`, keine Fehler):

- `FUNC-encode` **geloescht** — die Serialisierung ist keine graphcode-Funktion mehr, die
  Schnitt-Werkzeuge rufen `FormatECodec.serialize` direkt. Mit ihm fallen seine
  CR-`relation`-Kanten (CR-GC-103/268/269/321); der CR-Text in `docs/cr/` bleibt die Historie.
- `FUNC-decode` **umgehaengt** auf `formatEToCommands` in `src/surface/format-e-commands.ts`,
  `allocate` von `MOD-projections` nach `MOD-surface`, und er uebernimmt
  `satisfy REQ-formatE-diff-dialect` von `FUNC-encode`. **Die uid bleibt `FUNC-decode`** — sie ist
  historisch, die Funktion ist der echte Nachfolger (Text hinein, Operationen heraus), und ein
  uid-Wechsel haette sechs CR-Kanten Historie gekostet.
- `FLOW-graph-state -io-> FUNC-read-tools` statt auf `FUNC-encode`.
- `FCHAIN-codec-roundtrip` umbenannt in „serialize∘parse"; die Schreibhaelfte steht als importiert
  in der Beschreibung. **Bewusst offen gelassen:** die Kette nennt damit nur noch eine eigene
  Funktion. `FUNC-read-tools` hineinzunehmen wollte eine io-Kante auf
  `FLOW-formatE-artifact-agent`, und die hat mit `ACTOR-agent` bereits einen Produzenten —
  IO-02 blockt (gemessen im dryRun). Der saubere Zug waere eine eigene FLOW; das ist kein
  Nebenzug dieses CR.
- `tests/test-selection.audit.test.ts` zeigte auf die geloeschte Datei. Der Handschnitt aus
  CR-GC-536 ist derselbe geblieben — gemessen dieselben vier Testdateien fuer die neue.

## Abgrenzung

`FormatECodec.decode` gibt es in `@sigloch/graph-api-core` nicht und soll es nicht geben: der
Parser liefert Operationen, und Operationen sind die Wahrheit. Wer einen Graphen aus Text will,
schickt ihn durchs Gate.
