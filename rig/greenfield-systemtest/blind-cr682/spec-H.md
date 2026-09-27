# Spec H

**System SYS-sig-local** — Eigene LLM-Rechenkapazitaet im internen Netz, vollstaendig lokal: tagsueber interaktiv bedient, nachts selbstaendig arbeitend, unterwegs lokal.

## Akteure

- **ACTOR-device** — Ein Gerät, das im Offline-Modus arbeitet.
- **ACTOR-nutzer** — Ein Nutzer, der interaktiv mit dem System kommuniziert.
- **ACTOR-scheduler** — Ein externer Scheduler, der geplante Aufgaben auslöst.

## Use Cases mit ihren Anforderungen

### UC-interactive-session — Interaktive Sitzung

Ein Nutzer interagiert mit dem System zur Erledigung einer Aufgabe.

- **REQ-interactive-session-auth** (functional) — Das System muss Nutzer bei interaktiver Sitzung per Passwort authentifizieren.
  - erfüllt von: FCHAIN-interactive-session
  - Test **TEST-interactive-session-auth**: Nutzer anmelden, Passwort pruefen, Authentifizierung erfolgreich.
- **REQ-interactive-session-limit** (non-functional) — Das System muss interaktive Sitzungen innerhalb von 2 s beantworten.
  - erfüllt von: FCHAIN-interactive-session
  - Test **TEST-interactive-session-limit**: Interaktive Sitzung starten, Antwortzeit messen, Grenze 2 s.
- **REQ-interactive-session-req-auth** (functional) — Das System muss Nutzer per Passwort in unter 2 s anmelden.
  - erfüllt von: FCHAIN-interactive-session, FUNC-interactive-session-accept
  - Test **TEST-interactive-session-req-auth**: Lastlauf misst p95 der Anmeldung, Grenze 2 s.
- **REQ-login-dauer** (non-functional) — Das System muss die Anmeldung innerhalb einer Zielzeit abschliessen; Zielwert offen, beim Auftraggeber erfragt.
  - erfüllt von: FCHAIN-interactive-session
  - Test **TEST-login-dauer**: Lastlauf misst p95 der Anmeldung, Grenze Zielwert.
- **REQ-login-passwort** (functional) — Das System muss Nutzer per Passwort in unter 2 s anmelden.
  - erfüllt von: FUNC-interactive-session-accept
  - Test **TEST-login-passwort**: Lastlauf misst p95 der Anmeldung, Grenze 2 s.
- Wirkketten: FCHAIN-interactive-session

### UC-offline-operation — Offline-Betrieb

Das System arbeitet lokal, wenn kein Netzwerk verfügbar ist.

- **REQ-offline-operation-persist** (functional) — Das System muss Zustand bei Netzwerkunterbrechung erhalten.
  - erfüllt von: FUNC-offline-operation-accept
  - Test **TEST-offline-operation-persist**: Netzwerk trennen, Zustand speichern, Netzwerk wiederherstellen, Zustand wiederherstellen.
- **REQ-offline-operation-resume** (functional) — Das System muss Offline-Betrieb nach Netzwerkverbindung wieder aufnehmen.
  - erfüllt von: FCHAIN-interactive-session
  - Test **TEST-offline-operation-resume**: Netzwerk trennen, Aufgabe ausloesen, Netzwerk wiederherstellen, Aufgabe fortsetzen.
- Wirkketten: FCHAIN-interactive-session

### UC-scheduled-task — Nachtlauf

Das System führt geplante Aufgaben nachts aus.

- **REQ-scheduled-task-coord** (functional) — Das System muss gleichzeitige Nachtlauf-Aufgaben koordinieren.
  - erfüllt von: FUNC-scheduled-task-accept
  - Test **TEST-scheduled-task-coord**: Zwei gleichzeitige Aufgaben starten, Konflikte vermeiden.
