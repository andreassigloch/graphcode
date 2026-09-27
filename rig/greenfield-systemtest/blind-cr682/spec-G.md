# Spec G

**System SYS-sig-local** — Eigene LLM-Rechenkapazitaet im internen Netz, vollstaendig lokal: tagsueber interaktiv bedient, nachts selbstaendig arbeitend, unterwegs lokal.

## Akteure

- **ACTOR-admin** — Ein Mensch, der Aufgaben definiert.
- **ACTOR-externer-service** — Ein System, das Aufgaben auslöst.
- **ACTOR-netzwerk** — Ein Netzwerk, das den Systemstatus meldet.
- **ACTOR-nutzer** — Ein Mensch, der interaktiv mit dem System arbeitet.
- **ACTOR-nutzer-sig-local** — Nutzer von SIG Local

## Use Cases mit ihren Anforderungen

### UC-interactive-session — Interaktive Sitzung

Ein Nutzer bedient das System interaktiv zur Laufzeit.

- **REQ-interactive-session-auth** (functional) — Das System muss Nutzer interaktiv in unter 2 s anmelden.
  - erfüllt von: FUNC-anfrage-annehmen
  - Test **TEST-interactive-session-auth**: Anmeldung mit gültigem Benutzer, Zeit gemessen, Grenze 2 s.
- **REQ-interactive-session-concurrent** (non-functional) — Das System muss bis zu 10 gleichzeitige interaktive Sitzungen erlauben.
  - erfüllt von: FCHAIN-interactive-session
  - Test **TEST-interactive-session-concurrent**: 10 gleichzeitige Anmeldungen, alle müssen erfolgreich sein.
- Wirkketten: FCHAIN-interactive-session, FCHAIN-interaktive-session

### UC-offline-operation — Offline-Arbeit

Ein Nutzer arbeitet mit der lokalen Instanz außerhalb des Netzwerks.

- **REQ-offline-operation-persistence** (functional) — Das System muss den Zustand nach einem Neustart wiederherstellen.
  - erfüllt von: FCHAIN-offline-operation
  - Test **TEST-offline-operation-persistence**: Neustart durchführen, Zustand nach Wiederherstellung prüfen.
- **REQ-offline-operation-resilience** (functional) — Das System muss Offline-Arbeit ohne Datenverlust durchführen.
  - erfüllt von: FUNC-offline-work
  - Test **TEST-offline-operation-resilience**: Offline-Arbeit durchführen, Datenverlust prüfen.
- Wirkketten: FCHAIN-offline-operation

### UC-recoverable-state — Wiederherstellbarer Zustand

Das System stellt den Zustand nach einem Neustart wieder her.

- **REQ-recoverable-state-consistency** (functional) — Das System muss nach einem Neustart konsistente Daten liefern.
  - erfüllt von: FCHAIN-recoverable-state
  - Test **TEST-recoverable-state-consistency**: Neustart durchführen, Datenkonsistenz prüfen.
- **REQ-recoverable-state-restore** (non-functional) — Das System muss den Zustand nach einem Neustart innerhalb von 5 min wiederherstellen.
  - erfüllt von: FCHAIN-recoverable-state
  - Test **TEST-recoverable-state-restore**: Neustart durchführen, Wiederherstellungszeit messen, Grenze 5 min.
- Wirkketten: FCHAIN-recoverable-state

### UC-resilient-execution — Robuste Ausführung

Das System führt Aufgaben fehlerhaft fort, wenn möglich.

- **REQ-resilient-execution-recovery** (functional) — Das System muss Aufgaben automatisch nach einem Neustart fortsetzen.
  - erfüllt von: FCHAIN-resilient-execution
  - Test **TEST-resilient-execution-recovery**: Nach Neustart alle Aufgaben fortsetzen, prüfen ob alle ausgeführt wurden.
