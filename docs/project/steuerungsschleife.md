# Die Steuerungsschleife

Stand 2026-10-09 · gelesen aus dem Code, nicht aus dem Modell · Arbeitsdokument, noch nicht abgenommen

Die Steuerungsschleife ist das Kernstück von graphcode: Nach jeder Änderung am Modell rechnet
graphcode aus, was als Nächstes fehlt, und sagt es dem Nutzer in einem Satz. Der Nutzer entscheidet,
der Agent schreibt, das Gate prüft, und die Rechnung beginnt von vorn.

Dieses Dokument beschreibt die Schleife so, wie sie heute läuft. Am Ende steht, wo die älteren
Darstellungen und das eigene Modell davon abweichen.

## Die Schleife in einem Bild

```
        ┌──────────────────────────────────────────────────────────────┐
        │                                                              │
        ▼                                                              │
  ① MESSEN          alle Regeln über den ganzen Graphen                │
        │           → Befunde je Stufe, Fokusmenge                     │
        ▼                                                              │
  ② FOKUS WÄHLEN    die früheste Stufe mit offenem Befund              │
        │           → eine Regel, höchstens drei Elemente              │
        ▼                                                              │
  ③ VORSCHLAGEN     ein Satz an den Nutzer                             │
        │           „Lege für die Abläufe … die Funktionen an."        │
        ▼                                                              │
  ④ ZUG             Nutzer schickt den Satz ab, ändert ihn             │
        │           oder schreibt etwas anderes; der Agent             │
        │           schreibt die Änderung                              │
        ▼                                                              │
  ⑤ GATE            neuer Fehler?  ──ja──▶ abgelehnt, nichts           │
        │                                  gespeichert, zurück zu ④    │
        │ nein                                                         │
        ▼                                                              │
     gespeichert ──────────────────────────────────────────────────────┘
```

Graphcode rechnet die Schritte ①, ② und ③ ohne Sprachmodell: gleicher Graph, gleiche Antwort.
Das Sprachmodell arbeitet nur in ④.

## Die fünf Schritte

### ① Messen

Graphcode wertet den vollen Regelkatalog über den ganzen Graphen aus. Das Ergebnis:

- **Befunde je Stufe.** Jede Regel gehört zu einer von zwölf Stufen, in dieser Reihenfolge: System,
  Anwendungsfall, Anforderung, Wirkkette, Funktion, Datenfluss, Modul, Schema, Test, Plan, Bindung,
  Abgleich.
- **Die Fokusmenge.** Das sind die Befunde, die die Steuerung überhaupt zeigt: nur Regeln, die auch
  das Gate kennt, keine reinen Hinweise, keine Befunde, die der Nutzer schon abgenommen hat.

Regeln der Stufen Bindung und Abgleich melden erst, wenn der Bau eröffnet ist, also sobald es einen
offenen Auftrag oder eine Bindung an Code gibt.

Code: `takeSteeringSnapshot` in `src/kernel/measure/steering-snapshot.ts`, Fokusmenge in
`src/kernel/measure/focus-set.ts`.

### ② Fokus wählen

Aus der Fokusmenge wählt graphcode genau ein Arbeitspaket, ein sogenanntes Fenster: eine Regel und
höchstens drei Elemente, an denen sie meldet. Die Rangfolge der Regeln:

1. die früheste Stufe zuerst,
2. in einer Stufe die Regel, die verlangt, dass es die Menge überhaupt gibt,
3. dann Fehler vor Warnungen,
4. dann Regeln mit Bauanleitung vor Regeln, die nur melden.

Je nach Zustand des Graphen ergibt das eine von vier Phasen:

| Phase | Wann | Was der Nutzer als Nächstes hört |
|---|---|---|
| Kaltstart | es gibt noch kein System | „Frag mich, was das System für wen leisten soll." |
| Ausbau | es gibt einen Fokus | der Satz der gewählten Regel |
| Freigabe | kein Fokus mehr | „Fasse das Modell zusammen — ich prüfe es und gebe es frei." |
| Festgefahren | nur noch zurückgestellte Befunde | „Zeig mir die offenen Regelhinweise und was du je Hinweis vorschlägst." |

