# Spec C

**System SYS-sig-local** — Eigene LLM-Rechenkapazitaet im internen Netz, vollstaendig lokal: tagsueber interaktiv bedient, nachts selbstaendig arbeitend, unterwegs lokal.

## Akteure

- **ACTOR-device** — Ein Gerät, das die lokale Instanz nutzt, wenn kein Netzwerk verfügbar ist.
- **ACTOR-external-service** — Ein externer Dienst, der Ergebnisse prüft oder abfragt.
- **ACTOR-geraet** — Gerät, das das System nutzt
- **ACTOR-nutzer** — Nutzer des Systems
- **ACTOR-scheduler** — Ein externer Dienst, der geplante Aufgaben auslöst.
- **ACTOR-system** — Internes System
- **ACTOR-user** — Ein menschlicher Nutzer, der interaktiv mit dem System kommuniziert.

## Use Cases mit ihren Anforderungen

### UC-01 — Geplante Aufgabe

Geplante Aufgabe

- **REQ-login-dauer** (functional) — Das System muss die Anmeldung innerhalb einer Zielzeit abschliessen; Zielwert offen, beim Auftraggeber erfragt.
  - erfüllt von: FUNC-anfrage-annehmen, FUNC-login-accept
  - Test **TEST-login-dauer**: Lastlauf misst p95 der Anmeldung, Grenze Zielwert.
- **REQ-scheduled-task-notify** (functional) — Das System muss bei jeder ausgeführten Aufgabe eine Benachrichtigung senden.
  - erfüllt von: FCHAIN-scheduled-task, FUNC-anfrage-annehmen, FUNC-execute-scheduled-task
  - Test **TEST-scheduled-task-notify**: Eine Aufgabe wird ausgeführt, Benachrichtigung wird empfangen.
- **REQ-scheduled-task-retry** (functional) — Das System muss fehlgeschlagene geplante Aufgaben automatisch erneut versuchen.
  - erfüllt von: FCHAIN-scheduled-task, FUNC-anfrage-annehmen, FUNC-execute-scheduled-task
  - Test **TEST-scheduled-task-retry**: Fehlgeschlagene Aufgabe erneut versuchen, Prüfung ob erneut ausgeführt.
- **REQ-traceability-origin** (functional) — Das System muss die Herkunft jedes Ergebnisses dokumentieren.
  - erfüllt von: FUNC-anfrage-annehmen, FUNC-track-task-origin
  - Test **TEST-traceability-origin**: Ergebnis erstellen, Herkunft prüfen.
- Wirkketten: FCHAIN-scheduled-task

### UC-02 — Offline-Nutzung

Offline-Nutzung

- **REQ-offline-operation-persistence** (functional) — Das System muss Aufgabenzustand auch bei Geräteausfall nicht verlieren.
  - erfüllt von: FCHAIN-offline-operation, FUNC-anfrage-annehmen, FUNC-offline-operation-accept, FUNC-resilient-execution-accept
  - Test **TEST-offline-operation-persistence**: Gerät ausschalten, Aufgabe läuft, Gerät einschalten, Aufgabe fortsetzen.
- **REQ-offline-operation-resume** (functional) — Das System muss Offline-Aufgaben nach Wiederherstellung des Netzwerks kontrolliert nachholen.
  - erfüllt von: FUNC-anfrage-annehmen, FUNC-offline-operation-accept
  - Test **TEST-offline-operation-resume**: Netzwerk unterbrechen, Aufgabe starten, Netzwerk wiederherstellen, Aufgabe nachholen.
- **REQ-resilient-execution-restart** (functional) — Das System muss Aufgaben nach einem Neustart automatisch fortsetzen.
  - erfüllt von: FUNC-anfrage-annehmen, FUNC-ensure-resilience, FUNC-scheduled-task-accept
  - Test **TEST-resilient-execution-restart**: System neustarten, Aufgabe automatisch fortsetzen.