- **REQ-resilient-execution-retry** (functional) — Das System muss fehlerhafte Aufgaben nach einer Fehlerschwelle erneut ausführen.
  - erfüllt von: FCHAIN-resilient-execution
  - Test **TEST-resilient-execution-retry**: 5 fehlerhafte Aufgaben, danach 6. Versuch muss fehlschlagen.
- Wirkketten: FCHAIN-resilient-execution

### UC-resource-isolation — Ressourcenisolation

Das System trennt Ressourcen zwischen Aufgaben und Modellen.

- **REQ-resource-isolation-model** (functional) — Das System muss Ressourcen zwischen Modellen strikt trennen.
  - erfüllt von: FCHAIN-resource-isolation
  - Test **TEST-resource-isolation-model**: Zwei gleichzeitige Modelle, Ressourcen dürfen sich nicht überschneiden.
- **REQ-resource-isolation-task** (functional) — Das System muss Ressourcen zwischen Aufgaben strikt trennen.
  - erfüllt von: —
  - Test **TEST-resource-isolation-task**: Zwei gleichzeitige Aufgaben, Ressourcen dürfen sich nicht überschneiden.
- Wirkketten: FCHAIN-resource-isolation

### UC-scheduled-task — Geplante Aufgabe

Ein Administrator definiert wiederkehrende Aufgaben zur Laufzeit.

- **REQ-scheduled-task-definition** (functional) — Das System muss wiederkehrende Aufgaben definieren und speichern können.
  - erfüllt von: FUNC-sig-local-scheduled-task-accept
  - Test **TEST-scheduled-task-definition**: Aufgabe definieren, speichern und laden.
- **REQ-scheduled-task-execution** (functional) — Das System muss wiederkehrende Aufgaben zu definierten Zeitpunkten ausführen.
  - erfüllt von: —
  - Test **TEST-scheduled-task-execution**: Geplante Aufgabe zu definiertem Zeitpunkt ausführen, prüfen ob ausgeführt.
- Wirkketten: FCHAIN-sig-local-scheduled-task

### UC-sig-local-interactive-session — Interaktive Sitzung

Nutzer interagiert mit SIG Local zur Laufzeit

- **REQ-sig-local-session-auth** (functional) — Das System muss Nutzer bei einer interaktiven Sitzung per Passwort authentifizieren.
  - erfüllt von: FUNC-session-authenticate
  - Test **TEST-sig-local-session-auth**: Ein Benutzer gibt ein gültiges Passwort ein, das System authentifiziert den Nutzer.
- **REQ-sig-local-session-concurrent** (functional) — Das System muss bis zu 10 gleichzeitige interaktive Sitzungen erlauben.
  - erfüllt von: FUNC-session-handle
  - Test **TEST-sig-local-session-concurrent**: 10 gleichzeitige Anmeldungen werden getestet, alle müssen erfolgreich sein.
- **REQ-sig-local-session-isolation** (functional) — Das System muss die Ressourcen zwischen verschiedenen Sitzungen trennen.
  - erfüllt von: FUNC-session-handle
  - Test **TEST-sig-local-session-isolation**: Zwei Sitzungen verwenden unterschiedliche Ressourcen, keine Überlappung.
- **REQ-sig-local-session-persistence** (functional) — Das System muss die Sitzungszustände nach einem Neustart wiederherstellen.
  - erfüllt von: FUNC-session-establish
  - Test **TEST-sig-local-session-persistence**: Nach einem Neustart werden Sitzungen wiederhergestellt, der Zustand ist konsistent.
- Wirkketten: FCHAIN-interactive-session

### UC-sig-local-offline-operation — Offline-Arbeit

Ein Nutzer arbeitet mit SIG Local außerhalb des Netzwerks.

- **REQ-login-dauer** (non-functional) — Das System muss die Anmeldung innerhalb einer Zielzeit abschliessen; Zielwert offen, beim Auftraggeber erfragt.
  - erfüllt von: FCHAIN-interactive-session
  - Test **TEST-login-dauer**: Lastlauf misst p95 der Anmeldung, Grenze Zielwert.
  - Test **TEST-login-passwort**: Lastlauf misst p95 der Anmeldung, Grenze 2 s.
