# Spec J

**System SYS-sig-local** — Eigene LLM-Rechenkapazitaet im internen Netz, vollstaendig lokal: tagsueber interaktiv bedient, nachts selbstaendig arbeitend, unterwegs lokal.

## Akteure

- **ACTOR-externer-service** — Ein externer Dienst, der SIG Local mit Daten oder Anweisungen versorgt.
- **ACTOR-nutzer** — Ein menschlicher Nutzer, der SIG Local interaktiv bedient.
- **ACTOR-rechner** — Ein Rechner, der SIG Local offline bedient.
- **ACTOR-scheduler** — Ein externer Scheduler, der nächtliche Aufgaben an SIG Local auslöst.

## Use Cases mit ihren Anforderungen

### UC-externer-service-daten-empfangen — Daten empfangen

Externer Service sendet Daten an SIG Local.

- **REQ-externer-service-daten-empfangen** (functional) — Das System muss Daten von einem externen Service empfangen und verarbeiten koennen.
  - erfüllt von: —
  - Test **TEST-externer-service-daten-empfangen**: Ein externer Service sendet Daten an SIG Local, die empfangen und verarbeitet werden.
- **REQ-externer-service-daten-format** (functional) — Das System muss Daten im JSON-Format von externen Services empfangen koennen.
  - erfüllt von: —
  - Test **TEST-externer-service-daten-format**: JSON-Daten von externem Service werden empfangen und validiert.
- **REQ-externer-service-daten-zeit** (non-functional) — Das System muss Daten innerhalb von 5 Sekunden nach Empfang verarbeiten.
  - erfüllt von: —
  - Test **TEST-verify-externer-service-daten-zeit**: it.todo: Prüfe "Verarbeitungszeit fuer externe Daten" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- Wirkketten: FCHAIN-interactive-login

### UC-interactive-anmeldung — Anmeldung

Nutzer meldet sich interaktiv an.

- **REQ-login-dauer** (non-functional) — Das System muss die Anmeldung innerhalb einer Zielzeit abschliessen; Zielwert offen, beim Auftraggeber erfragt.
  - erfüllt von: FCHAIN-interactive-login
  - Test **TEST-login-dauer**: Letzter Lauf misst die Anmeldedauer, Grenze offen.
- **REQ-login-passwort** (functional) — Das System muss Nutzer per Passwort in unter 2 s anmelden.
  - erfüllt von: FUNC-interactive-login-pruefen
  - Test **TEST-login-passwort**: Anmeldung mit gueltigem Passwort, Zeit gemessen, Grenze 2 s.
- **REQ-login-sperre** (functional) — Das System muss nach 5 Fehlversuchen das Konto 15 min sperren.
  - erfüllt von: FUNC-interactive-login-erfolgreich, FUNC-interactive-login-pruefen
  - Test **TEST-login-sperre**: 5 Fehlversuche, 6. Versuch muss abgewiesen werden.
- Wirkketten: FCHAIN-interactive-login

### UC-interactive-nutzung — Interaktive Nutzung

Ein Nutzer bedient SIG Local interaktiv zur Aufgabenbearbeitung.

- **REQ-interactive-login** (functional) — Das System muss Nutzer interaktiv in unter 2 s anmelden.
  - erfüllt von: FCHAIN-interactive-login
  - Test **TEST-interactive-login**: Anmeldung mit gültigem Passwort, Zeit gemessen, Grenze 2 s.
- **REQ-interactive-sperre** (functional) — Das System muss nach 5 Fehlversuchen das Konto 15 min sperren.
  - erfüllt von: FCHAIN-interactive-login
  - Test **TEST-interactive-sperre**: 5 Fehlversuche, 6. Versuch muss abgewiesen werden.
- Wirkketten: FCHAIN-interactive-login

### UC-interactive-sperre — Sperrung

Nutzer wird bei Fehlversuchen gesperrt.

- **REQ-interactive-sperre-dauer** (functional) — Das System muss die Sperrung für 15 Minuten halten.
  - erfüllt von: FCHAIN-interactive-login
  - Test **TEST-interactive-sperre-dauer**: Konto sperren, 15 Minuten warten, danach Anmeldung erlaubt.
- **REQ-interactive-sperre-fehlversuche** (functional) — Das System muss nach 5 Fehlversuchen das Konto sperren.
  - erfüllt von: FCHAIN-interactive-login
  - Test **TEST-interactive-sperre-fehlversuche**: 5 Fehlversuche, 6. Versuch muss abgewiesen werden.
- Wirkketten: FCHAIN-interactive-login

### UC-login-dauer — Anmeldedauer

Das System muss die Anmeldung innerhalb einer Zielzeit abschliessen.

- **REQ-login-dauer** (non-functional) — Das System muss die Anmeldung innerhalb einer Zielzeit abschliessen; Zielwert offen, beim Auftraggeber erfragt.
  - erfüllt von: FCHAIN-interactive-login
  - Test **TEST-login-dauer**: Letzter Lauf misst die Anmeldedauer, Grenze offen.
