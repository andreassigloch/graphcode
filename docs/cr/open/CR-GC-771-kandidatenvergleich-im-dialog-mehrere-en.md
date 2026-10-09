# CR-GC-771: Kandidatenvergleich im Dialog: mehrere Entwuerfe per Trockenlauf vergleichen, auch fuer Frontier

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-801 (idea)
**Erstellt:** 2026-10-09
**Item:** bok/items/ITEM-2026-801.json (Lane: code)
**Priorität:** 2 (Autor, 2026-10-09) — zuerst die Wirkkettenanalyse und ihre Maßnahmen; von dort kommt voraussichtlich der erste echte Anwendungsfall für den Vergleich.
**Hinweis (2026-10-09):** Der Executor ist ausgelagert (CR-GC-775). Die Rangfolge `rankCandidates` und Best-of-N liegen an der Marke `executor-geparkt-2026-10-09`; der Ist-Stand unten beschreibt Stelle 1 als Geschichte.

---

## Frage des Autors

Warum gibt es den Kandidatenvergleich nur im Executor? Kann er auch im Dialog mit einem Frontier-Modell
helfen — zumindest als Prinzip? Vor jedem Bau ist zu klären: **wie wird er ausgelöst, woher kommen die
Kandidaten, wie wird bewertet.**

## Ist-Stand: drei Stellen, die Kandidaten vergleichen

### 1. Best-of-N im Executor (geparkt)

| | |
|---|---|
| Auslöser | `executor.candidates` > 1 in der Konfiguration. Voreinstellung 1. Im interaktiven Modus gesperrt (`runExecutor` wirft bei `interactive` und `candidates` > 1) — lief also nur im autonomen `graphcode run`. |
| Herkunft der Kandidaten | N unabhängige Antworten **desselben Modells auf denselben Runden-Prompt**, je eigene Nachrichtenhistorie. Lokal mit gespreizter Temperatur (0,15 / 0,4 / 0,7); bei Anthropic N Aufrufe ohne Temperatur. Je Kandidat genau EIN Batch für dasselbe Fokus-Fenster. |
| Probe | Vorprüfung (Auto-Korrekturen, Dublettensuche), dann `graph_mutate` mit `dryRun: true`. |
| Bewertung | `rankCandidates` (`src/loop/executor-rank.ts`), in dieser Reihenfolge: (1) nicht abgelehnt · (2) Befund-Delta der Fokus-Stufe, um den Dublettenanteil gekürzt · (3) kein Anstieg blockierender Fehler · (4) entfernt keine Elemente · (5) Verbesserung des Steuerwerts der fünf Kopplungsregeln · (6) Zahl der Mutationen · (7) übernommen vor übernommen-mit-Hinweis · (8) Index. |
| Richter | `judge: gate` (deterministisch, Voreinstellung) oder `judge: model` (das Modell wählt aus den gerenderten Urteilen; Abweichung zum Algorithmus wird gezählt). |
| Sind alle abgelehnt | Die Rückmeldung des besten geht ans Modell zurück, der reparierte Kandidat wird neu geprobt und neu gerankt. |
| Gemessen | CR-GC-288, Lauf v16-bo3 (2026-08-01, devstral, N=3). Ein Vergleich N=1 gegen N=3 mit dem heutigen Modell liegt nicht vor. |

### 2. Das Prinzip im Host-Text (Claude Code, OpenCode)

