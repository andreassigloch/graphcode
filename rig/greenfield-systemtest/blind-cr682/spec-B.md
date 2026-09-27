# Spec B

**System SYS-sig-local** — Eigene LLM-Rechenkapazitaet im internen Netz, vollstaendig lokal: tagsueber interaktiv bedient, nachts selbstaendig arbeitend, unterwegs lokal.

## Akteure

- **ACTOR-externer-service** — Externer Service, der Ergebnisse empfängt.
- **ACTOR-nutzer** — Nutzer, der die API interaktiv benutzt.
- **ACTOR-scheduler** — Scheduler, der Nacht-Aufgaben auslöst.

## Use Cases mit ihren Anforderungen

### UC-ergebnis-protokollieren — Ergebnisprotokoll

System protokolliert Ergebnisse.

- **REQ-ergebnis-protokollierung** (functional) — Das System muss jeden Nachtlauf Ergebnisse protokollieren, die nachvollziehbar sind.
  - erfüllt von: FUNC-ergebnis-protokollieren, FUNC-nacht-aufgabe-protokollieren
  - Test **TEST-ergebnis-protokollierung**: Protokoll des Nachtlaufs prüfen, ob Ergebnisse nachvollziehbar sind.
- **REQ-ergebnis-zeitstempel** (functional) — Das System muss jedem Ergebnis einen Zeitstempel zuordnen.
  - erfüllt von: FUNC-nacht-aufgabe-protokollieren, FUNC-nacht-aufgabe-zeitstempel
  - Test **TEST-ergebnis-zeitstempel**: Zeitstempel des Ergebnisses prüfen.
- Wirkketten: FCHAIN-protokollierung

### UC-externer-service-ergebnis-empfangen — Ergebnis empfangen

Externer Service sendet Ergebnis an SIG Local.

- **REQ-ergebnis-empfangen** (functional) — Das System muss Ergebnisse von externen Services empfangen und verarbeiten können.
  - erfüllt von: FUNC-ergebnis-protokollieren
  - Test **TEST-ergebnis-empfangen**: Ein externer Service sendet ein Ergebnis, das vom System empfangen und verarbeitet wird.
- **REQ-ergebnis-protokollieren** (functional) — Das System muss empfangene Ergebnisse protokollieren, damit sie nachvollziehbar sind.
  - erfüllt von: FCHAIN-protokollierung, FUNC-ergebnis-protokollieren
  - Test **TEST-ergebnis-protokollieren**: Ein empfangenes Ergebnis wird protokolliert, Zeitstempel und Inhalt sind vorhanden.
- Wirkketten: FCHAIN-protokollierung

### UC-nacht-aufgabe-ausfuehren — Nachtlauf auslösen

Scheduler führt Nacht-Aufgabe aus.

- **REQ-nacht-aufgabe-automatisch** (functional) — Das System muss nach einem Neustart die Nacht-Aufgabe automatisch ausführen.
  - erfüllt von: FUNC-nacht-aufgabe-ausloesen
  - Test **TEST-nacht-aufgabe-automatisch**: Neustart, Nachtlauf muss automatisch starten.
- **REQ-nacht-aufgabe-zeitfenster** (non-functional) — Das System muss die Nacht-Aufgabe in einem definierten Zeitfenster ausführen; Zeitfenster offen, beim Auftraggeber erfragt.
  - erfüllt von: SYS-sig-local
  - Test **TEST-nacht-aufgabe-zeitfenster**: Nachtlauf in definiertem Zeitfenster, prüfen.
- Wirkketten: FCHAIN-nacht-aufgaben

### UC-nacht-aufgabe-protokollieren — Nachtlauf protokollieren

Scheduler protokolliert Nacht-Aufgaben-Ergebnisse

- **REQ-nacht-aufgabe-ausfall** (functional) — Das System muss bei Ausfall einer Nacht-Aufgabe einen Fehler protokollieren.
  - erfüllt von: FUNC-nacht-aufgabe-protokollieren
  - Test **TEST-nacht-aufgabe-ausfall**: Ein Nachtlauf schlägt fehl, Fehler wird protokolliert.
- **REQ-nacht-aufgabe-ergebnisformat** (functional) — Das System muss Nacht-Aufgaben-Ergebnisse in einem maschinenlesbaren Format speichern.
  - erfüllt von: FUNC-ergebnis-protokollieren
  - Test **TEST-nacht-aufgabe-ergebnisformat**: Ein Nachtlauf wird abgeschlossen, Ergebnisformat wird geprüft.
- **REQ-nacht-aufgabe-protokollierung** (functional) — Das System muss Nacht-Aufgaben-Ergebnisse protokollieren, sobald sie abgeschlossen sind.
  - erfüllt von: FUNC-nacht-aufgabe-protokollieren
  - Test **TEST-nacht-aufgabe-protokollierung**: Ein Nachtlauf wird abgeschlossen, Ergebnis wird protokolliert.
- **REQ-nacht-aufgabe-zeitstempel** (functional) — Das System muss jedem Nacht-Aufgaben-Ergebnis einen Zeitstempel zuordnen.
  - erfüllt von: FUNC-nacht-aufgabe-zeitstempel
  - Test **TEST-nacht-aufgabe-zeitstempel**: Ein Nachtlauf wird abgeschlossen, Zeitstempel wird geprüft.
- Wirkketten: FCHAIN-protokollierung

### UC-nacht-aufgaben-ausfuehren — Nachtlauf

System führt Nacht-Aufgaben aus.

