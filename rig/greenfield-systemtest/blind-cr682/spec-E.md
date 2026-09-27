# Spec E

**System SYS-sig-local** — Eigene LLM-Rechenkapazitaet im internen Netz, vollstaendig lokal: tagsueber interaktiv bedient, nachts selbstaendig arbeitend, unterwegs lokal.

## Akteure

- **ACTOR-nutzer** — Ein Nutzer, der mit dem System interagiert.
- **ACTOR-nutzer-neu** — Nutzer, der Aufgaben ausführt.
- **ACTOR-scheduler** — Ein externer Scheduler, der Aufgaben auslöst.
- **ACTOR-server** — Ein Server, der Erreichbarkeit prüft.

## Use Cases mit ihren Anforderungen

### UC-arbeitsjournal-erstellen — Arbeitstagebuch

Ein System erstellt ein tägliche Arbeitsjournal.

- **REQ-arbeitsjournal-erstellung** (functional) — Das System muss täglich um Mitternacht ein Arbeitsjournal erstellen.
  - erfüllt von: FUNC-arbeitsjournal-erstellen
  - Test **TEST-arbeitsjournal-erstellung**: Das System erstellt ein Arbeitsjournal um Mitternacht.
- **REQ-arbeitsjournal-inhalt** (functional) — Das System muss den Inhalt des Arbeitsjournal aus dem Code extrahieren.
  - erfüllt von: —
  - Test **TEST-arbeitsjournal-inhalt**: Das System extrahiert den Inhalt aus dem Code.

### UC-arbeitsjournal-erstellen-neu — Arbeitstagebuch

System erstellt täglich Arbeitsjournal

- **REQ-arbeitsjournal-erstellung-dauer** (non-functional) — Das System muss das tägliche Arbeitsjournal in unter 30 s erstellen.
  - erfüllt von: —
  - Test **TEST-arbeitsjournal-erstellung-dauer**: Arbeitsjournal erstellen, Zeit messen, Grenze 30 s.
- **REQ-arbeitsjournal-erstellung-inhalt** (functional) — Das System muss den Arbeitsjournal-Eintrag aus dem Code-Verlauf generieren.
  - erfüllt von: —
  - Test **TEST-arbeitsjournal-erstellung-inhalt**: Arbeitsjournal erstellen, Inhalt prüfen, muss aus Code stammen.
- Wirkketten: FCHAIN-arbeitsjournal-erstellen

### UC-interaktiv-antworten — Interaktive Antworten

Ein Nutzer erhält interaktive Antworten von einem System.

- **REQ-lokale-nutzung-antwort** (non-functional) — Das System muss innerhalb von 5 s auf eine Anfrage reagieren.
  - erfüllt von: FCHAIN-lokale-nutzung-antwort
  - Test **TEST-lokale-nutzung-antwort**: Das System reagiert innerhalb von 5 s auf eine Anfrage.
- **REQ-lokale-nutzung-verfuegbarkeit** (functional) — Das System muss bei lokaler Nutzung verfügbar sein.
  - erfüllt von: —
  - Test **TEST-lokale-nutzung-verfuegbarkeit**: Das System ist bei lokaler Nutzung verfügbar.

### UC-interaktiv-antworten-neu — Interaktive Antworten

Nutzer erhält interaktive Antworten von System

- **REQ-interaktiv-antwort-dauer** (non-functional) — Das System muss eine interaktive Antwort in unter 5 s liefern.
  - erfüllt von: —
  - Test **TEST-interaktiv-antwort-dauer**: Nutzeranfrage senden, Antwortzeit messen, Grenze 5 s.
- **REQ-interaktiv-antwort-inhalt** (functional) — Das System muss die Antwort auf die Nutzeranfrage basierend auf dem Modell generieren.
  - erfüllt von: —
  - Test **TEST-interaktiv-antwort-inhalt**: Nutzeranfrage senden, Antwortinhalt prüfen, muss vom Modell stammen.