- **REQ-offline-operation-persistence** (functional) — Das System muss den Zustand nach einem Neustart wiederherstellen.
  - erfüllt von: FCHAIN-offline-operation
  - Test **TEST-offline-operation-persistence**: Neustart durchführen, Zustand nach Wiederherstellung prüfen.
- **REQ-offline-operation-resilience** (functional) — Das System muss Offline-Arbeit ohne Datenverlust durchführen.
  - erfüllt von: FUNC-offline-work
  - Test **TEST-offline-operation-resilience**: Offline-Arbeit durchführen, Datenverlust prüfen.
- Wirkketten: FCHAIN-offline-operation

### UC-sig-local-recoverable-state — Wiederherstellbarer Zustand

Das System stellt den Zustand nach einem Neustart wieder her

- Wirkketten: FCHAIN-recoverable-state

### UC-sig-local-resilient-execution — Robuste Ausführung

Das System führt Aufgaben fort, wenn sie unterbrochen werden

- Wirkketten: FCHAIN-resilient-execution

### UC-sig-local-resource-isolation — Ressourcenisolation

Das System trennt Ressourcen zwischen Aufgaben

- Wirkketten: FCHAIN-resource-isolation

### UC-sig-local-scheduled-task — Geplante Aufgabe

Ein Nutzer plant geplante Aufgaben für SIG Local.

- **REQ-scheduled-task-definition** (functional) — Das System muss wiederkehrende Aufgaben definieren und speichern können.
  - erfüllt von: FUNC-sig-local-scheduled-task-accept
  - Test **TEST-scheduled-task-definition**: Aufgabe definieren, speichern und laden.
- **REQ-scheduled-task-execution** (functional) — Das System muss wiederkehrende Aufgaben zu definierten Zeitpunkten ausführen.
  - erfüllt von: —
  - Test **TEST-scheduled-task-execution**: Geplante Aufgabe zu definiertem Zeitpunkt ausführen, prüfen ob ausgeführt.
- **REQ-scheduled-task-retry** (functional) — Das System muss fehlgeschlagene geplante Aufgaben bis zu drei Mal automatisch wiederholen.
  - erfüllt von: —
  - Test **TEST-scheduled-task-retry**: Fehlgeschlagene Aufgaben bis zu drei Mal automatisch wiederholen.
- Wirkketten: FCHAIN-sig-local-scheduled-task

### UC-sig-local-task-verification — Aufgabenprüfung

Ein System prüft Aufgabenergebnisse auf Gültigkeit.

- **REQ-sig-local-task-verification-consistency** (functional) — Das System muss sicherstellen, dass die Ergebnisse der Aufgabenprüfung konsistent sind.
  - erfüllt von: FUNC-session-authenticate
  - Test **TEST-sig-local-task-verification-consistency**: Die Prüfung wird mehrmals durchgeführt, die Ergebnisse werden verglichen.
- **REQ-sig-local-task-verification-dauer** (functional) — Das System muss die Aufgabenprüfung innerhalb von 10 Sekunden abschließen.
  - erfüllt von: FUNC-session-authenticate
  - Test **TEST-sig-local-task-verification-dauer**: Die Aufgabenprüfung wird mehrmals durchgeführt, die Dauer wird gemessen.
- **REQ-sig-local-task-verification-logs** (functional) — Das System muss Protokolle der Aufgabenprüfung erstellen, um Nachvollziehbarkeit zu gewährleisten.
  - erfüllt von: FUNC-session-authenticate
  - Test **TEST-sig-local-task-verification-logs**: Die Prüfung wird durchgeführt, Protokolle werden überprüft.
- **REQ-sig-local-task-verification-retry** (functional) — Das System muss bei einem Fehler in der Aufgabenprüfung bis zu drei Mal versuchen, die Prüfung erneut durchzuführen.
  - erfüllt von: FUNC-session-authenticate
  - Test **TEST-sig-local-task-verification-retry**: Ein Fehler wird simuliert, die Prüfung wird erneut ausgeführt.