- Wirkketten: FCHAIN-offline-operation, FCHAIN-resilient-execution

### UC-interactive-session — Interaktive Sitzung

Ein Nutzer interagiert mit dem System zur Erledigung einer Aufgabe.

- **REQ-interactive-session-auth** (functional) — Das System muss Nutzer interaktiv in unter 2 s authentifizieren.
  - erfüllt von: FUNC-anfrage-annehmen, FUNC-handle-interactive-request, FUNC-interactive-session-accept
  - Test **TEST-interactive-session-auth**: Nutzer anmelden, Zeit messen, Grenze 2 s.
- **REQ-interactive-session-concurrent** (functional) — Das System muss bis zu 10 gleichzeitige interaktive Sitzungen erlauben.
  - erfüllt von: FCHAIN-interactive-session, FUNC-anfrage-annehmen, FUNC-handle-interactive-request
  - Test **TEST-interactive-session-concurrent**: 10 Nutzer gleichzeitig anmelden, alle erfolgreich.
- Wirkketten: FCHAIN-interactive-session

### UC-login — Anmeldung

Nutzer meldet sich an.

- **REQ-login-dauer** (functional) — Das System muss die Anmeldung innerhalb einer Zielzeit abschliessen; Zielwert offen, beim Auftraggeber erfragt.
  - erfüllt von: FUNC-anfrage-annehmen, FUNC-login-accept
  - Test **TEST-login-dauer**: Lastlauf misst p95 der Anmeldung, Grenze Zielwert.
- Wirkketten: FCHAIN-login

### UC-offline-operation — Offline-Nutzung

Ein Gerät verwendet die lokale Instanz, wenn der Rechner nicht im Netz ist.

- **REQ-offline-operation** (functional) — Das System muss die Offline-Nutzung unterstützen.
  - erfüllt von: FCHAIN-offline-operation, FUNC-anfrage-annehmen, FUNC-offline-operation-accept
  - Test **TEST-verify-offline-operation**: it.todo: Prüfe "Offline-Nutzung" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-persistence** (functional) — Das System muss Aufgabenzustand auch bei Geräteausfall nicht verlieren.
  - erfüllt von: FCHAIN-offline-operation, FUNC-anfrage-annehmen, FUNC-offline-operation-accept, FUNC-resilient-execution-accept
  - Test **TEST-offline-operation-persistence**: Gerät ausschalten, Aufgabe läuft, Gerät einschalten, Aufgabe fortsetzen.
- **REQ-offline-operation-resume** (functional) — Das System muss Offline-Aufgaben nach Wiederherstellung des Netzwerks kontrolliert nachholen.
  - erfüllt von: FUNC-anfrage-annehmen, FUNC-offline-operation-accept
  - Test **TEST-offline-operation-resume**: Netzwerk unterbrechen, Aufgabe starten, Netzwerk wiederherstellen, Aufgabe nachholen.
- Wirkketten: FCHAIN-offline-operation

### UC-resilient-execution — Resiliente Ausführung

Das System führt Aufgaben fort, auch wenn der Rechner ausgeschaltet wird.

- **REQ-resilient-execution** (functional) — Das System muss Aufgaben fortsetzen, auch wenn der Rechner ausgeschaltet wird.
  - erfüllt von: FUNC-anfrage-annehmen, FUNC-ensure-resilience, FUNC-resilient-execution-accept
  - Test **TEST-verify-resilient-execution**: it.todo: Prüfe "Resiliente Ausführung" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-resilient-execution-backoff** (functional) — Das System muss bei fehlgeschlagenen Aufgaben nach einem exponentiellen Backoff erneut versuchen.
  - erfüllt von: FCHAIN-resilient-execution, FUNC-anfrage-annehmen, FUNC-ensure-resilience
  - Test **TEST-resilient-execution-backoff**: Aufgabe fehlschlagen lassen, Zeit messen bis erneuter Versuch, exponentiell steigend.