| | |
|---|---|
| Auslöser | Nur der Text, den `graph_generate` zurückgibt: „Hast du mehrere Alternativen, reiche sie mit dryRun ein und vergleiche die Urteile … nur den besten Batch anwenden." Für die Stufen Funktion und Modul verlangt der Host-Text ausdrücklich zwei alternative Zerlegungen. |
| Herkunft | Der Agent soll die Alternativen selbst entwerfen. |
| Bewertung | Der Agent soll selbst vergleichen, nach derselben Rangfolge als Prosa (`decision('verdictRank')`). Nichts erzwingt es. |
| Was der Trockenlauf liefert | Urteil, Befunde je Stufe vorher/nachher, Architekturmaß, Steuerwert — alles, was die Rangfolge braucht. |
| Gemessen 2026-10-09 | Energy Manager Frontier: 77 Schreibaufrufe, 6 Trockenläufe, 0 Aufrufe von `graph_generate`. Lokal: 39 / 7 / 0. Der Agent sieht die Anweisung nie; der `vorschlag` nach dem Zug trägt nur den einen Satz. |
| Bekannte Falle | CR-GC-702: verlangt der Text zwei Alternativen und wählt niemand, landen beide im Modell (35 von 49 Anforderungen Dubletten). |

### 3. `graph_suggest` (Optimierung nach der Freigabe)

| | |
|---|---|
| Auslöser | Aufruf des Werkzeugs; die Schleife verweist darauf, wenn kein Fokus mehr offen ist. |
| Herkunft | Keine Modellantworten: deterministische Umbau-Operatoren (zusammenführen, umhängen, …) an den feuernden Regeln. |
| Bewertung | Rang nach Verbesserung des Steuerwerts, gerichtet durch das Zielprofil; das Gate prüft jeden Zug in der Probe. |
| Gemessen 2026-10-09 | Der einzige Zug auf graphcodes Modell: das Gate aus dem Kernel verlegen — fachlich falsch (ITEM-2026-798). |

## Was daraus folgt

- Der Vergleich ist kein Executor-Merkmal. Die Bewertung (Trockenlauf + Rangfolge) ist vom Modellaufruf
  unabhängig; nur das **Erzeugen** der Kandidaten hängt am Treiber.
- Im Dialog fehlen zwei Dinge: ein **Auslöser**, den der Agent tatsächlich sieht, und jemand, der **wählt**,
  bevor etwas gespeichert wird.

## Offene Fragen vor einem Bau

1. **Wann auslösen?** Vorschlag: nur an Strukturentscheidungen (Schnitt der Wirkketten, Funktionen, Module),
   nicht an jedem Zug. Der Preis ist N volle Modellantworten je Schritt: bei Frontier unter einer Minute je
   Zug, lokal rund neun.
2. **Wer erzeugt die Kandidaten?** (a) der Agent im Client, auf Aufforderung im `vorschlag`; (b) graphcode
   fordert sie über ein Werkzeug an, das N Batches annimmt und nur den Gewinner speichert.
3. **Wer wählt?** (a) der Agent nach Prosa-Rangfolge; (b) graphcode deterministisch mit `rankCandidates`;
   (c) der Nutzer, dem die Urteile nebeneinander gezeigt werden. Der Hauptfall heißt „der Nutzer entscheidet".
4. **Taugt die Rangfolge für Strukturfragen?** Sie zählt Befunde der Fokus-Stufe. Ob das zwischen zwei
   legalen Modulschnitten unterscheidet, ist ungeprüft; der Befund an `graph_suggest` spricht dagegen.

## Vorgehen

1. Spike, nichts am Produkt: an einer Aufgabe des Rigs (Energy Manager, Stufe Modul) drei Entwürfe von Hand
   per Trockenlauf proben. Regelkandidat vorab: die Rangfolge trennt die Entwürfe **und** ihr Gewinner ist der,
   den ein Blindurteil vorzieht. Gegenprobe: drei gleichwertige Entwürfe dürfen nicht getrennt werden.
2. Erst danach die Fragen 1 bis 3 entscheiden und die Umsetzung als eigene CR schneiden.

## Akzeptanz dieser CR

- Der Ist-Stand oben ist vom Autor gelesen und bestätigt oder korrigiert.
- Der Spike ist gefahren und sein Ergebnis steht hier: trennt die Rangfolge, ja oder nein, an wie vielen Fällen.
- Die Fragen 1 bis 4 sind entschieden.

---

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