- **REQ-sig-local-task-verification-structure** (functional) — Das System muss eine Aufgabenprüfung durchführen, um die Gültigkeit von Ergebnissen zu gewährleisten.
  - erfüllt von: FUNC-session-authenticate
  - Test **TEST-sig-local-task-verification-structure**: Eine Aufgabe wird ausgeführt, das Ergebnis wird auf Gültigkeit geprüft.
- Wirkketten: FCHAIN-task-verification

### UC-sig-local-throughput — Interaktive Sitzung

Ein Nutzer interagiert mit SIG Local zur Laufzeit.

- **REQ-login-dauer** (non-functional) — Das System muss die Anmeldung innerhalb einer Zielzeit abschliessen; Zielwert offen, beim Auftraggeber erfragt.
  - erfüllt von: FCHAIN-interactive-session
  - Test **TEST-login-dauer**: Lastlauf misst p95 der Anmeldung, Grenze Zielwert.
  - Test **TEST-login-passwort**: Lastlauf misst p95 der Anmeldung, Grenze 2 s.
- **REQ-throughput-concurrent** (non-functional) — Das System muss bis zu 10 gleichzeitige interaktive Sitzungen unterstützen.
  - erfüllt von: —
  - Test **TEST-throughput-concurrent**: Bis zu 10 gleichzeitige interaktive Sitzungen unterstützen.
- **REQ-throughput-latency** (non-functional) — Das System muss interaktive Anfragen innerhalb von 5 Sekunden beantworten.
  - erfüllt von: —
  - Test **TEST-throughput-latency**: Interaktive Anfragen innerhalb von 5 Sekunden beantworten.
- Wirkketten: FCHAIN-interactive-session

### UC-task-verification — Aufgabenprüfung

Das System prüft Ergebnisse auf Gültigkeit und Fehler.

- **REQ-task-verification-logs** (functional) — Das System muss bei der Prüfung protokollieren, welche Aufgabe, welcher Anweisung und welches Modells Ergebnis geprüft wurde.
  - erfüllt von: —
  - Test **TEST-task-verification-logs**: Prüfen, ob das Protokoll die Aufgabe, Anweisung und Modell enthält.
- **REQ-task-verification-structure** (functional) — Das System muss Ergebnisse einer Aufgabe auf Gültigkeit und Fehler prüfen.
  - erfüllt von: —
  - Test **TEST-task-verification-structure**: Ergebnis einer Aufgabe prüfen, ob es den erwarteten Struktur- und Inhaltstyp hat.
- Wirkketten: FCHAIN-task-verification

## Anforderungen ausserhalb eines Use Case

- **REQ-aufgaben-pruefung** (functional) — Das System prüft Ergebnisse auf Gültigkeit und Fehler.
  - erfüllt von: FCHAIN-task-verification
  - Test **TEST-verify-aufgaben-pruefung**: it.todo: Prüfe "Aufgabenprüfung" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-ressourcen-isolation** (functional) — Das System trennt Ressourcen zwischen Aufgaben und Modellen.
  - erfüllt von: FCHAIN-resource-isolation
  - Test **TEST-verify-ressourcen-isolation**: it.todo: Prüfe "Ressourcenisolation" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-robuste-ausfuehrung** (functional) — Das System führt Aufgaben fehlerhaft fort, wenn möglich.
  - erfüllt von: FCHAIN-resilient-execution
  - Test **TEST-verify-robuste-ausfuehrung**: it.todo: Prüfe "Robuste Ausführung" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-session-concurrent** (functional) — Das System muss mehrere gleichzeitige Sitzungen verwalten.
  - erfüllt von: FUNC-session-authenticate, FUNC-session-authorize, FUNC-session-handle
  - Test **TEST-verify-session-concurrent**: it.todo: Prüfe "Gleichzeitige Sitzungen" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.