- **REQ-interaktiv-antwort-qualitaet** (functional) — Das System muss die Antwort auf Plausibilität prüfen und bei Bedarf erneut generieren.
  - erfüllt von: —
  - Test **TEST-interaktiv-antwort-qualitaet**: Nutzeranfrage senden, Antwort prüfen, bei Unsinn erneut generieren.
- Wirkketten: FCHAIN-interaktiv-antworten

### UC-login — Anmeldung

Der Nutzer meldet sich am System an.

- **REQ-login-dauer** (functional) — Das System muss die Anmeldung innerhalb einer Zielzeit abschliessen; Zielwert offen, beim Auftraggeber erfragt.
  - erfüllt von: FUNC-login-pruefen, FUNC-lokale-nutzung-anfrage-empfangen-neu
  - Test **TEST-login-passwort**: Lastlauf misst p95 der Anmeldung, Grenze 2 s.
- **REQ-login-passwort** (functional) — Das System muss Nutzer per Passwort in unter 2 s anmelden.
  - erfüllt von: FUNC-login-pruefen
  - Test **TEST-login-passwort**: Lastlauf misst p95 der Anmeldung, Grenze 2 s.
- Wirkketten: FCHAIN-login

### UC-login-passwort — Anmeldung per Passwort

Der Nutzer meldet sich mit Passwort an.

- **REQ-login-dauer** (functional) — Das System muss die Anmeldung innerhalb einer Zielzeit abschliessen; Zielwert offen, beim Auftraggeber erfragt.
  - erfüllt von: FUNC-login-pruefen, FUNC-lokale-nutzung-anfrage-empfangen-neu
  - Test **TEST-login-passwort**: Lastlauf misst p95 der Anmeldung, Grenze 2 s.
- **REQ-login-passwort** (functional) — Das System muss Nutzer per Passwort in unter 2 s anmelden.
  - erfüllt von: FUNC-login-pruefen
  - Test **TEST-login-passwort**: Lastlauf misst p95 der Anmeldung, Grenze 2 s.
- **REQ-login-passwort-fehlermeldung** (functional) — Das System muss dem Nutzer eine klare Fehlermeldung bei falschem Passwort anzeigen.
  - erfüllt von: FUNC-login-pruefen
  - Test **TEST-login-passwort-fehlermeldung**: Anmeldung mit falschem Passwort, Pruefung ob Fehlermeldung angezeigt wird.
- **REQ-login-passwort-sperre** (functional) — Das System muss nach 5 Fehlversuchen das Konto 15 min sperren.
  - erfüllt von: FUNC-login-pruefen
  - Test **TEST-login-passwort-sperre**: 5 Fehlversuche, 6. Versuch muss abgewiesen werden.
- **REQ-login-passwort-validierung** (functional) — Das System muss das Passwort validieren, bevor es die Anmeldung bestätigt.
  - erfüllt von: FUNC-login-pruefen
  - Test **TEST-login-passwort-validierung**: Anmeldung mit Passwort, Pruefung ob Validierung erfolgt.
- **REQ-login-passwort-zeit** (functional) — Das System muss Nutzer per Passwort in unter 2 s anmelden.
  - erfüllt von: FUNC-login-pruefen
  - Test **TEST-login-passwort-zeit**: Anmeldung mit gueltigem Passwort, Zeit gemessen, Grenze 2 s.
- Wirkketten: FCHAIN-login

### UC-lokale-nutzung — Lokale Nutzung

Ein Nutzer arbeitet mit einem System unterwegs.

- **REQ-lokale-nutzung-antwort** (non-functional) — Das System muss innerhalb von 5 s auf eine Anfrage reagieren.
  - erfüllt von: FCHAIN-lokale-nutzung-antwort
  - Test **TEST-lokale-nutzung-antwort**: Das System reagiert innerhalb von 5 s auf eine Anfrage.
- **REQ-lokale-nutzung-verfuegbarkeit** (functional) — Das System muss bei lokaler Nutzung verfügbar sein.
  - erfüllt von: —
  - Test **TEST-lokale-nutzung-verfuegbarkeit**: Das System ist bei lokaler Nutzung verfügbar.
