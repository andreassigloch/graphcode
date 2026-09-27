# Spec F

**System SYS-sig-local** — Eigene LLM-Rechenkapazitaet im internen Netz, vollstaendig lokal: tagsueber interaktiv bedient, nachts selbstaendig arbeitend, unterwegs lokal.

## Akteure

- **ACTOR-device** — Ein Gerät, das die lokale Instanz nutzt, wenn kein Netzwerk verfügbar ist.
- **ACTOR-external-service** — Ein externer Dienst, der Ergebnisse abfragt oder sendet.
- **ACTOR-scheduler** — Ein externer Dienst, der geplante Aufgaben auslöst.
- **ACTOR-user** — Ein menschlicher Nutzer, der interaktiv mit dem System kommuniziert.

## Use Cases mit ihren Anforderungen

### UC-interactive-session — Interaktive Sitzung

Ein Nutzer interagiert mit dem System zur Erledigung einer Aufgabe.

- **REQ-interactive-session-auth** (functional) — Das System muss Nutzer per Passwort in unter 2 s anmelden.
  - erfüllt von: FCHAIN-interaktive-session
  - Test **TEST-interactive-session-auth**: Anmeldung mit gültigem Passwort, Zeit gemessen, Grenze 2 s.
- **REQ-interactive-session-limit** (non-functional) — Das System muss pro Sitzung eine maximale Laufzeit von 8 h erzwingen.
  - erfüllt von: FCHAIN-interaktive-session
  - Test **TEST-interactive-session-limit**: Sitzung über 8 h laufen lassen, System muss Sitzung beenden.
- **REQ-interaktive-session** (non-functional) — Das System muss interaktive Anfragen innerhalb einer Zielzeit beantworten; Zielwert offen, beim Auftraggeber erfragt.
  - erfüllt von: FCHAIN-interaktive-session
  - Test **TEST-verify-interaktive-session**: it.todo: Prüfe "Interaktive Sitzung" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-login-dauer** (non-functional) — Das System muss die Anmeldung innerhalb einer Zielzeit abschliessen; Zielwert offen, beim Auftraggeber erfragt.
  - erfüllt von: —
  - Test **TEST-login-dauer**: Lastlauf misst p95 der Anmeldung, Grenze Zielzeit.
- Wirkketten: FCHAIN-interaktive-session

### UC-offline-operation — Offline-Nutzung

Ein Gerät verwendet die lokale Instanz, wenn der Rechner nicht im Netz ist.

- **REQ-offline-operation** (non-functional) — Das System muss Offline-Anfragen innerhalb einer Zielzeit beantworten; Zielwert offen, beim Auftraggeber erfragt.
  - erfüllt von: —
  - Test **TEST-verify-offline-operation**: it.todo: Prüfe "Offline-Nutzung" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-resume** (functional) — Das System muss nach einem Neustart fehlende Aufgaben nachholen.
  - erfüllt von: —
  - Test **TEST-offline-operation-resume**: Neustart simulieren, fehlende Aufgaben müssen nachgeholt werden.
- **REQ-offline-operation-retry** (functional) — Das System muss fehlgeschlagene Aufgaben bis zu 3 Mal wiederholen.
  - erfüllt von: —
  - Test **TEST-offline-operation-retry**: Fehlgeschlagene Aufgabe wiederholen, bis zu 3 Mal.
- Wirkketten: FCHAIN-offline-operation

### UC-resilient-execution — Resiliente Ausführung

Das System führt Aufgaben fort, auch wenn der Rechner ausgeschaltet wird.

- **REQ-resilient-execution** (non-functional) — Das System muss resiliente Aufgaben fortsetzen, auch wenn der Rechner ausgeschaltet wird; Zielwert offen, beim Auftraggeber erfragt.
  - erfüllt von: —
  - Test **TEST-verify-resilient-execution**: it.todo: Prüfe "Resiliente Ausführung" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-resilient-execution-isolation** (functional) — Das System muss Aufgaben isoliert ausführen, sodass eine fehlschlägt, die anderen nicht beeinflussen.
  - erfüllt von: FUNC-anfrage-annehmen, FUNC-aufgabe-aufnehmen, FUNC-offline-anfrage-annehmen
  - Test **TEST-resilient-execution-isolation**: Zwei Aufgaben gleichzeitig starten, eine fehlschlägt, andere laufen weiter.
- **REQ-resilient-execution-recovery** (non-functional) — Das System muss bei einem Fehler in einer Aufgabe den Zustand vor dem Fehler wiederherstellen.
  - erfüllt von: —
  - Test **TEST-resilient-execution-recovery**: Fehler in Aufgabe auslösen, Zustand vor Fehler wiederherstellen.
