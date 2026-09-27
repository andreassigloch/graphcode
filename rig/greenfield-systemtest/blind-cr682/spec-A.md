# Spec A

**System SYS-sig-local** — Eigene LLM-Rechenkapazitaet im internen Netz, vollstaendig lokal: tagsueber interaktiv bedient, nachts selbstaendig arbeitend, unterwegs lokal.

## Akteure

- **ACTOR-device** — Ein Gerät, das den lokalen Modus nutzt, wenn kein Netzwerk verfügbar ist.
- **ACTOR-scheduler** — Ein externer Dienst, der geplante Aufträge auslöst.
- **ACTOR-system** — Das System selbst, das Aufgaben erledigt und Ergebnisse produziert.
- **ACTOR-user** — Ein menschlicher Nutzer, der interaktiv mit dem System kommuniziert.

## Use Cases mit ihren Anforderungen

### UC-interactive-session — Interaktive Sitzung

Ein Nutzer bedient das System interaktiv tagsueber.

- **REQ-login-dauer** (non-functional) — Das System muss die Anmeldung innerhalb einer Zielzeit abschliessen; Zielwert offen, beim Auftraggeber erfragt.
  - erfüllt von: FCHAIN-session
  - Test **TEST-login-dauer**: Anmeldung messen, p95 unter Zielzeit.
- **REQ-login-passwort** (functional) — Das System muss Nutzer per Passwort in unter 2 s anmelden.
  - erfüllt von: FCHAIN-login, FUNC-login-pruefen
  - Test **TEST-login-passwort**: Lastlauf misst p95 der Anmeldung, Grenze 2 s.
- **REQ-session-ueberwachung** (functional) — Das System muss die aktive Zeit jedes Benutzers protokollieren.
  - erfüllt von: FCHAIN-session
  - Test **TEST-session-ueberwachung**: Benutzer aktiv, Zeit protokollieren, prüfen.
- **REQ-session-zeitraum** (non-functional) — Das System muss eine interaktive Sitzung mindestens 8 Stunden lang aktiv halten.
  - erfüllt von: FCHAIN-session
  - Test **TEST-session-zeitraum**: Session aktiv halten, Zeit messen, Grenze 8 h.
- Wirkketten: FCHAIN-session

### UC-local-offline — Lokaler Offline-Modus

Ein Rechner verwendet die lokale Instanz unterwegs.

- **REQ-offline-dauer** (non-functional) — Das System muss den lokalen Modus mindestens 7 Tage ohne Netzverbindung unterstützen.
  - erfüllt von: FCHAIN-offline
  - Test **TEST-offline-dauer**: Offline-Modus aktiv, 7 Tage testen, Netzverbindung unterbrechen.
- **REQ-offline-ueberwachung** (functional) — Das System muss den Offline-Modus aktiv überwachen und protokollieren.
  - erfüllt von: FCHAIN-offline
  - Test **TEST-offline-ueberwachung**: Offline-Modus aktiv, Protokoll prüfen.
- Wirkketten: FCHAIN-offline

### UC-login — Anmeldung

Ein Benutzer meldet sich mit Passwort an.

- **REQ-login-dauer** (non-functional) — Das System muss die Anmeldung innerhalb einer Zielzeit abschliessen; Zielwert offen, beim Auftraggeber erfragt.
  - erfüllt von: FCHAIN-session
  - Test **TEST-login-dauer**: Anmeldung messen, p95 unter Zielzeit.
- **REQ-login-passwort** (functional) — Das System muss Nutzer per Passwort in unter 2 s anmelden.
  - erfüllt von: FCHAIN-login, FUNC-login-pruefen
  - Test **TEST-login-passwort**: Lastlauf misst p95 der Anmeldung, Grenze 2 s.
- Wirkketten: FCHAIN-login

### UC-scheduled-task — Nachtlauf

Ein Auftrag wird nachts automatisch ausgefuehrt.

- **REQ-scheduled-fehlerbehandlung** (functional) — Das System muss bei Fehlern in einem Nachtlauf den Fehler protokollieren und weitermachen.
  - erfüllt von: FCHAIN-scheduled
  - Test **TEST-scheduled-fehlerbehandlung**: Nachtlauf mit Fehler, Fehler protokollieren, weitermachen.