- Wirkketten: FCHAIN-lokale-nutzung, FCHAIN-lokale-nutzung-antwort

### UC-lokale-nutzung-antwort — Lokale Nutzung Antwort

Ein Nutzer erhält eine Antwort auf eine Anfrage.

- **REQ-lokale-nutzung-antwort-dauer** (functional) — Das System muss innerhalb von 5 s auf eine Anfrage reagieren.
  - erfüllt von: FCHAIN-lokale-nutzung-antwort, FUNC-lokale-nutzung-antwort-generieren
  - Test **TEST-lokale-nutzung-antwort-dauer**: Eine Anfrage senden, Antwortzeit messen, Grenze 5 s.
  - Test **TEST-verify-lokale-nutzung-antwort-dauer**: it.todo: Prüfe "Antwortdauer" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-lokale-nutzung-antwort-inhalt** (functional) — Das System muss die Antwort auf eine lokale Nutzung-Anfrage einen sinnvollen Inhalt haben.
  - erfüllt von: —
  - Test **TEST-verify-lokale-nutzung-antwort-inhalt**: it.todo: Prüfe "Antwortinhalt" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- Wirkketten: FCHAIN-lokale-nutzung-antwort-neu

### UC-lokale-nutzung-antwort-neu — Lokale Nutzung Antwort

Lokale Nutzung Antwort neu

- **REQ-lokale-nutzung-antwort-neu** (functional) — Das System muss innerhalb von 5 s auf eine Anfrage reagieren.
  - erfüllt von: FCHAIN-lokale-nutzung-antwort-neu, FUNC-lokale-nutzung-anfrage-empfangen-neu
  - Test **TEST-lokale-nutzung-antwort-neu**: Das System reagiert innerhalb von 5 s auf eine Anfrage.
- Wirkketten: FCHAIN-lokale-nutzung-antwort, FCHAIN-lokale-nutzung-antwort-neu

### UC-nachtlauf-aufgaben — Nachtlauf Aufgaben

Ein System führt wiederkehrende Aufgaben nachts aus.

- **REQ-nachtlauf-aufgaben-dauer** (non-functional) — Das System muss wiederkehrende Aufgaben nachts innerhalb einer festgelegten Zeit abschliessen.
  - erfüllt von: —
  - Test **TEST-nachtlauf-aufgaben-dauer**: Nachtlauf Aufgaben ausführen, Zeit messen, Grenze 10 min.
- **REQ-nachtlauf-aufgaben-erfolg** (functional) — Das System muss jeden wiederkehrenden Auftrag mindestens einmal pro Planung ausführen.
  - erfüllt von: FUNC-nachtlauf-aufgaben-ausfuehren-neu
  - Test **TEST-nachtlauf-aufgaben-erfolg**: 5 Aufträge planen, alle müssen ausgeführt werden.
- Wirkketten: FCHAIN-nachtlauf-aufgaben

### UC-nachtlauf-aufgaben-neu — Nachtlauf Aufgaben

System führt wiederkehrende Aufgaben nachts aus.

- **REQ-nachtlauf-aufgaben-dauer-neu** (functional) — Die Nachtlauf-Aufgaben müssen innerhalb einer bestimmten Zeit abgeschlossen werden.
  - erfüllt von: FUNC-nachtlauf-aufgaben-ausfuehren-neu
  - Test **TEST-verify-nachtlauf-aufgaben-dauer-neu**: it.todo: Prüfe "Nachtlaufzeit" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-nachtlauf-aufgaben-erfolg** (functional) — Das System muss jeden wiederkehrenden Auftrag mindestens einmal pro Planung ausführen.
  - erfüllt von: FUNC-nachtlauf-aufgaben-ausfuehren-neu
  - Test **TEST-nachtlauf-aufgaben-erfolg**: 5 Aufträge planen, alle müssen ausgeführt werden.
