# CR-GC-925: Antwortende Akteure und eigene Speicher bekommen Fluss und SCHEMA (kehrt Regel 1 aus CR-GC-875 um)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1328 (finding)
**Erstellt:** 2026-11-13
**Item:** bok/items/ITEM-2026-1328.json (Lane: code)

---

## Befund

se:author-actor (Version 3) sagt seit CR-GC-875: Datenquellen, Schreibziele, ein Modell und ein Backup antworten nur; die Funktion ruft sie selbst, ohne Fluss im Modell.

Folgen in immo-infra:
- Das Modell kennt 4 Akteure: Admin, Freigeber, KI-Client, Zeitplan. PropStack ist keiner.
- `FUNC-quelle-lesen` und `FUNC-ziel-schreiben` sind an den PropStack-Adapter gebunden. Die Anfrage an PropStack und die Antwort haben keinen FLOW und kein SCHEMA.
- 2026-11-07: Der Adapter lieferte 15 von 264 Feldern, der Leseschlüssel bekam 401. Zwei Reviews hatten das übersehen. se-irr Schritt 4 kam danach dazu und setzt einen FLOW voraus, den se:author-actor verbietet.
- Die Konten-Datenbank und über 20 Tabellen in immo-gate haben kein SCHEMA. Dort entstanden die Felder „extern" und „Adresse des Partnerordners" ohne Vertrag.

## Root Cause

Ohne Fluss gibt es kein SCHEMA, und ohne SCHEMA ist die Schnittstelle nicht spezifiziert. Der Grund für Regel 1 war, dass antwortende Dienste wie zweite Auslöser aussahen. `chain-roles.ts` leitet dafür inzwischen die Rolle `answer` ab.

## Entscheidung des Autors (2026-11-13)

Die Schnittstelle zu einem fremden System gehört ins Modell, auch wenn das System außerhalb des Umfangs liegt.

Das kehrt die Regel aus immo-infra CR-INF-009 (2026-10-28) teilweise um. Dort wurden 11 Akteure, 26 Flüsse zu Diensten
und die Verträge `SCHEMA-ziel-api` und `SCHEMA-sicherung` gelöscht, weil die ConOps-Ansicht antwortende Dienste als
Auslöser zählte. Die Rolle `answer` kam am selben Tag mit CR-SM-420, gemessen nach dem Löschen (immo-infra Stand 58).
Deshalb kam sie nie vor. Es bleibt: Ein antwortender Dienst ist nie Auslöser und nie Senke.

Preis: Die Zahl der Akteure und Flüsse steigt wieder (immo-infra: etwa 10 Akteure, 20 Flüsse). Die Sichten müssen die
Rolle `answer` getrennt zeigen, sonst kehrt der Befund vom 2026-10-28 zurück.

## Zielbild

| Teil | Element | Aufgabe |
|---|---|---|
| fremdes System, das antwortet | ACTOR | steht außerhalb, wird nicht gebaut |
| Anfrage | FLOW von der Funktion zum Akteur, mit SCHEMA | was das System sendet |
| Antwort | FLOW vom Akteur zur Funktion, `sync`, mit SCHEMA | nur die Felder, die das System liest |
| Adapter | genau eine FUNC je Akteur | prüft die Antwort gegen das SCHEMA |
| eigener Speicher | FUNC, die den Speicher hält, `sync`-Fluss mit SCHEMA | kein Akteur, weil Teil des Produkts |

Änderungen an den Skills:
1. se:author-actor: Regel 1 und Schritt 3 umkehren. Ein antwortendes fremdes System ist ein Akteur mit der abgeleiteten Rolle `answer`; er löst nichts aus.
2. se:author-actor: Die Schwelle „mehr als 7" zählt nur Auslöser und Empfänger.
3. se:top-level Schritt 3: Zugriff auf einen eigenen Speicher ist ein `sync`-Fluss zwischen zwei Funktionen mit SCHEMA.
4. se-irr Schritt 4: liest das SCHEMA der Antwort-Flüsse und belegt es mit der Zählabfrage.
5. ConOps-Ansicht (`src/projections/graphcode.ts`): Ein antwortender Akteur steht nur unter „Liefert zu", nicht zusätzlich unter „Empfaenger", obwohl er die Anfrage empfängt.
6. Parameter und Konfiguration bleiben bei CR-SM-419 (Einstellungs-Vertrag mit FLOW und SCHEMA).

Begriff in der Literatur: „supporting actor" (Cockburn), Terminator im Kontextdiagramm (Strukturierte Analyse).

## Akzeptanz

- `tests/skill-top-level-ausloeser.test.ts` prüft die neuen Sätze; vorher rot.
- Kein Skill sagt mehr „ohne Fluss im Modell" für eine fremde Quelle.
- Die ConOps-Ansicht zeigt in einem Testmodell den antwortenden Akteur nur unter „Liefert zu"; vorher rot.
- Validierung in immo-infra (CR-INF-147): PropStack als Akteur bekommt die Rolle `answer`, FC-06 meldet keinen zweiten Auslöser.

## Dateien (7)

`.claude/commands/se/author-actor.md`, `.claude/commands/se/top-level.md`, `.claude/commands/se-irr.md`, `tests/skill-top-level-ausloeser.test.ts`, `tests/skill-irr-fremde-quellen.test.ts`, `src/projections/graphcode.ts`, ein Test der ConOps-Ansicht mit einem antwortenden Akteur.

## Abhängig von

CR-SM-438.

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1126, Tiefe 1, Wurzeln: `FUNC-author-actor`, `FUNC-se-top-level`, `FUNC-se-irr`._

Reichweite: 6 Elemente (FLOW 1, FUNC 5); Blackbox-Rand 3, nicht geoeffnet.

Dateien (realRef, 3):
- .claude/commands/se-irr.md
- .claude/commands/se/author-actor.md
- .claude/commands/se/top-level.md

Tests (`graph_tests`, 2):
- tests/skill-authoring-gate.test.ts
- tests/skill-irr-fremde-quellen.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
