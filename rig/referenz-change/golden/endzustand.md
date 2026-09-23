# Golden — woran „fertig" nachpruefbar ist

Keine Diff-Vorlage: ein anderer Weg zum selben Zustand ist kein Fehlschlag. Geprueft wird das
Ergebnis, nicht der Weg dorthin.

## Code

| Probe | Erwartung |
|---|---|
| `grep -rn "GraphCodeCodec\|gcCodec" src tests scripts` | leer |
| `grep -rn "FORMAT_E_CODEC.parse\|\.inner\.parse" src tests` | **genau eine** Stelle (`formatEToCommands`) |
| Format-E-Text → Kommandos | **ein** Leser, gerufen von `graph_mutate` UND `bootstrap` |
| `src/projections/codec.ts` | existiert nicht |
| Zeilenbilanz `src/` ueber die drei CRs | rund **−280** |

## Verhalten, das vorher fehlte

| Probe | Erwartung |
|---|---|
| `bootstrap()` mit `~` im Text | erzeugt `update-node` (warf vorher) |
| `bootstrap()` mit Knoten ohne `__name` | meldet `unnamed` (schwieg vorher) |
| `graph_elements({format:'formatE'})` | **bytegleiche** Ausgabe wie vorher — am eigenen Graphen gemessen: 883 Knoten, 2.169 Kanten, 395.018 Zeichen |

## Modell — der Teil, den man vergisst

Das Loeschen von `src/projections/codec.ts` laesst zwei `realRef` ins Leere zeigen. Ein Lauf ist
erst fertig, wenn `RC-01` wieder sauber ist:

| Knoten | Erwartung |
|---|---|
| `FUNC-encode` | geloescht — die Serialisierung ist keine eigene Funktion mehr |
| `FUNC-decode` | `realRef` auf `src/surface/format-e-commands.ts#formatEToCommands`, `allocate` auf `MOD-surface` |
| `REQ-formatE-diff-dialect` | hat wieder einen Erfueller |
| `FLOW-graph-state` | `io` auf einen Knoten, den es gibt |

Der Zug gehoert durchs Gate (`graph_mutate`), nicht in die JSON-Datei.

## Testspur

VOLL gruen bis auf `tests/distribution.test.ts` und `tests/lockfile-sync.test.ts` — die beiden
haengen am unpublizierten Release-Zug (ITEM-2026-490) und sind vor wie nach dem Change rot.

## Zwei Fallen, die den Lauf verraten

1. **`tests/test-selection.audit.test.ts`** behauptet die Testauswahl fuer
   `src/projections/codec.ts`. Wer die Datei loescht und diesen Test nicht mitzieht, bekommt eine
   gruene CODE-Spur, die in Wahrheit auf den Volllauf zurueckgefallen ist.
2. **Ein Testhelfer, der selbst parst.** Die naheliegende Loesung fuer die 13 Teststellen, die
   `decode()` riefen, ist ein Helfer ueber `parse()` — und der ist wieder ein zweiter Leser.
   Richtig ist ein Helfer, der `formatEToCommands` ruft.