- **REQ-nachtlauf-aufgaben-zeit** (non-functional) — Das System muss jeden wiederkehrenden Auftrag innerhalb seiner Planung ausführen.
  - erfüllt von: —
  - Test **TEST-nachtlauf-aufgaben-zeit**: Wiederkehrende Aufträge werden innerhalb ihrer Planung ausgeführt.
- **REQ-nachtlauf-aufgaben-zeit-neu** (functional) — Die Nachtlauf-Aufgaben müssen zeitgerecht ausgeführt werden.
  - erfüllt von: FUNC-nachtlauf-aufgaben-ausfuehren-neu
  - Test **TEST-verify-nachtlauf-aufgaben-zeit-neu**: it.todo: Prüfe "Nachtlauf Auftrag zeitgerecht" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-nachtlauf-aufgaben-zeitpunkt** (functional) — Das System muss jeden wiederkehrenden Auftrag mindestens einmal pro Planung ausführen.
  - erfüllt von: FUNC-nachtlauf-aufgaben-ausfuehren-neu
  - Test **TEST-nachtlauf-aufgaben-zeitpunkt**: Wiederkehrende Aufträge werden mindestens einmal pro Planung ausgeführt.
- Wirkketten: FCHAIN-nachtlauf-aufgaben, FCHAIN-nachtlauf-aufgaben-neu, FCHAIN-ueberwachung-erreichbarkeit

### UC-ueberwachung-erreichbarkeit — Erreichbarkeitsprüfung

Ein System prüft Erreichbarkeit von Servern.

- **REQ-erreichbarkeit-benachrichtigung** (functional) — Das System muss bei einem Fehler eine Benachrichtigung senden.
  - erfüllt von: FUNC-erreichbarkeit-pruefen
  - Test **TEST-erreichbarkeit-benachrichtigung**: Das System sendet eine Benachrichtigung bei einem Fehler.
- **REQ-erreichbarkeit-ueberwachung** (functional) — Das System muss alle 10 Minuten die Erreichbarkeit prüfen.
  - erfüllt von: FUNC-erreichbarkeit-pruefen
  - Test **TEST-erreichbarkeit-ueberwachung**: Das System prüft die Erreichbarkeit alle 10 Minuten.
- **REQ-ueberwachung-erreichbarkeit-ergebnis** (functional) — Das System muss bei Erreichbarkeitsprüfungen korrekte Ergebnisse liefern.
  - erfüllt von: —
  - Test **TEST-ueberwachung-erreichbarkeit-ergebnis**: Erreichbarkeitsprüfung durchführen, Ergebnis prüfen, korrekt.
- **REQ-ueberwachung-erreichbarkeit-zeit** (non-functional) — Das System muss Erreichbarkeitsprüfungen innerhalb von 10 s abschliessen.
  - erfüllt von: —
  - Test **TEST-ueberwachung-erreichbarkeit-zeit**: Erreichbarkeitsprüfung durchführen, Zeit messen, Grenze 10 s.
- Wirkketten: FCHAIN-ueberwachung-erreichbarkeit

### UC-ueberwachung-erreichbarkeit-neu — Erreichbarkeitsprüfung

System prüft Erreichbarkeit von Servern.

- **REQ-ueberwachung-erreichbarkeit-dauer** (non-functional) — Das System muss alle 10 Minuten die Erreichbarkeit prüfen.
  - erfüllt von: —
  - Test **TEST-ueberwachung-erreichbarkeit-dauer**: Erreichbarkeit wird innerhalb von 10 Minuten geprüft.
- **REQ-ueberwachung-erreichbarkeit-ergebnis** (functional) — Das System muss bei Erreichbarkeitsprüfungen korrekte Ergebnisse liefern.
  - erfüllt von: —
  - Test **TEST-ueberwachung-erreichbarkeit-ergebnis**: Erreichbarkeitsprüfung durchführen, Ergebnis prüfen, korrekt.
- **REQ-ueberwachung-erreichbarkeit-zeit** (non-functional) — Das System muss Erreichbarkeitsprüfungen innerhalb von 10 s abschliessen.
  - erfüllt von: —
  - Test **TEST-ueberwachung-erreichbarkeit-zeit**: Erreichbarkeitsprüfung durchführen, Zeit messen, Grenze 10 s.
