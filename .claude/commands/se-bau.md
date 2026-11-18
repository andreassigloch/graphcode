---
name: se-bau
version: 1
description: Bau eines CR in zwei Rollen — Koordinator (Hauptsitzung) startet je CR einen Agenten, schreibt das Modell allein und schließt erst nach dem Testlauf auf der Zielumgebung; Umsetzer (Agent) baut aus dem Ausschnitt graph_context, setzt Werte nach Werteklasse, hält das Vertragspaket ein, stoppt bei jeder Lücke und nennt jede Annahme. Fester Teil jedes Bauauftrags an einen Agenten.
---

# se-bau — der Umsetzer nimmt nichts an, der Koordinator schließt nichts vorzeitig

Der Bau ist die Stufe, in der eine Lücke der Spezifikation teuer wird. Gemessen im Bau von immo-infra
(2026-11-10 bis 11-12): 17 von 20 Rückfragen an den Auftraggeber waren Lücken der Spezifikation. Agenten
füllten sie mit eigenen Werten: 50 Dateien und 50 MB je Lauf, Title höchstens 70 Zeichen, 2 USD je
Abgleich, Rolle admin für das Portal. Dieser Skill legt fest, wer was tut. Der Auftrag an den Agenten nennt
ihn mit Namen: `se-bau`, Rolle Umsetzer.

Wer die Hauptsitzung ist, liest **Koordinator**. Wer als Agent einen CR baut, liest **Umsetzer**.

## Koordinator (Hauptsitzung)

Die Hauptsitzung koordiniert und baut nichts selbst. Rufe `graph_mutate` mit `skill: "se-bau"` auf.

1. **Modellstand prüfen, vor dem Start.** Der CR nennt den Modellstand, bei dem er geschnitten wurde.
   Steht das Modell jetzt woanders, laufe `aise dispatch prepare` neu und gib dem Agenten den neuen Text.
   Beispiel: CR-INF-069 wurde bei Modellstand 154 geschnitten und ab Stand 324 gebaut.
2. **Ein Agent je CR einer Gruppe, jeder in eigenem Arbeitsordner** (git worktree). Die Gruppen stehen in
   se-plan. Gruppe n+1 startet, wenn jeder CR der Gruppe n zusammengeführt ist. Beim Commit stagst du
   selektiv (`git commit -- <Pfade>`).
3. **Das Modell schreibst du allein**, nur im Haupt-Arbeitsordner: Kanten und `testRefs` über `graph_mutate`,
   den Status über `aise cr close`. Agenten schreiben nichts davon.
4. **Erst ausrollen, dann schließen:** Du rollst je CR nacheinander aus. `aise cr close` läuft erst nach
   dem Testlauf auf der Zielumgebung. Sechs CRs in immo-infra wurden ohne diesen Lauf geschlossen und nachgeholt.
   `aise release publish` fährst du nur nach ausdrücklicher Freigabe des Auftraggebers, je Zug.
5. **Eine Rückfrage des Umsetzers geht an se-cdr zurück**, nicht an den Auftraggeber. Ein Umsetzer meldet
   eine Lücke; die Lücke ist ein Befund der Spezifikation. se-cdr stellt sie als Frage, se:author-req
   schreibt die Antwort als REQ mit TEST. Danach läuft `aise dispatch prepare` neu (Punkt 1), und der
   Umsetzer startet mit dem ergänzten Text. Im Lauf ohne Mensch (headless) beantwortet niemand die Frage:
   se:author-req schreibt sie als Annahme (REQ mit offenem Zielwert und TEST), und dein Abschlussbericht
   nennt jede Annahme.
6. **Prüfe den Abschlussbericht** auf den Satz zu den Annahmen (Umsetzer Punkt 8). Eine genannte Annahme
   ist eine Lücke und geht wie in Punkt 5 zurück.

## Umsetzer (Agent)

Du baust genau einen CR in deinem Arbeitsordner. Du fragst den Auftraggeber nicht, du erfindest nichts.

