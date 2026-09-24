# CR-GC-660: Executor: '+' auf bestehende Knoten ueberschreibt Texte (26 von 45) — im Preflight verhindern, nicht im Prompt

**Status:** ✅ Done (2026-09-24)
**Typ:** aus Item ITEM-2026-563 (bug)
**Erstellt:** 2026-09-24
**Item:** bok/items/ITEM-2026-563.json (Lane: code)

---

## Befund

gcrun-100..102 (nach CR-GC-658/659): 45 Neu-Deklarationen bestehender Knoten mit `+` in drei Laeufen,
**26 davon ueberschreiben Beschreibung oder Namen** — teils mit dem Beispieltext des UC-02-Vorbilds
(„Nimmt die Anfrage entgegen."), teils verschlechternd. `+` auf eine bestehende uid ist ein Upsert.
Das Prompt-Vorbild aus CR-GC-654 hat das nicht verhindert (0 reine Kanten-Batches).

## Umsetzung

Im Code, nicht im Prompt: der Executor-Preflight laesst ein `add-node` auf eine uid, die der Graph
schon mit demselben Typ fuehrt, fallen — die Kanten des Batches bleiben, der Text bleibt. Gewollte
Aenderungen gehen mit `~` (update-node) und laufen unveraendert durch. Bleibt danach nichts uebrig,
blockiert der Preflight mit Hinweis (`## Edges` ohne Knotenzeile, `~` zum Aendern) statt eine leere
Liste ans Gate zu schicken. Ein Typwechsel bleibt unberuehrt — den lehnt das Gate ab.

Dazu ein Modell-Befund beim Pruefen der Testauswahl: `FUNC-preflight` erfuellte keine REQ, die
Graph-Auswahl fand fuer `preflight.ts` deshalb 0 Tests. Neu: `REQ-preflight-hygiene` (functional,
verfeinert `REQ-small-model-viable`), erfuellt von `FUNC-preflight`, verifiziert von
`TEST-executor-preflight`.

## Dateien (3)

`src/loop/preflight.ts`, `tests/executor.preflight.test.ts`, diese Datei (plus Modell).

## Akzeptanzkriterien

- [x] Neu-Deklaration faellt weg, Kante bleibt; nur Neu-Deklarationen → Block mit Hinweis; neuer
      Knoten und Typwechsel unberuehrt; am echten Store bleibt der UC-Text, die Kante kommt an —
      3 der 4 Faelle rot auf dem alten Stand.
- [x] Der alte R-01-Test prueft weiter seine Absicht (kein Stub fuer verifizierte REQ).
- [x] Rig — Ziel erreicht; Readiness leicht niedriger, im Rauschen und erklaert (siehe unten).

## Rig-Messung (2026-09-25, `results-runde19-gcrun-660-661.json`, gcrun-120..122, gemeinsam mit CR-GC-661)

| Mittel je Lauf | 658+659 | 660+661 |
|---|---:|---:|
| angewandte Neu-Deklarationen / davon Text ueberschrieben (3 Laeufe) | 45 / 25 | **0 / 0** |
| vom Preflight abgefangene Neu-Deklarationen (3 Laeufe) | — | 113 |
| UC-01-Batches (3 Laeufe) | 11, davon 9× „1 UC / 1 REQ" | **4: 3UC/6REQ ×2, 2UC/3REQ, 3UC/8REQ** |
| Elemente / neue Kanten | 44 / 59 | **52 / 63** |
| FUNC | 5,0 | 9,7 |
| Lese-Aufrufe | 146 | 114 |
| Gate-Ablehnungen | 3,0 | 4,0 |
| Readiness req / uc / arch / ver | .89 / .85 / .93 / .86 | .83 / .80 / .90 / .87 |
| Tokens ein / Laufzeit | 218k / 231 s | 197k / 215 s |

Beide Ziele erreicht. **Readiness leicht niedriger** — je Lauf ueberlappend (req .84–.92 gegen
.81–.86; uc mit einem Ausreisser .70) und mechanisch erklaerbar: mehr REQs in weniger Runden, in zwei
Laeufen haengen am Rundenende 7 REQs noch ohne Erfueller (RD-01). Das ist die Momentaufnahme bei
Runde 12, kein schlechteres Element. Behalten.