- **REQ-resilient-execution-restart** (functional) — Das System muss Aufgaben nach einem Neustart automatisch fortsetzen.
  - erfüllt von: FUNC-anfrage-annehmen, FUNC-ensure-resilience, FUNC-scheduled-task-accept
  - Test **TEST-resilient-execution-restart**: System neustarten, Aufgabe automatisch fortsetzen.
- Wirkketten: FCHAIN-resilient-execution

### UC-scheduled-task — Geplanter Task

Ein Auftrag wird automatisch zur geplanten Zeit ausgeführt.

- **REQ-scheduled-task** (functional) — Das System muss geplante Aufgaben automatisch ausführen.
  - erfüllt von: FUNC-anfrage-annehmen, FUNC-scheduled-task-accept
  - Test **TEST-verify-scheduled-task**: it.todo: Prüfe "Geplante Aufgaben" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-scheduled-task-restore** (functional) — Das System muss nach einem Neustart ausstehende geplante Aufgaben nachholen.
  - erfüllt von: FCHAIN-scheduled-task, FUNC-anfrage-annehmen, FUNC-execute-scheduled-task
  - Test **TEST-scheduled-task-restore**: Neustart simulieren, ausstehende Aufgaben nachholen, Prüfung ob nachgeholt.
- **REQ-scheduled-task-retry** (functional) — Das System muss fehlgeschlagene geplante Aufgaben automatisch erneut versuchen.
  - erfüllt von: FCHAIN-scheduled-task, FUNC-anfrage-annehmen, FUNC-execute-scheduled-task
  - Test **TEST-scheduled-task-retry**: Fehlgeschlagene Aufgabe erneut versuchen, Prüfung ob erneut ausgeführt.
- **REQ-scheduled-task-time** (functional) — Das System muss geplante Aufgaben zur vorgegebenen Zeit ausführen.
  - erfüllt von: FUNC-anfrage-annehmen, FUNC-execute-scheduled-task
  - Test **TEST-scheduled-task-time**: Geplante Aufgabe zur vorgegebenen Zeit ausführen, Zeitmessung.
- Wirkketten: FCHAIN-scheduled-task

### UC-task-traceability — Traceability

Das System dokumentiert die Herkunft jedes Ergebnisses.

- **REQ-traceability-model** (functional) — Das System muss bei jedem Ergebnis den verwendeten Modell-Status dokumentieren.
  - erfüllt von: FUNC-anfrage-annehmen, FUNC-track-task-origin
  - Test **TEST-traceability-model**: Ergebnis erstellen, Modell-Status prüfen.
- **REQ-traceability-origin** (functional) — Das System muss die Herkunft jedes Ergebnisses dokumentieren.
  - erfüllt von: FUNC-anfrage-annehmen, FUNC-track-task-origin
  - Test **TEST-traceability-origin**: Ergebnis erstellen, Herkunft prüfen.
- Wirkketten: FCHAIN-scheduled-task

### UC-task-validation — Aufgabenvalidierung

Das System prüft Ergebnisse auf Gültigkeit und Fehler.

- **REQ-validation-error** (functional) — Das System muss bei Fehler in Ergebnissen eine Meldung ausgeben.
  - erfüllt von: FUNC-anfrage-annehmen
  - Test **TEST-validation-error**: Ergebnis mit Fehler erstellen, Meldung prüfen.
- **REQ-validation-result** (functional) — Das System muss Ergebnisse auf Gültigkeit prüfen.
  - erfüllt von: FUNC-anfrage-annehmen
  - Test **TEST-validation-result**: Ergebnis erstellen, Gültigkeit prüfen.
- Wirkketten: FCHAIN-task-validation

## Anforderungen ausserhalb eines Use Case

- **REQ-login-time** (functional) — Das System muss Nutzer in unter 2 s anmelden.
  - erfüllt von: FUNC-anfrage-annehmen, FUNC-login-accept
  - Test **TEST-login-time**: Lastlauf misst p95 der Anmeldung, Grenze 2 s.