- Wirkketten: FCHAIN-ueberwachung-erreichbarkeit

## Anforderungen ausserhalb eines Use Case

- **REQ-lokale-nutzung-antwort-dauer-neu** (functional) — Das System muss innerhalb von 5 s auf eine Anfrage reagieren.
  - erfüllt von: FCHAIN-lokale-nutzung-antwort-neu, FUNC-lokale-nutzung-anfrage-empfangen-neu, FUNC-lokale-nutzung-antwort-generieren-neu
  - Test **TEST-lokale-nutzung-antwort-dauer-neu**: Eine Anfrage senden, Antwortzeit messen, Grenze 5 s.
  - Test **TEST-verify-lokale-nutzung-antwort-dauer-neu**: Prüfe \"Antwortdauer\" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
- **REQ-lokale-nutzung-antwort-inhalt-neu** (functional) — Das System muss die Antwort auf eine lokale Nutzung-Anfrage einen sinnvollen Inhalt haben.
  - erfüllt von: FCHAIN-lokale-nutzung-antwort-neu, FUNC-lokale-nutzung-anfrage-empfangen-neu, FUNC-lokale-nutzung-antwort-generieren-neu
  - Test **TEST-lokale-nutzung-antwort-inhalt-neu**: Prüfe \"Antwortinhalt\" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.
  - Test **TEST-verify-lokale-nutzung-antwort-inhalt-neu**: Prüfe \"Antwortinhalt\" — Vorbedingung herstellen, Aktion ausführen, Ergebnis messbar gegen die REQ-Aussage prüfen.

## Wirkketten

### FCHAIN-arbeitsjournal-erstellen — Arbeitstagebuch

Arbeitsjournal wird erstellt

- FUNC-arbeitsjournal-erstellen: Erstellt ein Arbeitsjournal.
- FUNC-arbeitsjournal-erstellen-schritt1: Das System prüft die Berechtigung des Nutzers für das Erstellen eines Arbeitsjournal-Eintrags.

### FCHAIN-interaktiv-antworten — Interaktive Antworten

Interaktive Antwort wird generiert

- FUNC-interaktiv-antworten-schritt1: Das System empfängt eine interaktive Anfrage vom Nutzer.

### FCHAIN-login — Anmeldung

Die Anmeldung wird verarbeitet.

- FUNC-login-pruefen: Prüft die Anmeldedaten.

### FCHAIN-lokale-nutzung — Lokale Nutzung

Funktionale Kette für lokale Nutzung

- FUNC-lokale-nutzung-anfrage-empfangen: Empfängt eine Anfrage von einem Nutzer.

### FCHAIN-lokale-nutzung-antwort — Lokale Nutzung Antwort

Die Funktionskette für lokale Nutzung mit Antwort.

- FUNC-arbeitsjournal-erstellen: Erstellt ein Arbeitsjournal.
- FUNC-erreichbarkeit-pruefen: Prüft die Erreichbarkeit.
- FUNC-lokale-nutzung-anfrage-empfangen: Empfängt eine Anfrage von einem Nutzer.
- FUNC-nachtlauf-aufgaben-ausfuehren: Führt Nachtlauf-Aufgaben aus.

### FCHAIN-lokale-nutzung-antwort-neu — Lokale Nutzung Antwort

Die Funktionskette für lokale Nutzung mit Antwort.

- FUNC-lokale-nutzung-anfrage-empfangen-neu: Empfängt die Anfrage.
- FUNC-lokale-nutzung-antwort-generieren-neu: Generiert eine Antwort auf eine Anfrage.

### FCHAIN-nachtlauf-aufgaben — Nachtlauf Aufgaben

Nachtlauf Aufgaben werden ausgeführt

- FUNC-nachtlauf-anfrage-empfangen: Empfängt die Anfrage des Schedulers.
- FUNC-nachtlauf-aufgaben-schritt1: Das System prüft, ob die Nachtlauf-Aufgaben zeitgerecht ausgeführt werden können.