- **REQ-scheduled-task-req-auth** (functional) — Das System muss Nutzer per Passwort in unter 2 s anmelden.
  - erfüllt von: FUNC-scheduled-task-accept
  - Test **TEST-scheduled-task-req-auth**: Lastlauf misst p95 der Anmeldung, Grenze 2 s.
- **REQ-scheduled-task-retry** (functional) — Das System muss fehlgeschlagene Nachtlauf-Aufgaben nach einer Frist erneut versuchen.
  - erfüllt von: FUNC-scheduled-task-accept
  - Test **TEST-scheduled-task-retry**: Aufgabe fehlschlagen lassen, Frist abwarten, Aufgabe erneut ausloesen.
- Wirkketten: FCHAIN-interactive-session

## Anforderungen ausserhalb eines Use Case

- **REQ-offline-operation-accept-decompose-1** (functional) — Das System muss die Offline-Operation entgegennehmen.
  - erfüllt von: FUNC-offline-operation-accept-decompose-1
  - Test **TEST-verify-offline-operation-accept-decompose-1**: it.todo: Prüfe "Offline-Operation entgegennehmen" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-accept-decompose-1-alt1** (functional) — Das System muss die Offline-Operation entgegennehmen (Alternative 1).
  - erfüllt von: FUNC-offline-operation-accept-decompose-1-alt1
  - Test **TEST-verify-offline-operation-accept-decompose-1-alt1**: it.todo: Prüfe "Offline-Operation entgegennehmen (Alternative 1)" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-accept-decompose-1-alt2** (functional) — Das System muss die Offline-Operation entgegennehmen (Alternative 2).
  - erfüllt von: FUNC-offline-operation-accept-decompose-1-alt2
  - Test **TEST-verify-offline-operation-accept-decompose-1-alt2**: it.todo: Prüfe "Offline-Operation entgegennehmen (Alternative 2)" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-accept-decompose-1-alt2-alt1** (functional) — Das System muss die Offline-Operation entgegennehmen (Alternative 2, Teil 1).
  - erfüllt von: FUNC-offline-operation-accept-decompose-1-alt2-alt1
  - Test **TEST-verify-offline-operation-accept-decompose-1-alt2-alt1**: Verify: Offline-Operation entgegennehmen (Alternative 2, Teil 1)
- **REQ-offline-operation-accept-decompose-1-alt2-alt2** (functional) — Das System muss die Offline-Operation entgegennehmen (Alternative 2, Teil 2).
  - erfüllt von: FUNC-offline-operation-accept-decompose-1-alt2-alt2
  - Test **TEST-verify-offline-operation-accept-decompose-1-alt2-alt2**: Verify: Offline-Operation entgegennehmen (Alternative 2, Teil 2)
- **REQ-offline-operation-accept-decompose-1-alt2-alt3** (functional) — Das System muss die Offline-Operation entgegennehmen (Alternative 2, Teil 3).
  - erfüllt von: FUNC-offline-operation-accept-decompose-1-alt2-alt3
  - Test **TEST-verify-offline-operation-accept-decompose-1-alt2-alt3**: Verify: Offline-Operation entgegennehmen (Alternative 2, Teil 3)
- **REQ-offline-operation-accept-decompose-1-alt3** (functional) — Das System muss die Offline-Operation entgegennehmen (Alternative 3).
  - erfüllt von: FUNC-offline-operation-accept-decompose-1-alt3
  - Test **TEST-verify-offline-operation-accept-decompose-1-alt3**: Verify: Offline-Operation entgegennehmen (Alternative 3)
- **REQ-offline-operation-accept-decompose-1-alt3-alt1** (functional) — Das System muss die Offline-Operation entgegennehmen (Alternative 3, Teil 1).
  - erfüllt von: FUNC-offline-operation-accept-decompose-1-alt3-alt1
  - Test **TEST-verify-offline-operation-accept-decompose-1-alt3-alt1**: Verify: Offline-Operation entgegennehmen (Alternative 3, Teil 1)