Code: `generationStep` in `src/loop/generate.ts`.

### ③ Vorschlagen

Aus dem Fenster wird ein Satz, den der Nutzer so an den Agenten schicken kann. Der Wortlaut steht je
Regel im Regelkatalog; graphcode setzt nur die Namen der betroffenen Elemente ein.

Der Satz reist als Feld `vorschlag` in der Antwort auf jede angewandte Änderung. Im Client landet er
im Eingabefeld. Er richtet sich an den Nutzer, nicht an den Agenten.

Code: `vorschlagNachAnwendung` in `src/loop/next-step.ts`, aufgerufen in `src/surface/write.ts`.

### ④ Zug

Der Nutzer schickt den Vorschlag ab, ändert ihn oder schreibt etwas anderes. Der Agent setzt den
Auftrag in eine Modelländerung um und schickt sie mit `graph_mutate` an das Gate.

Hier liegt der einzige Unterschied zwischen den beiden Clients (siehe unten).

### ⑤ Gate

Das Gate prüft die Änderung gegen den Stand davor und urteilt in drei Stufen:

| Urteil | Bedingung | Folge |
|---|---|---|
| abgelehnt | die Änderung führt einen neuen Fehler ein | nichts wird gespeichert; die Antwort nennt den Fehler |
| übernommen mit Hinweis | sie führt eine neue Warnung ein | gespeichert; die Warnung steht in der Antwort |
| übernommen | sonst | gespeichert |

Fehler, die schon vorher im Graphen standen, halten eine Änderung nicht auf. Nach dem Speichern
läuft ① neu.

Code: `apply` in `src/kernel/gate.ts`.

## Was blockt und was nur misst

| | Kann eine Änderung ablehnen | Wirkt auf die Schleife |
|---|---|---|
| Regel mit Fehler-Schwere | ja, das einzige Veto | über das Gate |
| Regel mit Warnung | nein | bestimmt den Fokus in ② |
| Architekturmaß (sechs Zahlen) | nein | steht in der Antwort: vorher, nachher, Verschlechterungen beim Namen |
| Steuerwert der fünf Kopplungsregeln | nein | steht in der Antwort; am lokalen Optimum verlassen diese Regeln den Fokus |
| Marken SRR, PDR, CDR, TRR, Bau | nein | Bericht in `graph_readiness`; die Schleife wählt nicht nach ihnen |

Die Marken sind Schwellen auf den Stufen: SRR nach Stufe 4, PDR nach 7, CDR nach 8, TRR nach 9, Bau
nach 12.

## Was die Schleife sich merkt

Das Gedächtnis gehört der Sitzung, nicht dem Graphen. Es hält drei Dinge:

- **Zurückgestellte Fenster.** Kommt nach einer angewandten Änderung derselbe Fokus wieder, hat der
  Zug ihn nicht gelöst. Beim dritten Mal stellt graphcode das Fenster zurück und nimmt das nächste.
- **Den laufenden Arbeitsschritt.** Neben dem Kern gibt es Analysen mit eigenem Eintrittspunkt:
  Einsatzkonzept, Variantenvergleich, Schnittstellen-Review, Fehlerbetrachtung, Bauplan. Steht ein
  solcher Eintrittspunkt im Fokus, heißt der Vorschlag „Führe … durch." Er wird zweimal genannt,
  als Auftrag und als Frage nach dem Stand, danach geht die Schleife weiter.
- **Das lokale Optimum der Kopplungsregeln.** Bewegt sich ihr Steuerwert über mehrere Züge nicht
  mehr, gelten sie als ausgereizt.

Code: `src/loop/stagnation.ts`.

## Zwei Clients, eine Schleife

| | Frontier | Lokal |
|---|---|---|
| Client | Claude Code | OpenCode |
| Modell | Claude | qwen3.8 mit Denkstufe |
| Schreibweg | `graph_mutate` | `graph_mutate` |
| Führung | derselbe `vorschlag` | derselbe `vorschlag` |
| Eigene Zutat in ④ | keine | Agent `modellieren` mit Vorbild-Prompt und enger Werkzeugauswahl |

