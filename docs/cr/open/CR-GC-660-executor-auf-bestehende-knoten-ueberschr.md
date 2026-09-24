# CR-GC-660: Executor: '+' auf bestehende Knoten ueberschreibt Texte (26 von 45) — im Preflight verhindern, nicht im Prompt

**Status:** 🟠 Open
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
- [ ] Rig (gcrun, N=3) gegen gcrun-100..102: ueberschriebene Texte → 0, Readiness nicht schlechter.