- **REQ-offline-operation-accept-decompose-1-alt3-alt2** (functional) — Das System muss die Offline-Operation entgegennehmen (Alternative 3, Teil 2).
  - erfüllt von: FUNC-offline-operation-accept-decompose-1-alt3-alt2
  - Test **TEST-verify-offline-operation-accept-decompose-1-alt3-alt2**: Verify: Offline-Operation entgegennehmen (Alternative 3, Teil 2)
- **REQ-offline-operation-accept-decompose-1-alt3-alt3** (functional) — Das System muss die Offline-Operation entgegennehmen (Alternative 3, Teil 3).
  - erfüllt von: FUNC-offline-operation-accept-decompose-1-alt3-alt3
  - Test **TEST-verify-offline-operation-accept-decompose-1-alt3-alt3**: Verify: Offline-Operation entgegennehmen (Alternative 3, Teil 3)
- **REQ-offline-operation-accept-decompose-1-alt4** (functional) — Das System muss die Offline-Operation entgegennehmen (Alternative 4).
  - erfüllt von: FUNC-offline-operation-accept-decompose-1-alt4
  - Test **TEST-verify-offline-operation-accept-decompose-1-alt4**: it.todo: Prüfe "Offline-Operation entgegennehmen (Alternative 4)" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-accept-decompose-1-alt5** (functional) — Das System muss die Offline-Operation entgegennehmen (Alternative 5).
  - erfüllt von: FUNC-offline-operation-accept-decompose-1-alt5
  - Test **TEST-verify-offline-operation-accept-decompose-1-alt5**: it.todo: Prüfe "Offline-Operation entgegennehmen (Alternative 5)" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-accept-decompose-1-alt6** (functional) — Das System muss die Offline-Operation entgegennehmen (Alternative 6).
  - erfüllt von: FUNC-offline-operation-accept-decompose-1-alt6
  - Test **TEST-verify-offline-operation-accept-decompose-1-alt6**: it.todo: Prüfe "Offline-Operation entgegennehmen (Alternative 6)" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-accept-decompose-2** (functional) — Das System muss die Offline-Operation validieren.
  - erfüllt von: FUNC-offline-operation-accept-decompose-2
  - Test **TEST-verify-offline-operation-accept-decompose-2**: it.todo: Prüfe "Offline-Operation validieren" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-accept-decompose-2-alt1** (functional) — Das System muss die Offline-Operation validieren (Alternative 1).
  - erfüllt von: FUNC-offline-operation-accept-decompose-2-alt1
  - Test **TEST-verify-offline-operation-accept-decompose-2-alt1**: it.todo: Prüfe "Offline-Operation validieren (Alternative 1)" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-accept-decompose-2-alt2** (functional) — Das System muss die Offline-Operation validieren (Alternative 2).
  - erfüllt von: FUNC-offline-operation-accept-decompose-2-alt2
  - Test **TEST-verify-offline-operation-accept-decompose-2-alt2**: it.todo: Prüfe "Offline-Operation validieren (Alternative 2)" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-accept-decompose-2-alt3** (functional) — Das System muss die Offline-Operation validieren (Alternative 3).
  - erfüllt von: FUNC-offline-operation-accept-decompose-2-alt3
  - Test **TEST-verify-offline-operation-accept-decompose-2-alt3**: Verify: Offline-Operation validieren (Alternative 3)
