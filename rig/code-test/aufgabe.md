# Aufgabe: der Scheduler für die Nachtaufträge von SIG Local

Beide Arme bekommen genau diesen Text und `vertrag/contract.ts`. Hintergrund ist der Auftrag
`material/auftrag.md` (SIG Local). Gebaut wird **nur** der Teil, der wiederkehrende Aufgaben
zuverlässig ausführt. Inferenz, Werkzeuge, Benachrichtigungskanal und Ablageziel liegen hinter den
Ports des Vertrags und sind nicht Teil der Aufgabe.

## Was gebaut wird

Ein TypeScript-Paket (Node ≥ 20, ESM). `src/index.ts` exportiert
`createScheduler: CreateScheduler` aus `vertrag/contract.ts`. Aufbau, Module, Persistenzformat
und eigene Tests sind dir überlassen. Laufzeit-Abhängigkeiten nur, wenn du sie begründen kannst.

## Verhalten

1. **Termine.** Eine Aufgabe mit `everyMinutes = n` hat ihre Termine auf allen ganzzahligen
   Vielfachen von n Minuten ab der Unix-Epoche (UTC). Ein Termin ist fällig, sobald `clock.now()`
   ihn erreicht hat.
2. **Erster Start.** Beim allerersten Tick eines Zustandsverzeichnisses gilt je Aufgabe nur der
   jüngste fällige Termin. Ältere gelten nicht als versäumt.
3. **Normalbetrieb.** Ist seit dem letzten Tick genau ein Termin fällig geworden, läuft er,
   unabhängig von der Nachholregel.
4. **Nachholen.** Sind seit dem letzten Tick mehrere Termine fällig geworden (der Rechner schlief,
   war aus, der Strom fiel aus), entscheidet `catchUp`:
   - `all`: jeder Termin läuft, ältester zuerst.
   - `latest`: nur der jüngste läuft; die älteren werden als `skipped` nachgewiesen.
   - `none`: keiner läuft; alle werden als `skipped` nachgewiesen. Der nächste Termin läuft normal.
5. **Nie zweimal.** Ein Termin, der `succeeded` oder `dead-letter` erreicht hat, läuft nie wieder.
   Das gilt über Ticks, Neustarts und Umzüge hinweg.
6. **Prüfen und Wiederholen.** Jede Ausgabe wird mit `validator` geprüft. Wirft der Runner, ist der
   Versuch `failed`; fällt die Prüfung durch, ist er `invalid`. Danach folgt im selben Tick der
   nächste Versuch, bis `maxAttempts` erreicht ist. Scheitert auch der letzte, wird der Termin
   `dead-letter`: Es gibt einen eigenen Nachweis mit diesem Status, `notifier.notify` wird genau
   einmal gerufen, und der Termin gilt als erledigt.
7. **Netz.** Eine Aufgabe mit `requiresNetwork` wird offline nicht bearbeitet; ihre fälligen
   Termine bleiben offen. Beim ersten Tick am Netz werden sie sofort bearbeitet, nach der
   Nachholregel wie in Punkt 3 und 4.
8. **Nachweis.** Jeder Versuch ergibt einen `RunRecord` mit Aufgabe, Termin, Versuch, Status,
   `instructionVersion` und, sobald der Runner geantwortet hat, `model`. `history()` liefert alle
   Nachweise des Zustandsverzeichnisses in Reihenfolge, auch die früherer Instanzen.
9. **Zustand.** Dauerhafter Zustand liegt ausschließlich unter `stateDir`. Ein Neustart ist eine
   neue Instanz mit demselben Verzeichnis. Ein Umzug heißt, das Verzeichnis zu kopieren. Beides
   verliert nichts und wiederholt nichts.
10. **Aufgaben sind Daten.** Eine neue Aufgabe ist ein weiterer Eintrag in `tasks`, keine
    Codeänderung. Aufgaben sind voneinander unabhängig.

## Abnahme

Eine verdeckte Abnahme prüft Punkt 1–10 über den Vertrag. Deine eigenen Tests zählen zusätzlich.
Bewertet wird außerdem die Architektur des Codes: Zerlegung, Grenzen, Kopplung.
