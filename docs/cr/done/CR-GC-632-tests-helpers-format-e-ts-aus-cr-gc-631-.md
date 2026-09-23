# CR-GC-632: Der Testhelfer ruft den einen Leser, statt ihn nachzubauen

**Status:** ✅ Done (2026-09-23)
**Typ:** aus Item ITEM-2026-515 (finding)
**Erstellt:** 2026-09-23
**Item:** bok/items/ITEM-2026-515.json (Lane: code)

---

## Befund

CR-GC-631 hat `GraphCodeCodec.decode()` geloescht und 13 Teststellen auf
`tests/helpers/format-e.ts` umgestellt. Der Helfer ruft `FORMAT_E_CODEC.parse` **selbst** und
bildet die Operationen **selbst** ab — `__`-Attribute trennen, `__name` herausziehen, uid und Typ
aus der Operation lesen. Genau diese Abbildung steht in `formatEToCommands`.

Das ist derselbe Fehler wie der geloeschte, eine Stufe kleiner: zwei Leser desselben Textes, deren
Auslegung auseinanderlaufen kann, ohne dass ein Test es merkt — die Tests sind ja der eine der
beiden Leser.

Gemessen: 30 Aufrufstellen in 7 Dateien. 8 pruefen nur, **ob** der Parser wirft; 22 fragen, **was**
im Text steht.

## Zielbild

Genau **ein** Leser im Repo. Der Helfer bleibt — als Adapter fuer Zusicherungen, nicht als Leser.

`formatEToCommands(harness, text)` liest vom Harness eine einzige Sache:
`harness.getGraph().nodes` (der Typindex). Der Parameter wird auf das verengt, was die Funktion
wirklich braucht — `bestand: Graph`. Damit kann jeder Aufrufer sie rufen, auch einer ohne Harness,
und der Helfer wird zu ~25 Zeilen, die ihre Kommandos filtern.

Die Verengung ist kein Zugestaendnis an Tests: eine Funktion, die einen Graphen liest, soll einen
Graphen verlangen. `write.ts` und `bootstrap.ts` uebergeben `harness.getGraph()`.

## Umfang

| Datei | Zug |
|---|---|
| `src/surface/format-e-commands.ts` | Parameter `harness: GraphCodeHarness` → `bestand: Graph` |
| `src/surface/write.ts` · `src/surface/bootstrap.ts` | Aufruf mit `harness.getGraph()` |
| `tests/helpers/format-e.ts` | ruft `formatEToCommands`, projiziert nicht mehr selbst (79 → ~25 Zeilen) |
| `tests/codec.roundtrip.test.ts` | Provenienz (`__createdAt`/`__updatedAt`) wird am TEXT geprueft |
| `tests/bootstrap.test.ts` | Aufrufform |

Fuenf Dateien.

## Was dabei verloren geht — benannt, nicht verschwiegen

`formatEToCommands` verwirft `__`-Attribute; `__createdAt`/`__updatedAt` kommen in keinem Kommando
an. Der Rundlauf-Test prueft sie bisher ueber das `roh`-Feld des Helfers.

Das ist kein Verlust, sondern eine Korrektur: der Produktionsweg liest die Provenienz **nicht**
zurueck, weil sie dem Speicher gehoert, nicht dem Text. Ein Test, der sie zurueckliest, prueft eine
Zusicherung, die das System nicht gibt. Geprueft wird stattdessen, was wahr ist: `serialize` mit
`roundTrip: true` **schreibt** sie in den Text.

## Abnahme

1. `grep -rn "FORMAT_E_CODEC.parse" src tests` nennt genau **eine** Stelle: `formatEToCommands`.
2. Alle 30 Aufrufstellen unveraendert in ihrer Aussage; VOLL gruen (ohne das bekannte Paar
   `distribution`/`lockfile-sync`, ITEM-2026-490).
3. Zeilenbilanz im Bericht.

---

## Ergebnis (2026-09-23)

| Abnahme | Ergebnis |
|---|---|
| 1. genau ein Leser | `grep -rn "FORMAT_E_CODEC.parse" src tests` → **eine** Stelle, `format-e-commands.ts:58` |
| 2. VOLL | 1519/1521; die zwei roten sind `distribution` und `lockfile-sync` (ITEM-2026-490), unveraendert |
| 3. Zeilen | `src/` +5 / −5 (nur die Signatur), Tests +80 / −80; der Helfer **79 → 34 Zeilen** |

**Nebenbefund, der den CR rechtfertigt.** Beim Umstellen fiel auf: die SSOT-Fixture des
Rundlauf-Tests traegt **keinen einzigen Zeitstempel** — `elementToNode` setzt `createdAt` nicht.
Die Provenienzzweige in `normalize()` und im alten `decode(encode(g))`-Vergleich waren damit
bedingte Zweige, die nie feuerten: **die Provenienz war nie geprueft.** Der neue Fall `(c3)` baut
einen Knoten mit Stempeln, belegt dass `serialize` `__createdAt`/`__updatedAt` schreibt, und
belegt zugleich, dass der eine Leser sie NICHT zurueckgibt — sie gehoert dem Speicher.