- **REQ-offline-operation-accept-decompose-2-alt4** (functional) — Das System muss die Offline-Operation validieren (Alternative 4).
  - erfüllt von: FUNC-offline-operation-accept-decompose-2-alt4
  - Test **TEST-verify-offline-operation-accept-decompose-2-alt4**: it.todo: Prüfe "Offline-Operation validieren (Alternative 4)" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-accept-decompose-2-alt5** (functional) — Das System muss die Offline-Operation validieren (Alternative 5).
  - erfüllt von: FUNC-offline-operation-accept-decompose-2-alt5
  - Test **TEST-verify-offline-operation-accept-decompose-2-alt5**: it.todo: Prüfe "Offline-Operation validieren (Alternative 5)" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-accept-decompose-2-alt6** (functional) — Das System muss die Offline-Operation validieren (Alternative 6).
  - erfüllt von: FUNC-offline-operation-accept-decompose-2-alt6
  - Test **TEST-verify-offline-operation-accept-decompose-2-alt6**: it.todo: Prüfe "Offline-Operation validieren (Alternative 6)" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-accept-decompose-3** (functional) — Das System muss die Offline-Operation decodieren.
  - erfüllt von: FUNC-offline-operation-accept-decompose-3
  - Test **TEST-verify-offline-operation-accept-decompose-3**: it.todo: Prüfe "Offline-Operation decodieren" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-accept-decompose-3-alt1** (functional) — Das System muss die Offline-Operation decodieren (Alternative 1).
  - erfüllt von: FUNC-offline-operation-accept-decompose-3-alt1
  - Test **TEST-verify-offline-operation-accept-decompose-3-alt1**: it.todo: Prüfe "Offline-Operation decodieren (Alternative 1)" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-accept-decompose-3-alt2** (functional) — Das System muss die Offline-Operation decodieren (Alternative 2).
  - erfüllt von: FUNC-offline-operation-accept-decompose-3-alt2
  - Test **TEST-verify-offline-operation-accept-decompose-3-alt2**: it.todo: Prüfe "Offline-Operation decodieren (Alternative 2)" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-accept-decompose-3-alt3** (functional) — Das System muss die Offline-Operation decodieren (Alternative 3).
  - erfüllt von: FUNC-offline-operation-accept-decompose-3-alt3
  - Test **TEST-verify-offline-operation-accept-decompose-3-alt3**: Verify: Offline-Operation decodieren (Alternative 3)
