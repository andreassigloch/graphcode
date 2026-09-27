# Spec D

**System SYS-sig-local** — Eigene LLM-Rechenkapazitaet im internen Netz, vollstaendig lokal: tagsueber interaktiv bedient, nachts selbstaendig arbeitend, unterwegs lokal.

## Akteure

- **ACTOR-externer-dienst** — Ein externer Dienst, der Erreichbarkeitsdaten liefert.
- **ACTOR-nutzer** — Ein Nutzer, der mit dem System interagiert.
- **ACTOR-system** — Das System selbst, das automatisch startet.

## Use Cases mit ihren Anforderungen

### UC-arbeitstagebuch-nacht — Arbeitstagebuch Nacht

Ein Nutzer erfasst täglich einen Arbeitstagebucheintrag.

- **REQ-arbeitstagebuch-eintrag** (functional) — Das System muss jeden Tag einen zusammenfassenden Arbeitstagebucheintrag generieren.
  - erfüllt von: FUNC-arbeitstagebuch-eintrag-erzeugen
  - Test **TEST-arbeitstagebuch-eintrag**: Eintrag fuer den Vortag generieren, pruefen ob Inhalt sinnvoll ist.
- **REQ-arbeitstagebuch-nachtlauf** (functional) — Das System muss jeden Abend den Arbeitstagebucheintrag generieren, auch wenn der Tag zuvor nicht erfasst wurde.
  - erfüllt von: FUNC-arbeitstagebuch-eintrag-erzeugen
  - Test **TEST-arbeitstagebuch-nachtlauf**: Eintrag fuer gestern generieren, auch wenn kein Eintrag fuer heute existiert.
- Wirkketten: FCHAIN-sitzung

### UC-aufgaben-deklarieren — Aufgaben deklarieren

Ein Nutzer deklariert wiederkehrende Aufgaben.

- **REQ-aufgaben-deklaration** (functional) — Das System muss Aufgaben mit einer festen Definition deklarieren können.
  - erfüllt von: FUNC-aufgaben-deklarieren
  - Test **TEST-aufgaben-deklaration**: Aufgabe mit Definition deklarieren, pruefen ob sie gespeichert wird.
- **REQ-aufgaben-wiederholung** (functional) — Das System muss wiederkehrende Aufgaben entsprechend ihrer Definition ausführen.
  - erfüllt von: FUNC-system-starten
  - Test **TEST-aufgaben-wiederholung**: Wiederkehrende Aufgabe ausfuehren, pruefen ob sie korrekt wiederholt wird.
- Wirkketten: FCHAIN-sitzung

### UC-ergebnisse-protokollieren — Ergebnisse protokollieren

Ein Nutzer protokolliert Aufgabenergebnisse.

- **REQ-ergebnisse-protokollierung** (functional) — Das System muss Ergebnisse von Aufgaben protokollieren.
  - erfüllt von: FUNC-ergebnisse-protokollieren
  - Test **TEST-ergebnisse-protokollierung**: Ergebnis einer Aufgabe protokollieren, pruefen ob es gespeichert wird.
- **REQ-ergebnisse-protokollierung-format** (non-functional) — Das System muss Ergebnisse in einem strukturierten Format protokollieren.
  - erfüllt von: FCHAIN-sitzung
  - Test **TEST-ergebnisse-protokollierung-format**: Ergebnis protokollieren, pruefen ob Format korrekt ist.
- Wirkketten: FCHAIN-sitzung

### UC-erreichbarkeit-pruefen — Erreichbarkeit prüfen

Ein Nutzer prüft die Erreichbarkeit von Diensten.

- **REQ-erreichbarkeit-protokoll** (functional) — Das System muss bei jeder Prüfung einen Eintrag im Protokoll erstellen.
  - erfüllt von: FUNC-erreichbarkeit-pruefen
  - Test **TEST-erreichbarkeit-protokoll**: Erreichbarkeit prüfen, Protokoll prüfen, Eintrag vorhanden.
- **REQ-erreichbarkeit-zeit** (functional) — Das System muss die Erreichbarkeit von Diensten innerhalb von 30 s prüfen.
  - erfüllt von: FUNC-erreichbarkeit-pruefen
  - Test **TEST-erreichbarkeit-zeit**: Erreichbarkeit prüfen, Zeit messen, Grenze 30 s.
- Wirkketten: FCHAIN-sitzung

### UC-login — Anmeldung

Ein Nutzer meldet sich mit Benutzername und Passwort an.

- **REQ-login-anfrage-empfangen** (functional) — Das System muss die Anmeldeanfrage empfangen können.
  - erfüllt von: FUNC-login-anfrage-empfangen
  - Test **TEST-login-anfrage-empfangen**: Anmeldeanfrage empfangen, prüfen ob korrekt verarbeitet.
- **REQ-login-dauer** (functional) — Das System muss die Anmeldung innerhalb einer Zielzeit abschliessen; Zielwert offen, beim Auftraggeber erfragt.
  - erfüllt von: FCHAIN-sitzung, FUNC-login-pruefen
  - Test **TEST-login**: Anmeldung mit gültigem Benutzername und Passwort, Zeit gemessen, Grenze 2 s.
