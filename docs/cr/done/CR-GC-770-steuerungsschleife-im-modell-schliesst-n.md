# CR-GC-770: Steuerungsschleife im Modell: schliesst nicht, Vorschlag fehlt, mit geparktem Executor vermischt

**Status:** ✅ Done (2026-10-09)
**Typ:** aus Item ITEM-2026-800 (finding)
**Erstellt:** 2026-10-09
**Item:** bok/items/ITEM-2026-800.json (Lane: code)

---

## Befund

Die Kette `FCHAIN-steering-loop` bildet das Kernstück nicht ab (gelesen 2026-10-09, Soll und Ist in
`docs/project/steuerungsschleife.md`):

| Befund | Beleg |
|---|---|
| Die Schleife schließt im Modell nicht: vom Gate führt kein Weg zurück zum Messen | Store und Regelprüfung sind keine Glieder |
| Der Vorschlag nach jedem Zug fehlt | keine Funktion ist an `src/loop/next-step.ts` gebunden |
| Die Kette mischt die Führung von außen mit dem geparkten Executor | 31 Glieder, 16 davon Executor |
| Sieben Glieder liegen außerhalb des Funktionsbaums | kein übergeordneter Block |
| Drei Helfer ohne eigenen Vertrag halten die Kette unbewertbar | R-31: Faltung, Fund-Kontext, Dublettensuche |
| Der Schalter für den Executor heißt nach der Modellart, wählt aber den Schreibweg | `GRAPHCODE_CLIENT_LLM` je Host-Datei, daneben der Abschnitt `executor` |

## Zielbild

Zwei Ketten (Grafik: https://claude.ai/artifact/EofCFkPK1K7tBXmgWippdc):

- **Kette A, Führung von außen:** messen → Fokus wählen → vorschlagen → Zug des Nutzers → Gate → Store →
  messen. 12 der heutigen Glieder bleiben, Store und Regelprüfung kommen dazu, der Vorschlag wird als
  Funktion angelegt und an `vorschlagNachAnwendung` gebunden.
- **Kette B, Executor im Host, geparkt:** 16 Glieder, als geparkt beschrieben (CR-GC-769).
- **Ein Schalter:** `executor.delegate` in `graphcode.config.jsonc`. `GRAPHCODE_CLIENT_LLM` entfällt
  (kein zweiter Schalter für dieselbe Frage); das Scaffold schreibt die Variable nicht mehr.

## Vor dem ersten Zug vom Autor zu entscheiden

1. **Eine Kette oder zwei für A?** Die Kettenregel verlangt Anfang und Ende an einem Akteur. Kette A tritt am
   Nutzer aus und am Gate wieder ein. Als eine Kette trägt sie die Rückkopplung über den Store; als zwei wäre
   sie „Zug prüfen und speichern" und „messen und vorschlagen".
2. **Vertrag des Vorschlags.** Vorschlag: derselbe Vertrag wie die Gate-Antwort (das Feld reist dort), kein neuer.
3. **Die drei Helfer.** Vorschlag: als Teil ihres Aufrufers führen und aus der Kette nehmen. Ob R-31 dann
   schweigt, zeigt der Trockenlauf — vor dem Schreiben prüfen.
4. **Block für Kette B.** Fünf der sieben blocklosen Glieder wandern nach B. Eigener Block „Executor, geparkt"?

## Entscheidungen des Autors (2026-10-09)

1. Kette A ist **eine** Kette. 2. Der Vorschlag trägt den Vertrag der Gate-Antwort. 3. Helfer werden Teil ihres
Aufrufers. 4. Der Executor bekommt einen eigenen, als geparkt bezeichneten Block.

## Stand 2026-10-09: Teil 1 (Modell) umgesetzt

graphVersion 653 → 656, drei Züge. `graph_metrics`: Kette A bewertbar, Länge 4, **eine** Rückkopplung; 23 von
25 Ketten bewertbar. Modell-Spur grün.

| Was | Wie |
|---|---|
| Vorschlag | neue Funktion `FUNC-vorschlag`, gebunden an `vorschlagNachAnwendung`; erfüllt `REQ-recommend-next-step`, die bisher niemand erfüllte |
| Schluss der Schleife | Store und Regelprüfung sind Glieder; zwei neue Flüsse (Schritt → Vorschlag → Nutzer), Verträge: `SCHEMA-generation-step` und `SCHEMA-mutate-result` |
| Kette B | `FCHAIN-executor-loop`, 21 Glieder. Schritt, Gate, Fit-Bewertung und Snapshot teilt sie mit Kette A — sonst meldet R-21 zwei Übergaben ohne gemeinsame Kette |
| Block | `FUNC-block-antrieb` WAR schon der Executor-Block; er ist jetzt als geparkt beschrieben und nimmt die blocklosen Glieder auf. Kein zweiter Block daneben. Darunter neu `FUNC-block-modelldraht` (vier Funktionen), damit der Block bei neun Kindern bleibt |
| Faltung, Fund-Kontext | in `FUNC-inventory-channel` aufgegangen (Merge) |

**Abweichungen vom Vorschlag, mit Grund:**

- **Helfer als Kind des Aufrufers geht nicht.** Der Trockenlauf meldet dann vier neue Befunde (R-30 Funktion in
  keiner Kette ×2, FC-03 verschachtelte Kette, RD-05). Der Merge ist befundfrei. **Preis:** `src/loop/faltung.ts`
  und `src/loop/fund-kontext.ts` sind an keine Funktion mehr gebunden; ändert sich eine der beiden, fällt die
  Code-Spur auf den Volllauf zurück.
- **Dublettensuche bleibt ein eigener Knoten.** Der Merge in den Gate-Client ist illegal (R-18: zwei Module —
  die Funktion liegt im Messwerk, ihr Aufrufer in der Schleife). Sie bräuchte einen Fluss mit eigenem Vertrag;
  den gibt es im Code nur als TypeScript-Typ. Kette B bleibt deshalb nicht bewertbar (ein loses Glied).

## Teil 2 abgetrennt

Der Schalter für den Executor ist **CR-GC-772**. Grund: zusammen mit Teil 1 wären es zwölf Dateien, und beim
Lesen des Codes zeigte sich eine Entscheidung, die vorher nicht auf dem Tisch lag (je Repo oder je Client).

## Akzeptanz (Teil 1)

- Kette A ist bewertbar und trägt genau eine Rückkopplung: Gate → Store → Messen. **Erfüllt.**
- Jeder neue Fluss nennt seinen Code-Beleg; kein neuer Regelverstoß gegenüber dem Stand davor. **Erfüllt.**
- `docs/project/steuerungsschleife.md` nennt, was noch abweicht. **Erfüllt.**
- `npm run verify:full CR-GC-770` vor dem Schließen.

---

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