- **REQ-offline-operation-accept-decompose-3-alt4** (functional) — Das System muss die Offline-Operation decodieren (Alternative 4).
  - erfüllt von: FUNC-offline-operation-accept-decompose-3-alt4
  - Test **TEST-verify-offline-operation-accept-decompose-3-alt4**: it.todo: Prüfe "Offline-Operation decodieren (Alternative 4)" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-accept-decompose-3-alt5** (functional) — Das System muss die Offline-Operation decodieren (Alternative 5).
  - erfüllt von: FUNC-offline-operation-accept-decompose-3-alt5
  - Test **TEST-verify-offline-operation-accept-decompose-3-alt5**: it.todo: Prüfe "Offline-Operation decodieren (Alternative 5)" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-accept-decompose-3-alt6** (functional) — Das System muss die Offline-Operation decodieren (Alternative 6).
  - erfüllt von: FUNC-offline-operation-accept-decompose-3-alt6
  - Test **TEST-verify-offline-operation-accept-decompose-3-alt6**: it.todo: Prüfe "Offline-Operation decodieren (Alternative 6)" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-accept-decompose-4** (functional) — Das System muss die Offline-Operation speichern.
  - erfüllt von: FUNC-offline-operation-accept-decompose-4
  - Test **TEST-verify-offline-operation-accept-decompose-4**: it.todo: Prüfe "Offline-Operation speichern" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-accept-decompose-5** (functional) — Das System muss die Offline-Operation ausführen.
  - erfüllt von: FUNC-offline-operation-accept-decompose-5
  - Test **TEST-verify-offline-operation-accept-decompose-5**: it.todo: Prüfe "Offline-Operation ausführen" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-accept-decompose-6** (functional) — Das System muss die Offline-Operation nach Wiederanbindung abschließen.
  - erfüllt von: FUNC-offline-operation-accept-decompose-6
  - Test **TEST-verify-offline-operation-accept-decompose-6**: it.todo: Prüfe "Wiederanbindung abschließen" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-accept-decompose-7** (functional) — Das System muss die Offline-Operation nach Wiederanbindung initialisieren.
  - erfüllt von: FUNC-offline-operation-accept-decompose-7
  - Test **TEST-verify-offline-operation-accept-decompose-7**: it.todo: Prüfe "Wiederanbindung initialisieren" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-decode** (functional) — Das System muss Offline-Operationen decodieren können. |
  - erfüllt von: FUNC-offline-operation-decode
  - Test **TEST-verify-offline-operation-decode**: it.todo: Prüfe "Offline-Operation decodieren" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-execute** (functional) — Das System muss Offline-Operationen ausführen können. |
  - erfüllt von: FUNC-offline-operation-execute
  - Test **TEST-verify-offline-operation-execute**: it.todo: Prüfe "Offline-Operation ausführen" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-resume-complete** (functional) — Das System muss Wiederanbindung abschließen können. |
  - erfüllt von: FUNC-offline-operation-resume-complete
  - Test **TEST-verify-offline-operation-resume-complete**: it.todo: Prüfe "Wiederanbindung abschließen" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-resume-init** (functional) — Das System muss Wiederanbindung initialisieren können. |
  - erfüllt von: FUNC-offline-operation-resume-init
  - Test **TEST-verify-offline-operation-resume-init**: it.todo: Prüfe "Wiederanbindung initialisieren" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-resume-process** (functional) — Das System muss Wiederanbindung verarbeiten können. |
  - erfüllt von: FUNC-offline-operation-resume-process
  - Test **TEST-verify-offline-operation-resume-process**: it.todo: Prüfe "Wiederanbindung verarbeiten" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-resume-verify** (functional) — Das System muss Offline-Betrieb nach Netzwerkverbindung wieder aufnehmen.
  - erfüllt von: FUNC-offline-operation-resume-verify
  - Test **TEST-offline-operation-resume-verify**: Netzwerk trennen, Aufgabe ausloesen, Netzwerk wiederherstellen, Aufgabe fortsetzen.
- **REQ-offline-operation-store** (functional) — Das System muss Offline-Operationen speichern können. |
  - erfüllt von: FUNC-offline-operation-store
  - Test **TEST-verify-offline-operation-store**: it.todo: Prüfe "Offline-Operation speichern" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-offline-operation-validate** (functional) — Das System muss Offline-Operationen validieren können. |
  - erfüllt von: FUNC-offline-operation-validate
  - Test **TEST-verify-offline-operation-validate**: it.todo: Prüfe "Offline-Operation validieren" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.

## Wirkketten

### FCHAIN-interactive-session — FChain Interaktive Sitzung

Funktionale Kette fuer interaktive Sitzungen

- FUNC-interactive-session-accept: Akzeptiert die interaktive Sitzung.
- FUNC-offline-operation-accept: Nimmt die Offline-Operation entgegen.
- FUNC-offline-operation-accept-decompose-1: Offline-Operation entgegennehmen (Zerlegung 1)
- FUNC-offline-operation-accept-decompose-2: Offline-Operation entgegennehmen (Zerlegung 2)
- FUNC-offline-operation-accept-decompose-3: Offline-Operation entgegennehmen (Zerlegung 3)
- FUNC-offline-operation-accept-decompose-4: Offline-Operation entgegennehmen (Zerlegung 4)
- FUNC-offline-operation-accept-decompose-5: Offline-Operation entgegennehmen (Zerlegung 5)
- FUNC-offline-operation-accept-decompose-6: Offline-Operation entgegennehmen (Zerlegung 6)
- FUNC-offline-operation-accept-decompose-7: Offline-Operation entgegennehmen (Zerlegung 7)
- FUNC-offline-operation-resume-complete: Wiederanbindung abschließen |
- FUNC-offline-operation-resume-init: Wiederanbindung initialisieren |
- FUNC-offline-operation-resume-process: Wiederanbindung verarbeiten |
- FUNC-scheduled-task-accept: Nimmt die Nachtlauf-Aufgabe entgegen.