Die Kopplung von Modell und Client ist eine Entscheidung des Autors (2026-09-28): Claude Code gegen
ein lokales Modell kostet zu viel Kontext, OpenCode mit dem Claude-Abo ist nicht erlaubt.

**Geparkt seit 2026-10-03:** der Executor im Host. Auf diesem Weg gab der lokale Client die
Modellarbeit an eine eingebaute Treiberschleife ab, die selbst das Modell rief, mehrere Kandidaten
bewertete und den besten ans Gate gab. Seit das Denk-Modell direkt durchs Gate schreibt, wird der
Weg nicht mehr gemessen. Er ist über `GRAPHCODE_CLIENT_LLM=local` weiter wählbar (CR-GC-769).

## Abgleich mit den älteren Darstellungen

| Darstellung | Stimmt noch | Veraltet |
|---|---|---|
| `img/rule-kpi-loop.svg` (2026-08-05) | Der Vier-Schritte-Kreis; „Regel ist das einzige Veto, Kennzahl blockt nie" | Vier Phasen-Gates, heute fünf Marken; „schwächste Stelle" als Prozentwert, heute die früheste Stufe mit Befund; die Zahlen im Bild |
| `img/measurement-landscape.svg` (2026-08-15) | Die Trennung: Gate kann blocken, Auswahl und Anzeige messen nur | „Fokus: schwächste Dimension unter der Schwelle", heute Stufenreihenfolge ohne Schwelle; acht Themen, heute zwölf Stufen; der Rang über Kandidaten gehört zum geparkten Executor |
| `05-the-advisory-roundtrip.md` | Lesen, Status, Vorschlagen, Anwenden, Messen als Antwort auf eine Frage; Gate urteilt, Berater misst | Die Spalte „Driver (built-in executor)" beschreibt den geparkten Weg; der `vorschlag` nach jedem Zug kommt nicht vor |

Keine der drei zeigt die heutige schließende Kante: den Vorschlag an den Nutzer nach jeder
angewandten Änderung.

## Wo das eigene Modell von diesem Dokument abweicht

Die Kette `FCHAIN-steering-loop` im graphcode-Modell bildet die Schleife nicht ab:

| Befund | Beleg |
|---|---|
| Die Schleife schließt im Modell nicht. Vom Gate führt kein Weg zurück zum Messen; Store und Regelprüfung sind keine Glieder. | Erreichbarkeit im Graphen, 2026-10-09 |
| Schritt ③ fehlt. Keine Funktion ist an `src/loop/next-step.ts` gebunden. | Bindungen im Graphen |
| Die Kette mischt die Schleife mit dem geparkten Executor. Die Stufe „Kandidaten bewerten" gibt es nur dort. | 31 Glieder, davon rund die Hälfte Executor |
| Sieben Glieder liegen außerhalb des Funktionsbaums. | kein übergeordneter Block |
| Drei Helfer ohne eigenen Vertrag halten die Kette unbewertbar. | Regel R-31 |

## Offene Fragen an den Autor

1. **Soll-Schnitt im Modell:** eine Kette mit genau den fünf Schritten oben, über Gate, Store,
   Messen, Fokus, Vorschlag; der Executor als eigene, geparkte Kette?
2. **Der Zug des Nutzers** läuft über einen Akteur außerhalb des Systems. Nach der Kettenregel endet
   eine Kette am Akteur. Gilt die Schleife dann als eine Kette, die am Nutzer aus- und wieder
   eintritt, oder als zwei?
3. **Die Marken stehen neben der Schleife.** Sie wählt nach Stufen, nicht nach Marken, und nennt sie
   dem Nutzer nicht. Ist das gewollt, oder soll der Vorschlag das Erreichen einer Marke melden?
4. **Die drei Darstellungen:** neu zeichnen oder durch dieses Dokument ersetzen?