- **REQ-nacht-aufgaben-automatisch** (functional) — Das System muss Nacht-Aufgaben nach einem Neustart automatisch fortsetzen.
  - erfüllt von: FCHAIN-nacht-aufgaben
  - Test **TEST-nacht-aufgaben-automatisch**: System neustarten, Aufgaben nach Neustart prüfen.
- **REQ-nacht-aufgaben-zeitfenster** (non-functional) — Das System muss Nacht-Aufgaben innerhalb eines definierten Zeitfensters ausführen.
  - erfüllt von: FCHAIN-nacht-aufgaben
  - Test **TEST-nacht-aufgaben-zeitfenster**: Nachtlauf in definiertem Zeitfenster ausführen, prüfen.
- Wirkketten: FCHAIN-nacht-aufgaben

### UC-nutzer-anmelden — Anmeldung

Nutzer meldet sich mit Passwort an.

- **REQ-nutzer-anmeldung** (functional) — Das System muss Nutzer mit Passwort anmelden.
  - erfüllt von: FUNC-ergebnis-protokollieren
  - Test **TEST-nutzer-anmeldung**: Anmeldung mit gültigem Passwort, prüfen.
- **REQ-nutzer-sperre** (functional) — Das System muss nach 5 Fehlversuchen das Konto 15 min sperren.
  - erfüllt von: FUNC-ergebnis-protokollieren
  - Test **TEST-nutzer-sperre**: 5 Fehlversuche, 6. Versuch muss abgewiesen werden.
- Wirkketten: FCHAIN-authentifizierung

### UC-nutzer-api-benutzen — Interaktive Nutzung

Nutzer verwenden die API interaktiv.

- **REQ-login-dauer** (non-functional) — Das System muss die Anmeldung innerhalb einer Zielzeit abschliessen; Zielwert offen, beim Auftraggeber erfragt.
  - erfüllt von: FCHAIN-authentifizierung
  - Test **TEST-login-dauer**: Lastlauf misst p95 der Anmeldung, Grenze Zielwert.
- **REQ-login-passwort** (functional) — Das System muss Nutzer per Passwort in unter 2 s anmelden.
  - erfüllt von: FUNC-ergebnis-protokollieren
  - Test **TEST-login-passwort**: Lastlauf misst p95 der Anmeldung, Grenze 2 s.
- **REQ-nutzer-api-authentifizierung** (functional) — Das System muss Nutzer per Passwort authentifizieren.
  - erfüllt von: FUNC-anfrage-annehmen
  - Test **TEST-nutzer-api-authentifizierung**: Nutzer anmelden, Zeit messen, Grenze 2 s.
- **REQ-nutzer-api-authentifizierung-dauer** (functional) — Das System muss Nutzer per Passwort in unter 2 s authentifizieren.
  - erfüllt von: FCHAIN-authentifizierung
  - Test **TEST-nutzer-api-authentifizierung-dauer**: Lastlauf misst p95 der Authentifizierung, Grenze 2 s.
- **REQ-nutzer-api-schnittstelle** (functional) — Das System muss eine API zur interaktiven Nutzung bereitstellen.
  - erfüllt von: FUNC-ergebnis-protokollieren
  - Test **TEST-nutzer-api-schnittstelle**: API aufrufen, Ergebnis prüfen.
- Wirkketten: FCHAIN-authentifizierung

## Wirkketten

### FCHAIN-authentifizierung — Authentifizierung

Funktionen zur Authentifizierung

- FUNC-anfrage-annehmen: Nimmt die Anfrage entgegen.

### FCHAIN-nacht-aufgaben — Nacht-Aufgaben

Funktionen zur Durchführung von Nacht-Aufgaben.

- FUNC-nacht-aufgabe-ausloesen: Löst die Nacht-Aufgabe aus.
- FUNC-nacht-aufgabe-protokollieren: Protokolliert das Ergebnis der Nacht-Aufgabe.

### FCHAIN-protokollierung — Protokollierung

Funktionen zur Protokollierung von Ergebnissen.

- FUNC-ergebnis-protokollieren: Protokolliert das Ergebnis der Nacht-Aufgabe.
- FUNC-nacht-aufgabe-protokollieren: Protokolliert das Ergebnis der Nacht-Aufgabe.
- FUNC-nacht-aufgabe-zeitstempel: Ordnet jedem Ergebnis einen Zeitstempel zu.

## Flüsse und Verträge

- **FLOW-ergebnis-protokollieren** (ACTOR-scheduler → FUNC-ergebnis-protokollieren; Vertrag SCHEMA-ergebnis): Nacht-Aufgabe protokolliert ihr Ergebnis.
- **FLOW-nacht-aufgabe-ausloesen** (ACTOR-scheduler → FUNC-nacht-aufgabe-ausloesen; Vertrag SCHEMA-nacht-aufgabe): Nacht-Aufgabe wird vom Scheduler ausgelöst.
- **FLOW-nacht-aufgabe-protokollieren** (FUNC-anfrage-annehmen → FUNC-nacht-aufgabe-protokollieren; Vertrag SCHEMA-nacht-aufgabe): Nacht-Aufgabe protokolliert ihr Ergebnis.
- **FLOW-nutzer-anfrage** (ACTOR-nutzer → FUNC-anfrage-annehmen; Vertrag SCHEMA-anfrage): Anfrage des Nutzers an das System
- Vertrag **SCHEMA-anfrage**: Form der Anfrage: Text und Sitzungs-ID
- Vertrag **SCHEMA-ergebnis**: Vertrag für die Nacht-Aufgabe: Zeitstempel und Ergebnis.
- Vertrag **SCHEMA-nacht-aufgabe**: Vertrag für die Nacht-Aufgabe: Zeitstempel und Ergebnis.

## Module