## Funktionen ausserhalb einer Wirkkette

- FUNC-offline-operation-accept-decompose-1-alt1: Offline-Operation entgegennehmen (Alternative 1)
- FUNC-offline-operation-accept-decompose-1-alt2: Offline-Operation entgegennehmen (Alternative 2)
- FUNC-offline-operation-accept-decompose-1-alt2-alt1: Offline-Operation entgegennehmen (Alternative 2, Teil 1)
- FUNC-offline-operation-accept-decompose-1-alt2-alt2: Offline-Operation entgegennehmen (Alternative 2, Teil 2)
- FUNC-offline-operation-accept-decompose-1-alt2-alt3: Offline-Operation entgegennehmen (Alternative 2, Teil 3)
- FUNC-offline-operation-accept-decompose-1-alt3: Offline-Operation entgegennehmen (Alternative 3)
- FUNC-offline-operation-accept-decompose-1-alt3-alt1: Offline-Operation entgegennehmen (Alternative 3, Teil 1)
- FUNC-offline-operation-accept-decompose-1-alt3-alt2: Offline-Operation entgegennehmen (Alternative 3, Teil 2)
- FUNC-offline-operation-accept-decompose-1-alt3-alt3: Offline-Operation entgegennehmen (Alternative 3, Teil 3)
- FUNC-offline-operation-accept-decompose-1-alt4: Offline-Operation entgegennehmen (Alternative 4)
- FUNC-offline-operation-accept-decompose-1-alt5: Offline-Operation entgegennehmen (Alternative 5)
- FUNC-offline-operation-accept-decompose-1-alt6: Offline-Operation entgegennehmen (Alternative 6)
- FUNC-offline-operation-accept-decompose-2-alt1: Offline-Operation validieren (Alternative 1)
- FUNC-offline-operation-accept-decompose-2-alt2: Offline-Operation validieren (Alternative 2)
- FUNC-offline-operation-accept-decompose-2-alt3: Offline-Operation validieren (Alternative 3)
- FUNC-offline-operation-accept-decompose-2-alt4: Offline-Operation validieren (Alternative 4)
- FUNC-offline-operation-accept-decompose-2-alt5: Offline-Operation validieren (Alternative 5)
- FUNC-offline-operation-accept-decompose-2-alt6: Offline-Operation validieren (Alternative 6)
- FUNC-offline-operation-accept-decompose-3-alt1: Offline-Operation decodieren (Alternative 1)
- FUNC-offline-operation-accept-decompose-3-alt2: Offline-Operation decodieren (Alternative 2)
- FUNC-offline-operation-accept-decompose-3-alt3: Offline-Operation decodieren (Alternative 3)
- FUNC-offline-operation-accept-decompose-3-alt4: Offline-Operation decodieren (Alternative 4)
- FUNC-offline-operation-accept-decompose-3-alt5: Offline-Operation decodieren (Alternative 5)
- FUNC-offline-operation-accept-decompose-3-alt6: Offline-Operation decodieren (Alternative 6)
- FUNC-offline-operation-resume-verify: Wiederanbindung nach Netzwerkverbindung prüfen.

## Flüsse und Verträge

- **FLOW-interactive-session** (ACTOR-nutzer → FUNC-interactive-session-accept; Vertrag SCHEMA-interactive-session): Interaktive Sitzung des Nutzers mit dem System
- **FLOW-offline-operation** (ACTOR-device → FUNC-offline-operation-accept; Vertrag SCHEMA-offline-operation): Anfrage des Geräts an das System im Offline-Betrieb
- **FLOW-scheduled-task** (ACTOR-scheduler → FUNC-scheduled-task-accept; Vertrag SCHEMA-scheduled-task): Anfrage des Schedulers an das System für Nachtlauf-Aufgaben
- Vertrag **SCHEMA-interactive-session**: Form der Anfrage: Text und Sitzungs-ID
- Vertrag **SCHEMA-offline-operation**: Form der Anfrage: Text, Sitzungs-ID und Zustandsdaten
- Vertrag **SCHEMA-scheduled-task**: Form der Anfrage: Aufgabenbeschreibung und Zeitstempel