- **REQ-scheduled-task-execution** (functional) — Geplante Aufgaben müssen zu ihrer geplanten Zeit ausgeführt werden
  - erfüllt von: FUNC-execute-scheduled-task
  - Test **TEST-verify-scheduled-task-execution**: it.todo: Prüfe "Geplante Aufgabe ausführen" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-task-traceability** (functional) — Das System muss die Herkunft jedes Ergebnisses dokumentieren
  - erfüllt von: FUNC-anfrage-annehmen, FUNC-track-task-origin
  - Test **TEST-verify-task-traceability**: it.todo: Prüfe "Aufgabenherkunft dokumentieren" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.

## Wirkketten

### FCHAIN-interactive-session — Funktionale Kette Interaktive Sitzung

Funktionale Kette fuer interaktive Sitzungen

- FUNC-handle-interactive-request: Verarbeitet interaktive Anfragen
- FUNC-interactive-session-accept: Nimmt die Anfrage entgegen.

### FCHAIN-login — Funktionale Kette Anmeldung

Funktionale Kette der Anmeldung.

- FUNC-login-accept: Nimmt die Anfrage entgegen.

### FCHAIN-offline-operation — Offline-Nutzung

Funktionale Kette für Offline-Nutzung

- FUNC-anfrage-annehmen: Nimmt die Anfrage entgegen.
- FUNC-offline-anfrage-annehmen: Nimmt die Offline-Anfrage entgegen.
- FUNC-offline-operation-accept: Akzeptiert Offline-Anfragen des Nutzers.

### FCHAIN-resilient-execution — Resiliente Ausführung

Funktionale Kette für resiliente Ausführung

- FUNC-anfrage-annehmen: Nimmt die Anfrage entgegen.
- FUNC-ensure-resilience: Stellt Resilienz sicher
- FUNC-resilient-execution-accept: Akzeptiert resilient ausgeführte Aufgaben.

### FCHAIN-scheduled-task — Geplante Aufgabe

Funktionale Kette für geplante Aufgaben

- FUNC-anfrage-annehmen: Nimmt die Anfrage entgegen.
- FUNC-scheduled-task-accept: Akzeptiert geplante Aufgaben.
- FUNC-track-task-origin: Verfolgt die Herkunft von Aufgaben

### FCHAIN-task-validation — Funktionale Kette Aufgabenvalidierung

Funktionale Kette zur Aufgabenvalidierung

- FUNC-anfrage-annehmen: Nimmt die Anfrage entgegen.
- FUNC-ensure-resilience: Stellt Resilienz sicher
- FUNC-execute-scheduled-task: Führt geplante Aufgaben aus
- FUNC-track-task-origin: Verfolgt die Herkunft von Aufgaben

## Funktionen ausserhalb einer Wirkkette

- FUNC-interaktive-anfrage-annehmen: Nimmt die interaktive Anfrage entgegen.
- FUNC-resiliente-aufgabe-annehmen: Nimmt die resiliente Aufgabe entgegen.

## Flüsse und Verträge

