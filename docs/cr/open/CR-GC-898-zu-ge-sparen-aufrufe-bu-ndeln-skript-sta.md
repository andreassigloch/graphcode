# CR-GC-898: Züge sparen: Aufrufe bündeln, Skript statt Kette, se-retro misst Einzelaufrufe

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1274 (finding)
**Erstellt:** 2026-11-09
**Item:** bok/items/ITEM-2026-1274.json (Lane: code)

---

Befund aus immo-infra, Hauptsitzung 2026-10-29..11-09: 1642 von 2174 Zügen mit Werkzeugen (76 %) enthalten genau einen Aufruf; sie tragen 330 M von 482 M Kontext-Token. Jeder Zug schickt den ganzen Kontext (Cache-Lesen zu 10 % des Eingabepreises; trotzdem rund 60 % der Kosten der Sitzung). Folgen von 3+ gleichen Einzelaufrufen (python3, grep, graph_mutate, ssh, Tests auf dem VPS) kosteten rund 150 Züge und 35 M Token. Rund 12 Fix-Commits für Skripte zum Ausrollen und Testen auf dem VPS (tar-Pfad, osm.sh, IPv4) waren Fehlversuche direkt auf der Zielumgebung.

Einordnung: Der größere Hebel ist die Kontextgröße (siehe CR zum Sitzungsbeginn). Dieser CR betrifft die Zahl der Züge.

## Änderung (GRAPHCODE.md-Vorlage `src/surface/scaffold-templates.ts`, se-retro)
1. Hausregel „Züge sparen“: unabhängige Lese- und Abfrageaufrufe im selben Zug absetzen; wiederkehrende Prüfungen (Tests auf der Zielumgebung, Abfragen über den Graph) als ein Skript mit kurzer Ausgabe statt einer Kette aus grep/sed/cat; Ausgaben begrenzen (`| tail -n 20`, gezielte Abfragen), weil alles im Kontext in jedem Folgezug mitgelesen wird.
2. Skripte zum Ausrollen erst gegen einen lokalen Trockenlauf prüfen, dann auf der Zielumgebung.
3. se-retro: Kennzahl „Einzelaufrufe“ — Anteil der Züge mit genau einem Werkzeugaufruf und Token in Folgen von 3+ gleichen Aufrufen.

## Akzeptanzkriterien
- Vorlage enthält die Hausregel; Scaffold-Test prüft sie.
- se-retro meldet die Kennzahl „Einzelaufrufe“ für immo-infra mit den Werten dieses Befunds als Ausgangswert.

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** kein Host in /Users/andreas/Developer/dev/graphcode (keine host.sock).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