## Module

- **MOD-offline-operation-accept-decompose-1**: Modul zur Entgegennahme von Offline-Operationen. — enthält FUNC-offline-operation-accept-decompose-1
- **MOD-offline-operation-accept-decompose-1-alt1**: Offline-Operation Entgegennahme-Modul (Alternative 1) — enthält FUNC-offline-operation-accept-decompose-1-alt1
- **MOD-offline-operation-accept-decompose-1-alt2**: Offline-Operation Entgegennahme-Modul (Alternative 2) — enthält FUNC-offline-operation-accept-decompose-1-alt2
- **MOD-offline-operation-accept-decompose-1-alt2-alt1**: Offline-Operation Entgegennahme-Modul (Alternative 2, Teil 1) — enthält FUNC-offline-operation-accept-decompose-1-alt2-alt1
- **MOD-offline-operation-accept-decompose-1-alt2-alt2**: Offline-Operation Entgegennahme-Modul (Alternative 2, Teil 2) — enthält FUNC-offline-operation-accept-decompose-1-alt2-alt2
- **MOD-offline-operation-accept-decompose-1-alt2-alt3**: Offline-Operation Entgegennahme-Modul (Alternative 2, Teil 3) — enthält FUNC-offline-operation-accept-decompose-1-alt2-alt3
- **MOD-offline-operation-accept-decompose-1-alt3**: Offline-Operation Entgegennahme-Modul (Alternative 3) — enthält FUNC-offline-operation-accept-decompose-1-alt3
- **MOD-offline-operation-accept-decompose-1-alt3-alt1**: Offline-Operation Entgegennahme-Modul (Alternative 3, Teil 1) — enthält FUNC-offline-operation-accept-decompose-1-alt3-alt1
- **MOD-offline-operation-accept-decompose-1-alt3-alt2**: Offline-Operation Entgegennahme-Modul (Alternative 3, Teil 2) — enthält FUNC-offline-operation-accept-decompose-1-alt3-alt2
- **MOD-offline-operation-accept-decompose-1-alt3-alt3**: Offline-Operation Entgegennahme-Modul (Alternative 3, Teil 3) — enthält FUNC-offline-operation-accept-decompose-1-alt3-alt3
- **MOD-offline-operation-accept-decompose-1-alt4**: Offline-Operation Entgegennahme-Modul (Alternative 4) — enthält FUNC-offline-operation-accept-decompose-1-alt4
- **MOD-offline-operation-accept-decompose-1-alt5**: Offline-Operation Entgegennahme-Modul (Alternative 5) — enthält FUNC-offline-operation-accept-decompose-1-alt5
- **MOD-offline-operation-accept-decompose-1-alt6**: Offline-Operation Entgegennahme-Modul (Alternative 6) — enthält FUNC-offline-operation-accept-decompose-1-alt6
- **MOD-offline-operation-accept-decompose-2**: Modul zur Validierung von Offline-Operationen. — enthält FUNC-offline-operation-accept-decompose-2
- **MOD-offline-operation-accept-decompose-2-alt1**: Offline-Operation Validierungsmodul (Alternative 1) — enthält FUNC-offline-operation-accept-decompose-2-alt1
- **MOD-offline-operation-accept-decompose-2-alt2**: Offline-Operation Validierungsmodul (Alternative 2) — enthält FUNC-offline-operation-accept-decompose-2-alt2
- **MOD-offline-operation-accept-decompose-2-alt3**: Offline-Operation Validierungsmodul (Alternative 3) — enthält FUNC-offline-operation-accept-decompose-2-alt3
- **MOD-offline-operation-accept-decompose-2-alt4**: Offline-Operation Validierungsmodul (Alternative 4) — enthält FUNC-offline-operation-accept-decompose-2-alt4
- **MOD-offline-operation-accept-decompose-2-alt5**: Offline-Operation Validierungsmodul (Alternative 5) — enthält FUNC-offline-operation-accept-decompose-2-alt5
- **MOD-offline-operation-accept-decompose-2-alt6**: Offline-Operation Validierungsmodul (Alternative 6) — enthält FUNC-offline-operation-accept-decompose-2-alt6
- **MOD-offline-operation-accept-decompose-3**: Modul zur Decodierung von Offline-Operationen. — enthält FUNC-offline-operation-accept-decompose-3
- **MOD-offline-operation-accept-decompose-3-alt1**: Offline-Operation Decodierungsmodul (Alternative 1) — enthält FUNC-offline-operation-accept-decompose-3-alt1
- **MOD-offline-operation-accept-decompose-3-alt2**: Offline-Operation Decodierungsmodul (Alternative 2) — enthält FUNC-offline-operation-accept-decompose-3-alt2
- **MOD-offline-operation-accept-decompose-3-alt3**: Offline-Operation Decodierungsmodul (Alternative 3) — enthält FUNC-offline-operation-accept-decompose-3-alt3
- **MOD-offline-operation-accept-decompose-3-alt4**: Offline-Operation Decodierungsmodul (Alternative 4) — enthält FUNC-offline-operation-accept-decompose-3-alt4
- **MOD-offline-operation-accept-decompose-3-alt5**: Offline-Operation Decodierungsmodul (Alternative 5) — enthält FUNC-offline-operation-accept-decompose-3-alt5
- **MOD-offline-operation-accept-decompose-3-alt6**: Offline-Operation Decodierungsmodul (Alternative 6) — enthält FUNC-offline-operation-accept-decompose-3-alt6
- **MOD-offline-operation-accept-decompose-4**: Modul zur Speicherung von Offline-Operationen. — enthält FUNC-offline-operation-accept-decompose-4
- **MOD-offline-operation-accept-decompose-5**: Modul zur Ausführung von Offline-Operationen. — enthält FUNC-offline-operation-accept-decompose-5
- **MOD-offline-operation-accept-decompose-6**: Modul zur Wiederanbindung nach Offline-Operationen. — enthält FUNC-offline-operation-accept-decompose-6
- **MOD-offline-operation-accept-decompose-7**: Modul zur Initialisierung der Wiederanbindung nach Offline-Operationen. — enthält FUNC-offline-operation-accept-decompose-7
- **MOD-offline-operation-decode**: Modul für Offline-Operation Decodierung | — enthält FUNC-offline-operation-decode
- **MOD-offline-operation-execute**: Modul für Offline-Operation Ausführung | — enthält FUNC-offline-operation-execute
- **MOD-offline-operation-resume-complete**: Modul für Wiederanbindung Abschluss | — enthält FUNC-offline-operation-resume-complete
- **MOD-offline-operation-resume-init**: Modul für Wiederanbindung Initialisierung | — enthält FUNC-offline-operation-resume-init
- **MOD-offline-operation-resume-process**: Modul für Wiederanbindung Verarbeitung | — enthält FUNC-offline-operation-resume-process
- **MOD-offline-operation-resume-verify**: Modul zur Wiederanbindung im Offline-Betrieb. — enthält FUNC-interactive-session-accept, FUNC-offline-operation-accept, FUNC-offline-operation-resume-verify, FUNC-scheduled-task-accept
- **MOD-offline-operation-store**: Modul für Offline-Operation Speicherung | — enthält FUNC-offline-operation-store
- **MOD-offline-operation-validate**: Modul für Offline-Operation Validierung | — enthält FUNC-offline-operation-validate