- **REQ-scheduled-zeitplan** (functional) — Das System muss wiederkehrende Aufgaben nach einem definierten Zeitplan ausführen.
  - erfüllt von: FCHAIN-scheduled
  - Test **TEST-scheduled-zeitplan**: Nachtlauf starten, Zeitplan prüfen, Aufgabe ausführen.
- Wirkketten: FCHAIN-scheduled

### UC-scheduled-task-arbeitstagebuch — Arbeitstagebuch

Ein Benutzer fasst seinen Arbeitstag zusammen.

- **REQ-scheduled-arbeitstagebuch-auftrag** (functional) — Das System muss einen Nachtlauf zur Erstellung eines Arbeitstagebuchs deklarieren koennen.
  - erfüllt von: FUNC-accept-scheduled-task
  - Test **TEST-scheduled-arbeitstagebuch-auftrag**: Nachtlauf fuer Arbeitstagebuch deklarieren, Zeit messen, Grenze 10 s.
- **REQ-scheduled-arbeitstagebuch-dauer** (non-functional) — Das System muss einen Nachtlauf zur Erstellung eines Arbeitstagebuchs in unter 10 s abschliessen.
  - erfüllt von: FCHAIN-scheduled
  - Test **TEST-scheduled-arbeitstagebuch-dauer**: Nachtlauf fuer Arbeitstagebuch ausfuehren, Zeit messen, Grenze 10 s.
- **REQ-scheduled-arbeitstagebuch-nachholen** (functional) — Das System muss jeden ausgefallenen Arbeitstagebuch-Tag nachholen.
  - erfüllt von: FCHAIN-scheduled
  - Test **TEST-scheduled-arbeitstagebuch-nachholen**: 5 Tage ausfallen lassen, 6. Tag muss nachgeholt werden.
- Wirkketten: FCHAIN-scheduled

### UC-scheduled-task-erreichbarkeit — Erreichbarkeitsprüfung

Ein Benutzer prüft die Erreichbarkeit seiner Server.

- **REQ-scheduled-erreichbarkeit-auftrag** (functional) — Das System muss einen Nachtlauf zur Erreichbarkeitspruefung deklarieren koennen.
  - erfüllt von: FUNC-accept-scheduled-task
  - Test **TEST-scheduled-erreichbarkeit-auftrag**: Nachtlauf fuer Erreichbarkeit deklarieren, Zeit messen, Grenze 15 min.
- **REQ-scheduled-erreichbarkeit-nachholen** (functional) — Das System muss ausgefallene Erreichbarkeitspruefungen nachholen, sobald der Rechner wieder im Netz ist.
  - erfüllt von: FCHAIN-scheduled
  - Test **TEST-scheduled-erreichbarkeit-nachholen**: Rechner ausfallen lassen, wieder online, Pruefung muss nachgeholt werden.
- **REQ-scheduled-erreichbarkeit-zeitplan** (non-functional) — Das System muss einen Nachtlauf zur Erreichbarkeitspruefung alle 15 min ausfuehren.
  - erfüllt von: FCHAIN-scheduled
  - Test **TEST-scheduled-erreichbarkeit-zeitplan**: Nachtlauf fuer Erreichbarkeit alle 15 min ausfuehren, Zeit messen, Grenze 15 min.
- Wirkketten: FCHAIN-scheduled

### UC-sig-local-durchspezifizieren — Durchspezifizierung

Das System muss SIG Local durchspezifizieren, um danach bauen zu koennen.

- **REQ-sig-local-durchspezifizieren-login** (functional) — Das System muss Nutzer per Passwort in unter 2 s anmelden.
  - erfüllt von: FUNC-login-pruefen
  - Test **TEST-sig-local-durchspezifizieren-login**: Anmeldung mit gültigem Passwort, Zeit gemessen, Grenze 2 s.
- **REQ-sig-local-durchspezifizieren-offline-ueberwachung** (functional) — Das System muss den Offline-Modus überwachen und nach Wiederherstellung Aufträge nachholen.
  - erfüllt von: FUNC-accept-offline-request
  - Test **TEST-sig-local-durchspezifizieren-offline-ueberwachung**: Offline-Modus überwachen, nach Wiederherstellung Aufträge nachholen.