## Wirkketten

### FCHAIN-interactive-session — Interaktive Sitzung

Funktionale Kette zur Abdeckung der UC-interactive-session.

- FUNC-anfrage-annehmen: Nimmt die Anfrage entgegen.
- FUNC-session-handle: Sitzung wird gehandhabt.

### FCHAIN-interaktive-session — Interaktive Sitzung

Funktionale Kette zur Abdeckung der UC-interactive-session

- FUNC-anfrage-annehmen: Nimmt die Anfrage entgegen.
- FUNC-session-authenticate: Nutzer wird authentifiziert
- FUNC-session-authorize: Nutzer wird authorisiert
- FUNC-session-handle: Sitzung wird gehandhabt.

### FCHAIN-offline-operation — Offline-Arbeit

Funktionale Kette zur Abdeckung der UC-offline-operation.

- FUNC-offline-work: Offline-Arbeit wird ausgeführt.

### FCHAIN-recoverable-state — Wiederherstellbarer Zustand

Funktionale Kette zur Abdeckung der UC-recoverable-state.

- FUNC-state-recover: Zustand wird wiederhergestellt.

### FCHAIN-resilient-execution — Robuste Ausführung

Funktionelle Kette zur robusten Ausführung

- FUNC-anfrage-annehmen: Nimmt die Anfrage entgegen.

### FCHAIN-resource-isolation — Ressourcenisolation

Funktionelle Kette zur Ressourcenisolation

- FUNC-anfrage-annehmen: Nimmt die Anfrage entgegen.

### FCHAIN-sig-local-scheduled-task — Geplante Aufgabe

Funktionale Kette zur Ausführung geplanter Aufgaben

- FUNC-sig-local-scheduled-task-accept: Akzeptiert eine geplante Aufgabe

### FCHAIN-task-verification — Aufgabenprüfung

Funktionelle Kette zur Aufgabenprüfung

- FUNC-anfrage-annehmen: Nimmt die Anfrage entgegen.

## Funktionen ausserhalb einer Wirkkette

- FUNC-session-establish: Sitzung wird etabliert.

## Flüsse und Verträge

- **FLOW-anfrage** (ACTOR-nutzer → FUNC-anfrage-annehmen; Vertrag SCHEMA-anfrage): Anfrage des Nutzers an das System
- **FLOW-interaktive-anfrage** (ACTOR-nutzer → FUNC-anfrage-annehmen; Vertrag SCHEMA-anfrage-verbund): Anfrage des Nutzers an das System
- **FLOW-offline-task** (ACTOR-nutzer → FUNC-offline-work; Vertrag SCHEMA-offline-task): Anfrage einer Offline-Aufgabe.
- **FLOW-session-request** (ACTOR-nutzer → FUNC-session-establish; Vertrag SCHEMA-session-request): Anfrage einer Sitzung.
- **FLOW-sig-local-scheduled-task** (ACTOR-nutzer-sig-local → FUNC-sig-local-scheduled-task-accept; Vertrag SCHEMA-sig-local-scheduled-task): Anfrage zur Ausführung einer geplanten Aufgabe
- **FLOW-state-restore** (ACTOR-nutzer → FUNC-state-recover; Vertrag SCHEMA-state-restore): Anfrage zur Zustandswiederherstellung.
- Vertrag **SCHEMA-anfrage**: Form der Anfrage: Text und Sitzungs-ID
- Vertrag **SCHEMA-anfrage-verbund**: Form der Anfrage: Text und Sitzungs-ID
- Vertrag **SCHEMA-offline-task**: Vertrag für Offline-Aufgaben.
- Vertrag **SCHEMA-session-request**: Vertrag für Sitzungsanfragen.
- Vertrag **SCHEMA-sig-local-scheduled-task**: Vertrag für geplante Aufgaben
- Vertrag **SCHEMA-state-restore**: Vertrag für Zustandswiederherstellungsanfragen.

## Module