- **FLOW-anfrage** (ACTOR-nutzer → FUNC-anfrage-annehmen; Vertrag SCHEMA-anfrage): Anfrage des Nutzers an das System
- **FLOW-interactive-request** (FUNC-handle-interactive-request → FUNC-handle-interactive-request; Vertrag SCHEMA-interactive-request): Interaktive Anfrage.
- **FLOW-interactive-session** (ACTOR-nutzer → FUNC-interactive-session-accept; Vertrag SCHEMA-interactive-session): Anfrage des Nutzers an das System
- **FLOW-interactive-session-auth** (FUNC-interactive-session-accept → —; Vertrag SCHEMA-interactive-session-auth): Authentifizierung für interaktive Sitzungen
- **FLOW-interaktive-anfrage** (ACTOR-nutzer → FUNC-interaktive-anfrage-annehmen; Vertrag SCHEMA-interaktive-anfrage): Anfrage des Nutzers an das System
- **FLOW-login** (ACTOR-nutzer → FUNC-login-accept; Vertrag SCHEMA-login): Anfrage des Nutzers an das System
- **FLOW-login-auth** (FUNC-login-accept → —; Vertrag SCHEMA-login-auth): Authentifizierung bei Anmeldung
- **FLOW-offline-anfrage** (ACTOR-geraet → FUNC-offline-anfrage-annehmen; Vertrag SCHEMA-offline-anfrage): Anfrage des Geräts an das System
- **FLOW-offline-operation** (ACTOR-nutzer → FUNC-offline-operation-accept; Vertrag SCHEMA-offline-operation): Anfrage zur Offline-Nutzung des Systems
- **FLOW-resilient-execution** (ACTOR-system → FUNC-resilient-execution-accept; Vertrag SCHEMA-resilient-execution): Aufgabe zur resilienten Ausführung
- **FLOW-resilient-execution-nutzer** (ACTOR-nutzer → FUNC-ensure-resilience; Vertrag SCHEMA-resilient-execution): Ausführung einer Aufgabe durch den Nutzer, die auch bei Rechnerausfall fortgesetzt wird.
- **FLOW-resiliente-aufgabe** (ACTOR-system → FUNC-resiliente-aufgabe-annehmen; Vertrag SCHEMA-resiliente-aufgabe): Aufgabe, die auch bei Ausfall fortgeführt wird
- **FLOW-scheduled-task** (ACTOR-scheduler → FUNC-scheduled-task-accept; Vertrag SCHEMA-scheduled-task): Geplante Aufgabe zur automatischen Ausführung
- **FLOW-scheduled-task-geraet** (ACTOR-geraet → FUNC-scheduled-task-accept; Vertrag SCHEMA-scheduled-task): Geplante Aufgabe durch Gerät, die zur vorgegebenen Zeit ausgeführt wird.
- **FLOW-task-traceability** (ACTOR-nutzer → FUNC-track-task-origin; Vertrag SCHEMA-task-traceability): Aufgabenherkunft dokumentieren.
- Vertrag **SCHEMA-anfrage**: Form der Anfrage: Text und Sitzungs-ID
- Vertrag **SCHEMA-interactive-request**: Interaktive Anfrage-Vertrag.
- Vertrag **SCHEMA-interactive-session**: Form der Anfrage: Text und Sitzungs-ID
- Vertrag **SCHEMA-interactive-session-auth**: Schema für die Authentifizierung in interaktiven Sitzungen
- Vertrag **SCHEMA-interaktive-anfrage**: Form der Anfrage: Text und Sitzungs-ID
- Vertrag **SCHEMA-login**: Form der Anfrage: Text und Sitzungs-ID
- Vertrag **SCHEMA-login-auth**: Schema für die Authentifizierung bei Anmeldung
- Vertrag **SCHEMA-offline-anfrage**: Form der Anfrage: Text und Geräte-ID
- Vertrag **SCHEMA-offline-operation**: Vertrag für Offline-Anfragen: enthält Anfrage und Sitzungs-ID
- Vertrag **SCHEMA-resilient-execution**: Vertrag für resilienten Aufgaben-Start: enthält Aufgabenparameter
- Vertrag **SCHEMA-resiliente-aufgabe**: Form der Aufgabe: Name, Inhalt, Zeitplan
- Vertrag **SCHEMA-scheduled-task**: Vertrag für geplante Aufgaben: enthält Zeit, Ziel und Parameter
- Vertrag **SCHEMA-task-traceability**: Vertrag für Aufgabenherkunft: Aufgaben-ID, Modellversion, Anweisung.

## Module

- **MOD-interactive-session**: Interaktive Sitzung. — enthält FUNC-interactive-session-accept
- **MOD-login**: Anmeldung — enthält FUNC-login-accept
- **MOD-resilient-execution**: Modul zur resilienten Ausführung. — enthält FUNC-ensure-resilience