- Wirkketten: FCHAIN-resilient-execution

### UC-scheduled-task — Geplanter Task

Ein Auftrag wird automatisch zur geplanten Zeit ausgeführt.

- **REQ-geplanter-task-zeitsteuerung** (functional) — Der Task muss zeitgesteuert ausgeführt werden.
  - erfüllt von: FCHAIN-scheduled-task, FUNC-geplanter-task-annehmen, FUNC-geplanter-task-erfolgreich-abschliessen, FUNC-geplanter-task-fehlerhaft-abschliessen, FUNC-geplanter-task-protokollieren, FUNC-geplanter-task-ueberwachen, FUNC-geplanter-task-verarbeiten, FUNC-geplanter-task-zeitsteuerung
  - Test **TEST-verify-geplanter-task-zeitsteuerung**: it.todo: Prüfe "Geplanter Task Zeitsteuerung" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-scheduled-task-recovery** (functional) — Das System muss bei einem Neustart ausstehende geplante Aufgaben nachholen.
  - erfüllt von: —
  - Test **TEST-scheduled-task-recovery**: Neustart simulieren, ausstehende Aufgaben nachholen, prüfen.
- **REQ-scheduled-task-time** (functional) — Das System muss geplante Aufgaben zur vorgegebenen Zeit ausführen.
  - erfüllt von: —
  - Test **TEST-scheduled-task-time**: Geplante Aufgabe zur vorgegebenen Zeit ausführen, Zeit messen.
- Wirkketten: FCHAIN-scheduled-task

### UC-task-traceability — Traceability

Das System dokumentiert die Herkunft jedes Ergebnisses.

- **REQ-task-traceability-details** (functional) — Das System muss für jedes Ergebnis den verwendeten Prompt und das Modell angeben.
  - erfüllt von: —
  - Test **TEST-task-traceability-details**: Ergebnis prüfen, Prompt und Modell angegeben?
- **REQ-task-traceability-origins** (functional) — Das System muss die Herkunft jedes Ergebnisses dokumentieren.
  - erfüllt von: —
  - Test **TEST-task-traceability-origins**: Ergebnis prüfen, Herkunft dokumentiert?
- Wirkketten: FCHAIN-task-traceability

### UC-task-validation — Aufgabenvalidierung

Das System prüft Ergebnisse auf Gültigkeit und Fehler.

- **REQ-task-validation-format** (functional) — Das System muss Ergebnisse auf korrektes Format prüfen.
  - erfüllt von: —
  - Test **TEST-task-validation-format**: Ergebnis prüfen, Format korrekt?
- **REQ-task-validation-retry** (functional) — Das System muss fehlerhafte Ergebnisse automatisch erneut versuchen.
  - erfüllt von: —
  - Test **TEST-task-validation-retry**: Ergebnis fehlerhaft, erneut versuchen, prüfen.
- Wirkketten: FCHAIN-task-validation

## Anforderungen ausserhalb eines Use Case

- **REQ-task-availability** (functional) — Das System muss nach einem Neustart alle Aufgaben automatisch fortsetzen.
  - erfüllt von: FUNC-task-availability
  - Test **TEST-verify-task-availability**: it.todo: Prüfe "Aufgabenverfügbarkeit" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-task-isolation** (functional) — Das System muss sicherstellen, dass Aufgaben nicht sich gegenseitig beeinflussen.
  - erfüllt von: FUNC-task-isolation
  - Test **TEST-verify-task-isolation**: it.todo: Prüfe "Aufgabenisolation" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-task-result-processing** (functional) — Das System muss Ergebnisse verarbeiten, validieren und ggf. erneut versuchen.
  - erfüllt von: FUNC-task-result-processing
  - Test **TEST-verify-task-result-processing**: it.todo: Prüfe "REQ-task-result-processing" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-task-result-validation** (functional) — Das System muss Ergebnisse auf Gültigkeit prüfen.
  - erfüllt von: FUNC-task-result-processing, FUNC-task-validation
  - Test **TEST-verify-task-result-validation**: it.todo: Prüfe "Ergebnisvalidierung" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-task-scheduling** (functional) — Das System muss geplante Aufgaben zu ihrem Zeitpunkt ausführen.
  - erfüllt von: FUNC-task-scheduling
  - Test **TEST-verify-task-scheduling**: it.todo: Prüfe "Taskplanung" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-task-traceability** (functional) — Das System muss die Herkunft jedes Ergebnisses nachvollziehen können.
  - erfüllt von: FUNC-task-traceability, FUNC-task-traceability-erfassen
  - Test **TEST-task-traceability-integration**: Integrationstest für Traceability.
  - Test **TEST-verify-task-traceability**: it.todo: Prüfe "Traceability" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.