- **REQ-sig-local-durchspezifizieren-scheduled-auftrag** (functional) — Das System muss wiederkehrende Aufträge deklarieren und ausführen können.
  - erfüllt von: FCHAIN-scheduled
  - Test **TEST-sig-local-durchspezifizieren-scheduled-auftrag**: Wiederkehrenden Auftrag deklarieren und ausführen.
- **REQ-sig-local-durchspezifizieren-scheduled-fehlerbehandlung** (functional) — Das System muss bei fehlgeschlagenen Aufträgen Fehler protokollieren und erneut versuchen.
  - erfüllt von: FCHAIN-scheduled
  - Test **TEST-sig-local-durchspezifizieren-scheduled-fehlerbehandlung**: Fehlgeschlagenen Auftrag protokollieren und erneut versuchen.
- **REQ-sig-local-durchspezifizieren-session-aktivitaet** (functional) — Das System muss die aktive Zeit jedes Benutzers protokollieren.
  - erfüllt von: FCHAIN-session
  - Test **TEST-sig-local-durchspezifizieren-session-aktivitaet**: Aktivitätsprotokoll prüfen, ob Benutzeraktivitäten erfasst werden.
- **REQ-sig-local-durchspezifizieren-session-ueberwachung** (functional) — Das System muss aktive Sitzungen überwachen und bei Bedarf beenden.
  - erfüllt von: FUNC-accept-interactive-request
  - Test **TEST-sig-local-durchspezifizieren-session-ueberwachung**: Aktive Sitzung überwachen, bei Bedarf beenden.
- **REQ-sig-local-durchspezifizieren-session-ueberwachung-dauer** (non-functional) — Das System muss die Session-Überwachung in unter 1 s durchführen.
  - erfüllt von: FCHAIN-session
  - Test **TEST-sig-local-durchspezifizieren-session-ueberwachung-dauer**: Lastlauf misst p95 der Session-Überwachung, Grenze 2 s.
  - Test **TEST-verify-sig-local-durchspezifizieren-session-ueberwachung-dauer**: it.todo: Prüfe "Session-Überwachungsdauer" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- Wirkketten: FCHAIN-session

### UC-sig-local-durchspezifizieren-offline-ueberwachung — Offline-Modus überwachen

Das System muss den Offline-Modus aktiv überwachen und protokollieren.

- **REQ-sig-local-durchspezifizieren-offline-ueberwachung-dauer** (non-functional) — Das System muss den Offline-Modus innerhalb von 100 ms überwachen.
  - erfüllt von: SYS-sig-local
  - Test **TEST-sig-local-durchspezifizieren-offline-ueberwachung-dauer**: Offline-Überwachungsdauer messen, Grenze 100 ms.
- **REQ-sig-local-durchspezifizieren-offline-ueberwachung-protokollierung** (functional) — Das System muss alle Offline-Überwachungsereignisse protokollieren.
  - erfüllt von: FUNC-accept-offline-request
  - Test **TEST-sig-local-durchspezifizieren-offline-ueberwachung-protokollierung**: Protokoll der Offline-Überwachung prüfen.
- Wirkketten: FCHAIN-offline

### UC-sig-local-durchspezifizieren-scheduled-auftrag — Erreichbarkeit pruefen

Das System muss einen Nachtlauf zur Erreichbarkeitspruefung deklarieren koennen.

- **REQ-sig-local-durchspezifizieren-scheduled-auftrag-dauer** (non-functional) — Das System muss einen Nachtlauf in unter 30 Sekunden abschließen.
  - erfüllt von: FCHAIN-scheduled
  - Test **TEST-sig-local-durchspezifizieren-scheduled-auftrag-dauer**: Nachtlauf ausführen, Dauer messen, Grenze 30 s.
- **REQ-sig-local-durchspezifizieren-scheduled-auftrag-deklaration** (functional) — Das System muss einen Nachtlauf zur Erreichbarkeitsprüfung deklarieren können.
  - erfüllt von: FUNC-accept-scheduled-task
  - Test **TEST-sig-local-durchspezifizieren-scheduled-auftrag-deklaration**: Nachtlauf deklarieren, prüfen ob erfolgreich.
- Wirkketten: FCHAIN-scheduled

### UC-sig-local-durchspezifizieren-scheduled-fehlerbehandlung — Fehler in Nachtlauf behandeln

Das System muss Fehler in Nachtlauf-Aufgaben erkennen und behandeln.