1. **Der Auftrag ist der Ausschnitt `graph_context` des Trägers.** Lies ihn, bevor du Code schreibst. Was
   darin nicht steht, gehört nicht zum Auftrag.
2. **Setze jeden Wert nach seiner Werteklasse an den richtigen Ort** (Tabelle unten):
   - Laufzeit-Parameter: im Einstellungsspeicher mit Verlauf.
   - Start-Konfiguration: Pflichtfeld ohne Vorgabewert; fehlt es beim Start, bricht der Start mit Pfad und Feld ab.
   - Invariante: Konstante an genau einer Stelle, dazu ein Test, der ihre Unverstellbarkeit belegt.
   - Aufrufwert: im Vertrag des Aufrufs.
3. **Nimm Felder nur aus dem Vertragspaket mit fester Version.** Braucht der Code ein neues Feld, ändert
   zuerst das SCHEMA, dann der Code. Beispiel: immo-gate 0.22.0 und 0.23.0 trugen drei Felder außerhalb des
   Vertragspakets 0.6.0 (Merkmal „extern" am Konto, Adresse des Partnerordners, Auftrag „Offene Freigaben");
   RC-04 und RC-09 melden das als Befund.
4. **Prüfe vor jeder neuen Regel oder Datei, ob die Datenart schon eine Quelle hat.** Wenn ja, importiere sie.
   Beispiel: Die Regeln für Entwürfe standen schon in siglochimmo; die Agenten nahmen Werte an, statt sie dort zu lesen.
5. **Fehlt ein Wert, ein Feld, eine Rolle oder eine Quelle: stoppe und melde es.** Nimm nichts an. Die Meldung
   nennt, was fehlt, an welchem Träger, und wozu du es brauchst. Beispiel: „50 Dateien und 50 MB je Lauf"
   stand in keiner REQ. Die Meldung lautet „Obergrenze je Lauf fehlt im Träger", nicht 50 im Code.
6. **Sieh den Test zuerst rot** (se-test): Du hast die Assertion für den richtigen Grund fehlschlagen sehen,
   bevor du dem Grün traust. Löschen und Ersetzen folgt se-umbau: `graph_impact` und `graph_tests` vor
   dem Löschzug, der alte Pfad verschwindet.
7. **Schreibe nicht am Modell und rolle nicht aus.** Kein `graph_mutate`, kein `graph_export`, kein
   Ausrollen auf die Zielumgebung. Du implementierst, testest und committest im eigenen Arbeitsordner.
   Vor jedem Testlauf nennt `graph_tests({changeSet})` die Dateien, die du fährst.
8. **Der Abschlussbericht nennt jede getroffene Annahme, auch „keine".** Der letzte Absatz heißt
   „Annahmen:" und führt sie einzeln auf oder sagt „keine".

## Werteklassen

Einstellbar ist alles, was Verhalten oder Funktion des Systems beeinflusst, außer die Anforderung sagt
„Invariante". Die Klasse steht in der Anforderung am Wert.

| Klasse | Bedeutung | Ort im Code |
|---|---|---|
| Laufzeit-Parameter | im Betrieb änderbar, wirkt sofort, mit Verlauf; global, in einem Einstellungs-Vertrag | geteilter veränderlicher Zustand (Rust: `Arc<RwLock<Settings>>`) |
| Start-Konfiguration | beim Start aus einer Datei gelesen, bis zum Neustart unveränderlich | unveränderliches Struct (Rust: `&Config`), Pflichtfeld ohne Vorgabewert |
| Invariante | auf keinem Weg verstellbar | Konstante mit Test oder ein Typ ohne die verbotene Operation |
| Aufrufwert (keine Klasse) | gilt nur für einen Aufruf, steht im Vertrag dieses Aufrufs | Funktionsparameter |

Herkunft der Tabelle: CR-GC-759. Dieser Skill ist die Quelle.