## Wirkketten

### FCHAIN-geplanter-task-zeitsteuerung — Geplanter Task Zeitsteuerung

Geplanter Task Zeitsteuerung.

- FUNC-geplanter-task-zeitsteuerung: Zeitsteuerung für Task-Ausführung.

### FCHAIN-interaktive-session — Interaktive Sitzung

Funktionale Kette für interaktive Sitzungen

- FUNC-anfrage-annehmen: Nimmt die interaktive Anfrage entgegen.

### FCHAIN-offline-operation — Offline-Nutzung

Funktionale Kette für Offline-Nutzung

- FUNC-offline-anfrage-annehmen: Nimmt die Offline-Anfrage entgegen.

### FCHAIN-resilient-execution — Resiliente Ausführung

Funktionale Kette für resiliente Ausführung

- FUNC-aufgabe-aufnehmen: Nimmt eine resiliente Aufgabe entgegen.

### FCHAIN-scheduled-task — Geplanter Task

Funktionale Kette für geplante Tasks

- FUNC-geplanter-task-annehmen: Nimmt die Anfrage eines geplanten Tasks entgegen.
- FUNC-scheduled-task-execution: Fuehrt den geplanten Task aus.
- FUNC-task-ausfuehrung: Ausführung des geplanten Tasks.
- FUNC-task-completion: Task ist abgeschlossen.
- FUNC-task-ergebnis: Ergebnis des geplanten Tasks.
- FUNC-task-execution: Task wird ausgeführt.
- FUNC-task-planung: Planung des geplanten Tasks.
- FUNC-task-result-processing: Ergebnis wird verarbeitet.
- FUNC-task-scheduling: Task wird zur geplanten Zeit ausgeführt.

### FCHAIN-task-traceability — Traceability

Funktionale Kette für Traceability

- FUNC-task-traceability: Erfasst die Herkunft des Ergebnisses.
- FUNC-task-traceability-annehmen: Nimmt die Anfrage zur Traceability entgegen.
- FUNC-task-traceability-erfassen: Traceability für einen Task erfassen.
- FUNC-traceability-data-collection: Daten werden gesammelt.
- FUNC-traceability-data-tracking: Daten werden nachverfolgt.
- FUNC-traceability-dokumentieren: Dokumentieren der Traceability.
- FUNC-traceability-erfassen: Erfassen der Traceability.
- FUNC-traceability-logging: Ergebnis wird dokumentiert.
- FUNC-traceability-reporting: Bericht wird erstellt.
- FUNC-traceability-result-tracking: Ergebnis wird nachverfolgt.
- FUNC-traceability-verifizieren: Verifizieren der Traceability.

### FCHAIN-task-validation — Aufgabenvalidierung

Funktionale Kette für Aufgabenvalidierung

- FUNC-task-validation: Prueft das Ergebnis auf Fehler.
- FUNC-task-validation-annehmen: Nimmt die Anfrage zur Aufgabenvalidierung entgegen.
- FUNC-validation-check: Ergebnis wird geprüft.
- FUNC-validation-ergebnis: Validierung des Ergebnisses.
- FUNC-validation-error-handling: Fehler werden behandelt.
- FUNC-validation-fehler: Prüfung auf Fehler.
- FUNC-validation-format: Formatprüfung des Ergebnisses.
- FUNC-validation-input-check: Eingabe wird geprüft.
- FUNC-validation-output-check: Ausgabe wird geprüft.
- FUNC-validation-result-check: Ergebnis wird auf Gültigkeit geprüft.
- FUNC-validation-result-logging: Ergebnis wird protokolliert.
- FUNC-validation-result-processing: Ergebnis wird verarbeitet.

## Funktionen ausserhalb einer Wirkkette

- FUNC-geplanter-task-erfolgreich-abschliessen: Task wurde erfolgreich abgeschlossen.
- FUNC-geplanter-task-fehlerhaft-abschliessen: Task wurde fehlerhaft abgeschlossen.
- FUNC-geplanter-task-protokollieren: Task wird protokolliert.
- FUNC-geplanter-task-ueberwachen: Task wird überwacht und ggf. nachgeholt.
- FUNC-geplanter-task-verarbeiten: Task wird aus der Warteschlange entnommen und ausgeführt.
- FUNC-task-availability: Aufgaben werden nach Neustart fortgesetzt.
- FUNC-task-isolation: Aufgaben werden isoliert ausgeführt.

## Flüsse und Verträge