- **REQ-login-passwort** (functional) — Das System muss Nutzer per Passwort in unter 2 s anmelden.
  - erfüllt von: FUNC-interactive-login-pruefen
  - Test **TEST-login-passwort**: Anmeldung mit gueltigem Passwort, Zeit gemessen, Grenze 2 s.
- **REQ-login-sperre** (functional) — Das System muss nach 5 Fehlversuchen das Konto 15 min sperren.
  - erfüllt von: FUNC-interactive-login-erfolgreich, FUNC-interactive-login-pruefen
  - Test **TEST-login-sperre**: 5 Fehlversuche, 6. Versuch muss abgewiesen werden.
- Wirkketten: FCHAIN-interactive-login

### UC-nightly-aufgaben — Nächtliche Aufgaben

SIG Local führt wiederkehrende Aufgaben nachts aus.

- **REQ-nightly-aufgaben-start** (functional) — Das System muss nächtliche Aufgaben nach Beendigung des vorherigen Starts automatisch starten.
  - erfüllt von: FCHAIN-nightly-aufgaben, FUNC-nightly-aufgaben-start
  - Test **TEST-nightly-aufgaben-start**: Nächtliche Aufgaben nach Beendigung des vorherigen Starts automatisch starten.
- **REQ-nightly-aufgaben-zeitfenster** (non-functional) — Das System muss nächtliche Aufgaben innerhalb eines definierten Zeitfensters ausführen.
  - erfüllt von: FCHAIN-nightly-aufgaben
  - Test **TEST-nightly-aufgaben-zeitfenster**: Nächtliche Aufgaben innerhalb eines definierten Zeitfensters ausführen.
- Wirkketten: FCHAIN-nightly-aufgaben

### UC-nightly-aufgaben-start — Start

Scheduler startet nächtliche Aufgaben.

- **REQ-nightly-aufgaben-start-verzoegerung** (non-functional) — Das System muss nächtliche Aufgaben innerhalb von 5 Minuten nach dem Startzeitpunkt starten.
  - erfüllt von: FCHAIN-nightly-aufgaben
  - Test **TEST-nightly-aufgaben-start-verzoegerung**: Startzeitpunkt setzen, Aufgabe startet innerhalb 5 Minuten.
- **REQ-nightly-aufgaben-start-zeitpunkt** (functional) — Das System muss nächtliche Aufgaben zum angegebenen Startzeitpunkt starten.
  - erfüllt von: FUNC-nightly-aufgaben-start
  - Test **TEST-nightly-aufgaben-start-zeitpunkt**: Startzeitpunkt setzen, Aufgabe startet zu diesem Zeitpunkt.
- Wirkketten: FCHAIN-nightly-aufgaben

### UC-nightly-aufgaben-zeitfenster — Zeitfenster

Nächtliche Aufgaben laufen in Zeitfenster.

- **REQ-nightly-aufgaben-zeitfenster-dauer** (non-functional) — Das System muss nächtliche Aufgaben innerhalb eines definierten Zeitfensters laufen.
  - erfüllt von: FCHAIN-offline-arbeit
  - Test **TEST-nightly-aufgaben-zeitfenster-dauer**: Zeitfenster definieren, Aufgabe läuft innerhalb dieses Fensters.
- **REQ-nightly-aufgaben-zeitfenster-start** (functional) — Das System muss nächtliche Aufgaben in einem definierten Zeitfenster starten.
  - erfüllt von: —
  - Test **TEST-nightly-aufgaben-zeitfenster-start**: Zeitfenster definieren, Aufgabe startet innerhalb dieses Fensters.
- Wirkketten: FCHAIN-nightly-aufgaben

### UC-offline-arbeit — Offline-Arbeit

SIG Local arbeitet unterwegs lokal, wenn der Rechner nicht im Netz ist.

- **REQ-offline-arbeit-automatisch** (functional) — Das System muss bei Offline-Betrieb automatisch den lokalen Modus aktivieren.
  - erfüllt von: FCHAIN-offline-arbeit
  - Test **TEST-offline-arbeit-automatisch**: Bei Offline-Betrieb automatisch den lokalen Modus aktivieren.
- **REQ-offline-arbeit-synchronisation** (functional) — Das System muss Offline-Arbeit synchronisieren, sobald das Netzwerk wieder verfügbar ist.
  - erfüllt von: FCHAIN-offline-arbeit
  - Test **TEST-offline-arbeit-synchronisation**: Offline-Arbeit synchronisieren, sobald das Netzwerk wieder verfügbar ist.
- Wirkketten: FCHAIN-offline-arbeit

### UC-offline-arbeit-aktivieren — Aktivierung

Rechner aktiviert Offline-Arbeit.

- **REQ-offline-arbeit-aktivieren** (functional) — Das System muss den Rechner automatisch in den Offline-Modus versetzen, sobald er nicht mehr im Netz ist.
  - erfüllt von: FUNC-offline-arbeit-aktivieren
  - Test **TEST-offline-arbeit-aktivieren**: Netzverlust simulieren, Rechner muss in Offline-Modus wechseln.
