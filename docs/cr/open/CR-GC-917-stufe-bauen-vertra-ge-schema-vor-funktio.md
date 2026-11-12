# CR-GC-917: Stufe bauen – Verträge (SCHEMA) vor Funktionen binden, FUNC-Paket trägt die echten Typen

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1319 (idea)
**Erstellt:** 2026-11-12
**Item:** bok/items/ITEM-2026-1319.json (Lane: code)

---

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