- **FLOW-geplanter-task** (ACTOR-scheduler → FUNC-geplanter-task-annehmen; Vertrag SCHEMA-geplanter-task): Anfrage des Planers an das System zur Ausführung eines geplanten Tasks
- **FLOW-geplanter-task-zeitsteuerung** (— → FUNC-geplanter-task-zeitsteuerung; Vertrag SCHEMA-geplanter-task-zeitsteuerung): Geplanter Task Zeitsteuerung.
- **FLOW-interaktive-anfrage** (ACTOR-user → FUNC-anfrage-annehmen; Vertrag SCHEMA-interaktive-anfrage): Anfrage des Nutzers an das System in einer interaktiven Sitzung
- **FLOW-offline-anfrage** (ACTOR-device → FUNC-offline-anfrage-annehmen; Vertrag SCHEMA-offline-anfrage): Anfrage des Geräts an das System in einer Offline-Nutzung
- **FLOW-resilient-aufgabe** (ACTOR-scheduler → FUNC-aufgabe-aufnehmen; Vertrag SCHEMA-resilient-aufgabe): Aufgabe, die auch bei Unterbrechung fortgeführt wird
- **FLOW-scheduled-task** (ACTOR-user → FUNC-scheduled-task-execution; Vertrag SCHEMA-scheduled-task): Geplanter Task wird ausgefuehrt
- **FLOW-task-traceability** (ACTOR-user → FUNC-task-traceability, FUNC-task-traceability-annehmen; Vertrag SCHEMA-task-traceability): Anfrage des Nutzers an das System zur Dokumentation der Herkunft eines Ergebnisses
- **FLOW-task-traceability-ausgehend** (FUNC-task-traceability-erfassen → —; Vertrag SCHEMA-task-traceability): Ausgehender Fluss zur Traceability.
- **FLOW-task-traceability-eingehend** (FUNC-task-traceability-erfassen → —; Vertrag SCHEMA-task-traceability): Eingehender Fluss zur Traceability.
- **FLOW-task-validation** (ACTOR-user → FUNC-task-validation, FUNC-task-validation-annehmen; Vertrag SCHEMA-task-validation): Anfrage des Nutzers an das System zur Prüfung eines Ergebnisses
- Vertrag **SCHEMA-geplanter-task**: Form der Anfrage: Task-ID, Zeitpunkt, Parameter
- Vertrag **SCHEMA-geplanter-task-zeitsteuerung**: Geplanter Task Zeitsteuerung.
- Vertrag **SCHEMA-interaktive-anfrage**: Form der Anfrage: Text und Sitzungs-ID
- Vertrag **SCHEMA-offline-anfrage**: Form der Anfrage: Text und Sitzungs-ID
- Vertrag **SCHEMA-resilient-aufgabe**: Form der Aufgabe: Task-Definition und Zeitstempel
- Vertrag **SCHEMA-scheduled-task**: Form der Aufgabe: Name, Zeit, Skript
- Vertrag **SCHEMA-task-traceability**: Form der Anfrage: Ergebnis-ID, Ursprungsdaten
- Vertrag **SCHEMA-task-validation**: Form der Anfrage: Ergebnis-ID, Prüfparameter

## Module

- **MOD-scheduled-task-execution**: Modul zur Ausführung geplanter Tasks. — enthält FUNC-anfrage-annehmen, FUNC-aufgabe-aufnehmen, FUNC-geplanter-task-annehmen, FUNC-geplanter-task-erfolgreich-abschliessen, FUNC-geplanter-task-fehlerhaft-abschliessen, FUNC-geplanter-task-protokollieren, FUNC-geplanter-task-ueberwachen, FUNC-geplanter-task-verarbeiten, FUNC-geplanter-task-zeitsteuerung, FUNC-offline-anfrage-annehmen, FUNC-scheduled-task-execution, FUNC-task-planung
- **MOD-task-completion**: Task-Completion, extern schwach gekoppelt. — enthält FUNC-task-completion, FUNC-task-ergebnis
- **MOD-task-execution**: Task-Ausführung, extern schwach gekoppelt. — enthält FUNC-task-ausfuehrung, FUNC-task-execution, FUNC-task-isolation
- **MOD-task-result-processing**: Modul zur Ergebnisverarbeitung. — enthält FUNC-task-result-processing
- **MOD-task-scheduling**: Modul zur Aufgabenplanung. — enthält FUNC-task-availability, FUNC-task-scheduling
- **MOD-task-traceability**: Modul zur Aufgaben-Traceability. — enthält FUNC-task-traceability, FUNC-task-traceability-annehmen, FUNC-task-traceability-erfassen
- **MOD-task-validation**: Modul zur Aufgabenvalidierung. — enthält FUNC-task-validation, FUNC-task-validation-annehmen