- **REQ-offline-arbeit-aktivieren-zeitpunkt** (non-functional) — Das System muss den Offline-Modus innerhalb von 30 Sekunden nach Netzverlust aktivieren.
  - erfüllt von: FCHAIN-offline-arbeit
  - Test **TEST-offline-arbeit-aktivieren-zeitpunkt**: Netzverlust simulieren, Zeit bis Offline-Modus messen, Grenze 30 s.
- Wirkketten: FCHAIN-offline-arbeit

### UC-offline-arbeit-automatisch — Automatisch

Rechner aktiviert Offline-Modus.

- **REQ-offline-arbeit-automatisch-funktion** (functional) — Das System muss den Rechner automatisch in den Offline-Modus versetzen, sobald er nicht mehr im Netz ist.
  - erfüllt von: FCHAIN-offline-arbeit
  - Test **TEST-offline-arbeit-automatisch-funktion**: Netzverlust simulieren, Rechner muss in Offline-Modus wechseln.
- **REQ-offline-arbeit-automatisch-zeitpunkt** (non-functional) — Das System muss den Offline-Modus innerhalb von 30 Sekunden nach Netzverlust aktivieren.
  - erfüllt von: —
  - Test **TEST-offline-arbeit-automatisch-zeitpunkt**: Netzverlust simulieren, Zeit bis Offline-Modus messen, Grenze 30 s.
- Wirkketten: FCHAIN-offline-arbeit

### UC-offline-arbeit-synchronisation — Synchronisation

Rechner synchronisiert Offline-Arbeit.

- **REQ-offline-arbeit-synchronisation-daten** (functional) — Das System muss alle Offline-Arbeit synchronisieren, sobald das Netz wieder verfügbar ist.
  - erfüllt von: FCHAIN-offline-arbeit
  - Test **TEST-offline-arbeit-synchronisation-daten**: Netzverfügbarkeit simulieren, alle Offline-Arbeit muss synchronisiert werden.
- **REQ-offline-arbeit-synchronisation-verzoegerung** (non-functional) — Das System muss mindestens 5 Sekunden warten, bevor es Offline-Arbeit synchronisiert, um Netzüberlastung zu vermeiden.
  - erfüllt von: —
  - Test **TEST-offline-arbeit-synchronisation-verzoegerung**: Netzverfügbarkeit simulieren, Wartezeit vor Synchronisation messen, Grenze 5 s.
- Wirkketten: FCHAIN-offline-arbeit

## Wirkketten

### FCHAIN-interactive-login — Anmeldung

Funktionale Kette für interaktive Anmeldung

- FUNC-interactive-login-empfangen: Empfängt die interaktive Anmeldung des Nutzers.
- FUNC-interactive-login-erfolgreich: Verarbeitet eine erfolgreiche Anmeldung.
- FUNC-interactive-login-pruefen: Prüft die Anmeldedaten des Nutzers.
- FUNC-nightly-aufgaben-start: Startet die nächtlichen Aufgaben
- FUNC-offline-arbeit-aktivieren: Aktiviert den Offline-Modus

### FCHAIN-nightly-aufgaben — Nächtliche Aufgaben

Funktionale Kette für nächtliche Aufgaben

- FUNC-nightly-aufgaben-start: Startet die nächtlichen Aufgaben

### FCHAIN-offline-arbeit — Offline-Arbeit

Funktionale Kette für Offline-Arbeit

- FUNC-offline-arbeit-aktivieren-rechner: Aktiviert den Offline-Modus durch den Rechner
- FUNC-offline-arbeit-aktivieren-scheduler: Aktiviert den Offline-Modus durch den Scheduler

## Flüsse und Verträge

- **FLOW-interactive-login** (ACTOR-nutzer → FUNC-interactive-login-empfangen; Vertrag SCHEMA-interactive-login): Anfrage des Nutzers zur interaktiven Anmeldung an das System
- **FLOW-nightly-aufgaben-start** (ACTOR-scheduler → FUNC-nightly-aufgaben-start; Vertrag SCHEMA-nightly-aufgaben-start): Start der nächtlichen Aufgaben durch den Scheduler
- **FLOW-offline-arbeit-aktivieren** (ACTOR-rechner → FUNC-offline-arbeit-aktivieren; Vertrag SCHEMA-offline-arbeit-aktivieren): Aktivierung des Offline-Modus durch den Rechner
- **FLOW-offline-arbeit-aktivieren-rechner** (ACTOR-rechner → FUNC-offline-arbeit-aktivieren-rechner; Vertrag SCHEMA-offline-arbeit-aktivieren): Aktivierung der Offline-Arbeit durch den Rechner
- **FLOW-offline-arbeit-aktivieren-scheduler** (ACTOR-scheduler → FUNC-offline-arbeit-aktivieren-scheduler; Vertrag SCHEMA-offline-arbeit-aktivieren): Aktivierung der Offline-Arbeit durch den Scheduler
- Vertrag **SCHEMA-interactive-login**: Form der Anmeldung: Benutzername und Passwort
- Vertrag **SCHEMA-nightly-aufgaben-start**: Vertrag für den Start der nächtlichen Aufgaben
- Vertrag **SCHEMA-offline-arbeit-aktivieren**: Vertrag für die Aktivierung des Offline-Modus

## Module

