# CR-GC-917: Stufe bauen – Verträge (SCHEMA) vor Funktionen binden, FUNC-Paket trägt die echten Typen

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1319 (idea)
**Erstellt:** 2026-11-12
**Item:** bok/items/ITEM-2026-1319.json (Lane: code)

---

## Entscheidung des Autors (2026-11-13): letzter Schritt der Spezifikation, nicht erste Stufe des Baus

Der Titel nennt noch „Stufe bauen". Es gilt:

1. Anforderung, Test und Zod-Schema bilden zusammen die Spezifikation einer Funktion. Der Umsetzer schreibt nur den
   Rumpf.
2. Auslöser je Blattfunktion: Stehen ihre Anforderungen und Tests, bekommen die SCHEMA an ihren Flüssen das Zod-Schema
   im Code und den `realRef`. Die Funktion ist dann baureif.
3. Kein Zwischenschritt mit einer Feldliste als Text im Modell (CR-GC-454).
4. Nur an Blattfunktionen; auf höheren Ebenen ändert die Zerlegung die Flüsse noch.
5. Voraussetzung: Das Vertragspaket existiert ab Stufe 0.

Das Zielbild unten gilt in der Sache weiter (SCHEMA vor FUNC, der Schritt für die FUNC nennt den `realRef`). Es ändert
sich der Ort: vor se-plan statt in der Stufe bauen. Die Prüfpunkte unten bleiben Pflicht.

Zugehörig: CR-SM-437 (Regeln R-26, RC-03, RC-08 vor dem Plan fällig), CR-GC-922 (Review vor dem Bauplan), CR-GC-923
(se-plan ohne Stufe „Contracts"), CR-GC-925 (Fluss und SCHEMA für antwortende Akteure und Speicher), CR-SM-419
(Parameter).

## Vor der Umsetzung: lokal verifizieren (Pflicht, sonst ist der Befund geraten)

Der Befund stammt aus einer Konzeptdiskussion (Cowork, 2026-11-12) an genau einem Modell
(todo-frontier, reiner Modellier-Lauf, alle 5 SCHEMA `concept: true`). Er ist am Repo nicht geprüft.

1. **Prämisse am Bestand:** In welcher Reihenfolge gibt `graph_generate` in der Stufe bauen heute die
   Schritte aus – kommt ein SCHEMA mit `concept: true` vor oder nach der FUNC, deren FLOW es trägt?
   Trägt der Schritt für eine FUNC die Typen der gebundenen SCHEMA (`realRef`) oder nur deren Prosa?
   Deckt se-plan (Integrationsbaum, CR-GC-892/893) die Reihenfolge schon ab?
2. **Umfang:** Anzahl SCHEMA `concept: true` gegen gebunden, in graphcode und im Lauf
   todo-bauen/lokal-1.
3. **Wirkung am lokalen Arm (S2):** Im vorhandenen Lauf todo-bauen/lokal-1 (graphanalyze) auszählen,
   wie viele Reparaturzüge auf Schnittstellen entfallen (falscher Feldname, falscher Typ, erfundenes
   Feld). Ist der Anteil klein, entfällt dieser CR.

Ergebnis der drei Punkte hier eintragen. Ist die Reihenfolge schon so oder der Anteil klein: CR
schließen mit Befund „nicht nötig“.

### Beleg aus immo-infra (2026-11-13, zu Punkt 1 und 3)

Kein Ersatz für die drei Punkte oben: Der Beleg stammt aus einem anderen Repo und aus dem Bau mit se-plan, nicht aus
`graph_generate`.

- In immo-infra waren alle 20 SCHEMA vor den Funktionen gebaut und als Paket mit fester Version gebunden (Stufe
  MS-INF-1, CR-INF-073 bis 080, 2026-11-04 bis 11-06).
- Trotzdem entstanden im Bau der Funktionen (immo-gate 0.22.0 und 0.23.0, 2026-11-12) drei Felder außerhalb des
  Vertragspakets 0.6.0: Merkmal „extern“ am Konto, Adresse des Partnerordners, Auftrag „Offene Freigaben“.
- Ursache dort: Die Anforderung nannte ein Datum, das im SCHEMA ihres Trägers fehlte
  (`REQ-partnervertrag-verknuepft` gegen `SCHEMA-betriebsauftrag`), und das Konto liegt in einem Speicher ohne SCHEMA.
- Folge für diesen CR: Die Reihenfolge SCHEMA vor FUNC verhindert erfundene Felder nicht allein. Es braucht zusätzlich
  den Vergleich Anforderung gegen SCHEMA vor dem Bau und das Verbot von Feldern außerhalb des Pakets im Auftrag an den
  Umsetzer. Beides steht in ITEM-2026-1325.

## Befund (Annahme, siehe oben)

Beim Bauen einer FUNC sind die Verträge an ihren Flüssen noch Prosa, solange das SCHEMA
`concept: true` ist. Der Agent erfindet dann Feldnamen und Typen im Rumpf; die Schnittstelle entsteht
als Nebenprodukt der Funktion statt vor ihr. Die Typen in den Graphen zu schreiben ist keine Lösung
(BOK-CR-026, CR-GC-454: Bindungen zeigen auf Code, sie spiegeln ihn nicht).

## Zielbild

1. In der Stufe bauen ordnet `graph_generate`: erst jedes SCHEMA an den Flüssen einer FUNC als Code
   (Zod) schreiben und per `realRef` binden, dann die FUNC.
2. Der Schritt für eine FUNC nennt je Ein- und Ausgangsfluss den `realRef` des SCHEMA
   (`Datei#Symbol`), nicht die Beschreibung.
3. Kein zweiter Pfad: keine Typkopie im Graphen, keine neue Regel im Gate. Nur Reihenfolge und Inhalt
   des Schritts.

## Akzeptanz

- Test: Für ein Modell mit ungebundenem SCHEMA an einer FUNC liefert `graph_generate` den
  SCHEMA-Schritt vor dem FUNC-Schritt (Positivkontrolle: gebundenes SCHEMA → direkt FUNC).
- Der FUNC-Schritt enthält den `realRef` aller SCHEMA an ihren Flüssen.
- Nachmessung im Rig todo-bauen, Arm lokal, N ≥ 3: Reparaturzüge auf Schnittstellen sinken gegenüber
  dem Stand aus der Verifikation (zahlt ein auf T-E4, T-E12).

## Dateien

Nach der Verifikation füllen (`graph_impact` auf die FUNC von `graph_generate`).

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
