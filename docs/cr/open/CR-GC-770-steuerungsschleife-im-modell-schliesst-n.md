# CR-GC-770: Steuerungsschleife im Modell: schliesst nicht, Vorschlag fehlt, mit geparktem Executor vermischt

**Status:** 🟠 Open
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

## Schnitt in zwei Teile (Dateigrenze)

- **Teil 1, Modell:** nur `graph_mutate`; Dateien: Graph, Sichten, `docs/project/steuerungsschleife.md`.
- **Teil 2, Schalter:** `src/surface/tool-profile.ts`, `src/surface/mcp-server.ts`, `src/surface/scaffold-templates.ts`,
  Konfigurationsvertrag, README, zwei Testdateien. Ändert, wie ein Repo den Executor wählt — bestehende
  Host-Dateien mit der alten Variable müssen benannt behandelt werden (kein stilles Weiterlesen).

Werden es zusammen mehr als 10 Dateien, wird Teil 2 eine eigene CR.

## Akzeptanz

- Kette A ist bewertbar (`graph_metrics`, `chains`) und trägt genau eine Rückkopplung: Gate → Store → Messen.
- Jeder neue Fluss nennt seinen Code-Beleg; kein neuer Regelverstoß gegenüber dem Stand davor.
- `docs/project/steuerungsschleife.md`: der Abschnitt „Wo das eigene Modell abweicht" ist leer oder nennt, was bleibt.
- Teil 2: Rot zuerst; ein Repo mit alter Variable startet mit einer Meldung, die den neuen Schalter nennt.
- `npm run verify:code`, vor dem Schließen `npm run verify:full CR-GC-770`.

---

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
