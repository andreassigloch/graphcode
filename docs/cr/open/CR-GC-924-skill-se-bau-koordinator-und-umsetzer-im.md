# CR-GC-924: Skill se-bau: Koordinator und Umsetzer im Bau

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1327 (finding)
**Erstellt:** 2026-11-13
**Item:** bok/items/ITEM-2026-1327.json (Lane: code)

---

## Befund

Beleg: immo-infra, Bau 2026-11-10 bis 11-12 (Stufe MS-INF-2). 17 von 20 Rückfragen an den Auftraggeber waren Lücken der Spezifikation. Einordnung je Frage: Sitzungsprotokoll 5126f023, ausgewertet 2026-11-13.

- Von 26 Skills beschreibt keiner die Pflichten des Umsetzers. Im Bau lief kein Skill.
- Der Bauauftrag enthält 5 gleiche Zeilen Text. se-plan §7 und §10 sprechen den Planer an.
- Agenten nahmen Werte an: 50 Dateien und 50 MB je Lauf, Title höchstens 70 Zeichen, 2 USD je Abgleich, Rolle admin für das Portal. Die Regeln für Entwürfe standen schon in siglochimmo.
- immo-gate 0.22.0 und 0.23.0 tragen drei Felder außerhalb des Vertragspakets 0.6.0: Merkmal „extern" am Konto, Adresse des Partnerordners, Auftrag „Offene Freigaben".
- CR-INF-069 wurde bei Modellstand 154 geschnitten und ab Stand 324 gebaut.
- Sechs CRs wurden ohne den verlangten Testlauf auf der Zielumgebung geschlossen und nachgeholt.
- Die Tabelle „Werteklasse zu Ort im Code" steht nur in CR-GC-759.

## Root Cause

Die Randbedingungen des Baus stehen verstreut in se-plan, CR-GC-759, se-test und se-umbau oder nirgends. Der Umsetzer bekommt sie nicht als Auftrag.

## Zielbild

Neuer Skill `se-bau` mit zwei Rollen. Er ist fester Teil jedes Auftrags an einen Agenten.

**Koordinator (Hauptsitzung):**
- Weicht der Modellstand vom Stand im CR ab: `aise dispatch prepare` neu, vor dem Start.
- Je CR einer Gruppe ein Agent im eigenen Arbeitsordner (heute se-plan §10).
- Schreibt das Modell allein (Status, `commitRef`, `testRefs`), rollt aus, schließt den CR erst nach dem Testlauf auf der Zielumgebung.
- Eine Rückfrage des Umsetzers geht an se-cdr zurück, nicht direkt an den Auftraggeber.

**Umsetzer (Agent):**
1. Der Auftrag ist der Ausschnitt `graph_context` des Trägers.
2. Wert je Werteklasse an den richtigen Ort: Laufzeit-Parameter im Einstellungsspeicher mit Verlauf, Start-Konfiguration als Pflichtfeld ohne Vorgabewert, Invariante als Konstante mit Test, Aufrufwert im Vertrag.
3. Felder nur aus dem Vertragspaket mit fester Version. Ein neues Feld ändert zuerst das SCHEMA, dann den Code.
4. Vor einer neuen Regel oder Datei prüfen, ob die Datenart schon eine Quelle hat.
5. Fehlt ein Wert, ein Feld, eine Rolle oder eine Quelle: stoppen und melden, nichts annehmen.
6. Test zuerst rot sehen (se-test). Löschen nach se-umbau.
7. Kein Schreiben am Modell, kein Ausrollen.
8. Der Abschlussbericht nennt jede getroffene Annahme, auch „keine".

## Akzeptanz

- Test auf den Skill-Text: beide Rollen, die acht Punkte des Umsetzers.
- Nachmessung an der nächsten Baustufe in immo-infra: 0 angenommene Werte in den Abschlussberichten, 0 Felder außerhalb des Vertragspakets (RC-04 und RC-09 ohne Befund).
- Der Test war rot, bevor der Skill stand.

## Dateien (3)

`.claude/commands/se-bau.md`, `tests/skill-bau.test.ts`, Skill-Liste in `GRAPHCODE.md` (erzeugt).

Folge außerhalb dieses CR: Der feste Text im Bauauftrag von `aise dispatch prepare` nennt `se-bau` (Repo bok).

## Abhängig von

CR-GC-922 (se-cdr) für den Rückweg der Rückfragen.

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