- **REQ-login-passwort** (functional) — Das System muss Nutzer per Passwort in unter 2 s anmelden.
  - erfüllt von: FCHAIN-sitzung
  - Test **TEST-login-passwort**: Lastlauf misst p95 der Anmeldung, Grenze 2 s.
- Wirkketten: FCHAIN-sitzung

### UC-ressourcen-ueberwachen — Ressourcen überwachen

Ein Nutzer überwacht Ressourcenverbrauch.

- **REQ-ressourcen-protokoll** (functional) — Das System muss bei jeder Messung einen Eintrag im Protokoll erstellen.
  - erfüllt von: —
  - Test **TEST-ressourcen-protokoll**: Ressourcen messen, Protokoll prüfen, Eintrag vorhanden.
- **REQ-ressourcen-zeit** (functional) — Das System muss den Ressourcenverbrauch innerhalb von 10 s messen.
  - erfüllt von: FUNC-ressourcen-messen
  - Test **TEST-ressourcen-zeit**: Ressourcen messen, Zeit messen, Grenze 10 s.
- Wirkketten: FCHAIN-sitzung

### UC-sitzung-erstellen — Sitzung erstellen

Ein Nutzer erstellt eine Sitzung zur Verwaltung.

- **REQ-sitzung-erstellen-dauer** (functional) — Das System muss eine Sitzung in unter 1 s erstellen.
  - erfüllt von: FUNC-sitzung-ueberpruefen
  - Test **TEST-sitzung-erstellen**: Ein Nutzer stellt eine Sitzungserstellungsanfrage, das System erstellt die Sitzung.
- **REQ-sitzung-erstellen-functional** (functional) — Das System muss eine Sitzung erstellen, wenn der Nutzer eine Anfrage stellt.
  - erfüllt von: FUNC-sitzung-erstellen
  - Test **TEST-sitzung-erstellen**: Ein Nutzer stellt eine Sitzungserstellungsanfrage, das System erstellt die Sitzung.
- Wirkketten: FCHAIN-sitzung

### UC-system-starten — System startet

Ein System startet automatisch nach Neustart.

- **REQ-system-start-automatisch** (functional) — Das System muss nach einem Neustart automatisch starten.
  - erfüllt von: —
  - Test **TEST-system-start-automatisch**: System neustarten, prüfen, ob automatisch gestartet.
- **REQ-system-start-verzoegerung** (functional) — Das System muss nach einem Neustart innerhalb von 5 min starten.
  - erfüllt von: FUNC-system-starten
  - Test **TEST-system-start-verzoegerung**: System neustarten, Zeit messen, Grenze 5 min.
- Wirkketten: FCHAIN-sitzung

### UC-zugriff-verwalten — Zugriff verwalten

Ein Nutzer verwaltet Zugangsdaten.

- **REQ-zugriff-authentifizierung** (functional) — Das System muss Nutzer per Benutzername und Passwort authentifizieren.
  - erfüllt von: —
  - Test **TEST-zugriff-authentifizierung**: Anmeldung mit gültigem Benutzername und Passwort, Zeit gemessen, Grenze 2 s.
- **REQ-zugriff-protokollierung** (functional) — Das System muss jeden Zugriff protokollieren.
  - erfüllt von: —
  - Test **TEST-zugriff-protokollierung**: Zugriff protokolliert, Eintrag enthält Zeit, Benutzer, Ressource.
- **REQ-zugriff-sicherheit** (non-functional) — Das System muss sensible Daten wie Passwörter verschlüsselt speichern.
  - erfüllt von: —
  - Test **TEST-zugriff-sicherheit**: Passwort in Datenbank nicht im Klartext, sondern verschlüsselt gespeichert.
- **REQ-zugriff-sperre** (functional) — Das System muss nach 5 Fehlversuchen das Konto 15 min sperren.
  - erfüllt von: —
  - Test **TEST-zugriff-sperre**: 5 Fehlversuche, 6. Versuch muss abgewiesen werden.
- **REQ-zugriff-zugriffskontrolle** (functional) — Das System muss den Zugriff auf Ressourcen basierend auf Benutzerrollen steuern.
  - erfüllt von: —
  - Test **TEST-zugriff-zugriffskontrolle**: Zugriff auf Ressource mit Rolle prüfen, Zugriff erlaubt/verweigert.
- Wirkketten: FCHAIN-zugriff-verwalten

## Wirkketten

### FCHAIN-sitzung — Sitzung

Funktionen zur Verwaltung der Sitzung.