### FCHAIN-nachtlauf-aufgaben-neu — Nachtlauf Aufgaben

Funktionen zur Durchführung von Nachtlauf-Aufgaben.

- FUNC-nachtlauf-aufgaben-ausfuehren-neu: Nachtlauf Aufgaben ausführen.

### FCHAIN-ueberwachung-erreichbarkeit — Erreichbarkeitsprüfung

Funktionen zur Erreichbarkeitsprüfung.

- FUNC-erreichbarkeit-pruefen: Prüft die Erreichbarkeit.

## Flüsse und Verträge

- **FLOW-arbeitsjournal-anfrage** (ACTOR-nutzer → FUNC-arbeitsjournal-erstellen; Vertrag SCHEMA-arbeitsjournal-anfrage): Anfrage zur Erstellung eines Arbeitsjournal.
- **FLOW-erreichbarkeit-anfrage** (ACTOR-nutzer → FUNC-erreichbarkeit-pruefen; Vertrag SCHEMA-erreichbarkeit-anfrage): Anfrage zur Erreichbarkeitsprüfung.
- **FLOW-login-anfrage** (ACTOR-nutzer → FUNC-login-pruefen; Vertrag SCHEMA-login-anfrage): Anfrage des Nutzers zur Anmeldung.
- **FLOW-lokale-nutzung-anfrage** (FUNC-lokale-nutzung-anfrage-empfangen → ACTOR-nutzer; Vertrag SCHEMA-lokale-nutzung-anfrage): Anfrage des Nutzers an das System.
- **FLOW-lokale-nutzung-anfrage-neu** (ACTOR-nutzer → FUNC-lokale-nutzung-anfrage-empfangen-neu, FUNC-lokale-nutzung-antwort-generieren-neu; Vertrag SCHEMA-lokale-nutzung-anfrage-neu): Neue Anfrage des Nutzers an das System
- **FLOW-lokale-nutzung-anfrage-nutzer** (ACTOR-nutzer → FUNC-lokale-nutzung-anfrage-empfangen; Vertrag SCHEMA-lokale-nutzung-anfrage): Anfrage des Nutzers an das System
- **FLOW-lokale-nutzung-antwort-neu** (FUNC-lokale-nutzung-antwort-generieren-neu → —; Vertrag SCHEMA-lokale-nutzung-anfrage-neu): Antwort für lokale Nutzung.
- **FLOW-nachtlauf-anfrage** (ACTOR-scheduler → FUNC-nachtlauf-anfrage-empfangen, FUNC-nachtlauf-aufgaben-ausfuehren; Vertrag SCHEMA-nachtlauf-anfrage): Anfrage zur Ausführung von Nachtlauf-Aufgaben.
- **FLOW-nachtlauf-anfrage-neu** (ACTOR-nutzer → FUNC-nachtlauf-aufgaben-ausfuehren-neu; Vertrag SCHEMA-nachtlauf-anfrage-neu): Anfrage für Nachtlauf-Aufgaben.
- Vertrag **SCHEMA-arbeitsjournal-anfrage**: Form der Anfrage: Text und Sitzungs-ID.
- Vertrag **SCHEMA-erreichbarkeit-anfrage**: Form der Anfrage: URL und Prüfzeit.
- Vertrag **SCHEMA-login-anfrage**: Form der Anmeldeanfrage: Benutzername und Passwort.
- Vertrag **SCHEMA-lokale-nutzung-anfrage**: Form der Anfrage: Text und Sitzungs-ID.
- Vertrag **SCHEMA-lokale-nutzung-anfrage-neu**: Form der Anfrage: Text und Sitzungs-ID
- Vertrag **SCHEMA-nachtlauf-anfrage**: Form der Aufgabe: Task-Definition und Zeitlimit.
- Vertrag **SCHEMA-nachtlauf-anfrage-neu**: Vertrag für Nachtlauf-Anfrage.

## Module

