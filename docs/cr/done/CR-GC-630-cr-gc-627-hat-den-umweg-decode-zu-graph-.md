# CR-GC-630: Kaltstart faehrt denselben Schreibweg wie graph_mutate

**Status:** ✅ Done (2026-09-23)
**Typ:** aus Item ITEM-2026-510 (finding)
**Erstellt:** 2026-09-23
**Item:** bok/items/ITEM-2026-510.json (Lane: code)

---

## Befund

CR-GC-627 hat den Umweg `Text → decode() → Graph → add-node/add-edge` aus `graph_mutate`
entfernt. `bootstrap()` traegt ihn weiter — `bootstrap.ts:110` ist Zeile fuer Zeile das, was
aus `write.ts` verschwand.

Zwei Folgen, gemessen am Code:

1. **Der Kaltstart kennt die Sprache nur halb.** `decode()` rekonstruiert eine Menge
   `{nodes, edges}`; „diesen Knoten loeschen" laesst sich darin nicht ausdruecken. Ein `-`
   oder `~` im Bootstrap-Text endet im Wurf („unsupported operation"), obwohl der Parser
   beides liest und das Gate beides ausfuehrt.
2. **Die Pfade driften schon.** Die `nameWarning` aus CR-GC-321 hat `bootstrap` nie bekommen:
   ein Knoten ohne `__name` bekommt still `name = uid`. Jede kuenftige Aenderung an
   `formatEToCommands` laeuft an ihm vorbei.

## Zielbild

**Ein** Weg von Format-E zu `MutateCommand[]`, zwei Aufrufer.

`formatEToCommands` ist heute eine Closure in `bindWriteTools` — deshalb konnte `bootstrap`
sie nicht rufen, und deshalb entstand der zweite Pfad ueberhaupt. Sie wandert in ein eigenes
Modul `src/surface/format-e-commands.ts` und wird zur gewoehnlichen Funktion
`formatEToCommands(harness, text)`. Das Modul haelt die **eine** `FormatECodec`-Instanz
(`FORMAT_E_CODEC`); `write.ts` gibt damit seinen Zugriff auf `ctx.gcCodec` auf.

Nebenwirkung, gewollt: `write.ts` faellt von 891 auf ~700 Zeilen.

## Umfang

| Datei | Zug |
|---|---|
| `src/surface/format-e-commands.ts` | NEU — `formatEToCommands` + `FORMAT_E_CODEC` |
| `src/surface/write.ts` | Closure raus, Import rein; `ctx.gcCodec` entfaellt hier |
| `src/surface/bootstrap.ts` | `codec.decode()` + Graph-Abbildung raus, ein Aufruf rein |
| `tests/bootstrap.test.ts` | Erwartung ueber Kommandos statt ueber `decode()`; neuer Fall: `~` im Kaltstart-Text |
| `scripts/model-test-set.mjs` | neue Testdatei registrieren, falls eine entsteht |

Fuenf Dateien.

## Abnahme

1. `bootstrap()` mit einem Text, der ein `~` traegt, laeuft durch und erzeugt `update-node`
   (heute: Wurf). Roter Test zuerst.
2. `bootstrap()` mit einem Knoten ohne `__name` meldet dieselbe `unnamed`-Liste wie
   `graph_mutate` — der Kaltstart schweigt nicht mehr.
3. Kein `decode(` mehr in `src/` ausser in `codec.ts` selbst (`grep`).
4. VOLL gruen.

## Ergebnis (2026-09-23)

Abnahme 1 und 2 rot-zuerst gesehen, dann gruen: `~` warf vorher
`GraphCodeCodec.decode: operation "update_node" is not supported`, `unnamed` war `undefined`.

- `write.ts` 891 → 687 Zeilen; `format-e-commands.ts` 218 Zeilen (Funktion unveraendert uebernommen,
  nur die Fehlerpraefixe `graph_mutate:` → `Format-E:`, weil sie jetzt zwei Aufrufer hat).
- `bootstrap.ts` 150 → 122 Zeilen; `BootstrapResult` traegt `unnamed`.
- VOLL: 1519/1521. Die zwei roten sind `distribution` und `lockfile-sync` — das bekannte Paar des
  haengenden Release-Zugs (ITEM-2026-490), unberuehrt von diesem CR.

## Abgrenzung

`GraphCodeCodec` selbst faellt hier **nicht** — das ist ITEM-2026-511. Nach diesem CR hat
`decode()` keinen Produktionsaufrufer mehr; das ist die Voraussetzung dafuer, nicht der Zug.