- FUNC-arbeitstagebuch-eintrag-erzeugen: Erzeugt den Arbeitstagebucheintrag.
- FUNC-aufgaben-deklarieren: Nimmt die Aufgabendeklaration entgegen.
- FUNC-ergebnisse-protokollieren: Protokolliert das Ergebnis einer Aufgabe.
- FUNC-erreichbarkeit-pruefen: Prüft die Erreichbarkeit eines Dienstes.
- FUNC-login-anfrage-empfangen: Empfängt die Anfrage zur Anmeldung.
- FUNC-login-pruefen: Prüft die Anmeldedaten.
- FUNC-ressourcen-anfrage-empfangen: Empfängt die Anfrage zur Ressourcenüberwachung.
- FUNC-ressourcen-messen: Misst den Ressourcenverbrauch.
- FUNC-sitzung-beenden: Sitzung beenden|__name:Sitzung beenden
- FUNC-sitzung-dokumentieren: Sitzung dokumentieren|__name:Sitzung dokumentieren
- FUNC-sitzung-erstellen: Sitzung erstellen|__name:Sitzung erstellen
- FUNC-sitzung-ueberpruefen: Sitzung überprüfen|__name:Sitzung überprüfen
- FUNC-sitzung-ueberwachen: Sitzung überwachen|__name:Sitzung überwachen
- FUNC-sitzung-validieren: Sitzung validieren|__name:Sitzung validieren
- FUNC-system-start-anfrage-empfangen: Empfängt die Anfrage zum Systemstart.
- FUNC-system-starten: Startet das System.

### FCHAIN-zugriff-verwalten — Zugriff verwalten

Funktionale Kette zur Verwaltung von Zugängen

- FUNC-zugriff-anfrage-empfangen: Empfängt die Zugriffsanfrage des Nutzers.

## Flüsse und Verträge

- **FLOW-arbeitstagebuch-eintrag** (ACTOR-nutzer → FUNC-arbeitstagebuch-eintrag-erzeugen; Vertrag SCHEMA-arbeitstagebuch-eintrag): Anfrage des Nutzers, einen Arbeitstagebucheintrag zu generieren.
- **FLOW-aufgaben-deklarieren** (ACTOR-nutzer → FUNC-aufgaben-deklarieren; Vertrag SCHEMA-aufgaben-deklarieren): Anfrage des Nutzers, eine Aufgabe zu deklarieren.
- **FLOW-ergebnisse-protokollieren** (ACTOR-nutzer → FUNC-ergebnisse-protokollieren; Vertrag SCHEMA-ergebnisse-protokollieren): Anfrage des Nutzers, ein Ergebnis zu protokollieren
- **FLOW-erreichbarkeit-pruefen** (ACTOR-nutzer → FUNC-erreichbarkeit-pruefen; Vertrag SCHEMA-erreichbarkeit-pruefen): Anfrage des Nutzers, die Erreichbarkeit zu prüfen
- **FLOW-login** (ACTOR-nutzer → FUNC-login-pruefen; Vertrag SCHEMA-login): Anfrage des Nutzers zur Anmeldung
- **FLOW-login-anfrage** (ACTOR-nutzer → FUNC-login-anfrage-empfangen; Vertrag SCHEMA-login-anfrage): Anfrage des Nutzers zur Anmeldung
- **FLOW-ressourcen-anfrage** (ACTOR-nutzer → FUNC-ressourcen-anfrage-empfangen; Vertrag SCHEMA-ressourcen-anfrage): Anfrage zur Überwachung von Ressourcen
- **FLOW-ressourcen-ueberwachen** (ACTOR-nutzer → FUNC-ressourcen-messen; Vertrag SCHEMA-ressourcen-ueberwachen): Anfrage zur Überwachung von Ressourcen
- **FLOW-system-start-anfrage** (ACTOR-system → FUNC-system-start-anfrage-empfangen; Vertrag SCHEMA-system-start-anfrage): Anfrage zum Start des Systems
- **FLOW-system-starten** (ACTOR-system → FUNC-system-starten; Vertrag SCHEMA-system-starten): Anfrage zum Start des Systems
- **FLOW-zugriff-anfrage** (ACTOR-nutzer → FUNC-zugriff-anfrage-empfangen; Vertrag SCHEMA-zugriff-anfrage): Anfrage des Nutzers an das System zur Verwaltung von Zugangsdaten
- Vertrag **SCHEMA-arbeitstagebuch-eintrag**: Form der Anfrage: Text und Sitzungs-ID
- Vertrag **SCHEMA-aufgaben-deklarieren**: Form der Anfrage: Aufgabenname, Definition, Wiederholung.
- Vertrag **SCHEMA-ergebnisse-protokollieren**: Form der Protokollierung: Ergebnis, Zeitstempel, Aufgaben-ID
- Vertrag **SCHEMA-erreichbarkeit-pruefen**: Form der Prüfung: Dienst-ID, Zeitstempel
- Vertrag **SCHEMA-login**: Form der Anmeldung: Benutzername und Passwort
- Vertrag **SCHEMA-login-anfrage**: Form der Anmeldung: Benutzername und Passwort
- Vertrag **SCHEMA-ressourcen-anfrage**: Form der Ressourcenanfrage: Zeit und Ressourcen
- Vertrag **SCHEMA-ressourcen-ueberwachen**: Form der Ressourcenanfrage: Zeit und Ressourcen
- Vertrag **SCHEMA-system-start-anfrage**: Form des Systemstarts: Zeit und Zustand
- Vertrag **SCHEMA-system-starten**: Form des Systemstarts: Zeit und Zustand
- Vertrag **SCHEMA-zugriff-anfrage**: Form der Anfrage: Benutzername, Passwort

## Module