- **REQ-sig-local-durchspezifizieren-scheduled-fehlerbehandlung-behandlung** (functional) — Das System muss Fehler in Nachtlauf-Aufgaben behandeln.
  - erfüllt von: FCHAIN-scheduled
  - Test **TEST-sig-local-durchspezifizieren-scheduled-fehlerbehandlung-behandlung**: Fehler in Nachtlauf erzeugen, prüfen ob behandelt.
- **REQ-sig-local-durchspezifizieren-scheduled-fehlerbehandlung-erkennung** (functional) — Das System muss Fehler in Nachtlauf-Aufgaben erkennen.
  - erfüllt von: FUNC-accept-scheduled-task
  - Test **TEST-sig-local-durchspezifizieren-scheduled-fehlerbehandlung-erkennung**: Fehler in Nachtlauf erzeugen, prüfen ob erkannt.
- Wirkketten: FCHAIN-scheduled

### UC-sig-local-durchspezifizieren-session-ueberwachung — Benutzeraktivität protokollieren

Das System muss die aktive Zeit jedes Benutzers protokollieren.

- **REQ-sig-local-durchspezifizieren-session-aktivitaet** (functional) — Das System muss die aktive Zeit jedes Benutzers protokollieren.
  - erfüllt von: FCHAIN-session
  - Test **TEST-sig-local-durchspezifizieren-session-aktivitaet**: Aktivitätsprotokoll prüfen, ob Benutzeraktivitäten erfasst werden.
- **REQ-sig-local-durchspezifizieren-session-ueberwachung-dauer** (non-functional) — Das System muss die Session-Überwachung in unter 1 s durchführen.
  - erfüllt von: FCHAIN-session
  - Test **TEST-sig-local-durchspezifizieren-session-ueberwachung-dauer**: Lastlauf misst p95 der Session-Überwachung, Grenze 2 s.
  - Test **TEST-verify-sig-local-durchspezifizieren-session-ueberwachung-dauer**: it.todo: Prüfe "Session-Überwachungsdauer" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-sig-local-durchspezifizieren-session-zeitraum** (functional) — Das System muss die Session-Zeitraum-Informationen in einem Protokoll speichern.
  - erfüllt von: FCHAIN-session
  - Test **TEST-sig-local-durchspezifizieren-session-zeitraum**: Protokoll prüfen, ob Session-Zeitraum-Informationen gespeichert sind.
- Wirkketten: FCHAIN-session

## Wirkketten

### FCHAIN-login — Anmelde-Kette

Anmelde-Kette

- FUNC-login-pruefen: Prüft die Anmeldedaten des Benutzers.

### FCHAIN-offline — Offline-Kette

Funktionale Kette fuer den lokalen Offline-Modus.

- FUNC-accept-offline-request: Nimmt die Offline-Anfrage entgegen.

### FCHAIN-scheduled — Nachtlauf-Kette

Funktionale Kette fuer den Nachtlauf.

- FUNC-accept-scheduled-task: Nimmt den geplanten Auftrag entgegen.

### FCHAIN-session — Session-Kette

Funktionale Kette fuer die interaktive Sitzung.

- FUNC-accept-interactive-request: Nimmt die interaktive Anfrage entgegen.

## Flüsse und Verträge

- **FLOW-interactive-session** (ACTOR-user → FUNC-accept-interactive-request; Vertrag SCHEMA-interactive-request): Interaktive Sitzung des Benutzers mit dem System
- **FLOW-local-offline** (ACTOR-device → FUNC-accept-offline-request; Vertrag SCHEMA-offline-request): Lokaler Offline-Modus
- **FLOW-login** (ACTOR-user → FUNC-login-pruefen; Vertrag SCHEMA-login): Anmeldung des Benutzers an das System
- **FLOW-scheduled-task** (ACTOR-scheduler → FUNC-accept-scheduled-task; Vertrag SCHEMA-scheduled-task): Geplanter Nachtlauf
- Vertrag **SCHEMA-interactive-request**: Form der Anfrage: Text und Sitzungs-ID
- Vertrag **SCHEMA-login**: Form der Anmeldung: Benutzername und Passwort
- Vertrag **SCHEMA-offline-request**: Form der Anfrage: Text und Sitzungs-ID
- Vertrag **SCHEMA-scheduled-task**: Form des Auftrags: Task-Definition und Zeitstempel

## Module

